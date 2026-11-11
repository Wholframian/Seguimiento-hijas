import { useCallback, useEffect, useState } from 'react'
import { api, type Membership, type User } from './api'
import { Login, Setup } from './Auth'
import type { Child } from './types'
import { ageText } from './util'
import { ChildEditor, Charts, History, Settings, Today, type Ctx } from './views'

type Tab = 'today' | 'history' | 'charts' | 'settings'
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'today', icon: '🏠', label: 'Hoy' },
  { id: 'history', icon: '📅', label: 'Historial' },
  { id: 'charts', icon: '📈', label: 'Gráficas' },
  { id: 'settings', icon: '⚙️', label: 'Ajustes' },
]

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* vacío */ } },
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [m, setM] = useState<Membership | null | undefined>(undefined)
  const [kids, setKids] = useState<Child[]>([])
  const [childId, setChildId] = useState<string | null>(store.get('child'))
  const [tab, setTab] = useState<Tab>('today')
  const [version, setVersion] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api.getUser().then(setUser)
    return api.onAuthChange(setUser)
  }, [])

  const loadMembership = useCallback(() => {
    setM(undefined)
    api.getMembership().then(setM).catch((x) => { setErr(x.message); setM(null) })
  }, [])
  useEffect(() => { if (user) loadMembership(); else setM(undefined) }, [user?.id])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  useEffect(() => {
    if (!m) return
    api.listChildren(m.household.id).then(setKids).catch((x) => setErr(x.message))
  }, [m?.household.id, version])
  useEffect(() => { if (m) return api.subscribe(m.household.id, refresh) }, [m?.household.id])

  if (user === undefined) return <div className="center-page muted">Cargando…</div>
  if (!user) return <Login />
  if (m === undefined) return <div className="center-page muted">Cargando…</div>
  if (!m) return <Setup onDone={loadMembership} />

  const child = kids.find((k) => k.id === childId) ?? kids[0]
  const pick = (id: string) => { setChildId(id); store.set('child', id) }

  if (!kids.length) {
    return (
      <div className="center-page">
        <div className="card auth">
          <h1>Añade a tu primera hija</h1>
          <p className="muted">Podrás añadir más desde Ajustes.</p>
          <ChildEditor hid={m.household.id} onDone={refresh} />
        </div>
      </div>
    )
  }

  const ctx: Ctx = { m, child, version, refresh }

  return (
    <div className="app" style={{ ['--accent' as any]: child.color }}>
      <header className="top">
        <div className="kids">
          {kids.map((k) => (
            <button key={k.id} className={k.id === child.id ? 'kid on' : 'kid'} style={{ ['--c' as any]: k.color }} onClick={() => pick(k.id)}>
              <span className="avatar">{k.name.charAt(0)}</span>
              <span><b>{k.name}</b>{k.birth_date && <small>{ageText(k.birth_date)}</small>}</span>
            </button>
          ))}
        </div>
      </header>
      {err && <p className="error" onClick={() => setErr(null)}>{err}</p>}
      <main>
        {tab === 'today' && <Today ctx={ctx} />}
        {tab === 'history' && <History ctx={ctx} />}
        {tab === 'charts' && <Charts ctx={ctx} />}
        {tab === 'settings' && <Settings m={m} kids={kids} refresh={refresh} />}
      </main>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
