'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('inviteToken')

  const handleLogin = async () => {
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    /* ==================================
       🔥 IF INVITE EXISTS → ACCEPT FLOW
    =================================== */

    if (inviteToken) {
      router.push(`/invite/accept?token=${inviteToken}`)
    } else {
      router.push('/dashboard')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white w-[420px] p-12 rounded-2xl shadow-xl">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="flex items-baseline">
            <span className="text-6xl font-black text-green-700 tracking-tight">
              iVibeZ
            </span>
            <span className="ml-3 text-3xl font-bold text-blue-700 tracking-tight">
              Solutions
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-center mb-8">
          Login
        </h1>

        {/* Email */}
        <div className="mb-5">
          <label className="block mb-2 text-sm font-medium">
            Email
          </label>
          <input
            type="email"
            placeholder="Enter your email"
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* Password */}
        <div className="mb-6">
          <label className="block mb-2 text-sm font-medium">
            Password
          </label>
          <input
            type="password"
            placeholder="Enter your password"
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>

        {/* Footer */}
        <p className="text-center text-sm mt-6">
          Don’t have an account?{" "}
          <span
            className="text-blue-600 font-medium cursor-pointer"
            onClick={() =>
              router.push(
                `/signup${inviteToken ? `?inviteToken=${inviteToken}` : ''}`
              )
            }
          >
            Sign up
          </span>
        </p>

      </div>
    </div>
  )
}