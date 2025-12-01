<script setup lang="ts">
import { onMounted } from 'vue'
import TaskColumn from './TaskColumn.vue'
import { useTasksStore } from '../stores/tasks'

const tasksStore = useTasksStore()

onMounted(() => {
  if (!tasksStore.items.length) tasksStore.fetchAll()
})
</script>

<template>
  <div class="board">
    <TaskColumn
      title="To Do"
      status="todo"
      :tasks="tasksStore.byStatus('todo').value"
      @edit="$emit('edit', $event)"
      @remove="tasksStore.remove($event)"
    />
    <TaskColumn
      title="General Doing"
      status="doing"
      :tasks="tasksStore.byStatus('doing').value"
      @edit="$emit('edit', $event)"
      @remove="tasksStore.remove($event)"
    />
    <TaskColumn
      title="Today Doing"
      status="today"
      :tasks="tasksStore.byStatus('today').value"
      @edit="$emit('edit', $event)"
      @remove="tasksStore.remove($event)"
    />
    <TaskColumn
      title="Done"
      status="done"
      :tasks="tasksStore.byStatus('done').value"
      @edit="$emit('edit', $event)"
      @remove="tasksStore.remove($event)"
    />
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
@media (max-width: 1200px) {
  .board {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 700px) {
  .board {
    grid-template-columns: 1fr;
  }
}
</style>
