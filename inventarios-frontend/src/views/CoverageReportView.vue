<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { reportsService, branchesService } from '@/services/api'
import { IconChevronRight, IconChevronDown, IconBuildingStore, IconBuildingWarehouse, IconCategory, IconChartBar, IconChartPie } from '@tabler/icons-vue'

const loading = ref(true)
const error = ref('')
const companyOverview = ref<any>(null)
const coverageData = ref<any[]>([])
const lineStats = ref<any>({ topCounted: [], topDiff: [] })
const expandedItems = ref<Set<string>>(new Set())
const loadingMessage = ref('Cargando datos...')

const filters = reactive({
  branch_id: '',
  date_from: '',
  date_to: ''
})

const branches = ref<any[]>([])

const fetchData = async () => {
  loading.value = true
  error.value = ''
  try {
    // Load sequentially to show progress
    loadingMessage.value = 'Cargando vista general de la empresa...'
    const overview = await reportsService.getCompanyOverview()
    companyOverview.value = overview
    
    loadingMessage.value = 'Calculando cobertura por sucursal...'
    const coverage = await reportsService.getCoverageReport(filters.branch_id ? Number(filters.branch_id) : undefined)
    coverageData.value = coverage
    
    loadingMessage.value = 'Obteniendo estadísticas de líneas...'
    const stats = await reportsService.getLineStats({
      ...filters,
      branch_id: filters.branch_id ? Number(filters.branch_id) : undefined
    })
    lineStats.value = stats
    
    loadingMessage.value = 'Completado'
  } catch (err: any) {
    error.value = 'Error al cargar los datos del reporte.'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const fetchBranches = async () => {
  try {
    branches.value = await branchesService.getAll()
  } catch (err) {
    console.error('Error fetching branches:', err)
  }
}

const toggleExpand = (id: string) => {
  if (expandedItems.value.has(id)) {
    expandedItems.value.delete(id)
  } else {
    expandedItems.value.add(id)
  }
}

const getProgressColor = (percentage: number) => {
  if (percentage < 30) return '#ef4444' // Rojo
  if (percentage < 70) return '#f59e0b' // Ámbar
  return '#10b981' // Verde
}

onMounted(() => {
  fetchBranches()
  fetchData()
})
</script>

<template>
  <div class="report-container">
    <!-- Vista General Empresa -->
    <div v-if="companyOverview" class="overview-section">
      <div class="panel-grid">
        <section class="panel stat-card">
          <div class="stat-icon"><IconChartPie :size="32" /></div>
          <div class="stat-info">
            <p class="eyebrow">Cobertura Global</p>
            <h2>{{ companyOverview.coverage_percentage }}%</h2>
            <p class="muted">{{ companyOverview.counted_items }} de {{ companyOverview.total_items }} artículos</p>
          </div>
        </section>

        <section class="panel chart-card">
          <div class="panel-header">
            <h3>Cobertura por Sucursal</h3>
          </div>
          <div class="branch-bars">
            <div v-for="branch in companyOverview.branch_stats" :key="branch.name" class="branch-bar-item">
              <div class="bar-label">
                <span>{{ branch.name }}</span>
                <span>{{ branch.percentage }}%</span>
              </div>
              <div class="bar-bg">
                <div class="bar-fill" :style="{ width: branch.percentage + '%', backgroundColor: getProgressColor(branch.percentage) }"></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Filtros -->
    <div class="panel filters-panel">
      <div class="filters-grid">
        <div>
          <label>Sucursal</label>
          <select v-model="filters.branch_id" @change="fetchData">
            <option value="">Todas</option>
            <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div>
          <label>Desde</label>
          <input type="date" v-model="filters.date_from" @change="fetchData" />
        </div>
        <div>
          <label>Hasta</label>
          <input type="date" v-model="filters.date_to" @change="fetchData" />
        </div>
        <div class="filter-actions">
          <button class="btn" @click="fetchData">Actualizar</button>
        </div>
      </div>
    </div>

    <!-- Estadísticas de Líneas -->
    <div class="panel-grid stats-grid">
      <section class="panel">
        <div class="panel-header">
          <div class="header-icon"><IconChartBar /></div>
          <h3>Líneas con más conteos</h3>
        </div>
        <table class="table mini-table">
          <thead>
            <tr><th>Línea</th><th>Conteos</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in lineStats.topCounted" :key="item.name">
              <td>{{ item.name }}</td>
              <td><strong>{{ item.value }}</strong></td>
            </tr>
            <tr v-if="!lineStats.topCounted.length"><td colspan="2" class="muted text-center">Buscando datos...</td></tr>
          </tbody>
        </table>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div class="header-icon text-danger"><IconChartBar /></div>
          <h3>Líneas con mayor diferencia</h3>
        </div>
        <table class="table mini-table">
          <thead>
            <tr><th>Línea</th><th>Dif. Acumulada</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in lineStats.topDiff" :key="item.name">
              <td>{{ item.name }}</td>
              <td class="text-danger"><strong>{{ item.value }}</strong></td>
            </tr>
            <tr v-if="!lineStats.topDiff.length"><td colspan="2" class="muted text-center">Buscando datos...</td></tr>
          </tbody>
        </table>
      </section>
    </div>

    <!-- Vista Jerárquica -->
    <section class="panel hierarchy-panel">
      <div class="panel-header">
        <div>
          <h3>Detalle de Cobertura</h3>
          <p class="muted">Explora por sucursal, bodega y línea.</p>
        </div>
      </div>

      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>{{ loadingMessage }}</p>
      </div>

      <div v-else class="tree">
        <div v-for="branch in coverageData" :key="branch.id" class="tree-item branch-level">
          <div class="tree-header" @click="toggleExpand('b' + branch.id)">
            <component :is="expandedItems.has('b' + branch.id) ? IconChevronDown : IconChevronRight" :size="20" />
            <IconBuildingStore :size="20" class="text-accent" />
            <span class="tree-name">{{ branch.name }}</span>
            <div class="tree-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: branch.percentage + '%', backgroundColor: getProgressColor(branch.percentage) }"></div>
              </div>
              <span class="progress-text">{{ branch.percentage }}%</span>
            </div>
          </div>

          <div v-if="expandedItems.has('b' + branch.id)" class="tree-children">
            <div v-for="warehouse in branch.children" :key="warehouse.id" class="tree-item warehouse-level">
              <div class="tree-header" @click="toggleExpand('w' + warehouse.id)">
                <component :is="expandedItems.has('w' + warehouse.id) ? IconChevronDown : IconChevronRight" :size="18" />
                <IconBuildingWarehouse :size="18" class="text-warning" />
                <span class="tree-name">{{ warehouse.name }}</span>
                <div class="tree-progress">
                  <div class="progress-bar small">
                    <div class="progress-fill" :style="{ width: warehouse.percentage + '%', backgroundColor: getProgressColor(warehouse.percentage) }"></div>
                  </div>
                  <span class="progress-text">{{ warehouse.percentage }}%</span>
                </div>
              </div>

              <div v-if="expandedItems.has('w' + warehouse.id)" class="tree-children">
                <div v-for="line in warehouse.children" :key="line.id" class="tree-item line-level">
                  <div class="tree-header no-expand">
                    <IconCategory :size="16" class="text-muted" />
                    <span class="tree-name">{{ line.name }}</span>
                    <div class="tree-progress">
                      <div class="progress-bar xsmall">
                        <div class="progress-fill" :style="{ width: line.percentage + '%', backgroundColor: getProgressColor(line.percentage) }"></div>
                      </div>
                      <span class="progress-text">{{ line.percentage }}%</span>
                      <span class="tree-count muted">({{ line.counted_items }}/{{ line.total_items }})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.report-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.panel-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1rem;
}

@media (max-width: 1024px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  background: linear-gradient(135deg, var(--accent-soft), #fff);
}

.stat-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--accent);
  color: #fff;
  display: grid;
  place-items: center;
}

