<script setup lang="ts">
import { computed, ref, watch, provide, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import {
  IconArrowsDiff,
  IconBuildingStore,
  IconBuildingWarehouse,
  IconLayoutDashboard,
  IconListDetails,
  IconPackage,
  IconReportAnalytics,
  IconChartBar,
  IconSettings,
  IconShieldLock,
  IconStar,
  IconUsers,
} from '@tabler/icons-vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const pageTitle = computed(() => (route.meta.title as string) || 'Inventarios')
const pageSection = computed(() => (route.meta.section as string) || 'Inventarios fisicos')
const isWarehouses = computed(() => route.name === 'almacenes')

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

const isSidebarCompact = ref(false)
const compactStorageKey = 'inventarios.sidebar.compact'
const isMobileNavOpen = ref(false)
const isMobile = ref(false)

if (typeof window !== 'undefined') {
  const saved = window.localStorage.getItem(compactStorageKey)
  if (saved !== null) {
    isSidebarCompact.value = saved === 'true'
  }
}

watch(isSidebarCompact, (value) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(compactStorageKey, String(value))
  }
})

watch(
  () => route.fullPath,
  () => {
    isMobileNavOpen.value = false
  },
)

const toggleSidebar = () => {
  isSidebarCompact.value = !isSidebarCompact.value
}

const toggleMobileNav = () => {
  isMobileNavOpen.value = !isMobileNavOpen.value
}

provide('toggleMobileNav', toggleMobileNav)
provide('isMobileNavOpen', isMobileNavOpen)

const updateIsMobile = () => {
  if (typeof window === 'undefined') return
  isMobile.value = window.matchMedia('(max-width: 1024px)').matches
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('resize', updateIsMobile)
})

const navSections = computed(() => [
  {
    title: 'Operacion',
    links: [
      {
        label: 'Dashboard',
        to: '/conteos/dashboard',
        icon: IconLayoutDashboard,
      },
      {
        label: 'Listado de conteos',
        to: '/conteos/listado',
        icon: IconListDetails,
      },
    ],
  },
  {
    title: 'Solicitudes',
    links: [
      {
        label: 'Diferencias',
        to: '/solicitudes',
        icon: IconArrowsDiff,
      },
    ],
  },
  {
    title: 'Reportes',
    hidden: !authStore.hasPermission('reports.view'),
    links: [
      {
        label: 'Reportes & auditoria',
        to: '/reportes',
        icon: IconReportAnalytics,
      },
      {
        label: 'Cobertura de Inventarios',
        to: '/reportes/cobertura',
        icon: IconChartBar,
      },
    ],
  },
  {
    title: 'Catalogos',
    hidden: !authStore.hasPermission('stock.view'),
    links: [
      {
        label: 'Sucursales',
        to: '/catalogos/sucursales',
        icon: IconBuildingStore,
      },
      {
        label: 'Articulos',
        to: '/catalogos/articulos',
        icon: IconPackage,
      },
      {
        label: 'Almacenes',
        to: '/almacenes',
        icon: IconBuildingWarehouse,
      },
    ],
  },
  {
    title: 'Seguridad',
    hidden: !authStore.hasPermission('all'),
    links: [
      {
        label: 'Usuarios',
        to: '/usuarios',
        icon: IconUsers,
      },
      {
        label: 'Roles y permisos',
        to: '/roles',
        icon: IconShieldLock,
      },
    ],
  },
  {
    title: 'Configuracion',
    hidden: !authStore.hasPermission('all'),
    links: [
      {
        label: 'Lineas especiales',
        to: '/lineas-especiales',
        icon: IconStar,
      },
      {
        label: 'Parametros',
        to: '/configuracion',
        icon: IconSettings,
      },
    ],
  },
].filter(section => !section.hidden))
</script>

