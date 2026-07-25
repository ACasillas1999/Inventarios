<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { reportsService, branchesService, type BulkRequestsReport, type Branch } from '@/services/api'
import { IconListNumbers, IconClockHour4, IconFiles, IconDownload } from '@tabler/icons-vue'

const loading = ref(false)
const error = ref('')
const report = ref<BulkRequestsReport | null>(null)
const branches = ref<Branch[]>([])

const filters = reactive({
  branch_id: '',
  status: '',
  date_from: '',
  date_to: ''
})

const priorityLabelMap: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
  mostrador: 'Mostrador'
}

const fetchData = async () => {
  loading.value = true
  error.value = ''
  try {
    report.value = await reportsService.getBulkRequestsReport({
      branch_id: filters.branch_id ? Number(filters.branch_id) : undefined,
      status: filters.status || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined
    })
  } catch (err) {
    console.error('Error fetching bulk requests report', err)
    error.value = 'Error al cargar el reporte.'
  } finally {
    loading.value = false
  }
}

const fetchBranches = async () => {
  try {
    const data = await branchesService.getAll()
    branches.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error fetching branches', err)
  }
}

const formatHours = (value: number | null) => {
  if (value === null || value === undefined) return '-'
  if (value < 1) return `${Math.round(value * 60)} min`
  return `${value.toFixed(1)} h`
}

onMounted(() => {
  fetchBranches()
  fetchData()
})
</script>

