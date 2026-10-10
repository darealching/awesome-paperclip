import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { FacilitiesList } from './pages/FacilitiesList'
import { FacilityDetail } from './pages/FacilityDetail'
import { CollateralPage } from './pages/CollateralPage'
import { DrawsPage } from './pages/DrawsPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { LedgerPage } from './pages/LedgerPage'
import { AuditPage } from './pages/AuditPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-neutral-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-6 py-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/facilities" element={<FacilitiesList />} />
              <Route path="/facilities/:id" element={<FacilityDetail />} />
              <Route path="/collateral" element={<CollateralPage />} />
              <Route path="/draws" element={<DrawsPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/ledger" element={<LedgerPage />} />
              <Route path="/audit" element={<AuditPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}
