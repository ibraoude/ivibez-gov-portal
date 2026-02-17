'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Contract = {
  id: string
  title: string
  agency: string
  naics: string
  stage: string
  deadline: string
  estimated_value: number
  notes: string
}

const STAGES = [
  'Identified',
  'Researching',
  'Preparing Proposal',
  'Submitted',
  'Awarded',
  'Lost',
] as const

function daysUntil(dateStr?: string) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const diffMs = d.getTime() - today.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function deadlineLabel(dateStr?: string) {
  const d = daysUntil(dateStr)
  if (d === null) return 'No deadline'
  if (d < 0) return `Past due (${Math.abs(d)}d)`
  if (d === 0) return 'Due today'
  return `${d}d left`
}

function deadlineStyle(dateStr?: string) {
  const d = daysUntil(dateStr)
  if (d === null) return 'text-gray-600'
  if (d < 0) return 'text-red-700 font-semibold'
  if (d <= 7) return 'text-red-600 font-semibold'
  if (d <= 14) return 'text-orange-600 font-semibold'
  return 'text-gray-700'
}

function stageBadgeClass(stage: string) {
  switch (stage) {
    case 'Awarded':
      return 'bg-green-100 text-green-800'
    case 'Lost':
      return 'bg-red-100 text-red-800'
    case 'Submitted':
      return 'bg-purple-100 text-purple-800'
    case 'Preparing Proposal':
      return 'bg-orange-100 text-orange-800'
    case 'Researching':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [title, setTitle] = useState('')
  const [agency, setAgency] = useState('')
  const [naics, setNaics] = useState('')
  const [deadline, setDeadline] = useState('')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [notes, setNotes] = useState('')
  const [stage, setStage] = useState('Identified')
  const [stageFilter, setStageFilter] = useState<'All' | string>('All')
  const [deadlineFilter, setDeadlineFilter] = useState<'All' | 'Urgent' | 'Past Due'>('All')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Contract>>({})
  const router = useRouter()
  const countsByStage = STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = contracts.filter((c) => c.stage === s).length
    return acc
  }, {})
  const filteredContracts = contracts.filter((contract) => {
    const stageMatch =
      stageFilter === 'All' || contract.stage === stageFilter

    const d = daysUntil(contract.deadline)

    let deadlineMatch = true

    if (deadlineFilter === 'Urgent') {
      deadlineMatch = d !== null && d >= 0 && d <= 7
    }

    if (deadlineFilter === 'Past Due') {
      deadlineMatch = d !== null && d < 0
    }

    return stageMatch && deadlineMatch
  })

  const updateContract = async () => {
    if (!editingId) return

    const { error } = await supabase
      .from('contract_opportunities')
      .update(editForm)
      .eq('id', editingId)

    if (error) {
      alert(error.message)
      return
    }

    setContracts((prev) =>
      prev.map((c) =>
        c.id === editingId ? { ...c, ...editForm } : c
      )
    )

    setEditingId(null)
    setEditForm({})
  }

  const deleteContract = async (id: string) => {
    const confirmed = confirm('Are you sure you want to delete this contract?')
    if (!confirmed) return

    const { error } = await supabase
      .from('contract_opportunities')
      .delete()
      .eq('id', id)

    if (error) {
      alert(error.message)
      return
    }

    setContracts((prev) =>
      prev.filter((c) => c.id !== id)
    )
  }

  const uploadProposal = async (
    contractId: string,
    file: File
  ) => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const filePath = `${userData.user.id}/${contractId}-${file.name}`

    const { error } = await supabase.storage
      .from('proposals')
      .upload(filePath, file, {
        upsert: true,
      })

    if (error) {
      alert(error.message)
      return
    }

    alert('Proposal uploaded successfully')
  }
  
  const updateStage = async (id: string, newStage: string) => {
    const { error } = await supabase
      .from('contract_opportunities')
      .update({ stage: newStage })
      .eq('id', id)

    if (error) {
      alert(error.message)
      return
    }
    setTitle('')
    setAgency('')
    setNaics('')
    setDeadline('')
    setEstimatedValue('')
    setNotes('')
    setStage('Identified')

fetchContracts()

    setContracts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, stage: newStage } : c))
    )
  }

  useEffect(() => {
    fetchContracts()
  }, [])

  const fetchContracts = async () => {
    const { data, error } = await supabase
      .from('contract_opportunities')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setContracts(data)
    }
  }

  const handleCreate = async () => {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      router.push('/login')
      return
    }

    const { error } = await supabase
      .from('contract_opportunities')
      .insert([
        {
          user_id: userData.user.id,
          title,
          agency,
          naics,
          stage,
          deadline,
          estimated_value: Number(estimatedValue),
          notes,
        },
      ])

    if (!error) {
      setTitle('')
      setAgency('')
      setNaics('')
      setDeadline('')
      setEstimatedValue('')
      setNotes('')
      fetchContracts()
    } else {
      alert(error.message)
    }
  }

  return (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-6">
      Government Contract Tracker
    </h1>

    {/* ===== STAGE KPI SUMMARY ===== */}
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
      {STAGES.map((s) => (
        <div key={s} className="border p-3">
          <div className="text-sm text-gray-600">{s}</div>
          <div className="text-2xl font-bold">
            {countsByStage[s] ?? 0}
          </div>
        </div>
      ))}
    </div>

    {/* ===== CREATE FORM ===== */}
    <div className="space-y-4 mb-10 border p-4">
      <input
        className="border p-2 w-full"
        placeholder="Contract Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <input
        className="border p-2 w-full"
        placeholder="Agency"
        value={agency}
        onChange={(e) => setAgency(e.target.value)}
      />

      <input
        className="border p-2 w-full"
        placeholder="NAICS Code"
        value={naics}
        onChange={(e) => setNaics(e.target.value)}
      />

      <select
        className="border p-2 w-full"
        value={stage}
        onChange={(e) => setStage(e.target.value)}
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <input
        className="border p-2 w-full"
        type="date"
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
      />

      <input
        className="border p-2 w-full"
        placeholder="Estimated Value"
        value={estimatedValue}
        onChange={(e) => setEstimatedValue(e.target.value)}
      />

      <textarea
        className="border p-2 w-full"
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <button
        className="bg-black text-white px-4 py-2"
        onClick={handleCreate}
      >
        Add Contract
      </button>
    </div>

    {/* ===== FILTERS ===== */}
<div className="flex flex-wrap gap-4 mb-6 border p-4">
  <div>
    <label className="text-sm block mb-1">Stage Filter</label>
    <select
      className="border p-2"
      value={stageFilter}
      onChange={(e) => setStageFilter(e.target.value)}
    >
      <option value="All">All</option>
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  </div>

  <div>
    <label className="text-sm block mb-1">Deadline Filter</label>
    <select
      className="border p-2"
      value={deadlineFilter}
      onChange={(e) =>
        setDeadlineFilter(e.target.value as any)
      }
    >
      <option value="All">All</option>
      <option value="Urgent">Due in 7 Days</option>
      <option value="Past Due">Past Due</option>
    </select>
  </div>

  <button
    className="self-end bg-gray-800 text-white px-4 py-2"
    onClick={() => {
      setStageFilter('All')
      setDeadlineFilter('All')
    }}
  >
    Reset Filters
  </button>
</div>

    {/* ===== CONTRACT LIST ===== */}
    <div className="space-y-4">
      {filteredContracts.map((contract) => (
        <div key={contract.id} className="border p-4 space-y-3">

          {editingId === contract.id ? (
            <>
              <input
                className="border p-2 w-full"
                value={editForm.title ?? contract.title}
                onChange={(e) =>
                  setEditForm({ ...editForm, title: e.target.value })
                }
              />

              <textarea
                className="border p-2 w-full"
                value={editForm.notes ?? contract.notes}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
              />

              <div className="flex gap-3">
                <button
                  className="bg-green-600 text-white px-4 py-2"
                  onClick={updateContract}
                >
                  Save
                </button>

                <button
                  className="bg-gray-600 text-white px-4 py-2"
                  onClick={() => {
                    setEditingId(null)
                    setEditForm({})
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-bold">{contract.title}</h2>
                  <div className="text-sm text-gray-700">
                    {contract.agency || 'Agency: —'} • {contract.naics || 'NAICS: —'}
                  </div>
                </div>

                <span
                  className={`px-2 py-1 text-xs rounded ${stageBadgeClass(contract.stage)}`}
                >
                  {contract.stage}
                </span>
              </div>

              <div className="text-sm">
                Deadline: {contract.deadline || '—'} • {deadlineLabel(contract.deadline)}
              </div>

              <div className="text-sm">
                Value: {contract.estimated_value ? `$${contract.estimated_value}` : '—'}
              </div>

              <div className="text-sm whitespace-pre-wrap">
                Notes: {contract.notes || '—'}
              </div>

              <div className="flex gap-3 mt-3">
                <button
                  className="bg-blue-600 text-white px-4 py-2"
                  onClick={() => {
                    setEditingId(contract.id)
                    setEditForm(contract)
                  }}
                >
                  Edit
                </button>

                <button
                  className="bg-red-600 text-white px-4 py-2"
                  onClick={() => deleteContract(contract.id)}
                >
                  Delete
                </button>

                <div className="mt-3">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        uploadProposal(contract.id, file)
                      }
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  </div>
)
}