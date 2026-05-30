<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import { reportsService, branchesService } from '@/services/api'
import { IconCalculator, IconTrendingUp, IconTrendingDown, IconCurrencyDollar } from '@tabler/icons-vue'

const loading = ref(false)
const error = ref('')
const reportData = ref<any[]>([])

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
    const data = await reportsService.getAdjustmentsReport({
      branch_id: filters.branch_id ? Number(filters.branch_id) : undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined
    })
    reportData.value = data
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

const totalPositiveAmount = computed(() => {
  return reportData.value.reduce((sum, item) => sum + Number(item.amount_positive || 0), 0)
})

const totalNegativeAmount = computed(() => {
  return reportData.value.reduce((sum, item) => sum + Number(item.amount_negative || 0), 0)
})

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
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
        <h2>Reporte de Ajustes (Diferencias)</h2>
        <p class="muted">Cantidades y montos de diferencias en conteos de inventario</p>
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

    <!-- Tarjetas de Totales -->
    <div class="panel-grid">
      <section class="panel stat-card">
        <div class="stat-icon positive"><IconTrendingUp :size="32" /></div>
        <div class="stat-info">
          <p class="eyebrow">Total Diferencias Positivas (De más)</p>
          <h2>{{ formatCurrency(totalPositiveAmount) }}</h2>
        </div>
      </section>

      <section class="panel stat-card">
        <div class="stat-icon negative"><IconTrendingDown :size="32" /></div>
        <div class="stat-info">
          <p class="eyebrow">Total Diferencias Negativas (De menos)</p>
          <h2 class="text-danger">{{ formatCurrency(totalNegativeAmount) }}</h2>
        </div>
      </section>
    </div>

    <!-- Tabla -->
    <div class="panel">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Calculando diferencias y consultando costos remotos...</p>
      </div>
      
      <div v-else-if="error" class="error-state">
        <p class="text-danger">{{ error }}</p>
      </div>
      
      <div v-else class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Sucursal</th>
              <th>Línea</th>
              <th>Artículo</th>
              <th class="text-right">Costo Unit.</th>
              <th class="text-right">Ajuste de Más (Cant)</th>
              <th class="text-right">Monto de Más ($)</th>
              <th class="text-right">Ajuste de Menos (Cant)</th>
              <th class="text-right">Monto de Menos ($)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in reportData" :key="index">
              <td>{{ row.branch_name }}</td>
              <td><strong>{{ row.line }}</strong></td>
              <td>{{ row.item_code }}</td>
              <td class="text-right muted">{{ formatCurrency(row.unit_cost) }}</td>
              <td class="text-right text-success">
                <span v-if="row.qty_positive > 0">+{{ row.qty_positive }}</span>
                <span v-else class="muted">-</span>
              </td>
              <td class="text-right text-success">
                <strong v-if="row.amount_positive > 0">{{ formatCurrency(row.amount_positive) }}</strong>
                <span v-else class="muted">-</span>
              </td>
              <td class="text-right text-danger">
                <span v-if="row.qty_negative > 0">-{{ row.qty_negative }}</span>
                <span v-else class="muted">-</span>
              </td>
              <td class="text-right text-danger">
                <strong v-if="row.amount_negative > 0">{{ formatCurrency(row.amount_negative) }}</strong>
                <span v-else class="muted">-</span>
              </td>
            </tr>
            <tr v-if="reportData.length === 0">
              <td colspan="8" class="text-center muted py-4">No se encontraron diferencias en el rango seleccionado.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
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

.panel-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 768px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  background: linear-gradient(135deg, var(--panel), #fff);
}

.stat-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: #fff;
}

.stat-icon.positive {
  background: #10b981;
}

.stat-icon.negative {
  background: #ef4444;
}

.stat-info h2 {
  font-size: 2rem;
  margin: 0.2rem 0;
  color: var(--ink);
}

.filters-panel {
  padding: 1rem 1.5rem;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) auto;
  gap: 1rem;
  align-items: flex-end;
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
}

.table th, .table td {
  white-space: nowrap;
}

.text-right { text-align: right; }
.text-center { text-align: center; }
.text-danger { color: #ef4444 !important; }
.text-success { color: #10b981 !important; }
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
