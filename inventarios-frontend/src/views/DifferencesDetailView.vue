<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { branchesService, countsService, usersService, type Branch, type UserOption } from '@/services/api'
import MobileMenuToggle from '@/components/MobileMenuToggle.vue'
import { 
  IconFilter, 
  IconRefresh, 
  IconDownload, 
  IconSearch,
  IconArrowLeft,
  IconArrowRight,
  IconBuildingStore,
  IconChevronRight
} from '@tabler/icons-vue'

const branches = ref<Branch[]>([])
const connectedBranches = computed(() => branches.value.filter(b => b.status === 'connected'))
const users = ref<UserOption[]>([])
const differences = ref<any[]>([])
const statsByBranch = ref<any[]>([])
const statsByLine = ref<any[]>([])
const statsByUser = ref<any[]>([])
const statsByWarehouse = ref<any[]>([])
const topItems = ref<any[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')

const filters = reactive({
  branch_id: '',
  linea: '',
  item_code: '',
  responsible_user_id: '',
  date_from: '',
  date_to: '',
  limit: 50,
  offset: 0
})

const branchChartData = computed(() => {
  if (!statsByBranch.value.length) return []
  return statsByBranch.value.map(s => ({
    id: s.branch_id,
    name: getBranchName(s.branch_id),
    count: s.count,
    percentage: total.value > 0 ? (s.count / total.value) * 100 : 0
  })).sort((a, b) => b.count - a.count)
})

const warehouseChartData = computed(() => {
  if (!statsByWarehouse.value.length) return []
  return statsByWarehouse.value.map(s => ({
    name: `Almacén ${s.warehouse_id}`,
    count: s.count,
    percentage: total.value > 0 ? (s.count / total.value) * 100 : 0
  }))
})

const lineChartData = computed(() => {
  if (!statsByLine.value.length) return []
  return statsByLine.value.map(s => ({
    name: `Línea ${s.linea}`,
    count: s.count,
    percentage: total.value > 0 ? (s.count / total.value) * 100 : 0
  }))
})

const userChartData = computed(() => {
  if (!statsByUser.value.length) return []
  return statsByUser.value.map(s => ({
    name: s.user_name || 'Desconocido',
    count: s.count,
    percentage: total.value > 0 ? (s.count / total.value) * 100 : 0
  }))
})


const pageInfo = computed(() => {
  const start = total.value === 0 ? 0 : filters.offset + 1
  const end = Math.min(filters.offset + filters.limit, total.value)
  return { start, end }
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

const loadData = async () => {
  try {
    loading.value = true
    error.value = ''
    
    const params: any = { ...filters }
    if (params.branch_id) params.branch_id = Number(params.branch_id)
    if (params.responsible_user_id) params.responsible_user_id = Number(params.responsible_user_id)
    
    const response = await countsService.getDifferences(params)
    console.log('API Diff Response:', response) // Debug
    
    if (Array.isArray(response)) {
      differences.value = response
      total.value = response.length
      // Si recibimos array (legacy), calculamos stats localmente
      const map = new Map<number, number>()
      response.forEach((r: any) => map.set(r.branch_id, (map.get(r.branch_id) || 0) + 1))
      statsByBranch.value = Array.from(map.entries()).map(([branch_id, count]) => ({ branch_id, count }))
    } else {
      differences.value = response.data || []
      total.value = response.total || 0
      statsByBranch.value = response.statsByBranch || []
      statsByLine.value = response.statsByLine || []
      statsByUser.value = response.statsByUser || []
      statsByWarehouse.value = response.statsByWarehouse || []
      topItems.value = response.topItems || []
    }


  } catch (err) {
    console.error('Error loading differences', err)
    error.value = 'No se pudieron cargar los detalles de las diferencias'
  } finally {
    loading.value = false
  }
}


const applyFilters = () => {
  filters.offset = 0
  loadData()
}

const resetFilters = () => {
  filters.branch_id = ''
  filters.linea = ''
  filters.item_code = ''
  filters.responsible_user_id = ''
  filters.date_from = ''
  filters.date_to = ''
  applyFilters()
}

const prevPage = () => {
  filters.offset = Math.max(0, filters.offset - filters.limit)
  loadData()
}

const nextPage = () => {
  filters.offset += filters.limit
  loadData()
}

const formatDateTime = (value: string) => {
  return value ? new Date(value).toLocaleString('es-MX') : '-'
}

const getBranchName = (id: number) => {
  return branches.value.find(b => b.id === id)?.name || `ID ${id}`
}

const formatDuration = (min: number | null) => {
  if (min === null || min === undefined) return '-'
  const m = Math.round(min)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`
}

const selectBranch = (id: number) => {
  filters.branch_id = String(id)
  applyFilters()
}

const selectUser = (id: number) => {
  filters.responsible_user_id = String(id)
  applyFilters()
}

onMounted(() => {
  loadBranches()
  loadUsers()
  loadData()
})
</script>


<template>
  <div class="differences-detail">
    <section class="panel wide">
      <div class="panel-top">
        <div class="panel-header">
          <div class="panel-title">
            <MobileMenuToggle />
            <div class="panel-title-text">
              <p class="eyebrow">Reportes</p>
              <h2>Detalle de Diferencias</h2>
              <p class="muted">Análisis granular de discrepancias de inventario.</p>
            </div>
          </div>
          <div class="header-actions">
            <span class="tag accent shadow-sm">{{ total }} discrepancias</span>
            <button class="btn ghost" @click="loadData">
              <IconRefresh :size="18" />
            </button>
          </div>
        </div>

        <!-- Panel de Filtros (AHORA ARRIBA) -->
        <div class="filters-card compact">
          <div class="filters-grid">
            <div class="filter-item">
              <label>Sucursal</label>
              <select v-model="filters.branch_id" @change="applyFilters">
                <option value="">Todas las sucursales</option>
                <option v-for="b in connectedBranches" :key="b.id" :value="b.id">{{ b.name }}</option>
              </select>
            </div>
            <div class="filter-item">
              <label>Agente</label>
              <select v-model="filters.responsible_user_id" @change="applyFilters">
                <option value="">Todos los agentes</option>
                <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option>
              </select>
            </div>
            <div class="filter-item">
              <label>Línea</label>
              <input v-model="filters.linea" type="text" placeholder="Ej. 01001" @keyup.enter="applyFilters" />
            </div>
            <div class="filter-item">
              <label>Desde / Hasta</label>
              <div class="date-range">
                <input v-model="filters.date_from" type="date" @change="applyFilters" />
                <input v-model="filters.date_to" type="date" @change="applyFilters" />
              </div>
            </div>
          </div>
          <div class="filters-actions">
            <button class="btn ghost btn-sm" @click="resetFilters">Limpiar</button>
            <button class="btn btn-sm accent" @click="applyFilters">Filtrar</button>
          </div>
        </div>

        <!-- Análisis Profundo de Sucursal (Condicional) -->
        <div v-if="filters.branch_id && total > 0" class="branch-analysis animate-fade-in">
          <div class="analysis-header">
            <IconBuildingStore :size="20" class="text-accent" />
            <h3>Análisis Profundo: {{ getBranchName(Number(filters.branch_id)) }}</h3>
          </div>
          
          <div class="analysis-grid">
            <div class="analysis-panel">
              <p class="eyebrow small">Diferencias por Almacén</p>
              <div class="chart-bars">
                <div v-for="item in warehouseChartData" :key="item.name" class="chart-bar-item">
                  <div class="bar-info">
                    <span>{{ item.name }}</span>
                    <span class="muted">{{ item.count }}</span>
                  </div>
                  <div class="bar-outer"><div class="bar-inner warning" :style="{ width: item.percentage + '%' }"></div></div>
                </div>
              </div>
            </div>

            <div class="analysis-panel">
              <p class="eyebrow small">Artículos con mayor incidencia</p>
              <table class="table mini-table">
                <thead>
                  <tr><th>Código</th><th>Descripción</th><th class="text-right">Frecuencia</th></tr>
                </thead>
                <tbody>
                  <tr v-for="item in topItems" :key="item.item_code">
                    <td><code>{{ item.item_code }}</code></td>
                    <td class="text-xs truncate-cell-mini">{{ item.item_description }}</td>
                    <td class="text-right"><strong>{{ item.count }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Gráfico de Distribución Multipanel -->
        <div v-if="total > 0" class="charts-container animate-fade-in">
          <div class="chart-panel">
            <p class="eyebrow small">Diferencias por línea (Top 4)</p>
            <div class="chart-bars">
              <div v-for="item in lineChartData.slice(0, 4)" :key="item.name" class="chart-bar-item">
                <div class="bar-info">
                  <span>{{ item.name }}</span>
                  <span class="muted">{{ item.count }}</span>
                </div>
                <div class="bar-outer"><div class="bar-inner accent" :style="{ width: item.percentage + '%' }"></div></div>
              </div>
            </div>
          </div>

          <div class="chart-panel">
            <p class="eyebrow small">Diferencias por agente (Top 4)</p>
            <div class="chart-bars">
              <div v-for="item in userChartData.slice(0, 4)" :key="item.name" class="chart-bar-item">
                <div class="bar-info">
                  <span>{{ item.name }}</span>
                  <span class="muted">{{ item.count }}</span>
                </div>
                <div class="bar-outer"><div class="bar-inner success" :style="{ width: item.percentage + '%' }"></div></div>
              </div>
            </div>
          </div>
        </div>


        <!-- Secciones de Resumen Interactivas -->
        <div v-if="total > 0 && !filters.branch_id" class="summary-tables-grid animate-fade-in">
          <!-- Tabla Resumen por Sucursal -->
          <div class="global-stats-table">
            <div class="panel-header no-border">
              <p class="eyebrow small">Diferencias Por Sucursal</p>
              <span class="tag live shadow-sm">Audit Live</span>
            </div>
            <div class="stats-table-wrapper card-style">
              <table class="table simple-table interactive">
                <thead>
                  <tr>
                    <th>SUCURSAL</th>
                    <th class="text-right">UNIDADES CON DIFERENCIA</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in branchChartData" :key="item.id" @click="selectBranch(item.id)">
                    <td><strong>{{ item.name }}</strong></td>
                    <td class="text-right">
                      <div class="count-with-arrow">
                        <span class="count-badge">{{ item.count }}</span>
                        <IconChevronRight :size="14" class="row-arrow" />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Tabla Tiempo de Resolución -->
          <div class="global-stats-table">
            <div class="panel-header no-border">
              <p class="eyebrow small">Tiempo de resolución por usuario</p>
              <span class="tag accent shadow-sm">Ajustes</span>
            </div>
            <div class="stats-table-wrapper card-style">
              <table class="table simple-table interactive">
                <thead>
                  <tr>
                    <th>USUARIO</th>
                    <th class="text-right">TIEMPO PROMEDIO</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in userChartData" :key="item.name" @click="selectUser(item.id)">
                    <td><strong>{{ item.name }}</strong></td>
                    <td class="text-right">
                      <div class="count-with-arrow">
                        <span class="time-text">{{ formatDuration(item.avg_resolution_time) }}</span>
                        <IconChevronRight :size="14" class="row-arrow" />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>





      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Cargando detalles...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <button class="btn" @click="loadData">Reintentar</button>
      </div>

      <div v-else>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Sucursal</th>
                <th>Agente</th>
                <th>Folio</th>
                <th>Artículo</th>
                <th>Descripción</th>
                <th>Almacén</th>
                <th class="text-right">Sistema</th>
                <th class="text-right">Contado</th>
                <th class="text-right">Diff</th>
                <th>Unidad</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in differences" :key="row.id">
                <td>
                  <span class="branch-tag">{{ getBranchName(row.branch_id) }}</span>
                </td>
                <td class="font-medium text-sm">{{ row.responsible_name || 'N/A' }}</td>
                <td>
                  <router-link :to="{ name: 'conteos-detalle', params: { id: row.count_id } }" class="folio-link">
                    {{ row.folio }}
                  </router-link>
                </td>
                <td><strong>{{ row.item_code }}</strong></td>
                <td class="text-sm truncate-cell" :title="row.item_description">{{ row.item_description }}</td>
                <td><span class="tag">{{ row.warehouse_name }}</span></td>
                <td class="text-right font-mono">{{ row.system_stock }}</td>
                <td class="text-right font-mono">{{ row.counted_stock }}</td>
                <td class="text-right font-mono">
                  <span :class="['diff-badge', row.counted_stock > row.system_stock ? 'positive' : 'negative']">
                    {{ row.counted_stock > row.system_stock ? '+' : '' }}{{ row.counted_stock - row.system_stock }}
                  </span>
                </td>
                <td class="text-xs muted">{{ row.unit }}</td>
                <td class="text-xs muted">{{ formatDateTime(row.counted_at) }}</td>
              </tr>
              <tr v-if="differences.length === 0">
                <td colspan="11" class="empty-state">No se encontraron discrepancias con los filtros seleccionados</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <div class="pagination">
          <p class="pagination-info">
            Mostrando <strong>{{ pageInfo.start }}</strong> a <strong>{{ pageInfo.end }}</strong> de <strong>{{ total }}</strong> discrepancias
          </p>
          <div class="pagination-controls">
            <button class="btn ghost btn-sm" :disabled="filters.offset === 0" @click="prevPage">
              <IconArrowLeft :size="16" />
              <span>Anterior</span>
            </button>
            <button class="btn ghost btn-sm" :disabled="filters.offset + filters.limit >= total" @click="nextPage">
              <span>Siguiente</span>
              <IconArrowRight :size="16" />
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.differences-detail {
  padding-bottom: 2rem;
}

.charts-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

.chart-panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.chart-bars {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.chart-bar-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.bar-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  font-weight: 500;
}

.bar-outer {
  height: 6px;
  background: var(--panel-muted);
  border-radius: 999px;
  overflow: hidden;
}

.bar-inner {
  height: 100%;
  background: var(--ink);
  border-radius: 999px;
  transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.bar-inner.accent { background: var(--accent); }
.bar-inner.success { background: #10b981; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fadeIn 0.5s ease-out forwards;
}

@media (max-width: 1024px) {
  .charts-container {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .charts-container {
    grid-template-columns: 1fr;
  }
}

.filters-card.compact {
  background: var(--surface);
  border: 1px solid var(--line);
  padding: 1rem 1.5rem;
}

.date-range {
  display: flex;
  gap: 0.5rem;
}

.date-range input {
  padding: 0.4rem;
  font-size: 0.8rem;
}

.branch-analysis {
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, var(--accent-soft), #fff);
  border: 1px solid var(--accent-soft);
  border-radius: 16px;
}

.analysis-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.analysis-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--accent-strong);
}

.analysis-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 2rem;
}

.analysis-panel {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(4px);
  border-radius: 12px;
  padding: 1rem;
  border: 1px solid #fff;
}

.mini-table {
  width: 100%;
  font-size: 0.85rem;
}

.mini-table th { padding: 0.5rem; }
.mini-table td { padding: 0.4rem 0.5rem; }

.truncate-cell-mini {
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-inner.warning { background: var(--warning, #f59e0b); }

.filters-card {

  background: var(--panel-muted);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 1.25rem;
  margin-top: 1rem;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.filter-item label {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin-bottom: 0.4rem;
}

.search-input {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
}

.search-input input {
  padding-left: 2.25rem;
}

.filters-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--line);
}

.btn-sm {
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
}

.loading-state, .error-state {
  padding: 4rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.table-wrap {
  margin-top: 1.5rem;
}

.branch-tag {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent-strong);
  background: var(--accent-soft);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  white-space: nowrap;
}

.folio-link {
  color: var(--accent-strong);
  text-decoration: none;
  font-weight: 600;
}

.folio-link:hover {
  text-decoration: underline;
}

.truncate-cell {
  max-width: 250px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.diff-badge {
  display: inline-block;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.85rem;
}

.diff-badge.positive {
  color: #059669;
  background: #ecfdf5;
}

.diff-badge.negative {
  color: #dc2626;
  background: #fef2f2;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--muted);
  font-style: italic;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--line);
}

.pagination-info {
  font-size: 0.9rem;
  color: var(--muted);
}

.pagination-controls {
  display: flex;
  gap: 0.75rem;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--accent-soft);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .filters-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 480px) {
  .filters-grid {
    grid-template-columns: 1fr;
  }
}
.global-stats-table {
  margin-top: 1.5rem;
}

.card-style {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.simple-table {
  width: 100%;
  border-collapse: collapse;
}

.simple-table th {
  background: var(--panel-muted);
  color: var(--muted);
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  padding: 0.75rem 1.25rem;
  text-align: left;
}

.simple-table td {
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--line);
  font-size: 0.95rem;
}

.simple-table tr:last-child td {
  border-bottom: none;
}

.count-badge {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 700;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-family: var(--font-mono);
}

.tag.live {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  font-size: 0.7rem;
}

.summary-tables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

.table.simple-table.interactive tbody tr {
  cursor: pointer;
  transition: background 0.2s ease;
}

.table.simple-table.interactive tbody tr:hover {
  background: var(--accent-soft);
}

.count-with-arrow {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.row-arrow {
  opacity: 0;
  transform: translateX(-5px);
  transition: all 0.2s ease;
  color: var(--accent-strong);
}

.table.simple-table.interactive tbody tr:hover .row-arrow {
  opacity: 1;
  transform: translateX(0);
}

.time-text {
  font-weight: 600;
  color: var(--muted);
  font-family: var(--font-mono);
}

</style>
