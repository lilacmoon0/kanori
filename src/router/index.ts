import { createRouter, createWebHistory } from 'vue-router'
import { getAccessToken } from '../api/tokens'

const Dashboard = () => import('../views/Dashboard.vue')
const FocusLog = () => import('../views/FocusLog.vue')
const Time = () => import('../views/Time.vue')
const Notes = () => import('../views/Notes.vue')
const Login = () => import('../views/Login.vue')
const Register = () => import('../views/Register.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'dashboard', component: Dashboard },
    { path: '/login', name: 'login', component: Login, meta: { public: true } },
    { path: '/register', name: 'register', component: Register, meta: { public: true } },
    { path: '/notes', name: 'notes', component: Notes },
    { path: '/focus-log', name: 'focus-log', component: FocusLog },
    { path: '/time', name: 'time', component: Time },
  ],
})

router.beforeEach((to) => {
  const authed = !!getAccessToken()
  const isPublic = to.meta.public === true

  if (!authed && !isPublic) {
    return { path: '/login' }
  }

  if (authed && isPublic) {
    return { path: '/' }
  }

  return true
})

export default router
