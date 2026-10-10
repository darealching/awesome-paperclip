import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  DollarSign,
  TrendingUp,
  Banknote,
  Shield,
  FileText,
  ArrowDownCircle,
  ArrowUpCircle,
  BookOpen,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  formatCurrency,
  formatCurrencyDetailed,
  formatPercent,
  formatDate,
  formatDateTime,
  daysSince,
} from '../lib/format'
import { calculateAvailability, calculateEligibleAR } from '../lib/lending'
import type {
  Facility,
  Borrower,
  CollateralAR,
  Reserve,
  LoanDraw,
  LoanPayment,
  LoanLedgerEntry,
} from '../types'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { StatusBadge } from '../components/StatusBadge'
import { LoadingSpinner, EmptyState, ErrorState } from '../components/Feedback'
import { AvailabilityBar } from '../components/AvailabilityBar'
import { Modal } from '../components/Modal'
import { CreateDrawModal } from '../components/CreateDrawModal'
import { AddCollateralModal } from '../components/AddCollateralModal'
import { AddReserveModal } from '../components/AddReserveModal'

type Tab = 'overview' | 'collateral' | 'reserves' | 'draws' | 'payments' | 'ledger'

export function FacilityDetail() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [facility, setFacility] = useState<Facility | null>(null)
  const [borrower, setBorrower] = useState<Borrower | null>(null)
  const [collateral, setCollateral] = useState<CollateralAR[]>([])
  const [reserves, setReserves] = useState<Reserve[]>([])
  const [draws, setDraws] = useState<LoanDraw[]>([])
  const [payments, setPayments] = useState<LoanPayment[]>([])
  const [ledger, setLedger] = useState<LoanLedgerEntry[]>([])
  const [tab, setTab] = useState<Tab>('overview')
  const [showCreateDraw, setShowCreateDraw] = useState(false)
  const [showAddCollateral, setShowAddCollateral] = useState(false)
  const [showAddReserve, setShowAddReserve] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: string; label: string } | null>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)

    const { data: fac, error: facErr } = await supabase
      .from('facilities')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (facErr || !fac) {
      setError('Facility not found.')
      setLoading(false)
      return
    }

    setFacility(fac)

    if (fac.borrower_id) {
      const { data: bor } = await supabase
        .from('borrowers')
        .select('*')
        .eq('id', fac.borrower_id)
        .maybeSingle()
      if (bor) setBorrower(bor)
    }

    const [colRes, resRes, drawRes, payRes, ledRes] = await Promise.all([
      supabase.from('collateral_ar').select('*').eq('facility_id', id).order('invoice_date', { ascending: false }),
      supabase.from('reserves').select('*').eq('facility_id', id).order('created_at', { ascending: false }),
      supabase.from('loan_draws').select('*').eq('facility_id', id).order('created_at', { ascending: false }),
      supabase.from('loan_payments').select('*').eq('facility_id', id).order('created_at', { ascending: false }),
      supabase.from('loan_ledger').select('*').eq('facility_id', id).order('created_at', { ascending: false }),
    ])

    if (colRes.data) setCollateral(colRes.data)
    if (resRes.data) setReserves(resRes.data)
    if (drawRes.data) setDraws(drawRes.data)
    if (payRes.data) setPayments(payRes.data)
    if (ledRes.data) setLedger(ledRes.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [id])

  async function handleDelete() {
    if (!confirmDelete) return
    const tableMap: Record<string, string> = {
      collateral: 'collateral_ar',
      reserve: 'reserves',
    }
    const table = tableMap[confirmDelete.type]
    if (table) {
      await supabase.from(table).delete().eq('id', confirmDelete.id)
    }
    setConfirmDelete(null)
    load()
  }

  if (loading) return <LoadingSpinner label="Loading facility..." />
  if (error || !facility) return <ErrorState message={error || 'Facility not found.'} />

  const breakdown = calculateAvailability(facility, collateral, reserves)
  const eligibleAR = calculateEligibleAR(collateral)
  const totalDebits = ledger.filter((l) => l.status === 'POSTED').reduce((s, l) => s + l.debit_amount, 0)
  const totalCredits = ledger.filter((l) => l.status === 'POSTED').reduce((s, l) => s + l.credit_amount, 0)
  const isBalanced = Math.round(totalDebits * 100) === Math.round(totalCredits * 100)

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <Building2 size={16} /> },
    { id: 'collateral', label: 'Collateral (AR)', icon: <FileText size={16} />, count: collateral.length },
    { id: 'reserves', label: 'Reserves', icon: <Shield size={16} />, count: reserves.length },
    { id: 'draws', label: 'Draws', icon: <ArrowDownCircle size={16} />, count: draws.length },
    { id: 'payments', label: 'Payments', icon: <ArrowUpCircle size={16} />, count: payments.length },
    { id: 'ledger', label: 'Ledger', icon: <BookOpen size={16} />, count: ledger.length },
  ]

  return (
    <div className="animate-fade-in">
      <Link to="/facilities" className="mb-4 inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700">
        <ArrowLeft size={16} />
        Back to Facilities
      </Link>

      <PageHeader
        title={facility.facility_name}
        description={`${borrower?.name || 'Unknown'} - ${borrower?.industry || 'N/A'}`}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={facility.status} />
            {facility.status === 'ACTIVE' && (
              <button className="btn-primary" onClick={() => setShowCreateDraw(true)}>
                <ArrowDownCircle size={16} />
                New Draw Request
              </button>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Commitment" value={formatCurrency(facility.commitment_amount)} icon={<DollarSign size={16} />} variant="primary" />
        <StatCard label="Outstanding" value={formatCurrency(facility.outstanding_principal)} sublabel={`Pending: ${formatCurrency(facility.pending_fundings)}`} icon={<TrendingUp size={16} />} />
        <StatCard label="Net Availability" value={formatCurrency(breakdown.netAvailability)} sublabel="After reserves & usage" icon={<Banknote size={16} />} variant="success" />
        <StatCard label="Eligible AR" value={formatCurrency(eligibleAR)} sublabel={`${collateral.length} invoices`} icon={<FileText size={16} />} />
      </div>

      <div className="mb-6 card p-5">
        <h3 className="mb-4 text-sm font-semibold text-neutral-900">Availability Breakdown</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
          <div>
            <p className="text-2xs font-medium uppercase tracking-wider text-neutral-500">Eligible AR</p>
            <p className="text-lg font-semibold text-neutral-900">{formatCurrencyDetailed(breakdown.eligibleAR)}</p>
          </div>
          <div>
            <p className="text-2xs font-medium uppercase tracking-wider text-neutral-500">Gross Advance</p>
            <p className="text-lg font-semibold text-neutral-900">{formatCurrencyDetailed(breakdown.grossAdvance)}</p>
            <p className="text-2xs text-neutral-500">@ {formatPercent(facility.ar_advance_rate)}</p>
          </div>
          <div>
            <p className="text-2xs font-medium uppercase tracking-wider text-neutral-500">Active Reserves</p>
            <p className="text-lg font-semibold text-warning-700">{formatCurrencyDetailed(breakdown.activeReserves)}</p>
          </div>
          <div>
            <p className="text-2xs font-medium uppercase tracking-wider text-neutral-500">Usage</p>
            <p className="text-lg font-semibold text-neutral-900">{formatCurrencyDetailed(breakdown.usage)}</p>
          </div>
        </div>
        <AvailabilityBar breakdown={breakdown} commitment={facility.commitment_amount} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-neutral-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span className={`rounded-full px-1.5 py-0.5 text-2xs ${tab === t.id ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-fade-in">
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-neutral-900">Facility Terms</h3>
            <dl className="space-y-3">
              <div className="flex justify-between"><dt className="text-sm text-neutral-500">Currency</dt><dd className="text-sm font-medium text-neutral-900">{facility.currency_code}</dd></div>
              <div className="flex justify-between"><dt className="text-sm text-neutral-500">Interest Rate</dt><dd className="text-sm font-medium text-neutral-900">{formatPercent(facility.interest_rate)}</dd></div>
              <div className="flex justify-between"><dt className="text-sm text-neutral-500">AR Advance Rate</dt><dd className="text-sm font-medium text-neutral-900">{formatPercent(facility.ar_advance_rate)}</dd></div>
              <div className="flex justify-between"><dt className="text-sm text-neutral-500">Inventory Advance Rate</dt><dd className="text-sm font-medium text-neutral-900">{formatPercent(facility.inventory_advance_rate)}</dd></div>
              <div className="flex justify-between"><dt className="text-sm text-neutral-500">Effective Date</dt><dd className="text-sm font-medium text-neutral-900">{formatDate(facility.effective_date)}</dd></div>
              <div className="flex justify-between"><dt className="text-sm text-neutral-500">Maturity Date</dt><dd className="text-sm font-medium text-neutral-900">{formatDate(facility.maturity_date)}</dd></div>
            </dl>
          </div>
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-neutral-900">Borrower Information</h3>
            {borrower ? (
              <dl className="space-y-3">
                <div className="flex justify-between"><dt className="text-sm text-neutral-500">Legal Name</dt><dd className="text-sm font-medium text-neutral-900">{borrower.legal_name}</dd></div>
                <div className="flex justify-between"><dt className="text-sm text-neutral-500">Industry</dt><dd className="text-sm font-medium text-neutral-900">{borrower.industry || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-sm text-neutral-500">Tax ID</dt><dd className="text-sm font-medium text-neutral-900">{borrower.tax_id || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-sm text-neutral-500">Contact Email</dt><dd className="text-sm font-medium text-neutral-900">{borrower.contact_email || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-sm text-neutral-500">Contact Phone</dt><dd className="text-sm font-medium text-neutral-900">{borrower.contact_phone || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-sm text-neutral-500">Address</dt><dd className="text-sm font-medium text-neutral-900 text-right">{borrower.address || '—'}</dd></div>
              </dl>
            ) : (
              <EmptyState title="No borrower data" />
            )}
          </div>
          <div className="card p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-primary-600" />
                <h3 className="text-sm font-semibold text-neutral-900">Ledger Balance Check</h3>
              </div>
              <span className={`badge ${isBalanced ? 'badge-success' : 'badge-error'}`}>
                {isBalanced ? 'Balanced' : 'Out of Balance'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xs font-medium uppercase tracking-wider text-neutral-500">Total Debits</p>
                <p className="text-lg font-semibold text-neutral-900">{formatCurrencyDetailed(totalDebits)}</p>
              </div>
              <div>
                <p className="text-2xs font-medium uppercase tracking-wider text-neutral-500">Total Credits</p>
                <p className="text-lg font-semibold text-neutral-900">{formatCurrencyDetailed(totalCredits)}</p>
              </div>
              <div>
                <p className="text-2xs font-medium uppercase tracking-wider text-neutral-500">Difference</p>
                <p className={`text-lg font-semibold ${isBalanced ? 'text-success-600' : 'text-error-600'}`}>
                  {formatCurrencyDetailed(Math.round((totalDebits - totalCredits) * 100) / 100)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'collateral' && (
        <div className="animate-fade-in">
          <div className="mb-4 flex justify-end">
            <button className="btn-secondary" onClick={() => setShowAddCollateral(true)}>
              <Plus size={16} />
              Add Invoice
            </button>
          </div>
          {collateral.length === 0 ? (
            <div className="card"><EmptyState icon={<FileText size={48} />} title="No collateral" description="Add AR invoices to build the borrowing base." /></div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="table-header px-4 py-3">Obligor</th>
                    <th className="table-header px-4 py-3">Invoice #</th>
                    <th className="table-header px-4 py-3 text-right">Amount</th>
                    <th className="table-header px-4 py-3">Invoice Date</th>
                    <th className="table-header px-4 py-3">Age</th>
                    <th className="table-header px-4 py-3">Flags</th>
                    <th className="table-header px-4 py-3">Status</th>
                    <th className="table-header px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {collateral.map((c) => {
                    const age = daysSince(c.invoice_date)
                    const isAgedOut = age > 90
                    return (
                      <tr key={c.id} className="table-row">
                        <td className="px-4 py-3 font-medium text-neutral-900">{c.obligor_name || c.obligor_id}</td>
                        <td className="px-4 py-3 text-neutral-600">{c.invoice_number}</td>
                        <td className="px-4 py-3 text-right font-medium text-neutral-900">{formatCurrency(c.outstanding_amount)}</td>
                        <td className="px-4 py-3 text-neutral-600">{formatDate(c.invoice_date)}</td>
                        <td className="px-4 py-3">
                          <span className={isAgedOut ? 'text-error-600 font-medium' : 'text-neutral-600'}>{age}d</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {c.disputed_flag && <span className="badge-error">Disputed</span>}
                            {c.ineligible_flag && <span className="badge-warning">Ineligible</span>}
                            {isAgedOut && !c.ineligible_flag && <span className="badge-warning">Aged Out</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3">
                          <button
                            className="text-neutral-400 hover:text-error-600"
                            onClick={() => setConfirmDelete({ type: 'collateral', id: c.id, label: `${c.invoice_number} - ${c.obligor_name}` })}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'reserves' && (
        <div className="animate-fade-in">
          <div className="mb-4 flex justify-end">
            <button className="btn-secondary" onClick={() => setShowAddReserve(true)}>
              <Plus size={16} />
              Add Reserve
            </button>
          </div>
          {reserves.length === 0 ? (
            <div className="card"><EmptyState icon={<Shield size={48} />} title="No reserves" description="Add reserves to reflect lending agreement requirements." /></div>
          ) : (
            <div className="space-y-3">
              {reserves.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-neutral-900">{r.reserve_type.replace(/_/g, ' ')}</h4>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="mt-1 text-sm text-neutral-500">{r.description || 'No description'}</p>
                      <p className="mt-1 text-xs text-neutral-400">
                        Effective: {formatDate(r.effective_at)} - Expires: {formatDate(r.expiration_at) || 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-warning-700">{formatCurrency(r.amount)}</span>
                      <button
                        className="text-neutral-400 hover:text-error-600"
                        onClick={() => setConfirmDelete({ type: 'reserve', id: r.id, label: `${r.reserve_type} - ${formatCurrency(r.amount)}` })}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'draws' && (
        <div className="animate-fade-in">
          {draws.length === 0 ? (
            <div className="card"><EmptyState icon={<ArrowDownCircle size={48} />} title="No draws" description="Create a draw request against this facility's availability." /></div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="table-header px-4 py-3">Request ID</th>
                    <th className="table-header px-4 py-3 text-right">Requested</th>
                    <th className="table-header px-4 py-3 text-right">Approved</th>
                    <th className="table-header px-4 py-3">Requested By</th>
                    <th className="table-header px-4 py-3">Approved By</th>
                    <th className="table-header px-4 py-3">Date</th>
                    <th className="table-header px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {draws.map((d) => (
                    <tr key={d.id} className="table-row">
                      <td className="px-4 py-3 font-medium text-neutral-900">{d.request_id}</td>
                      <td className="px-4 py-3 text-right text-neutral-900">{formatCurrency(Math.abs(d.requested_amount))}</td>
                      <td className="px-4 py-3 text-right text-neutral-900">{d.approved_amount !== null ? formatCurrency(Math.abs(d.approved_amount)) : '—'}</td>
                      <td className="px-4 py-3 text-neutral-600">{d.created_by || '—'}</td>
                      <td className="px-4 py-3 text-neutral-600">{d.approved_by || '—'}</td>
                      <td className="px-4 py-3 text-neutral-600">{formatDateTime(d.requested_at)}</td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="animate-fade-in">
          {payments.length === 0 ? (
            <div className="card"><EmptyState icon={<ArrowUpCircle size={48} />} title="No payments" description="Record payments received against this facility." action={<Link to="/payments" className="btn-primary">Record Payment</Link>} /></div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="table-header px-4 py-3">Request ID</th>
                    <th className="table-header px-4 py-3 text-right">Received</th>
                    <th className="table-header px-4 py-3 text-right">Principal</th>
                    <th className="table-header px-4 py-3 text-right">Interest</th>
                    <th className="table-header px-4 py-3 text-right">Fees</th>
                    <th className="table-header px-4 py-3 text-right">Unapplied</th>
                    <th className="table-header px-4 py-3">Date</th>
                    <th className="table-header px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="table-row">
                      <td className="px-4 py-3 font-medium text-neutral-900">{p.request_id || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-neutral-900">{formatCurrency(p.received_amount)}</td>
                      <td className="px-4 py-3 text-right text-neutral-900">{formatCurrency(p.principal_amount)}</td>
                      <td className="px-4 py-3 text-right text-neutral-900">{formatCurrency(p.interest_amount)}</td>
                      <td className="px-4 py-3 text-right text-neutral-900">{formatCurrency(p.fee_amount)}</td>
                      <td className="px-4 py-3 text-right text-neutral-600">{formatCurrency(p.unapplied_amount)}</td>
                      <td className="px-4 py-3 text-neutral-600">{formatDateTime(p.received_at)}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'ledger' && (
        <div className="animate-fade-in">
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-neutral-50 p-3">
            <AlertTriangle size={16} className={isBalanced ? 'text-success-600' : 'text-error-600'} />
            <span className="text-sm text-neutral-700">
              {isBalanced
                ? `Ledger is balanced: ${formatCurrencyDetailed(totalDebits)} debits = ${formatCurrencyDetailed(totalCredits)} credits`
                : `Ledger is out of balance: ${formatCurrencyDetailed(totalDebits)} debits vs ${formatCurrencyDetailed(totalCredits)} credits`}
            </span>
          </div>
          {ledger.length === 0 ? (
            <div className="card"><EmptyState icon={<BookOpen size={48} />} title="No ledger entries" description="Ledger entries are created when draws are posted and payments are applied." /></div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="table-header px-4 py-3">Entry Type</th>
                    <th className="table-header px-4 py-3">Source</th>
                    <th className="table-header px-4 py-3 text-right">Debit</th>
                    <th className="table-header px-4 py-3 text-right">Credit</th>
                    <th className="table-header px-4 py-3">Business Date</th>
                    <th className="table-header px-4 py-3">Description</th>
                    <th className="table-header px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((l) => (
                    <tr key={l.id} className="table-row">
                      <td className="px-4 py-3 font-medium text-neutral-900">{l.entry_type.replace(/_/g, ' ').toLowerCase()}</td>
                      <td className="px-4 py-3 text-neutral-600">{l.source_type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-right font-medium text-primary-700">{l.debit_amount > 0 ? formatCurrencyDetailed(l.debit_amount) : '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-secondary-700">{l.credit_amount > 0 ? formatCurrencyDetailed(l.credit_amount) : '—'}</td>
                      <td className="px-4 py-3 text-neutral-600">{formatDate(l.business_date)}</td>
                      <td className="px-4 py-3 text-neutral-500">{l.description || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <CreateDrawModal
        open={showCreateDraw}
        onClose={() => setShowCreateDraw(false)}
        facilityId={facility.id}
        facilityName={facility.facility_name}
        netAvailability={breakdown.netAvailability}
        onCreated={load}
      />
      <AddCollateralModal
        open={showAddCollateral}
        onClose={() => setShowAddCollateral(false)}
        facilityId={facility.id}
        onCreated={load}
      />
      <AddReserveModal
        open={showAddReserve}
        onClose={() => setShowAddReserve(false)}
        facilityId={facility.id}
        onCreated={load}
      />
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirm Delete"
        description={`Are you sure you want to delete ${confirmDelete?.label}?`}
        size="sm"
      >
        <p className="text-sm text-neutral-600">This action cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete}>Delete</button>
        </div>
      </Modal>
    </div>
  )
}
