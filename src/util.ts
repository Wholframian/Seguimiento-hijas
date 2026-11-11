export function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export function sameDay(a: Date, b: Date) { return startOfDay(a).getTime() === startOfDay(b).getTime() }

/** Valor para <input type="datetime-local"> en hora local. */
export function toLocalInput(iso: string | Date): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export function fromLocalInput(v: string): string { return new Date(v).toISOString() }

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

export function fmtDayTitle(d: Date): string {
  const today = startOfDay(new Date())
  const diff = Math.round((today.getTime() - startOfDay(d).getTime()) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  const s = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function ageText(birth: string | null): string {
  if (!birth) return ''
  const b = new Date(birth + 'T00:00:00')
  const now = new Date()
  let months = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth()
  if (now.getDate() < b.getDate()) months--
  if (months < 1) {
    const days = Math.floor((now.getTime() - b.getTime()) / 86400000)
    return days === 1 ? '1 día' : `${days} días`
  }
  if (months < 24) return months === 1 ? '1 mes' : `${months} meses`
  const y = Math.floor(months / 12)
  const m = months % 12
  return `${y} años${m ? ` y ${m} ${m === 1 ? 'mes' : 'meses'}` : ''}`
}

export function timeAgo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h${min % 60 ? ` ${min % 60} min` : ''}`
  const d = Math.floor(h / 24)
  return d === 1 ? 'hace 1 día' : `hace ${d} días`
}
