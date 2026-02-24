<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { testDataService } from '@/services/api'
import { IconDatabase, IconTrash, IconRefresh, IconAlertTriangle, IconCheck } from '@tabler/icons-vue'

const loading = ref(false)
const stats = ref<any>(null)
const result = ref<any>(null)
const error = ref('')

const loadStats = async () => {
  try {
    stats.value = await testDataService.getStats()
  } catch (err: any) {
    console.error('Error loading stats:', err)
    error.value = 'Error al cargar estadísticas'
  }
}

const seedTestData = async () => {
  if (!confirm('¿Estás seguro de que deseas generar datos de prueba?\n\nEsto creará 5,500 artículos contados de prueba.')) {
    return
  }

  loading.value = true
  error.value = ''
  result.value = null

  try {
    result.value = await testDataService.seedCoverage()
    await loadStats()
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Error al generar datos de prueba'
  } finally {
    loading.value = false
  }
}

const cleanupTestData = async () => {
  if (!confirm('¿Estás seguro de que deseas eliminar TODOS los datos de prueba?\n\nEsta acción no se puede deshacer.')) {
    return
  }

  loading.value = true
  error.value = ''
  result.value = null

  try {
    result.value = await testDataService.cleanupCoverage()
    await loadStats()
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Error al limpiar datos de prueba'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStats()
})
</script>

<template>
  <div class="test-data-container">
    <div class="page-header">
      <div>
        <h1>Gestión de Datos de Prueba</h1>
        <p class="muted">Genera y limpia datos de prueba para validar estadísticas de cobertura</p>
      </div>
      <button class="btn btn-ghost" @click="loadStats" :disabled="loading">
        <IconRefresh :size="20" />
        Actualizar
      </button>
    </div>

    <!-- Warning Banner -->
    <div class="alert alert-warning">
      <IconAlertTriangle :size="24" />
      <div>
        <strong>Entorno de Pruebas</strong>
        <p>Esta herramienta es solo para desarrollo y testing. Los datos generados tienen el prefijo <code>TEST-COVERAGE-</code> para fácil identificación.</p>
      </div>
    </div>

    <!-- Statistics Panel -->
    <div class="panel" v-if="stats">
      <div class="panel-header">
        <h3>Estadísticas Actuales</h3>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total de Artículos</div>
          <div class="stat-value">{{ stats.total_articles.toLocaleString() }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Artículos Contados</div>
          <div class="stat-value">{{ stats.counted_articles.toLocaleString() }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Cobertura</div>
          <div class="stat-value">{{ stats.coverage_percentage.toFixed(2) }}%</div>
        </div>
        <div class="stat-card" :class="{ 'has-test-data': stats.has_test_data }">
          <div class="stat-label">Datos de Prueba</div>
          <div class="stat-value">
            {{ stats.test_counts }} conteos
            <span class="muted">({{ stats.test_details }} detalles)</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions Panel -->
    <div class="panel">
      <div class="panel-header">
        <h3>Acciones</h3>
      </div>
      <div class="actions-grid">
        <div class="action-card">
          <div class="action-icon success">
            <IconDatabase :size="32" />
          </div>
          <h4>Generar Datos de Prueba</h4>
          <p class="muted">Crea 2 conteos de prueba con 5,500 artículos contados para validar las estadísticas de cobertura.</p>
          <ul class="feature-list">
            <li>5,000 artículos con conteo exacto</li>
            <li>500 artículos con diferencias aleatorias</li>
            <li>Cobertura aumentará a ~0.46%</li>
          </ul>
          <button 
            class="btn btn-primary" 
            @click="seedTestData" 
            :disabled="loading || (stats && stats.has_test_data)"
          >
            <IconDatabase :size="20" />
            Generar Datos
          </button>
          <p class="hint" v-if="stats && stats.has_test_data">
            Ya existen datos de prueba. Elimínalos primero.
          </p>
        </div>

        <div class="action-card">
          <div class="action-icon danger">
            <IconTrash :size="32" />
          </div>
          <h4>Limpiar Datos de Prueba</h4>
          <p class="muted">Elimina todos los conteos y detalles de prueba (folios que empiezan con TEST-COVERAGE-).</p>
          <ul class="feature-list">
            <li>Elimina conteos de prueba</li>
            <li>Elimina detalles asociados</li>
            <li>Restaura estadísticas originales</li>
          </ul>
          <button 
            class="btn btn-danger" 
            @click="cleanupTestData" 
            :disabled="loading || (stats && !stats.has_test_data)"
          >
            <IconTrash :size="20" />
            Limpiar Datos
          </button>
          <p class="hint" v-if="stats && !stats.has_test_data">
            No hay datos de prueba para eliminar.
          </p>
        </div>
      </div>
    </div>

    <!-- Results Panel -->
    <div class="panel" v-if="result">
      <div class="panel-header">
        <IconCheck :size="24" class="text-success" />
        <h3>Resultado de la Operación</h3>
      </div>
      <div class="result-content">
        <div class="alert alert-success">
          <IconCheck :size="24" />
          <strong>{{ result.message }}</strong>
        </div>

        <div class="result-stats" v-if="result.before">
          <div class="result-row">
            <span class="label">Antes:</span>
            <span>{{ result.before.counted_articles.toLocaleString() }} artículos ({{ result.before.coverage_percentage }}%)</span>
          </div>
          <div class="result-row">
            <span class="label">Después:</span>
            <span class="highlight">{{ result.after.counted_articles.toLocaleString() }} artículos ({{ result.after.coverage_percentage }}%)</span>
          </div>
          <div class="result-row" v-if="result.items_added">
            <span class="label">Artículos agregados:</span>
            <span class="highlight">{{ result.items_added.toLocaleString() }}</span>
          </div>
        </div>

        <div class="result-stats" v-else>
          <div class="result-row">
            <span class="label">Conteos eliminados:</span>
            <span>{{ result.counts_deleted }}</span>
          </div>
          <div class="result-row">
            <span class="label">Detalles eliminados:</span>
            <span>{{ result.details_deleted }}</span>
          </div>
          <div class="result-row">
            <span class="label">Cobertura actual:</span>
            <span class="highlight">{{ result.after.coverage_percentage }}%</span>
          </div>
        </div>

        <p class="hint">
          Recarga el <router-link to="/reportes/cobertura">reporte de cobertura</router-link> para ver los cambios.
        </p>
      </div>
    </div>

    <!-- Error Panel -->
    <div class="alert alert-error" v-if="error">
      <IconAlertTriangle :size="24" />
      <strong>{{ error }}</strong>
    </div>

    <!-- Loading Overlay -->
    <div class="loading-overlay" v-if="loading">
      <div class="spinner"></div>
      <p>Procesando...</p>
    </div>
  </div>
</template>

<style scoped>
.test-data-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  position: relative;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.page-header h1 {
  margin: 0;
  font-size: 1.8rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  padding: 1.5rem;
}

.stat-card {
  padding: 1rem;
  background: var(--panel-muted);
  border-radius: 12px;
  border: 2px solid var(--line);
}

.stat-card.has-test-data {
  border-color: var(--warning);
  background: rgba(245, 158, 11, 0.1);
}

.stat-label {
  font-size: 0.85rem;
  color: var(--ink-muted);
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ink);
}

.stat-value .muted {
  font-size: 0.9rem;
  font-weight: 400;
  display: block;
  margin-top: 0.25rem;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  padding: 1.5rem;
}

.action-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--panel-muted);
  border-radius: 12px;
  border: 2px solid var(--line);
}

