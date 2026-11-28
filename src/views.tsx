import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, type Membership } from './api'
import { BarChart, DayStrip, fmtAge, fmtNum, GrowthChart, LineChart, RangeBar, Ring, StripLegend, useCountUp, type Bar } from './charts'
import { EntryForm } from './EntryForm'
import { describe, fmtDuration, KIND_ORDER, KINDS, minutesBetween } from './kinds'
import { avg, dayStats, NIGHT_END, NIGHT_START, type DayStats } from './stats'
import type { Child, Entry, Kind, NewEntry } from './types'
import { addDays, ageText, fmtDayTitle, fmtTime, startOfDay, timeAgo } from './util'
import { ALERT_SIGNS, dayAlerts, dayOfLife, EMERGENCY, FIRST_DAYS_MAX, FIRST_DAYS_SOURCES, GOAL_TABLE, goalFor, PEE_HINT, POO_COLORS, POO_SIZE_HINT, type PooColor } from './firstDays'
import { ageInMonths, bandAt, position, SOURCES, stageFor, type Metric, type Source, type Stage } from './who'

export interface Ctx {
  m: Membership
  child: Child
  version: number
  refresh: () => void
}

type Editing = { kind: Kind; entry?: Entry } | null

function useEntries(ctx: Ctx, from: Date, to: Date) {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    api.listEntries(ctx.m.household.id, from, to)
      .then((r) => live && setEntries(r.filter((e) => e.child_id === ctx.child.id)))
      .catch((x) => live && setErr(x.message))
    return () => { live = false }
  }, [ctx.m.household.id, ctx.child.id, from.getTime(), to.getTime(), ctx.version])
  return { entries, err }
}

function useKind(ctx: Ctx, kind: Kind) {
  const [list, setList] = useState<Entry[]>([])
  useEffect(() => {
    let live = true
    api.listEntriesByKind(ctx.m.household.id, ctx.child.id, kind).then((r) => live && setList(r)).catch(() => {})
    return () => { live = false }
  }, [ctx.child.id, ctx.version, kind])
  return list
}

function useEditor(ctx: Ctx) {
  const [editing, setEditing] = useState<Editing>(null)
  const node = editing && (
    <EntryForm
      kind={editing.kind}
      childId={ctx.child.id}
      entry={editing.entry}
      onClose={() => setEditing(null)}
      onSave={async (e: NewEntry) => {
        if (editing.entry) await api.updateEntry(editing.entry.id, e)
        else await api.addEntry(ctx.m.household.id, e, ctx.m.me)
        ctx.refresh()
      }}
      onDelete={editing.entry ? async () => { await api.deleteEntry(editing.entry!.id); ctx.refresh() } : undefined}
    />
  )
  return { open: setEditing, node }
}

