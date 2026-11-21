import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { KINDS } from './kinds'
import type { Entry } from './types'
import { addDays, startOfDay } from './util'
import { bandAt, type Metric } from './who'

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Cuenta animada desde el valor anterior hasta `target`. */
export function useCountUp(target: number, ms = 600) {
  const [v, setV] = useState(target)
  const from = useRef(0)
  useEffect(() => {
    if (reduced()) { setV(target); from.current = target; return }
    const start = performance.now(), a = from.current
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      setV(a + (target - a) * e)
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = target
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); from.current = target }
  }, [target, ms])
  return v
}

/** Anillo de progreso. `lo`–`hi` marca el rango recomendado sobre una escala de 0 a `max`. */
export function Ring({ value, max, lo, hi, color, size = 132, children }: { value: number; max: number; lo?: number; hi?: number; color: string; size?: number; children?: ReactNode }) {
  const r = 52, c = 2 * Math.PI * r
  const frac = Math.min(1, value / max)
  const arc = (a: number, b: number) => ({ strokeDasharray: `${c * (b - a)} ${c}`, strokeDashoffset: -c * a })
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} className="ring-bg" />
        {lo !== undefined && hi !== undefined && <circle cx="60" cy="60" r={r} className="ring-band" style={arc(lo / max, Math.min(1, hi / max))} />}
        <circle cx="60" cy="60" r={r} className="ring-fg" stroke={color} style={{ strokeDasharray: `${c * frac} ${c}` }} />
      </svg>
      <div className="ring-in">{children}</div>
    </div>
  )
}

/** Barra horizontal con el rango recomendado sombreado y una marca con el valor. */
export function RangeBar({ value, lo, hi, min = 0, max, color }: { value: number; lo: number; hi: number; min?: number; max: number; color: string }) {
  const p = (x: number) => `${Math.min(100, Math.max(0, ((x - min) / (max - min)) * 100))}%`
  return (
    <div className="rangebar">
      <div className="rb-band" style={{ left: p(lo), width: `calc(${p(hi)} - ${p(lo)})` }} />
      <div className="rb-fill" style={{ width: p(value), background: color }} />
      <div className="rb-mark" style={{ left: p(value), borderColor: color }} />
    </div>
  )
}

/** Franja de 24 h con el sueño, las tomas y los pañales de un día. */
export function DayStrip({ entries, day, compact }: { entries: Entry[]; day: Date; compact?: boolean }) {
  const d0 = startOfDay(day).getTime(), d1 = addDays(new Date(d0), 1).getTime(), span = d1 - d0
  const pct = (t: number) => ((Math.min(d1, Math.max(d0, t)) - d0) / span) * 100
  const blocks: ReactNode[] = []
  const marks: ReactNode[] = []
  for (const e of entries) {
    const s = new Date(e.started_at).getTime()
    const en = e.ended_at ? new Date(e.ended_at).getTime() : (e.kind === 'sleep' ? Math.min(Date.now(), s + 16 * 3600000) : s)
    if (en < d0 || s >= d1) continue
    if (e.kind === 'sleep') {
      blocks.push(<span key={e.id} className="strip-sleep" style={{ left: `${pct(s)}%`, width: `${Math.max(0.6, pct(en) - pct(s))}%` }} />)
    } else if (e.kind === 'feed' || e.kind === 'diaper') {
      if (s < d0) continue
      const poo = e.kind === 'diaper' && (e.data.type === 'poo' || e.data.type === 'both')
      marks.push(<span key={e.id} className={`strip-mark ${e.kind}${poo ? ' poo' : ''}`} style={{ left: `${pct(s)}%` }} />)
    }
  }
  return (
    <div className={compact ? 'strip compact' : 'strip'}>
      <div className="strip-track">
        <span className="strip-night" style={{ left: 0, width: `${(8 / 24) * 100}%` }} />
        <span className="strip-night" style={{ left: `${(20 / 24) * 100}%`, width: `${(4 / 24) * 100}%` }} />
        {blocks}{marks}
      </div>
      {!compact && <div className="strip-axis"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>}
    </div>
  )
}

export function StripLegend() {
  return (
    <div className="legend">
      <span><i style={{ background: KINDS.sleep.color }} />Sueño</span>
      <span><i className="dot" style={{ background: KINDS.feed.color }} />Toma</span>
      <span><i className="dot" style={{ background: KINDS.diaper.color }} />Pañal</span>
      <span><i className="dot" style={{ background: '#a47148' }} />Caca</span>
    </div>
  )
}

export interface Bar { label: string; title: string; parts: { v: number; color: string }[] }

