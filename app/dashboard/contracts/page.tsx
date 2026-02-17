'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Contract = {
  id: string
  title: string
  agency: string | null
  naics: string | null
  stage: string
  deadline: string | null
  estimated_value: number | null
  notes: string | null
  proposal_path?: string | null
}

const STAGES = [
  'Identified',
  'Researching',
  'Preparing Proposal',
  'Submitted',
  'Awarded',
  'Lost',
] as const

function daysUntil(dateStr?: string | null) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const diffMs = d.getTime() - today.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function deadlineLabel(dateStr?: string | null) {
  const d = daysUntil(dateStr)
  if (d === null) return 'No deadline'
  if (d < 0) return `Past due (${Math.abs(d)}d)`
  if (d === 0) return 'Due today'
  return `${d}d left`
}

function deadlineStyle(dateStr?: string | null) {
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
  const router = useRouter()

  // List
  const [contracts, setContracts] = useState<Contract[]>([])

  // Create form
  const [title, setTitle] = useState('')
  const [agency, setAgency] = useState('')
  const [naics, setNaics] = useState('')
  const [deadline, setDeadline] = useState('')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [notes, setNotes] = useState('')
  const [stage, setStage] = useState<string>('Identified')

  // Filters
  const [stageFilter, setStageFilter] = useState<'All' | string>('All')
  const [deadlineFilter, setDeadlineFilter] = useState<'All' | 'Urgent' | 'Past Due'>('All')

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Contract>>({})

  // File upload state
  const [uploadingId, setUploadingId] = useState<string | null>(null)
    const [uploadSuccessId, setUploadSuccessId] = useState<string | null>(null)
    const [selectedFileInfo, setSelectedFileInfo] = useState<{
      [key: string]: { name: string; size: number }
    }>({})

  // Fetch contracts from Supabase
  const fetchContracts = async () => {
    const { data, error } = await supabase
      .from('contract_opportunities')
      .select('id,title,agency,naics,stage,deadline,estimated_value,notes,proposal_path,created_at')
      .order('created_at', { ascending: false })

    if (error) {
      alert(error.message)
      return
    }

    setContracts((data as Contract[]) ?? [])
  }

  useEffect(() => {
    fetchContracts()
  }, [])

  const countsByStage = useMemo(() => {
    return STAGES.reduce<Record<string, number>>((acc, s) => {
      acc[s] = contracts.filter((c) => c.stage === s).length
      return acc
    }, {})
  }, [contracts])

  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      const stageMatch = stageFilter === 'All' || contract.stage === stageFilter

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
  }, [contracts, stageFilter, deadlineFilter])

  const handleCreate = async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/login')
      return
    }

    if (!title.trim()) {
      alert('Title is required.')
      return
    }

    const { error } = await supabase.from('contract_opportunities').insert([
      {
        user_id: userData.user.id,
        title: title.trim(),
        agency: agency.trim() || null,
        naics: naics.trim() || null,
        stage,
        deadline: deadline || null,
        estimated_value: estimatedValue ? Number(estimatedValue) : null,
        notes: notes.trim() || null,
      },
    ])

    if (error) {
      alert(error.message)
      return
    }

    // reset form
    setTitle('')
    setAgency('')
    setNaics('')
    setDeadline('')
    setEstimatedValue('')
    setNotes('')
    setStage('Identified')

    fetchContracts()
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

    setContracts((prev) => prev.map((c) => (c.id === id ? { ...c, stage: newStage } : c)))
  }

  const updateContract = async () => {
    if (!editingId) return

    // Build a safe patch (avoid sending undefined)
    const patch: Record<string, any> = {}
    if (editForm.title !== undefined) patch.title = (editForm.title || '').toString()
    if (editForm.agency !== undefined) patch.agency = editForm.agency ? String(editForm.agency) : null
    if (editForm.naics !== undefined) patch.naics = editForm.naics ? String(editForm.naics) : null
    if (editForm.deadline !== undefined) patch.deadline = editForm.deadline || null
    if (editForm.estimated_value !== undefined) {
      patch.estimated_value =
        editForm.estimated_value === null || editForm.estimated_value === undefined
          ? null
          : Number(editForm.estimated_value)
    }
    if (editForm.notes !== undefined) patch.notes = editForm.notes ? String(editForm.notes) : null
    if (editForm.stage !== undefined) patch.stage = String(editForm.stage)

    const { error } = await supabase
      .from('contract_opportunities')
      .update(patch)
      .eq('id', editingId)

    if (error) {
      alert(error.message)
      return
    }

    setContracts((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...patch } : c)))
    setEditingId(null)
    setEditForm({})
  }

  const deleteContract = async (id: string) => {
    const confirmed = confirm('Are you sure you want to delete this contract?')
    if (!confirmed) return

    const { error } = await supabase.from('contract_opportunities').delete().eq('id', id)

    if (error) {
      alert(error.message)
      return
    }

    setContracts((prev) => prev.filter((c) => c.id !== id))
  }

  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from('proposals').createSignedUrl(path, 60 * 60)
    if (error) {
      alert(error.message)
      return null
    }
    return data.signedUrl
  }

  // Handle file upload for a contract
  const uploadProposal = async (contractId: string, file: File) => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    setUploadingId(contractId)
    setUploadSuccessId(null)

    const safeName = file.name.replace(/[^\w.\-() ]+/g, '_')
    const filePath = `${userData.user.id}/${contractId}-${safeName}`

    const { error } = await supabase.storage
      .from('proposals')
      .upload(filePath, file, { upsert: true })

    if (error) {
      alert(error.message)
      setUploadingId(null)
      return
    }

    await supabase
      .from('contract_opportunities')
      .update({ proposal_path: filePath })
      .eq('id', contractId)

    setContracts((prev) =>
      prev.map((c) =>
        c.id === contractId ? { ...c, proposal_path: filePath } : c
      )
    )

    setSelectedFileInfo((prev) => ({
      ...prev,
      [contractId]: {
        name: file.name,
        size: file.size,
      },
    }))

    setUploadingId(null)
    setUploadSuccessId(contractId)

    // Remove checkmark after 2 seconds
    setTimeout(() => {
      setUploadSuccessId(null)
    }, 2000)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Government Contract Tracker</h1>

      {/* ===== STAGE KPI SUMMARY ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {STAGES.map((s) => (
          <div key={s} className="border p-3">
            <div className="text-sm text-gray-600">{s}</div>
            <div className="text-2xl font-bold">{countsByStage[s] ?? 0}</div>
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

        <select className="border p-2 w-full" value={stage} onChange={(e) => setStage(e.target.value)}>
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

        <button className="bg-black text-white px-4 py-2" onClick={handleCreate}>
          Add Contract
        </button>
      </div>

      {/* ===== FILTERS ===== */}
      <div className="flex flex-wrap gap-4 mb-6 border p-4">
        <div>
          <label className="text-sm block mb-1">Stage Filter</label>
          <select className="border p-2" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
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
            onChange={(e) => setDeadlineFilter(e.target.value as any)}
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
                  value={(editForm.title ?? contract.title) || ''}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />

                <input
                  className="border p-2 w-full"
                  value={(editForm.agency ?? contract.agency ?? '') as string}
                  onChange={(e) => setEditForm({ ...editForm, agency: e.target.value })}
                  placeholder="Agency"
                />

                <input
                  className="border p-2 w-full"
                  value={(editForm.naics ?? contract.naics ?? '') as string}
                  onChange={(e) => setEditForm({ ...editForm, naics: e.target.value })}
                  placeholder="NAICS"
                />

                <select
                  className="border p-2 w-full"
                  value={(editForm.stage ?? contract.stage) as string}
                  onChange={(e) => setEditForm({ ...editForm, stage: e.target.value })}
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
                  value={(editForm.deadline ?? contract.deadline ?? '') as string}
                  onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                />

                <input
                  className="border p-2 w-full"
                  placeholder="Estimated Value"
                  value={
                    (editForm.estimated_value ?? contract.estimated_value ?? '') as any
                  }
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      estimated_value: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />

                <textarea
                  className="border p-2 w-full"
                  value={(editForm.notes ?? contract.notes ?? '') as string}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />

                <div className="flex gap-3">
                  <button className="bg-green-600 text-white px-4 py-2" onClick={updateContract}>
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
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-bold">{contract.title}</h2>
                    <div className="text-sm text-gray-700">
                      {contract.agency ? `Agency: ${contract.agency}` : 'Agency: —'} •{' '}
                      {contract.naics ? `NAICS: ${contract.naics}` : 'NAICS: —'}
                    </div>
                  </div>

                  <span className={`px-2 py-1 text-xs rounded ${stageBadgeClass(contract.stage)}`}>
                    {contract.stage}
                  </span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className={`text-sm ${deadlineStyle(contract.deadline)}`}>
                    Deadline: {contract.deadline || '—'} • {deadlineLabel(contract.deadline)}
                  </div>

                  <div className="text-sm text-gray-700">
                    Value: {contract.estimated_value ? `$${contract.estimated_value}` : '—'}
                  </div>

                  <div className="md:ml-auto flex items-center gap-2">
                    <span className="text-sm text-gray-600">Stage:</span>
                    <select
                      className="border p-2 text-sm"
                      value={contract.stage}
                      onChange={(e) => updateStage(contract.id, e.target.value)}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="text-sm whitespace-pre-wrap">
                  Notes: {contract.notes || '—'}
                </div>

                <div className="flex flex-wrap gap-3 mt-3 items-center">
                  <button
                    className="bg-blue-600 text-white px-4 py-2"
                    onClick={() => {
                      setEditingId(contract.id)
                      setEditForm(contract)
                    }}
                  >
                    Edit
                  </button>

                  <button className="bg-red-600 text-white px-4 py-2" onClick={() => deleteContract(contract.id)}>
                    Delete
                  </button>

                  <div className="flex flex-col gap-2 mt-3">

                  {/* Show File Name + Size */}
                  {contract.proposal_path && selectedFileInfo[contract.id] && (
                    <div className="text-sm text-gray-700">
                      📄 {selectedFileInfo[contract.id].name} —{' '}
                      {(selectedFileInfo[contract.id].size / 1024).toFixed(1)} KB
                    </div>
                  )}

                  <div className="flex items-center gap-3">

                    {/* Upload or Replace */}
                    {!contract.proposal_path ? (
                      <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 cursor-pointer text-sm">
                        Upload Proposal
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) uploadProposal(contract.id, file)
                          }}
                        />
                      </label>
                    ) : (
                      <label className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 cursor-pointer text-sm">
                        Replace File
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) uploadProposal(contract.id, file)
                          }}
                        />
                      </label>
                    )}

                    {/* Uploading Indicator */}
                    {uploadingId === contract.id && (
                      <div className="text-blue-600 text-sm animate-pulse">
                        Uploading...
                      </div>
                    )}

                    {/* Success Check */}
                    {uploadSuccessId === contract.id && (
                      <div className="text-green-600 text-sm">
                        ✓ Uploaded
                      </div>
                    )}

                    {/* View Button */}
                    {contract.proposal_path && (
                      <button
                        className="bg-gray-700 text-white px-3 py-1 text-sm"
                        onClick={async () => {
                          const url = await getSignedUrl(contract.proposal_path!)
                          if (url) window.open(url, '_blank')
                        }}
                      >
                        View
                      </button>
                    )}
                  </div>
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