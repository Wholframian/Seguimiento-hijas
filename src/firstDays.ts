// Guía de los primeros días (0 a 6 semanas): pises, cacas y tomas.
// Basada en la hoja «Pises y cacas» de la matrona (fuentes al final).
// Son mínimos orientativos para bebés con lactancia materna: ante cualquier duda, matrona o pediatra.

import type { DayStats } from './stats'

/** Hasta qué día de vida se muestra la guía (6 semanas). */
export const FIRST_DAYS_MAX = 42

export interface DayGoal {
  label: string
  pee: number
  /** Cacas mínimas; null cuando ya es normal que haga menos. */
  poo: number | null
  pooText: string
  /** Cómo se espera que sea la caca esos días. */
  pooLooks: string
  feeds: number
}

/** Día de vida: el día del nacimiento es el día 1. */
export function dayOfLife(birth: string | null, at: Date): number | null {
  if (!birth) return null
  const b = new Date(birth + 'T00:00:00')
  const d = new Date(at); d.setHours(0, 0, 0, 0)
  const n = Math.round((d.getTime() - b.getTime()) / 86400000) + 1
  return n >= 1 ? n : null
}

export function goalFor(day: number): DayGoal {
  const feeds = 8
  if (day === 1) return { label: 'Día 1', pee: 1, poo: 1, pooText: '1 o más', pooLooks: 'Negra y pegajosa (meconio)', feeds }
  if (day === 2) return { label: 'Día 2', pee: 2, poo: 1, pooText: '1 o 2', pooLooks: 'Negra-verdosa (meconio)', feeds }
  if (day === 3) return { label: 'Día 3', pee: 3, poo: 2, pooText: '2 o 3', pooLooks: 'Verde oscuro (transición)', feeds }
  if (day === 4) return { label: 'Día 4', pee: 6, poo: 3, pooText: '3 o más', pooLooks: 'Verde que pasa a amarilla', feeds }
  if (day <= 6) return { label: `Día ${day}`, pee: 6, poo: 3, pooText: '3 o más', pooLooks: 'Amarilla con grumitos', feeds }
  if (day <= 14) return { label: `Día ${day}`, pee: 6, poo: 3, pooText: '3-4 o más', pooLooks: 'Amarillo mostaza, líquida y con grumos', feeds }
  return {
    label: `Semana ${Math.ceil(day / 7)}`, pee: 6, poo: null,
    pooText: 'pueden ser menos',
    pooLooks: 'Desde las 3-6 semanas muchos bebés hacen menos cacas, incluso pasan varios días sin hacer. Si está bien, come con ganas y gana peso, es normal.',
    feeds,
  }
}

/** Tabla «lo normal, día a día» para mostrar en la guía. */
export const GOAL_TABLE: { day: string; pee: string; poo: string; looks: string }[] = [
  { day: 'Día 1', pee: '1', poo: '1 o más', looks: 'Negra y pegajosa (meconio)' },
  { day: 'Día 2', pee: '2', poo: '1 o 2', looks: 'Negra-verdosa (meconio)' },
  { day: 'Día 3', pee: '3', poo: '2 o 3', looks: 'Verde oscuro (transición)' },
  { day: 'Día 4', pee: '6 a 8', poo: '3 o más', looks: 'Verde que pasa a amarilla' },
  { day: 'Días 5 y 6', pee: '6 a 8', poo: '3 o más', looks: 'Amarilla con grumitos' },
  { day: 'Día 7 al mes', pee: '6 a 8', poo: '3-4 o más', looks: 'Amarillo mostaza, líquida y con grumos' },
]

export type PooColor = 'black' | 'dark_green' | 'yellow' | 'light' | 'pale'

export const POO_COLORS: Record<PooColor, { label: string; swatch: string; hint: string; alert?: boolean }> = {
  black: { label: 'Negra', swatch: '#2b2622', hint: 'Meconio, normal solo los 2 primeros días' },
  dark_green: { label: 'Verde oscuro', swatch: '#4f5a2a', hint: 'Transición, días 3-4' },
  yellow: { label: 'Amarilla', swatch: '#e0b02e', hint: 'Con grumitos, lo típico con pecho desde el día 4-5' },
  light: { label: 'Verde o marrón claro', swatch: '#a8954a', hint: 'A veces, también normal' },
  pale: { label: 'Blanca o gris', swatch: '#d9d4c7', hint: 'Color masilla: consulta ese mismo día', alert: true },
}