/** Barras apiladas por día. `band` sombrea el rango recomendado. */
export function BarChart({ bars, band, fmt, height = 150, step }: { bars: Bar[]; band?: [number, number]; fmt: (v: number) => string; height?: number; step?: number }) {
  const [sel, setSel] = useState<number | null>(null)
  const totals = bars.map((b) => b.parts.reduce((a, p) => a + p.v, 0))
  const max = Math.max(1, ...totals, band ? band[1] * 1.08 : 0)
  const W = 340, H = height, B = 18, T = 8
  const n = bars.length
  const gap = n > 20 ? 2 : 6
  const bw = (W - 30 - gap * (n - 1)) / n
  const y = (v: number) => H - B - (v / max) * (H - B - T)
  const nice = step ? Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step) : niceTicks(max)
  const every = Math.ceil(n / 7)
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" onMouseLeave={() => setSel(null)}>
        {nice.map((t) => <g key={t}><line x1={30} x2={W} y1={y(t)} y2={y(t)} className="grid" /><text x={24} y={y(t) + 3} textAnchor="end" className="axis">{fmt(t)}</text></g>)}
        {band && <rect x={30} width={W - 30} y={y(band[1])} height={y(band[0]) - y(band[1])} className="band" />}
        {bars.map((b, i) => {
          let acc = 0
          const x = 30 + i * (bw + gap)
          return (
            <g key={i} className={sel === null || sel === i ? 'bar' : 'bar dim'} style={{ ['--i' as any]: i }} onClick={() => setSel(sel === i ? null : i)} onMouseEnter={() => setSel(i)}>
              <rect x={x} y={T} width={bw} height={H - B - T} fill="transparent" />
              {b.parts.map((p, j) => {
                const y1 = y(acc + p.v), y0 = y(acc)
                acc += p.v
                if (!p.v) return null
                return <rect key={j} x={x} y={y1} width={bw} height={Math.max(0, y0 - y1)} rx={Math.min(4, bw / 3)} fill={p.color} />
              })}
              {(i % every === 0 || i === n - 1) && <text x={x + bw / 2} y={H - 4} textAnchor="middle" className="axis">{b.label}</text>}
            </g>
          )
        })}
      </svg>
      <div className={sel !== null ? 'tip on' : 'tip'}>{sel !== null ? <><b>{bars[sel].title}</b> · {fmt(totals[sel])}</> : ' '}</div>
    </div>
  )
}

function niceTicks(max: number): number[] {
  const raw = max / 3
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = 0; v <= max + 1e-9; v += step) out.push(+v.toFixed(6))
  return out
}

/** Curva de crecimiento por edad con la banda OMS (p3–p97) y la mediana. */
export function GrowthChart({ points, metric, color, unit, ageNow }: { points: { m: number; v: number; t: number }[]; metric: Metric; color: string; unit: string; ageNow: number | null }) {
  const id = useId()
  const [sel, setSel] = useState<number | null>(null)
  const lastM = Math.max(ageNow ?? 0, ...points.map((p) => p.m), 3)
  const m0 = 0, m1 = Math.min(60, Math.ceil(lastM + Math.max(2, lastM * 0.15)))
  const samples: { m: number; p3: number; p50: number; p97: number }[] = []
  for (let i = 0; i <= 40; i++) { const m = m0 + ((m1 - m0) * i) / 40; const b = bandAt(metric, m); if (b) samples.push({ m, ...b }) }
  const vs = [...samples.flatMap((s) => [s.p3, s.p97]), ...points.map((p) => p.v)]
  if (!vs.length) return <p className="empty">Sin datos todavía.</p>
  let v0 = Math.min(...vs), v1 = Math.max(...vs)
  const pad = (v1 - v0) * 0.06 || 1; v0 -= pad; v1 += pad
  const W = 340, H = 190, L = 34, R = 8, T = 8, B = 20
  const x = (m: number) => L + ((m - m0) / (m1 - m0 || 1)) * (W - L - R)
  const y = (v: number) => H - B - ((v - v0) / (v1 - v0)) * (H - B - T)
  const line = (k: 'p3' | 'p50' | 'p97') => samples.map((s, i) => `${i ? 'L' : 'M'}${x(s.m).toFixed(1)},${y(s[k]).toFixed(1)}`).join(' ')
  const area = samples.length ? `${line('p97')} ${[...samples].reverse().map((s) => `L${x(s.m).toFixed(1)},${y(s.p3).toFixed(1)}`).join(' ')} Z` : ''
  const pts = [...points].sort((a, b) => a.m - b.m)
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.m).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const ticks = ticksBetween(v0, v1)
  const mStep = m1 <= 12 ? 2 : m1 <= 24 ? 3 : 6
  const mt: number[] = []; for (let m = 0; m <= m1; m += mStep) mt.push(m)
  const s = sel !== null ? pts[sel] : null
  const b = s ? bandAt(metric, s.m) : null
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart">
        <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".16" /><stop offset="1" stopColor={color} stopOpacity=".06" /></linearGradient></defs>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" /><text x={L - 5} y={y(t) + 3} textAnchor="end" className="axis">{+t.toFixed(1)}</text></g>)}
        {mt.map((m) => <text key={m} x={x(m)} y={H - 5} textAnchor="middle" className="axis">{m < 24 || m % 12 ? `${m}m` : `${m / 12}a`}</text>)}
        {area && <path d={area} fill={`url(#${id})`} className="fade-in" />}
        {samples.length > 0 && <path d={line('p50')} fill="none" stroke={color} strokeOpacity=".45" strokeDasharray="4 4" strokeWidth={1.2} />}
        {ageNow !== null && ageNow <= m1 && <line x1={x(ageNow)} x2={x(ageNow)} y1={T} y2={H - B} className="today-line" />}
        {pts.length > 1 && <path d={path} pathLength={1} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" className="draw" />}
        {pts.map((p, i) => (
          <g key={i} onClick={() => setSel(sel === i ? null : i)} onMouseEnter={() => setSel(i)} style={{ cursor: 'pointer' }}>
            <circle cx={x(p.m)} cy={y(p.v)} r={12} fill="transparent" />
            <circle cx={x(p.m)} cy={y(p.v)} r={sel === i ? 5.5 : 4} fill="var(--card)" stroke={color} strokeWidth={2.5} className="pop" style={{ ['--i' as any]: i }} />
          </g>
        ))}
      </svg>
      <div className={s ? 'tip on' : 'tip'}>
        {s ? <><b>{fmtNum(s.v)} {unit}</b> · {new Date(s.t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })} · {fmtAge(s.m)}{b && <> · OMS {fmtNum(b.p3)}–{fmtNum(b.p97)}</>}</> : 'Toca un punto para ver el detalle'}
      </div>
    </div>
  )
}

