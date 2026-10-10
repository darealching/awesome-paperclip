import { useState } from 'react'
import { createDrawRequest } from '../lib/operations'
import { formatCurrency } from '../lib/format'
import { Modal } from './Modal'
import { ErrorState } from './Feedback'

interface CreateDrawModalProps {
  open: boolean
  onClose: () => void
  facilityId: string
  facilityName: string
  netAvailability: number
  onCreated: () => void
}

export function CreateDrawModal({ open, onClose, facilityId, facilityName, netAvailability, onCreated }: CreateDrawModalProps) {
  const [amount, setAmount] = useState('')
  const [actorId, setActorId] = useState('loan-officer-01')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setAmount('')
    setError(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const requestedAmount = parseFloat(amount)
      if (!requestedAmount || requestedAmount <= 0) throw new Error('Amount must be greater than zero.')
      if (requestedAmount > netAvailability) throw new Error(`Requested amount exceeds net availability of ${formatCurrency(netAvailability)}.`)

      await createDrawRequest({
        facilityId,
        requestedAmount,
        actorId,
      })

      setAmount('')
      onCreated()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create draw request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New Draw Request"
      description={`${facilityName} - Net Availability: ${formatCurrency(netAvailability)}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorState message={error} />}
        <div>
          <label className="label">Requested Amount ($)</label>
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="250000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-neutral-500">
            Max available: {formatCurrency(netAvailability)}
          </p>
        </div>
        <div>
          <label className="label">Requested By</label>
          <input
            className="input"
            placeholder="loan-officer-01"
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            required
          />
        </div>
        <div className="rounded-lg bg-neutral-50 p-3">
          <p className="text-xs text-neutral-600">
            The draw will be created with status <span className="font-medium">Pending Approval</span>.
            A different user must approve it (separation of duties).
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={handleClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Request'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
