<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { onMounted } from 'vue'
import TaskBoard from '../components/TaskBoard.vue'
import { useTasksStore } from '../stores/tasks'
const tasks = useTasksStore()

onMounted(() => {
  if (!tasks.items.length) tasks.fetchAll()
})
</script>

<template>
  <div class="page-container page-container--full dashboard">
    <div class="board-surface">
      <TaskBoard />
    </div>
  </div>
</template>

<style scoped>

.dashboard {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dashboard-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dashboard-title {
  font-size: 16px;
  font-weight: 800;
  line-height: 1.2;
  color: var(--el-text-color-primary);
}

.dashboard-subtitle {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.board-surface {
  flex: 1;
  min-height: 0;
  border-radius: 12px;
  padding: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  --column-list-max-height: calc(100dvh - 200px);
}

@media (max-width: 768px) {
  .board-surface {
    padding: 6px;
    --column-list-max-height: calc(100dvh - 220px);
  }
}
</style>
