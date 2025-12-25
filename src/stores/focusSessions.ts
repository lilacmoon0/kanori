import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http, endpoints } from '../api/client'
import type { FocusSession, Paginated } from '../types'

export const useFocusStore = defineStore('focus-sessions', () => {
  const sessions = ref<FocusSession[]>([])
  const activeByTask = ref<Record<number, FocusSession | null>>({})

  const activeBlockId = ref<number | null>(null)

  const completedBlocks = ref<Record<number, { minutes: number }>>({})

  const pausedTaskId = ref<number | null>(null)
  const pausedAtMs = ref<number | null>(null)
  const pausedTotalMs = ref(0)

  function activeTaskId() {
    const entry = Object.entries(activeByTask.value).find(([, s]) => !!s)
    return entry ? Number(entry[0]) : null
  }

  function isPaused(taskId: number) {
    return pausedTaskId.value === taskId && pausedAtMs.value != null
  }

  function pause(taskId: number) {
    if (activeTaskId() !== taskId) return
    if (pausedAtMs.value != null) return
    pausedTaskId.value = taskId
    pausedAtMs.value = Date.now()
  }

  function resume(taskId: number) {
    if (activeTaskId() !== taskId) return
    if (pausedAtMs.value == null) return
    pausedTotalMs.value += Date.now() - pausedAtMs.value
    pausedAtMs.value = null
  }

  function clearPause() {
    pausedTaskId.value = null
    pausedAtMs.value = null
    pausedTotalMs.value = 0
  }

  function effectiveElapsedMs(taskId: number, nowMs: number) {
    const active = activeByTask.value[taskId]
    if (!active) return 0
    const startedMs = new Date(active.started_at).getTime()
    const pausedWindowMs =
      pausedTaskId.value === taskId && pausedAtMs.value != null ? nowMs - pausedAtMs.value : 0
    return Math.max(0, nowMs - startedMs - pausedTotalMs.value - Math.max(0, pausedWindowMs))
  }

  async function fetchAll() {
    const res = await http.get<Paginated<FocusSession> | FocusSession[]>(endpoints.focusSessions)
    sessions.value = Array.isArray(res) ? res : (res?.results ?? [])
    let newestActive: FocusSession | null = null
    for (const s of sessions.value) {
      if (s.ended_at !== null) continue
      if (!newestActive) {
        newestActive = s
        continue
      }
      if (new Date(s.started_at).getTime() > new Date(newestActive.started_at).getTime()) {
        newestActive = s
      }
    }

    const nextActive: Record<number, FocusSession | null> = {}
    if (newestActive) nextActive[newestActive.task] = newestActive
    activeByTask.value = nextActive

    activeBlockId.value = null
    const nextActiveTaskId = newestActive ? newestActive.task : null
    if (pausedTaskId.value !== nextActiveTaskId) {
      clearPause()
    }
  }

  async function start(taskId: number, notes = '', blockId: number | null = null) {
    const active = Object.values(activeByTask.value).find((s) => !!s) || null
    if (active && active.task !== taskId) {
      throw new Error('Another focus session is already active')
    }

    const now = new Date().toISOString()
    const created = await http.post<FocusSession>(endpoints.focusSessions, {
      task: taskId,
      started_at: now,
      notes,
      success: false,
    })
    sessions.value.unshift(created)
    activeByTask.value = { [taskId]: created }
    activeBlockId.value = blockId
    clearPause()
    return created
  }

  async function stop(sessionId: number, success: boolean) {
    const blockIdAtStop = activeBlockId.value
    const now = new Date().toISOString()
    const updated = await http.patch<FocusSession>(`${endpoints.focusSessions}${sessionId}/`, {
      ended_at: now,
      success,
    })
    const idx = sessions.value.findIndex((s) => s.id === sessionId)
    if (idx >= 0) sessions.value[idx] = updated
    const taskId = updated.task
    if (activeByTask.value[taskId]?.id === sessionId) activeByTask.value[taskId] = null
    if (pausedTaskId.value === taskId) clearPause()

    if (success && blockIdAtStop != null) {
      const minutesRaw = (updated as any)?.duration_minutes
      const minutes = Number.isFinite(minutesRaw) ? Number(minutesRaw) : 0
      completedBlocks.value = { ...completedBlocks.value, [blockIdAtStop]: { minutes } }
    }

    activeBlockId.value = null
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

  function clear() {
    sessions.value = []
    activeByTask.value = {}
    activeBlockId.value = null
    completedBlocks.value = {}
  }

  return {
    sessions,
    activeByTask,
    activeBlockId,
    completedBlocks,
    activeTaskId,
    isPaused,
    pause,
    resume,
    clearPause,
    effectiveElapsedMs,
    fetchAll,
    start,
    stop,
    totalMinutesForTask,
    totalMinutesAll,
    clear,
  }
})
