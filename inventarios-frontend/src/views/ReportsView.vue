<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { branchesService, countsService, usersService, reportsService, auditService, type Branch, type UserOption } from '@/services/api'
import MobileMenuToggle from '@/components/MobileMenuToggle.vue'
import { IconChartBar, IconChartPie, IconTrophy, IconUserCheck, IconAdjustments, IconClock, IconHistory, IconChevronRight, IconAlertTriangle } from '@tabler/icons-vue'

const branches = ref<Branch[]>([])
const connectedBranches = computed(() => branches.value.filter(b => b.status === 'connected'))
const users = ref<UserOption[]>([])
const counts = ref<any[]>([])
const totalCounts = ref(0)
const diffs = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const isMobile = ref(false)
const filtersOpen = ref(true)
const kpis = ref<any>(null)
const productivity = ref<any>(null)
const auditLogs = ref<any[]>([])
const loadingAudit = ref(false)
const loadingKpis = ref(false)
const loadingProductivity = ref(false)
const activeTab = ref('performance') // 'performance' u 'productivity'

const filters = reactive({
  branch_id: '',
  classification: '',
  responsible_user_id: '',
  date_from: '',
  date_to: ''
})

const loadBranches = async () => {
  try {
    const data = await branchesService.getAll()
    branches.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error loading branches', err)
  }
}

const loadUsers = async () => {
  try {
    const data = await usersService.getAll()
    users.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error loading users', err)
  }
}

const loadCounts = async () => {
  try {
    loading.value = true
    error.value = ''
    const params: any = {}
    if (filters.branch_id) params.branch_id = Number(filters.branch_id)
    if (filters.classification) params.classification = filters.classification
    if (filters.responsible_user_id) params.responsible_user_id = Number(filters.responsible_user_id)
    if (filters.date_from) params.date_from = filters.date_from
    if (filters.date_to) params.date_to = filters.date_to
    const response = await countsService.getAll(params)
    counts.value = Array.isArray((response as any)?.counts) ? (response as any).counts : response ?? []
    totalCounts.value = (response as any)?.total ?? counts.value.length
  } catch (err) {
    console.error('Error loading counts', err)
    error.value = 'No se pudieron cargar los conteos'
  } finally {
    loading.value = false
  }
}

const loadDiffs = async () => {
  try {
    const params: any = {}
    if (filters.branch_id) params.branch_id = Number(filters.branch_id)
    if (filters.classification) params.classification = filters.classification
    if (filters.responsible_user_id) params.responsible_user_id = Number(filters.responsible_user_id)
    if (filters.date_from) params.date_from = filters.date_from
    if (filters.date_to) params.date_to = filters.date_to
    const data = await countsService.getDifferences(params)
    diffs.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error loading differences', err)
  }
}

const loadKPIs = async () => {
    try {
        loadingKpis.value = true
        const params: any = {}
        if (filters.branch_id) params.branch_id = Number(filters.branch_id)
        if (filters.classification) params.classification = filters.classification
        if (filters.responsible_user_id) params.responsible_user_id = Number(filters.responsible_user_id)
        if (filters.date_from) params.date_from = filters.date_from
        if (filters.date_to) params.date_to = filters.date_to
        kpis.value = await reportsService.getAuditKPIs(params)
    } catch (err) {
        console.error('Error loading KPIs', err)
    } finally {
        loadingKpis.value = false
    }
}

const loadAuditLogs = async () => {
    try {
        loadingAudit.value = true
        const params: any = {}
        // La bitácora suele filtrarse por fecha y usuario
        if (filters.responsible_user_id) params.user_id = Number(filters.responsible_user_id)
        if (filters.date_from) params.date_from = filters.date_from
        if (filters.date_to) params.date_to = filters.date_to
        
        const res = await auditService.getLogs(params)
        auditLogs.value = res.logs
    } catch (err) {
        console.error('Error loading audit logs', err)
    } finally {
        loadingAudit.value = false
    }
}

const translateAction = (action: string) => {
  const map: Record<string, string> = {
    'CREATE_COUNTS': 'Creación masiva de conteos',
    'UPDATE_COUNT': 'Actualización de conteo',
    'DELETE_COUNT': 'Eliminación de conteo',
    'CREATE_REQUESTS_BATCH': 'Generación de solicitudes de ajuste',
    'UPDATE_REQUEST': 'Resolución de solicitud',
    'CREATE_SPECIAL_LINE': 'Nueva parámetro (Línea Especial)',
    'UPDATE_SPECIAL_LINE': 'Cambio en parámetros',
    'DELETE_SPECIAL_LINE': 'Eliminación de parámetros'
  }
  return map[action] || action
}

const loadProductivity = async () => {
    try {
        loadingProductivity.value = true
        const params: any = {}
        if (filters.branch_id) params.branch_id = Number(filters.branch_id)
        if (filters.classification) params.classification = filters.classification
        if (filters.responsible_user_id) params.responsible_user_id = Number(filters.responsible_user_id)
        if (filters.date_from) params.date_from = filters.date_from
        if (filters.date_to) params.date_to = filters.date_to
        productivity.value = await reportsService.getProductivityStats(params)
    } catch (err) {
        console.error('Error loading productivity', err)
    } finally {
        loadingProductivity.value = false
    }
}

const priorityTimes = ref<any>(null)
const loadingPriorityTimes = ref(false)

