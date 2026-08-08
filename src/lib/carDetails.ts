const WFS_BASE = 'https://geoserver.car.gov.br/geoserver/sicar/wfs'
const REQUEST_TIMEOUT_MS = 15000

const CONDICAO_LABELS: Record<string, string> = {
  AT: 'Ativo',
  PE: 'Pendente',
  CA: 'Cancelado',
  AN: 'Aguardando análise',
}

const TIPO_LABELS: Record<string, string> = {
  IRU: 'Imóvel rural',
  AST: 'Assentamento',
  PCT: 'Comunidade tradicional',
}

const STATUS_LABELS: Record<string, string> = {
  AT: 'Ativo',
  SU: 'Suspenso',
  CA: 'Cancelado',
}

export interface CarDetailProperties {
  area?: number | string | null
  cod_imovel?: string | null
  cod_municipio_ibge?: number | string | null
  condicao?: string | null
  data_atualizacao?: string | null
  dat_criacao?: string | null
  m_fiscal?: number | string | null
  municipio?: string | null
  status_imovel?: string | null
  tipo_imovel?: string | null
  uf?: string | null
  [key: string]: unknown
}

export type CarDetailResult =
  | { state: 'success'; data: CarDetailProperties }
  | { state: 'not-found' }
  | { state: 'error'; error: string }

export interface CarDetailRow {
  label: string
  value: string
}

export function normalizeCarCode(codImovel: string): string {
  return String(codImovel || '').trim().toUpperCase()
}

export function ufFromCodImovel(codImovel: string): string | null {
  const match = /^([A-Z]{2})-/.exec(normalizeCarCode(codImovel))
  return match ? match[1].toLowerCase() : null
}

export function buildCarDetailWfsUrl(codImovel: string): string | null {
  const normalized = normalizeCarCode(codImovel)
  const uf = ufFromCodImovel(normalized)
  if (!uf) return null

  const url = new URL(WFS_BASE)
  url.searchParams.set('service', 'WFS')
  url.searchParams.set('version', '2.0.0')
  url.searchParams.set('request', 'GetFeature')
  url.searchParams.set('typeNames', `sicar:sicar_imoveis_${uf}`)
  url.searchParams.set('CQL_FILTER', `cod_imovel='${normalized.replace(/'/gu, "''")}'`)
  url.searchParams.set('outputFormat', 'application/json')
  url.searchParams.set('srsName', 'EPSG:4326')
  return url.toString()
}

export async function fetchCarDetail(codImovel: string): Promise<CarDetailResult> {
  const url = buildCarDetailWfsUrl(codImovel)
  if (!url) return { state: 'error', error: 'Código CAR inválido.' }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return { state: 'error', error: `HTTP ${response.status}` }

    const data = await response.json()
    const feature = Array.isArray(data?.features) ? data.features[0] : null
    if (!feature?.properties) return { state: 'not-found' }
    return { state: 'success', data: feature.properties }
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      return { state: 'error', error: 'Tempo limite excedido.' }
    }
    return { state: 'error', error: (err as Error)?.message || 'Erro de rede.' }
  } finally {
    clearTimeout(timeoutId)
  }
}

function formatHectares(value: unknown): string | null {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return `${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ha`
}

function formatNumber(value: unknown): string | null {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })
}

function formatDate(value: unknown): string | null {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('pt-BR', { dateStyle: 'short' })
}

function formatText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

function lookupLabel(labels: Record<string, string>, value: unknown): string | null {
  const text = formatText(value)
  if (!text) return null
  return labels[text.toUpperCase()] || text
}

function appendRow(rows: CarDetailRow[], label: string, value: string | null): void {
  if (!value) return
  rows.push({ label, value })
}

export function formatCarDetailRows(props: CarDetailProperties): CarDetailRow[] {
  const municipio = formatText(props.municipio)
  const uf = formatText(props.uf)?.toUpperCase()
  const location = [municipio, uf].filter(Boolean).join(' / ')

  const rows: CarDetailRow[] = []
  appendRow(rows, 'Status', lookupLabel(STATUS_LABELS, props.status_imovel))
  appendRow(rows, 'Condição', lookupLabel(CONDICAO_LABELS, props.condicao))
  appendRow(rows, 'Tipo', lookupLabel(TIPO_LABELS, props.tipo_imovel))
  appendRow(rows, 'Área SICAR', formatHectares(props.area))
  appendRow(rows, 'Módulos fiscais', formatNumber(props.m_fiscal))
  appendRow(rows, 'Localização', location || null)
  appendRow(rows, 'Código IBGE', formatText(props.cod_municipio_ibge))
  appendRow(rows, 'Criado', formatDate(props.dat_criacao))
  appendRow(rows, 'Atualizado', formatDate(props.data_atualizacao))
  return rows
}
