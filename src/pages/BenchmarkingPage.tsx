import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { sampleBenchmarkingProvider } from '../lib/sampleBenchmarkingProvider'
import type {
  BenchmarkFilters,
  BenchmarkMode,
  BenchmarkSummary,
  DisclosureOutlierRow,
  RankState,
  ThemeOutlierRow,
} from '../types/benchmarking'

function formatRatePercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatCardPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function toStateLabel(state: RankState): string {
  if (state === 'NEEDS_ATTENTION') {
    return 'Needs Attention'
  }
  if (state === 'ON_PAR') {
    return 'On Par'
  }
  return 'Leading'
}

function stateClassName(state: RankState): string {
  if (state === 'NEEDS_ATTENTION') {
    return 'state-negative'
  }
  if (state === 'ON_PAR') {
    return 'state-neutral'
  }
  return 'state-positive'
}

function modeLabel(mode: BenchmarkMode): string {
  if (mode === 'my_region') {
    return 'My Region'
  }
  if (mode === 'my_sector') {
    return 'My Sector'
  }
  if (mode === 'my_market_cap') {
    return 'My Market Cap'
  }
  return 'My Peers'
}

function clampToPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

type EsgTheme = 'Environment' | 'Social' | 'Governance'
type MetricGroupTheme = EsgTheme | 'Other'

const ESG_THEME_ORDER: EsgTheme[] = ['Environment', 'Social', 'Governance']

export interface MetricGroup {
  theme: MetricGroupTheme
  metrics: string[]
}

