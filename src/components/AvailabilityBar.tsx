import { formatCurrency } from '../lib/format'
import type { AvailabilityBreakdown } from '../lib/lending'

interface AvailabilityBarProps {
  breakdown: AvailabilityBreakdown
  commitment: number
}

export function AvailabilityBar({ breakdown, commitment }: AvailabilityBarProps) {
  const usagePercent = commitment > 0 ? Math.min((breakdown.usage / commitment) * 100, 100) : 0
  const netAvailPercent = commitment > 0 ? Math.max((breakdown.netAvailability / commitment) * 100, 0) : 0
  const remainingPercent = Math.max(100 - usagePercent - netAvailPercent, 0)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-neutral-500">
          Usage: {formatCurrency(breakdown.usage)} ({usagePercent.toFixed(1)}%)
        </span>
        <span className="font-medium text-success-600">
          Net Avail: {formatCurrency(breakdown.netAvailability)}
        </span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="bg-primary-500 transition-all duration-500"
          style={{ width: `${usagePercent}%` }}
          title={`Outstanding + Pending: ${formatCurrency(breakdown.usage)}`}
        />
        <div
          className="bg-success-500 transition-all duration-500"
          style={{ width: `${netAvailPercent}%` }}
          title={`Net Availability: ${formatCurrency(breakdown.netAvailability)}`}
        />
        <div
          className="bg-neutral-200 transition-all duration-500"
          style={{ width: `${remainingPercent}%` }}
          title="Unused commitment"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-2xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-primary-500" /> Usage
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-success-500" /> Net Availability
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-neutral-300" /> Unused
        </span>
      </div>
    </div>
  )
}
