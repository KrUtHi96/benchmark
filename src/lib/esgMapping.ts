import mappingRows from '../data/esg-metrics-mapping.json'

export interface EsgMetricMappingRow {
  csrdTheme: string
  csrdTopic: string
  csrdRequirementId: string
  mappedTheme: string
  mappedMetric: string
}

export interface MapCsrdToEsgInput {
  csrdTheme: string
  csrdTopic: string
  csrdRequirementId: string
}

export interface MappedTaxonomy {
  mappedTheme: string
  mappedMetric: string
  usedFallback: boolean
}

function normalize(value: string): string {
  return value.trim()
}

export function createCsrdMappingKey(input: MapCsrdToEsgInput): string {
  return [normalize(input.csrdTheme), normalize(input.csrdTopic), normalize(input.csrdRequirementId)]
    .join('|')
}

export function createEsgMappingIndex(
  rows: EsgMetricMappingRow[],
): Map<string, Pick<MappedTaxonomy, 'mappedTheme' | 'mappedMetric'>> {
  const index = new Map<string, Pick<MappedTaxonomy, 'mappedTheme' | 'mappedMetric'>>()

  for (const row of rows) {
    const key = createCsrdMappingKey({
      csrdTheme: row.csrdTheme,
      csrdTopic: row.csrdTopic,
      csrdRequirementId: row.csrdRequirementId,
    })

    if (!index.has(key)) {
      index.set(key, {
        mappedTheme: normalize(row.mappedTheme),
        mappedMetric: normalize(row.mappedMetric),
      })
    }
  }

  return index
}

const esgMappingIndex = createEsgMappingIndex(mappingRows as EsgMetricMappingRow[])

export function mapCsrdToEsg(input: MapCsrdToEsgInput): MappedTaxonomy {
  const key = createCsrdMappingKey(input)
  const mapped = esgMappingIndex.get(key)

  if (mapped) {
    return {
      mappedTheme: mapped.mappedTheme,
      mappedMetric: mapped.mappedMetric,
      usedFallback: false,
    }
  }

  return {
    mappedTheme: normalize(input.csrdTheme),
    mappedMetric: normalize(input.csrdTopic),
    usedFallback: true,
  }
}
