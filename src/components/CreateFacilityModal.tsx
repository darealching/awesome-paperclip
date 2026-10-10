import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Borrower } from '../types'
import { Modal } from './Modal'
import { LoadingSpinner, ErrorState } from './Feedback'

interface CreateFacilityModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function CreateFacilityModal({ open, onClose, onCreated }: CreateFacilityModalProps) {
  const [borrowers, setBorrowers] = useState<Borrower[]>([])
  const [loadingBorrowers, setLoadingBorrowers] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    borrower_id: '',
    facility_name: '',
    commitment_amount: '',
    ar_advance_rate: '0.85',
    inventory_advance_rate: '0.50',
    interest_rate: '0.085',
    effective_date: '',
    maturity_date: '',
  })

  async function loadBorrowers() {
    setLoadingBorrowers(true)
    const { data } = await supabase.from('borrowers').select('*').order('name')
    if (data) setBorrowers(data)
    setLoadingBorrowers(false)
  }

  function handleOpen() {
    loadBorrowers()
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      if (!form.borrower_id) throw new Error('Please select a borrower.')
      if (!form.facility_name.trim()) throw new Error('Facility name is required.')
      const commitment = parseFloat(form.commitment_amount)
      if (!commitment || commitment <= 0) throw new Error('Commitment amount must be greater than zero.')

      const { error: insertError } = await supabase.from('facilities').insert({
        borrower_id: form.borrower_id,
        facility_name: form.facility_name.trim(),
        status: 'DRAFT',
        commitment_amount: commitment,
        ar_advance_rate: parseFloat(form.ar_advance_rate) || 0.85,
        inventory_advance_rate: parseFloat(form.inventory_advance_rate) || 0.5,
        interest_rate: parseFloat(form.interest_rate) || 0.085,
        effective_date: form.effective_date || null,
        maturity_date: form.maturity_date || null,
      })

      if (insertError) throw new Error(insertError.message)

      setForm({
        borrower_id: '',
        facility_name: '',
        commitment_amount: '',
        ar_advance_rate: '0.85',
        inventory_advance_rate: '0.50',
        interest_rate: '0.085',
        effective_date: '',
        maturity_date: '',
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create facility')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Facility"
      description="Create a new credit facility. It starts as a draft."
      size="lg"
    >
      {loadingBorrowers ? (
        <LoadingSpinner label="Loading borrowers..." />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorState message={error} />}
          <div>
            <label className="label">Borrower</label>
            <select
              className="input"
              value={form.borrower_id}
              onChange={(e) => setForm({ ...form, borrower_id: e.target.value })}
              required
            >
              <option value="">Select a borrower...</option>
              {borrowers.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Facility Name</label>
            <input
              className="input"
              placeholder="e.g. Acme Revolving Credit Line"
              value={form.facility_name}
              onChange={(e) => setForm({ ...form, facility_name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Commitment Amount ($)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                placeholder="5000000"
                value={form.commitment_amount}
                onChange={(e) => setForm({ ...form, commitment_amount: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Interest Rate (decimal)</label>
              <input
                className="input"
                type="number"
                step="0.00001"
                placeholder="0.08500"
                value={form.interest_rate}
                onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">AR Advance Rate</label>
              <input
                className="input"
                type="number"
                step="0.01"
                placeholder="0.85"
                value={form.ar_advance_rate}
                onChange={(e) => setForm({ ...form, ar_advance_rate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Inventory Advance Rate</label>
              <input
                className="input"
                type="number"
                step="0.01"
                placeholder="0.50"
                value={form.inventory_advance_rate}
                onChange={(e) => setForm({ ...form, inventory_advance_rate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Effective Date</label>
              <input
                className="input"
                type="date"
                value={form.effective_date}
                onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Maturity Date</label>
              <input
                className="input"
                type="date"
                value={form.maturity_date}
                onChange={(e) => setForm({ ...form, maturity_date: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Facility'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
