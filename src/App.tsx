import { Navigate, Route, Routes } from 'react-router-dom'
import { BenchmarkingPage } from './pages/BenchmarkingPage'
import { DetailPage } from './pages/DetailPage'
import { InsightsPage } from './pages/InsightsPage'

function AppShell() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/gap-analysis/insights" element={<InsightsPage />} />
        <Route path="/gap-analysis/detail" element={<DetailPage />} />
        <Route path="/gap-analysis/benchmarking" element={<BenchmarkingPage />} />
        <Route path="*" element={<Navigate to="/gap-analysis/benchmarking" replace />} />
      </Routes>
    </div>
  )
}

export default AppShell
