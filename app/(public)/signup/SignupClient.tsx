"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getRecaptchaToken } from "@/lib/security/recaptcha-client";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";

const US_STATES = [
"AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
"KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
"NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
];

function isValidUSZip(zip: string) {
return /^\d{5}(-\d{4})?$/.test(zip.trim());
}

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
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  error?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  autocomplete?: string;
  full?: boolean;
};

type PasswordInputProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  toggle: () => void;
  error?: string;
};

type Errors = Partial<Record<keyof FormData, string>>;

export default function Signup() {

const router = useRouter();
const searchParams = useSearchParams();
const supabase = createClient();

const address1Ref = useRef<HTMLInputElement | null>(null);

const [loading,setLoading] = useState(false);
const [errors,setErrors] = useState<Errors>({});

const [showPassword,setShowPassword] = useState(false);
const [showConfirmPassword,setShowConfirmPassword] = useState(false);

const [formData,setFormData] = useState<FormData>({
first_name:"",
last_name:"",
phone:"",
email:"",
password:"",
confirm_password:"",
address_line1:"",
address_line2:"",
city:"",
state:"",
postal_code:"",
country:"United States",
country_code:"US"
});

useEffect(()=>{

const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
if(!key) return;

const input = address1Ref.current;
if(!(input instanceof HTMLInputElement)) return;

setOptions({ key, v:"weekly" });

(async()=>{

const lib = await importLibrary("places");

const autocomplete = new (lib as any).Autocomplete(input,{
fields:["address_components"],
types:["address"]
});

autocomplete.addListener("place_changed",()=>{

const place = autocomplete.getPlace();
const comps = place.address_components || [];

const get = (type:string)=>
comps.find((c:any)=>c.types.includes(type))?.long_name || "";

const getShort = (type:string)=>
comps.find((c:any)=>c.types.includes(type))?.short_name || "";

setFormData(prev=>({
...prev,
address_line1:`${get("street_number")} ${get("route")}`.trim(),
city:get("locality") || get("postal_town"),
state:getShort("administrative_area_level_1"),
postal_code:get("postal_code"),
country:get("country") || "United States",
country_code:getShort("country") || "US"
}));

});

})();

},[]);

const validate = () => {

const e:Errors = {};

if(!formData.first_name) e.first_name="First name required";
if(!formData.last_name) e.last_name="Last name required";
if(!formData.email) e.email="Email required";

if(!formData.password || formData.password.length < 8)
e.password="Password must be at least 8 characters";

if(formData.password !== formData.confirm_password)
e.confirm_password="Passwords do not match";

if(!formData.address_line1) e.address_line1="Address required";
if(!formData.city) e.city="City required";
if(!formData.state) e.state="State required";

if(!isValidUSZip(formData.postal_code))
e.postal_code="Valid ZIP required";

const parsed = parsePhoneNumberFromString(formData.phone,"US");
if(!parsed || !parsed.isValid())
e.phone="Valid phone required";

setErrors(e);

return Object.keys(e).length === 0;

};

const handleSignup = async () => {

if(!validate()) return;

setLoading(true);

try{

await supabase.auth.signOut({scope:"local"});

const recaptchaToken = await getRecaptchaToken("signup");

const res = await fetch("/api/signup",{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({ recaptchaToken,...formData })
});

const data = await res.json().catch(()=>({}));

if(!res.ok){
setErrors({email:data?.error || "Signup failed"});
return;
}

const { data:loginData, error:loginError } =
await supabase.auth.signInWithPassword({
email:formData.email.toLowerCase(),
password:formData.password
});

if(loginError || !loginData?.session){

const next = searchParams.get("returnTo");
router.push(next || "/login");
return;

}

const next = searchParams.get("returnTo");
router.push(next || "/dashboard");

}
catch{
setErrors({email:"Unexpected error occurred"});
}
finally{
setLoading(false);
}

};

return (

<div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">

<div className="w-full max-w-4xl bg-white shadow-xl rounded-2xl p-10">

<h1 className="text-3xl font-bold text-center mb-8">
Create Your Account
</h1>

<form
onSubmit={(e)=>{
e.preventDefault();
handleSignup();
}}
className="grid md:grid-cols-2 gap-6"
>

<Input
label="First Name"
name="first_name"
value={formData.first_name}
onChange={(v)=>setFormData({...formData,first_name:v})}
error={errors.first_name}
autocomplete="given-name"
/>

<Input
label="Last Name"
name="last_name"
value={formData.last_name}
onChange={(v)=>setFormData({...formData,last_name:v})}
error={errors.last_name}
autocomplete="family-name"
/>

<Input
label="Phone"
name="phone"
value={formData.phone}
onChange={(v)=>setFormData({...formData,phone:v})}
error={errors.phone}
autocomplete="tel"
/>

<Input
label="Email"
name="email"
type="email"
value={formData.email}
onChange={(v)=>setFormData({...formData,email:v})}
error={errors.email}
autocomplete="email"
/>

<PasswordInput
label="Password"
name="password"
value={formData.password}
onChange={(v)=>setFormData({...formData,password:v})}
visible={showPassword}
toggle={()=>setShowPassword(!showPassword)}
error={errors.password}
/>

<PasswordInput
label="Confirm Password"
name="confirm_password"
value={formData.confirm_password}
onChange={(v)=>setFormData({...formData,confirm_password:v})}
visible={showConfirmPassword}
toggle={()=>setShowConfirmPassword(!showConfirmPassword)}
error={errors.confirm_password}
/>

<Input
label="Address Line 1"
name="address_line1"
value={formData.address_line1}
onChange={(v)=>setFormData({...formData,address_line1:v})}
error={errors.address_line1}
inputRef={address1Ref}
full
autocomplete="address-line1"
/>

<Input
label="Address Line 2"
name="address_line2"
value={formData.address_line2}
onChange={(v)=>setFormData({...formData,address_line2:v})}
autocomplete="address-line2"
full
/>

<Input
label="City"
name="city"
value={formData.city}
onChange={(v)=>setFormData({...formData,city:v})}
error={errors.city}
autocomplete="address-level2"
/>

<div>

<label htmlFor="state" className="block text-sm font-medium mb-1">
State
</label>

<select
id="state"
value={formData.state}
onChange={(e)=>setFormData({...formData,state:e.target.value})}
className="input-large"
>

<option value="">Select state</option>

{US_STATES.map(s=>(
<option key={s} value={s}>
{s}
</option>
))}

</select>

{errors.state && (
<p className="text-red-600 text-sm" role="alert">
{errors.state}
</p>
)}

</div>

<Input
label="ZIP Code"
name="postal_code"
value={formData.postal_code}
onChange={(v)=>setFormData({...formData,postal_code:v})}
error={errors.postal_code}
autocomplete="postal-code"
/>

<button
type="submit"
disabled={loading}
aria-busy={loading}
className="md:col-span-2 w-full py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl"
>

{loading ? "Creating Account…" : "Create Account"}

</button>

</form>

</div>

</div>

);

}

function Input({
  label,
  name,
  value,
  onChange,
  type = "text",
  error,
  inputRef,
  autocomplete,
  full,
}: InputProps) {

  return (
    <div className={full ? "md:col-span-2" : ""}>

      <label htmlFor={name} className="block text-sm font-medium mb-1">
        {label}
      </label>

      <input
        id={name}
        name={name}
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autocomplete}
        className="input-large"
      />

      {error && (
        <p className="text-red-600 text-sm" role="alert">
          {error}
        </p>
      )}

    </div>
  );
}

function PasswordInput({
  label,
  name,
  value,
  onChange,
  visible,
  toggle,
  error,
}: PasswordInputProps) {

  return (
    <div className="relative">

      <label htmlFor={name} className="block text-sm font-medium mb-1">
        {label}
      </label>

      <input
        id={name}
        name={name}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
        className="input-large pr-12"
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-9 text-gray-500"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>

      {error && (
        <p className="text-red-600 text-sm" role="alert">
          {error}
        </p>
      )}

    </div>
  );
}