<template>
  <!-- Layout completo con sidebar (solo cuando esta autenticado) -->
  <div
    v-if="authStore.isAuthenticated"
    class="shell"
    :class="{
      'shell--compact': isSidebarCompact && !isMobile,
      'shell--mobile-open': isMobileNavOpen,
      'shell--warehouses': isWarehouses,
    }"
  >
    <aside
      class="sidebar"
      :class="{
        'sidebar--compact': isSidebarCompact && !isMobile,
        'sidebar--open': isMobileNavOpen,
      }"
    >
      <div class="brand">
        <img class="brand-mark" src="/meta.png" alt="Logo Inventarios" />

        <button
          class="sidebar-toggle"
          type="button"
          @click="toggleSidebar"
          :aria-label="isSidebarCompact ? 'Expandir menu' : 'Compactar menu'"
        >
          {{ isSidebarCompact ? '>>' : '<<' }}
        </button>
      </div>

      <div class="nav">
        <div v-for="section in navSections" :key="section.title" class="nav-group">
          <p class="nav-title">{{ section.title }}</p>
          <RouterLink
            v-for="link in section.links"
            :key="link.to"
            :to="link.to"
            class="nav-link"
            active-class="nav-link-active"
            :title="link.label"
            :aria-label="link.label"
            :data-label="link.label"
          >
            <span class="nav-icon" aria-hidden="true">
              <component :is="link.icon" :size="18" :stroke-width="1.8" />
            </span>
            <span class="nav-label">{{ link.label }}</span>
          </RouterLink>
        </div>
      </div>

      <div class="sidebar-actions">
        <div class="sidebar-user">
          <span class="user-name">{{ authStore.userName }}</span>
          <span class="user-role">{{ authStore.userRole }}</span>
        </div>
        <button class="btn ghost logout-btn" @click="handleLogout">Cerrar sesion</button>
      </div>
    </aside>

    <div v-if="isMobileNavOpen" class="sidebar-backdrop" @click="toggleMobileNav"></div>

    <div class="content">
      <header class="topbar">
        <div class="topbar-left">
          <button
            class="menu-toggle"
            type="button"
            :data-open="isMobileNavOpen"
            :aria-label="isMobileNavOpen ? 'Cerrar menu' : 'Abrir menu'"
            :aria-expanded="isMobileNavOpen"
            @click="toggleMobileNav"
          >
            <span></span>
          </button>
          <p class="eyebrow">{{ pageSection }}</p>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="top-actions">
          <div class="user-info">
            <div class="user-details">
              <span class="user-name">{{ authStore.userName }}</span>
              <span class="user-role">{{ authStore.userRole }}</span>
            </div>
            <button class="btn" @click="handleLogout">Cerrar sesion</button>
          </div>
        </div>
      </header>

      <main class="page">
        <RouterView />
      </main>
    </div>
  </div>

  <!-- Vista sin layout (para login) -->
  <div v-else class="login-container">
    <RouterView />
  </div>
</template>

<style scoped>
.login-container {
  position: fixed;
  inset: 0;
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 12% 20%, rgba(241, 99, 24, 0.42), transparent 34%),
    radial-gradient(circle at 86% 82%, rgba(0, 33, 85, 0.55), transparent 36%),
    radial-gradient(circle at 58% 10%, rgba(255, 255, 255, 0.18), transparent 30%),
    linear-gradient(132deg, #003a76 0%, #0056ad 40%, #0a66c2 62%, #f16318 82%, #8b3706 100%);
  background-size: 240% 240%, 240% 240%, 200% 200%, 240% 240%;
  animation: loginBackgroundDrift 16s ease-in-out infinite alternate;
  will-change: background-position;
  padding: 2rem 1.25rem;
  overflow-y: auto;
}

@keyframes loginBackgroundDrift {
  0% {
    background-position: 0% 0%, 100% 100%, 50% 0%, 0% 50%;
  }
  35% {
    background-position: 38% 18%, 74% 76%, 20% 32%, 38% 52%;
  }
  70% {
    background-position: 78% 22%, 34% 86%, 84% 20%, 100% 54%;
  }
  100% {
    background-position: 100% 10%, 0% 90%, 50% 100%, 0% 50%;
  }
}

