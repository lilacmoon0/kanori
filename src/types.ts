export type TaskStatus = 'todo' | 'doing' | 'today' | 'done'

export interface Task {
  id: number
  title: string
  description: string
  status: TaskStatus
  progress: number
  estimated_minutes: number
  created_at: string
  updated_at: string
}

export interface FocusSession {
  id: number
  task: number // task id
  started_at: string
  ended_at: string | null
  duration_minutes: number
  success: boolean
  notes: string
}

export interface DaySummary {
  id: number
  date: string // YYYY-MM-DD
  summary_text: string
  total_focused_minutes: number
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
