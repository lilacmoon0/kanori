<script setup lang="ts">
import { computed } from 'vue'
import type { Note } from '@/types'
import NoteCard from './NoteCard.vue'
import Draggable from 'vuedraggable'

const props = defineProps<{ notes: Note[] }>()

const emit = defineEmits<{
  (e: 'select', note: Note): void
  (e: 'reorder', notes: Note[]): void
}>()

const model = computed({
  get: () => props.notes,
  set: (val: Note[]) => emit('reorder', val),
})
</script>

<template>
  <div class="notes-grid-wrap" aria-label="Notes list">
    <Draggable
      v-if="notes.length > 0"
      v-model="model"
      item-key="id"
      class="notes-grid"
      :animation="150"
      ghost-class="drag-ghost"
      chosen-class="drag-chosen"
    >
      <template #item="{ element }">
        <NoteCard :note="element" @click="emit('select', element)" />
      </template>
    </Draggable>

    <div v-else class="empty">No notes yet.</div>
  </div>
</template>

<style scoped>
.notes-grid-wrap {
  width: 100%;
}

.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  align-items: start;
}

.drag-ghost {
  opacity: 0.5;
}

.drag-chosen {
  opacity: 0.9;
}

.empty {
  font-size: 13px;
  color: var(--el-text-color-regular);
}
</style>
