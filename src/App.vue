<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LogOut, LayoutGrid, Clock, StickyNote, Target } from 'lucide-vue-next'
import { useAuthStore } from './stores/auth'
import FocusNow from './components/FocusNow.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const activePath = computed(() => route.path)
const isAuthed = computed(() => auth.isAuthenticated)

const mobileNavOpen = ref(false)

watch(
  () => route.path,
  () => {
    mobileNavOpen.value = false
  },
)

async function onLogout() {
  auth.logout()
  await router.push('/login')
}
</script>

<template>
  <el-container class="app-shell">
    <el-header class="app-header" height="3.5rem">
      <div class="header-inner">
        <RouterLink class="brand" :to="isAuthed ? '/' : '/login'">
          <img class="brand__logo" src="/mascot.png" />
          <span class="brand__text">Kanori</span>
        </RouterLink>

        <el-menu
          v-if="isAuthed"
          class="app-menu app-menu--desktop"
          mode="horizontal"
          :default-active="activePath"
          router
        >
          <el-menu-item index="/">
            <LayoutGrid :size="16" /> Kanban
          </el-menu-item>
          <el-menu-item index="/time">
            <Clock :size="16" /> Timeline
          </el-menu-item>
          <el-menu-item index="/notes">
            <StickyNote :size="16" /> Notes
          </el-menu-item>
          <el-menu-item index="/focus-log">
            <Target :size="16" /> Focus Map
          </el-menu-item>
        </el-menu>

        <div class="header-right">
          <el-button v-if="isAuthed" class="logout-link" text @click="onLogout">
            <LogOut :size="18" /> <span class="logout-text">Logout</span>
          </el-button>
        </div>
      </div>
    </el-header>

    <nav v-if="isAuthed" class="mobile-bottom-nav">
      <div class="nav-pills">
        <RouterLink to="/" class="nav-pill" :class="{ active: activePath === '/' }">
          <LayoutGrid :size="20" />
          <span>Kanban</span>
        </RouterLink>
        <RouterLink to="/time" class="nav-pill" :class="{ active: activePath === '/time' }">
          <Clock :size="20" />
          <span>Time</span>
        </RouterLink>
        <RouterLink to="/notes" class="nav-pill" :class="{ active: activePath === '/notes' }">
          <StickyNote :size="20" />
          <span>Notes</span>
        </RouterLink>
        <RouterLink to="/focus-log" class="nav-pill" :class="{ active: activePath === '/focus-log' }">
          <Target :size="20" />
          <span>Map</span>
        </RouterLink>
      </div>
    </nav>

    <el-main class="app-main">
      <Suspense>
        <RouterView />
        <template #fallback>
          <div class="page-container">
            <el-skeleton :rows="6" animated />
          </div>
        </template>
      </Suspense>
    </el-main>

    <FocusNow />
  </el-container>
</template>

<style scoped>
/* Kanori Brand Colors */
:deep(:root) {
  --kanori-blue: #689ebb;
  --kanori-pink: #f26592;
  --kanori-plum: #8d1f5e;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(104, 158, 187, 0.15);
}

.header-inner {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  max-width: 1500px;
  margin: 0 auto;
  padding: 0 clamp(0.75rem, 2vw, 1rem);
}

.brand {
  height: 100%;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.brand__logo {
  height: 1.8rem;
  width: auto;
  object-fit: contain;
}

.brand__text {
  font-weight: 800;
  font-size: 1.2rem;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, #f26592, #8d1f5e);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.app-menu--desktop {
  flex: 1;
  background: transparent;
  border: none;
  height: 100%;
  display: flex;
  align-items: center;
  margin-left: 1.5rem;
}

.app-menu--desktop:deep(.el-menu-item) {
  border-bottom: none !important;
  border-radius: 8px;
  margin: 0 4px;
  height: 2.2rem;
  line-height: 2.2rem;
  font-weight: 600;
  color: #64748b;
  gap: 6px;
}

.app-menu--desktop:deep(.el-menu-item.is-active) {
  background: rgba(104, 158, 187, 0.1) !important;
  color: #689ebb !important;
}

.app-menu--desktop:deep(.el-menu-item:hover) {
  color: #f26592;
  background: rgba(242, 101, 146, 0.05);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logout-link {
  font-weight: 600;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 6px;
}
.logout-link:hover { color: #8d1f5e; }

/* Mobile Bottom Nav Styling */
.mobile-bottom-nav {
  display: none;
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: calc(100% - 2rem);
  max-width: 400px;
}

.nav-pills {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(104, 158, 187, 0.2);
  padding: 6px;
  border-radius: 20px;
  display: flex;
  justify-content: space-around;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

.nav-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: #94a3b8;
  gap: 2px;
  padding: 8px 12px;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.nav-pill span { font-size: 10px; font-weight: 700; }
.nav-pill.active { color: #689ebb; background: rgba(104, 158, 187, 0.08); }
.nav-pill.active :deep(svg) { color: #f26592; }

.app-main {
  padding: 0;
  overflow-x: hidden;
}

@media (max-width: 48rem) {
  .app-menu--desktop, .logout-text {
    display: none;
  }
  .mobile-bottom-nav {
    display: block;
  }
  .header-right {
    margin-left: auto;
  }
  .app-main {
    padding-bottom: 80px;
  }
}
/* Disable the mobile tap highlight box */
* {
  -webkit-tap-highlight-color: transparent;
}
</style>