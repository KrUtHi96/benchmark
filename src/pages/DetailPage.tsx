import { useLocation } from 'react-router-dom'

export function DetailPage() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)

  const framework = params.get('framework')
  const theme = params.get('theme')
  const requirement = params.get('requirement')
  const disclosure = params.get('disclosure')

  return (
    <main className="placeholder-page">
      <h1>Gap Analysis Detail</h1>
      <p>Deep-link payload from Benchmarking tab:</p>
      <ul>
        <li>
          <strong>Framework:</strong> {framework ?? 'n/a'}
        </li>
        <li>
          <strong>Theme:</strong> {theme ?? 'n/a'}
        </li>
        <li>
          <strong>Requirement:</strong> {requirement ?? 'n/a'}
        </li>
        <li>
          <strong>Disclosure:</strong> {disclosure ?? 'n/a'}
        </li>
      </ul>
    </main>
  )
}
