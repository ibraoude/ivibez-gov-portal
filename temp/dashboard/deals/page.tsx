'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Deal = {
  id: string
  property_name: string
  purchase_price: number
  rehab_cost: number
  arv: number
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [propertyName, setPropertyName] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [rehabCost, setRehabCost] = useState('')
  const [arv, setArv] = useState('')
  const router = useRouter()

  useEffect(() => {
    fetchDeals()
  }, [])

  const fetchDeals = async () => {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setDeals(data)
    }
  }

  const handleCreateDeal = async () => {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      router.push('/login')
      return
    }

    const { error } = await supabase.from('deals').insert([
      {
        user_id: userData.user.id,
        property_name: propertyName,
        purchase_price: Number(purchasePrice),
        rehab_cost: Number(rehabCost),
        arv: Number(arv),
      },
    ])

    if (!error) {
      setPropertyName('')
      setPurchasePrice('')
      setRehabCost('')
      setArv('')
      fetchDeals()
    } else {
      alert(error.message)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Deals</h1>

      <div className="mb-8 space-y-4">
        <input
          className="border p-2 w-full"
          placeholder="Property Name"
          value={propertyName}
          onChange={(e) => setPropertyName(e.target.value)}
        />
        <input
          className="border p-2 w-full"
          placeholder="Purchase Price"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
        />
        <input
          className="border p-2 w-full"
          placeholder="Rehab Cost"
          value={rehabCost}
          onChange={(e) => setRehabCost(e.target.value)}
        />
        <input
          className="border p-2 w-full"
          placeholder="ARV"
          value={arv}
          onChange={(e) => setArv(e.target.value)}
        />

        <button
          className="bg-black text-white px-4 py-2"
          onClick={handleCreateDeal}
        >
          Create Deal
        </button>
      </div>

      <div className="space-y-4">
        {deals.map((deal) => (
          <div key={deal.id} className="border p-4">
            <h2 className="font-bold">{deal.property_name}</h2>
            <p>Purchase: ${deal.purchase_price}</p>
            <p>Rehab: ${deal.rehab_cost}</p>
            <p>ARV: ${deal.arv}</p>
          </div>
        ))}
      </div>
    </div>
  )
}