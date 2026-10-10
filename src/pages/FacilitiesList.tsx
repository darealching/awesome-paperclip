import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Plus, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatPercent, formatDate } from '../lib/format'
import { calculateAvailability } from '../lib/lending'
import type { Facility, Borrower, CollateralAR, Reserve } from '../types'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { LoadingSpinner, EmptyState } from '../components/Feedback'
import { AvailabilityBar } from '../components/AvailabilityBar'
import { CreateFacilityModal } from '../components/CreateFacilityModal'

interface FacilityWithBorrower extends Facility {
  borrower: Borrower
}

export function FacilitiesList() {
  const [loading, setLoading] = useState(true)
  const [facilities, setFacilities] = useState<FacilityWithBorrower[]>([])
  const [allCollateral, setAllCollateral] = useState<CollateralAR[]>([])
  const [allReserves, setAllReserves] = useState<Reserve[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showCreate, setShowCreate] = useState(false)

  async function load() {
    setLoading(true)
    const [facRes, colRes, resRes] = await Promise.all([
      supabase.from('facilities').select('*, borrower(*)').order('created_at', { ascending: false }),
      supabase.from('collateral_ar').select('*'),
      supabase.from('reserves').select('*'),
    ])
    if (facRes.data) setFacilities(facRes.data as FacilityWithBorrower[])
    if (colRes.data) setAllCollateral(colRes.data)
    if (resRes.data) setAllReserves(resRes.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = facilities.filter((f) => {
    const matchesSearch =
      !search ||
      f.facility_name.toLowerCase().includes(search.toLowerCase()) ||
      f.borrower?.name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Facilities"
        description="Manage credit facilities and their borrowing base"
        action={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            New Facility
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="input pl-9"
            placeholder="Search by facility or borrower name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="FROZEN">Frozen</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading facilities..." />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Building2 size={48} />}
            title="No facilities found"
            description="Adjust your filters or create a new facility to get started."
            action={<button className="btn-primary" onClick={() => setShowCreate(true)}>New Facility</button>}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((facility) => {
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
                      <p className="text-sm text-neutral-500">
                        {facility.borrower?.name} - {facility.industry || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={facility.status} />
                    <div className="text-right">
                      <p className="text-sm font-medium text-neutral-900">
                        {formatCurrency(facility.outstanding_principal)}
                      </p>
                      <p className="text-xs text-neutral-500">
                        of {formatCurrency(facility.commitment_amount)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-3">
                  <div>
                    <p className="text-2xs font-medium uppercase tracking-wider text-neutral-500">AR Advance Rate</p>
                    <p className="text-sm font-medium text-neutral-900">{formatPercent(facility.ar_advance_rate)}</p>
                  </div>
                  <div>
                    <p className="text-2xs font-medium uppercase tracking-wider text-neutral-500">Interest Rate</p>
                    <p className="text-sm font-medium text-neutral-900">{formatPercent(facility.interest_rate)}</p>
                  </div>
                  <div>
                    <p className="text-2xs font-medium uppercase tracking-wider text-neutral-500">Maturity</p>
                    <p className="text-sm font-medium text-neutral-900">{formatDate(facility.maturity_date)}</p>
                  </div>
                  <div>
                    <p className="text-2xs font-medium uppercase tracking-wider text-neutral-500">Net Availability</p>
                    <p className="text-sm font-medium text-success-600">{formatCurrency(breakdown.netAvailability)}</p>
                  </div>
                </div>
                <AvailabilityBar breakdown={breakdown} commitment={facility.commitment_amount} />
              </Link>
            )
          })}
        </div>
      )}

      <CreateFacilityModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
    </div>
  )
}
