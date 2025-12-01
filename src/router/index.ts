import { createRouter, createWebHistory } from 'vue-router'

const Dashboard = () => import('../views/Dashboard.vue')
const FocusLog = () => import('../views/FocusLog.vue')
const TaskDetail = () => import('../views/TaskDetail.vue')
const DaySummary = () => import('../views/DaySummary.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'dashboard', component: Dashboard },
    { path: '/focus-log', name: 'focus-log', component: FocusLog },
    { path: '/tasks/:id', name: 'task-detail', component: TaskDetail },
    { path: '/day-summary', name: 'day-summary', component: DaySummary },
  ],
})

export default router
