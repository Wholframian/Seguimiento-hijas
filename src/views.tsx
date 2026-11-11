import { useEffect, useMemo, useState } from 'react'
import { api, type Membership } from './api'
import { EntryForm } from './EntryForm'
import { describe, fmtDuration, KIND_ORDER, KINDS, minutesBetween } from './kinds'
import type { Child, Entry, Kind, NewEntry } from './types'
import { addDays, ageText, fmtDayTitle, fmtTime, startOfDay, timeAgo } from './util'

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

function summarize(entries: Entry[]) {
  const s = { feeds: 0, ml: 0, breastMin: 0, sleepMin: 0, diapers: 0, poo: 0, baths: 0, maxTemp: null as number | null }
  for (const e of entries) {
    if (e.kind === 'feed') {
      s.feeds++
      if (e.data.amount_ml) s.ml += Number(e.data.amount_ml)
      if (String(e.data.type).startsWith('breast') && e.ended_at) s.breastMin += minutesBetween(e.started_at, e.ended_at)
    }
    if (e.kind === 'sleep' && e.ended_at) s.sleepMin += minutesBetween(e.started_at, e.ended_at)
    if (e.kind === 'diaper') { s.diapers++; if (e.data.type === 'poo' || e.data.type === 'both') s.poo++ }
    if (e.kind === 'bath') s.baths++
    if (e.kind === 'temperature' && e.data.value) s.maxTemp = Math.max(s.maxTemp ?? 0, Number(e.data.value))
  }
  return s
}

function Summary({ entries }: { entries: Entry[] }) {
  const s = summarize(entries)
  const items = [
    { icon: KINDS.feed.icon, v: `${s.feeds}`, l: (s.feeds === 1 ? 'toma' : 'tomas') + (s.ml ? ` · ${s.ml} ml` : '') },
    { icon: KINDS.sleep.icon, v: fmtDuration(s.sleepMin), l: 'de sueño' },
    { icon: KINDS.diaper.icon, v: `${s.diapers}`, l: (s.diapers === 1 ? 'pañal' : 'pañales') + (s.poo ? ` · ${s.poo} con caca` : '') },
  ]
  if (s.baths) items.push({ icon: KINDS.bath.icon, v: `${s.baths}`, l: s.baths === 1 ? 'baño' : 'baños' })
  if (s.maxTemp !== null) items.push({ icon: KINDS.temperature.icon, v: `${s.maxTemp.toFixed(1)} °C`, l: 'máxima' })
  return (
    <div className="summary">
      {items.map((i) => <div key={i.l} className="sum-item"><span>{i.icon}</span><b>{i.v}</b><small>{i.l}</small></div>)}
    </div>
  )
}

function EntryRow({ e, onClick }: { e: Entry; onClick: () => void }) {
  const info = KINDS[e.kind]
  return (
    <button className="entry" onClick={onClick}>
      <span className="time">{fmtTime(e.started_at)}{e.ended_at && <small>{fmtTime(e.ended_at)}</small>}</span>
      <span className="kind-dot" style={{ background: info.color }}>{info.icon}</span>
      <span className="entry-body">
        <b>{info.label}</b> <span className="muted">{describe(e)}</span>
        {e.note && <span className="entry-note">{e.note}</span>}
      </span>
      {e.created_by_name && <span className="who">{e.created_by_name}</span>}
    </button>
  )
}

