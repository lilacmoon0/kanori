import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http, endpoints } from '../api/client'
import type { FocusSession, Paginated } from '../types'

export const useFocusStore = defineStore('focus-sessions', () => {
  const sessions = ref<FocusSession[]>([])
  const activeByTask = ref<Record<number, FocusSession | null>>({})

  async function fetchAll() {
    const res = await http.get<Paginated<FocusSession> | FocusSession[]>(endpoints.focusSessions)
    sessions.value = Array.isArray(res) ? res : (res?.results ?? [])
  }

  async function start(taskId: number, notes = '') {
    const now = new Date().toISOString()
    const created = await http.post<FocusSession>(endpoints.focusSessions, {
      task: taskId,
      started_at: now,
      notes,
      success: false,
    })
    sessions.value.unshift(created)
    activeByTask.value[taskId] = created
    return created
  }

  async function stop(sessionId: number, success: boolean) {
    const now = new Date().toISOString()
    const updated = await http.patch<FocusSession>(`${endpoints.focusSessions}${sessionId}/`, {
      ended_at: now,
      success,
    })
    const idx = sessions.value.findIndex((s) => s.id === sessionId)
    if (idx >= 0) sessions.value[idx] = updated
    // clear activeByTask if matches
    const taskId = updated.task
    if (activeByTask.value[taskId]?.id === sessionId) activeByTask.value[taskId] = null
    return updated
  }

  function totalMinutesForTask(taskId: number) {
    return sessions.value
      .filter((s) => s.task === taskId)
      .reduce((acc, s) => acc + (s.duration_minutes || 0), 0)
  }

  function totalMinutesAll() {
    return sessions.value.reduce((acc, s) => acc + (s.duration_minutes || 0), 0)
  }

  return { sessions, activeByTask, fetchAll, start, stop, totalMinutesForTask, totalMinutesAll }
})
