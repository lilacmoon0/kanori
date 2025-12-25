<script setup lang="ts">
import { computed, ref } from 'vue'
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

const isDragging = ref(false)
let dragEndTime = 0

function onNoteClick(note: Note) {
  if (isDragging.value || Date.now() - dragEndTime < 300) return
  emit('select', note)
}

function onDragEnd() {
  isDragging.value = false
  dragEndTime = Date.now()
}
</script>

<template>
  <div class="notes-list-outer" aria-label="Notes list">
    <div class="notes-list-scroll">
      <Draggable
        v-if="notes.length > 0"
        :list="model"
        item-key="id"
        class="notes-list"
        :animation="150"
        ghost-class="drag-ghost"
        chosen-class="drag-chosen"
        :delay="220"
        :delay-on-touch-only="true"
        :force-fallback="true"
        handle=".note-drag-handle"
        @start="isDragging = true"
        @end="onDragEnd"
      >
        <template #item="{ element }">
          <div class="card-row" :data-note-id="element.id">
            <NoteCard :note="element" @click="onNoteClick(element)" />
          </div>
        </template>
      </Draggable>
      <div v-else class="empty">No notes yet.</div>
    </div>
  </div>
</template>

<style scoped>
.notes-list-outer {
  width: 100%;
}

.notes-list-scroll {
  width: 100%;
  height: auto;
  min-height: 60vh;
  max-height: none;
  overflow-y: visible;
  overflow-x: hidden;
}

.notes-list {
  column-count: 2;
  column-gap: 12px;
  column-fill: balance;
  width: 100%;
  padding: 0;
  box-sizing: border-box;
}

.card-row {
  break-inside: avoid;
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 16px;
}

@media (min-width: 900px) {
  .notes-list {
    column-count: 4;
  }
}

@media (min-width: 1200px) {
  .notes-list {
    column-count: 6;
  }
}

@media (max-width: 899px) {
  .notes-list {
    column-count: 2 !important;
    max-width: 100vw;
  }
}

@media (min-width: 900px) {
  .notes-list {
    column-count: 4;
  }
}

@media (min-width: 1200px) {
  .notes-list {
    column-count: 6;
  }
}

@media (min-width: 900px) {
  .notes-list {
    column-count: 4;
  }
}

@media (min-width: 1200px) {
  .notes-list {
    column-count: 6;
  }
}


.note {
  display: block;
  width: 100%;
  box-sizing: border-box;
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
