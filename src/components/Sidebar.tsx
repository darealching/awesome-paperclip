import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  FileText,
  ArrowDownCircle,
  ArrowUpCircle,
  BookOpen,
  ScrollText,
  ShieldCheck,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/facilities', label: 'Facilities', icon: Building2 },
  { to: '/collateral', label: 'Collateral (AR)', icon: FileText },
  { to: '/draws', label: 'Draw Requests', icon: ArrowDownCircle },
  { to: '/payments', label: 'Payments', icon: ArrowUpCircle },
  { to: '/ledger', label: 'Ledger', icon: BookOpen },
  { to: '/audit', label: 'Audit Trail', icon: ScrollText },
]

export function Sidebar() {
  const location = useLocation()
  return (
    <aside className="flex h-screen w-60 flex-col border-r border-neutral-200 bg-white">
      <div className="flex items-center gap-3 border-b border-neutral-200 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h1 className="text-sm font-bold text-neutral-900">LendFlow</h1>
          <p className="text-2xs text-neutral-500">ABL Management</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.end
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
      <div className="border-t border-neutral-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
            LO
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-700">Loan Officer</p>
            <p className="text-2xs text-neutral-500">Internal Operations</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
