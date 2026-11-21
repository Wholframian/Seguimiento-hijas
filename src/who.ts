// Recomendaciones de la OMS por etapa y tablas de crecimiento para niñas.
// Son orientativas: ante cualquier duda manda siempre el criterio de vuestra pediatra.

export interface Source { label: string; url: string }

export const SOURCES = {
  sleep: { label: 'OMS (2019). Directrices sobre actividad física, sedentarismo y sueño para menores de 5 años', url: 'https://www.who.int/publications/i/item/9789241550536' },
  sleepAasm: { label: 'AASM / AAP (2016). Horas de sueño recomendadas en la infancia', url: 'https://jcsm.aasm.org/doi/10.5664/jcsm.5866' },
  breast: { label: 'OMS. Lactancia materna', url: 'https://www.who.int/health-topics/breastfeeding' },
  complementary: { label: 'OMS (2023). Guía de alimentación complementaria de 6 a 23 meses', url: 'https://www.who.int/publications/i/item/9789240081864' },
  growth: { label: 'OMS (2006). Patrones de crecimiento infantil', url: 'https://www.who.int/tools/child-growth-standards' },
} satisfies Record<string, Source>

export interface Stage {
  label: string
  /** Horas de sueño en 24 h (incluye siestas). */
  sleep: [number, number] | null
  sleepSource: Source
  feeds: string
  /** Número orientativo de tomas o comidas al día. */
  feedRange?: [number, number]
  feedSource: Source
  diapers?: string
  /** Pañales mojados mínimos al día. */
  wetMin?: number
}

export function ageInMonths(birth: string | null, at: Date = new Date()): number | null {
  if (!birth) return null
  const b = new Date(birth + 'T00:00:00')
  const days = (at.getTime() - b.getTime()) / 86400000
  return Math.max(0, days / 30.4375)
}

export function stageFor(months: number | null): Stage | null {
  if (months === null) return null
  if (months < 4) return {
    label: '0 a 3 meses',
    sleep: [14, 17], sleepSource: SOURCES.sleep,
    feeds: 'Lactancia materna exclusiva y a demanda, de día y de noche: al menos 8 tomas en 24 h.',
    feedRange: [8, 12], feedSource: SOURCES.breast,
    diapers: 'Al menos 6 pañales mojados al día a partir de la primera semana indican que come suficiente.',
    wetMin: 6,
  }
  if (months < 6) return {
    label: '4 a 5 meses',
    sleep: [12, 16], sleepSource: SOURCES.sleep,
    feeds: 'Lactancia materna exclusiva y a demanda hasta los 6 meses, sin agua ni otros alimentos.',
    feedSource: SOURCES.breast,
    diapers: 'Al menos 6 pañales mojados al día.',
    wetMin: 6,
  }
  if (months < 9) return {
    label: '6 a 8 meses',
    sleep: [12, 16], sleepSource: SOURCES.sleep,
    feeds: 'Seguir con el pecho a demanda y empezar la alimentación complementaria: 2 a 3 comidas al día.',
    feedRange: [2, 3], feedSource: SOURCES.complementary,
  }
  if (months < 12) return {
    label: '9 a 11 meses',
    sleep: [12, 16], sleepSource: SOURCES.sleep,
    feeds: 'Pecho a demanda más 3 a 4 comidas al día y 1 o 2 tentempiés.',
    feedRange: [3, 4], feedSource: SOURCES.complementary,
  }
  if (months < 24) return {
    label: '12 a 23 meses',
    sleep: [11, 14], sleepSource: SOURCES.sleep,
    feeds: 'Comida familiar variada: 3 a 4 comidas al día y 1 o 2 tentempiés. Seguir con el pecho hasta los 2 años o más.',
    feedRange: [3, 4], feedSource: SOURCES.complementary,
  }
  if (months < 36) return {
    label: '2 años',
    sleep: [11, 14], sleepSource: SOURCES.sleep,
    feeds: 'Comida familiar variada, sin azúcares ni sal añadidos. Se puede seguir con el pecho.',
    feedSource: SOURCES.complementary,
  }
  if (months < 60) return {
    label: '3 y 4 años',
    sleep: [10, 13], sleepSource: SOURCES.sleep,
    feeds: 'Comida familiar variada, con fruta y verdura a diario y pocos azúcares.',
    feedSource: SOURCES.complementary,
  }
  return {
    label: '5 años o más',
    sleep: months < 72 ? [10, 13] : [9, 12], sleepSource: SOURCES.sleepAasm,
    feeds: 'Comida familiar variada, con fruta y verdura a diario y pocos azúcares.',
    feedSource: SOURCES.complementary,
  }
}

