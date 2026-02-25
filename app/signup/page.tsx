'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import Image from 'next/image'

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
    key: key,
    v: 'weekly',
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
    console.log("Signup clicked")
    //if (!validate()) return

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
      router.replace('/login?registered=true')
      alert('Account created! Please check your email to verify your account (if enabled).')
    } finally {
      setLoading(false)
    }
  }

  const fieldClass = (name: string) =>
    `border p-2 w-[320px] ${errors[name] ? 'border-red-500' : 'border-gray-300'}`

  const ErrorText = ({ name }: { name: string }) =>
    errors[name] ? <div className="text-red-600 text-sm w-[320px]">{errors[name]}</div> : null

  return (
  <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 flex items-center justify-center px-6 py-12">
    
    <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-12 space-y-10">

      <div className="flex flex-col items-center text-center space-y-6">

          {/* Logo */}
      <div className="flex justify-center mb-8">
        <div className="flex items-baseline">
          <span className="text-6xl md:text-7xl font-black text-green-700 tracking-tight">
            iVibeZ
          </span>
          <span className="ml-3 text-3xl md:text-4xl font-bold text-blue-700 tracking-tight">
            Solutions
          </span>
        </div>
      </div>

          {/* TAGLINE */}
          {/*<p className="text-gray-500 text-lg tracking-wide max-w-md">
            Your platform tagline goes right here. 
            You can describe what your SaaS does in one strong sentence.
          </p>*/}

          {/* TITLE */}
          <h1 className="text-3xl font-bold text-gray-900">
            Create Account
          </h1>

        </div>

      {/* FORM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="space-y-2">
          <label className="font-semibold text-gray-800">First Name</label>
          <input name="firstName" className="input-large" onChange={handleChange} />
        </div>

        <div className="space-y-2">
          <label className="font-semibold text-gray-800">Last Name</label>
          <input name="lastName" className="input-large" onChange={handleChange} />
        </div>

        <div className="space-y-2">
          <label className="font-semibold text-gray-800">Phone</label>
          <input name="phone" className="input-large" onChange={handleChange} />
        </div>

        <div className="space-y-2">
          <label className="font-semibold text-gray-800">Company (Optional)</label>
          <input name="company" className="input-large" onChange={handleChange} />
        </div>

        <div className="space-y-2">
          <label className="font-semibold text-gray-800">Country</label>
          <select
            name="countryCode"
            className="input-large"
            value={formData.countryCode}
            onChange={handleChange}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="font-semibold text-gray-800">Address Line 1</label>
          <input
            ref={address1Ref}
            name="addressLine1"
            className="input-large"
            value={formData.addressLine1}
            onChange={handleChange}
          />
        </div>

        <div className="md:col-span-2 space-y-2">
          <label className="font-semibold text-gray-800">
            Address Line 2 (Apt, Suite, etc.)
          </label>
          <input
            name="addressLine2"
            className="input-large"
            value={formData.addressLine2}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <label className="font-semibold text-gray-800">City</label>
          <input
            name="city"
            className="input-large"
            value={formData.city}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <label className="font-semibold text-gray-800">State / Province</label>
          {regionOptions ? (
            <select
              name="stateRegion"
              className="input-large"
              value={formData.stateRegion}
              onChange={handleChange}
            >
              <option value="">Select State / Province</option>
              {regionOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          ) : (
            <input
              name="stateRegion"
              className="input-large"
              value={formData.stateRegion}
              onChange={handleChange}
            />
          )}
        </div>

        <div className="space-y-2">
          <label className="font-semibold text-gray-800">ZIP Code</label>
          <input
            name="postalCode"
            className="input-large"
            value={formData.postalCode}
            onChange={handleChange}
            onBlur={handleZipBlur}
          />
        </div>

        <div className="space-y-2">
          <label className="font-semibold text-gray-800">Role</label>
          <select
            name="role"
            className="input-large"
            value={formData.role}
            onChange={handleChange}
          >
            <option value="client">Client</option>
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="font-semibold text-gray-800">Email</label>
          <input
            name="email"
            type="email"
            className="input-large"
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <label className="font-semibold text-gray-800">Password</label>
          <input
            name="password"
            type="password"
            className="input-large"
            onChange={handleChange}
          />
        </div>

      </div>

      {/* GREEN BUTTON */}
      <button
        onClick={handleSignup}
        disabled={loading}
        className={`w-full py-4 rounded-xl text-lg font-semibold transition-all duration-200
          ${loading 
            ? "bg-green-400 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-700 hover:shadow-lg active:scale-[0.98]"}
          text-white`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
            Creating Account...
          </span>
        ) : (
          "Sign Up"
        )}
      </button>

    </div>
  </div>
)
}

