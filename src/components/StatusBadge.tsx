interface StatusBadgeProps {
  status: string
}

const statusMap: Record<string, { className: string; label: string }> = {
  ACTIVE: { className: 'badge-success', label: 'Active' },
  DRAFT: { className: 'badge-neutral', label: 'Draft' },
  FROZEN: { className: 'badge-warning', label: 'Frozen' },
  CLOSED: { className: 'badge-neutral', label: 'Closed' },
  OPEN: { className: 'badge-info', label: 'Open' },
  PAID: { className: 'badge-success', label: 'Paid' },
  DISPUTED: { className: 'badge-error', label: 'Disputed' },
  COLLECTED: { className: 'badge-success', label: 'Collected' },
  PENDING_APPROVAL: { className: 'badge-warning', label: 'Pending Approval' },
  APPROVED: { className: 'badge-info', label: 'Approved' },
  POSTED: { className: 'badge-success', label: 'Posted' },
  REVERSED: { className: 'badge-error', label: 'Reversed' },
  REJECTED: { className: 'badge-error', label: 'Rejected' },
  RELEASED: { className: 'badge-neutral', label: 'Released' },
  EXPIRED: { className: 'badge-neutral', label: 'Expired' },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status] || { className: 'badge-neutral', label: status }
  return <span className={config.className}>{config.label}</span>
}
