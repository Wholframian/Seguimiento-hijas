import { useState } from 'react'
import { DIAPER_TYPES, FEED_TYPES, HEALTH_TYPES, KINDS, TEMP_METHODS } from './kinds'
import type { Entry, Kind, NewEntry } from './types'
import { fromLocalInput, toLocalInput } from './util'

interface Props {
  kind: Kind
  childId: string
  entry?: Entry
  onSave: (e: NewEntry) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

function Choice({ options, value, onChange }: { options: Record<string, string>; value: string; onChange: (v: string) => void }) {
  return (
    <div className="chips">
      {Object.entries(options).map(([k, l]) => (
        <button type="button" key={k} className={value === k ? 'chip on' : 'chip'} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  )
}

export function EntryForm({ kind, childId, entry, onSave, onDelete, onClose }: Props) {
  const info = KINDS[kind]
  const [data, setData] = useState<Record<string, any>>(entry?.data ?? defaults(kind))
  const [start, setStart] = useState(toLocalInput(entry?.started_at ?? new Date()))
  const [end, setEnd] = useState(entry?.ended_at ? toLocalInput(entry.ended_at) : '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: string, v: any) => setData((d) => ({ ...d, [k]: v }))

  const isBreast = kind === 'feed' && String(data.type).startsWith('breast')
  const showEnd = kind === 'sleep' || isBreast || (kind === 'feed' && !!entry?.ended_at)

  async function save(timer: boolean) {
    setBusy(true); setErr(null)
    try {
      const clean: Record<string, any> = {}
      for (const [k, v] of Object.entries(data)) if (v !== '' && v !== null && v !== undefined && v !== false) clean[k] = v
      for (const k of ['amount_ml', 'water_temp', 'value', 'weight_kg', 'height_cm', 'head_cm'])
        if (clean[k] !== undefined) clean[k] = Number(String(clean[k]).replace(',', '.'))
      const started_at = timer ? new Date().toISOString() : fromLocalInput(start)
      let ended_at: string | null = null
      if (!timer && showEnd && end) ended_at = fromLocalInput(end)
      if (ended_at && ended_at < started_at) throw new Error('El fin no puede ser anterior al inicio')
      await onSave({ kind, child_id: childId, started_at, ended_at, data: clean, note: note.trim() || null })
      onClose()
    } catch (x: any) { setErr(x.message); setBusy(false) }
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="kind-dot" style={{ background: info.color }}>{info.icon}</span>
          <h2>{entry ? 'Editar' : 'Nuevo'}: {info.label.toLowerCase()}</h2>
          <button className="icon" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="stack">
          {kind === 'feed' && <>
            <Choice options={FEED_TYPES} value={data.type} onChange={(v) => set('type', v)} />
            {data.type === 'bottle' && <>
              <label>Cantidad (ml)<input inputMode="decimal" value={data.amount_ml ?? ''} onChange={(e) => set('amount_ml', e.target.value)} /></label>
              <Choice options={{ formula: 'Fórmula', breast_milk: 'Leche materna' }} value={data.milk} onChange={(v) => set('milk', v)} />
            </>}
            {data.type === 'solid' && <label>¿Qué ha comido?<input value={data.food ?? ''} onChange={(e) => set('food', e.target.value)} placeholder="Puré de verduras…" /></label>}
          </>}

          {kind === 'diaper' && <>
            <Choice options={DIAPER_TYPES} value={data.type} onChange={(v) => set('type', v)} />
            <label className="check"><input type="checkbox" checked={!!data.rash} onChange={(e) => set('rash', e.target.checked)} /> Rojez o irritación</label>
          </>}

          {kind === 'bath' && <>
            <label>Temperatura del agua (°C, opcional)<input inputMode="decimal" value={data.water_temp ?? ''} onChange={(e) => set('water_temp', e.target.value)} placeholder="37" /></label>
            <label className="check"><input type="checkbox" checked={!!data.hair} onChange={(e) => set('hair', e.target.checked)} /> Lavado de pelo</label>
            <label className="check"><input type="checkbox" checked={!!data.cream} onChange={(e) => set('cream', e.target.checked)} /> Crema o masaje</label>
          </>}

          {kind === 'temperature' && <>
            <label>Temperatura (°C)<input inputMode="decimal" required value={data.value ?? ''} onChange={(e) => set('value', e.target.value)} placeholder="36,8" autoFocus /></label>
            <Choice options={TEMP_METHODS} value={data.method} onChange={(v) => set('method', v)} />
          </>}

          {kind === 'medicine' && <>
            <label>Medicamento<input value={data.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="Paracetamol" /></label>
            <label>Dosis<input value={data.dose ?? ''} onChange={(e) => set('dose', e.target.value)} placeholder="2,5 ml" /></label>
          </>}

          {kind === 'health' && <>
            <Choice options={HEALTH_TYPES} value={data.type} onChange={(v) => set('type', v)} />
            <label>Título<input value={data.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Revisión de los 6 meses, tos…" /></label>
          </>}

          {kind === 'growth' && <div className="row3">
            <label>Peso (kg)<input inputMode="decimal" value={data.weight_kg ?? ''} onChange={(e) => set('weight_kg', e.target.value)} /></label>
            <label>Altura (cm)<input inputMode="decimal" value={data.height_cm ?? ''} onChange={(e) => set('height_cm', e.target.value)} /></label>
            <label>Cabeza (cm)<input inputMode="decimal" value={data.head_cm ?? ''} onChange={(e) => set('head_cm', e.target.value)} /></label>
          </div>}

          {kind === 'note' && <label className="check"><input type="checkbox" checked={!!data.milestone} onChange={(e) => set('milestone', e.target.checked)} /> Es un hito (primer diente, primeros pasos…)</label>}

          <div className={showEnd ? 'row2' : ''}>
            <label>{showEnd ? 'Inicio' : 'Fecha y hora'}<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            {showEnd && <label>Fin<input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></label>}
          </div>

          <label>Notas<textarea rows={kind === 'note' ? 4 : 2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></label>

          {err && <p className="error">{err}</p>}

          <div className="actions">
            {!entry && info.timed && (kind === 'sleep' || isBreast) &&
              <button className="secondary" disabled={busy} onClick={() => save(true)}>▶ Empezar ahora</button>}
            <button className="primary" disabled={busy || (kind === 'temperature' && !data.value)} onClick={() => save(false)}>Guardar</button>
          </div>
          {entry && onDelete && <button className="danger link" disabled={busy} onClick={async () => { if (confirm('¿Borrar este registro?')) { setBusy(true); await onDelete(); onClose() } }}>Borrar registro</button>}
        </div>
      </div>
    </div>
  )
}

function defaults(kind: Kind): Record<string, any> {
  switch (kind) {
    case 'feed': return { type: 'bottle' }
    case 'diaper': return { type: 'pee' }
    case 'temperature': return { method: 'axillary' }
    case 'health': return { type: 'symptom' }
    default: return {}
  }
}
