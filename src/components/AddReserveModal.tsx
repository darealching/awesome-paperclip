import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './Modal'
import { ErrorState } from './Feedback'

interface AddReserveModalProps {
  open: boolean
  onClose: () => void
  facilityId: string
  onCreated: () => void
}

const RESERVE_TYPES = ['CONCENTRATION', 'DILUTION', 'MINIMUM_BORROWING_BASE', 'YOUNG_COMPANY', 'CROSS_AGING', 'OTHER']

export function AddReserveModal({ open, onClose, facilityId, onCreated }: AddReserveModalProps) {
  const [form, setForm] = useState({
    reserve_type: 'CONCENTRATION',
    description: '',
    amount: '',
    expiration_at: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setForm({ reserve_type: 'CONCENTRATION', description: '', amount: '', expiration_at: '' })
    setError(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const amount = parseFloat(form.amount)
      if (!amount || amount <= 0) throw new Error('Reserve amount must be greater than zero.')

      const { error: insertError } = await supabase.from('reserves').insert({
        facility_id: facilityId,
        reserve_type: form.reserve_type,
        description: form.description.trim() || null,
        amount,
        status: 'ACTIVE',
        effective_at: new Date().toISOString(),
        expiration_at: form.expiration_at ? new Date(form.expiration_at).toISOString() : null,
        approved_by: 'credit-committee',
        approved_at: new Date().toISOString(),
      })

      if (insertError) throw new Error(insertError.message)

      handleClose()
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add reserve')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add Reserve"
      description="Add a reserve against the facility's borrowing base."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorState message={error} />}
        <div>
          <label className="label">Reserve Type</label>
          <select className="input" value={form.reserve_type} onChange={(e) => setForm({ ...form, reserve_type: e.target.value })}>
            {RESERVE_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" placeholder="Reason for reserve" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Amount ($)</label>
            <input className="input" type="number" step="0.01" placeholder="50000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </div>
          <div>
            <label className="label">Expiration Date</label>
            <input className="input" type="date" value={form.expiration_at} onChange={(e) => setForm({ ...form, expiration_at: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={handleClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Reserve'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
