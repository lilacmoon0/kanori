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

  async function setProgress(id: number, progress: number) {
    return update(id, { progress })
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
    setProgress,
  }
})