/** Duración corta: "11 h 20" o "45 min". */
function hm(min: number) {
  min = Math.round(min)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

function EntryRow({ e, onClick, i = 0, date }: { e: Entry; onClick: () => void; i?: number; date?: boolean }) {
  const info = KINDS[e.kind]
  return (
    <button className="entry" onClick={onClick} style={{ ['--i' as any]: Math.min(i, 12) }}>
      {date
        ? <span className="time date">{new Date(e.started_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}<small>{new Date(e.started_at).getFullYear() !== new Date().getFullYear() ? new Date(e.started_at).getFullYear() : fmtTime(e.started_at)}</small></span>
        : <span className="time">{fmtTime(e.started_at)}{e.ended_at && <small>{fmtTime(e.ended_at)}</small>}</span>}
      <span className="kind-dot" style={{ background: info.color }}>{info.icon}</span>
      <span className="entry-body">
        <b>{info.label}</b> <span className="muted">{describe(e)}</span>
        {e.note && <span className="entry-note">{e.note}</span>}
      </span>
      {e.created_by_name && <span className="who">{e.created_by_name}</span>}
    </button>
  )
}

function Num({ v, fmt = (x) => String(Math.round(x)) }: { v: number; fmt?: (x: number) => string }) {
  return <>{fmt(useCountUp(v))}</>
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/* ---------------------------------- Hoy ---------------------------------- */

function DaySummary({ s, stage, partial }: { s: DayStats; stage: Stage | null; partial: boolean }) {
  const band = stage?.sleep
  const max = Math.max(18, (band?.[1] ?? 16) + 2) * 60
  const feedBits = [s.breast && `${s.breast} pecho`, s.bottle && `${s.bottle} biberón`, s.solid && `${s.solid} sólidos`, s.ml && `${s.ml} ml`].filter(Boolean).join(' · ')
  const tiles: { icon: ReactNode; v: number; l: string; sub?: string; color: string }[] = [
    { icon: KINDS.feed.icon, v: s.feeds, l: plural(s.feeds, 'comida', 'comidas'), sub: feedBits || undefined, color: KINDS.feed.color },
    { icon: '💩', v: s.poo, l: plural(s.poo, 'caca', 'cacas'), color: '#a47148' },
    { icon: KINDS.diaper.icon, v: s.diapers, l: plural(s.diapers, 'pañal', 'pañales'), sub: s.pee ? `${s.pee} con pis` : undefined, color: KINDS.diaper.color },
  ]
  if (s.baths) tiles.push({ icon: KINDS.bath.icon, v: s.baths, l: plural(s.baths, 'baño', 'baños'), color: KINDS.bath.color })
  if (s.meds) tiles.push({ icon: KINDS.medicine.icon, v: s.meds, l: plural(s.meds, 'medicina', 'medicinas'), color: KINDS.medicine.color })
  return (
    <section className="card summary-card">
      <div className="card-head"><h3>Resumen del día</h3>{partial && <span className="pill">hasta ahora</span>}</div>
      <div className="sleep-row">
        <Ring value={s.sleep} max={max} lo={band ? band[0] * 60 : undefined} hi={band ? band[1] * 60 : undefined} color={KINDS.sleep.color}>
          <b className="big"><Num v={s.sleep} fmt={hm} /></b>
          <small>sueño total</small>
        </Ring>
        <div className="sleep-split">
          <div>
            <span className="muted">🌙 Nocturno</span>
            <b><Num v={s.night} fmt={hm} /></b>
            <div className="split-bar"><span style={{ width: `${s.sleep ? (s.night / s.sleep) * 100 : 0}%`, background: KINDS.sleep.color }} /></div>
          </div>
          <div>
            <span className="muted">☀️ Diurno{s.naps ? ` · ${s.naps} ${plural(s.naps, 'siesta', 'siestas')}` : ''}</span>
            <b><Num v={s.daySleep} fmt={hm} /></b>
            <div className="split-bar"><span style={{ width: `${s.sleep ? (s.daySleep / s.sleep) * 100 : 0}%`, background: '#f2cc8f' }} /></div>
          </div>
          <small className="muted">Noche: de {NIGHT_START}:00 a {NIGHT_END}:00</small>
        </div>
      </div>
      <div className="tiles">
        {tiles.map((t, i) => (
          <div key={t.l} className="tile" style={{ ['--c' as any]: t.color, ['--i' as any]: i }}>
            <span className="tile-icon">{t.icon}</span>
            <b><Num v={t.v} /></b>
            <span>{t.l}</span>
            {t.sub && <small>{t.sub}</small>}
          </div>
        ))}
        {s.maxTemp !== null && (
          <div className="tile" style={{ ['--c' as any]: KINDS.temperature.color }}>
            <span className="tile-icon">{KINDS.temperature.icon}</span>
            <b>{s.maxTemp.toFixed(1)}°</b><span>máxima</span>
            {s.maxTemp >= 38 && <small className="danger">fiebre</small>}
          </div>
        )}
      </div>
    </section>
  )
}

const POS_TEXT = { low: 'Por debajo', ok: 'En rango', high: 'Por encima' } as const

function Status({ pos }: { pos: 'low' | 'ok' | 'high' }) {
  return <span className={`status ${pos}`}>{POS_TEXT[pos]}</span>
}

function GrowthRow({ label, icon, metric, unit, months, last }: { label: string; icon: string; metric: Metric; unit: string; months: number; last?: Entry }) {
  const value = last ? Number(last.data[metric]) : null
  const lastMonths = last ? Math.max(0, months - (Date.now() - new Date(last.started_at).getTime()) / 86400000 / 30.4375) : months
  const b = bandAt(metric, value !== null ? lastMonths : months)
  if (!b) return null
  return (
    <div className="who-row">
      <span className="who-icon">{icon}</span>
      <div className="who-body">
        <div className="who-title"><b>{label}</b>{value !== null && <Status pos={position(value, b)} />}</div>
        <p className="muted">
          Esperado a {fmtAge(value !== null ? lastMonths : months)}: <b className="ink">{fmtNum(b.p50)} {unit}</b> (normal entre {fmtNum(b.p3)} y {fmtNum(b.p97)})
        </p>
        {value !== null && last && <p className="muted">Última medida: <b className="ink">{fmtNum(value)} {unit}</b> · {timeAgo(last.started_at)}</p>}
        {value !== null && <RangeBar value={value} lo={b.p3} hi={b.p97} min={b.p3 - (b.p97 - b.p3) * 0.4} max={b.p97 + (b.p97 - b.p3) * 0.4} color={KINDS.growth.color} />}
      </div>
    </div>
  )
}

function WhoCard({ child, stage, months, s, partial, growth }: { child: Child; stage: Stage | null; months: number | null; s: DayStats | null; partial: boolean; growth: Entry[] }) {
  if (!stage || months === null) {
    return (
      <section className="card who-card">
        <div className="card-head"><h3>Según la OMS</h3></div>
        <p className="muted">Añade la fecha de nacimiento de {child.name} en Ajustes para ver las recomendaciones de su edad.</p>
      </section>
    )
  }
  const lastOf = (k: Metric) => [...growth].reverse().find((e) => e.data[k])
  const sources: Source[] = [stage.sleepSource, stage.feedSource, SOURCES.growth].filter((x, i, a) => a.indexOf(x) === i)
  const sleepPos = s && stage.sleep && !partial ? (s.sleep < stage.sleep[0] * 60 ? 'low' : s.sleep > stage.sleep[1] * 60 ? 'high' : 'ok') : null
  const feedPos = s && stage.feedRange && !partial ? (s.feeds < stage.feedRange[0] ? 'low' : s.feeds > stage.feedRange[1] && months >= 6 ? 'high' : 'ok') : null
  return (
    <section className="card who-card">
      <div className="card-head"><h3>Según la OMS</h3><span className="pill accent">{stage.label}</span></div>
      {stage.sleep && (
        <div className="who-row">
          <span className="who-icon">{KINDS.sleep.icon}</span>
          <div className="who-body">
            <div className="who-title"><b>Sueño: {stage.sleep[0]}–{stage.sleep[1]} h al día</b>{sleepPos && <Status pos={sleepPos} />}</div>
            <p className="muted">Incluye las siestas. {s && <>Este día: <b className="ink">{hm(s.sleep)}</b>{partial && ' por ahora'}.</>}</p>
            {s && <RangeBar value={s.sleep} lo={stage.sleep[0] * 60} hi={stage.sleep[1] * 60} max={Math.max(18, stage.sleep[1] + 2) * 60} color={KINDS.sleep.color} />}
          </div>
        </div>
      )}
      <div className="who-row">
        <span className="who-icon">{KINDS.feed.icon}</span>
        <div className="who-body">
          <div className="who-title"><b>Comidas{stage.feedRange ? `: ${stage.feedRange[0]}–${stage.feedRange[1]}${months < 6 ? '+' : ''} al día` : ''}</b>{feedPos && <Status pos={feedPos} />}</div>
          <p className="muted">{stage.feeds}</p>
        </div>
      </div>
      {stage.diapers && (
        <div className="who-row">
          <span className="who-icon">{KINDS.diaper.icon}</span>
          <div className="who-body">
            <div className="who-title"><b>Pañales mojados: {stage.wetMin}+ al día</b>{s && !partial && stage.wetMin && <Status pos={s.pee >= stage.wetMin ? 'ok' : 'low'} />}</div>
            <p className="muted">{stage.diapers}</p>
          </div>
        </div>
      )}
      <GrowthRow label="Peso" icon="⚖️" metric="weight_kg" unit="kg" months={months} last={lastOf('weight_kg')} />
      <GrowthRow label="Talla" icon="📏" metric="height_cm" unit="cm" months={months} last={lastOf('height_cm')} />
      <details className="sources">
        <summary>Fuentes y notas</summary>
        <ul>{sources.map((x) => <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer">{x.label}</a></li>)}</ul>
        <p className="muted">Peso y talla: tablas OMS para niñas (percentiles 3, 50 y 97), valores aproximados. Es orientativo: cada niña tiene su ritmo y manda el criterio de vuestra pediatra.</p>
      </details>
    </section>
  )
}

/** Guía de pises, cacas y tomas para las 6 primeras semanas. */
export function FirstDaysGuide({ day }: { day?: number }) {
  return (
    <div className="guide">
      <h4>Lo normal, día a día (como mínimo)</h4>
      <div className="goal-table">
        <span className="gt-h">Día</span><span className="gt-h">Pises</span><span className="gt-h">Cacas</span><span className="gt-h">Cómo es la caca</span>
        {GOAL_TABLE.map((r, i) => {
          const on = day !== undefined && (i < 4 ? day === i + 1 : i === 4 ? day === 5 || day === 6 : day >= 7)
          return [r.day, r.pee, r.poo, r.looks].map((c, j) => <span key={`${i}-${j}`} className={on ? 'on' : ''}>{c}</span>)
        })}
      </div>
      <p className="muted">{POO_SIZE_HINT} A partir de las 3-6 semanas muchos bebés hacen menos cacas: si está bien, come con ganas y gana peso, es normal.</p>
      <h4>¿De qué color?</h4>
      <ul className="colors">
        {(Object.entries(POO_COLORS) as [PooColor, (typeof POO_COLORS)[PooColor]][]).map(([k, c]) => (
          <li key={k}><span className="swatch" style={{ background: c.swatch }} /><b>{c.label}</b> <span className={c.alert ? 'danger' : 'muted'}>{c.hint}</span></li>
        ))}
        <li><span className="swatch" style={{ background: '#b23a3a' }} /><b>Con sangre</b> <span className="danger">Hilos o manchas rojas: consulta</span></li>
        <li><span className="swatch" style={{ background: '#6b5a3e' }} /><b>Dura, seca o en bolitas</b> <span className="danger">Y le cuesta mucho expulsarla</span></li>
      </ul>
      <p className="muted"><b className="ink">El pis.</b> {PEE_HINT}</p>
      <h4>⚠️ Llama a tu matrona o pediatra si…</h4>
      <ul className="alerts">{ALERT_SIGNS.map((a) => <li key={a}>{a}</li>)}</ul>
      <p className="emergency">🚑 {EMERGENCY}</p>
      <details className="sources">
        <summary>Fuentes y notas</summary>
        <ul>{FIRST_DAYS_SOURCES.map((x) => <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer">{x.label}</a></li>)}</ul>
        <p className="muted">Hoja «Pises y cacas» de vuestra matrona. Las cifras son orientativas para bebés con lactancia materna; cada bebé es distinto y no sustituye la valoración de la matrona o pediatra.</p>
      </details>
    </div>
  )
}

function FirstDaysCard({ child, day, s, entries, partial }: { child: Child; day: number; s: DayStats; entries: Entry[]; partial: boolean }) {
  const g = goalFor(day)
  const diapers = entries.filter((e) => e.kind === 'diaper')
  const flags = {
    colors: diapers.map((e) => e.data.color).filter(Boolean) as PooColor[],
    blood: diapers.some((e) => e.data.blood),
    hard: diapers.some((e) => e.data.hard),
    darkPee: diapers.some((e) => e.data.dark_pee),
  }
  const alerts = dayAlerts(day, s, flags, partial, s.maxTemp)
  const rows: { icon: ReactNode; label: string; v: number; goal: number | null; goalText: string; color: string }[] = [
    { icon: KINDS.feed.icon, label: 'Tomas', v: s.feeds, goal: g.feeds, goalText: `al menos ${g.feeds}`, color: KINDS.feed.color },
    { icon: KINDS.diaper.icon, label: 'Pises', v: s.pee, goal: g.pee, goalText: day >= 4 ? '6 a 8' : `${g.pee}`, color: KINDS.diaper.color },
    { icon: '💩', label: 'Cacas', v: s.poo, goal: g.poo, goalText: g.pooText, color: '#a47148' },
  ]
  return (
    <section className="card first-card">
      <div className="card-head"><h3>Primeros días</h3><span className="pill accent">Día {day} de vida</span></div>
      {rows.map((r) => {
        const done = r.goal === null || r.v >= r.goal
        return (
          <div key={r.label} className="who-row">
            <span className="who-icon">{r.icon}</span>
            <div className="who-body">
              <div className="who-title">
                <b>{r.label}: {r.v}{r.goal !== null && <span className="muted"> / {r.goalText}</span>}</b>
                {r.goal !== null && (done ? <span className="status ok">Cumplido</span> : partial ? <span className="pill">faltan {r.goal - r.v}</span> : <span className="status low">Por debajo</span>)}
              </div>
              {r.goal !== null
                ? <div className="split-bar"><span style={{ width: `${Math.min(100, (r.v / r.goal) * 100)}%`, background: r.color }} /></div>
                : <p className="muted">Objetivo: {r.goalText}.</p>}
            </div>
          </div>
        )
      })}
      <p className="muted first-looks">Caca esperada: <b className="ink">{g.pooLooks}</b></p>
      {alerts.length > 0 && (
        <div className="alert-box">
          <b>⚠️ Para comentar con la matrona o pediatra</b>
          <ul>{alerts.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
      <details className="guide-toggle">
        <summary>Ver la guía de pises y cacas</summary>
        <FirstDaysGuide day={day} />
      </details>
      <small className="muted">Mínimos orientativos con lactancia materna para {child.name}. Al registrar una caca puedes anotar su color.</small>
    </section>
  )
}

export function Today({ ctx }: { ctx: Ctx }) {
  const [day, setDay] = useState(() => startOfDay(new Date()))
  const from = useMemo(() => addDays(day, -1), [day])
  const to = useMemo(() => addDays(day, 1), [day])
  const { entries, err } = useEntries(ctx, from, to)
  const growth = useKind(ctx, 'growth')
  const ed = useEditor(ctx)
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t) }, [])

  const dayEntries = (entries ?? []).filter((e) => new Date(e.started_at) >= day)
  const running = (entries ?? []).filter((e) => KINDS[e.kind].timed && !e.ended_at && (e.kind === 'sleep' || String(e.data.type).startsWith('breast')))
  const isToday = day.getTime() === startOfDay(new Date()).getTime()
  const last = (k: Kind) => (entries ?? []).find((e) => e.kind === k)
  const stats = entries ? dayStats(entries, day) : null
  const months = ageInMonths(ctx.child.birth_date, isToday ? new Date() : addDays(day, 1))
  const stage = stageFor(months)
  const lifeDay = dayOfLife(ctx.child.birth_date, day)

  async function stop(e: Entry) {
    await api.updateEntry(e.id, { ended_at: new Date().toISOString() })
    ctx.refresh()
  }

  return (
    <div className="view">
      {running.map((e) => (
        <div key={e.id} className="timer" style={{ ['--c' as any]: KINDS[e.kind].color }}>
          <span className="kind-dot pulse" style={{ background: KINDS[e.kind].color }}>{KINDS[e.kind].icon}</span>
          <div><b>{e.kind === 'sleep' ? 'Durmiendo' : describe({ ...e, ended_at: null }).split(' · ')[0]}</b><br /><span className="muted">desde las {fmtTime(e.started_at)} · {fmtDuration(minutesBetween(e.started_at, null))}</span></div>
          <button className="primary small" onClick={() => stop(e)}>■ Parar</button>
        </div>
      ))}

      {isToday && (
        <div className="lasts">
          {([['feed', 'Última toma'], ['sleep', 'Último sueño'], ['diaper', 'Último pañal']] as [Kind, string][]).map(([k, label]) => {
            const l = last(k)
            const value = !l ? '—' : k === 'sleep' && !l.ended_at ? 'durmiendo' : timeAgo(l.ended_at ?? l.started_at)
            return <div key={k} className="last"><span>{KINDS[k].icon}</span><small>{label}</small><b>{value}</b></div>
          })}
        </div>
      )}

      <h3 className="section">Añadir</h3>
      <div className="quick">
        {KIND_ORDER.map((k, i) => (
          <button key={k} className="quick-btn" style={{ ['--i' as any]: i }} onClick={() => ed.open({ kind: k })}>
            <span className="kind-dot big" style={{ background: KINDS[k].color }}>{KINDS[k].icon}</span>
            {KINDS[k].label}
          </button>
        ))}
      </div>

      <div className="day-nav">
        <button className="icon" onClick={() => setDay(addDays(day, -1))} aria-label="Día anterior">‹</button>
        <h3 key={day.getTime()} className="swap">{fmtDayTitle(day)}</h3>
        <button className="icon" disabled={isToday} onClick={() => setDay(addDays(day, 1))} aria-label="Día siguiente">›</button>
      </div>
      {err && <p className="error">{err}</p>}
      {!entries && !err && <div className="skeleton" />}
      {stats && (
        <div className="today-grid swap" key={day.getTime()}>
          {lifeDay !== null && lifeDay <= FIRST_DAYS_MAX && <FirstDaysCard child={ctx.child} day={lifeDay} s={stats} entries={dayEntries} partial={isToday} />}
          <DaySummary s={stats} stage={stage} partial={isToday} />
          <WhoCard child={ctx.child} stage={stage} months={months} s={stats} partial={isToday} growth={growth} />
        </div>
      )}

      {entries && (
        <>
          <div className="card strip-card">
            <div className="card-head"><h3>El día en 24 horas</h3></div>
            <DayStrip entries={entries} day={day} />
            <StripLegend />
          </div>
          <h3 className="section">Registros del día{dayEntries.length ? ` · ${dayEntries.length}` : ''}</h3>
          <div className="timeline" key={day.getTime()}>
            {!dayEntries.length && <p className="empty">Nada registrado este día.</p>}
            {dayEntries.map((e, i) => <EntryRow key={e.id} e={e} i={i} onClick={() => ed.open({ kind: e.kind, entry: e })} />)}
          </div>
        </>
      )}
      {ed.node}
    </div>
  )
}

/* -------------------------------- Historial ------------------------------- */

function MiniStats({ s }: { s: DayStats }) {
  const bits: [ReactNode, string][] = []
  if (s.sleep) bits.push([KINDS.sleep.icon, hm(s.sleep)])
  if (s.feeds) bits.push([KINDS.feed.icon, String(s.feeds)])
  if (s.diapers) bits.push([KINDS.diaper.icon, String(s.diapers)])
  if (s.poo) bits.push(['💩', String(s.poo)])
  if (s.maxTemp !== null) bits.push([KINDS.temperature.icon, `${s.maxTemp.toFixed(1)}°`])
  return <span className="mini">{bits.map(([i, v], k) => <span key={k}>{i} {v}</span>)}</span>
}

export function History({ ctx }: { ctx: Ctx }) {
  const [days, setDays] = useState(7)
  const [filter, setFilter] = useState<Kind | 'all'>('all')
  const [open, setOpen] = useState<Set<number>>(() => new Set([startOfDay(new Date()).getTime()]))
  const to = useMemo(() => addDays(startOfDay(new Date()), 1), [])
  const from = useMemo(() => addDays(to, -days - 1), [to, days])
  const { entries, err } = useEntries(ctx, from, to)
  const ed = useEditor(ctx)

  const list = useMemo(() => {
    if (!entries) return []
    const out: { day: Date; items: Entry[]; s: DayStats }[] = []
    for (let i = 0; i < days; i++) {
      const day = addDays(to, -1 - i)
      const d0 = day.getTime(), d1 = addDays(day, 1).getTime()
      const items = entries.filter((e) => { const t = new Date(e.started_at).getTime(); return t >= d0 && t < d1 })
      const s = dayStats(entries, day)
      if (items.length || s.sleep) out.push({ day, items, s })
    }
    return out
  }, [entries, days, to])

  const logged = list.filter((d) => d.items.length)
  const avgs = {
    sleep: avg(logged.map((d) => d.s.sleep)),
    feeds: avg(logged.map((d) => d.s.feeds)),
    poo: avg(logged.map((d) => d.s.poo)),
    diapers: avg(logged.map((d) => d.s.diapers)),
  }
  const toggle = (t: number) => setOpen((o) => { const n = new Set(o); if (n.has(t)) n.delete(t); else n.add(t); return n })

  return (
    <div className="view">
      <div className="seg">
        {[7, 30, 90].map((d) => <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d} días</button>)}
      </div>
      {entries && logged.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>Media diaria</h3><span className="pill">{logged.length} {plural(logged.length, 'día', 'días')} con datos</span></div>
          <div className="tiles four">
            <div className="tile" style={{ ['--c' as any]: KINDS.sleep.color }}><span className="tile-icon">{KINDS.sleep.icon}</span><b><Num v={avgs.sleep} fmt={hm} /></b><span>sueño</span></div>
            <div className="tile" style={{ ['--c' as any]: KINDS.feed.color }}><span className="tile-icon">{KINDS.feed.icon}</span><b><Num v={avgs.feeds * 10} fmt={(x) => fmtNum(x / 10)} /></b><span>comidas</span></div>
            <div className="tile" style={{ ['--c' as any]: '#a47148' }}><span className="tile-icon">💩</span><b><Num v={avgs.poo * 10} fmt={(x) => fmtNum(x / 10)} /></b><span>cacas</span></div>
            <div className="tile" style={{ ['--c' as any]: KINDS.diaper.color }}><span className="tile-icon">{KINDS.diaper.icon}</span><b><Num v={avgs.diapers * 10} fmt={(x) => fmtNum(x / 10)} /></b><span>pañales</span></div>
          </div>
        </div>
      )}
      <div className="chips scroll">
        <button className={filter === 'all' ? 'chip on' : 'chip'} onClick={() => setFilter('all')}>Todo</button>
        {KIND_ORDER.map((k) => <button key={k} className={filter === k ? 'chip on' : 'chip'} onClick={() => setFilter(k)}>{KINDS[k].icon} {KINDS[k].label}</button>)}
      </div>
      {err && <p className="error">{err}</p>}
      {!entries && !err && <div className="skeleton" />}
      {entries && !list.length && <p className="empty">Todavía no hay registros en este periodo.</p>}
      <div className="days" key={`${days}-${filter}`}>
        {list.map(({ day, items, s }, idx) => {
          const shown = filter === 'all' ? items : items.filter((e) => e.kind === filter)
          if (filter !== 'all' && !shown.length) return null
          const t = day.getTime()
          const isOpen = filter !== 'all' || open.has(t)
          return (
            <div key={t} className={isOpen ? 'day-card open' : 'day-card'} style={{ ['--i' as any]: Math.min(idx, 10) }}>
              <button className="day-head" onClick={() => toggle(t)} aria-expanded={isOpen}>
                <span className="day-title"><b>{fmtDayTitle(day)}</b><MiniStats s={s} /></span>
                <span className="chev">›</span>
              </button>
              <DayStrip entries={entries!} day={day} compact />
              <div className="collapse"><div>
                <div className="timeline">
                  {shown.map((e, i) => <EntryRow key={e.id} e={e} i={isOpen ? i : 0} onClick={() => ed.open({ kind: e.kind, entry: e })} />)}
                  {!shown.length && <p className="empty">Solo sueño que empezó el día anterior.</p>}
                </div>
              </div></div>
            </div>
          )
        })}
      </div>
      {ed.node}
    </div>
  )
}

/* -------------------------------- Gráficas -------------------------------- */

const shortDay = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' })
const longDay = (d: Date) => d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

function Routine({ ctx, stage }: { ctx: Ctx; stage: Stage | null }) {
  const [n, setN] = useState(7)
  const to = useMemo(() => addDays(startOfDay(new Date()), 1), [])
  const from = useMemo(() => addDays(to, -n - 1), [to, n])
  const { entries, err } = useEntries(ctx, from, to)
  const days = useMemo(() => Array.from({ length: n }, (_, i) => addDays(to, -n + i)), [to, n])
  const stats = useMemo(() => (entries ? days.map((d) => dayStats(entries, d)) : []), [entries, days])
  if (err) return <p className="error">{err}</p>
  const seg = (
    <div className="seg">{[7, 14, 30].map((d) => <button key={d} className={n === d ? 'on' : ''} onClick={() => setN(d)}>{d} días</button>)}</div>
  )
  if (!entries) return <>{seg}<div className="skeleton" /></>
  const withData = stats.filter((s) => s.count || s.sleep)
  const sleepBars: Bar[] = days.map((d, i) => ({ label: shortDay(d), title: longDay(d), parts: [{ v: stats[i].night, color: KINDS.sleep.color }, { v: stats[i].daySleep, color: '#f2cc8f' }] }))
  const feedBars: Bar[] = days.map((d, i) => ({ label: shortDay(d), title: longDay(d), parts: [{ v: stats[i].breast, color: KINDS.feed.color }, { v: stats[i].bottle, color: '#e9c46a' }, { v: stats[i].solid, color: '#2a9d8f' }] }))
  const mlBars: Bar[] = days.map((d, i) => ({ label: shortDay(d), title: longDay(d), parts: [{ v: stats[i].ml, color: '#e9c46a' }] }))
  const diaperBars: Bar[] = days.map((d, i) => ({ label: shortDay(d), title: longDay(d), parts: [{ v: stats[i].poo, color: '#a47148' }, { v: stats[i].diapers - stats[i].poo, color: KINDS.diaper.color }] }))
  const anyMl = stats.some((s) => s.ml)
  const avgSleep = avg(withData.map((s) => s.sleep)), avgNight = avg(withData.map((s) => s.night)), avgDay = avg(withData.map((s) => s.daySleep))
  const hFmt = (v: number) => `${Math.round(v / 60)}h`
  return (
    <>
      {seg}
      <div className="card chart-card" style={{ ['--i' as any]: 0 }}>
        <div className="card-head"><h3>🌙 Sueño por día</h3>{stage?.sleep && <span className="pill">OMS {stage.sleep[0]}–{stage.sleep[1]} h</span>}</div>
        <div className="kpis">
          <div><b>{hm(avgSleep)}</b><small>media total</small></div>
          <div><b>{hm(avgNight)}</b><small>noche</small></div>
          <div><b>{hm(avgDay)}</b><small>día</small></div>
        </div>
        <BarChart step={240} bars={sleepBars} band={stage?.sleep ? [stage.sleep[0] * 60, stage.sleep[1] * 60] : undefined} fmt={(v) => (v < 60 && v > 0 ? `${Math.round(v)}m` : hFmt(v))} />
        <div className="legend"><span><i style={{ background: KINDS.sleep.color }} />Noche</span><span><i style={{ background: '#f2cc8f' }} />Día</span>{stage?.sleep && <span><i className="band-sw" />Recomendado</span>}</div>
      </div>

      <div className="card chart-card" style={{ ['--i' as any]: 1 }}>
        <div className="card-head"><h3>Patrón de sueño</h3></div>
        <div className="pattern">
          {[...days].reverse().map((d) => (
            <div key={d.getTime()} className="pattern-row"><span>{d.toLocaleDateString('es-ES', { weekday: 'narrow', day: 'numeric' })}</span><DayStrip entries={entries} day={d} compact /></div>
          ))}
          <div className="pattern-row axis-row"><span /><div className="strip-axis"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div></div>
        </div>
        <StripLegend />
      </div>

      <div className="card chart-card" style={{ ['--i' as any]: 2 }}>
        <div className="card-head"><h3>🍼 Comidas por día</h3>{stage?.feedRange && <span className="pill">OMS {stage.feedRange[0]}–{stage.feedRange[1]}</span>}</div>
        <div className="kpis"><div><b>{fmtNum(avg(withData.map((s) => s.feeds)))}</b><small>media al día</small></div>{anyMl && <div><b>{Math.round(avg(withData.map((s) => s.ml)))} ml</b><small>biberón al día</small></div>}</div>
        <BarChart bars={feedBars} band={stage?.feedRange} fmt={(v) => fmtNum(v)} />
        <div className="legend"><span><i style={{ background: KINDS.feed.color }} />Pecho</span><span><i style={{ background: '#e9c46a' }} />Biberón</span><span><i style={{ background: '#2a9d8f' }} />Sólidos</span></div>
      </div>

      {anyMl && (
        <div className="card chart-card" style={{ ['--i' as any]: 3 }}>
          <div className="card-head"><h3>Leche en biberón (ml)</h3></div>
          <BarChart bars={mlBars} fmt={(v) => `${Math.round(v)}`} height={120} />
        </div>
      )}

      <div className="card chart-card" style={{ ['--i' as any]: 4 }}>
        <div className="card-head"><h3>Pañales por día</h3></div>
        <div className="kpis"><div><b>{fmtNum(avg(withData.map((s) => s.diapers)))}</b><small>pañales</small></div><div><b>{fmtNum(avg(withData.map((s) => s.poo)))}</b><small>cacas</small></div></div>
        <BarChart bars={diaperBars} fmt={(v) => fmtNum(v)} />
        <div className="legend"><span><i style={{ background: '#a47148' }} />Con caca</span><span><i style={{ background: KINDS.diaper.color }} />Pis o seco</span></div>
      </div>
    </>
  )
}

function Growth({ ctx, months }: { ctx: Ctx; months: number | null }) {
  const growth = useKind(ctx, 'growth')
  const ed = useEditor(ctx)
  const birth = ctx.child.birth_date
  const series = (key: Metric) => growth.filter((e) => e.data[key]).map((e) => {
    const t = new Date(e.started_at).getTime()
    return { t, v: Number(e.data[key]), m: ageInMonths(birth, new Date(t)) ?? 0 }
  })
  const charts: { key: Metric; title: string; unit: string; color: string }[] = [
    { key: 'weight_kg', title: '⚖️ Peso', unit: 'kg', color: KINDS.growth.color },
    { key: 'height_cm', title: '📏 Talla', unit: 'cm', color: '#457b9d' },
    { key: 'head_cm', title: '🧠 Perímetro de cabeza', unit: 'cm', color: '#b5838d' },
  ]
  return (
    <>
      {!birth && <p className="banner">Añade la fecha de nacimiento en Ajustes para comparar con las curvas de la OMS.</p>}
      {charts.map((c, i) => {
        const pts = series(c.key)
        const last = pts[pts.length - 1]
        const b = last && birth ? bandAt(c.key, last.m) : null
        return (
          <div key={c.key} className="card chart-card" style={{ ['--i' as any]: i }}>
            <div className="card-head"><h3>{c.title}</h3>{b && last && <Status pos={position(last.v, b)} />}</div>
            {last && <div className="kpis"><div><b>{fmtNum(last.v)} {c.unit}</b><small>última · {timeAgo(new Date(last.t).toISOString())}</small></div>{pts.length > 1 && <div><b>{last.v - pts[pts.length - 2].v >= 0 ? '+' : ''}{fmtNum(last.v - pts[pts.length - 2].v)} {c.unit}</b><small>desde la anterior</small></div>}</div>}
            {birth
              ? <GrowthChart points={pts} metric={c.key} color={c.color} unit={c.unit} ageNow={months} />
              : <LineChart points={pts} unit={c.unit} color={c.color} />}
            {birth && <div className="legend"><span><i className="band-sw" style={{ background: c.color, opacity: .25 }} />OMS p3–p97</span><span><i className="dash" style={{ borderColor: c.color }} />Mediana</span></div>}
          </div>
        )
      })}
      <button className="primary" onClick={() => ed.open({ kind: 'growth' })}>+ Añadir medida</button>
      {growth.length > 0 && (
        <>
          <h3 className="section">Medidas</h3>
          <div className="timeline">
            {[...growth].reverse().map((e, i) => <EntryRow key={e.id} e={e} i={i} date onClick={() => ed.open({ kind: 'growth', entry: e })} />)}
          </div>
        </>
      )}
      <p className="muted small center">Curvas: <a href={SOURCES.growth.url} target="_blank" rel="noreferrer">patrones de crecimiento de la OMS</a> para niñas (aprox.).</p>
      {ed.node}
    </>
  )
}

function Health({ ctx }: { ctx: Ctx }) {
  const temps = useKind(ctx, 'temperature')
  const meds = useKind(ctx, 'medicine')
  const health = useKind(ctx, 'health')
  const ed = useEditor(ctx)
  const pts = temps.slice(-60).filter((e) => e.data.value).map((e) => ({ t: new Date(e.started_at).getTime(), v: Number(e.data.value) }))
  const recent = [...meds, ...health].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 20)
  const fevers = pts.filter((p) => p.v >= 38).length
  return (
    <>
      <div className="card chart-card">
        <div className="card-head"><h3>🌡️ Temperatura</h3>{fevers > 0 && <span className="status high">{fevers} con fiebre</span>}</div>
        <LineChart points={pts} unit="°C" color={KINDS.temperature.color} refLine={38} />
        <p className="muted small">La línea discontinua marca 38 °C.</p>
      </div>
      <h3 className="section">Medicinas y salud</h3>
      <div className="timeline">
        {!recent.length && <p className="empty">Sin registros de salud.</p>}
        {recent.map((e, i) => <EntryRow key={e.id} e={e} i={i} date onClick={() => ed.open({ kind: e.kind, entry: e })} />)}
      </div>
      {ed.node}
    </>
  )
}

export function Charts({ ctx }: { ctx: Ctx }) {
  const [tab, setTab] = useState<'routine' | 'growth' | 'health'>('routine')
  const months = ageInMonths(ctx.child.birth_date)
  const stage = stageFor(months)
  const tabs = [['routine', 'Rutina'], ['growth', 'Crecimiento'], ['health', 'Salud']] as const
  return (
    <div className="view">
      <div className="seg big" style={{ ['--n' as any]: 3, ['--k' as any]: tabs.findIndex(([k]) => k === tab) }}>
        <span className="seg-ind" />
        {tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div className="stack swap" key={tab}>
        {tab === 'routine' && <Routine ctx={ctx} stage={stage} />}
        {tab === 'growth' && <Growth ctx={ctx} months={months} />}
        {tab === 'health' && <Health ctx={ctx} />}
      </div>
    </div>
  )
}

const COLORS = ['#e07a5f', '#81b29a', '#f2cc8f', '#7b8cde', '#c77dff', '#4cc9d0', '#ef476f']

export function ChildEditor({ hid, child, onDone }: { hid: string; child?: Child; onDone: () => void }) {
  const [name, setName] = useState(child?.name ?? '')
  const [birth, setBirth] = useState(child?.birth_date ?? '')
  const [color, setColor] = useState(child?.color ?? COLORS[0])
  const [busy, setBusy] = useState(false)
  return (
    <form className="stack card" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true)
      await api.saveChild({ id: child?.id, household_id: hid, name: name.trim(), birth_date: birth || null, color })
      onDone()
    }}>
      <label>Nombre<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Fecha de nacimiento<input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} /></label>
      <div className="colors">{COLORS.map((c) => <button type="button" key={c} className={c === color ? 'swatch on' : 'swatch'} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />)}</div>
      <div className="actions">
        <button type="button" className="secondary" onClick={onDone}>Cancelar</button>
        <button className="primary" disabled={busy}>Guardar</button>
      </div>
      {child && <button type="button" className="danger link" onClick={async () => {
        if (confirm(`¿Borrar a ${child.name} y TODOS sus registros? No se puede deshacer.`)) { await api.deleteChild(child.id); onDone() }
      }}>Borrar a {child.name}</button>}
    </form>
  )
}

export function Settings({ m, kids, refresh }: { m: Membership; kids: Child[]; refresh: () => void }) {
  const [editing, setEditing] = useState<Child | 'new' | null>(null)
  const [copied, setCopied] = useState(false)
  return (
    <div className="view">
      <h3 className="section">Hijas</h3>
      {kids.map((c) => editing === c
        ? <ChildEditor key={c.id} hid={m.household.id} child={c} onDone={() => { setEditing(null); refresh() }} />
        : <button key={c.id} className="entry" onClick={() => setEditing(c)}>
            <span className="kind-dot" style={{ background: c.color }}>{c.name.charAt(0)}</span>
            <span className="entry-body"><b>{c.name}</b> <span className="muted">{ageText(c.birth_date)}</span></span>
            <span className="muted">Editar</span>
          </button>)}
      {editing === 'new'
        ? <ChildEditor hid={m.household.id} onDone={() => { setEditing(null); refresh() }} />
        : <button className="secondary" onClick={() => setEditing('new')}>+ Añadir hija</button>}

      <h3 className="section">Familia: {m.household.name}</h3>
      <div className="card stack">
        <p>Para que tu pareja vea y registre lo mismo: que cree su cuenta en esta app, elija <b>Tengo un código</b> y escriba:</p>
        <div className="code">{m.household.invite_code}</div>
        <button className="secondary" onClick={() => { navigator.clipboard?.writeText(m.household.invite_code); setCopied(true) }}>{copied ? 'Copiado ✓' : 'Copiar código'}</button>
        <p className="muted">Miembros: {m.members.map((x) => x.display_name).join(', ')}</p>
      </div>

      <h3 className="section">Instalar en el móvil</h3>
      <div className="card">
        <p className="muted"><b>iPhone:</b> abre la app en Safari, pulsa Compartir y luego "Añadir a pantalla de inicio".<br /><b>Android:</b> en Chrome, menú ⋮ y "Instalar aplicación".</p>
      </div>

      <button className="link" onClick={() => api.signOut()}>Cerrar sesión ({m.me.display_name})</button>
      {api.demo && <p className="banner">Modo demostración: los datos están solo en este navegador.</p>}
    </div>
  )
}
