import { describe, expect, it } from 'vitest'
import rawData from '../data/benchmark-sample-data.json'
import {
  buildBenchmarkModel,
  classifyState,
  computeDisclosureOutliers,
  computeSummary,
  computeThemeOutliers,
  resolveCohortCompanyIds,
} from './benchmarkingEngine'
import { mapCsrdToEsg } from './esgMapping'
import type { BenchmarkFilters } from '../types/benchmarking'

const model = buildBenchmarkModel(rawData)

function baseFilters(overrides: Partial<BenchmarkFilters> = {}): BenchmarkFilters {
  return {
    framework: 'CSRD',
    companyId: 'MSFT',
    benchmarkMode: 'my_peers',
    ...overrides,
  }
}

describe('benchmarkingEngine (overall disclosure-based rank)', () => {
  it('classifies state from delta sign with epsilon-safe equality', () => {
    expect(classifyState(-0.001)).toBe('NEEDS_ATTENTION')
    expect(classifyState(0)).toBe('ON_PAR')
    expect(classifyState(0.001)).toBe('LEADING')
  })

  it('resolves cohorts from semantic benchmark modes', () => {
    const peers = resolveCohortCompanyIds(model, baseFilters({ benchmarkMode: 'my_peers' }))
    const sector = resolveCohortCompanyIds(model, baseFilters({ benchmarkMode: 'my_sector' }))
    const marketCap = resolveCohortCompanyIds(model, baseFilters({ benchmarkMode: 'my_market_cap' }))
    const region = resolveCohortCompanyIds(model, baseFilters({ benchmarkMode: 'my_region' }))

    expect(peers.length).toBeGreaterThan(0)
    expect(sector.length).toBeGreaterThan(0)
    expect(marketCap.length).toBeGreaterThan(0)
    expect(region.length).toBeGreaterThan(0)
    expect(peers.includes('MSFT')).toBe(false)
    expect(new Set(peers)).toEqual(new Set(['DLB', 'NDAQ']))
    expect(new Set(sector)).toEqual(new Set(['NDAQ']))
    expect(new Set(marketCap)).toEqual(new Set(['DLB']))
    expect(new Set(region)).toEqual(new Set(['DLB']))
    expect(new Set(peers)).not.toEqual(new Set(sector))
    expect(new Set(peers)).not.toEqual(new Set(marketCap))
    expect(new Set(peers)).not.toEqual(new Set(region))
    expect(region.includes('MSFT')).toBe(false)
  })

  it('changes summary benchmark averages across modes', () => {
    const peersSummary = computeSummary(model, baseFilters({ benchmarkMode: 'my_peers' }))
    const sectorSummary = computeSummary(model, baseFilters({ benchmarkMode: 'my_sector' }))
    const marketCapSummary = computeSummary(model, baseFilters({ benchmarkMode: 'my_market_cap' }))
    const regionSummary = computeSummary(model, baseFilters({ benchmarkMode: 'my_region' }))

    const values = new Set([
      peersSummary.benchmarkAverageCompletedDisclosuresCount.toFixed(6),
      sectorSummary.benchmarkAverageCompletedDisclosuresCount.toFixed(6),
      marketCapSummary.benchmarkAverageCompletedDisclosuresCount.toFixed(6),
      regionSummary.benchmarkAverageCompletedDisclosuresCount.toFixed(6),
    ])

    expect(values.size).toBeGreaterThanOrEqual(2)
  })

  it('changes disclosure ranking outputs across benchmark modes', () => {
    const peersRows = computeDisclosureOutliers(model, baseFilters({ benchmarkMode: 'my_peers' }))
    const sectorRows = computeDisclosureOutliers(model, baseFilters({ benchmarkMode: 'my_sector' }))
    const marketCapRows = computeDisclosureOutliers(model, baseFilters({ benchmarkMode: 'my_market_cap' }))
    const regionRows = computeDisclosureOutliers(model, baseFilters({ benchmarkMode: 'my_region' }))

    expect(peersRows.length).toBeGreaterThan(0)
    expect(sectorRows.length).toBeGreaterThan(0)
    expect(marketCapRows.length).toBeGreaterThan(0)
    expect(regionRows.length).toBeGreaterThan(0)

    const peersFirst = `${peersRows[0].theme}|${peersRows[0].requirementId}|${peersRows[0].disclosure}|${peersRows[0].gapPts.toFixed(3)}`
    const sectorFirst = `${sectorRows[0].theme}|${sectorRows[0].requirementId}|${sectorRows[0].disclosure}|${sectorRows[0].gapPts.toFixed(3)}`
    const marketCapFirst = `${marketCapRows[0].theme}|${marketCapRows[0].requirementId}|${marketCapRows[0].disclosure}|${marketCapRows[0].gapPts.toFixed(3)}`
    const regionFirst = `${regionRows[0].theme}|${regionRows[0].requirementId}|${regionRows[0].disclosure}|${regionRows[0].gapPts.toFixed(3)}`

    expect(new Set([peersFirst, sectorFirst, marketCapFirst, regionFirst]).size).toBeGreaterThanOrEqual(2)
  })

  it('computes valid summary bounds for my_region', () => {
    const summary = computeSummary(model, baseFilters({ benchmarkMode: 'my_region' }))
    expect(summary.totalDisclosuresCount).toBeGreaterThan(0)
    expect(summary.overallCompletedDisclosuresCount).toBeGreaterThanOrEqual(0)
    expect(summary.overallCompletedDisclosuresCount).toBeLessThanOrEqual(summary.totalDisclosuresCount)
    expect(summary.benchmarkAverageCompletedDisclosuresCount).toBeGreaterThanOrEqual(0)
    expect(summary.needsAttentionTopicsPct).toBeGreaterThanOrEqual(0)
    expect(summary.needsAttentionTopicsPct).toBeLessThanOrEqual(100)
    expect(summary.onParTopicsPct).toBeGreaterThanOrEqual(0)
    expect(summary.onParTopicsPct).toBeLessThanOrEqual(100)
    expect(summary.leadingTopicsPct).toBeGreaterThanOrEqual(0)
    expect(summary.leadingTopicsPct).toBeLessThanOrEqual(100)
    expect(summary.overallLeaderDots.length).toBeLessThanOrEqual(3)
    expect(['NEEDS_ATTENTION', 'ON_PAR', 'LEADING']).toContain(summary.overallState)
  })

  it('sorts theme and disclosure rows from negative gap to positive gap', () => {
    const themeRows = computeThemeOutliers(model, baseFilters())
    const disclosureRows = computeDisclosureOutliers(model, baseFilters())

    expect(themeRows.length).toBeGreaterThan(0)
    expect(disclosureRows.length).toBeGreaterThan(0)
    expect(themeRows[0].gapPts).toBeLessThanOrEqual(themeRows[themeRows.length - 1].gapPts)
    expect(disclosureRows[0].gapPts).toBeLessThanOrEqual(
      disclosureRows[disclosureRows.length - 1].gapPts,
    )
  })

  it('returns state on every ranked row', () => {
    const themeRows = computeThemeOutliers(model, baseFilters())
    const disclosureRows = computeDisclosureOutliers(model, baseFilters())

    expect(themeRows.every((row) => row.state !== undefined)).toBe(true)
    expect(disclosureRows.every((row) => row.state !== undefined)).toBe(true)
  })

  it('returns disclosure rows in mapped ESG taxonomy', () => {
    const themeRows = computeThemeOutliers(model, baseFilters())
    const disclosureRows = computeDisclosureOutliers(model, baseFilters())

    const allowedMappedThemes = new Set(['Environment', 'Social', 'Governance'])
    expect(themeRows.every((row) => allowedMappedThemes.has(row.theme))).toBe(true)
    expect(disclosureRows.every((row) => allowedMappedThemes.has(row.theme))).toBe(true)

    const rawTopicSet = new Set(
      rawData.companies
        .flatMap((company) => company.metricsAlignment)
        .map((row) => row.Disclosure),
    )

    const hasMappedOnlyMetric = disclosureRows.some((row) => !rawTopicSet.has(row.disclosure))
    expect(hasMappedOnlyMetric).toBe(true)
  })

  it('merges multiple CSRD requirement IDs into disclosure requirement field', () => {
    const disclosureRows = computeDisclosureOutliers(model, baseFilters())
    expect(disclosureRows.some((row) => row.requirementId.includes(','))).toBe(true)
  })

  it('covers every CSRD disclosure key with mapping (no fallback for sample data)', () => {
    const metricRows = rawData.companies.flatMap((company) => company.metricsAlignment)
    const alignmentRows = rawData.companies.flatMap((company) => company.disclosureAlignment)

    const metricFallbackCount = metricRows.reduce((count, row) => {
      const mapped = mapCsrdToEsg({
        csrdTheme: row.Theme,
        csrdTopic: row.Disclosure,
        csrdRequirementId: row['Requirement ID'],
      })

      return mapped.usedFallback ? count + 1 : count
    }, 0)

    const alignmentFallbackCount = alignmentRows.reduce((count, row) => {
      const mapped = mapCsrdToEsg({
        csrdTheme: row.Theme,
        csrdTopic: row.Disclosure,
        csrdRequirementId: row['Requirement ID'],
      })

      return mapped.usedFallback ? count + 1 : count
    }, 0)

    expect(metricFallbackCount + alignmentFallbackCount).toBe(0)
  })

  it('computes disclosure-based summary and topic KPI percentages', () => {
    const summary = computeSummary(model, baseFilters())

    expect(summary.totalDisclosuresCount).toBeGreaterThan(0)
    expect(summary.overallCompletedDisclosuresCount).toBeGreaterThanOrEqual(0)
    expect(summary.overallCompletedDisclosuresCount).toBeLessThanOrEqual(summary.totalDisclosuresCount)
    expect(summary.benchmarkAverageCompletedDisclosuresCount).toBeGreaterThanOrEqual(0)

    expect(summary.needsAttentionThemesPct).toBeGreaterThanOrEqual(0)
    expect(summary.needsAttentionThemesPct).toBeLessThanOrEqual(100)
    expect(summary.needsAttentionTopicsPct).toBeGreaterThanOrEqual(0)
    expect(summary.needsAttentionTopicsPct).toBeLessThanOrEqual(100)
    expect(summary.onParTopicsPct).toBeGreaterThanOrEqual(0)
    expect(summary.onParTopicsPct).toBeLessThanOrEqual(100)
    expect(summary.leadingThemesPct).toBeGreaterThanOrEqual(0)
    expect(summary.leadingThemesPct).toBeLessThanOrEqual(100)
    expect(summary.leadingTopicsPct).toBeGreaterThanOrEqual(0)
    expect(summary.leadingTopicsPct).toBeLessThanOrEqual(100)
    expect(summary.overallLeaderDots.length).toBeLessThanOrEqual(3)

    const topicPctTotal =
      summary.needsAttentionTopicsPct + summary.onParTopicsPct + summary.leadingTopicsPct
    expect(topicPctTotal).toBeCloseTo(100, 6)
    expect(summary.overallLeaderDots.every((leader) => leader.companyId !== 'MSFT')).toBe(true)
    if (summary.overallLeaderDots.length > 1) {
      expect(summary.overallLeaderDots[0].completedDisclosuresCount).toBeGreaterThanOrEqual(
        summary.overallLeaderDots[summary.overallLeaderDots.length - 1].completedDisclosuresCount,
      )
    }

    expect(['NEEDS_ATTENTION', 'ON_PAR', 'LEADING']).toContain(summary.overallState)
  })
})
