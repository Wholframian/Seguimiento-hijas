import type { ReactNode } from 'react'
import type { Entry, Kind } from './types'

/** Icono de pañal (no existe emoji de pañal). Se dibuja al tamaño del texto, como un emoji. */
function DiaperIcon() {
  return (
    <svg viewBox="1 3.5 22 17" width="1.3em" height="1em" style={{ verticalAlign: '-0.15em' }} aria-label="Pañal" role="img">
      <path d="M3 6.5h18v3c0 1.8-2.6 3.2-4.6 6-1.2 1.7-2.4 3.3-4.4 3.3s-3.2-1.6-4.4-3.3C5.6 12.7 3 11.3 3 9.5z" fill="#fff" stroke="#5f7f9f" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M3 6.5h18v2.6H3z" fill="#cfe3f5" stroke="#5f7f9f" strokeWidth="1.2" strokeLinejoin="round" />
      <rect x="1.6" y="9.6" width="3.4" height="2.6" rx=".9" fill="#f4a3b4" stroke="#5f7f9f" strokeWidth=".8" />
      <rect x="19" y="9.6" width="3.4" height="2.6" rx=".9" fill="#f4a3b4" stroke="#5f7f9f" strokeWidth=".8" />
      <path d="M7.4 11.6c1 2.3 2.3 4.3 4.6 4.3s3.6-2 4.6-4.3" fill="none" stroke="#9fb7cf" strokeWidth="1" strokeLinecap="round" strokeDasharray="1.4 1.2" />
    </svg>
  )
}

export interface KindInfo {
  label: string
  icon: ReactNode
  color: string
  /** Tiene inicio y fin (cronómetro). */
  timed?: boolean
}

export const KINDS: Record<Kind, KindInfo> = {
  feed: { label: 'Toma', icon: '🍼', color: '#f4a261', timed: true },
  sleep: { label: 'Sueño', icon: '🌙', color: '#7b8cde', timed: true },
  diaper: { label: 'Pañal', icon: <DiaperIcon />, color: '#8ab17d' },
  bath: { label: 'Baño', icon: '🛁', color: '#4cc9d0' },
  temperature: { label: 'Temperatura', icon: '🌡️', color: '#e76f51' },
  medicine: { label: 'Medicina', icon: '💊', color: '#c77dff' },
  health: { label: 'Salud', icon: '🩺', color: '#ef476f' },
  growth: { label: 'Crecimiento', icon: '📏', color: '#2a9d8f' },
  note: { label: 'Nota', icon: '📝', color: '#b08968' },
}

export const KIND_ORDER: Kind[] = ['feed', 'sleep', 'diaper', 'bath', 'temperature', 'medicine', 'health', 'growth', 'note']

export const FEED_TYPES: Record<string, string> = {
  breast_left: 'Pecho izquierdo',
  breast_right: 'Pecho derecho',
  bottle: 'Biberón',
  solid: 'Sólidos',
}

export const DIAPER_TYPES: Record<string, string> = {
  pee: 'Pis',
  poo: 'Caca',
  both: 'Pis y caca',
  dry: 'Seco',
}

export const HEALTH_TYPES: Record<string, string> = {
  symptom: 'Síntoma',
  vaccine: 'Vacuna',
  doctor: 'Cita médica',
  other: 'Otro',
}

export const TEMP_METHODS: Record<string, string> = {
  axillary: 'Axilar',
  rectal: 'Rectal',
  ear: 'Oído',
  forehead: 'Frente',
}

export function minutesBetween(a: string, b: string | null): number {
  const end = b ? new Date(b).getTime() : Date.now()
  return Math.max(0, Math.round((end - new Date(a).getTime()) / 60000))
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Texto corto que describe un registro. */
export function describe(e: Entry): string {
  const d = e.data || {}
  const parts: string[] = []
  switch (e.kind) {
    case 'feed':
      parts.push(FEED_TYPES[d.type] ?? 'Toma')
      if (d.amount_ml) parts.push(`${d.amount_ml} ml`)
      if (d.food) parts.push(d.food)
      if (e.ended_at || d.type?.startsWith('breast')) parts.push(fmtDuration(minutesBetween(e.started_at, e.ended_at)))
      break
    case 'sleep':
      parts.push(e.ended_at ? fmtDuration(minutesBetween(e.started_at, e.ended_at)) : 'durmiendo…')
      break
    case 'diaper':
      parts.push(DIAPER_TYPES[d.type] ?? 'Pañal')
      if (d.rash) parts.push('rojez')
      break
    case 'bath':
      if (d.water_temp) parts.push(`agua a ${d.water_temp} °C`)
      if (d.hair) parts.push('con lavado de pelo')
      if (d.cream) parts.push('crema')
      break
    case 'temperature':
      if (d.value) parts.push(`${Number(d.value).toFixed(1)} °C`)
      if (d.method) parts.push(TEMP_METHODS[d.method])
      if (Number(d.value) >= 38) parts.push('fiebre')
      break
    case 'medicine':
      if (d.name) parts.push(d.name)
      if (d.dose) parts.push(d.dose)
      break
    case 'health':
      parts.push(HEALTH_TYPES[d.type] ?? 'Salud')
      if (d.title) parts.push(d.title)
      break
    case 'growth':
      if (d.weight_kg) parts.push(`${d.weight_kg} kg`)
      if (d.height_cm) parts.push(`${d.height_cm} cm`)
      if (d.head_cm) parts.push(`cabeza ${d.head_cm} cm`)
      break
    case 'note':
      if (d.milestone) parts.push('⭐ Hito')
      break
  }
  return parts.filter(Boolean).join(' · ')
}