function ticksBetween(a: number, b: number): number[] {
  const step = niceTicks(b - a)[1] || 1
  const out: number[] = []
  for (let v = Math.ceil(a / step) * step; v <= b; v += step) out.push(+v.toFixed(6))
  return out
}

export const fmtNum = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 1 })
export function fmtAge(m: number) {
  if (m < 1) return `${Math.round(m * 30.4)} días`
  if (m < 24) return `${Math.floor(m)} ${Math.floor(m) === 1 ? 'mes' : 'meses'}`
  return `${Math.floor(m / 12)} años`
}

/** Línea simple por fecha (temperatura). */
export function LineChart({ points, unit, color, refLine }: { points: { t: number; v: number }[]; unit: string; color: string; refLine?: number }) {
  const id = useId()
  const [sel, setSel] = useState<number | null>(null)
  if (points.length < 2) return <p className="empty">{points.length ? `Un registro: ${fmtNum(points[0].v)} ${unit}. Añade otro para ver la gráfica.` : 'Sin datos todavía.'}</p>
  const W = 340, H = 160, L = 34, R = 8, T = 8, B = 20
  const ts = points.map((p) => p.t), vs = points.map((p) => p.v).concat(refLine ?? [])
  const t0 = Math.min(...ts), t1 = Math.max(...ts)
  let v0 = Math.min(...vs), v1 = Math.max(...vs)
  if (v1 - v0 < 1) { v0 -= 0.5; v1 += 0.5 }
  const pad = (v1 - v0) * 0.1; v0 -= pad; v1 += pad
  const x = (t: number) => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R)
  const y = (v: number) => H - B - ((v - v0) / (v1 - v0)) * (H - B - T)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const area = `${d} L${x(t1)},${H - B} L${x(t0)},${H - B} Z`
  const fmtD = (t: number) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  const s = sel !== null ? points[sel] : null
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart">
        <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[v0 + pad, (v0 + v1) / 2, v1 - pad].map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" /><text x={L - 5} y={y(t) + 3} textAnchor="end" className="axis">{t.toFixed(1)}</text></g>)}
        {refLine !== undefined && <line x1={L} x2={W - R} y1={y(refLine)} y2={y(refLine)} stroke="#e76f51" strokeDasharray="4 4" strokeWidth={1} />}
        <path d={area} fill={`url(#${id})`} className="fade-in" />
        <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" className="draw" />
        {points.map((p, i) => (
          <g key={i} onClick={() => setSel(sel === i ? null : i)} onMouseEnter={() => setSel(i)} style={{ cursor: 'pointer' }}>
            <circle cx={x(p.t)} cy={y(p.v)} r={10} fill="transparent" />
            <circle cx={x(p.t)} cy={y(p.v)} r={sel === i ? 5 : 3.5} fill={refLine !== undefined && p.v >= refLine ? '#e76f51' : color} className="pop" style={{ ['--i' as any]: i }} />
          </g>
        ))}
        <text x={L} y={H - 5} className="axis">{fmtD(t0)}</text>
        <text x={W - R} y={H - 5} className="axis" textAnchor="end">{fmtD(t1)}</text>
      </svg>
      <div className={s ? 'tip on' : 'tip'}>{s ? <><b>{fmtNum(s.v)} {unit}</b> · {new Date(s.t).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</> : 'Toca un punto para ver el detalle'}</div>
    </div>
  )
}