const loadPriorityTimes = async () => {
    try {
        loadingPriorityTimes.value = true
        const params: any = {}
        if (filters.branch_id) params.branch_id = Number(filters.branch_id)
        if (filters.classification) params.classification = filters.classification
        if (filters.responsible_user_id) params.responsible_user_id = Number(filters.responsible_user_id)
        if (filters.date_from) params.date_from = filters.date_from
        if (filters.date_to) params.date_to = filters.date_to
        priorityTimes.value = await reportsService.getPriorityTimesReport(params)
    } catch (err) {
        console.error('Error loading priority times', err)
    } finally {
        loadingPriorityTimes.value = false
    }
}

const getDurationClass = (minutes: number, priority: string) => {
  const prio = (priority || 'media').toLowerCase()
  if (prio === 'urgente' || prio === 'mostrador') {
    if (minutes > 180) return 'text-danger'
    if (minutes > 60) return 'text-warning'
  } else if (prio === 'alta') {
    if (minutes > 240) return 'text-danger'
    if (minutes > 120) return 'text-warning'
  } else {
    if (minutes > 480) return 'text-danger'
    if (minutes > 240) return 'text-warning'
  }
  return 'text-success'
}

const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

const selectedSurtidorFilter = ref('')
const selectedRevisorFilter = ref('')

const toggleSurtidorFilter = (name: string) => {
  if (selectedSurtidorFilter.value === name) {
    selectedSurtidorFilter.value = ''
  } else {
    selectedSurtidorFilter.value = name
  }
}

const toggleRevisorFilter = (name: string) => {
  if (selectedRevisorFilter.value === name) {
    selectedRevisorFilter.value = ''
  } else {
    selectedRevisorFilter.value = name
  }
}

const surtidoresAverages = computed(() => {
  if (!priorityTimes.value?.counts) return []
  const map = new Map<string, { total_minutes: number; count: number; priorities: Record<string, { total: number; count: number }> }>()
  
  priorityTimes.value.counts.forEach((count: any) => {
    const user = count.responsible_name || 'Sin asignar'
    const current = map.get(user) || { 
      total_minutes: 0, 
      count: 0, 
      priorities: {
        baja: { total: 0, count: 0 },
        media: { total: 0, count: 0 },
        alta: { total: 0, count: 0 },
        urgente: { total: 0, count: 0 },
        mostrador: { total: 0, count: 0 }
      }
    }
    current.total_minutes += count.elapsed_minutes
    current.count += 1
    
    const prio = (count.priority || 'media').toLowerCase()
    if (current.priorities[prio]) {
      current.priorities[prio].total += count.elapsed_minutes
      current.priorities[prio].count += 1
    }
    map.set(user, current)
  })
  
  return Array.from(map.entries()).map(([name, data]) => {
    const avg = Math.floor(data.total_minutes / data.count)
    
    const priorityMap: Record<string, { count: number; avg_formatted: string }> = {}
    Object.entries(data.priorities).forEach(([prio, pStats]) => {
      if (pStats.count > 0) {
        const pAvg = Math.floor(pStats.total / pStats.count)
        priorityMap[prio] = {
          count: pStats.count,
          avg_formatted: formatMinutes(pAvg)
        }
      }
    })
      
    return {
      name,
      avg_minutes: avg,
      avg_formatted: formatMinutes(avg),
      count: data.count,
      priorityMap
    }
  }).sort((a, b) => a.avg_minutes - b.avg_minutes)
})

const revisoresAverages = computed(() => {
  if (!priorityTimes.value?.requests) return []
  const map = new Map<string, { total_minutes: number; count: number; priorities: Record<string, { total: number; count: number }> }>()
  
  priorityTimes.value.requests.forEach((req: any) => {
    const user = req.reviewer_name || 'Sistema'
    const current = map.get(user) || { 
      total_minutes: 0, 
      count: 0, 
      priorities: {
        baja: { total: 0, count: 0 },
        media: { total: 0, count: 0 },
        alta: { total: 0, count: 0 },
        urgente: { total: 0, count: 0 },
        mostrador: { total: 0, count: 0 }
      }
    }
    current.total_minutes += req.elapsed_minutes
    current.count += 1
    
    const prio = (req.priority || 'media').toLowerCase()
    if (current.priorities[prio]) {
      current.priorities[prio].total += req.elapsed_minutes
      current.priorities[prio].count += 1
    }
    map.set(user, current)
  })
  
  return Array.from(map.entries()).map(([name, data]) => {
    const avg = Math.floor(data.total_minutes / data.count)
    
    const priorityMap: Record<string, { count: number; avg_formatted: string }> = {}
    Object.entries(data.priorities).forEach(([prio, pStats]) => {
      if (pStats.count > 0) {
        const pAvg = Math.floor(pStats.total / pStats.count)
        priorityMap[prio] = {
          count: pStats.count,
          avg_formatted: formatMinutes(pAvg)
        }
      }
    })
      
    return {
      name,
      avg_minutes: avg,
      avg_formatted: formatMinutes(avg),
      count: data.count,
      priorityMap
    }
  }).sort((a, b) => a.avg_minutes - b.avg_minutes)
})

const filteredCounts = computed(() => {
  if (!priorityTimes.value?.counts) return []
  if (!selectedSurtidorFilter.value) return priorityTimes.value.counts
  return priorityTimes.value.counts.filter((c: any) => c.responsible_name === selectedSurtidorFilter.value)
})

