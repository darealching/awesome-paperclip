import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './Modal'
import { ErrorState } from './Feedback'

interface AddCollateralModalProps {
  open: boolean
  onClose: () => void
  facilityId: string
  onCreated: () => void
}

export function AddCollateralModal({ open, onClose, facilityId, onCreated }: AddCollateralModalProps) {
  const [form, setForm] = useState({
    obligor_id: '',
    obligor_name: '',
    invoice_number: '',
    outstanding_amount: '',
    invoice_date: '',
    due_date: '',
  })
  const [flags, setFlags] = useState({ disputed: false, ineligible: false })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setForm({ obligor_id: '', obligor_name: '', invoice_number: '', outstanding_amount: '', invoice_date: '', due_date: '' })
    setFlags({ disputed: false, ineligible: false })
    setError(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      if (!form.obligor_id.trim()) throw new Error('Obligor ID is required.')
      if (!form.invoice_number.trim()) throw new Error('Invoice number is required.')
      if (!form.invoice_date) throw new Error('Invoice date is required.')
      const amount = parseFloat(form.outstanding_amount)
      if (!amount || amount <= 0) throw new Error('Outstanding amount must be greater than zero.')

      const { error: insertError } = await supabase.from('collateral_ar').insert({
        facility_id: facilityId,
        obligor_id: form.obligor_id.trim(),
        obligor_name: form.obligor_name.trim() || null,
        invoice_number: form.invoice_number.trim(),
        outstanding_amount: amount,
        invoice_date: form.invoice_date,
        due_date: form.due_date || null,
        disputed_flag: flags.disputed,
        ineligible_flag: flags.ineligible,
        status: flags.disputed ? 'DISPUTED' : 'OPEN',
      })

      if (insertError) throw new Error(insertError.message)

      handleClose()
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add collateral')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add AR Collateral"
      description="Add an accounts receivable invoice to the borrowing base."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorState message={error} />}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Obligor ID</label>
            <input className="input" placeholder="CUST-001" value={form.obligor_id} onChange={(e) => setForm({ ...form, obligor_id: e.target.value })} required />
          </div>
          <div>
            <label className="label">Obligor Name</label>
            <input className="input" placeholder="Customer Name" value={form.obligor_name} onChange={(e) => setForm({ ...form, obligor_name: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Invoice Number</label>
            <input className="input" placeholder="INV-2025-0001" value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} required />
          </div>
          <div>
            <label className="label">Outstanding Amount ($)</label>
            <input className="input" type="number" step="0.01" placeholder="100000" value={form.outstanding_amount} onChange={(e) => setForm({ ...form, outstanding_amount: e.target.value })} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Invoice Date</label>
            <input className="input" type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} required />
          </div>
          <div>
            <label className="label">Due Date</label>
            <input className="input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={flags.disputed} onChange={(e) => setFlags({ ...flags, disputed: e.target.checked })} className="rounded border-neutral-300" />
            Disputed
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={flags.ineligible} onChange={(e) => setFlags({ ...flags, ineligible: e.target.checked })} className="rounded border-neutral-300" />
            Ineligible
          </label>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={handleClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Collateral'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