.shell {
  display: flex;
  align-items: stretch;
  gap: clamp(0.6rem, 1.2vw, 1rem);
  min-height: 100vh;
  padding: 0 clamp(0.75rem, 1.6vw, 1.4rem) 0 0;
  width: 100%;
  max-width: none;
  margin: 0;
}

.sidebar {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 1.25rem;
  box-shadow: var(--surface-glow);
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  overflow-x: visible;
  min-width: 0;
  width: clamp(210px, 18vw, 240px);
  flex: 0 0 clamp(210px, 18vw, 240px);
  display: flex;
  flex-direction: column;
}

.shell--compact {
  gap: clamp(0.4rem, 0.9vw, 0.7rem);
}

.shell--compact .sidebar {
  width: clamp(72px, 8vw, 96px);
  flex-basis: clamp(72px, 8vw, 96px);
}

.sidebar--compact {
  padding: 0.8rem 0.5rem;
}

.sidebar--compact .brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.sidebar--compact .brand-text {
  display: none;
}

.sidebar--compact .sidebar-toggle {
  margin-left: 0;
  position: static;
  transform: none;
}

.sidebar--compact .nav {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.sidebar--compact .nav-title {
  display: none;
}

.sidebar--compact .nav-link {
  justify-content: center;
  padding: 0.45rem;
}

.sidebar--compact .nav-label {
  display: none;
}

.sidebar--compact .nav-link::after {
  content: attr(data-label);
  position: absolute;
  left: calc(100% + 0.6rem);
  top: 50%;
  transform: translateY(-50%);
  background: #111827;
  color: #fff;
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  font-size: 0.8rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.15);
  transition: opacity 0.15s ease;
  z-index: 10;
}

.sidebar--compact .nav-link:hover::after,
.sidebar--compact .nav-link:focus-visible::after {
  opacity: 1;
}

.sidebar--compact .nav-group + .nav-group {
  margin-top: 0.65rem;
  padding-top: 0.65rem;
}

.brand {
  display: block;
  text-align: center;
  margin-bottom: 1.25rem;
  width: 100%;
  position: relative;
}

.brand-mark {
  width: min(100%, clamp(48px, 8vw, 84px));
  height: auto;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  object-fit: cover;
  display: block;
  margin: 0 auto;
  flex-shrink: 0;
}

.brand-title {
  font-weight: 700;
  color: var(--ink);
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.sidebar-toggle {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--muted);
  border-radius: 10px;
  padding: 0.3rem 0.45rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

.sidebar-toggle:hover {
  border-color: var(--accent);
  color: var(--accent-strong);
  background: var(--accent-soft);
}

.nav-group + .nav-group {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--line);
}

.nav-title {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin-bottom: 0.35rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  position: relative;
  padding: 0.55rem 0.7rem;
  border-radius: 10px;
  color: var(--ink);
  text-decoration: none;
  transition: all 0.2s ease;
}

.nav-link:hover {
  background: var(--panel-muted);
  color: var(--accent-strong);
}

.nav-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--panel-muted);
  color: var(--accent-strong);
  display: grid;
  place-items: center;
  font-size: 1rem;
}

.nav-icon svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.nav-label {
  white-space: nowrap;
}

.nav-link-active {
  background: var(--accent-soft);
  color: var(--accent-strong);
  border: 1px solid var(--accent);
}

.nav {
  flex: 1 1 auto;
}

.sidebar-actions {
  display: none;
  margin-top: 1rem;
}

.sidebar-actions .btn {
  width: 100%;
  justify-content: center;
}

