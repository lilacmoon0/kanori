<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Note } from '@/types'
import { deleteNote, updateNote } from '@/api/notes'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ modelValue: boolean; note: Note | null }>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'updated', note: Note): void
  (e: 'deleted', id: number): void
}>()

const authStore = useAuthStore()

const title = ref('')
const content = ref('')
const backgroundColor = ref('#ffffff')

const palette = ['#ffffff', '#fef3c7', '#fee2e2', '#ecfccb', '#e0f2fe', '#ede9fe', '#f3f4f6']

const saving = ref(false)
const deleting = ref(false)
const error = ref<string | null>(null)

const canSubmit = computed(() => {
  if (!authStore.isAuthenticated) return false
  return title.value.trim().length > 0 || content.value.trim().length > 0
})

watch(
  () => [props.modelValue, props.note] as const,
  ([open, note]) => {
    if (!open) return
    title.value = note?.title ?? ''
    content.value = note?.content ?? ''
    backgroundColor.value = note?.background_color ?? '#ffffff'
    error.value = null
  },
)

async function onSave() {
  if (!props.note) return
  if (!canSubmit.value) return

  saving.value = true
  error.value = null
  try {
    const updated = await updateNote(props.note.id, {
      title: title.value.trim() || 'Untitled',
      content: content.value.trim(),
      background_color: backgroundColor.value || '#ffffff',
    })
    emit('updated', updated)
    emit('update:modelValue', false)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  if (!props.note) return
  if (!authStore.isAuthenticated) return

  deleting.value = true
  error.value = null
  try {
    await deleteNote(props.note.id)
    emit('deleted', props.note.id)
    emit('update:modelValue', false)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    deleting.value = false
  }
}

function onClose() {
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="Edit note"
    width="min(520px, 92vw)"
    @close="onClose"
    :close-on-click-modal="!saving && !deleting"
    :close-on-press-escape="!saving && !deleting"
  >
    <el-alert
      v-if="!authStore.isAuthenticated"
      type="info"
      show-icon
      title="Login to edit notes."
      style="margin-bottom: 10px"
    />

    <el-alert
      v-else-if="!note"
      type="warning"
      show-icon
      title="No note selected."
      style="margin-bottom: 10px"
    />

    <el-form label-position="top">
      <el-form-item label="Title">
        <el-input
          v-model="title"
          :disabled="!authStore.isAuthenticated || !note"
          maxlength="120"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="Note">
        <el-input
          v-model="content"
          type="textarea"
          :rows="6"
          placeholder="Take a note…"
          :disabled="!authStore.isAuthenticated || !note"
        />
      </el-form-item>

      <el-form-item label="Background">
        <div class="palette" :aria-disabled="!authStore.isAuthenticated || !note">
          <button
            v-for="c in palette"
            :key="c"
            class="swatch"
            type="button"
            :disabled="!authStore.isAuthenticated || !note"
            :aria-label="`Select ${c}`"
            :aria-pressed="backgroundColor === c"
            :data-selected="backgroundColor === c"
            :style="{ background: c }"
            @click="backgroundColor = c"
          />
        </div>
      </el-form-item>

      <el-alert v-if="error" :title="error" type="error" show-icon />
    </el-form>

    <template #footer>
      <div style="display: flex; justify-content: space-between; width: 100%">
        <el-popconfirm
          title="Delete this note?"
          confirm-button-text="Delete"
          cancel-button-text="Cancel"
          confirm-button-type="danger"
          :disabled="!authStore.isAuthenticated || !note || saving || deleting"
          @confirm="onDelete"
        >
          <template #reference>
            <el-button type="danger" plain :loading="deleting" :disabled="!authStore.isAuthenticated || !note || saving">
              Delete
            </el-button>
          </template>
        </el-popconfirm>

        <div>
          <el-button :disabled="saving || deleting" @click="onClose">Cancel</el-button>
          <el-button type="primary" :loading="saving" :disabled="!canSubmit || !note || deleting" @click="onSave">
            Save
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.palette {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.swatch {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid var(--el-border-color);
  cursor: pointer;
}

.swatch[data-selected='true'] {
  border: 2px solid var(--el-color-primary);
}

.swatch:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.swatch:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
</style>
