<script setup lang="ts">
import type { Note } from '@/types'

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
    class="note note--clickable"
    shadow="never"
    :style="{ background: note.background_color || '#ffffff' }"
    role="article"
    :aria-label="note.title || 'Note'"
    tabindex="0"
    @click="emit('click')"
    @keydown="onKeydown"
  >
    <div class="note-title">{{ note.title }}</div>
    <div v-if="note.content" class="note-content">{{ note.content }}</div>
  </el-card>
</template>

<style scoped>
.note {
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
}

.note--clickable {
  cursor: pointer;
}

.note--clickable:hover {
  border-color: var(--el-border-color);
}

.note--clickable:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.note :deep(.el-card__body) {
  padding: 12px;
}

.note-title {
  font-weight: 800;
  color: var(--el-text-color-primary);
  margin-bottom: 6px;
  word-break: break-word;
}

.note-content {
  white-space: pre-wrap;
  color: var(--el-text-color-regular);
  word-break: break-word;
}
</style>
