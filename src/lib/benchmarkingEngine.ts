import type {
  BenchmarkFilters,
  BenchmarkSummary,
  DisclosureOutlierRow,
  RankState,
  ThemeOutlierRow,
} from '../types/benchmarking'
import { mapCsrdToEsg } from './esgMapping'

type RawMetricRow = {
  Framework: string
  'Theme ID': string
  Theme: string
  'Requirement ID': string
  Disclosure: string
  Status: string
}

type RawDisclosureAlignmentRow = {
  Framework: string
  Theme: string
  'Requirement ID': string
  Disclosure: string
  Recommendation: string
}

type RawPeerList = {
  id: string
  name: string
  companyIds: string[]
}

type RawCompany = {
  companyId: string
  companyName: string
  sector: string
  marketCap: string
  region: string
  metricsAlignment: RawMetricRow[]
  disclosureAlignment: RawDisclosureAlignmentRow[]
}

type RawBenchmarkData = {
  framework: string
  currentCompanyId: string
  peerLists: RawPeerList[]
  regionUniverse?: string[]
  companies: RawCompany[]
}

interface DisclosureAggregate {
  key: string
  themeId: string
  theme: string
  requirementId: string
  disclosure: string
  complete: number
  incomplete: number
  total: number
  rate: number
  recommendation?: string
}

interface DisclosureAggregateDraft {
  key: string
  themeId: string
  theme: string
  requirementIds: string[]
  disclosure: string
  complete: number
  incomplete: number
  total: number
  recommendation?: string
}

interface ThemeAggregate {
  themeId: string
  theme: string
  complete: number
  incomplete: number
  total: number
  rate: number
}

interface CompanyModel {
  companyId: string
  companyName: string
  sector: string
  marketCap: string
  region: string
  disclosures: DisclosureAggregate[]
  disclosureByKey: Map<string, DisclosureAggregate>
  themes: ThemeAggregate[]
  themeById: Map<string, ThemeAggregate>
  overallRate: number
  completedDisclosuresCount: number
}

export interface BenchmarkModel {
  framework: string
  currentCompanyId: string
  activePeerListId: string | null
  peerLists: RawPeerList[]
  companies: CompanyModel[]
  companyById: Map<string, CompanyModel>
}

const COMPLETE = 'Complete'
const INCOMPLETE = 'Incomplete'
const EPSILON = 1e-9

function disclosureKey(
  framework: string,
  theme: string,
  disclosure: string,
): string {
  return [framework, theme, disclosure].join('|')
}

function sortDisclosureAlignmentRows(
  rows: RawDisclosureAlignmentRow[],
): RawDisclosureAlignmentRow[] {
  return [...rows].sort(
    (left, right) =>
      left.Framework.localeCompare(right.Framework) ||
      left.Theme.localeCompare(right.Theme) ||
      left.Disclosure.localeCompare(right.Disclosure) ||
      left['Requirement ID'].localeCompare(right['Requirement ID']) ||
      left.Recommendation.localeCompare(right.Recommendation),
  )
}

function parseStatus(rawStatus: string): 'complete' | 'incomplete' | 'ignore' {
  if (rawStatus === COMPLETE) {
    return 'complete'
  }

  if (rawStatus === INCOMPLETE) {
    return 'incomplete'
  }

  return 'ignore'
}

function calculateCompletionRate(complete: number, incomplete: number): number {
  const denominator = complete + incomplete
  if (denominator === 0) {
    return 0
  }

  return complete / denominator
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  const total = values.reduce((sum, value) => sum + value, 0)
  return total / values.length
}

function isEffectivelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < EPSILON
}

export function classifyState(delta: number): RankState {
  if (Math.abs(delta) < EPSILON) {
    return 'ON_PAR'
  }

  if (delta < 0) {
    return 'NEEDS_ATTENTION'
  }

  return 'LEADING'
}

