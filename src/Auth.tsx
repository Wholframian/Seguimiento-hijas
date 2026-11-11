import { useState } from 'react'
import { api } from './api'

export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null); setMsg(null)
    try {
      if (mode === 'in') await api.signIn(email.trim(), password)
      else {
        const r = await api.signUp(email.trim(), password)
        if (r === 'confirm') setMsg('Te hemos enviado un email. Ábrelo para confirmar la cuenta y luego entra aquí.')
      }
    } catch (x: any) { setErr(x.message) } finally { setBusy(false) }
  }

  return (
    <div className="center-page">
      <div className="card auth">
        <div className="logo">🌼</div>
        <h1>Nuestras hijas</h1>
        <p className="muted">Tomas, sueño, pañales, salud y más, compartido en familia.</p>
        {api.demo && <p className="banner">Modo demostración: los datos se guardan solo en este navegador.</p>}
        <form onSubmit={submit} className="stack">
          <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label>Contraseña<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></label>
          {err && <p className="error">{err}</p>}
          {msg && <p className="ok">{msg}</p>}
          <button className="primary" disabled={busy}>{mode === 'in' ? 'Entrar' : 'Crear cuenta'}</button>
        </form>
        <button className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? '¿Primera vez? Crea una cuenta' : 'Ya tengo cuenta'}
        </button>
      </div>
    </div>
  )
}

export function Setup({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [family, setFamily] = useState('Nuestra familia')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      if (mode === 'create') await api.createHousehold(family.trim(), name.trim())
      else await api.joinHousehold(code.trim(), name.trim())
      onDone()
    } catch (x: any) { setErr(x.message) } finally { setBusy(false) }
  }

  return (
    <div className="center-page">
      <div className="card auth">
        <h1>Bienvenido</h1>
        <div className="seg">
          <button className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>Empezar familia</button>
          <button className={mode === 'join' ? 'on' : ''} onClick={() => setMode('join')}>Tengo un código</button>
        </div>
        <p className="muted">
          {mode === 'create'
            ? 'Crea la familia. Después podrás pasarle el código a tu pareja para que vea y registre lo mismo.'
            : 'Escribe el código que aparece en Ajustes del móvil de tu pareja.'}
        </p>
        <form onSubmit={submit} className="stack">
          <label>Tu nombre (se verá en cada registro)<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Papá, Mamá, Paul…" /></label>
          {mode === 'create'
            ? <label>Nombre de la familia<input required value={family} onChange={(e) => setFamily(e.target.value)} /></label>
            : <label>Código de invitación<input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="A1B2C3D4" /></label>}
          {err && <p className="error">{err}</p>}
          <button className="primary" disabled={busy}>Continuar</button>
        </form>
        <button className="link" onClick={() => api.signOut()}>Salir</button>
      </div>
    </div>
  )
}
