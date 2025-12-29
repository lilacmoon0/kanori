<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
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
const overlayOrFocusNow = ref(false)
let overlayObserver: MutationObserver | null = null

function isVisible(el: Element | null): boolean {
  if (!el) return false
  const style = window.getComputedStyle(el)
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
}

function checkOverlays() {
  if (typeof document === 'undefined') return
  // Check for visible Element Plus overlays/dialogs
  const modalSelectors = ['.el-overlay', '.el-dialog__wrapper', '.v-modal', '[role="dialog"]']
  let found = false
  for (const sel of modalSelectors) {
    const el = document.querySelector(sel)
    if (el && isVisible(el)) {
      found = true
      break
    }
  }
  // Check for visible FocusNow overlay
  if (!found) {
    const focusNow = document.querySelector('.focus-overlay')
    if (focusNow && isVisible(focusNow)) found = true
  }
  overlayOrFocusNow.value = found
}

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
  checkOverlays()
  overlayObserver = new MutationObserver(() => checkOverlays())
  overlayObserver.observe(document.body, { childList: true, subtree: true })
})

onBeforeUnmount(() => {
  if (overlayObserver) overlayObserver.disconnect()
})
</script>

<template>
  <div class="page-container page-container--full notes-page-container">
    <div class="notes-page" :class="{ 'has-modal': showCreate || showEdit || overlayOrFocusNow }">
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
  right: 2rem;
  bottom: 2rem;
  z-index: 200;

  width: 58px;
  height: 58px;
  border: none;

  background: linear-gradient(135deg, #f26592 0%, #8d1f5e 100%) !important;
  color: white !important;

  box-shadow: 0 10px 20px rgba(141, 31, 94, 0.25);

  transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  cursor: pointer;
}

.notes-fab:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 25px rgba(141, 31, 94, 0.35);
}

.notes-fab:active {
  transform: translateY(-2px) scale(0.92);
}

@media (max-width: 48rem) {
  body .notes-fab {
    right: 1.5rem;
    bottom: 12.5rem !important;
    width: 62px;
    height: 62px;
  }
}

.notes-fab {
  outline: none;
}

/* Move FAB up when modal or FocusNow overlay is open */
.notes-page.has-modal .notes-fab {
  bottom: 8rem;
}

/* Move FAB up when modal is open */
.notes-page.has-modal .notes-fab {
  bottom: 8rem;
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
