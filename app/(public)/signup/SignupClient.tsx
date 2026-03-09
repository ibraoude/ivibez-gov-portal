
// app/(public)/signup/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getRecaptchaToken } from "@/lib/security/recaptcha-client";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO",
  "MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

function isValidUSZip(zip: string) {
  return /^\d{5}(-\d{4})?$/.test(zip.trim());
}

/* =============================
   TYPES
============================== */

type FormData = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  password: string;
  confirm_password: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  country_code: string;
};

type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  full?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

type PasswordInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  toggle: () => void;
};

/** Minimal shape for Google Places Autocomplete (avoid `any`) */
type PlaceAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};
type PlacesLib = {
  Autocomplete: new (
    input: HTMLInputElement,
    opts: { fields: string[]; types: string[] }
  ) => {
    addListener: (evt: "place_changed", cb: () => void) => void;
    getPlace: () => { address_components?: PlaceAddressComponent[] };
  };
};

export default function Signup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const address1Ref = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    password: "",
    confirm_password: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "United States",
    country_code: "US",
  });

  /* =============================
     Google Places
  ============================== */
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;

    const input = address1Ref.current;
    if (!(input instanceof HTMLInputElement)) return;

    setOptions({ key, v: "weekly" });

    (async () => {
      const lib = (await importLibrary("places")) as unknown as PlacesLib;
      if (!(address1Ref.current instanceof HTMLInputElement)) return;

      const autocomplete = new lib.Autocomplete(address1Ref.current, {
        fields: ["address_components"],
        types: ["address"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const comps = place.address_components || [];

        const get = (type: string) =>
          comps.find((c) => c.types.includes(type))?.long_name || "";

        const getShort = (type: string) =>
          comps.find((c) => c.types.includes(type))?.short_name || "";

        setFormData((prev) => ({
          ...prev,
          address_line1: `${get("street_number")} ${get("route")}`.trim(),
          city: get("locality") || get("postal_town"),
          state: getShort("administrative_area_level_1"),
          postal_code: get("postal_code"),
          country: get("country") || "United States",
          country_code: getShort("country") || "US",
        }));
      });
    })();
  }, []);

  /* =============================
     Validation
  ============================== */
  const validate = () => {
    if (!formData.first_name) return alert("First name required");
    if (!formData.last_name) return alert("Last name required");
    if (!formData.email) return alert("Email required");
    if (!formData.password || formData.password.length < 8)
      return alert("Password must be at least 8 characters");
    if (formData.password !== formData.confirm_password)
      return alert("Passwords do not match");
    if (!formData.address_line1) return alert("Address required");
    if (!formData.city) return alert("City required");
    if (!formData.state) return alert("State required");
    if (!isValidUSZip(formData.postal_code)) return alert("Valid ZIP required");

    const parsed = parsePhoneNumberFromString(formData.phone, "US");
    if (!parsed || !parsed.isValid()) return alert("Valid phone required");

    return true;
  };

  /* =============================
     Signup
  ============================== */
  const handleSignup = async () => {
    if (!validate()) return;

    setLoading(true);

    try {
      // Make sure any current client session is cleared (best effort).
      await supabase.auth.signOut({ scope: "local" });

      const recaptchaToken = await getRecaptchaToken("signup");

      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recaptchaToken, ...formData }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as { error?: string })?.error || "Signup failed");
        return;
      }

      // Immediately sign in the new user (optional; or you can require email confirm)
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: formData.email.toLowerCase(),
          password: formData.password,
        });

      if (loginError || !loginData?.session) {
        alert("Account created but login failed.");
        // Preserve intent if present:
        const next = searchParams.get("returnTo");
        router.push(next || "/login");
        return;
      }

      // ✅ Respect returnTo if provided (e.g., user started signup mid-flow)
      const next = searchParams.get("returnTo");
      router.push(next || "/dashboard");
    } catch (err) {
      console.error(err);
      alert("Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  /* =============================
     UI
  ============================== */
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-white shadow-xl rounded-2xl p-10 space-y-8">
        <h1 className="text-3xl font-bold text-center">Create Your Account</h1>

        <div className="grid md:grid-cols-2 gap-6">
          <Input
            label="First Name"
            value={formData.first_name}
            onChange={(v) => setFormData({ ...formData, first_name: v })}
          />

          <Input
            label="Last Name"
            value={formData.last_name}
            onChange={(v) => setFormData({ ...formData, last_name: v })}
          />

          <Input
            label="Phone"
            value={formData.phone}
            onChange={(v) => setFormData({ ...formData, phone: v })}
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(v) => setFormData({ ...formData, email: v })}
          />

          <PasswordInput
            label="Password"
            value={formData.password}
            visible={showPassword}
            toggle={() => setShowPassword(!showPassword)}
            onChange={(v) => setFormData({ ...formData, password: v })}
          />

          <PasswordInput
            label="Confirm Password"
            value={formData.confirm_password}
            visible={showConfirmPassword}
            toggle={() => setShowConfirmPassword(!showConfirmPassword)}
            onChange={(v) => setFormData({ ...formData, confirm_password: v })}
          />

          <Input
            label="Address Line 1"
            value={formData.address_line1}
            onChange={(v) => setFormData({ ...formData, address_line1: v })}
            full
            inputRef={address1Ref}
          />

          <Input
            label="Address Line 2"
            value={formData.address_line2}
            onChange={(v) => setFormData({ ...formData, address_line2: v })}
            full
          />

          <Input
            label="City"
            value={formData.city}
            onChange={(v) => setFormData({ ...formData, city: v })}
          />

          <div className="">
            <select
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="input-large"
            >
              <option value="">State</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="ZIP Code"
            value={formData.postal_code}
            onChange={(v) => setFormData({ ...formData, postal_code: v })}
          />
        </div>

        <button
          onClick={handleSignup}
          disabled={loading}
          className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition"
        >
          {loading ? "Creating Account…" : "Create Account"}
        </button>
      </div>
    </div>
  );
}

/* =============================
   Reusable Components
============================== */

function Input({
  label,
  value,
  onChange,
  type = "text",
  full,
  inputRef,
}: InputProps) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <input
        ref={inputRef}
        type={type}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-large"
      />
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  visible,
  toggle,
}: PasswordInputProps) {
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-large pr-12"
      />
      <button
        type="button"
        onClick={toggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