const filteredRequests = computed(() => {
  if (!priorityTimes.value?.requests) return []
  if (!selectedRevisorFilter.value) return priorityTimes.value.requests
  return priorityTimes.value.requests.filter((r: any) => r.reviewer_name === selectedRevisorFilter.value)
})

const countsByPriority = computed(() => {
  const countsMap = { baja: 0, media: 0, alta: 0, urgente: 0, mostrador: 0 }
  counts.value.forEach((c: any) => {
    const prio = (c.priority || 'media').toLowerCase() as keyof typeof countsMap
    if (prio in countsMap) {
      countsMap[prio]++
    }
  })
  return Object.entries(countsMap)
    .filter(([_, count]) => count > 0)
    .map(([prio, count]) => ({ priority: prio, count }))
})

const applyFilters = () => {
    loadCounts()
    loadDiffs()
    loadKPIs()
    loadProductivity()
    loadAuditLogs()
    loadPriorityTimes()
}

const updateIsMobile = () => {
  if (typeof window === 'undefined') return
  const nextIsMobile = window.matchMedia('(max-width: 1024px)').matches
  if (nextIsMobile !== isMobile.value) {
    isMobile.value = nextIsMobile
    filtersOpen.value = !nextIsMobile
  }
}

const toggleFilters = () => {
  filtersOpen.value = !filtersOpen.value
}

const exportAuditToCSV = () => {
  if (!auditLogs.value.length) return
  
  const headers = ['Fecha', 'Usuario', 'Acción', 'Entidad', 'Referencia']
  const rows = auditLogs.value.map(log => [
    new Date(log.created_at).toLocaleString(),
    log.user_name || 'Sistema',
    translateAction(log.action),
    log.entity_type,
    log.entity_id
  ])
  
  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `bitacora_movimientos_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const summaryCards = computed(() => {
  const totalDiffs = diffs.value.length
  const pctDiff = totalCounts.value > 0 ? ((totalDiffs / totalCounts.value) * 100).toFixed(1) : '0.0'
  return [
    { label: 'Conteos realizados', value: totalCounts.value.toString(), note: 'Según filtros' },
    { label: 'Con diferencias', value: totalDiffs.toString(), note: 'Detalles con diferencia' },
    { label: '% con diferencia', value: `${pctDiff}%`, note: 'Sobre conteos listados' }
  ]
})

const byBranch = computed(() => {
  const map = new Map<number, { code: string; name: string; diff: number }>()
  const branchName = (id: number) => branches.value.find((b) => b.id === id)?.name || `ID ${id}`
  for (const row of diffs.value) {
    const entry = map.get(row.branch_id) || { code: `ID ${row.branch_id}`, name: branchName(row.branch_id), diff: 0 }
    entry.diff += 1
    map.set(row.branch_id, entry)
  }
  return Array.from(map.values())
})

const byUser = computed(() => {
  const map = new Map<number, { name: string; counts: number }>()
  const userName = (id: number) => users.value.find((u) => u.id === id)?.name || `Usuario #${id}`
  for (const c of counts.value) {
    const entry = map.get(c.responsible_user_id) || { name: userName(c.responsible_user_id), counts: 0 }
    entry.counts += 1
    map.set(c.responsible_user_id, entry)
  }
  return Array.from(map.values())
})

onMounted(async () => {
    updateIsMobile()
    window.addEventListener('resize', updateIsMobile)
    await Promise.all([loadBranches(), loadUsers()])
    await Promise.all([loadCounts(), loadDiffs(), loadKPIs(), loadProductivity(), loadPriorityTimes()])
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('resize', updateIsMobile)
})
</script>

