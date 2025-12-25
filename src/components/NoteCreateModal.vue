<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createNote } from '@/api/notes'
import type { Note } from '@/types'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ modelValue: boolean }>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'created', note: Note): void
}>()

const authStore = useAuthStore()

const title = ref('')
const content = ref('')
const backgroundColor = ref('#ffffff')

const palette = ['#ffffff', '#fef3c7', '#fee2e2', '#ecfccb', '#e0f2fe', '#ede9fe', '#f3f4f6']

const saving = ref(false)
const error = ref<string | null>(null)

const canSubmit = computed(() => {
  if (!authStore.isAuthenticated) return false
  return title.value.trim().length > 0 || content.value.trim().length > 0
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    title.value = ''
    content.value = ''
    backgroundColor.value = '#ffffff'
    error.value = null
  },
)

async function onCreate() {
  if (!canSubmit.value) return
  saving.value = true
  error.value = null
  try {
    const created = await createNote({
      title: title.value.trim() || 'Untitled',
      content: content.value.trim(),
      background_color: backgroundColor.value || '#ffffff',
    })
    emit('created', created)
    emit('update:modelValue', false)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

function onClose() {
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="New note"
    width="min(520px, 92vw)"
    @close="onClose"
    :close-on-click-modal="!saving"
    :close-on-press-escape="!saving"
  >
    <el-alert
      v-if="!authStore.isAuthenticated"
      type="info"
      show-icon
      title="Login to create notes."
      style="margin-bottom: 10px"
    />

    <el-form label-position="top">
      <el-form-item label="Title">
        <el-input v-model="title" :disabled="!authStore.isAuthenticated" maxlength="120" show-word-limit />
      </el-form-item>

      <el-form-item label="Note">
        <el-input
          v-model="content"
          type="textarea"
          :rows="6"
          placeholder="Take a note…"
          :disabled="!authStore.isAuthenticated"
        />
      </el-form-item>

      <el-form-item label="Background">
        <div class="palette" :aria-disabled="!authStore.isAuthenticated">
          <button
            v-for="c in palette"
            :key="c"
            class="swatch"
            type="button"
            :disabled="!authStore.isAuthenticated"
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
      <el-button :disabled="saving" @click="onClose">Cancel</el-button>
      <el-button type="primary" :loading="saving" :disabled="!canSubmit" @click="onCreate">
        Create
      </el-button>
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
