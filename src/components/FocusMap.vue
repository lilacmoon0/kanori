<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import type { ApexOptions } from 'apexcharts'
import { useFocusStore } from '../stores/focusSessions'
import VueApexCharts from 'vue3-apexcharts'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-vue-next'

defineOptions({
  components: { apexchart: VueApexCharts },
})

const store = useFocusStore()

onMounted(() => {
  if (!store.sessions.length) {
    store.fetchAll().catch(() => {})
  }
})

const props = defineProps<{ month?: string; startDate?: string }>()
const selectedMonth = ref<string | null>(
  props.month ?? (props.startDate ? String(props.startDate).slice(0, 7) : null)
)

function parseApiDate(value: string) {
  const v = String(value || '')
  if (!v) return new Date(NaN)
  const normalized = v.includes(' ') && !v.includes('T') ? v.replace(' ', 'T') : v
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(normalized)
  return new Date(hasTz ? normalized : `${normalized}Z`)
}

function startOfWeek(date: Date) {
  const d = new Date(date)
  const jsDow = d.getDay() 
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
  d.setMonth(d.getMonth() + 1, 0)
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

function fmtWeekRangeLabel(start: Date) {
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const sm = start.toLocaleString(undefined, { month: 'short' })
  const sd = start.getDate()
  const ed = end.getDate()
  return `${sm} ${sd}–${ed}`
}

const xCategories = computed(() => weekStarts.value.map((d) => fmtWeekRangeLabel(d)))
const monthLabel = computed(() => monthStart.value.toLocaleString(undefined, { month: 'long', year: 'numeric' }))
const yCategories = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const series = computed(() => {
  const buckets = new Map<string, number>()
  for (const s of store.sessions) {
    if (!s.started_at) continue
    const started = parseApiDate(s.started_at)
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
    const dow = (started.getDay() + 6) % 7 
    const key = `${weekIdx}-${dow}`
    buckets.set(key, (buckets.get(key) || 0) + (s.duration_minutes || 0))
  }

  const rows = []
  for (let dow = 0; dow < 7; dow++) {
    const row = { name: yCategories[dow], data: [] as any }
    for (let w = 0; w < weekStarts.value.length; w++) {
      const key = `${w}-${dow}`
      row.data.push({ x: xCategories.value[w], y: buckets.get(key) || 0 })
    }
    rows.push(row)
  }
  return rows.reverse() // Reverse so Monday is at the top
})

const options = computed<ApexOptions>(() => ({
  chart: {
    type: 'heatmap',
    toolbar: { show: false },
    fontFamily: 'inherit',
  },
  dataLabels: { enabled: false },
  stroke: { width: 2, colors: ['#fff'] },
  plotOptions: {
    heatmap: {
      enableShades: false,
      colorScale: {
        ranges: [
          { from: 0, to: 0, color: '#F2F4F7' }, // Very light grey
          { from: 1, to: 15, color: '#dcfce7' },
          { from: 16, to: 60, color: '#86efac' },
          { from: 61, to: 180, color: '#22c55e' },
          { from: 181, to: 1000, color: '#15803d' },
        ],
      },
    },
  },
  grid: { padding: { right: 20 } },
  xaxis: {
    labels: { style: { colors: '#909399', fontSize: '12px' } },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: { style: { colors: '#909399', fontSize: '12px' } },
  },
  tooltip: {
    theme: 'light',
    y: { formatter: (val: number) => `${val} min` },
  },
}))
</script>

<template>
  <el-card class="focus-card" shadow="never">
    <template #header>
      <div class="header">
        <div class="title-group">
          <Calendar :size="18" class="icon" />
          <span class="title">Focus Map</span>
        </div>
        <div class="nav-controls">
          <span class="month-display">{{ monthLabel }}</span>
          <el-button-group>
            <el-button size="small" @click="shiftMonth(-1)">
              <ChevronLeft :size="16" />
            </el-button>
            <el-button size="small" @click="shiftMonth(1)">
              <ChevronRight :size="16" />
            </el-button>
          </el-button-group>
        </div>
      </div>
    </template>

    <div class="chart-container">
      <apexchart 
        type="heatmap" 
        :options="options" 
        :series="series" 
        height="280" 
      />
    </div>
  </el-card>
</template>

<style scoped>
.focus-card {
  border-radius: 12px;
  border: 1px solid #e4e7ed;
  width: 100%;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon {
  color: #606266;
}

.title {
  font-weight: 700;
  font-size: 1rem;
  color: #303133;
}

.nav-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.month-display {
  font-size: 0.85rem;
  font-weight: 600;
  color: #606266;
  min-width: 110px;
  text-align: right;
}

.chart-container {
  margin: -10px -10px 0 -15px; /* Pull margins to align with card edges */
}

/* Customizing the Button Group for a cleaner look */
:deep(.el-button-group .el-button) {
  padding: 8px;
}

:deep(.apexcharts-legend) {
  display: none !important; /* Keep it clean, use colors only */
}
</style>