export function Today({ ctx }: { ctx: Ctx }) {
  const [day, setDay] = useState(() => startOfDay(new Date()))
  const from = useMemo(() => addDays(day, -1), [day])
  const to = useMemo(() => addDays(day, 1), [day])
  const { entries, err } = useEntries(ctx, from, to)
  const ed = useEditor(ctx)
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t) }, [])

  const dayEntries = (entries ?? []).filter((e) => new Date(e.started_at) >= day)
  const running = (entries ?? []).filter((e) => KINDS[e.kind].timed && !e.ended_at && (e.kind === 'sleep' || String(e.data.type).startsWith('breast')))
  const isToday = day.getTime() === startOfDay(new Date()).getTime()
  const last = (k: Kind) => (entries ?? []).find((e) => e.kind === k)

  async function stop(e: Entry) {
    await api.updateEntry(e.id, { ended_at: new Date().toISOString() })
    ctx.refresh()
  }

  return (
    <div className="view">
      {running.map((e) => (
        <div key={e.id} className="timer" style={{ borderColor: KINDS[e.kind].color }}>
          <span className="kind-dot" style={{ background: KINDS[e.kind].color }}>{KINDS[e.kind].icon}</span>
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
        {KIND_ORDER.map((k) => (
          <button key={k} className="quick-btn" onClick={() => ed.open({ kind: k })}>
            <span className="kind-dot big" style={{ background: KINDS[k].color }}>{KINDS[k].icon}</span>
            {KINDS[k].label}
          </button>
        ))}
      </div>

      <div className="day-nav">
        <button className="icon" onClick={() => setDay(addDays(day, -1))} aria-label="Día anterior">‹</button>
        <h3>{fmtDayTitle(day)}</h3>
        <button className="icon" disabled={isToday} onClick={() => setDay(addDays(day, 1))} aria-label="Día siguiente">›</button>
      </div>
      {err && <p className="error">{err}</p>}
      {entries && <Summary entries={dayEntries} />}
      <div className="timeline">
        {entries && !dayEntries.length && <p className="empty">Nada registrado este día.</p>}
        {dayEntries.map((e) => <EntryRow key={e.id} e={e} onClick={() => ed.open({ kind: e.kind, entry: e })} />)}
      </div>
      {ed.node}
    </div>
  )
}

export function History({ ctx }: { ctx: Ctx }) {
  const [days, setDays] = useState(7)
  const [filter, setFilter] = useState<Kind | 'all'>('all')
  const to = useMemo(() => addDays(startOfDay(new Date()), 1), [])
  const from = useMemo(() => addDays(to, -days), [to, days])
  const { entries, err } = useEntries(ctx, from, to)
  const ed = useEditor(ctx)

  const groups = useMemo(() => {
    const g = new Map<string, Entry[]>()
    for (const e of entries ?? []) {
      const k = startOfDay(new Date(e.started_at)).toISOString()
      if (!g.has(k)) g.set(k, [])
      g.get(k)!.push(e)
    }
    return [...g.entries()]
  }, [entries])

  return (
    <div className="view">
      <div className="seg">
        {[7, 30, 90, 365].map((d) => <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d === 365 ? '1 año' : `${d} días`}</button>)}
      </div>
      <div className="chips scroll">
        <button className={filter === 'all' ? 'chip on' : 'chip'} onClick={() => setFilter('all')}>Todo</button>
        {KIND_ORDER.map((k) => <button key={k} className={filter === k ? 'chip on' : 'chip'} onClick={() => setFilter(k)}>{KINDS[k].icon} {KINDS[k].label}</button>)}
      </div>
      {err && <p className="error">{err}</p>}
      {entries && !groups.length && <p className="empty">Todavía no hay registros en este periodo.</p>}
      {groups.map(([k, list]) => {
        const shown = filter === 'all' ? list : list.filter((e) => e.kind === filter)
        if (!shown.length) return null
        return (
          <div key={k} className="day-group">
            <h3 className="section">{fmtDayTitle(new Date(k))}</h3>
            {filter === 'all' && <Summary entries={list} />}
            <div className="timeline">{shown.map((e) => <EntryRow key={e.id} e={e} onClick={() => ed.open({ kind: e.kind, entry: e })} />)}</div>
          </div>
        )
      })}
      {ed.node}
    </div>
  )
}

function LineChart({ points, unit, color, refLine }: { points: { t: number; v: number }[]; unit: string; color: string; refLine?: number }) {
  if (points.length < 2) return <p className="empty">{points.length ? `Un registro: ${points[0].v} ${unit}. Añade otro para ver la gráfica.` : 'Sin datos todavía.'}</p>
  const W = 340, H = 160, P = 30
  const ts = points.map((p) => p.t), vs = points.map((p) => p.v).concat(refLine ?? [])
  const t0 = Math.min(...ts), t1 = Math.max(...ts)
  let v0 = Math.min(...vs), v1 = Math.max(...vs)
  if (v0 === v1) { v0 -= 1; v1 += 1 }
  const pad = (v1 - v0) * 0.1; v0 -= pad; v1 += pad
  const x = (t: number) => P + ((t - t0) / (t1 - t0 || 1)) * (W - P - 10)
  const y = (v: number) => H - 20 - ((v - v0) / (v1 - v0)) * (H - 30)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const fmtD = (t: number) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      <text x={4} y={y(v1 - pad) + 4} className="axis">{(v1 - pad).toFixed(1)}</text>
      <text x={4} y={y(v0 + pad) + 4} className="axis">{(v0 + pad).toFixed(1)}</text>
      <line x1={P} x2={W - 10} y1={y(v0 + pad)} y2={y(v0 + pad)} className="grid" />
      <line x1={P} x2={W - 10} y1={y(v1 - pad)} y2={y(v1 - pad)} className="grid" />
      {refLine !== undefined && <line x1={P} x2={W - 10} y1={y(refLine)} y2={y(refLine)} stroke="#e76f51" strokeDasharray="4 4" strokeWidth={1} />}
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <circle key={i} cx={x(p.t)} cy={y(p.v)} r={3.5} fill={color}><title>{`${fmtD(p.t)}: ${p.v} ${unit}`}</title></circle>)}
      <text x={P} y={H - 4} className="axis">{fmtD(t0)}</text>
      <text x={W - 10} y={H - 4} className="axis" textAnchor="end">{fmtD(t1)}</text>
    </svg>
  )
}

