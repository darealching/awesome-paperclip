import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatPercent, formatDateTime } from '../lib/format'
import { calculateAvailability } from '../lib/lending'
import type { Facility, Borrower, CollateralAR, Reserve, LoanDraw, LoanPayment } from '../types'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { StatusBadge } from '../components/StatusBadge'
import { LoadingSpinner, EmptyState } from '../components/Feedback'
import { AvailabilityBar } from '../components/AvailabilityBar'

interface FacilityWithBorrower extends Facility {
  borrower: Borrower
}

export function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [facilities, setFacilities] = useState<FacilityWithBorrower[]>([])
  const [allCollateral, setAllCollateral] = useState<CollateralAR[]>([])
  const [allReserves, setAllReserves] = useState<Reserve[]>([])
  const [recentDraws, setRecentDraws] = useState<LoanDraw[]>([])
  const [recentPayments, setRecentPayments] = useState<LoanPayment[]>([])
  const [pendingDrawCount, setPendingDrawCount] = useState(0)

  useEffect(() => {
    async function load() {
      const [facRes, colRes, resRes, drawRes, payRes, pendRes] = await Promise.all([
        supabase.from('facilities').select('*, borrower(*)').order('created_at', { ascending: false }),
        supabase.from('collateral_ar').select('*'),
        supabase.from('reserves').select('*'),
        supabase.from('loan_draws').select('*, facility(*)').order('created_at', { ascending: false }).limit(5),
        supabase.from('loan_payments').select('*, facility(*)').order('created_at', { ascending: false }).limit(5),
        supabase.from('loan_draws').select('*', { count: 'exact', head: true }).eq('status', 'PENDING_APPROVAL'),
      ])

      if (facRes.data) setFacilities(facRes.data as FacilityWithBorrower[])
      if (colRes.data) setAllCollateral(colRes.data)
      if (resRes.data) setAllReserves(resRes.data)
      if (drawRes.data) setRecentDraws(drawRes.data)
      if (payRes.data) setRecentPayments(payRes.data)
      setPendingDrawCount(pendRes.count || 0)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner label="Loading dashboard..." />

  const totalCommitment = facilities.reduce((s, f) => s + f.commitment_amount, 0)
  const totalOutstanding = facilities.reduce((s, f) => s + f.outstanding_principal, 0)
  const totalNetAvail = facilities.reduce((s, f) => {
    const col = allCollateral.filter((c) => c.facility_id === f.id)
    const res = allReserves.filter((r) => r.facility_id === f.id)
    return s + calculateAvailability(f, col, res).netAvailability
  }, 0)
  const totalEligibleAR = facilities.reduce((s, f) => {
    const col = allCollateral.filter((c) => c.facility_id === f.id)
    const res = allReserves.filter((r) => r.facility_id === f.id)
    return s + calculateAvailability(f, col, res).eligibleAR
  }, 0)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        description="Portfolio overview across all active lending facilities"
        action={
          pendingDrawCount > 0 ? (
            <Link to="/draws" className="btn-warning">
              <AlertTriangle size={16} />
              {pendingDrawCount} Pending Approval{pendingDrawCount > 1 ? 's' : ''}
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Commitment"
          value={formatCurrency(totalCommitment)}
          sublabel={`${facilities.length} facilities`}
          icon={<DollarSign size={16} />}
          variant="primary"
        />
        <StatCard
          label="Outstanding Principal"
          value={formatCurrency(totalOutstanding)}
          sublabel={`${formatPercent(totalCommitment > 0 ? totalOutstanding / totalCommitment : 0)} utilized`}
          icon={<TrendingUp size={16} />}
          variant="default"
        />
        <StatCard
          label="Net Availability"
          value={formatCurrency(totalNetAvail)}
          sublabel="After reserves & usage"
          icon={<Banknote size={16} />}
          variant="success"
        />
        <StatCard
          label="Eligible AR"
          value={formatCurrency(totalEligibleAR)}
          sublabel="Borrowing base collateral"
          icon={<Building2 size={16} />}
          variant="default"
        />
      </div>

      <div className="mb-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Facility Summary</h2>
        <div className="space-y-3">
          {facilities.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Building2 size={48} />}
                title="No facilities yet"
                description="Create your first lending facility to get started."
                action={<Link to="/facilities" className="btn-primary">Go to Facilities</Link>}
              />
            </div>
          ) : (
            facilities.map((facility) => {
              const col = allCollateral.filter((c) => c.facility_id === facility.id)
              const res = allReserves.filter((r) => r.facility_id === facility.id)
              const breakdown = calculateAvailability(facility, col, res)
              return (
                <Link
                  key={facility.id}
                  to={`/facilities/${facility.id}`}
                  className="card-hover block p-5"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900">{facility.facility_name}</h3>
                        <p className="text-sm text-neutral-500">{facility.borrower?.name || 'Unknown borrower'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={facility.status} />
                      <span className="text-sm font-medium text-neutral-700">
                        {formatCurrency(facility.outstanding_principal)} / {formatCurrency(facility.commitment_amount)}
                      </span>
                    </div>
                  </div>
                  <AvailabilityBar breakdown={breakdown} commitment={facility.commitment_amount} />
                </Link>
              )
            })
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <ArrowDownCircle size={18} className="text-primary-600" />
            <h3 className="font-semibold text-neutral-900">Recent Draw Requests</h3>
          </div>
          {recentDraws.length === 0 ? (
            <EmptyState title="No draws yet" description="Draw requests will appear here." />
          ) : (
            <div className="space-y-2">
              {recentDraws.map((draw) => (
                <div key={draw.id} className="flex items-center justify-between border-b border-neutral-100 pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{draw.request_id}</p>
                    <p className="text-xs text-neutral-500">
                      {draw.facility?.facility_name || 'Unknown facility'} - {formatDateTime(draw.requested_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-neutral-700">{formatCurrency(draw.requested_amount)}</span>
                    <StatusBadge status={draw.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <ArrowUpCircle size={18} className="text-success-600" />
            <h3 className="font-semibold text-neutral-900">Recent Payments</h3>
          </div>
          {recentPayments.length === 0 ? (
            <EmptyState title="No payments yet" description="Payments will appear here." />
          ) : (
            <div className="space-y-2">
              {recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between border-b border-neutral-100 pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{payment.request_id || 'Payment'}</p>
                    <p className="text-xs text-neutral-500">
                      {payment.facility?.facility_name || 'Unknown facility'} - {formatDateTime(payment.received_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-neutral-700">{formatCurrency(payment.received_amount)}</span>
                    <StatusBadge status={payment.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
