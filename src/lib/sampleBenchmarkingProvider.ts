import rawData from '../data/benchmark-sample-data.json'
import {
  buildBenchmarkModel,
  computeDisclosureOutliers,
  computeSummary,
  computeThemeOutliers,
} from './benchmarkingEngine'
import type {
  BenchmarkFilters,
  BenchmarkSummary,
  BenchmarkingUiProvider,
  CompanyMeta,
  DisclosureOutlierRow,
  ThemeOutlierRow,
} from '../types/benchmarking'

const model = buildBenchmarkModel(rawData)

class SampleBenchmarkingProvider implements BenchmarkingUiProvider {
  async getSummary(filters: BenchmarkFilters): Promise<BenchmarkSummary> {
    return computeSummary(model, filters)
  }

  async getThemeOutliers(filters: BenchmarkFilters): Promise<ThemeOutlierRow[]> {
    return computeThemeOutliers(model, filters)
  }

  async getDisclosureOutliers(filters: BenchmarkFilters): Promise<DisclosureOutlierRow[]> {
    return computeDisclosureOutliers(model, filters)
  }

  getCurrentCompany(): CompanyMeta {
    const current = model.companyById.get(model.currentCompanyId)

    if (!current) {
      throw new Error('Current company is missing in sample data.')
    }

    return {
      companyId: current.companyId,
      companyName: current.companyName,
      sector: current.sector,
      marketCap: current.marketCap,
      region: current.region,
    }
  }
}

export const sampleBenchmarkingProvider = new SampleBenchmarkingProvider()
