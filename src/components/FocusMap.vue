<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import type { ApexOptions } from 'apexcharts'
import { useFocusStore } from '../stores/focusSessions'
import VueApexCharts from 'vue3-apexcharts'

defineOptions({
  components: { apexchart: VueApexCharts },
})

const store = useFocusStore()

onMounted(() => {
  // Ensure we have data before rendering
  if (!store.sessions.length) {
    store.fetchAll().catch(() => {})
  }
})

// Build a multi-series heatmap: y-axis as days of week (rows), x-axis as weeks (columns).
// Monday is the start of the week. We aggregate minutes per day-of-week for the selected month.
// no-op: date formatting not needed in week/day layout

const props = defineProps<{ month?: string; startDate?: string }>()
const selectedMonth = ref<string | null>(
  props.month ?? (props.startDate ? String(props.startDate).slice(0, 7) : null)
)

// Parse API datetime strings safely.
// If the backend returns a "naive" datetime string (no timezone suffix), assume it is UTC.
// This prevents the browser from treating it as local time (which can shift by the user's UTC offset).
function parseApiDate(value: string) {
  const v = String(value || '')
  if (!v) return new Date(NaN)
  const normalized = v.includes(' ') && !v.includes('T') ? v.replace(' ', 'T') : v
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(normalized)
  return new Date(hasTz ? normalized : `${normalized}Z`)
}

// Determine start of current week (Sunday) or use provided startDate
function startOfWeek(date: Date) {
  const d = new Date(date)
  const jsDow = d.getDay() // 0=Sun..6=Sat
  // Convert to Monday-based index 0=Mon..6=Sun
  const monDow = (jsDow + 6) % 7
  d.setDate(d.getDate() - monDow)
  d.setHours(0, 0, 0, 0)
  return d
}

const baseMonthDate = computed(() => {
  const monthStr = selectedMonth.value ?? props.month
  if (monthStr) return new Date(`${monthStr}-01T00:00:00`)
  if (props.startDate) return new Date(props.startDate)
  return new Date()
})

const monthStart = computed(() => {
  const d = new Date(baseMonthDate.value)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
})

const monthEnd = computed(() => {
  const d = new Date(monthStart.value)
  d.setMonth(d.getMonth() + 1, 0) // last day of month
  d.setHours(23, 59, 59, 999)
  return d
})

const weekStarts = computed(() => {
  const firstWeek = startOfWeek(monthStart.value)
  const lastWeek = startOfWeek(monthEnd.value)
  const arr: Date[] = []
  const cursor = new Date(firstWeek)
  while (cursor <= lastWeek) {
    arr.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }
  return arr
})

function shiftMonth(delta: number) {
  const base = baseMonthDate.value
  const d = new Date(base)
  d.setMonth(d.getMonth() + delta, 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  selectedMonth.value = `${y}-${m}`
}

function prevMonth() {
  shiftMonth(-1)
}

function nextMonth() {
  shiftMonth(1)
}

function fmtWeekRangeLabel(start: Date) {
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const sameMonth = start.getMonth() === end.getMonth()
  const sameYear = start.getFullYear() === end.getFullYear()

  const sm = start.toLocaleString(undefined, { month: 'short' })
  const em = end.toLocaleString(undefined, { month: 'short' })
  const sd = start.getDate()
  const ed = end.getDate()
  const sy = start.getFullYear()
  const ey = end.getFullYear()

  if (sameMonth && sameYear) return `${sm} ${sd}–${ed}`
  if (sameYear) return `${sm} ${sd}–${em} ${ed}`
  return `${sm} ${sd}, ${sy}–${em} ${ed}, ${ey}`
}

const xCategories = computed(() => weekStarts.value.map((d) => fmtWeekRangeLabel(d)))
const monthLabel = computed(() => monthStart.value.toLocaleString(undefined, { month: 'long', year: 'numeric' }))
const yCategories = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

const series = computed(() => {
  // Map: key = `${weekIndex}-${dow}` -> total minutes
  const buckets = new Map<string, number>()
  for (const s of store.sessions) {
    if (!s.started_at) continue
    const started = parseApiDate(s.started_at)
    // find which week bucket the started date falls into
    let weekIdx = -1
    for (let i = 0; i < weekStarts.value.length; i++) {
      const start = weekStarts.value[i]!
      const end = new Date(start)
      end.setDate(start.getDate() + 7)
      if (started >= start && started < end) {
        weekIdx = i
        break
      }
    }
    if (weekIdx === -1) continue
    const dow = (started.getDay() + 6) % 7 // Monday-based 0..6
    const key = `${weekIdx}-${dow}`
    const prev = buckets.get(key) || 0
    buckets.set(key, prev + (s.duration_minutes || 0))
  }

  // For each day-of-week, build a row with data per week
  const rows: { name: string; data: { x: string; y: number }[] }[] = []
  for (let dow = 0; dow < 7; dow++) {
    const row = { name: yCategories[dow] as string, data: [] as { x: string; y: number }[] }
    for (let w = 0; w < weekStarts.value.length; w++) {
      const key = `${w}-${dow}`
      row.data.push({ x: fmtWeekRangeLabel(weekStarts.value[w]!), y: buckets.get(key) || 0 })
    }
    rows.push(row)
  }
  return rows
})

const options = computed<ApexOptions>(() => ({
  chart: {
    type: 'heatmap',
    toolbar: { show: false },
  },
  dataLabels: { enabled: false },
  plotOptions: {
    heatmap: {
      shadeIntensity: 0.5,
      colorScale: {
        ranges: [
          { from: 0, to: 0, name: 'None', color: '#f2f2f2' },
          { from: 1, to: 10, name: 'Abandoned', color: '#e66666' },
          { from: 10, to: 30, name: 'Medium', color: '#A5D6A7' },
          { from: 30, to: 180, name: 'High', color: '#66BB6A' },
          { from: 180, to: 600, name: 'Intense', color: '#2E7D32' },
        ],
      },
    },
  },
  xaxis: {
    type: 'category',
    labels: { show: true, rotate: 0, rotateAlways: false },
    categories: xCategories.value,
    tooltip: { enabled: false },
  },
  yaxis: {
    labels: { show: true },
  },
  title: { text: `Focus Map (${monthLabel.value})`, align: 'left' },
  tooltip: {
    y: {
      formatter: (val: number) => `${val} min`,
    },
  },
}))

</script>

<template>
  <div class="focus-map">
  <div class="focus-map-controls">
      <button type="button" class="nav" @click="prevMonth" aria-label="Previous month">‹</button>
      <apexchart class="chart" type="heatmap" :options="options" :series="series" height="420" /> 
      <button type="button" class="nav" @click="nextMonth" aria-label="Next month">›</button>
    </div>
  </div>
  
</template>

<style scoped>
.focus-map {
  width: 100%;
}
.focus-map-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-bottom: 8px;
}
.focus-map-controls .nav {
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 18px;
}
.focus-map-controls .chart {
  flex: 1 1 0;
  min-width: 0;
}
</style>
