<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import type { FormInstance, FormRules } from 'element-plus'
import { UserPlus } from 'lucide-vue-next'

defineOptions({ name: 'AuthRegister' })

const router = useRouter()
const auth = useAuthStore()

const submitting = ref(false)

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const rules: FormRules = {
  username: [{ required: true, message: 'Username is required', trigger: 'blur' }],
  email: [{ required: true, message: 'Email is required', trigger: 'blur' }],
  password: [{ required: true, message: 'Password is required', trigger: 'blur' }],
  confirmPassword: [
    { required: true, message: 'Confirm password is required', trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, cb: (err?: Error) => void) => {
        if (value !== form.password) cb(new Error('Passwords do not match'))
        else cb()
      },
      trigger: 'blur',
    },
  ],
}

const formRef = ref<FormInstance>()

async function onSubmit() {
  auth.clearError()
  const ok = await formRef.value?.validate?.().catch(() => false)
  if (!ok) return

  submitting.value = true
  try {
    await auth.register({
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
      password_confirm: form.confirmPassword,
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
        <p class="auth-subtitle">Will help you manage your life.</p>
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
          <el-form-item label="Username" prop="username">
            <el-input 
              v-model="form.username" 
              placeholder="Pick a unique name"
              class="premium-input"
            />
          </el-form-item>

          <el-form-item label="Email Address" prop="email">
            <el-input 
              v-model="form.email" 
              type="email" 
              placeholder="you@example.com"
              class="premium-input"
            />
          </el-form-item>

          <el-form-item label="Password" prop="password">
            <el-input 
              v-model="form.password" 
              type="password" 
              show-password 
              placeholder="Strong password"
              class="premium-input"
            />
          </el-form-item>

          <el-form-item label="Confirm Password" prop="confirmPassword">
            <el-input 
              v-model="form.confirmPassword" 
              type="password" 
              show-password 
              placeholder="Repeat password"
              class="premium-input"
            />
          </el-form-item>

          <div class="auth-actions">
            <el-button 
              class="submit-btn" 
              :loading="submitting" 
              @click="onSubmit"
            >
              <UserPlus v-if="!submitting" :size="18" style="margin-right: 8px" />
              Create account
            </el-button>
            <div class="footer-links">
              <span>Already have an account?</span>
              <RouterLink class="auth-link" to="/login"> Sign in</RouterLink>
            </div>
          </div>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
/* 1. The main container is now a fixed 'Stage' that never moves */
.auth-page {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100dvh;
  
  /* This ensures the background is pinned to the glass of the phone screen */
  background-color: #ffffff;
  background-image: 
    radial-gradient(circle at top right, rgba(104, 158, 187, 0.18) 0%, transparent 60%),
    radial-gradient(circle at bottom left, rgba(242, 101, 146, 0.18) 0%, transparent 60%),
    radial-gradient(circle at center, rgba(104, 158, 187, 0.04) 0%, transparent 70%);
  
  /* This allows the CONTENT to scroll inside the fixed stage */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch; /* Smooth physics for iOS */
  
  display: flex;
  justify-content: center;
  padding: 20px;
}

/* 2. The Shell handles the actual scrolling/centering */
.auth-shell {
  width: 100%;
  max-width: 400px;
  /* margin: auto ensures it centers when small, but allows top-align when tall */
  margin: auto 0; 
  padding: 40px 0; /* Extra space so you don't scroll 'out' of the branding */
  z-index: 2;
  animation: fadeIn 0.8s ease-out;
}

.auth-branding {
  text-align: center;
  margin-bottom: 1.5rem;
}

.auth-brand-name {
  font-size: 2.2rem;
  font-weight: 900;
  background: linear-gradient(135deg, #8d1f5e, #f26592);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.premium-card {
  border: 1px solid rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.7) !important;
  backdrop-filter: blur(30px) saturate(160%);
  border-radius: 28px;
  box-shadow: 0 25px 50px -12px rgba(104, 158, 187, 0.15);
}

.premium-card :deep(.el-card__body) {
  padding: 24px;
}

:deep(.el-form-item) {
  margin-bottom: 14px;
}

.premium-input :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
}

.submit-btn {
  width: 100%;
  height: 52px;
  border-radius: 16px;
  background: linear-gradient(135deg, #8d1f5e, #f26592) !important;
  color: white !important;
  font-weight: 700;
  border: none;
}

.footer-links {
  text-align: center;
  margin-top: 1rem;
}

.auth-link {
  color: #689ebb;
  font-weight: 800;
  text-decoration: none;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.auth-page::-webkit-scrollbar {
  display: none;
}
</style>