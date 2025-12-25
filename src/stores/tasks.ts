import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { http, endpoints } from '../api/client'
import type { Task, TaskStatus, Paginated } from '../types'

export const useTasksStore = defineStore('tasks', () => {
  const items = ref<Task[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const byStatus = (status: TaskStatus) =>
    computed(() => items.value.filter((t) => t.status === status))

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const res = await http.get<Paginated<Task> | Task[]>(endpoints.tasks)
      items.value = Array.isArray(res) ? res : (res?.results ?? [])
    } catch (e: any) {
      error.value = e.message || String(e)
    } finally {
      loading.value = false
    }
  }

  async function create(payload: Partial<Task>) {
    const created = await http.post<Task>(endpoints.tasks, payload)
    items.value.unshift(created)
    return created
  }

  async function update(id: number, payload: Partial<Task>) {
    const updated = await http.patch<Task>(`${endpoints.tasks}${id}/`, payload)
    const idx = items.value.findIndex((t) => t.id === id)
    if (idx >= 0) items.value[idx] = updated
    return updated
  }

  async function remove(id: number) {
    await http.delete<void>(`${endpoints.tasks}${id}/`)
    items.value = items.value.filter((t) => t.id !== id)
  }

  async function moveTo(id: number, status: TaskStatus) {
    return update(id, { status })
  }

  function insertTaskAtStatusIndex(task: Task, status: TaskStatus, toIndex: number) {
    const next = items.value.filter((t) => t.id !== task.id)
    const statusIndexes: number[] = []
    for (let i = 0; i < next.length; i++) {
      if (next[i]?.status === status) statusIndexes.push(i)
    }

    const clampedIndex = Math.max(0, Math.min(toIndex, statusIndexes.length))

    let insertIndex = next.length
    if (statusIndexes.length === 0) {
      insertIndex = next.length
    } else if (clampedIndex <= 0) {
      insertIndex = statusIndexes[0]!
    } else if (clampedIndex >= statusIndexes.length) {
      insertIndex = statusIndexes[statusIndexes.length - 1]! + 1
    } else {
      insertIndex = statusIndexes[clampedIndex]!
    }

    next.splice(insertIndex, 0, task)
    items.value = next
  }

  function reorderLocal(taskId: number, status: TaskStatus, toIndex: number) {
    const task = items.value.find((t) => t.id === taskId)
    if (!task) return
    const fixed: Task = task.status === status ? task : { ...task, status }
    insertTaskAtStatusIndex(fixed, status, toIndex)
  }

  async function moveOrReorder(taskId: number, status: TaskStatus, toIndex: number) {
    const task = items.value.find((t) => t.id === taskId)
    if (!task) return
    if (task.status === status) {
      reorderLocal(taskId, status, toIndex)
      return
    }
    reorderLocal(taskId, status, toIndex)
    try {
      const updated = await update(taskId, { status })
      reorderLocal(updated.id, status, toIndex)
    } catch (e) {
      await fetchAll()
      throw e
    }
  }

  function clear() {
    items.value = []
    loading.value = false
    error.value = null
  }

  return {
    items,
    loading,
    error,
    byStatus,
    fetchAll,
    create,
    update,
    remove,
    moveTo,
    moveOrReorder,
    clear,
  }
})