.action-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: white;
}

.action-icon.success {
  background: linear-gradient(135deg, #10b981, #059669);
}

.action-icon.danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.action-card h4 {
  margin: 0;
  font-size: 1.2rem;
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.feature-list li {
  padding-left: 1.5rem;
  position: relative;
  font-size: 0.9rem;
  color: var(--ink-muted);
}

.feature-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--success);
  font-weight: bold;
}

.hint {
  font-size: 0.85rem;
  color: var(--ink-muted);
  margin: 0;
}

.alert {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  border: 2px solid;
}

.alert-warning {
  background: rgba(245, 158, 11, 0.1);
  border-color: var(--warning);
  color: var(--warning);
}

.alert-success {
  background: rgba(16, 185, 129, 0.1);
  border-color: var(--success);
  color: var(--success);
}

.alert-error {
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--danger);
  color: var(--danger);
}

.alert strong {
  display: block;
  margin-bottom: 0.25rem;
}

.alert p {
  margin: 0;
  color: var(--ink);
}

.alert code {
  background: rgba(0, 0, 0, 0.1);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}

.result-content {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.result-stats {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--panel-muted);
  border-radius: 8px;
}

.result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.95rem;
}

.result-row .label {
  font-weight: 600;
  color: var(--ink-muted);
}

.result-row .highlight {
  font-weight: 700;
  color: var(--accent);
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  border-radius: 12px;
  z-index: 10;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.text-success {
  color: var(--success);
}
</style>
