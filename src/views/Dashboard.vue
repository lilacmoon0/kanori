<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { onMounted } from 'vue'
import TaskBoard from '../components/TaskBoard.vue'
import { useTasksStore } from '../stores/tasks'
import DaySummary from '@/components/DaySummary.vue'
const tasks = useTasksStore()

onMounted(() => {
  if (!tasks.items.length) tasks.fetchAll()
})
</script>

<template>
  <div class="page">
    <header class="header">
      <h2>Life Management Dashboard</h2>
    </header>
    <TaskBoard />
    <DaySummary />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}
.header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.new {
  display: flex;
  gap: 8px;
}
.new input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
.new button {
  padding: 6px 10px;
  border: none;
  background: #2563eb;
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
}
.stats {
  margin-top: 8px;
}
.error {
  color: #b91c1c;
}
</style>