.stat-info h2 {
  font-size: 2.2rem;
  margin: 0.2rem 0;
  color: var(--ink);
}

.branch-bars {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.branch-bar-item {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.bar-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  font-weight: 600;
}

.bar-bg {
  height: 12px;
  background: var(--line);
  border-radius: 999px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  transition: width 1s ease-out;
}

.filters-panel {
  padding: 1rem 1.5rem;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) auto;
  gap: 1rem;
  align-items: flex-end;
}

.stats-grid {
  grid-template-columns: 1fr 1fr;
}

.mini-table {
  font-size: 0.9rem;
}

.header-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--panel-muted);
  display: grid;
  place-items: center;
  color: var(--accent);
}

/* Tree Styles */
.tree {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.tree-item {
  display: flex;
  flex-direction: column;
}

.tree-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.8rem 1rem;
  background: var(--panel-muted);
  border: 1px solid var(--line);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tree-header:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.tree-header.no-expand {
  cursor: default;
  background: transparent;
  padding: 0.6rem 2.5rem;
  border: none;
}

.tree-name {
  font-weight: 600;
  flex: 1;
}

.tree-progress {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 40%;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--line);
  border-radius: 999px;
  overflow: hidden;
}

.progress-bar.small { height: 6px; }
.progress-bar.xsmall { height: 4px; }

.progress-fill {
  height: 100%;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-text {
  font-size: 0.85rem;
  font-weight: 700;
  min-width: 40px;
  text-align: right;
}

.tree-count {
  font-size: 0.8rem;
  min-width: 80px;
  text-align: right;
}

.tree-children {
  margin-left: 1.5rem;
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-left: 2px dashed var(--line);
  padding-left: 1rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.text-danger { color: #ef4444 !important; }
.text-warning { color: #f59e0b !important; }
.text-accent { color: var(--accent) !important; }
.text-center { text-align: center; }
</style>