<template>
  <section class="panel wide">
    <div class="panel-header">
      <div class="panel-title">
        <MobileMenuToggle />
        <div class="panel-title-text">
          <p class="eyebrow">Reportes</p>
          <h2>Histórico de conteos</h2>
          <p class="muted">Filtros por sucursal, tipo de conteo y responsable.</p>
        </div>
      </div>
      <span class="tag accent">Análisis</span>
    </div>

    <div v-if="isMobile" class="filters-header">
      <button
        class="filters-toggle"
        type="button"
        :aria-expanded="filtersOpen"
        @click="toggleFilters"
      >
        <span>Filtros</span>
        <span class="chevron" :class="{ open: filtersOpen }" aria-hidden="true"></span>
      </button>
    </div>

    <div v-show="!isMobile || filtersOpen" class="form-grid" style="margin-bottom: 0.75rem">
      <div>
        <label for="branch">Sucursal</label>
        <select id="branch" v-model="filters.branch_id">
          <option value="">Todas</option>
          <option v-for="branch in connectedBranches" :key="branch.id ?? branch.code" :value="branch.id">
            {{ branch.name }}
          </option>
        </select>
      </div>
      <div>
        <label for="classification">Clasificación</label>
        <select id="classification" v-model="filters.classification">
          <option value="">Todas</option>
          <option value="inventario">Inventario</option>
          <option value="ajuste">Ajuste</option>
        </select>
      </div>
      <div>
        <label for="user">Responsable</label>
        <select id="user" v-model="filters.responsible_user_id">
          <option value="">Todos</option>
          <option v-for="user in users" :key="user.id" :value="user.id">
            {{ user.name }} {{ user.role_name ? ` - [${user.role_name}]` : '' }}
          </option>
        </select>
      </div>
      <div>
        <label for="date_from">Desde</label>
        <input id="date_from" v-model="filters.date_from" type="date" />
      </div>
      <div>
        <label for="date_to">Hasta</label>
        <input id="date_to" v-model="filters.date_to" type="date" />
      </div>
      <div class="actions">
        <button class="btn" @click="applyFilters">Aplicar filtros</button>
      </div>
    </div>

    <div v-if="loading" class="muted" style="padding: 0.8rem">Cargando...</div>
    <div v-else-if="error" class="error-message panel">
      <p>{{ error }}</p>
      <button class="btn" @click="applyFilters">Reintentar</button>
    </div>

    <div v-else class="panel-grid">
      <div v-for="metric in summaryCards" :key="metric.label" class="panel" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <p class="eyebrow">{{ metric.label }}</p>
          <h2>{{ metric.value }}</h2>
          <p class="muted" style="margin-bottom: 0.5rem;">{{ metric.note }}</p>
        </div>
        <!-- Desglose por prioridad para el total de conteos realizados -->
        <div v-if="metric.label === 'Conteos realizados' && countsByPriority.length" class="priority-breakdown" style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; border-top: 1px solid var(--line); padding-top: 0.5rem;">
          <span 
            v-for="item in countsByPriority" 
            :key="item.priority" 
            class="tag-prio mini" 
            :class="item.priority"
            style="font-size: 0.65rem; font-weight: 700; padding: 0.1rem 0.4rem;"
          >
            {{ item.priority.toUpperCase() }}: {{ item.count }}
          </span>
        </div>
      </div>
    </div>

    <!-- Navegación de Pestañas -->
    <div class="tabs-nav">
      <button :class="{ active: activeTab === 'performance' }" @click="activeTab = 'performance'">
        <IconClock :size="18" /> Eficiencia Operativa
      </button>
      <button :class="{ active: activeTab === 'productivity' }" @click="activeTab = 'productivity'">
        <IconChartBar :size="18" /> Productividad de Equipo
      </button>
      <button :class="{ active: activeTab === 'priority_times' }" @click="activeTab = 'priority_times'">
        <IconAlertTriangle :size="18" /> Tiempos por Prioridad
      </button>
    </div>

    <!-- Pestaña 1: Eficiencia (Anterior) -->
    <div v-if="activeTab === 'performance'" class="tab-content animate-fade">
      <div style="margin-top: 0.5rem;">
        <p class="eyebrow" style="margin-bottom: 0.75rem;">⏱️ Tiempos de Respuesta (Horas Laborales)</p>
        <div v-if="loadingKpis" class="muted">Calculando tiempos...</div>
        <div v-else-if="kpis" class="panel-grid">
          <div class="panel kpi-card">
            <p class="eyebrow">Asignación</p>
            <h3 :class="{ 'text-warning': kpis.avg_assignment_time.includes('h') }">{{ kpis.avg_assignment_time }}</h3>
            <p class="muted">Creación ➔ Asignación</p>
          </div>
          <div class="panel kpi-card">
            <p class="eyebrow">Inicio de conteo</p>
            <h3 :class="{ 'text-danger': kpis.avg_start_time.includes('h') }">{{ kpis.avg_start_time }}</h3>
            <p class="muted">Asignado ➔ Inicia</p>
          </div>
          <div class="panel kpi-card">
            <p class="eyebrow">Resolución </p>
            <h3>{{ kpis.avg_resolution_time }}</h3>
            <p class="muted">Ajuste de diferencia</p>
          </div>
        </div>
      </div>

      <div class="panel-grid wide" style="margin-top: 1.5rem">
        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Diferencias</p>
              <h3>Por sucursal</h3>
            </div>
            <span class="tag warning">Live</span>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Sucursal</th>
                <th>Unidades con diferencia</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="branch in byBranch" :key="branch.code">
                <td>{{ branch.name }}</td>
                <td>{{ branch.diff }}</td>
              </tr>
              <tr v-if="byBranch.length === 0">
                <td colspan="2" class="muted" style="text-align: center; padding: 0.8rem">Sin diferencias</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Jefes de Almacén</p>
              <h3>Tiempo de asignación por usuario</h3>
              <p class="muted">Promedio de tiempo en asignar desde que se crea el conteo.</p>
            </div>
            <span class="tag">Gestión</span>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Tiempo Promedio</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in kpis?.assignment_by_user" :key="user.name">
                <td>{{ user.name }}</td>
                <td :class="{ 'text-warning': user.avg_minutes > 60 }">
                  <strong>{{ user.avg_formatted }}</strong>
                </td>
              </tr>
              <tr v-if="!kpis?.assignment_by_user?.length">
                <td colspan="2" class="muted" style="text-align: center; padding: 0.8rem">Sin datos</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <div class="panel-grid wide">
        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Inventarios</p>
              <h3>Tiempo de resolución por usuario</h3>
              <p class="muted">Promedio de tiempo en resolver diferencias.</p>
            </div>
            <span class="tag accent">Ajustes</span>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Tiempo Promedio</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in kpis?.resolution_by_user" :key="user.name">
                <td>{{ user.name }}</td>
                <td :class="{ 'text-danger': user.avg_minutes > 240 }">
                  <strong>{{ user.avg_formatted }}</strong>
                </td>
              </tr>
              <tr v-if="!kpis?.resolution_by_user?.length">
                <td colspan="2" class="muted" style="text-align: center; padding: 0.8rem">Sin datos</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Desempeño</p>
              <h3>Inicio de conteo por usuario</h3>
              <p class="muted">Promedio de tiempo en iniciar desde que se le asigna.</p>
            </div>
            <span class="tag success">Productividad</span>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Tiempo Promedio</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in kpis?.efficiency_by_user" :key="user.name">
                <td>{{ user.name }}</td>
                <td :class="{ 'text-warning': user.avg_minutes > 120 }">
                  <strong>{{ user.avg_formatted }}</strong>
                </td>
              </tr>
              <tr v-if="!kpis?.efficiency_by_user?.length">
                <td colspan="2" class="muted" style="text-align: center; padding: 0.8rem">Sin datos</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>

    <!-- Pestaña 2: Productividad de Equipo -->
    <div v-if="activeTab === 'productivity'" class="tab-content animate-fade">
      <!-- Podio de Surtidores -->
      <section class="panel productivity-section">
        <div class="panel-header no-border">
          <div class="header-icon"><IconTrophy /></div>
          <h3>Ranking de Surtidores</h3>
          <p class="muted">Usuarios que más artículos han contado físicamente.</p>
        </div>
        
        <div v-if="loadingProductivity" class="muted">Cargando ranking...</div>
        <div v-else-if="productivity" class="podium-container">
          <!-- Segundo Lugar -->
          <div v-if="productivity.topSurtidores[1]" class="podium-item second">
            <div class="podium-avatar">2</div>
            <p class="podium-name">{{ productivity.topSurtidores[1].name }}</p>
            <p class="podium-value"><strong>{{ productivity.topSurtidores[1].value }}</strong> arts.</p>
          </div>
          
          <!-- Primer Lugar -->
          <div v-if="productivity.topSurtidores[0]" class="podium-item first">
            <div class="podium-avatar"><IconTrophy :size="32" /></div>
            <p class="podium-name">{{ productivity.topSurtidores[0].name }}</p>
            <p class="podium-value"><strong>{{ productivity.topSurtidores[0].value }}</strong> arts.</p>
          </div>
          
          <!-- Tercer Lugar -->
          <div v-if="productivity.topSurtidores[2]" class="podium-item third">
            <div class="podium-avatar">3</div>
            <p class="podium-name">{{ productivity.topSurtidores[2].name }}</p>
            <p class="podium-value"><strong>{{ productivity.topSurtidores[2].value }}</strong> arts.</p>
          </div>
        </div>

        <table v-if="productivity && productivity.topSurtidores.length > 3" class="table mini-table">
          <tbody>
            <tr v-for="(user, index) in productivity.topSurtidores.slice(3)" :key="user.name">
              <td class="text-center muted" style="width: 40px;">#{{ (index as number) + 4 }}</td>
              <td>{{ user.name }}</td>
              <td style="text-align: right;"><strong>{{ user.value }}</strong> artículos</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div class="panel-grid wide">
        <!-- Tabla Solicitantes -->
        <section class="panel">
          <div class="panel-header">
            <div class="header-icon"><IconAdjustments /></div>
            <h3>Solicitudes de Ajuste</h3>
            <p class="muted">Quién detecta más diferencias.</p>
          </div>
          <table class="table">
            <thead>
              <tr><th>Usuario</th><th style="text-align: right;">Solicitudes</th></tr>
            </thead>
            <tbody>
              <tr v-for="user in productivity?.topSolicitantes" :key="user.name">
                <td>{{ user.name }}</td>
                <td style="text-align: right;"><strong>{{ user.value }}</strong></td>
              </tr>
              <tr v-if="!productivity?.topSolicitantes.length"><td colspan="2" class="muted text-center">Sin datos</td></tr>
            </tbody>
          </table>
        </section>

        <!-- Tabla Revisores -->
        <section class="panel">
          <div class="panel-header">
            <div class="header-icon text-success"><IconUserCheck /></div>
            <h3>Resolución de Ajustes</h3>
            <p class="muted">Quién procesa y autoriza más ajustes.</p>
          </div>
          <table class="table">
            <thead>
              <tr><th>Usuario</th><th style="text-align: right;">Resueltas</th></tr>
            </thead>
            <tbody>
              <tr v-for="user in productivity?.topRevisores" :key="user.name">
                <td>{{ user.name }}</td>
                <td style="text-align: right;"><strong>{{ user.value }}</strong></td>
              </tr>
              <tr v-if="!productivity?.topRevisores.length"><td colspan="2" class="muted text-center">Sin datos</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>

    <!-- Pestaña 3: Tiempos por Prioridad -->
    <div v-if="activeTab === 'priority_times'" class="tab-content animate-fade">
      <div style="margin-top: 0.5rem;">
        <p class="eyebrow" style="margin-bottom: 0.75rem;">⏱️ Tiempos Promedio por Prioridad (Horas Laborales)</p>
        <div v-if="loadingPriorityTimes" class="muted">Calculando tiempos por prioridad...</div>
        <div v-else-if="priorityTimes?.summary" class="panel-grid">
          <div v-for="item in priorityTimes.summary" :key="item.priority" class="panel kpi-card" :class="'prio-' + item.priority">
            <span class="tag-prio" :class="item.priority">{{ item.priority }}</span>
            <div style="margin-top: 0.5rem;">
              <p class="eyebrow">⏳ Inicio de conteo</p>
              <h3>{{ item.avg_start_formatted }}</h3>
              <p class="muted">Asignado ➔ Inicia ({{ item.count_start }} conteos)</p>
            </div>
            <div style="margin-top: 0.75rem; border-top: 1px solid var(--line); padding-top: 0.5rem;">
              <p class="eyebrow">⚙️ Resolución de Ajuste</p>
              <h3>{{ item.avg_resolution_formatted }}</h3>
              <p class="muted">Solicitud ➔ Resuelta ({{ item.count_resolution }} solicitudes)</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Promedios por Usuario -->
      <div v-if="!loadingPriorityTimes && (surtidoresAverages.length || revisoresAverages.length)" class="panel-grid wide" style="margin-top: 1.5rem">
        <!-- Tabla Promedios Surtidores -->
        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Surtidores</p>
              <h3>Promedio de Inicio por Surtidor</h3>
              <p class="muted">Tiempos promedio en iniciar conteo. Haz clic en una fila para filtrar el desglose abajo.</p>
            </div>
            <span class="tag info">Surtidores</span>
          </div>
          <div class="table-container" style="max-height: 400px; overflow-y: auto;">
            <table class="table hoverable">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th style="text-align: right;">Conteos</th>
                  <th style="text-align: right;">Tiempo Promedio</th>
                  <th style="text-align: right; min-width: 75px;">Baja</th>
                  <th style="text-align: right; min-width: 75px;">Media</th>
                  <th style="text-align: right; min-width: 75px;">Alta</th>
                  <th style="text-align: right; min-width: 75px;">Urgente</th>
                  <th style="text-align: right; min-width: 75px;">Mostrador</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="user in surtidoresAverages" 
                  :key="user.name"
                  :class="{ 'row-active': selectedSurtidorFilter === user.name }"
                  @click="toggleSurtidorFilter(user.name)"
                  style="cursor: pointer;"
                >
                  <td>
                    <strong>{{ user.name }}</strong>
                    <span v-if="selectedSurtidorFilter === user.name" class="active-dot">●</span>
                  </td>
                  <td style="text-align: right;">{{ user.count }}</td>
                  <td style="text-align: right; font-weight: 600;">{{ user.avg_formatted }}</td>
                  
                  <!-- Columnas de prioridad -->
                  <td v-for="prio in ['baja', 'media', 'alta', 'urgente', 'mostrador']" :key="prio" style="text-align: right;">
                    <div v-if="user.priorityMap[prio]">
                      <span class="tag-prio mini" :class="prio" style="font-size: 0.65rem; font-weight: 700; padding: 0.05rem 0.2rem; display: inline-block; margin-bottom: 0.15rem;">
                        {{ user.priorityMap[prio].avg_formatted }}
                      </span>
                      <div class="muted" style="font-size: 0.65rem; line-height: 1;">({{ user.priorityMap[prio].count }})</div>
                    </div>
                    <span v-else class="muted" style="font-size: 0.75rem;">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="selectedSurtidorFilter" class="panel-footer" style="padding: 0.5rem 1rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--line); background: var(--panel-muted, rgba(0,0,0,0.02));">
            <span class="muted" style="font-size: 0.8rem;">Filtrando detalle por: <strong>{{ selectedSurtidorFilter }}</strong></span>
            <button class="btn ghost" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" @click.stop="selectedSurtidorFilter = ''">Limpiar</button>
          </div>
        </section>

        <!-- Tabla Promedios Revisores -->
        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Revisores</p>
              <h3>Promedio de Resolución por Revisor</h3>
              <p class="muted">Tiempos promedio en autorizar/rechazar ajustes. Haz clic en una fila para filtrar el desglose abajo.</p>
            </div>
            <span class="tag accent">Revisores</span>
          </div>
          <div class="table-container" style="max-height: 400px; overflow-y: auto;">
            <table class="table hoverable">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th style="text-align: right;">Ajustes</th>
                  <th style="text-align: right;">Tiempo Promedio</th>
                  <th style="text-align: right; min-width: 75px;">Baja</th>
                  <th style="text-align: right; min-width: 75px;">Media</th>
                  <th style="text-align: right; min-width: 75px;">Alta</th>
                  <th style="text-align: right; min-width: 75px;">Urgente</th>
                  <th style="text-align: right; min-width: 75px;">Mostrador</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="user in revisoresAverages" 
                  :key="user.name"
                  :class="{ 'row-active': selectedRevisorFilter === user.name }"
                  @click="toggleRevisorFilter(user.name)"
                  style="cursor: pointer;"
                >
                  <td>
                    <strong>{{ user.name }}</strong>
                    <span v-if="selectedRevisorFilter === user.name" class="active-dot">●</span>
                  </td>
                  <td style="text-align: right;">{{ user.count }}</td>
                  <td style="text-align: right; font-weight: 600;">{{ user.avg_formatted }}</td>
                  
                  <!-- Columnas de prioridad -->
                  <td v-for="prio in ['baja', 'media', 'alta', 'urgente', 'mostrador']" :key="prio" style="text-align: right;">
                    <div v-if="user.priorityMap[prio]">
                      <span class="tag-prio mini" :class="prio" style="font-size: 0.65rem; font-weight: 700; padding: 0.05rem 0.2rem; display: inline-block; margin-bottom: 0.15rem;">
                        {{ user.priorityMap[prio].avg_formatted }}
                      </span>
                      <div class="muted" style="font-size: 0.65rem; line-height: 1;">({{ user.priorityMap[prio].count }})</div>
                    </div>
                    <span v-else class="muted" style="font-size: 0.75rem;">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="selectedRevisorFilter" class="panel-footer" style="padding: 0.5rem 1rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--line); background: var(--panel-muted, rgba(0,0,0,0.02));">
            <span class="muted" style="font-size: 0.8rem;">Filtrando detalle por: <strong>{{ selectedRevisorFilter }}</strong></span>
            <button class="btn ghost" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" @click.stop="selectedRevisorFilter = ''">Limpiar</button>
          </div>
        </section>
      </div>

      <!-- Detalle de Tiempos -->
      <div class="panel-grid wide" style="margin-top: 1.5rem">
        <!-- Tabla Detalle de Conteos -->
        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Detalle de Conteos</p>
              <h3>Tiempos de Inicio de Conteo</h3>
              <p class="muted">Tiempos individuales transcurridos desde que se asigna hasta que inicia.</p>
            </div>
            <span class="tag info">Conteos</span>
          </div>
          
          <div v-if="loadingPriorityTimes" class="muted">Cargando detalles...</div>
          <div v-else class="table-container" style="max-height: 650px; overflow-y: auto;">
            <table class="table">
              <thead style="position: sticky; top: 0; background: var(--surface); z-index: 10;">
                <tr>
                  <th>Folio</th>
                  <th>Sucursal</th>
                  <th>Prioridad</th>
                  <th>Responsable</th>
                  <th>Asignado</th>
                  <th>Iniciado</th>
                  <th style="text-align: right;">Tiempo Neto</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="count in filteredCounts" :key="count.id">
                  <td>{{ count.folio }}</td>
                  <td>{{ count.branch_name }}</td>
                  <td>
                    <span class="tag-prio mini" :class="count.priority.toLowerCase()">{{ count.priority }}</span>
                  </td>
                  <td><strong>{{ count.responsible_name }}</strong></td>
                  <td class="text-nowrap muted">{{ count.assigned_at ? new Date(count.assigned_at).toLocaleString() : '-' }}</td>
                  <td class="text-nowrap muted">{{ count.started_at ? new Date(count.started_at).toLocaleString() : '-' }}</td>
                  <td style="text-align: right; font-weight: bold;" :class="getDurationClass(count.elapsed_minutes, count.priority)">
                    {{ count.elapsed_formatted }}
                  </td>
                </tr>
                <tr v-if="!filteredCounts.length">
                  <td colspan="7" class="muted text-center" style="padding: 2rem;">Sin datos en el rango seleccionado</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Tabla Detalle de Solicitudes -->
        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Detalle de Ajustes</p>
              <h3>Tiempos de Resolución de Solicitudes</h3>
              <p class="muted">Tiempos individuales transcurridos desde que se reporta la diferencia hasta su revisión.</p>
            </div>
            <span class="tag accent">Ajustes</span>
          </div>

          <div v-if="loadingPriorityTimes" class="muted">Cargando detalles...</div>
          <div v-else class="table-container" style="max-height: 650px; overflow-y: auto;">
            <table class="table">
              <thead style="position: sticky; top: 0; background: var(--surface); z-index: 10;">
                <tr>
                  <th>Solicitud</th>
                  <th>Conteo</th>
                  <th>Sucursal</th>
                  <th>Prioridad</th>
                  <th>Revisor</th>
                  <th>Creada</th>
                  <th>Resuelta</th>
                  <th style="text-align: right;">Tiempo Neto</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="req in filteredRequests" :key="req.id">
                  <td>{{ req.request_folio }}</td>
                  <td>{{ req.count_folio }}</td>
                  <td>{{ req.branch_name }}</td>
                  <td>
                    <span class="tag-prio mini" :class="req.priority.toLowerCase()">{{ req.priority }}</span>
                  </td>
                  <td><strong>{{ req.reviewer_name }}</strong></td>
                  <td class="text-nowrap muted">{{ req.created_at ? new Date(req.created_at).toLocaleString() : '-' }}</td>
                  <td class="text-nowrap muted">{{ req.reviewed_at ? new Date(req.reviewed_at).toLocaleString() : '-' }}</td>
                  <td style="text-align: right; font-weight: bold;" :class="getDurationClass(req.elapsed_minutes, req.priority)">
                    {{ req.elapsed_formatted }}
                  </td>
                </tr>
                <tr v-if="!filteredRequests.length">
                  <td colspan="8" class="muted text-center" style="padding: 2rem;">Sin datos en el rango seleccionado</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </section>

  <!-- Bitácora (Fuera de las pestañas porque es general) -->
  <section class="panel wide" style="margin-top: 1.5rem">
    <div class="panel-header">
      <div>
        <div class="header-icon"><IconHistory /></div>
        <h3>Bitácora de Movimientos</h3>
        <p class="muted">Registro de acciones críticas en el sistema.</p>
      </div>
    </div>
    
    <div v-if="loadingAudit" class="text-center muted" style="padding: 2rem;">
      Cargando bitácora...
    </div>
    
    <div v-else class="table-container" style="max-height: 400px; overflow-y: auto;">
      <table class="table">
        <thead style="position: sticky; top: 0; background: var(--surface); z-index: 10;">
          <tr>
            <th>Fecha</th>
            <th>Usuario</th>
            <th>Acción</th>
            <th>Referencia</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in auditLogs" :key="log.id">
            <td class="text-nowrap">{{ new Date(log.created_at).toLocaleString() }}</td>
            <td><strong>{{ log.user_name || 'Sistema' }}</strong></td>
            <td>{{ translateAction(log.action) }}</td>
            <td class="muted">
              {{ log.entity_type }} #{{ log.entity_id }}
            </td>
          </tr>
          <tr v-if="!auditLogs.length">
            <td colspan="4" class="text-center muted" style="padding: 2rem;">
              No se encontraron movimientos registrados con los filtros actuales.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div class="panel-footer" style="padding: 1rem; border-top: 1px solid var(--line);">
      <button class="btn ghost" :disabled="!auditLogs.length" @click="exportAuditToCSV">
        Exportar bitácora (CSV)
      </button>
    </div>
  </section>
