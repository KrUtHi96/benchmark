import { describe, expect, it } from 'vitest'
import {
  buildMetricStatusTabCounts,
  buildMetricGroups,
  buildLeaderRenderPoints,
  filterDisclosureRowsByMetricAndStatus,
  themeSelectionState,
  toggleThemeMetrics,
} from './BenchmarkingPage'
import type { DisclosureOutlierRow } from '../types/benchmarking'

function makeDisclosureRow(
  theme: string,
  disclosure: string,
  state: DisclosureOutlierRow['state'] = 'ON_PAR',
): DisclosureOutlierRow {
  return {
    theme,
    disclosure,
    requirementId: '',
    companyRate: 0,
    benchmarkAverageRate: 0,
    gapPts: 0,
    state,
  }
}

describe('buildLeaderRenderPoints', () => {
  it('keeps R1 rightmost, then R2, then R3, all right of benchmark', () => {
    const benchmarkPosition = 62
    const points = buildLeaderRenderPoints(benchmarkPosition, 'my_peers')

    expect(points).toHaveLength(3)
    expect(points[0].rank).toBe(1)
    expect(points[1].rank).toBe(2)
    expect(points[2].rank).toBe(3)
    expect(points[0].position).toBeGreaterThan(points[1].position)
    expect(points[1].position).toBeGreaterThan(points[2].position)
    expect(points[2].position).toBeGreaterThan(benchmarkPosition)
    expect(points.every((point) => point.position >= 0 && point.position <= 100)).toBe(true)
  })

  it('compresses spacing for high benchmark values while preserving order', () => {
    const benchmarkPosition = 97.5
    const points = buildLeaderRenderPoints(benchmarkPosition, 'my_market_cap')

    expect(points[0].position).toBeGreaterThan(points[1].position)
    expect(points[1].position).toBeGreaterThan(points[2].position)
    expect(points[2].position).toBeGreaterThan(benchmarkPosition)
    expect(points.every((point) => point.position <= 100)).toBe(true)
  })

  it('supports my_region with ordered, bounded points', () => {
    const benchmarkPosition = 71
    const points = buildLeaderRenderPoints(benchmarkPosition, 'my_region')

    expect(points[0].position).toBeGreaterThan(points[1].position)
    expect(points[1].position).toBeGreaterThan(points[2].position)
    expect(points[2].position).toBeGreaterThan(benchmarkPosition)
    expect(points.every((point) => point.position >= 0 && point.position <= 100)).toBe(true)
  })
})

describe('metric hierarchy helpers', () => {
  it('builds grouped metric options in Environment, Social, Governance order', () => {
    const rows: DisclosureOutlierRow[] = [
      makeDisclosureRow('Social', 'Labor standards'),
      makeDisclosureRow('Environment', 'GHG emissions'),
      makeDisclosureRow('Governance', 'Board independence'),
      makeDisclosureRow('Environment', 'Water consumption'),
      makeDisclosureRow('Social', 'Labor standards'),
      makeDisclosureRow('Unexpected', 'Fallback metric'),
    ]

    const groups = buildMetricGroups(rows)

    expect(groups).toEqual([
      { theme: 'Environment', metrics: ['GHG emissions', 'Water consumption'] },
      { theme: 'Social', metrics: ['Labor standards'] },
      { theme: 'Governance', metrics: ['Board independence'] },
      { theme: 'Other', metrics: ['Fallback metric'] },
    ])
  })

  it('returns none, partial, all selection state correctly', () => {
    const groupMetrics = ['GHG emissions', 'Water consumption']

    expect(themeSelectionState([], groupMetrics)).toBe('none')
    expect(themeSelectionState(['GHG emissions'], groupMetrics)).toBe('partial')
    expect(themeSelectionState(['GHG emissions', 'Water consumption'], groupMetrics)).toBe('all')
  })

  it('toggles all metrics in a group on and off', () => {
    const groupMetrics = ['Biodiversity', 'Water']

    expect(toggleThemeMetrics(['GHG'], groupMetrics)).toEqual(['Biodiversity', 'GHG', 'Water'])
    expect(toggleThemeMetrics(['Biodiversity', 'GHG', 'Water'], groupMetrics)).toEqual(['GHG'])
  })
})

describe('rank by metric status tab helpers', () => {
  it('builds status tab counts from metric-filtered rows', () => {
    const rows = [
      makeDisclosureRow('Environment', 'GHG emissions', 'NEEDS_ATTENTION'),
      makeDisclosureRow('Environment', 'GHG emissions', 'LEADING'),
      makeDisclosureRow('Social', 'Labor standards', 'ON_PAR'),
    ]
    const metricFilteredRows = rows.filter((row) => row.disclosure === 'GHG emissions')

    expect(buildMetricStatusTabCounts(metricFilteredRows)).toEqual({
      needs: 1,
      on_par: 0,
      leading: 1,
    })
  })

  it('status tabs apply selected metrics and selected status', () => {
    const rows = [
      makeDisclosureRow('Environment', 'GHG emissions', 'LEADING'),
      makeDisclosureRow('Social', 'Labor standards', 'ON_PAR'),
      makeDisclosureRow('Governance', 'Board independence', 'NEEDS_ATTENTION'),
    ]

    const filtered = filterDisclosureRowsByMetricAndStatus(
      rows,
      ['Labor standards', 'Board independence'],
      'ON_PAR',
    )

    expect(filtered).toEqual([makeDisclosureRow('Social', 'Labor standards', 'ON_PAR')])
  })

  it('status tabs intersect selected metrics with selected status', () => {
    const rows = [
      makeDisclosureRow('Environment', 'GHG emissions', 'LEADING'),
      makeDisclosureRow('Environment', 'GHG emissions', 'ON_PAR'),
      makeDisclosureRow('Social', 'Labor standards', 'ON_PAR'),
      makeDisclosureRow('Social', 'Labor standards', 'NEEDS_ATTENTION'),
    ]

    const filtered = filterDisclosureRowsByMetricAndStatus(
      rows,
      ['GHG emissions', 'Labor standards'],
      'ON_PAR',
    )

    expect(filtered).toEqual([
      makeDisclosureRow('Environment', 'GHG emissions', 'ON_PAR'),
      makeDisclosureRow('Social', 'Labor standards', 'ON_PAR'),
    ])
  })
})
