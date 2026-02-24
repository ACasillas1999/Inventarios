<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { branchesService, type Branch } from '@/services/api'
import MobileMenuToggle from '@/components/MobileMenuToggle.vue'

const branches = ref<Branch[]>([])
const health = ref<Record<number, boolean>>({})
const loading = ref(true)
const error = ref('')
type SortKey = 'code' | 'name' | 'status' | 'last_check' | 'health'
const sortState = ref<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'code', dir: 'asc' })

const statusLabel = (status: string) => {
  if (status === 'connected' || status === 'active') return 'Conectada'
  if (status === 'error') return 'Error'
  if (status === 'disconnected' || status === 'inactive') return 'Desconectada'
  return status || 'Sin estado'
}

const statusClass = (status: string) => {
  if (status === 'connected' || status === 'active') return 'success'
  if (status === 'error') return 'error'
  return 'warning'
}

const formatDate = (value?: string | null) => {
  if (!value) return 'Sin revisar'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin revisar'
  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const toggleSort = (key: SortKey) => {
  if (sortState.value.key === key) {
    sortState.value.dir = sortState.value.dir === 'asc' ? 'desc' : 'asc'
  } else {
    sortState.value = { key, dir: 'asc' }
  }
}

const isSortActive = (key: SortKey, dir: 'asc' | 'desc') =>
  sortState.value.key === key && sortState.value.dir === dir

const sortedBranches = computed(() => {
  const list = [...branches.value]
  const { key, dir } = sortState.value
  list.sort((a, b) => {
    const getValue = (branch: Branch) => {
      if (key === 'code') return branch.code || ''
      if (key === 'name') return branch.name || ''
      if (key === 'status') return statusLabel(branch.status)
      if (key === 'last_check') return new Date(branch.lastCheck || branch.last_connection_check || 0).getTime()
      if (key === 'health') return health.value[branch.id] === undefined ? -1 : health.value[branch.id] ? 1 : 0
      return ''
    }
    const va = getValue(a)
    const vb = getValue(b)
    if (typeof va === 'number' && typeof vb === 'number') return dir === 'asc' ? va - vb : vb - va
    return dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
  })
  return list
})

const loadBranches = async () => {
  try {
    loading.value = true
    error.value = ''
    const data = await branchesService.getAll()
    branches.value = Array.isArray(data) ? data : []
  } catch (err: unknown) {
    console.error('Error loading branches', err)
    error.value = 'No se pudieron cargar las sucursales'
  } finally {
    loading.value = false
  }
}

const refreshHealth = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await branchesService.checkAllHealth()
    const map: Record<number, boolean> = {}
    if (Array.isArray(result)) {
      result.forEach((item) => {
        const branchId = (item as { branch_id?: number })?.branch_id
        const healthy = (item as { healthy?: unknown })?.healthy
        if (branchId !== undefined) map[branchId] = Boolean(healthy)
      })
      health.value = map
    }
    await loadBranches()
  } catch (err: unknown) {
    console.error('Error refreshing health', err)
    error.value = 'No se pudo verificar la salud de las sucursales'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadBranches()
})
</script>

<template>
  <section class="panel wide">
    <div class="panel-header">
      <div class="panel-title">
        <MobileMenuToggle />
        <div class="panel-title-text">
          <p class="eyebrow">Catálogo</p>
          <h2>Sucursales</h2>
          <p class="muted">
            Estado de conexión de cada tienda según el ConnectionManager del backend.
          </p>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn ghost" @click="loadBranches">Actualizar</button>
        <button class="btn" @click="refreshHealth">Verificar salud</button>
      </div>
    </div>

    <div v-if="loading" class="muted" style="padding: 1rem">Cargando sucursales...</div>
    <div v-else-if="error" class="error-message panel">
      <p>{{ error }}</p>
      <button class="btn" @click="loadBranches">Reintentar</button>
    </div>
    <table v-else class="table">
      <thead>
        <tr>
          <th>
            <div class="th-inner">
              <span>Código</span>
              <div class="sort">
                <button :class="{ active: isSortActive('code', 'asc') }" @click="toggleSort('code')">▲</button>
                <button :class="{ active: isSortActive('code', 'desc') }" @click="toggleSort('code')">▼</button>
              </div>
            </div>
          </th>
          <th>
            <div class="th-inner">
              <span>Sucursal</span>
              <div class="sort">
                <button :class="{ active: isSortActive('name', 'asc') }" @click="toggleSort('name')">▲</button>
                <button :class="{ active: isSortActive('name', 'desc') }" @click="toggleSort('name')">▼</button>
              </div>
            </div>
          </th>
          <th>
            <div class="th-inner">
              <span>Estado</span>
              <div class="sort">
                <button :class="{ active: isSortActive('status', 'asc') }" @click="toggleSort('status')">▲</button>
                <button :class="{ active: isSortActive('status', 'desc') }" @click="toggleSort('status')">▼</button>
              </div>
            </div>
          </th>
          <th>
            <div class="th-inner">
              <span>Última revisión</span>
              <div class="sort">
                <button :class="{ active: isSortActive('last_check', 'asc') }" @click="toggleSort('last_check')">▲</button>
                <button :class="{ active: isSortActive('last_check', 'desc') }" @click="toggleSort('last_check')">▼</button>
              </div>
            </div>
          </th>
          <th>
            <div class="th-inner">
              <span>Salud</span>
              <div class="sort">
                <button :class="{ active: isSortActive('health', 'asc') }" @click="toggleSort('health')">▲</button>
                <button :class="{ active: isSortActive('health', 'desc') }" @click="toggleSort('health')">▼</button>
              </div>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="branch in sortedBranches" :key="branch.id ?? branch.code">
          <td>
            <strong>{{ branch.code }}</strong>
          </td>
          <td>{{ branch.name }}</td>
          <td>
            <span :class="['status', statusClass(branch.status)]">
              {{ statusLabel(branch.status) }}
            </span>
          </td>
          <td>{{ formatDate(branch.lastCheck || branch.last_connection_check) }}</td>
          <td>
            <span
              :class="[
                'status',
                health[branch.id] === undefined ? 'warning' : health[branch.id] ? 'open' : 'error',
              ]"
            >
              {{
                health[branch.id] === undefined ? 'Sin probar' : health[branch.id] ? 'OK' : 'Error'
              }}
            </span>
            <p v-if="branch.errorMessage" class="muted small">{{ branch.errorMessage }}</p>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.th-inner {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sort {
  display: flex;
  flex-direction: column;
  line-height: 1;
}

.sort button {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  color: #9ca3af;
}

.sort button.active {
  color: #2563eb;
}
</style>
