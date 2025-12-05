<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDaySummaryStore } from '../stores/daySummaries'

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
  <div class="page">
    <h2>Day Summary</h2>
    <p class="meta">
      Total focused today: <strong>{{ store.current?.total_focused_minutes ?? 0 }} minutes</strong>
    </p>
    <label
      >Summary
      <textarea v-model="text" rows="6" placeholder="How did your day go?"></textarea>
    </label>
    <button class="save" @click="save">Save</button>
  </div>
</template>

<style scoped>
.page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #374151;
}
textarea {
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
.save {
  width: max-content;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
}
.meta {
  color: #374151;
}
</style>
