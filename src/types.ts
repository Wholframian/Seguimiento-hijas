export type Kind =
  | 'feed' | 'sleep' | 'diaper' | 'bath' | 'temperature'
  | 'medicine' | 'health' | 'growth' | 'note'

export interface Child {
  id: string
  household_id: string
  name: string
  birth_date: string | null
  color: string
}

export interface Entry {
  id: string
  household_id: string
  child_id: string
  kind: Kind
  started_at: string
  ended_at: string | null
  data: Record<string, any>
  note: string | null
  created_by: string | null
  created_by_name: string | null
}

export interface Household {
  id: string
  name: string
  invite_code: string
}

export interface Member {
  user_id: string
  display_name: string
}

export type NewEntry = Omit<Entry, 'id' | 'household_id' | 'created_by' | 'created_by_name'>
