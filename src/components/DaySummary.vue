<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDaySummaryStore } from '../stores/daySummaries'
import { Save } from 'lucide-vue-next'

const store = useDaySummaryStore()
const text = ref('')

onMounted(async () => {
  const s = await store.fetchToday()
  text.value = s?.summary_text || ''
})

async function save() {
  await store.saveToday(text.value)
}
</script>

<template>
  <el-card class="summary-card" shadow="never">
    <template #header>
      <div class="header">
        <span class="title">Day Summary</span>
        <el-tag size="small" type="info" effect="plain" round>
          {{ store.current?.total_focused_minutes ?? 0 }}m focused
        </el-tag>
      </div>
    </template>

    <div class="content-body">
      <el-input
        v-model="text"
        type="textarea"
        :rows="6"
        resize="none"
        placeholder="How did your day go?"
        class="custom-textarea"
      />
      
      <div class="actions">
        <el-button type="primary" class="save-btn" @click="save">
          <Save :size="16" />
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.summary-card {
  max-width: 600px; 
  margin: 0 auto;
  border-radius: 12px;
  border: 1px solid #e4e7ed;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.title {
  font-weight: 600;
  font-size: 1.1rem;
  color: #303133;
}
.content-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

:deep(.custom-textarea .el-textarea__inner) {
  padding: 12px;
  border-radius: 8px;
  background-color: #f9fafc; 
  border: 1px solid #dcdfe6;
  transition: all 0.2s ease;
  font-family: inherit;
  font-size: 0.95rem;
  line-height: 1.6;
}

:deep(.custom-textarea .el-textarea__inner:focus) {
  background-color: #fff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.save-btn {
  border-radius: 8px;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>