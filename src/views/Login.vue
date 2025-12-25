<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import type { FormInstance, FormRules } from 'element-plus'
import { LogIn } from 'lucide-vue-next'

defineOptions({ name: 'AuthLogin' })

const router = useRouter()
const auth = useAuthStore()

const submitting = ref(false)

const form = reactive({
  identifier: '',
  password: '',
})

const identifierIsEmail = computed(() => form.identifier.includes('@'))

const rules: FormRules = {
  identifier: [{ required: true, message: 'Enter username or email', trigger: 'blur' }],
  password: [{ required: true, message: 'Password is required', trigger: 'blur' }],
}

const formRef = ref<FormInstance>()

async function onSubmit() {
  auth.clearError()
  const ok = await formRef.value?.validate?.().catch(() => false)
  if (!ok) return

  submitting.value = true
  try {
    const identifier = form.identifier.trim()
    await auth.login({
      password: form.password,
      ...(identifierIsEmail.value ? { email: identifier } : { username: identifier }),
    })
    await router.push('/')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-shell">
      <div class="auth-branding">
        <h1 class="auth-brand-name">Kanori</h1>
        <p class="auth-subtitle">Welcome back!</p>
      </div>

      <el-card class="premium-card">
        <el-alert
          v-if="auth.error"
          type="error"
          :title="auth.error"
          show-icon
          :closable="false"
          class="auth-alert"
        />

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @keyup.enter="onSubmit">
          <el-form-item :label="identifierIsEmail ? 'Email Address' : 'Username'" prop="identifier">
            <el-input
              v-model="form.identifier"
              :type="identifierIsEmail ? 'email' : 'text'"
              placeholder="you@example.com"
              class="premium-input"
            />
          </el-form-item>

          <el-form-item label="Password" prop="password">
            <el-input 
              v-model="form.password" 
              type="password" 
              show-password 
              placeholder="••••••••"
              class="premium-input"
            />
          </el-form-item>

          <div class="auth-actions">
            <el-button 
              class="submit-btn" 
              :loading="submitting" 
              @click="onSubmit"
            >
              <LogIn v-if="!submitting" :size="18" style="margin-right: 8px" />
              Sign In
            </el-button>
            <div class="footer-links">
              <span>Don't have an account?</span>
              <RouterLink class="auth-link" to="/register">Sign up</RouterLink>
            </div>
          </div>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  z-index: 1000;
  
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;

  background-color: #ffffff;
  background: 
    radial-gradient(circle at top right, rgba(104, 158, 187, 0.18) 0%, transparent 60%),
    radial-gradient(circle at bottom left, rgba(242, 101, 146, 0.18) 0%, transparent 60%),
    radial-gradient(circle at center, rgba(104, 158, 187, 0.04) 0%, transparent 70%);
}

.auth-shell {
  width: 100%;
  max-width: 400px;
  animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  margin: 0;
  position: relative;
  z-index: 2;
}

.auth-branding {
  text-align: center;
  margin-bottom: 2rem;
}

.auth-brand-name {
  font-size: 2.2rem;
  font-weight: 900;
  margin: 0;
  letter-spacing: -0.04em;
  background: linear-gradient(135deg, #8d1f5e, #f26592);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 4px 10px rgba(141, 31, 94, 0.15));
}

.auth-subtitle {
  color: #475569;
  font-size: 0.95rem;
  font-weight: 600;
  margin-top: 0.5rem;
}

.premium-card {
  border: 1px solid rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.7) !important;
  backdrop-filter: blur(30px) saturate(160%);
  border-radius: 28px;
  box-shadow: 0 25px 50px -12px rgba(104, 158, 187, 0.15);
}

.premium-card :deep(.el-card__body) {
  padding: 32px 24px;
}

.premium-input :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(104, 158, 187, 0.1);
  border-radius: 14px;
  padding: 10px 14px;
  transition: all 0.25s ease;
}

.premium-input :deep(.el-input__wrapper.is-focus) {
  border-color: #f26592; 
  background: white;
  box-shadow: 0 0 0 4px rgba(242, 101, 146, 0.1) !important;
}

.auth-actions {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.submit-btn {
  width: 100%;
  height: 52px;
  border-radius: 16px;
  border: none;
  background: linear-gradient(135deg, #8d1f5e, #f26592) !important;
  color: white !important;
  font-weight: 700;
  font-size: 1rem;
  box-shadow: 0 10px 20px -5px rgba(242, 101, 146, 0.3);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.submit-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 15px 25px -5px rgba(242, 101, 146, 0.4);
}

.auth-link {
  color: #689ebb; 
  text-decoration: none;
  font-weight: 800;
  margin-left: 6px;
}

.auth-link:hover {
  color: #f26592;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>