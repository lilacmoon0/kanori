<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { Note } from '@/types'
import { fetchNotes } from '@/api/notes'
import NotesGrid from '@/components/NotesGrid.vue'
import NoteCreateModal from '@/components/NoteCreateModal.vue'
import NoteEditModal from '@/components/NoteEditModal.vue'
import { Plus } from 'lucide-vue-next'

const authStore = useAuthStore()

const notes = ref<Note[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const showCreate = ref(false)
const showEdit = ref(false)
const editingNote = ref<Note | null>(null)

async function loadNotes() {
  if (!authStore.isAuthenticated) return
  loading.value = true
  error.value = null
  try {
    notes.value = await fetchNotes()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function onCreated(note: Note) {
  notes.value = [note, ...notes.value]
}

function onSelectNote(note: Note) {
  editingNote.value = note
  showEdit.value = true
}

function onUpdatedNote(note: Note) {
  const idx = notes.value.findIndex((n) => n.id === note.id)
  if (idx !== -1) notes.value.splice(idx, 1, note)
  if (editingNote.value?.id === note.id) editingNote.value = note
}

function onDeletedNote(id: number) {
  notes.value = notes.value.filter((n) => n.id !== id)
  if (editingNote.value?.id === id) editingNote.value = null
}

function onReorder(next: Note[]) {
  notes.value = next
}

watch(
  () => authStore.isAuthenticated,
  (authed) => {
    if (!authed) {
      notes.value = []
      return
    }
    void loadNotes()
  },
  { immediate: true },
)

onMounted(() => {
  void loadNotes()
})
</script>

<template>
  <div class="page-container page-container--full notes-page-container">
    <div class="notes-page">
      <el-alert
        v-if="!authStore.isAuthenticated"
        type="info"
        show-icon
        title="Login to create and view notes."
      />

      <div v-if="error" class="error">{{ error }}</div>
      <div v-else-if="loading" class="loading">Loading notes…</div>

      <div v-else class="notes-cards-container">
        <el-card class="notes-container" shadow="never">
          <NotesGrid :notes="notes" @select="onSelectNote" @reorder="onReorder" />
        </el-card>
      </div>

      <NoteCreateModal v-model="showCreate" @created="onCreated" />
      <NoteEditModal
        v-model="showEdit"
        :note="editingNote"
        @updated="onUpdatedNote"
        @deleted="onDeletedNote"
      />

      <el-button
        class="notes-fab"
        circle
        type="primary"
        aria-label="Create note"
        title="Create note"
        @click="showCreate = true"
      >
        <Plus :size="26" />
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.notes-page-container {
  min-height: calc(100vh - 3.5rem);
  display: flex;
}

.notes-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.top-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.notes-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notes-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--el-text-color-primary);
}

.notes-sub {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.notes-cards-container {
  width: 100%;
  max-width: none;
  padding: 0;
  flex: 1;
  min-height: 0;
  display: flex;
}

.notes-container {
  width: 100%;
  border-radius: 14px;
  flex: 1;
  min-height: 0;
  display: flex;
}

.notes-container :deep(.el-card__body) {
  padding: 12px;
  flex: 1;
  min-height: 0;
  overflow: auto;
}


.notes-fab {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 20;
  width: 64px;
  height: 64px;
}

@media (max-width: 640px) {
  .top-row {
    flex-direction: column;
  }

  .notes-container :deep(.el-card__body) {
    padding: 10px;
  }

  .notes-fab {
    right: 14px;
    bottom: 14px;
    width: 72px;
    height: 72px;
  }
}

.loading,
.error {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.error {
  color: var(--el-color-danger);
}
</style>