function buildCompanyModel(rawCompany: RawCompany, framework: string): CompanyModel {
  const recommendationByKey = new Map<string, string>()

  for (const row of sortDisclosureAlignmentRows(rawCompany.disclosureAlignment)) {
    if (row.Framework !== framework) {
      continue
    }

    const mapped = mapCsrdToEsg({
      csrdTheme: row.Theme,
      csrdTopic: row.Disclosure,
      csrdRequirementId: row['Requirement ID'],
    })
    const key = disclosureKey(row.Framework, mapped.mappedTheme, mapped.mappedMetric)
    const recommendation = row.Recommendation.trim()

    if (recommendation.length > 0 && !recommendationByKey.has(key)) {
      recommendationByKey.set(key, recommendation)
    }
  }

  const disclosureMap = new Map<string, DisclosureAggregateDraft>()

  for (const metricRow of rawCompany.metricsAlignment) {
    if (metricRow.Framework !== framework) {
      continue
    }

    const mapped = mapCsrdToEsg({
      csrdTheme: metricRow.Theme,
      csrdTopic: metricRow.Disclosure,
      csrdRequirementId: metricRow['Requirement ID'],
    })
    const key = disclosureKey(metricRow.Framework, mapped.mappedTheme, mapped.mappedMetric)

    const existing = disclosureMap.get(key)
    const aggregate: DisclosureAggregateDraft =
      existing ?? {
        key,
        themeId: mapped.mappedTheme,
        theme: mapped.mappedTheme,
        requirementIds: [],
        disclosure: mapped.mappedMetric,
        complete: 0,
        incomplete: 0,
        total: 0,
        recommendation: recommendationByKey.get(key),
      }

    if (!aggregate.requirementIds.includes(metricRow['Requirement ID'])) {
      aggregate.requirementIds.push(metricRow['Requirement ID'])
    }

    const status = parseStatus(metricRow.Status)

    if (status === 'complete') {
      aggregate.complete += 1
      aggregate.total += 1
    } else if (status === 'incomplete') {
      aggregate.incomplete += 1
      aggregate.total += 1
    }

    disclosureMap.set(key, aggregate)
  }

  const disclosures = [...disclosureMap.values()]
    .map((item): DisclosureAggregate => {
      const sortedRequirementIds = [...item.requirementIds].sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true }),
      )

      return {
        key: item.key,
        themeId: item.themeId,
        theme: item.theme,
        requirementId: sortedRequirementIds.join(', '),
        disclosure: item.disclosure,
        complete: item.complete,
        incomplete: item.incomplete,
        total: item.total,
        rate: calculateCompletionRate(item.complete, item.incomplete),
        recommendation: item.recommendation,
      }
    })
    .filter((item) => item.total > 0)

  const themeById = new Map<string, ThemeAggregate>()

  for (const disclosure of disclosures) {
    const existing = themeById.get(disclosure.themeId)

    if (existing) {
      existing.complete += disclosure.complete
      existing.incomplete += disclosure.incomplete
      existing.total += disclosure.total
      existing.rate = calculateCompletionRate(existing.complete, existing.incomplete)
      continue
    }

    themeById.set(disclosure.themeId, {
      themeId: disclosure.themeId,
      theme: disclosure.theme,
      complete: disclosure.complete,
      incomplete: disclosure.incomplete,
      total: disclosure.total,
      rate: calculateCompletionRate(disclosure.complete, disclosure.incomplete),
    })
  }

  const themes = [...themeById.values()]
  const totalCompleteMetrics = themes.reduce((sum, theme) => sum + theme.complete, 0)
  const totalIncompleteMetrics = themes.reduce((sum, theme) => sum + theme.incomplete, 0)
  const completedDisclosuresCount = disclosures.filter((item) => isEffectivelyEqual(item.rate, 1)).length

  return {
    companyId: rawCompany.companyId,
    companyName: rawCompany.companyName,
    sector: rawCompany.sector,
    marketCap: rawCompany.marketCap,
    region: rawCompany.region,
    disclosures,
    disclosureByKey: new Map(disclosures.map((item) => [item.key, item])),
    themes,
    themeById,
    overallRate: calculateCompletionRate(totalCompleteMetrics, totalIncompleteMetrics),
    completedDisclosuresCount,
  }
}

export function buildBenchmarkModel(rawData: RawBenchmarkData): BenchmarkModel {
  const companies = rawData.companies.map((company) =>
    buildCompanyModel(company, rawData.framework),
  )

  return {
    framework: rawData.framework,
    currentCompanyId: rawData.currentCompanyId,
    activePeerListId: rawData.peerLists[0]?.id ?? null,
    peerLists: rawData.peerLists,
    companies,
    companyById: new Map(companies.map((company) => [company.companyId, company])),
  }
}

export function resolveCohortCompanyIds(
  model: BenchmarkModel,
  filters: BenchmarkFilters,
): string[] {
  const current = model.companyById.get(filters.companyId)
  if (!current) {
    return []
  }

  let companyIds: string[] = []

  if (filters.benchmarkMode === 'my_peers') {
    const peerList = model.peerLists.find((item) => item.id === model.activePeerListId)
    companyIds = peerList ? peerList.companyIds : []
  } else if (filters.benchmarkMode === 'my_sector') {
    companyIds = model.companies
      .filter((company) => company.sector === current.sector)
      .map((company) => company.companyId)
  } else if (filters.benchmarkMode === 'my_region') {
    companyIds = model.companies
      .filter((company) => company.region === current.region)
      .map((company) => company.companyId)
  } else {
    companyIds = model.companies
      .filter((company) => company.marketCap === current.marketCap)
      .map((company) => company.companyId)
  }

  const unique = [...new Set(companyIds)].filter(
    (companyId) => companyId !== filters.companyId && model.companyById.has(companyId),
  )

  if (unique.length > 0) {
    return unique
  }

  return model.companies
    .map((company) => company.companyId)
    .filter((companyId) => companyId !== filters.companyId)
}