function sortAlpha(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function normalizeMetricGroupTheme(theme: string): MetricGroupTheme {
  if (theme === 'Environment' || theme === 'Social' || theme === 'Governance') {
    return theme
  }

  return 'Other'
}

export function buildMetricGroups(disclosureRows: DisclosureOutlierRow[]): MetricGroup[] {
  const metricsByTheme = new Map<MetricGroupTheme, Set<string>>()

  for (const row of disclosureRows) {
    const theme = normalizeMetricGroupTheme(row.theme)
    const existingMetrics = metricsByTheme.get(theme) ?? new Set<string>()
    existingMetrics.add(row.disclosure)
    metricsByTheme.set(theme, existingMetrics)
  }

  const groups: MetricGroup[] = ESG_THEME_ORDER.map((theme) => ({
    theme,
    metrics: sortAlpha([...(metricsByTheme.get(theme) ?? new Set<string>())]),
  }))

  const otherMetrics = metricsByTheme.get('Other')
  if (otherMetrics && otherMetrics.size > 0) {
    groups.push({
      theme: 'Other',
      metrics: sortAlpha([...otherMetrics]),
    })
  }

  return groups.filter((group) => group.metrics.length > 0)
}

export function toggleThemeMetrics(currentSelected: string[], groupMetrics: string[]): string[] {
  if (groupMetrics.length === 0) {
    return sortAlpha(currentSelected)
  }

  const selectedSet = new Set(currentSelected)
  const allSelected = groupMetrics.every((metric) => selectedSet.has(metric))

  if (allSelected) {
    for (const metric of groupMetrics) {
      selectedSet.delete(metric)
    }
  } else {
    for (const metric of groupMetrics) {
      selectedSet.add(metric)
    }
  }

  return sortAlpha([...selectedSet])
}

export function themeSelectionState(
  selectedMetrics: string[],
  groupMetrics: string[],
): 'all' | 'partial' | 'none' {
  if (groupMetrics.length === 0) {
    return 'none'
  }

  const selectedSet = new Set(selectedMetrics)
  const selectedCount = groupMetrics.filter((metric) => selectedSet.has(metric)).length

  if (selectedCount === 0) {
    return 'none'
  }
  if (selectedCount === groupMetrics.length) {
    return 'all'
  }

  return 'partial'
}

type LeaderRank = 1 | 2 | 3

export interface LeaderRenderPoint {
  rank: LeaderRank
  label: `R${LeaderRank}`
  position: number
}

export function buildLeaderRenderPoints(
  benchmarkPosition: number,
  benchmarkMode: BenchmarkMode,
): LeaderRenderPoint[] {
  const safeBenchmark = clampToPercent(benchmarkPosition)
  const rightEdgeByMode: Record<BenchmarkMode, number> = {
    my_peers: 99.2,
    my_sector: 98.9,
    my_market_cap: 99.5,
    my_region: 99.1,
  }
  const maxLeaderPosition = 99.999

  const rightEdge = Math.max(
    safeBenchmark + 0.03,
    Math.min(maxLeaderPosition, rightEdgeByMode[benchmarkMode]),
  )
  const rawStep = (rightEdge - safeBenchmark) / 3.25
  const maxStep = Math.max(0, (maxLeaderPosition - safeBenchmark) / 3)
  const step = Math.max(0, Math.min(rawStep, maxStep))

  const r3 = Math.min(maxLeaderPosition, safeBenchmark + step)
  const r2 = Math.min(maxLeaderPosition, safeBenchmark + step * 2)
  const r1 = Math.min(maxLeaderPosition, safeBenchmark + step * 3)

  return [
    { rank: 1, label: 'R1', position: r1 },
    { rank: 2, label: 'R2', position: r2 },
    { rank: 3, label: 'R3', position: r3 },
  ]
}

type KpiSegmentKey = 'needs' | 'on_par' | 'leading'
export type MetricStatusTab = 'NEEDS_ATTENTION' | 'ON_PAR' | 'LEADING'

interface MetricStatusTabCounts {
  needs: number
  on_par: number
  leading: number
}

interface KpiSegment {
  key: KpiSegmentKey
  label: string
  value: number
  proportion: number
  color: string
  swatchClass: 'needs' | 'on-par' | 'leading'
}

export function buildMetricStatusTabCounts(
  metricFilteredRows: DisclosureOutlierRow[],
): MetricStatusTabCounts {
  const counts: MetricStatusTabCounts = {
    needs: 0,
    on_par: 0,
    leading: 0,
  }

  for (const row of metricFilteredRows) {
    if (row.state === 'NEEDS_ATTENTION') {
      counts.needs += 1
    } else if (row.state === 'ON_PAR') {
      counts.on_par += 1
    } else {
      counts.leading += 1
    }
  }

  return counts
}

export function filterDisclosureRowsByMetricAndStatus(
  rows: DisclosureOutlierRow[],
  selectedMetrics: string[],
  selectedMetricStatusTab: MetricStatusTab,
): DisclosureOutlierRow[] {
  const selectedMetricSet = new Set(selectedMetrics)
  return rows.filter(
    (row) =>
      selectedMetricSet.has(row.disclosure) &&
      row.state === selectedMetricStatusTab,
  )
}

function DisclosureMiniGraph({
  companyRate,
  benchmarkRate,
  state,
}: {
  companyRate: number
  benchmarkRate: number
  state: RankState
}) {
  const companyPosition = clampToPercent(companyRate * 100)
  const benchmarkPosition = clampToPercent(benchmarkRate * 100)

  return (
    <div className="mini-graph" aria-label="My company vs benchmark average">
      <div className="mini-track" />
      <div
        className={`mini-link ${stateClassName(state)}`}
        style={{
          left: `${Math.min(companyPosition, benchmarkPosition)}%`,
          width: `${Math.abs(companyPosition - benchmarkPosition)}%`,
        }}
      />
      <span
        className="mini-point benchmark"
        style={{ left: `${benchmarkPosition}%` }}
        title={`Benchmark Avg: ${benchmarkRate.toFixed(3)} (${formatRatePercent(benchmarkRate)})`}
      />
      <span
        className={`mini-point company ${stateClassName(state)}`}
        style={{ left: `${companyPosition}%` }}
        title={`My Company: ${companyRate.toFixed(3)} (${formatRatePercent(companyRate)})`}
      />
    </div>
  )
}

export function BenchmarkingPage() {
  const provider = sampleBenchmarkingProvider
  const currentCompany = useMemo(() => provider.getCurrentCompany(), [provider])
  const materialMenuRef = useRef<HTMLDivElement | null>(null)
  const kpiPieRef = useRef<HTMLDivElement | null>(null)

  const [benchmarkMode, setBenchmarkMode] = useState<BenchmarkMode>('my_peers')
  const [summary, setSummary] = useState<BenchmarkSummary | null>(null)
  const [themeRows, setThemeRows] = useState<ThemeOutlierRow[]>([])
  const [disclosureRows, setDisclosureRows] = useState<DisclosureOutlierRow[]>([])
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])
  const [selectedMetricStatusTab, setSelectedMetricStatusTab] =
    useState<MetricStatusTab>('NEEDS_ATTENTION')
  const [isMaterialMenuOpen, setIsMaterialMenuOpen] = useState<boolean>(false)
  const [hoveredSegment, setHoveredSegment] = useState<KpiSegmentKey | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const filters = useMemo<BenchmarkFilters>(
    () => ({
      framework: 'CSRD',
      companyId: currentCompany.companyId,
      benchmarkMode,
    }),
    [benchmarkMode, currentCompany.companyId],
  )

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const [nextSummary, nextThemeRows, nextDisclosureRows] = await Promise.all([
        provider.getSummary(filters),
        provider.getThemeOutliers(filters),
        provider.getDisclosureOutliers(filters),
      ])

      if (!active) {
        return
      }

      setSummary(nextSummary)
      setThemeRows(nextThemeRows)
      setDisclosureRows(nextDisclosureRows)
      setSelectedMetrics(sortAlpha([...new Set(nextDisclosureRows.map((row) => row.disclosure))]))
      setSelectedMetricStatusTab('NEEDS_ATTENTION')
      setIsMaterialMenuOpen(false)
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [filters, provider])

  const metricGroups = useMemo(() => buildMetricGroups(disclosureRows), [disclosureRows])
  const metricFilteredRows = useMemo(
    () => disclosureRows.filter((row) => selectedMetrics.includes(row.disclosure)),
    [disclosureRows, selectedMetrics],
  )
  const metricStatusTabCounts = useMemo(
    () => buildMetricStatusTabCounts(metricFilteredRows),
    [metricFilteredRows],
  )

  const filteredDisclosureRows = useMemo(
    () =>
      filterDisclosureRowsByMetricAndStatus(
        disclosureRows,
        selectedMetrics,
        selectedMetricStatusTab,
      ),
    [disclosureRows, selectedMetrics, selectedMetricStatusTab],
  )
  const metricSummaryText = `(${selectedMetrics.length}) selected`
  const totalDisclosures = Math.max(summary?.totalDisclosuresCount ?? 0, 1)
  const benchmarkPosition = clampToPercent(
    ((summary?.benchmarkAverageCompletedDisclosuresCount ?? 0) / totalDisclosures) * 100,
  )
  const companyPosition = clampToPercent(
    ((summary?.overallCompletedDisclosuresCount ?? 0) / totalDisclosures) * 100,
  )
  const leaderPoints = useMemo(
    () => buildLeaderRenderPoints(benchmarkPosition, benchmarkMode),
    [benchmarkPosition, benchmarkMode],
  )
  const kpiPie = useMemo(() => {
    const needsAttention = clampToPercent(summary?.needsAttentionTopicsPct ?? 0)
    const onPar = clampToPercent(summary?.onParTopicsPct ?? 0)
    const leading = clampToPercent(summary?.leadingTopicsPct ?? 0)
    const total = needsAttention + onPar + leading

    const segments: KpiSegment[] = [
      {
        key: 'needs',
        label: 'Needs Attention',
        value: needsAttention,
        proportion: total <= 0 ? 1 / 3 : needsAttention / total,
        color: 'var(--risk)',
        swatchClass: 'needs',
      },
      {
        key: 'on_par',
        label: 'On Par',
        value: onPar,
        proportion: total <= 0 ? 1 / 3 : onPar / total,
        color: 'var(--warn)',
        swatchClass: 'on-par',
      },
      {
        key: 'leading',
        label: 'Leading',
        value: leading,
        proportion: total <= 0 ? 1 / 3 : leading / total,
        color: 'var(--good)',
        swatchClass: 'leading',
      },
    ]

    return {
      segments,
    }
  }, [summary])

  const activeSegment = useMemo(
    () => kpiPie.segments.find((segment) => segment.key === hoveredSegment) ?? null,
    [hoveredSegment, kpiPie.segments],
  )

  useEffect(() => {
    function onDocumentMouseDown(event: MouseEvent) {
      if (isMaterialMenuOpen && materialMenuRef.current && !materialMenuRef.current.contains(event.target as Node)) {
        setIsMaterialMenuOpen(false)
      }
    }

    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMaterialMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', onDocumentMouseDown)
    document.addEventListener('keydown', onDocumentKeyDown)

    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown)
      document.removeEventListener('keydown', onDocumentKeyDown)
    }
  }, [isMaterialMenuOpen])

  function toggleMetric(metric: string) {
    setSelectedMetrics((current) => {
      if (current.includes(metric)) {
        return current.filter((item) => item !== metric)
      }

      return sortAlpha([...current, metric])
    })
  }

  function toggleMetricTheme(metrics: string[]) {
    setSelectedMetrics((current) => toggleThemeMetrics(current, metrics))
  }

  function handleSegmentHover(event: ReactMouseEvent<SVGCircleElement>, segment: KpiSegment) {
    if (!kpiPieRef.current) {
      return
    }

    const bounds = kpiPieRef.current.getBoundingClientRect()
    setHoveredSegment(segment.key)
    setTooltipPosition({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })
  }

  function clearSegmentHover() {
    setHoveredSegment(null)
    setTooltipPosition(null)
  }

  const metricStatusTabs: Array<{ key: MetricStatusTab; label: string; count: number }> = [
    { key: 'NEEDS_ATTENTION', label: 'NEEDS ATTENTION', count: metricStatusTabCounts.needs },
    { key: 'ON_PAR', label: 'ON PAR', count: metricStatusTabCounts.on_par },
    { key: 'LEADING', label: 'LEADING', count: metricStatusTabCounts.leading },
  ]

  return (
    <main className="benchmark-page">
      <section className="control-strip animate-in">
        <div className="segmented-filter" role="tablist" aria-label="Benchmark mode">
          <p>Benchmark</p>
          <div>
            {(['my_peers', 'my_sector', 'my_market_cap', 'my_region'] as BenchmarkMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={benchmarkMode === mode ? 'active' : ''}
                onClick={() => setBenchmarkMode(mode)}
              >
                {modeLabel(mode)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading || !summary ? (
        <p className="loading-state">Recalculating benchmark view...</p>
      ) : (
        <>
          <section className="top-summary-grid animate-in">
            <section className="panel overall-ranking">
              <div className="overall-head-row">
                <div>
                  <h2 className="section-title">Overall Competitive Rank</h2>
                  <p className="section-subtitle">Ranking benchmark, your company, and leaders in disclosure.</p>
                </div>
              </div>

              <div className="dumbbell-chart" aria-label="Overall competitive rank graph">
                <div className="dumbbell-track" />
                {leaderPoints.map((leader) => (
                  <span
                    key={leader.rank}
                    className="dumbbell-point sample-leader point-above"
                    style={{ left: `${leader.position}%` }}
                    title={`Rank ${leader.rank}`}
                  >
                    <span className="point-label">{leader.label}</span>
                  </span>
                ))}
                <span
                  className="dumbbell-point benchmark point-below"
                  style={{ left: `${benchmarkPosition}%` }}
                  title={`Benchmark Average: ${summary.benchmarkAverageCompletedDisclosuresCount.toFixed(2)} / ${summary.totalDisclosuresCount}`}
                >
                  <span className="point-label">Benchmark</span>
                </span>
                <span
                  className={`dumbbell-point company ${stateClassName(summary.overallState)} point-above`}
                  style={{ left: `${companyPosition}%` }}
                  title={`My Company: ${summary.overallCompletedDisclosuresCount} / ${summary.totalDisclosuresCount}`}
                >
                  <span className="point-label">My Company</span>
                </span>
              </div>
            </section>

            <section className="panel kpi-pie-panel" aria-label="Disclosure KPI composition">
              <h2 className="section-title">Distribution of disclosure status</h2>
              <p className="section-subtitle">Distribution of disclosure status over ESG Metrics</p>
              <div className="kpi-pie-content">
                <div className="kpi-pie-visual" ref={kpiPieRef} onMouseLeave={clearSegmentHover}>
                  <svg
                    className="kpi-pie-chart"
                    viewBox="0 0 140 140"
                    aria-label="Disclosure status composition pie chart"
                    role="img"
                  >
                    <circle className="kpi-pie-base" cx="70" cy="70" r="52" />
                    {kpiPie.segments.map((segment, index) => {
                      const circumference = 2 * Math.PI * 52
                      const segmentLength = segment.proportion * circumference
                      const previousLength = kpiPie.segments
                        .slice(0, index)
                        .reduce((sum, row) => sum + row.proportion * circumference, 0)

                      return (
                        <circle
                          key={segment.key}
                          className={`kpi-pie-segment ${hoveredSegment === segment.key ? 'is-active' : ''}`}
                          cx="70"
                          cy="70"
                          r="52"
                          style={{ stroke: segment.color }}
                          strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                          strokeDashoffset={`${-previousLength}`}
                          onMouseMove={(event) => handleSegmentHover(event, segment)}
                        />
                      )
                    })}
                    <circle className="kpi-pie-hole" cx="70" cy="70" r="34" />
                  </svg>
                  {activeSegment && tooltipPosition ? (
                    <div
                      className="kpi-pie-tooltip"
                      style={{
                        left: `${tooltipPosition.x}px`,
                        top: `${tooltipPosition.y}px`,
                      }}
                    >
                      <span>{activeSegment.label}</span>
                      <strong>{formatCardPercent(activeSegment.value)}</strong>
                    </div>
                  ) : null}
                </div>
                <ul className="kpi-pie-legend" aria-label="Disclosure status legend">
                  {kpiPie.segments.map((segment) => (
                    <li key={segment.key} className="kpi-pie-legend-item">
                      <span className={`kpi-swatch ${segment.swatchClass}`} />
                      <span>{segment.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </section>

          <section className="content-grid animate-in">
            <article className="panel rank-panel theme-panel">
              <header>
                <h2 className="section-title">Rank by Theme</h2>
                <p className="section-subtitle">Sorting ESG themes based on disclosure gap</p>
              </header>

              <div className="rank-panel-body theme-scroll">
                <ul className="theme-rows">
                  {themeRows.map((row) => (
                    <li key={row.themeId}>
                      <div className="theme-row-head">
                        <strong>{row.theme}</strong>
                        <span className={`state-pill ${stateClassName(row.state)}`}>
                          {toStateLabel(row.state)}
                        </span>
                      </div>

                      <div className="grouped-bars" aria-label="Theme comparison bars">
                        <div>
                          <small>My Company</small>
                          <div className="bar-track">
                            <div
                              className={`bar-fill ${stateClassName(row.state)}`}
                              style={{ width: `${clampToPercent(row.companyRate * 100)}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <small>Benchmark</small>
                          <div className="bar-track">
                            <div
                              className="bar-fill benchmark"
                              style={{ width: `${clampToPercent(row.benchmarkAverageRate * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <article className="panel rank-panel disclosure-panel">
              <header>
                <div className="disclosure-header-row">
                  <div className="disclosure-header-top">
                    <h2 className="section-title">Rank by Metric</h2>
                    <div className="material-items-filter material-items-inline" ref={materialMenuRef}>
                      <div className="disclosure-header-controls">
                        <div className="metric-status-tabs" role="tablist" aria-label="Metric status filter">
                          {metricStatusTabs.map((tab) => (
                            <button
                              key={tab.key}
                              type="button"
                              role="tab"
                              aria-selected={selectedMetricStatusTab === tab.key}
                              className={selectedMetricStatusTab === tab.key ? 'active' : ''}
                              onClick={() => setSelectedMetricStatusTab(tab.key)}
                            >
                              {`${tab.label} (${tab.count})`}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="material-items-trigger"
                          aria-label="Metric filter"
                          aria-expanded={isMaterialMenuOpen}
                          aria-controls="material-items-menu"
                          onClick={() => setIsMaterialMenuOpen((current) => !current)}
                        >
                          <span>{metricSummaryText}</span>
                          <span
                            className={`material-items-chevron ${isMaterialMenuOpen ? 'open' : ''}`}
                            aria-hidden
                          />
                        </button>
                        {isMaterialMenuOpen ? (
                          <div
                            className="material-items-menu"
                            id="material-items-menu"
                            role="listbox"
                            aria-multiselectable="true"
                          >
                            {metricGroups.map((group) => {
                              const selectionState = themeSelectionState(selectedMetrics, group.metrics)

                              return (
                                <div key={group.theme} className="material-items-group">
                                  <label className="material-items-group-head">
                                    <input
                                      type="checkbox"
                                      checked={selectionState === 'all'}
                                      ref={(input) => {
                                        if (input) {
                                          input.indeterminate = selectionState === 'partial'
                                        }
                                      }}
                                      onChange={() => toggleMetricTheme(group.metrics)}
                                    />
                                    <span>{group.theme}</span>
                                  </label>
                                  <div className="material-items-group-options">
                                    {group.metrics.map((metric) => (
                                      <label key={metric} className="material-items-option">
                                        <input
                                          type="checkbox"
                                          checked={selectedMetrics.includes(metric)}
                                          onChange={() => toggleMetric(metric)}
                                        />
                                        <span>{metric}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : null}
                        </div>
                      </div>
                    </div>
                  <p className="disclosure-summary section-subtitle">Sorting ESG metrics based on disclosure gap</p>
                </div>
              </header>

              <div className="rank-panel-body disclosure-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Theme</th>
                      <th>Metric</th>
                      <th>Comparison</th>
                      <th>State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDisclosureRows.map((row) => (
                      <tr key={`${row.theme}-${row.requirementId}-${row.disclosure}`}>
                        <td>{row.theme}</td>
                        <td>{row.disclosure}</td>
                        <td>
                          <DisclosureMiniGraph
                            companyRate={row.companyRate}
                            benchmarkRate={row.benchmarkAverageRate}
                            state={row.state}
                          />
                        </td>
                        <td>
                          <span className={`state-pill ${stateClassName(row.state)}`}>
                            {toStateLabel(row.state)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        </>
      )}
    </main>
  )
}