// Tablas OMS para NIÑAS, valores aproximados de los percentiles 3, 50 y 97.
// [meses, p3, p50, p97]
type Row = [number, number, number, number]
const WEIGHT: Row[] = [
  [0, 2.4, 3.2, 4.2], [1, 3.2, 4.2, 5.4], [2, 3.9, 5.1, 6.5], [3, 4.5, 5.8, 7.4], [4, 5.0, 6.4, 8.1],
  [5, 5.4, 6.9, 8.7], [6, 5.7, 7.3, 9.2], [7, 6.0, 7.6, 9.6], [8, 6.3, 7.9, 10.0], [9, 6.5, 8.2, 10.4],
  [10, 6.7, 8.5, 10.7], [11, 6.9, 8.7, 11.0], [12, 7.0, 8.9, 11.3], [15, 7.6, 9.6, 12.2], [18, 8.1, 10.2, 13.0],
  [21, 8.6, 10.9, 13.9], [24, 9.0, 11.5, 14.8], [30, 10.0, 12.7, 16.5], [36, 10.8, 13.9, 18.1],
  [42, 11.6, 15.0, 19.8], [48, 12.3, 16.1, 21.5], [54, 13.0, 17.2, 23.2], [60, 13.7, 18.2, 24.9],
]
const HEIGHT: Row[] = [
  [0, 45.6, 49.1, 52.7], [1, 50.0, 53.7, 57.4], [2, 53.2, 57.1, 60.9], [3, 55.8, 59.8, 63.8], [4, 58.0, 62.1, 66.2],
  [5, 59.9, 64.0, 68.2], [6, 61.5, 65.7, 70.0], [7, 62.9, 67.3, 71.6], [8, 64.3, 68.7, 73.2], [9, 65.6, 70.1, 74.7],
  [10, 66.8, 71.5, 76.1], [11, 68.0, 72.8, 77.5], [12, 69.2, 74.0, 78.9], [15, 72.4, 77.5, 82.7], [18, 75.2, 80.7, 86.2],
  [21, 77.9, 83.7, 89.4], [24, 80.3, 86.4, 92.5], [30, 84.0, 90.7, 97.3], [36, 87.4, 95.1, 102.7],
  [42, 90.9, 99.0, 107.2], [48, 94.1, 102.7, 111.3], [54, 97.1, 106.2, 115.2], [60, 99.9, 109.4, 118.9],
]
const HEAD: Row[] = [
  [0, 31.7, 33.9, 36.1], [1, 34.3, 36.5, 38.8], [2, 36.0, 38.3, 40.5], [3, 37.2, 39.5, 41.9], [4, 38.2, 40.6, 43.0],
  [5, 39.0, 41.5, 43.9], [6, 39.7, 42.2, 44.6], [7, 40.4, 42.8, 45.3], [8, 40.9, 43.4, 45.9], [9, 41.3, 43.8, 46.3],
  [10, 41.7, 44.2, 46.8], [11, 42.0, 44.6, 47.1], [12, 42.3, 44.9, 47.5], [15, 43.0, 45.7, 48.3], [18, 43.6, 46.2, 48.9],
  [21, 44.1, 46.7, 49.4], [24, 44.6, 47.2, 49.8], [30, 45.3, 47.9, 50.6], [36, 45.8, 48.5, 51.2],
  [48, 46.6, 49.3, 52.1], [60, 47.2, 49.9, 52.7],
]

export type Metric = 'weight_kg' | 'height_cm' | 'head_cm'
export const GROWTH_TABLES: Record<Metric, Row[]> = { weight_kg: WEIGHT, height_cm: HEIGHT, head_cm: HEAD }
export const MAX_TABLE_MONTHS = 60

export interface Band { p3: number; p50: number; p97: number }

/** Percentiles 3, 50 y 97 a una edad concreta (interpolando entre filas). */
export function bandAt(metric: Metric, months: number): Band | null {
  const t = GROWTH_TABLES[metric]
  if (months < 0 || months > t[t.length - 1][0]) return null
  for (let i = 1; i < t.length; i++) {
    const [m1, ...a] = t[i - 1], [m2, ...b] = t[i]
    if (months <= m2) {
      const f = (months - m1) / (m2 - m1)
      const v = (k: number) => a[k] + (b[k] - a[k]) * f
      return { p3: v(0), p50: v(1), p97: v(2) }
    }
  }
  return null
}

export type Position = 'low' | 'ok' | 'high'
export function position(value: number, b: Band): Position {
  return value < b.p3 ? 'low' : value > b.p97 ? 'high' : 'ok'
}