function readThemeRate(company: CompanyModel, themeId: string): number {
  return company.themeById.get(themeId)?.rate ?? 0
}

function readDisclosureRate(company: CompanyModel, key: string): number {
  return company.disclosureByKey.get(key)?.rate ?? 0
}

function sortByGapAscending<T extends { gapPts: number }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => left.gapPts - right.gapPts)
}

export function computeThemeOutliers(
  model: BenchmarkModel,
  filters: BenchmarkFilters,
): ThemeOutlierRow[] {
  const current = model.companyById.get(filters.companyId)
  if (!current) {
    return []
  }

  const cohortIds = resolveCohortCompanyIds(model, filters)
  const cohort = cohortIds
    .map((companyId) => model.companyById.get(companyId))
    .filter((company): company is CompanyModel => Boolean(company))

  const rows: ThemeOutlierRow[] = current.themes.map((theme) => {
    const benchmarkAverageRate = mean(cohort.map((company) => readThemeRate(company, theme.themeId)))
    const gapPts = (theme.rate - benchmarkAverageRate) * 100

    return {
      themeId: theme.themeId,
      theme: theme.theme,
      companyRate: theme.rate,
      benchmarkAverageRate,
      gapPts,
      state: classifyState(gapPts),
    }
  })

  return sortByGapAscending(rows)
}

export function computeDisclosureOutliers(
  model: BenchmarkModel,
  filters: BenchmarkFilters,
): DisclosureOutlierRow[] {
  const current = model.companyById.get(filters.companyId)
  if (!current) {
    return []
  }

  const cohortIds = resolveCohortCompanyIds(model, filters)
  const cohort = cohortIds
    .map((companyId) => model.companyById.get(companyId))
    .filter((company): company is CompanyModel => Boolean(company))

  const rows: DisclosureOutlierRow[] = current.disclosures.map((disclosure) => {
    const benchmarkAverageRate = mean(cohort.map((company) => readDisclosureRate(company, disclosure.key)))
    const gapPts = (disclosure.rate - benchmarkAverageRate) * 100

    return {
      theme: disclosure.theme,
      requirementId: disclosure.requirementId,
      disclosure: disclosure.disclosure,
      companyRate: disclosure.rate,
      benchmarkAverageRate,
      gapPts,
      state: classifyState(gapPts),
      recommendation: disclosure.recommendation,
    }
  })

  return sortByGapAscending(rows)
}

function percentageByState<T extends { state: RankState }>(rows: T[], state: RankState): number {
  if (rows.length === 0) {
    return 0
  }

  const matchCount = rows.filter((row) => row.state === state).length
  return (matchCount / rows.length) * 100
}

export function computeSummary(
  model: BenchmarkModel,
  filters: BenchmarkFilters,
): BenchmarkSummary {
  const current = model.companyById.get(filters.companyId)
  if (!current) {
    return {
      totalDisclosuresCount: 0,
      overallCompletedDisclosuresCount: 0,
      benchmarkAverageCompletedDisclosuresCount: 0,
      overallLeaderDots: [],
      overallState: 'ON_PAR',
      needsAttentionThemesPct: 0,
      needsAttentionTopicsPct: 0,
      onParTopicsPct: 0,
      leadingThemesPct: 0,
      leadingTopicsPct: 0,
    }
  }

  const cohortIds = resolveCohortCompanyIds(model, filters)
  const cohort = cohortIds
    .map((companyId) => model.companyById.get(companyId))
    .filter((company): company is CompanyModel => Boolean(company))

  const themeRows = computeThemeOutliers(model, filters)
  const disclosureRows = computeDisclosureOutliers(model, filters)

  const benchmarkAverageCompletedDisclosuresCount = mean(
    cohort.map((company) => company.completedDisclosuresCount),
  )
  const overallLeaderDots = [...cohort]
    .sort(
      (left, right) =>
        right.completedDisclosuresCount - left.completedDisclosuresCount ||
        left.companyName.localeCompare(right.companyName),
    )
    .slice(0, 3)
    .map((company) => ({
      companyId: company.companyId,
      companyName: company.companyName,
      completedDisclosuresCount: company.completedDisclosuresCount,
    }))

  return {
    totalDisclosuresCount: current.disclosures.length,
    overallCompletedDisclosuresCount: current.completedDisclosuresCount,
    benchmarkAverageCompletedDisclosuresCount,
    overallLeaderDots,
    overallState: classifyState(
      current.completedDisclosuresCount - benchmarkAverageCompletedDisclosuresCount,
    ),
    needsAttentionThemesPct: percentageByState(themeRows, 'NEEDS_ATTENTION'),
    needsAttentionTopicsPct: percentageByState(disclosureRows, 'NEEDS_ATTENTION'),
    onParTopicsPct: percentageByState(disclosureRows, 'ON_PAR'),
    leadingThemesPct: percentageByState(themeRows, 'LEADING'),
    leadingTopicsPct: percentageByState(disclosureRows, 'LEADING'),
  }
}
