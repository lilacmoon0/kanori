<script setup lang="ts"></script>

<template>
  <div class="app">
    <nav class="nav">
      <router-link class="brand" to="/">LMA</router-link>
      <router-link to="/">Dashboard</router-link>
      <router-link to="/focus-log">Focus Log</router-link>
      <router-link to="/day-summary">Day Summary</router-link>
    </nav>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.nav {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
  position: sticky;
  top: 0;
  z-index: 10;
}
.brand {
  font-weight: 700;
  margin-right: 8px;
}
.main {
  max-width: 1100px;
  margin: 0 auto;
}
</style>