<template>
  <div class="report-container">
    <div class="panel-header page-title">
      <div>
        <h2>Reporte de Diferencias masivas</h2>
        <p class="muted">Estatus, tiempos de resolución, usuarios y archivos adjuntos</p>
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
          <label>Estatus</label>
          <select v-model="filters.status" @change="fetchData">
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_revision">En revisión</option>
            <option value="ajustado">Ajustado</option>
            <option value="rechazado">Rechazado</option>
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

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Calculando reporte...</p>
    </div>

    <div v-else-if="error" class="panel error-state">
      <p class="text-danger">{{ error }}</p>
    </div>

    <template v-else-if="report">
      <!-- Tarjetas de totales -->
      <div class="panel-grid">
        <section class="panel stat-card">
          <div class="stat-icon total"><IconListNumbers :size="32" /></div>
          <div class="stat-info">
            <p class="eyebrow">Total de solicitudes</p>
            <h2>{{ report.summary.total }}</h2>
          </div>
        </section>
        <section class="panel stat-card">
          <div class="stat-icon time"><IconClockHour4 :size="32" /></div>
          <div class="stat-info">
            <p class="eyebrow">Promedio a resolución</p>
            <h2>{{ formatHours(report.resolution.overall_avg_hours) }}</h2>
          </div>
        </section>
        <section class="panel stat-card">
          <div class="stat-icon files"><IconFiles :size="32" /></div>
          <div class="stat-info">
            <p class="eyebrow">Archivos adjuntos</p>
            <h2>{{ report.files.total_files }}</h2>
          </div>
        </section>
        <section class="panel stat-card">
          <div class="stat-icon downloads"><IconDownload :size="32" /></div>
          <div class="stat-info">
            <p class="eyebrow">Total de descargas</p>
            <h2>{{ report.files.total_downloads }}</h2>
          </div>
        </section>
      </div>

      <!-- Por sucursal -->
      <div class="panel">
        <h3>Por sucursal</h3>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Sucursal</th>
                <th class="text-right">Pendiente</th>
                <th class="text-right">En revisión</th>
                <th class="text-right">Ajustado</th>
                <th class="text-right">Rechazado</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.summary.by_branch" :key="row.branch_id">
                <td>{{ row.branch_name }}</td>
                <td class="text-right">{{ row.pendiente }}</td>
                <td class="text-right">{{ row.en_revision }}</td>
                <td class="text-right">{{ row.ajustado }}</td>
                <td class="text-right">{{ row.rechazado }}</td>
                <td class="text-right"><strong>{{ row.total }}</strong></td>
              </tr>
              <tr v-if="report.summary.by_branch.length === 0">
                <td colspan="6" class="text-center muted py-4">Sin solicitudes en el rango seleccionado.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Por prioridad -->
      <div class="panel">
        <h3>Por prioridad</h3>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Prioridad</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.summary.by_priority" :key="row.priority">
                <td>{{ priorityLabelMap[row.priority] || row.priority }}</td>
                <td class="text-right">{{ row.total }}</td>
              </tr>
              <tr v-if="report.summary.by_priority.length === 0">
                <td colspan="2" class="text-center muted py-4">Sin datos.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Ranking de usuarios -->
      <div class="panel-grid two-cols">
        <div class="panel">
          <h3>Top solicitantes</h3>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th class="text-right">Solicitudes creadas</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in report.users.top_requesters" :key="row.user_id">
                  <td>{{ row.user_name }}</td>
                  <td class="text-right">{{ row.total }}</td>
                </tr>
                <tr v-if="report.users.top_requesters.length === 0">
                  <td colspan="2" class="text-center muted py-4">Sin datos.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="panel">
          <h3>Top gestores</h3>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th class="text-right">Solicitudes gestionadas</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in report.users.top_reviewers" :key="row.user_id">
                  <td>{{ row.user_name }}</td>
                  <td class="text-right">{{ row.total }}</td>
                </tr>
                <tr v-if="report.users.top_reviewers.length === 0">
                  <td colspan="2" class="text-center muted py-4">Sin datos.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tiempos de resolución por sucursal -->
      <div class="panel">
        <h3>Tiempos de resolución por sucursal</h3>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Sucursal</th>
                <th class="text-right">Promedio</th>
                <th class="text-right">Solicitudes resueltas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.resolution.by_branch" :key="row.branch_id">
                <td>{{ row.branch_name }}</td>
                <td class="text-right">{{ formatHours(row.avg_hours) }}</td>
                <td class="text-right">{{ row.resolved_count }}</td>
              </tr>
              <tr v-if="report.resolution.by_branch.length === 0">
                <td colspan="3" class="text-center muted py-4">Aún no hay solicitudes resueltas (Ajustado/Rechazado).</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tiempos de resolución por usuario -->
      <div class="panel">
        <h3>Tiempos de resolución por usuario</h3>
        <p class="muted">Promedio desde que se crea la solicitud hasta que el usuario la deja en Ajustado o Rechazado.</p>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th class="text-right">Promedio</th>
                <th class="text-right">Solicitudes resueltas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.resolution.by_reviewer" :key="row.user_id">
                <td>{{ row.user_name }}</td>
                <td class="text-right">{{ formatHours(row.avg_hours) }}</td>
                <td class="text-right">{{ row.resolved_count }}</td>
              </tr>
              <tr v-if="report.resolution.by_reviewer.length === 0">
                <td colspan="3" class="text-center muted py-4">Aún no hay solicitudes resueltas por ningún usuario.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Archivos -->
      <div class="panel">
        <h3>Archivos adjuntos</h3>
        <p class="muted" v-if="report.files.never_downloaded_count > 0">
          {{ report.files.never_downloaded_count }} archivo(s) nunca se han descargado.
        </p>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Solicitud</th>
                <th class="text-right">Descargas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in report.files.top_files" :key="row.file_id">
                <td>{{ row.original_name }}</td>
                <td>{{ row.folio }}</td>
                <td class="text-right">
                  <span v-if="row.download_count === 0" class="badge-never">Nunca descargado</span>
                  <strong v-else>{{ row.download_count }}</strong>
                </td>
              </tr>
              <tr v-if="report.files.top_files.length === 0">
                <td colspan="3" class="text-center muted py-4">Sin archivos en el rango seleccionado.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.report-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-title {
  padding: 0;
  background: transparent;
  border: none;
}

.panel h3 {
  margin: 0 0 0.9rem;
  font-size: 1rem;
  color: var(--ink);
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.panel-grid.two-cols {
  grid-template-columns: 1fr 1fr;
}

@media (max-width: 1024px) {
  .panel-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .panel-grid,
  .panel-grid.two-cols {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, var(--panel), #fff);
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #fff;
  flex-shrink: 0;
}

.stat-icon.total { background: var(--accent); }
.stat-icon.time { background: #d97706; }
.stat-icon.files { background: #7c3aed; }
.stat-icon.downloads { background: #16a34a; }

.stat-info h2 {
  font-size: 1.7rem;
  margin: 0.2rem 0;
  color: var(--ink);
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

.filter-actions {
  display: flex;
  gap: 0.5rem;
}

.table th,
.table td {
  white-space: nowrap;
}

.badge-never {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(220, 38, 38, 0.12);
  color: var(--danger, #dc2626);
  font-size: 0.72rem;
  font-weight: 700;
}

.text-right { text-align: right; }
.text-center { text-align: center; }
.muted { opacity: 0.7; }
.py-4 { padding-top: 2rem; padding-bottom: 2rem; }

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
</style>
