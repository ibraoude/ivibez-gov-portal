'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        router.push('/login')
      } else {
        setLoading(false)
      }
    }

    checkUser()
  }, [router])

  if (loading) {
    return <div className="p-6">Checking session...</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">iVibeZ Dashboard</h1>
      <p className="mt-4">Welcome to your operating system.</p>

      <div className="flex gap-4 mt-6">
        <button
          className="bg-gray-800 text-white px-4 py-2"
          onClick={() => router.push('/dashboard/deals')}
        >
          Go to Deals
        </button>

        <button
          className="bg-blue-700 text-white px-4 py-2"
          onClick={() => router.push('/dashboard/contracts')}
        >
          Go to Contract Tracker
        </button>

        <button
          className="bg-black text-white px-4 py-2"
          onClick={async () => {
            await supabase.auth.signOut()
            router.push('/login')
          }}
        >
          Logout
        </button>
      </div>
    </div>
  )
}