export function Charts({ ctx }: { ctx: Ctx }) {
  const [growth, setGrowth] = useState<Entry[]>([])
  const [temps, setTemps] = useState<Entry[]>([])
  const ed = useEditor(ctx)
  useEffect(() => {
    api.listEntriesByKind(ctx.m.household.id, ctx.child.id, 'growth').then(setGrowth)
    api.listEntriesByKind(ctx.m.household.id, ctx.child.id, 'temperature').then((r) => setTemps(r.slice(-40)))
  }, [ctx.child.id, ctx.version])
  const series = (list: Entry[], key: string) => list.filter((e) => e.data[key]).map((e) => ({ t: new Date(e.started_at).getTime(), v: Number(e.data[key]) }))

  return (
    <div className="view">
      <div className="card">
        <h3>⚖️ Peso (kg)</h3>
        <LineChart points={series(growth, 'weight_kg')} unit="kg" color={KINDS.growth.color} />
      </div>
      <div className="card">
        <h3>📏 Altura (cm)</h3>
        <LineChart points={series(growth, 'height_cm')} unit="cm" color="#457b9d" />
      </div>
      <div className="card">
        <h3>🧠 Perímetro de cabeza (cm)</h3>
        <LineChart points={series(growth, 'head_cm')} unit="cm" color="#b5838d" />
      </div>
      <div className="card">
        <h3>🌡️ Temperatura (°C)</h3>
        <LineChart points={series(temps, 'value')} unit="°C" color={KINDS.temperature.color} refLine={38} />
        <p className="muted small">La línea discontinua marca 38 °C.</p>
      </div>
      <button className="primary" onClick={() => ed.open({ kind: 'growth' })}>+ Añadir medida</button>
      {growth.length > 0 && (
        <div className="timeline">
          {[...growth].reverse().map((e) => <EntryRow key={e.id} e={e} onClick={() => ed.open({ kind: 'growth', entry: e })} />)}
        </div>
      )}
      {ed.node}
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
