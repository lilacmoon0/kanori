import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http, endpoints } from '../api/client'
import type { DaySummary, Paginated } from '../types'

function todayStr(): string {
  const d = new Date()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export const useDaySummaryStore = defineStore('day-summaries', () => {
  const items = ref<DaySummary[]>([])
  const current = ref<DaySummary | null>(null)

  async function fetchAll() {
    const res = await http.get<Paginated<DaySummary> | DaySummary[]>(endpoints.daySummaries)
    items.value = Array.isArray(res) ? res : (res?.results ?? [])
  }

  async function fetchToday() {
    await fetchAll()
    const t = todayStr()
    current.value = items.value.find((s) => s.date === t) || null
    return current.value
  }

  async function saveToday(text: string) {
    const t = await fetchToday()
    if (t) {
      const updated = await http.patch<DaySummary>(`${endpoints.daySummaries}${t.id}/`, {
        summary_text: text,
      })
      const idx = items.value.findIndex((s) => s.id === t.id)
      if (idx >= 0) items.value[idx] = updated
      current.value = updated
      return updated
    } else {
      const created = await http.post<DaySummary>(endpoints.daySummaries, {
        date: todayStr(),
        summary_text: text,
      })
      items.value.unshift(created)
      current.value = created
      return created
    }
  }

  return { items, current, fetchAll, fetchToday, saveToday }
})
