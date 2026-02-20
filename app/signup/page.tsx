'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { parsePhoneNumberFromString } from 'libphonenumber-js'

type CountryOption = { code: string; name: string }

const COUNTRIES: CountryOption[] = [
  { code: 'US', name: 'United States' },
  //{ code: 'CA', name: 'Canada' },
  //{ code: 'GB', name: 'United Kingdom' },
  //{ code: 'FR', name: 'France' },
  //{ code: 'DE', name: 'Germany' },
 // { code: 'NG', name: 'Nigeria' },
 // { code: 'GH', name: 'Ghana' },
 // { code: 'CM', name: 'Cameroon' },
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO',
  'MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
]

const CA_PROVINCES = [
  'AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'
]

function isValidUSZip(zip: string) {
  return /^\d{5}(-\d{4})?$/.test(zip.trim())
}

export default function Signup() {
  const router = useRouter()

  const address1Ref = useRef<HTMLInputElement | null>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    role: 'client',
    company: '',
    email: '',
    password: '',

    // Address
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateRegion: '',
    postalCode: '',
    countryCode: 'US',
  })

  const regionOptions = useMemo(() => {
    if (formData.countryCode === 'US') return US_STATES
    if (formData.countryCode === 'CA') return CA_PROVINCES
    return null
  }, [formData.countryCode])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // clear error when user edits field
    setErrors((prev) => {
      const copy = { ...prev }
      delete copy[name]
      return copy
    })
  }

  // ---------- Google Places Autocomplete ----------
  useEffect(() => {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) return

  let isMounted = true

  async function loadMaps() {
    setOptions({
      apiKey: key,
      version: 'weekly',
    })

    const { Autocomplete } = await importLibrary('places') as google.maps.PlacesLibrary

    if (!isMounted || !address1Ref.current) return

    const autocomplete = new Autocomplete(address1Ref.current, {
      fields: ['address_components', 'formatted_address'],
      types: ['address'],
    })

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      const comps = place.address_components || []

      const get = (type: string) =>
        comps.find((c) => c.types.includes(type))?.long_name || ''
      const getShort = (type: string) =>
        comps.find((c) => c.types.includes(type))?.short_name || ''

      const streetNumber = get('street_number')
      const route = get('route')
      const city =
        get('locality') || get('postal_town') || get('sublocality') || ''
      const stateRegion = getShort('administrative_area_level_1')
      const postalCode = get('postal_code')
      const countryCode = getShort('country')

      const addressLine1 = [streetNumber, route].filter(Boolean).join(' ').trim()

      setFormData((prev) => ({
        ...prev,
        addressLine1: addressLine1 || prev.addressLine1,
        city: city || prev.city,
        stateRegion: stateRegion || prev.stateRegion,
        postalCode: postalCode || prev.postalCode,
        countryCode: countryCode || prev.countryCode,
      }))
    })
  }

  loadMaps()

  return () => {
    isMounted = false
  }
}, [])

  // ---------- Auto-detect city/state from ZIP (US only) ----------
  const handleZipBlur = async () => {
    const zip = formData.postalCode.trim()
    if (formData.countryCode !== 'US') return
    if (!zip) return

    // Validate zip before trying lookup
    if (!isValidUSZip(zip)) {
      setErrors((prev) => ({ ...prev, postalCode: 'Invalid US ZIP code (e.g., 21044 or 21044-1234).' }))
      return
    }

    try {
      // Zippopotam.us is a simple free ZIP lookup API (no key).
      // Example: https://api.zippopotam.us/us/21044
      const res = await fetch(`https://api.zippopotam.us/us/${zip.substring(0, 5)}`)
      if (!res.ok) return
      const data = await res.json()

      const place = data?.places?.[0]
      if (!place) return

      const city = place['place name'] || ''
      const state = place['state abbreviation'] || ''

      setFormData((prev) => ({
        ...prev,
        city: prev.city || city,
        stateRegion: prev.stateRegion || state,
      }))
    } catch {
      // ignore lookup failures; user can still type manually
    }
  }

  // ---------- Validation ----------
  const validate = () => {
    const nextErrors: Record<string, string> = {}

    if (!formData.firstName.trim()) nextErrors.firstName = 'First name is required.'
    if (!formData.lastName.trim()) nextErrors.lastName = 'Last name is required.'
    if (!formData.email.trim()) nextErrors.email = 'Email is required.'
    if (!formData.password.trim() || formData.password.length < 8)
      nextErrors.password = 'Password must be at least 8 characters.'

    // Phone validation (international)
    const phone = formData.phone.trim()
    if (!phone) {
      nextErrors.phone = 'Phone number is required.'
    } else {
      const parsed = parsePhoneNumberFromString(phone, formData.countryCode as any)
      if (!parsed || !parsed.isValid()) {
        nextErrors.phone = 'Enter a valid phone number (include country code if needed).'
      }
    }

    // Address: for public SaaS you can choose optional, but since you asked to add it,
    // we’ll validate the core fields.
    if (!formData.addressLine1.trim()) nextErrors.addressLine1 = 'Address line 1 is required.'
    if (!formData.city.trim()) nextErrors.city = 'City is required.'

    if (formData.countryCode === 'US') {
      if (!formData.stateRegion.trim()) nextErrors.stateRegion = 'State is required.'
      if (!formData.postalCode.trim()) nextErrors.postalCode = 'ZIP code is required.'
      else if (!isValidUSZip(formData.postalCode)) {
        nextErrors.postalCode = 'Invalid US ZIP code (e.g., 21044 or 21044-1234).'
      }
    } else {
      // For non-US, keep it light: region + postal optional depending on your needs.
      if (!formData.stateRegion.trim()) nextErrors.stateRegion = 'State/Region is required.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  // ---------- Signup ----------
  const handleSignup = async () => {
    if (!validate()) return

    setLoading(true)
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        phone,
        role,
        company,
        addressLine1,
        addressLine2,
        city,
        stateRegion,
        postalCode,
        countryCode,
      } = formData

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role,
          },
        },
      })

      if (error) {
        alert(error.message)
        return
      }

      const userId = data.user?.id
      if (!userId) {
        alert('Signup succeeded but no user ID returned.')
        return
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        first_name: firstName,
        last_name: lastName,
        phone,
        role,
        company,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        state_region: stateRegion,
        postal_code: postalCode,
        country_code: countryCode,
      })

      if (profileError) {
        alert(profileError.message)
        return
      }

      alert('Account created! Please check your email to verify your account (if enabled).')
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fieldClass = (name: string) =>
    `border p-2 w-[320px] ${errors[name] ? 'border-red-500' : 'border-gray-300'}`

  const ErrorText = ({ name }: { name: string }) =>
    errors[name] ? <div className="text-red-600 text-sm w-[320px]">{errors[name]}</div> : null

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 p-6">
      <h1 className="text-2xl font-bold">Create Account</h1>

      <input name="firstName" placeholder="First Name" className={fieldClass('firstName')} onChange={handleChange} />
      <ErrorText name="firstName" />

      <input name="lastName" placeholder="Last Name" className={fieldClass('lastName')} onChange={handleChange} />
      <ErrorText name="lastName" />

      <input name="phone" placeholder="Phone (e.g., +1 240 555 1234)" className={fieldClass('phone')} onChange={handleChange} />
      <ErrorText name="phone" />

      <input name="company" placeholder="Company (Optional)" className={fieldClass('company')} onChange={handleChange} />

      {/* Country dropdown */}
      <select name="countryCode" className={fieldClass('countryCode')} value={formData.countryCode} onChange={handleChange}>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>

      {/* Address with Google Places Autocomplete */}
      <input
        ref={address1Ref}
        name="addressLine1"
        placeholder="Address Line 1"
        className={fieldClass('addressLine1')}
        value={formData.addressLine1}
        onChange={handleChange}
      />
      <ErrorText name="addressLine1" />

      <input
        name="addressLine2"
        placeholder="Address Line 2 (Apt, Suite, etc.)"
        className={fieldClass('addressLine2')}
        value={formData.addressLine2}
        onChange={handleChange}
      />

      <input
        name="city"
        placeholder="City"
        className={fieldClass('city')}
        value={formData.city}
        onChange={handleChange}
      />
      <ErrorText name="city" />

      {/* Dynamic State/Province dropdown */}
      {regionOptions ? (
        <select
          name="stateRegion"
          className={fieldClass('stateRegion')}
          value={formData.stateRegion}
          onChange={handleChange}
        >
          <option value="">Select State/Province</option>
          {regionOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      ) : (
        <input
          name="stateRegion"
          placeholder="State / Region"
          className={fieldClass('stateRegion')}
          value={formData.stateRegion}
          onChange={handleChange}
        />
      )}
      <ErrorText name="stateRegion" />

      <input
        name="postalCode"
        placeholder={formData.countryCode === 'US' ? 'ZIP Code' : 'Postal Code'}
        className={fieldClass('postalCode')}
        value={formData.postalCode}
        onChange={handleChange}
        onBlur={handleZipBlur}
      />
      <ErrorText name="postalCode" />

      <select name="role" className={fieldClass('role')} value={formData.role} onChange={handleChange}>
        <option value="client">Client</option>
        <option value="agent">Agent</option>
        <option value="admin">Admin</option>
      </select>

      <input name="email" type="email" placeholder="Email" className={fieldClass('email')} onChange={handleChange} />
      <ErrorText name="email" />

      <input name="password" type="password" placeholder="Password (min 8 chars)" className={fieldClass('password')} onChange={handleChange} />
      <ErrorText name="password" />

      <button
        className="bg-black text-white px-4 py-2 w-[320px] disabled:opacity-60"
        onClick={handleSignup}
        disabled={loading}
      >
        {loading ? 'Creating account...' : 'Sign Up'}
      </button>
    </div>
  )
}
