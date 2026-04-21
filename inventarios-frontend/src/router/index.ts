import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import BranchesView from '@/views/BranchesView.vue'
import CountDetailView from '@/views/CountDetailView.vue'
import CountsDashboardView from '@/views/CountsDashboardView.vue'
import CountsListView from '@/views/CountsListView.vue'
import ItemsView from '@/views/ItemsView.vue'
import LoginView from '@/views/LoginView.vue'
import ReportsView from '@/views/ReportsView.vue'
import RequestsView from '@/views/RequestsView.vue'
import RolesView from '@/views/RolesView.vue'
import SettingsView from '@/views/SettingsView.vue'
import SpecialLinesView from '@/views/SpecialLinesView.vue'
import UsersView from '@/views/UsersView.vue'
import WarehousesView from '@/views/WarehousesView.vue'
import CoverageReportView from '@/views/CoverageReportView.vue'
import TestDataView from '@/views/TestDataView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/conteos/dashboard',
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { title: 'Login', public: true },
    },
    {
      path: '/usuarios',
      name: 'usuarios',
      component: UsersView,
      meta: { title: 'Administración de usuarios', section: 'Seguridad' },
    },
    {
      path: '/roles',
      name: 'roles',
      component: RolesView,
      meta: { title: 'Roles y permisos', section: 'Seguridad' },
    },
    {
      path: '/catalogos/sucursales',
      name: 'sucursales',
      component: BranchesView,
      meta: { title: 'Sucursales', section: 'Catálogo' },
    },
    {
      path: '/catalogos/articulos',
      name: 'articulos',
      component: ItemsView,
      meta: { title: 'Artículos', section: 'Catálogo' },
    },
    {
      path: '/almacenes',
      name: 'almacenes',
      component: WarehousesView,
      meta: { title: 'Almacenes', section: 'Inventario' },
    },
    {
      path: '/conteos/dashboard',
      name: 'conteos-dashboard',
      component: CountsDashboardView,
      meta: { title: 'Dashboard de conteos', section: 'Conteos' },
    },
    {
      path: '/conteos/listado',
      name: 'conteos-listado',
      component: CountsListView,
      meta: { title: 'Listado de conteos', section: 'Conteos' },
    },
    {
      path: '/conteos/:id',
      name: 'conteos-detalle',
      component: CountDetailView,
      meta: { title: 'Detalle del conteo', section: 'Conteos' },
    },
    {
      path: '/solicitudes',
      name: 'solicitudes',
      component: RequestsView,
      meta: { title: 'Solicitudes por diferencias', section: 'Solicitudes' },
    },
    {
      path: '/reportes',
      name: 'reportes',
      component: ReportsView,
      meta: { title: 'Reportes y auditoría', section: 'Reportes' },
    },
    {
      path: '/reportes/cobertura',
      name: 'reportes-cobertura',
      component: CoverageReportView,
      meta: { title: 'Cobertura de Inventarios', section: 'Reportes' },
    },
    {
      path: '/lineas-especiales',
      name: 'lineas-especiales',
      component: SpecialLinesView,
      meta: { title: 'Líneas Especiales', section: 'Configuración' },
    },
    {
      path: '/configuracion',
      name: 'configuracion',
      component: SettingsView,
      meta: { title: 'Configuración', section: 'Configuración' },
    },
    {
      path: '/admin/test-data',
      name: 'test-data',
      component: TestDataView,
      meta: { title: 'Datos de Prueba', section: 'Administración' },
    },
  ],
})

// Guard de navegación global - Protege todas las rutas excepto el login
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  // Inicializar auth desde localStorage si no está inicializado
  if (!authStore.isAuthenticated) {
    authStore.initializeAuth()
  }

  // Si la ruta es pública (login), permitir acceso
  if (to.meta.public) {
    // Si ya está autenticado y va al login, redirigir al dashboard
    if (authStore.isAuthenticated) {
      next('/conteos/dashboard')
    } else {
      next()
    }
    return
  }

  // Si no está autenticado y la ruta NO es pública, redirigir al login
  if (!authStore.isAuthenticated) {
    next('/login')
    return
  }

  // Usuario autenticado, permitir acceso
  next()
})

export default router
