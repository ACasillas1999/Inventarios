<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { countsService } from '@/services/api'
import { useRouter } from 'vue-router'
import MobileMenuToggle from '@/components/MobileMenuToggle.vue'

const router = useRouter()

interface BranchStat {
  branch_id: number
  branch_name: string
  total: number
  pending: number
  in_progress: number
  finished: number
  closed: number
  cancelled: number
  last_count_date: string | null
}

interface RecentCount {
  id: number
  folio: string
  status: string
  type: string
  classification: string
  branch_name: string
  responsible_name: string
  scheduled_date: string | null
  created_at: string
}

interface DashboardStats {
  total_counts: number
  pending_counts: number
  in_progress_counts: number
  finished_counts: number
  closed_counts: number
  cancelled_counts: number
  scheduled_today: number
  by_branch: BranchStat[]
  recent_counts: RecentCount[]
}

const stats = ref<DashboardStats | null>(null)
const loading = ref(true)
const error = ref('')

const normalize = (raw: any): DashboardStats => ({
  total_counts: Number(raw?.total_counts ?? 0),
  pending_counts: Number(raw?.pending_counts ?? 0),
  in_progress_counts: Number(raw?.in_progress_counts ?? 0),
  finished_counts: Number(raw?.finished_counts ?? 0),
  closed_counts: Number(raw?.closed_counts ?? 0),
  cancelled_counts: Number(raw?.cancelled_counts ?? 0),
  scheduled_today: Number(raw?.scheduled_today ?? 0),
  by_branch: Array.isArray(raw?.by_branch) ? raw.by_branch : [],
  recent_counts: Array.isArray(raw?.recent_counts) ? raw.recent_counts : []
})

const kpiCards = computed(() => {
  if (!stats.value) return []
  const s = stats.value
  return [
    { title: 'Total conteos', value: s.total_counts, detail: 'Todos los registros', tone: 'neutral', icon: '📋' },
    { title: 'Pendientes', value: s.pending_counts, detail: `${s.scheduled_today} programados hoy`, tone: 'warning', icon: '⏳' },
    { title: 'En proceso', value: s.in_progress_counts, detail: 'Conteos activos ahora', tone: 'progress', icon: '🔄' },
    { title: 'Cerrados', value: s.closed_counts, detail: `${s.finished_counts} contados sin cerrar`, tone: 'success', icon: '✅' },
  ]
})

const statusLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  contando: 'En proceso',
  contado: 'Contado',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado'
}

const statusClass: Record<string, string> = {
  pendiente: 'badge-warning',
  contando: 'badge-progress',
  contado: 'badge-info',
  cerrado: 'badge-success',
  cancelado: 'badge-danger'
}

const typeLabel: Record<string, string> = {
  ciclico: 'Cíclico',
  por_familia: 'Por familia',
  por_zona: 'Por zona',
  rango: 'Por rango',
  total: 'Total'
}

