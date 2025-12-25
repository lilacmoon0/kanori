<script setup lang="ts">
import type { Note } from '@/types'
import { GripVertical } from 'lucide-vue-next'

defineProps<{ note: Note }>()

const emit = defineEmits<{
  (e: 'click'): void
}>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('click')
  }
}
</script>

<template>
  <el-card
    class="note-card note--clickable"
    shadow="hover"
    :style="{ '--note-bg': note.background_color || '#ffffff' }"
    role="article"
    :aria-label="note.title || 'Note'"
    tabindex="0"
    @click="emit('click')"
    @keydown="onKeydown"
  >
    <div class="note-inner">
      <div class="note-header">
        <h4 v-if="note.title" class="note-title">{{ note.title }}</h4>
        <div v-else class="note-title placeholder">Untitled Note</div>
        
        <div class="note-drag-handle" title="Drag to reorder">
          <GripVertical :size="16" />
        </div>
      </div>
      
      <div v-if="note.content" class="note-content">
        {{ note.content }}
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.note-card {
  border-radius: 12px;
  border: 1px solid #e4e7ed;
  background-color: var(--note-bg);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  position: relative;
  overflow: hidden;
}

/* Subtle "App" touch: Add a semi-transparent overlay to colored notes 
   so the text remains highly readable regardless of background color */
.note-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: rgba(0, 0, 0, 0.05);
}

.note--clickable {
  cursor: pointer;
}

.note--clickable:hover {
  transform: translateY(-2px);
  border-color: #dcdfe6;
}

.note--clickable:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

/* Deep selector to fix Element Plus default padding */
:deep(.el-card__body) {
  padding: 16px !important;
}

.note-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.note-title {
  margin: 0;
  font-weight: 700;
  font-size: 1rem;
  line-height: 1.4;
  color: #1d1e1f;
  word-break: break-word;
}

.note-title.placeholder {
  color: #a8abb2;
  font-style: italic;
  font-weight: 400;
}

.note-drag-handle {
  color: #909399;
  cursor: grab;
  padding: 2px;
  border-radius: 4px;
  transition: background 0.2s;
  flex-shrink: 0;
}

.note-drag-handle:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #606266;
}

.note-content {
  font-size: 0.9rem;
  line-height: 1.6;
  color: #4c4d4f;
  white-space: pre-wrap;
  word-break: break-word;
  /* Limit height for grid consistency if needed */
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>