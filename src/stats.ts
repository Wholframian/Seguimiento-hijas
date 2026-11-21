import { minutesBetween } from './kinds'
import type { Entry } from './types'
import { addDays, startOfDay } from './util'

/** La noche va de NIGHT_START a NIGHT_END (horas locales). */
export const NIGHT_START = 20
export const NIGHT_END = 8

const H = 3600000

function overlap(a0: number, a1: number, b0: number, b1: number) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

/** Minutos de sueño dentro del día `day`, separados en noche y día. Cuenta el sueño en curso hasta ahora. */
export function sleepSplit(entries: Entry[], day: Date) {
  const d0 = startOfDay(day).getTime()
  const d1 = addDays(new Date(d0), 1).getTime()
  const nightA: [number, number] = [d0, d0 + NIGHT_END * H]
  const nightB: [number, number] = [d0 + NIGHT_START * H, d1]
  let total = 0, night = 0, naps = 0
  for (const e of entries) {
    if (e.kind !== 'sleep') continue
    const s = new Date(e.started_at).getTime()
    const en = e.ended_at ? new Date(e.ended_at).getTime() : Math.min(Date.now(), s + 16 * H)
    const t = overlap(s, en, d0, d1)
    if (!t) continue
    total += t
    night += overlap(s, en, ...nightA) + overlap(s, en, ...nightB)
    if (s >= d0 && s < d1 && overlap(s, en, d0 + NIGHT_END * H, d0 + NIGHT_START * H) > (en - s) / 2) naps++
  }
  const m = (ms: number) => Math.round(ms / 60000)
  return { total: m(total), night: m(night), day: m(total - night), naps }
}

export interface DayStats {
  sleep: number; night: number; daySleep: number; naps: number
  feeds: number; breast: number; bottle: number; solid: number; ml: number; breastMin: number
  diapers: number; poo: number; pee: number
  baths: number; maxTemp: number | null; meds: number; count: number
}

/** `all` debe incluir el día anterior para contar el sueño que empezó antes de medianoche. */
export function dayStats(all: Entry[], day: Date): DayStats {
  const d0 = startOfDay(day).getTime(), d1 = addDays(new Date(d0), 1).getTime()
  const inDay = all.filter((e) => { const t = new Date(e.started_at).getTime(); return t >= d0 && t < d1 })
  const sl = sleepSplit(all, day)
  const s: DayStats = {
    sleep: sl.total, night: sl.night, daySleep: sl.day, naps: sl.naps,
    feeds: 0, breast: 0, bottle: 0, solid: 0, ml: 0, breastMin: 0,
    diapers: 0, poo: 0, pee: 0, baths: 0, maxTemp: null, meds: 0, count: inDay.length,
  }
  for (const e of inDay) {
    const type = String(e.data?.type ?? '')
    if (e.kind === 'feed') {
      s.feeds++
      if (type.startsWith('breast')) { s.breast++; if (e.ended_at) s.breastMin += minutesBetween(e.started_at, e.ended_at) }
      else if (type === 'bottle') s.bottle++
      else if (type === 'solid') s.solid++
      if (e.data.amount_ml) s.ml += Number(e.data.amount_ml)
    }
    if (e.kind === 'diaper') {
      s.diapers++
      if (type === 'poo' || type === 'both') s.poo++
      if (type === 'pee' || type === 'both') s.pee++
    }
    if (e.kind === 'bath') s.baths++
    if (e.kind === 'medicine') s.meds++
    if (e.kind === 'temperature' && e.data.value) s.maxTemp = Math.max(s.maxTemp ?? 0, Number(e.data.value))
  }
  return s
}

/** Días (más reciente primero) entre `from` y hoy. */
export function daysBack(n: number): Date[] {
  const today = startOfDay(new Date())
  return Array.from({ length: n }, (_, i) => addDays(today, -i))
}

export function avg(xs: number[]) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0 }