const formatDate = (d: string | null) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const loadStats = async () => {
  try {
    loading.value = true
    error.value = ''
    const raw = await countsService.getDashboardStats()
    stats.value = normalize(raw)
  } catch (err: any) {
    console.error('Error loading dashboard stats:', err)
    error.value = 'Error al cargar las estadísticas del dashboard'
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
</script>

<template>
  <div v-if="loading" class="loading-state">
    <p>Cargando estadísticas...</p>
  </div>

  <div v-else-if="error" class="error-state panel">
    <p class="error-msg">{{ error }}</p>
    <button class="btn" @click="loadStats">Reintentar</button>
  </div>

  <template v-else>
    <section class="panel wide">
      <div class="panel-header">
        <div class="panel-title">
          <MobileMenuToggle />
          <div class="panel-title-text">
            <p class="eyebrow">Conteos</p>
            <h2>Dashboard de conteos</h2>
            <p class="muted">Resumen general y desglose por sucursal.</p>
          </div>
        </div>
        <div class="header-actions">
          <span class="tag accent">{{ new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) }}</span>
          <button class="btn-icon" @click="loadStats" title="Actualizar">🔄</button>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <div v-for="card in kpiCards" :key="card.title" class="kpi-card" :class="'kpi-' + card.tone">
          <div class="kpi-icon">{{ card.icon }}</div>
          <div class="kpi-body">
            <p class="kpi-label">{{ card.title }}</p>
            <p class="kpi-value">{{ card.value }}</p>
            <p class="kpi-detail">{{ card.detail }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Tabla por sucursal -->
    <section class="panel wide" style="margin-top: 1rem">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Sucursales</p>
          <h3>Resumen por sucursal</h3>
        </div>
        <span class="tag">{{ stats?.by_branch.length ?? 0 }} sucursales</span>
      </div>

      <div v-if="stats && stats.by_branch.length > 0" class="table-scroll">
        <table class="dash-table">
          <thead>
            <tr>
              <th>Sucursal</th>
              <th class="num">Pendientes</th>
              <th class="num">En proceso</th>
              <th class="num">Contados</th>
              <th class="num">Cerrados</th>
              <th class="num">Total</th>
              <th>Último conteo</th>
              <th>Progreso</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in stats.by_branch" :key="b.branch_id">
              <td><strong>{{ b.branch_name }}</strong></td>
              <td class="num">
                <span v-if="b.pending > 0" class="badge badge-warning">{{ b.pending }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td class="num">
                <span v-if="b.in_progress > 0" class="badge badge-progress">{{ b.in_progress }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td class="num">
                <span v-if="b.finished > 0" class="badge badge-info">{{ b.finished }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td class="num">
                <span v-if="b.closed > 0" class="badge badge-success">{{ b.closed }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td class="num"><strong>{{ b.total }}</strong></td>
              <td class="muted small">{{ formatDate(b.last_count_date) }}</td>
              <td style="min-width: 110px">
                <div class="mini-bar">
                  <div
                    class="mini-fill closed-fill"
                    :style="{ width: b.total ? `${Math.round((b.closed / b.total) * 100)}%` : '0%' }"
                  ></div>
                  <div
                    class="mini-fill progress-fill"
                    :style="{ width: b.total ? `${Math.round((b.in_progress / b.total) * 100)}%` : '0%' }"
                  ></div>
                </div>
                <p class="muted small" style="margin-top: 2px">
                  {{ b.total ? Math.round(((b.closed + b.finished) / b.total) * 100) : 0 }}% completado
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="muted" style="padding: 1rem 0">No hay sucursales registradas.</p>
    </section>

    <!-- Conteos recientes -->
    <section class="panel wide" style="margin-top: 1rem">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Actividad</p>
          <h3>Conteos recientes</h3>
        </div>
        <span class="tag">Últimos {{ stats?.recent_counts.length ?? 0 }}</span>
      </div>

      <div v-if="stats && stats.recent_counts.length > 0" class="table-scroll">
        <table class="dash-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Sucursal</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Responsable</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in stats.recent_counts"
              :key="c.id"
              class="clickable-row"
              @click="router.push(`/conteos/${c.id}`)"
            >
              <td><strong>{{ c.folio }}</strong></td>
              <td>{{ c.branch_name || '—' }}</td>
              <td class="muted">{{ typeLabel[c.type] || c.type }}</td>
              <td>
                <span :class="['badge', statusClass[c.status] || 'badge-neutral']">
                  {{ statusLabel[c.status] || c.status }}
                </span>
              </td>
              <td>{{ c.responsible_name || '—' }}</td>
              <td class="muted small">{{ formatDate(c.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="muted" style="padding: 1rem 0">No hay conteos recientes.</p>
    </section>
  </template>
</template>

<style scoped>
.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  color: var(--muted);
}

.error-state { padding: 2rem; text-align: center; }
.error-msg { color: var(--danger, #dc2626); margin-bottom: 1rem; }

.header-actions { display: flex; gap: 0.5rem; align-items: center; }

.btn-icon {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.4rem;
  border-radius: 8px;
  transition: background 0.2s;
}
.btn-icon:hover { background: var(--panel-muted); }

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 1rem 1.25rem;
  border-radius: 14px;
  border: 1px solid var(--line, #e5e7eb);
  background: #fff;
}

.kpi-neutral  { background: #f9fafb; }
.kpi-warning  { background: #fff7ed; border-color: #fed7aa; }
.kpi-progress { background: #eff6ff; border-color: #bfdbfe; }
.kpi-success  { background: #ecfdf5; border-color: #a7f3d0; }

.kpi-icon { font-size: 1.75rem; line-height: 1; }
.kpi-label { font-size: 0.78rem; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin: 0; }
.kpi-value { font-size: 2rem; font-weight: 800; margin: 0.1rem 0; line-height: 1; }
.kpi-detail { font-size: 0.78rem; color: var(--muted); margin: 0; }

/* Table */
.table-scroll { overflow-x: auto; }

.dash-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.dash-table th,
.dash-table td {
  padding: 0.6rem 0.85rem;
  text-align: left;
  border-bottom: 1px solid var(--line, #e5e7eb);
}

.dash-table th {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  background: #f9fafb;
}

.dash-table .num { text-align: center; }

.clickable-row { cursor: pointer; transition: background 0.15s; }
.clickable-row:hover { background: #f5f7ff; }

/* Badges */
.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
}
.badge-warning  { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
.badge-progress { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
.badge-info     { background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; }
.badge-success  { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
.badge-danger   { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
.badge-neutral  { background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }

/* Mini progress bar */
.mini-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
  display: flex;
}
.mini-fill { height: 100%; transition: width 0.4s; }
.closed-fill   { background: #10b981; }
.progress-fill { background: #3b82f6; }

.small { font-size: 0.8rem; }
.muted { color: var(--muted, #6b7280); }
</style>
