export type BenchmarkMode = 'my_peers' | 'my_sector' | 'my_market_cap' | 'my_region'

export type CompletionRate = number

export type RankState = 'NEEDS_ATTENTION' | 'ON_PAR' | 'LEADING'

export interface BenchmarkFilters {
  framework: 'CSRD'
  companyId: string
  benchmarkMode: BenchmarkMode
}

export interface BenchmarkSummary {
  totalDisclosuresCount: number
  overallCompletedDisclosuresCount: number
  benchmarkAverageCompletedDisclosuresCount: number
  overallLeaderDots: OverallLeaderDot[]
  overallState: RankState
  needsAttentionThemesPct: number
  needsAttentionTopicsPct: number
  onParTopicsPct: number
  leadingThemesPct: number
  leadingTopicsPct: number
}

export interface OverallLeaderDot {
  companyId: string
  companyName: string
  completedDisclosuresCount: number
}

export interface ThemeOutlierRow {
  themeId: string
  theme: string
  companyRate: CompletionRate
  benchmarkAverageRate: CompletionRate
  gapPts: number
  state: RankState
}

export interface DisclosureOutlierRow {
  theme: string
  requirementId: string
  disclosure: string
  companyRate: CompletionRate
  benchmarkAverageRate: CompletionRate
  gapPts: number
  state: RankState
  recommendation?: string
}

export interface BenchmarkingDataProvider {
  getSummary(filters: BenchmarkFilters): Promise<BenchmarkSummary>
  getThemeOutliers(filters: BenchmarkFilters): Promise<ThemeOutlierRow[]>
  getDisclosureOutliers(filters: BenchmarkFilters): Promise<DisclosureOutlierRow[]>
}

export interface BenchmarkingUiProvider extends BenchmarkingDataProvider {
  getCurrentCompany(): CompanyMeta
}

export interface CompanyMeta {
  companyId: string
  companyName: string
  sector: string
  marketCap: string
  region: string
}
