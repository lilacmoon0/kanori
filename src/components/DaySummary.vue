<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDaySummaryStore } from '../stores/daySummaries'
import { Save } from 'lucide-vue-next'

const store = useDaySummaryStore()
const text = ref('')

onMounted(async () => {
  const s = await store.fetchToday()
  text.value = s?.summary_text || ''
})

async function save() {
  await store.saveToday(text.value)
}
</script>

<template>
  <div class="card tiny">
    <div class="header">
      <h3>Day Summary</h3>
      <span class="pill">{{ store.current?.total_focused_minutes ?? 0 }}m</span>
    </div>
    <label>
      <span class="label">Summary</span>
      <textarea v-model="text" rows="3" placeholder="How did your day go?"></textarea>
    </label>
    <button class="save" @click="save" aria-label="Save" title="Save">
      <Save :size="16" />
    </button>
  </div>
</template>

<style scoped>
.card {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #ffffff;
}
.card.tiny {
  max-width: 320px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #111827;
}
.pill {
  font-size: 0.8rem;
  color: #2563eb;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 9999px;
  padding: 2px 8px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #374151;
}
.label {
  font-size: 0.8rem;
}
textarea {
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;
}
.save {
  width: max-content;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.meta {
  color: #374151;
}
</style>