</template>

<style scoped>
.filters-header {
  display: none;
  margin-bottom: 0.6rem;
}

.filters-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--border-color, #d0d7de);
  border-radius: 12px;
  background: var(--surface-color, #fff);
  font: inherit;
  font-weight: 600;
  color: #0f172a;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
}

.filters-toggle:hover {
  border-color: #c7d2fe;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.12);
}

.filters-toggle:active {
  transform: translateY(1px);
}

.filters-toggle:focus-visible {
  outline: 2px solid var(--primary-color, #2563eb);
  outline-offset: 2px;
}

.filters-toggle .chevron {
  width: 10px;
  height: 10px;
  border-right: 2px solid #64748b;
  border-bottom: 2px solid #64748b;
  transform: rotate(45deg);
  transition: transform 120ms ease;
}

.filters-toggle .chevron.open {
  transform: rotate(-135deg);
}

@media (max-width: 1024px) {
  .filters-header {
    display: block;
  }
}

.kpi-card h3 {
  font-size: 1.8rem;
  margin: 0.5rem 0;
  color: #2563eb;
}

.text-warning { color: #d97706 !important; }
.text-danger { color: #dc2626 !important; }
.text-success { color: #10b981 !important; }

/* Tabs Styles */
.tabs-nav {
  display: flex;
  gap: 1rem;
  margin: 1.5rem 0;
  border-bottom: 1px solid var(--line);
  padding-bottom: 0.5rem;
}

.tabs-nav button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  border: none;
  background: transparent;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.tabs-nav button:hover {
  background: var(--panel-muted);
  color: var(--ink);
}

.tabs-nav button.active {
  background: var(--accent-soft);
  color: var(--accent);
}

/* Podium Styles */
.podium-container {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 1rem;
  margin: 2rem 0;
  padding: 1rem;
}

.podium-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 140px;
}

.podium-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  font-weight: 800;
  background: var(--panel-muted);
  color: var(--muted);
  border: 4px solid #fff;
  box-shadow: var(--shadow);
}

.podium-item.first .podium-avatar {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #fff;
  border-color: #fef3c7;
}

.podium-item.second .podium-avatar {
  background: linear-gradient(135deg, #94a3b8, #64748b);
  color: #fff;
  border-color: #f1f5f9;
}

.podium-item.third .podium-avatar {
  background: linear-gradient(135deg, #d97706, #b45309);
  color: #fff;
  border-color: #ffedd5;
}

.podium-name {
  font-weight: 700;
  text-align: center;
  margin-top: 0.5rem;
}

.podium-value {
  font-size: 0.85rem;
  color: var(--muted);
}

.animate-fade {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.header-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--panel-muted);
  display: grid;
  place-items: center;
  color: var(--accent);
  margin-bottom: 0.5rem;
}

.no-border { border: none !important; }

.tag-prio {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  text-align: center;
}

.tag-prio.urgente {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.tag-prio.mostrador {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
  border: 1px solid rgba(139, 92, 246, 0.2);
}

.tag-prio.alta {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.tag-prio.media {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.tag-prio.baja {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
  border: 1px solid rgba(107, 114, 128, 0.2);
}

.tag-prio.mini {
  padding: 0.1rem 0.35rem;
  font-size: 0.7rem;
}

/* Estilos de tarjetas de KPIs por prioridad */
.kpi-card.prio-urgente {
  border-left: 4px solid #ef4444;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.02), var(--surface));
}
.kpi-card.prio-mostrador {
  border-left: 4px solid #8b5cf6;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.02), var(--surface));
}
.kpi-card.prio-alta {
  border-left: 4px solid #f59e0b;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.02), var(--surface));
}
.kpi-card.prio-media {
  border-left: 4px solid #3b82f6;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.02), var(--surface));
}
.kpi-card.prio-baja {
  border-left: 4px solid #6b7280;
  background: linear-gradient(135deg, rgba(107, 114, 128, 0.02), var(--surface));
}

.table.hoverable tbody tr:hover {
  background: var(--accent-soft, rgba(37, 99, 235, 0.05));
}
.row-active {
  background: var(--accent-soft, rgba(37, 99, 235, 0.08)) !important;
  color: var(--accent, #2563eb);
}
.active-dot {
  color: var(--accent, #2563eb);
  font-size: 1.15rem;
  margin-left: 0.25rem;
  display: inline-block;
  line-height: 1;
  vertical-align: middle;
}
</style>