.content {
  flex: 1;
  padding: clamp(0.75rem, 1.6vw, 1.4rem) 0;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  gap: 1rem;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.menu-toggle {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: #fff;
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.menu-toggle span {
  width: 18px;
  height: 2px;
  background: var(--ink);
  border-radius: 999px;
  position: relative;
  transition: transform 0.2s ease;
}

.menu-toggle span::before,
.menu-toggle span::after {
  content: '';
  position: absolute;
  left: 0;
  width: 18px;
  height: 2px;
  background: var(--ink);
  border-radius: 999px;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.menu-toggle span::before {
  transform: translateY(-6px);
}

.menu-toggle span::after {
  transform: translateY(6px);
}

.menu-toggle[data-open='true'] span {
  transform: rotate(45deg);
}

.menu-toggle[data-open='true'] span::before {
  transform: rotate(90deg);
}

.menu-toggle[data-open='true'] span::after {
  opacity: 0;
}

.menu-toggle:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.top-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.user-info {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.user-details {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
}

.user-name {
  font-weight: 600;
  color: var(--ink);
  font-size: 0.95rem;
}

.user-role {
  font-size: 0.75rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #fff;
  border-radius: 10px;
  padding: 0.55rem 0.9rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s ease;
}

.btn:hover {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
}

.btn.ghost {
  background: #fff;
  color: var(--accent-strong);
}

.btn.ghost:hover {
  background: var(--accent-soft);
}

.eyebrow {
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.75rem;
  color: var(--muted);
}

.muted {
  color: var(--muted);
}

@media (max-width: 1280px) {
  .sidebar {
    width: clamp(190px, 18vw, 220px);
    flex-basis: clamp(190px, 18vw, 220px);
  }
}

@media (max-width: 1024px) {
  .shell--mobile-open {
    overflow: hidden;
  }

  .shell {
    flex-direction: column;
    max-width: 100%;
    padding: 0.5rem 0.6rem 0.9rem;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: min(78vw, 280px);
    height: 100vh;
    transform: translateX(-105%);
    transition: transform 0.2s ease;
    z-index: 40;
  }

  .sidebar--open {
    transform: translateX(0);
  }

  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.35);
    z-index: 30;
  }

  .menu-toggle {
    display: inline-flex;
  }

  .sidebar-toggle {
    display: none;
  }

  .sidebar--compact {
    width: 88px;
  }

  .sidebar--compact .nav-title {
    display: block;
  }

  .sidebar--compact .nav-link {
    justify-content: flex-start;
    padding: 0.55rem 0.7rem;
  }

  .sidebar--compact .nav-label {
    display: inline;
  }

  .sidebar--compact .nav-link::after {
    display: none;
  }

  .topbar {
    display: none;
  }

  .user-info .btn {
    display: none;
  }

  .sidebar-actions {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  :global(.mobile-menu-toggle) {
    display: inline-flex !important;
    margin-top: 25px;
  }

  :global(.panel-title) {
    align-items: center;
  }

  .shell--warehouses .content {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding-top: 0;
  }

  .shell--warehouses {
    padding-top: 0.2rem;
  }

  .shell--warehouses .page {
    flex: 1;
    min-height: 0;
  }

  .topbar-left {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    column-gap: 0.75rem;
    row-gap: 0.15rem;
    align-items: center;
    min-width: 0;
  }

  .topbar-left .menu-toggle {
    grid-row: 1 / span 2;
    width: 42px;
    height: 42px;
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: #fff;
    box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  }

  .topbar-left .eyebrow {
    grid-column: 2;
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    color: #64748b;
  }

  .topbar-left h1 {
    grid-column: 2;
    font-size: clamp(1.15rem, 4vw, 1.45rem);
    line-height: 1.1;
    font-weight: 700;
    margin: 0;
  }

  .top-actions {
    display: none;
  }

  .content {
    padding-top: 0.25rem;
  }

  .sidebar-user {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.6rem 0.75rem;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--panel-muted);
  }

  .sidebar-user .user-name {
    font-weight: 600;
  }

  .sidebar-user .user-role {
    font-size: 0.7rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
}

@media (max-width: 720px) {
  .shell {
    padding: 0.4rem;
  }

  .user-info {
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .user-details {
    align-items: flex-start;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }

  .menu-toggle {
    width: 38px;
    height: 38px;
  }
}

:global(.panel) {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 1.2rem;
  box-shadow: var(--surface-glow);
}

:global(.panel.wide) {
  grid-column: 1 / -1;
}

:global(.panel-header) {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

:global(.panel-title) {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

:global(.panel-title-text) {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

:global(.mobile-menu-toggle) {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  box-shadow:
    0 10px 20px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  transition:
    transform 0.15s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

:global(.mobile-menu-toggle:hover) {
  border-color: rgba(59, 130, 246, 0.55);
  box-shadow:
    0 12px 24px rgba(15, 23, 42, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

:global(.mobile-menu-toggle:active) {
  transform: translateY(1px) scale(0.98);
}

:global(.mobile-menu-toggle::after) {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 999px;
  border: 1px solid transparent;
  box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.12);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

:global(.mobile-menu-toggle:focus-visible::after) {
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
}

:global(.mobile-menu-toggle span) {
  width: 18px;
  height: 2px;
  background: #0f172a;
  border-radius: 999px;
  position: relative;
  transition: transform 0.2s ease;
}

:global(.mobile-menu-toggle span::before),
:global(.mobile-menu-toggle span::after) {
  content: '';
  position: absolute;
  left: 0;
  width: 18px;
  height: 2px;
  background: #0f172a;
  border-radius: 999px;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

:global(.mobile-menu-toggle span::before) {
  transform: translateY(-6px);
}

:global(.mobile-menu-toggle span::after) {
  transform: translateY(6px);
}

:global(.mobile-menu-toggle[data-open='true'] span) {
  transform: rotate(45deg);
}

:global(.mobile-menu-toggle[data-open='true'] span::before) {
  transform: rotate(90deg);
}

:global(.mobile-menu-toggle[data-open='true'] span::after) {
  opacity: 0;
}

:global(.panel-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.8rem;
}

:global(.panel-grid.wide) {
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

:global(.muted) {
  color: var(--muted);
}

:global(.tag) {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  background: var(--panel-muted);
  color: var(--ink);
}

:global(.tag.accent) {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

:global(.tag.success) {
  background: #ecfdf3;
  color: var(--success);
}

:global(.tag.warning) {
  background: #fff7ed;
  color: var(--warning);
}

:global(.tag.danger) {
  background: #fef2f2;
  color: var(--danger);
}

:global(.status) {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  font-size: 0.82rem;
  background: var(--panel-muted);
}

:global(.status.open) {
  background: #ecfdf3;
  color: var(--success);
}

:global(.status.progress) {
  background: #f0f4ff;
  color: var(--accent-strong);
}

:global(.status.closed) {
  background: #fef9c3;
  color: #92400e;
}

:global(.status.error) {
  background: #fef2f2;
  color: var(--danger);
}

:global(.eyebrow) {
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.75rem;
  color: var(--muted);
}

:global(.page-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.8rem;
}

:global(.table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

:global(.table th),
:global(.table td) {
  padding: 0.6rem 0.4rem;
  text-align: left;
  border-bottom: 1px solid var(--line);
}

:global(.table th) {
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}

:global(.table tr:hover td) {
  background: var(--panel-muted);
}

:global(.form-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

:global(label) {
  font-weight: 600;
  color: var(--ink);
  display: block;
  margin-bottom: 0.2rem;
}

:global(input),
:global(select),
:global(textarea) {
  width: 100%;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  font-size: 0.95rem;
}

:global(textarea) {
  min-height: 120px;
  resize: vertical;
}

:global(.chip) {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--line);
}
</style>
