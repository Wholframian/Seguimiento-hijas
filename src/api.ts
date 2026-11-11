import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Child, Entry, Household, Member, NewEntry } from './types'

export interface User { id: string; email: string }

export interface Membership { household: Household; me: Member; members: Member[] }

export interface Api {
  demo: boolean
  getUser(): Promise<User | null>
  onAuthChange(cb: (u: User | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<'ok' | 'confirm'>
  signOut(): Promise<void>
  getMembership(): Promise<Membership | null>
  createHousehold(name: string, displayName: string): Promise<void>
  joinHousehold(code: string, displayName: string): Promise<void>
  listChildren(hid: string): Promise<Child[]>
  saveChild(c: Partial<Child> & { household_id: string }): Promise<void>
  deleteChild(id: string): Promise<void>
  listEntries(hid: string, from: Date, to: Date): Promise<Entry[]>
  listEntriesByKind(hid: string, childId: string, kind: string): Promise<Entry[]>
  addEntry(hid: string, e: NewEntry, by: Member): Promise<void>
  updateEntry(id: string, e: Partial<NewEntry>): Promise<void>
  deleteEntry(id: string): Promise<void>
  subscribe(hid: string, cb: () => void): () => void
}

function check<T>(r: { data: T; error: any }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

function supabaseApi(sb: SupabaseClient): Api {
  const toUser = (u: any): User | null => (u ? { id: u.id, email: u.email ?? '' } : null)
  return {
    demo: false,
    async getUser() {
      const { data } = await sb.auth.getSession()
      return toUser(data.session?.user)
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, s) => cb(toUser(s?.user)))
      return () => data.subscription.unsubscribe()
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message)
    },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })
      if (error) throw new Error(error.message)
      return data.session ? 'ok' : 'confirm'
    },
    async signOut() { await sb.auth.signOut() },
    async getMembership() {
      const { data: s } = await sb.auth.getSession()
      const uid = s.session?.user.id
      if (!uid) return null
      const mine = check(await sb.from('household_members').select('household_id, user_id, display_name').eq('user_id', uid).limit(1))
      if (!mine?.length) return null
      const hid = mine[0].household_id
      const household = check(await sb.from('households').select('id, name, invite_code').eq('id', hid).single()) as Household
      const members = check(await sb.from('household_members').select('user_id, display_name').eq('household_id', hid)) as Member[]
      return { household, me: { user_id: uid, display_name: mine![0].display_name }, members }
    },
    async createHousehold(name, displayName) {
      check(await sb.rpc('create_household', { p_name: name, p_display_name: displayName }))
    },
    async joinHousehold(code, displayName) {
      check(await sb.rpc('join_household', { p_code: code, p_display_name: displayName }))
    },
    async listChildren(hid) {
      return check(await sb.from('children').select('*').eq('household_id', hid).order('birth_date', { ascending: true, nullsFirst: false })) as Child[]
    },
    async saveChild(c) {
      if (c.id) check(await sb.from('children').update({ name: c.name, birth_date: c.birth_date, color: c.color }).eq('id', c.id))
      else check(await sb.from('children').insert(c))
    },
    async deleteChild(id) { check(await sb.from('children').delete().eq('id', id)) },
    async listEntries(hid, from, to) {
      return check(await sb.from('entries').select('*').eq('household_id', hid)
        .gte('started_at', from.toISOString()).lt('started_at', to.toISOString())
        .order('started_at', { ascending: false }).limit(2000)) as Entry[]
    },
    async listEntriesByKind(hid, childId, kind) {
      return check(await sb.from('entries').select('*').eq('household_id', hid).eq('child_id', childId).eq('kind', kind)
        .order('started_at', { ascending: true }).limit(1000)) as Entry[]
    },
    async addEntry(hid, e, by) {
      check(await sb.from('entries').insert({ ...e, household_id: hid, created_by_name: by.display_name }))
    },
    async updateEntry(id, e) {
      check(await sb.from('entries').update({ ...e, updated_at: new Date().toISOString() }).eq('id', id))
    },
    async deleteEntry(id) { check(await sb.from('entries').delete().eq('id', id)) },
    subscribe(hid, cb) {
      const ch = sb.channel('hh-' + hid)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'entries', filter: `household_id=eq.${hid}` }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'children', filter: `household_id=eq.${hid}` }, cb)
        .subscribe()
      return () => { sb.removeChannel(ch) }
    },
  }
}

/** Modo demostración: guarda todo en este navegador. Sirve para probar la app sin Supabase. */
function demoApi(): Api {
  const KEY = 'seguimiento-demo-v1'
  type DB = { user: User | null; household: Household | null; members: Member[]; children: Child[]; entries: Entry[] }
  const load = (): DB => {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch { /* vacío */ }
    return { user: null, household: null, members: [], children: [], entries: [] }
  }
  let db = load()
  const listeners = new Set<() => void>()
  const authListeners = new Set<(u: User | null) => void>()
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* vacío */ } listeners.forEach((l) => l()) }
  const id = () => crypto.randomUUID()
  return {
    demo: true,
    async getUser() { return db.user },
    onAuthChange(cb) { authListeners.add(cb); return () => authListeners.delete(cb) },
    async signIn(email) { db.user = { id: 'demo-' + email, email }; save(); authListeners.forEach((l) => l(db.user)) },
    async signUp(email) { db.user = { id: 'demo-' + email, email }; save(); authListeners.forEach((l) => l(db.user)); return 'ok' },
    async signOut() { db.user = null; save(); authListeners.forEach((l) => l(null)) },
    async getMembership() {
      if (!db.user || !db.household) return null
      const me = db.members.find((m) => m.user_id === db.user!.id)
      if (!me) return null
      return { household: db.household, me, members: db.members }
    },
    async createHousehold(name, displayName) {
      db.household = { id: id(), name, invite_code: 'DEMO1234' }
      db.members = [{ user_id: db.user!.id, display_name: displayName }]
      save()
    },
    async joinHousehold() { throw new Error('En modo demostración no se puede unir a otra familia') },
    async listChildren() { return [...db.children] },
    async saveChild(c) {
      if (c.id) db.children = db.children.map((x) => (x.id === c.id ? { ...x, ...c } as Child : x))
      else db.children.push({ id: id(), name: '', birth_date: null, color: '#e07a5f', ...c } as Child)
      save()
    },
    async deleteChild(cid) { db.children = db.children.filter((c) => c.id !== cid); db.entries = db.entries.filter((e) => e.child_id !== cid); save() },
    async listEntries(_h, from, to) {
      return db.entries.filter((e) => { const t = new Date(e.started_at); return t >= from && t < to })
        .sort((a, b) => b.started_at.localeCompare(a.started_at))
    },
    async listEntriesByKind(_h, childId, kind) {
      return db.entries.filter((e) => e.child_id === childId && e.kind === kind).sort((a, b) => a.started_at.localeCompare(b.started_at))
    },
    async addEntry(hid, e, by) {
      db.entries.push({ ...e, id: id(), household_id: hid, created_by: db.user!.id, created_by_name: by.display_name })
      save()
    },
    async updateEntry(eid, e) { db.entries = db.entries.map((x) => (x.id === eid ? { ...x, ...e } : x)); save() },
    async deleteEntry(eid) { db.entries = db.entries.filter((x) => x.id !== eid); save() },
    subscribe(_h, cb) { listeners.add(cb); return () => listeners.delete(cb) },
  }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const api: Api = url && key ? supabaseApi(createClient(url, key)) : demoApi()