export const ALERT_SIGNS = [
  'Desde el día 4 moja menos de 6 pañales al día o el pis es oscuro.',
  'Ves manchas naranjas en el pañal a partir del día 4.',
  'En el día 5 las cacas siguen negras o verde oscuro.',
  'Hace menos de 3 cacas al día, o pasa un día entero sin caca, en las 2 primeras semanas.',
  'Las cacas son blancas o grises, tienen sangre o son duras.',
  'Está muy dormida, cuesta despertarla o hace menos de 8 tomas al día.',
  'Su piel o sus ojos están cada vez más amarillos.',
  'Sigue perdiendo peso tras el día 5 o no recupera el peso de nacimiento a los 10-14 días.',
]

export const EMERGENCY = 'Urgencias si tiene fiebre (38 °C o más), no moja ningún pañal en 6-8 horas, tiene los labios muy secos o está muy decaída.'

export const POO_SIZE_HINT = 'Cuenta como caca la mancha más grande que el círculo que haces al juntar los dedos pulgar e índice.'

export const PEE_HINT = 'Normal: transparente o amarillo muy clarito. Las manchas naranjas o color teja (cristales de urato) pueden ser normales los primeros 3 días; a partir del día 4 son una alerta, igual que el pis oscuro.'

export const FIRST_DAYS_SOURCES = [
  { label: 'Asociación Española de Pediatría, En Familia: «Lactancia materna, ¿el bebé se está alimentando bien?» y «Cacas de los bebés»', url: 'https://enfamilia.aeped.es' },
  { label: 'Comunidad de Madrid: Lactancia materna', url: 'https://www.comunidad.madrid/salud/lactancia-materna' },
  { label: 'Familia y Salud (AEPap): «Mi bebé tiene manchas naranjas en el pañal»', url: 'https://www.familiaysalud.es' },
  { label: 'AAP HealthyChildren.org: «Signos de advertencia de problemas con la lactancia»', url: 'https://www.healthychildren.org/Spanish' },
]

/** Datos de un pañal que importan para las alertas. */
export interface DiaperFlags { colors: PooColor[]; blood: boolean; hard: boolean; darkPee: boolean }

/** Avisos concretos para un día ya registrado, según lo que dice la guía. */
export function dayAlerts(day: number, s: DayStats, flags: DiaperFlags, partial: boolean, maxTemp: number | null): string[] {
  const out: string[] = []
  const g = goalFor(day)
  if (flags.colors.includes('pale')) out.push('Caca blanca, gris o color masilla: consulta hoy mismo.')
  if (flags.blood) out.push('Caca con sangre: llama a la matrona o pediatra.')
  if (flags.hard) out.push('Caca dura o en bolitas: coméntalo con la matrona o pediatra.')
  if (flags.darkPee && day >= 4) out.push('Pis oscuro o manchas naranjas a partir del día 4: llama a la matrona o pediatra.')
  if (day >= 5 && (flags.colors.includes('black') || flags.colors.includes('dark_green'))) out.push('En el día 5 o después las cacas siguen negras o verde oscuro.')
  if (!partial) {
    if (day >= 4 && s.pee < 6) out.push(`Solo ${s.pee} ${s.pee === 1 ? 'pañal mojado' : 'pañales mojados'} (desde el día 4 deberían ser 6 o más).`)
    if (day <= 14 && g.poo !== null && s.poo < g.poo) out.push(s.poo === 0 ? 'Un día entero sin caca en las 2 primeras semanas.' : `Solo ${s.poo} ${s.poo === 1 ? 'caca' : 'cacas'} (objetivo: ${g.pooText}).`)
    if (s.feeds < g.feeds) out.push(`Solo ${s.feeds} ${s.feeds === 1 ? 'toma' : 'tomas'} (deberían ser al menos 8).`)
  }
  if (maxTemp !== null && maxTemp >= 38) out.push(`Fiebre de ${maxTemp.toFixed(1)} °C: ve a urgencias.`)
  return out
}
