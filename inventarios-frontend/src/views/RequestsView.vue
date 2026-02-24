<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  auditService,
  branchesService,
  requestsService,
  type AdjustmentRequest,
  type Branch,
  type RequestStatus,
} from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useSocketStore } from '@/stores/socket'
import MobileMenuToggle from '@/components/MobileMenuToggle.vue'

const authStore = useAuthStore()
const socketStore = useSocketStore()

const socketCleanups: Array<() => void> = []

const requests = ref<AdjustmentRequest[]>([])
const total = ref(0)
const branches = ref<Branch[]>([])
const connectedBranches = computed(() => branches.value.filter(b => b.status === 'connected'))

const loading = ref(true)
const error = ref('')

const filters = reactive<{
  statuses: RequestStatus[]
  branch_id: number | ''
  count_id: number | ''
  limit: number
}>({
  statuses: ['pendiente', 'en_revision'],
  branch_id: '',
  count_id: '',
  limit: 50,
})

const offset = ref(0)
type RequestSortKey =
  | 'folio'
  | 'status'
  | 'branch'
  | 'count'
  | 'item'
  | 'system'
  | 'counted'
  | 'difference'
  | 'created'
const sortState = ref<{ key: RequestSortKey; dir: 'asc' | 'desc' }>({ key: 'created', dir: 'desc' })
const isMobile = ref(false)
const filtersOpen = ref(true)

const pageInfo = computed(() => {
  const start = total.value === 0 ? 0 : offset.value + 1
  const end = Math.min(offset.value + filters.limit, total.value)
  return { start, end }
})

const statusLabel = (status: string) => {
  if (status === 'pendiente') return 'Pendiente'
  if (status === 'en_revision') return 'En revision'
  if (status === 'ajustado') return 'Ajustado'
  if (status === 'rechazado') return 'Rechazado'
  return status || 'Sin estado'
}

const statusClass = (status: string) => {
  if (status === 'ajustado') return 'open'
  if (status === 'en_revision') return 'progress'
  if (status === 'rechazado') return 'error'
  return 'closed'
}

const requestStatusOptions: RequestStatus[] = ['pendiente', 'en_revision', 'ajustado', 'rechazado']
const requestStatusTransitions: Record<RequestStatus, RequestStatus[]> = {
  pendiente: ['en_revision'],
  en_revision: ['ajustado', 'rechazado'],
  ajustado: [],
  rechazado: [],
}
const requestStatusActionGuide: Record<RequestStatus, string> = {
  pendiente: 'Accion requerida: revisar la diferencia y enviar a En revision cuando inicie analisis.',
  en_revision: 'Accion requerida: validar evidencia y definir si procede Ajustado o Rechazado.',
  ajustado: 'Accion actual: solicitud finalizada. Conserva evidencia para auditoria.',
  rechazado: 'Accion actual: solicitud cerrada. El motivo de rechazo debe quedar documentado.',
}

const isFinalRequestStatus = (status: RequestStatus) => status === 'ajustado' || status === 'rechazado'

const canTransitionRequestStatus = (from: RequestStatus, to: RequestStatus) =>
  from === to || requestStatusTransitions[from].includes(to)

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('es-MX') : 'Sin registro'

type AuditLogRecord = {
  id?: number
  user_id: number | null
  user_name?: string | null
  entity_id: number
  old_values?: unknown
  new_values?: unknown
  created_at?: string
}

type StatusHistoryItem = {
  id: string
  status: RequestStatus
  userLabel: string
  at: string
  isCurrent: boolean
}

const parseJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null
  if (typeof value === 'object') return value as Record<string, unknown>
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const toRequestStatus = (value: unknown): RequestStatus | null => {
  if (value === 'pendiente' || value === 'en_revision' || value === 'ajustado' || value === 'rechazado') {
    return value
  }
  return null
}

const branchName = (branchId: number) => {
  const found = branches.value.find((b) => b.id === branchId)
  return found?.name || `Sucursal ${branchId}`
}

const toggleSort = (key: RequestSortKey) => {
  if (sortState.value.key === key) {
    sortState.value.dir = sortState.value.dir === 'asc' ? 'desc' : 'asc'
  } else {
    sortState.value = { key, dir: 'asc' }
  }
}

const isSortActive = (key: RequestSortKey, dir: 'asc' | 'desc') =>
  sortState.value.key === key && sortState.value.dir === dir

const sortedRequests = computed(() => {
  const list = [...requests.value]
  const { key, dir } = sortState.value
  list.sort((a, b) => {
    const getValue = (row: AdjustmentRequest) => {
      if (key === 'folio') return row.folio || ''
      if (key === 'status') return statusLabel(row.status)
      if (key === 'branch') return branchName(row.branch_id)
      if (key === 'count') return row.count_folio || String(row.count_id || '')
      if (key === 'item') return row.item_code || ''
      if (key === 'system') return Number(row.system_stock ?? 0)
      if (key === 'counted') return Number(row.counted_stock ?? 0)
      if (key === 'difference') return Number(row.difference ?? 0)
      if (key === 'created') return new Date(row.created_at || 0).getTime()
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
    const data = await branchesService.getAll()
    branches.value = Array.isArray(data) ? data : []
  } catch (err: unknown) {
    console.error('Error loading branches', err)
  }
}

const loadRequests = async () => {
  try {
    loading.value = true
    error.value = ''

    const resp = await requestsService.list({
      status: filters.statuses.length ? filters.statuses : undefined,
      branch_id: filters.branch_id || undefined,
      count_id: filters.count_id || undefined,
      limit: filters.limit,
      offset: offset.value,
    })

    requests.value = Array.isArray(resp?.requests) ? resp.requests : []
    total.value = Number(resp?.total ?? 0)
  } catch (err: unknown) {
    console.error('Error loading requests', err)
    error.value = 'No se pudieron cargar las solicitudes'
  } finally {
    loading.value = false
  }
}

const applyFilters = async () => {
  offset.value = 0
  await loadRequests()
}

const prevPage = async () => {
  offset.value = Math.max(0, offset.value - filters.limit)
  await loadRequests()
}

const nextPage = async () => {
  offset.value = offset.value + filters.limit
  await loadRequests()
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

const showManageModal = ref(false)
const managing = ref<AdjustmentRequest | null>(null)
const manageStatus = ref<RequestStatus>('pendiente')
const manageNotes = ref('')
const savingManage = ref(false)
const statusHistoryLoading = ref(false)
const statusHistoryError = ref('')
const statusHistoryItems = ref<StatusHistoryItem[]>([])
const managedCurrentStatus = computed<RequestStatus | null>(() => managing.value?.status ?? null)
const canChangeManagedStatus = computed(
  () => managedCurrentStatus.value !== null && !isFinalRequestStatus(managedCurrentStatus.value),
)
const manageStatusHint = computed(() => {
  if (!managedCurrentStatus.value) return 'Actualiza el estatus y agrega notas antes de guardar.'
  if (isFinalRequestStatus(managedCurrentStatus.value)) {
    return 'Esta solicitud ya esta en estatus final y no permite cambios de estatus ni edicion de notas.'
  }
  return 'Solo se permiten cambios hacia adelante: pendiente -> en revision -> ajustado/rechazado.'
})
const trimmedManageNotes = computed(() => manageNotes.value.trim())
const requiresRejectionReason = computed(() => manageStatus.value === 'rechazado')
const hasRequiredRejectionReason = computed(
  () => !requiresRejectionReason.value || trimmedManageNotes.value.length > 0,
)
const canEditManageNotes = computed(
  () => managedCurrentStatus.value !== null && !isFinalRequestStatus(managedCurrentStatus.value),
)
const rejectionReasonHint = computed(() =>
  requiresRejectionReason.value
    ? 'Si eliges Rechazado, debes capturar el motivo antes de guardar.'
    : 'Puedes dejar notas opcionales para documentar la resolucion.',
)
const canSaveManage = computed(() => {
  if (!managing.value) return false
  if (savingManage.value) return false
  if (!canEditManageNotes.value) return false
  return hasRequiredRejectionReason.value
})
const statusHistoryLegend = computed(() => {
  if (!managedCurrentStatus.value) return 'Historial de cambios de estatus de la solicitud.'
  return `Estatus actual: ${statusLabel(managedCurrentStatus.value)}.`
})
const modalHeaderToneClass = computed(() =>
  managedCurrentStatus.value ? `modal-header--${managedCurrentStatus.value}` : 'modal-header--default',
)
const modalHeaderActionGuide = computed(() =>
  managedCurrentStatus.value
    ? requestStatusActionGuide[managedCurrentStatus.value]
    : 'Accion requerida: define estatus y documenta la resolucion.',
)

const isManageStatusOptionDisabled = (option: RequestStatus) => {
  if (!managedCurrentStatus.value) return false
  return !canTransitionRequestStatus(managedCurrentStatus.value, option)
}

const buildInitialStatusHistory = (request: AdjustmentRequest): StatusHistoryItem => ({
  id: `created-${request.id}`,
  status: 'pendiente',
  userLabel: request.requested_by_name || `Usuario #${request.requested_by_user_id}`,
  at: request.created_at,
  isCurrent: false,
})

const loadStatusHistory = async (request: AdjustmentRequest) => {
  statusHistoryLoading.value = true
  statusHistoryError.value = ''
  try {
    const response = await auditService.getLogs({
      entity_type: 'request',
      entity_id: request.id,
      limit: 100,
      offset: 0,
    })

    const logs = Array.isArray(response?.logs) ? (response.logs as AuditLogRecord[]) : []
    const updates = logs
      .map((log) => {
        const oldPayload = parseJsonObject(log.old_values)
        const newPayload = parseJsonObject(log.new_values)
        const oldStatus = toRequestStatus(oldPayload?.status)
        const newStatus = toRequestStatus(newPayload?.status)
        if (!newStatus) return null
        if (oldStatus && oldStatus === newStatus) return null
        return {
          id: `audit-${log.id ?? `${log.created_at ?? 'na'}-${newStatus}`}`,
          status: newStatus,
          userLabel: log.user_name || (log.user_id ? `Usuario #${log.user_id}` : 'Sistema'),
          at: log.created_at || request.updated_at,
          isCurrent: false,
        } as StatusHistoryItem
      })
      .filter((item): item is StatusHistoryItem => item !== null)
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

    const timeline = [buildInitialStatusHistory(request), ...updates]
    const currentIdx = [...timeline]
      .map((item, idx) => ({ idx, match: item.status === request.status }))
      .filter((x) => x.match)
      .map((x) => x.idx)
      .pop()

    statusHistoryItems.value = timeline.map((item, idx) => ({
      ...item,
      isCurrent: currentIdx === idx,
    }))
  } catch (err) {
    console.error('Error loading request status history', err)
    statusHistoryError.value = 'No se pudo cargar el historial de estatus.'
    statusHistoryItems.value = []
  } finally {
    statusHistoryLoading.value = false
  }
}

const openManage = (row: AdjustmentRequest) => {
  managing.value = row
  manageStatus.value = row.status
  manageNotes.value = row.resolution_notes || ''
  showManageModal.value = true
  void loadStatusHistory(row)
}

const closeManage = () => {
  showManageModal.value = false
  managing.value = null
  manageNotes.value = ''
  manageStatus.value = 'pendiente'
  savingManage.value = false
  statusHistoryItems.value = []
  statusHistoryError.value = ''
  statusHistoryLoading.value = false
}

const saveManage = async () => {
  if (!managing.value) return
  if (!canEditManageNotes.value) {
    alert('La solicitud esta en estatus final. No se puede modificar estatus ni notas.')
    return
  }
  if (!hasRequiredRejectionReason.value) {
    alert('Para estatus Rechazado debes agregar un motivo en Notas / resolucion.')
    return
  }
  if (!canTransitionRequestStatus(managing.value.status, manageStatus.value)) {
    alert('Transicion de estatus invalida. Solo se permite avanzar el flujo.')
    return
  }

  try {
    savingManage.value = true
    const notes = trimmedManageNotes.value
    const updated = await requestsService.update(managing.value.id, {
      status: manageStatus.value,
      resolution_notes: notes ? notes : null,
    })

    const idx = requests.value.findIndex((r) => r.id === managing.value?.id)
    if (idx >= 0) requests.value[idx] = updated
    managing.value = updated

    await loadRequests()
    closeManage()
  } catch (err: unknown) {
    console.error('Error updating request', err)
    alert((err as any)?.response?.data?.error || 'No se pudo actualizar la solicitud')
  } finally {
    savingManage.value = false
  }
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  loadBranches()
  loadRequests()

  // Real-time updates
  socketCleanups.push(socketStore.on('request_created', () => {
    console.log('Real-time: request_created')
    loadRequests()
  }))

  socketCleanups.push(socketStore.on('request_status', () => {
    console.log('Real-time: request_status')
    loadRequests()
  }))
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('resize', updateIsMobile)
  socketCleanups.forEach(fn => fn())
})
</script>

<template>
  <section class="panel wide">
    <div class="panel-top">
      <div class="panel-header">
        <div class="panel-title">
          <MobileMenuToggle />
          <div class="panel-title-text">
            <p class="eyebrow">Solicitudes</p>
            <h2>Solicitudes de ajuste</h2>
            <p class="muted">Generadas desde conteos cerrados.</p>
          </div>
        </div>
        <div class="header-actions">
          <div class="connection-status" :class="{ connected: socketStore.connected }">
            <span class="status-dot"></span>
            <span class="status-text">{{ socketStore.connected ? 'Conectado' : 'Desconectado' }}</span>
          </div>
          <span class="tag accent">{{ total }} solicitudes</span>
          <button class="btn ghost" @click="loadRequests">Refrescar</button>
        </div>
      </div>

      <div class="filters">
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

        <div v-show="!isMobile || filtersOpen" class="form-grid">
          <div class="status-filter">
            <label class="status-filter-title">Estatus</label>
            <div class="status-filter-list">
              <label
                v-for="statusOption in requestStatusOptions"
                :key="statusOption"
                class="status-filter-option"
              >
                <input
                  v-model="filters.statuses"
                  type="checkbox"
                  :value="statusOption"
                  @change="applyFilters"
                />
                <span>{{ statusLabel(statusOption) }}</span>
              </label>
            </div>
          </div>
          <div>
            <label>Sucursal</label>
            <select v-model="filters.branch_id" @change="applyFilters">
              <option value="">Todas</option>
              <option v-for="b in connectedBranches" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div>
            <label>ID conteo</label>
            <input
              v-model.number="filters.count_id"
              type="number"
              min="1"
              placeholder="Ej. 6"
              @keyup.enter="applyFilters"
            />
          </div>
          <div>
            <label>Limite</label>
            <input
              v-model.number="filters.limit"
              type="number"
              min="1"
              max="200"
              @change="applyFilters"
            />
          </div>
        </div>

        <div class="filter-actions">
          <div class="muted small" v-if="total > 0">
            Mostrando {{ pageInfo.start }}-{{ pageInfo.end }} de {{ total }}
          </div>
          <div class="pager">
            <button class="btn ghost" :disabled="offset === 0" @click="prevPage">Anterior</button>
            <button class="btn ghost" :disabled="offset + filters.limit >= total" @click="nextPage">
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="muted" style="padding: 1rem">Cargando solicitudes...</div>
    <div v-else-if="error" class="error-message panel">
      <p>{{ error }}</p>
      <button class="btn" @click="loadRequests">Reintentar</button>
    </div>
    <div v-else>
      <!-- Vista movil: Tarjetas -->
      <div v-if="isMobile" class="requests-cards">
        <div v-for="row in sortedRequests" :key="row.id" class="count-card">
          <div class="count-card-header">
            <span class="folio">#{{ row.folio }}</span>
            <span :class="['status-badge', statusClass(row.status)]">
              {{ statusLabel(row.status) }}
            </span>
          </div>

          <div class="count-card-title">
            {{ branchName(row.branch_id) }}
            <div v-if="row.warehouse_name" class="muted small">
                Almacen: {{ row.warehouse_name }}
            </div>
          </div>

          <div class="count-card-details">
            <div class="count-detail-item">
              <span class="detail-label">ARTICULO</span>
              <span class="detail-value"><strong>{{ row.item_code }}</strong></span>
            </div>
            <div class="count-detail-item">
              <span class="detail-label">CONTEO</span>
              <router-link
                :to="{ name: 'conteos-detalle', params: { id: row.count_id } }"
                target="_blank"
                class="detail-value accent-link"
              >
                {{ row.count_folio || `#${row.count_id}` }}
              </router-link>
            </div>
            <div class="count-detail-item">
              <span class="detail-label">SISTEMA</span>
              <span class="detail-value">{{ Number(row.system_stock ?? 0) }}</span>
            </div>
            <div class="count-detail-item">
              <span class="detail-label">CONTADO</span>
              <span class="detail-value">{{ Number(row.counted_stock ?? 0) }}</span>
            </div>
            <div class="count-detail-item">
              <span class="detail-label">DIFERENCIA</span>
              <span
                :class="[
                  'status',
                  Number(row.difference ?? 0) === 0
                    ? 'open'
                    : Number(row.difference ?? 0) > 0
                      ? 'progress'
                      : 'error',
                ]"
              >
                {{ Number(row.difference ?? 0) > 0 ? `+${row.difference}` : row.difference }}
              </span>
            </div>
            <div class="count-detail-item">
              <span class="detail-label">FECHA</span>
              <span class="detail-value muted small">
                {{ row.created_at ? new Date(row.created_at).toLocaleDateString() : '-' }}
              </span>
            </div>
          </div>

          <div class="count-card-footer" style="padding-top: 0.75rem; margin-top: 0.5rem; border-top: 1px dashed var(--line);">
            <button 
              class="btn" 
              style="width: 100%; justify-content: center;"
              :disabled="!authStore.hasPermission('requests.update')" 
              @click="openManage(row)"
            >
              Gestionar solicitud
            </button>
          </div>
        </div>
        <div v-if="sortedRequests.length === 0" class="muted" style="text-align: center; padding: 2rem;">
          Sin solicitudes registradas
        </div>
      </div>

      <!-- Vista desktop: Tabla -->
      <div v-else class="table-wrap">
        <div class="table-scroll">
          <table class="table">
          <thead>
            <tr>
              <th>
                <div class="th-sort">
                  <span>Solicitud</span>
                  <div class="th-sort-buttons">
                    <button :class="{ active: isSortActive('folio', 'asc') }" @click="toggleSort('folio')">&#9650;</button>
                    <button :class="{ active: isSortActive('folio', 'desc') }" @click="toggleSort('folio')">&#9660;</button>
                  </div>
                </div>
              </th>
              <th>
                <div class="th-sort">
                  <span>Estatus</span>
                  <div class="th-sort-buttons">
                    <button :class="{ active: isSortActive('status', 'asc') }" @click="toggleSort('status')">&#9650;</button>
                    <button :class="{ active: isSortActive('status', 'desc') }" @click="toggleSort('status')">&#9660;</button>
                  </div>
                </div>
              </th>
              <th>
                <div class="th-sort">
                  <span>Sucursal</span>
                  <div class="th-sort-buttons">
                    <button :class="{ active: isSortActive('branch', 'asc') }" @click="toggleSort('branch')">&#9650;</button>
                    <button :class="{ active: isSortActive('branch', 'desc') }" @click="toggleSort('branch')">&#9660;</button>
                  </div>
                </div>
              </th>
              <th>
                <div class="th-sort">
                  <span>Conteo</span>
                  <div class="th-sort-buttons">
                    <button :class="{ active: isSortActive('count', 'asc') }" @click="toggleSort('count')">&#9650;</button>
                    <button :class="{ active: isSortActive('count', 'desc') }" @click="toggleSort('count')">&#9660;</button>
                  </div>
                </div>
              </th>
              <th>
                <div class="th-sort">
                  <span>Articulo</span>
                  <div class="th-sort-buttons">
                    <button :class="{ active: isSortActive('item', 'asc') }" @click="toggleSort('item')">&#9650;</button>
                    <button :class="{ active: isSortActive('item', 'desc') }" @click="toggleSort('item')">&#9660;</button>
                  </div>
                </div>
              </th>
              <th>
                <div class="th-sort">
                  <span>Stock sistema</span>
                  <div class="th-sort-buttons">
                    <button :class="{ active: isSortActive('system', 'asc') }" @click="toggleSort('system')">&#9650;</button>
                    <button :class="{ active: isSortActive('system', 'desc') }" @click="toggleSort('system')">&#9660;</button>
                  </div>
                </div>
              </th>
              <th>
                <div class="th-sort">
                  <span>Contado</span>
                  <div class="th-sort-buttons">
                    <button :class="{ active: isSortActive('counted', 'asc') }" @click="toggleSort('counted')">&#9650;</button>
                    <button :class="{ active: isSortActive('counted', 'desc') }" @click="toggleSort('counted')">&#9660;</button>
                  </div>
                </div>
              </th>
              <th>
                <div class="th-sort">
                  <span>Diferencia</span>
                  <div class="th-sort-buttons">
                    <button :class="{ active: isSortActive('difference', 'asc') }" @click="toggleSort('difference')">&#9650;</button>
                    <button :class="{ active: isSortActive('difference', 'desc') }" @click="toggleSort('difference')">&#9660;</button>
                  </div>
                </div>
              </th>
              <th>
                <div class="th-sort">
                  <span>Creada</span>
                  <div class="th-sort-buttons">
                    <button :class="{ active: isSortActive('created', 'asc') }" @click="toggleSort('created')">&#9650;</button>
                    <button :class="{ active: isSortActive('created', 'desc') }" @click="toggleSort('created')">&#9660;</button>
                  </div>
                </div>
              </th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sortedRequests" :key="row.id">
              <td>
                <strong>{{ row.folio }}</strong>
              </td>
              <td>
                <span :class="['status', statusClass(row.status)]">
                  {{ statusLabel(row.status) }}
                </span>
              </td>
              <td>
                <div>{{ branchName(row.branch_id) }}</div>
                <div v-if="row.warehouse_name" class="tag" style="font-size: 0.7rem; margin-top: 0.2rem; background: rgba(37, 99, 235, 0.05);">
                Almacen: {{ row.warehouse_name }}
                </div>
              </td>
              <td>
                <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 0.25rem;">
                  <router-link
                    class="btn ghost"
                    :to="{ name: 'conteos-detalle', params: { id: row.count_id } }"
                    target="_blank"
                    style="padding: 0.25rem 0.5rem; height: auto;"
                  >
                    {{ row.count_folio || `#${row.count_id}` }}
                  </router-link>
                  <span v-if="row.count_classification" :class="['tag', row.count_classification === 'ajuste' ? 'accent' : '']" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">
                    {{ row.count_classification === 'ajuste' ? 'Ajuste directo' : 'Conteo normal' }}
                  </span>
                </div>
              </td>
              <td>
                <strong>{{ row.item_code }}</strong>
              </td>
              <td>{{ Number(row.system_stock ?? 0) }}</td>
              <td>{{ Number(row.counted_stock ?? 0) }}</td>
              <td>
                <span
                  :class="[
                    'status',
                    Number(row.difference ?? 0) === 0
                      ? 'open'
                      : Number(row.difference ?? 0) > 0
                        ? 'progress'
                        : 'error',
                  ]"
                >
                  {{ Number(row.difference ?? 0) > 0 ? `+${row.difference}` : row.difference }}
                </span>
              </td>
              <td class="muted">
                {{ row.created_at ? new Date(row.created_at).toLocaleString('es-MX') : '-' }}
              </td>
              <td>
                <button class="btn" :disabled="!authStore.hasPermission('requests.update')" @click="openManage(row)">Gestionar</button>
              </td>
            </tr>
            <tr v-if="sortedRequests.length === 0">
              <td colspan="10" class="muted" style="text-align: center; padding: 1rem">
                Sin solicitudes registradas
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </div>

    <!-- Modal gestion -->
    <div v-if="showManageModal" class="modal-overlay" @click="closeManage">
      <div class="modal-content modal-content--letter" @click.stop>
        <div class="modal-header" :class="modalHeaderToneClass">
          <div class="modal-header-copy">
            <p class="modal-kicker">Solicitudes</p>
            <h3>Gestionar solicitud</h3>
            <p v-if="managing" class="modal-subtitle">
              Folio {{ managing.folio }} &middot; {{ branchName(managing.branch_id) }}
            </p>
            <div v-if="managedCurrentStatus" class="modal-header-status-line">
              <span class="modal-header-status-pill">
                Estatus actual: {{ statusLabel(managedCurrentStatus) }}
              </span>
            </div>
          </div>
          <div v-if="managedCurrentStatus" class="modal-header-action-wrap">
            <p class="modal-header-action-label">Accion requerida</p>
            <p class="modal-header-action">{{ modalHeaderActionGuide }}</p>
          </div>
          <button class="btn-close" type="button" aria-label="Cerrar" @click="closeManage">&times;</button>
        </div>
        <div class="modal-body" v-if="managing">
          <div class="modal-summary-grid">
            <article class="modal-summary-card">
              <p class="modal-card-label">Solicitud</p>
              <p class="modal-card-value">{{ managing.folio }}</p>
              <p class="modal-card-meta">
                Conteo {{ (managing as any).count_folio || `#${managing.count_id}` }} &middot; {{ branchName(managing.branch_id) }}
                <span v-if="managing.warehouse_name"> &middot; {{ managing.warehouse_name }}</span>
              </p>
            </article>

            <article class="modal-summary-card">
              <p class="modal-card-label">Art&iacute;culo</p>
              <p class="modal-card-value">{{ managing.item_code }}</p>
              <p class="modal-card-meta">
                Sistema: {{ Number(managing.system_stock ?? 0) }} &middot; Contado:
                {{ Number(managing.counted_stock ?? 0) }}
              </p>
            </article>

            <article class="modal-summary-card modal-summary-card--difference">
              <p class="modal-card-label">Diferencia</p>
              <p class="modal-card-value">
                <span
                  :class="[
                    'status',
                    Number(managing.difference ?? 0) > 0
                      ? 'progress'
                      : Number(managing.difference ?? 0) < 0
                        ? 'error'
                        : 'open',
                  ]"
                >
                  {{
                    Number(managing.difference ?? 0) > 0
                      ? `+${managing.difference}`
                      : managing.difference
                  }}
                </span>
              </p>
              <p class="modal-card-meta">
                Creada:
                {{
                  managing.created_at ? new Date(managing.created_at).toLocaleString('es-MX') : '-'
                }}
              </p>
            </article>

          </div>

          <section class="status-history">
            <div class="status-history-head">
              <h4>Historial de Estatus</h4>
              <p class="status-history-subtitle">{{ statusHistoryLegend }}</p>
            </div>

            <p v-if="statusHistoryLoading" class="status-history-empty">Cargando historial...</p>
            <p v-else-if="statusHistoryError" class="status-history-empty status-history-empty--error">
              {{ statusHistoryError }}
            </p>
            <p v-else-if="statusHistoryItems.length === 0" class="status-history-empty">
              Sin cambios de estatus registrados.
            </p>
            <div v-else class="status-timeline">
              <article
                v-for="item in statusHistoryItems"
                :key="item.id"
                class="status-step"
                :class="{ 'status-step--current': item.isCurrent }"
              >
                <span class="status-step-dot" :class="`status-step-dot--${item.status}`"></span>
                <p class="status-step-title">{{ statusLabel(item.status) }}</p>
                <p class="status-step-user">{{ item.userLabel }}</p>
                <p class="status-step-time">{{ formatDateTime(item.at) }}</p>
              </article>
            </div>
          </section>

          <div class="modal-form">
            <div class="modal-form-head">
              <h4 class="modal-form-title">Resolucion y cambio de estatus</h4>
              <p class="modal-form-subtitle">
                Define el estatus y documenta la evidencia de la decision.
              </p>
            </div>
            <div class="modal-form-grid">
              <div class="modal-field modal-field--status">
                <label for="manage-status">Estatus</label>
                <select id="manage-status" v-model="manageStatus" :disabled="!canChangeManagedStatus">
                  <option
                    v-for="statusOption in requestStatusOptions"
                    :key="statusOption"
                    :value="statusOption"
                    :disabled="isManageStatusOptionDisabled(statusOption)"
                  >
                    {{ statusLabel(statusOption) }}
                  </option>
                </select>
              </div>
              <div class="modal-field modal-field--notes">
                <label for="manage-notes">
                  Notas / resoluci&oacute;n
                  <span v-if="requiresRejectionReason" class="required-pill">Obligatorio</span>
                </label>
                <textarea
                  id="manage-notes"
                  v-model="manageNotes"
                  rows="4"
                  :required="requiresRejectionReason"
                  :disabled="!canEditManageNotes"
                  :class="{ 'input-error': !hasRequiredRejectionReason && canEditManageNotes }"
                  placeholder="Describe la resoluci&oacute;n o motivo..."
                ></textarea>
                <p class="modal-field-help">{{ rejectionReasonHint }}</p>
                <p v-if="!canEditManageNotes" class="modal-field-help">
                  Las notas quedan bloqueadas cuando la solicitud llega a estatus final.
                </p>
                <p v-if="!hasRequiredRejectionReason && canEditManageNotes" class="modal-field-error">
                  Debes escribir el motivo cuando el estatus sea Rechazado.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <p class="modal-footer-hint">{{ manageStatusHint }}</p>
          <div class="modal-footer-actions">
            <button class="btn ghost" @click="closeManage">Cancelar</button>
            <button class="btn" :disabled="!canSaveManage" @click="saveManage">
              {{ savingManage ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel-top {
  margin-bottom: 0.9rem;
  padding: 0.9rem;
  border: 1px solid #dbe5f0;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.9), rgba(255, 255, 255, 0.88));
}

.panel-top .panel-header {
  margin-bottom: 0.8rem;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.panel-top .filters {
  margin-bottom: 0;
  border: 1px solid #dbe5f0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  padding: 0.8rem;
}

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

.filters {
  margin-bottom: 0.75rem;
}

.filters .form-grid > div {
  padding: 0.65rem 0.7rem;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
}

.status-filter {
  min-width: 0;
}

.status-filter-title {
  display: block;
  margin-bottom: 0.35rem;
}

.status-filter-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem 0.55rem;
  padding: 0.55rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
}

.status-filter-option {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  font-size: 0.84rem;
  color: #1f2937;
  cursor: pointer;
}

.status-filter-option input[type='checkbox'] {
  margin: 0;
  width: 15px;
  height: 15px;
  accent-color: var(--accent);
}

.filter-actions {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.pager {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.table-wrap {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--panel);
  padding: 0.5rem;
  overflow: hidden;
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.table-scroll .table {
  min-width: 920px;
}

.th-sort {
  display: flex;
  align-items: center;
  gap: 6px;
}

.th-sort-buttons {
  display: flex;
  flex-direction: column;
  line-height: 1;
}

.th-sort-buttons button {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  color: #9ca3af;
}

.th-sort-buttons button.active {
  color: #2563eb;
}

/* Card view styles for mobile */
.requests-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.requests-cards .count-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.count-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.count-card-header .folio {
  font-weight: 700;
  color: var(--accent);
}

.count-card-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.count-card-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.count-detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.detail-label {
  font-size: 0.65rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-weight: 700;
}

.detail-value {
  font-size: 0.85rem;
}

.accent-link {
  color: var(--accent);
  text-decoration: underline;
}

.status-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  text-transform: uppercase;
}

.status-badge.open {
  background: #ecfdf3;
  color: var(--success);
}

.status-badge.progress {
  background: #f0f4ff;
  color: var(--accent-strong);
}

.status-badge.error {
  background: #fef2f2;
  color: var(--danger);
}

.status-badge.closed {
  background: #fef9c3;
  color: #92400e;
}

@media (max-width: 768px) {
  .table-scroll .table {
    min-width: 820px;
  }

  .table-scroll .table th,
  .table-scroll .table td {
    padding: 0.5rem 0.35rem;
    font-size: 0.85rem;
  }
}

@media (max-width: 1024px) {
  .filters-header {
    display: block;
  }
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.56);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  --letter-width: 8.5in;
  --letter-height: 11in;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 20px;
  box-shadow: 0 24px 65px rgba(15, 23, 42, 0.35);
  width: min(var(--letter-width), calc(100vw - 2rem));
  height: min(var(--letter-height), calc(100dvh - 2rem));
  max-height: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  --header-accent: #2563eb;
  --header-bg-start: rgba(37, 99, 235, 0.18);
  --header-bg-end: rgba(255, 255, 255, 0.45);
  --header-line: #bfdbfe;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(230px, 320px) auto;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  border-bottom: 1px solid var(--header-line);
  background: linear-gradient(120deg, var(--header-bg-start), var(--header-bg-end)), var(--panel);
}

.modal-header--default {
  --header-accent: #2563eb;
  --header-bg-start: rgba(37, 99, 235, 0.18);
  --header-bg-end: rgba(255, 255, 255, 0.45);
  --header-line: #bfdbfe;
}

.modal-header--pendiente {
  --header-accent: #b45309;
  --header-bg-start: rgba(245, 158, 11, 0.22);
  --header-bg-end: rgba(255, 255, 255, 0.52);
  --header-line: #fcd34d;
}

.modal-header--en_revision {
  --header-accent: #1d4ed8;
  --header-bg-start: rgba(56, 189, 248, 0.24);
  --header-bg-end: rgba(255, 255, 255, 0.5);
  --header-line: #93c5fd;
}

.modal-header--ajustado {
  --header-accent: #047857;
  --header-bg-start: rgba(16, 185, 129, 0.2);
  --header-bg-end: rgba(255, 255, 255, 0.48);
  --header-line: #6ee7b7;
}

.modal-header--rechazado {
  --header-accent: #be123c;
  --header-bg-start: rgba(244, 63, 94, 0.22);
  --header-bg-end: rgba(255, 255, 255, 0.52);
  --header-line: #fda4af;
}

.modal-header-copy {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.modal-kicker {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--header-accent);
  font-weight: 700;
}

.modal-header h3 {
  margin: 0;
  color: var(--ink);
}

.modal-subtitle {
  margin: 0.25rem 0 0;
  color: var(--muted);
  font-size: 0.88rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.modal-header-status-line {
  margin-top: 0.45rem;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.modal-header-status-pill {
  align-self: flex-start;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(255, 255, 255, 0.78);
  color: var(--header-accent);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.modal-header-action-wrap {
  justify-self: end;
  max-width: 320px;
  border: 1px solid rgba(148, 163, 184, 0.38);
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.78);
  padding: 0.45rem 0.55rem;
}

.modal-header-action-label {
  margin: 0;
  color: var(--header-accent);
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.modal-header-action {
  margin: 0.2rem 0 0;
  color: #1e293b;
  font-size: 0.74rem;
  line-height: 1.35;
  text-wrap: pretty;
}

.btn-close {
  background: #fff;
  border: 1px solid var(--line);
  cursor: pointer;
  font-size: 1.35rem;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: var(--muted);
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.btn-close:hover {
  background: var(--panel-muted);
  color: var(--ink);
  border-color: #94a3b8;
}

.modal-body {
  padding: 1rem 1.25rem;
  display: grid;
  gap: 0.9rem;
  overflow-y: auto;
}

.modal-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.modal-summary-card {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: linear-gradient(140deg, rgba(255, 255, 255, 0.85), rgba(241, 245, 249, 0.45)), var(--panel);
  padding: 0.85rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.modal-summary-card--difference {
  grid-column: 1 / -1;
}

.modal-card-label {
  margin: 0;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 700;
}

.modal-card-value {
  margin: 0;
  font-size: 1.12rem;
  line-height: 1.2;
  font-weight: 700;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.modal-card-meta {
  margin: 0;
  color: var(--muted);
  font-size: 0.86rem;
  line-height: 1.38;
  overflow-wrap: anywhere;
}

.modal-summary-card--difference .status {
  font-size: 0.92rem;
  padding: 0.35rem 0.7rem;
}

.status-history {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.85), rgba(248, 250, 252, 0.35));
  padding: 0.9rem 0.95rem;
}

.status-history-head {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.7rem;
}

.status-history-head h4 {
  margin: 0;
  font-size: 1rem;
  color: var(--ink);
}

.status-history-subtitle {
  margin: 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.status-history-empty {
  margin: 0;
  font-size: 0.86rem;
  color: var(--muted);
}

.status-history-empty--error {
  color: #b91c1c;
}

.status-timeline {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  overflow-x: auto;
  padding: 0.35rem 0.15rem 0.2rem;
  scrollbar-width: thin;
}

.status-step {
  position: relative;
  flex: 1 0 150px;
  min-width: 150px;
  max-width: 190px;
  text-align: center;
  padding-right: 0.35rem;
}

.status-step::after {
  content: '';
  position: absolute;
  top: 16px;
  left: calc(50% + 16px);
  width: calc(100% - 32px);
  height: 2px;
  border-radius: 99px;
  background: #cbd5e1;
}

.status-step:last-child::after {
  display: none;
}

.status-step-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: block;
  margin: 0 auto 0.55rem;
  border: 2px solid #94a3b8;
  background: #e2e8f0;
  box-shadow: 0 0 0 3px #fff;
}

.status-step-dot--pendiente {
  background: #f8fafc;
  border-color: #94a3b8;
}

.status-step-dot--en_revision {
  background: #38bdf8;
  border-color: #0284c7;
}

.status-step-dot--ajustado {
  background: #34d399;
  border-color: #059669;
}

.status-step-dot--rechazado {
  background: #fb7185;
  border-color: #e11d48;
}

.status-step--current .status-step-dot {
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.22);
}

.status-step-title {
  margin: 0 0 0.25rem;
  font-size: 0.84rem;
  line-height: 1.2;
  font-weight: 700;
  color: var(--ink);
}

.status-step-user {
  margin: 0;
  font-size: 0.71rem;
  line-height: 1.2;
  color: #334155;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}

.status-step-time {
  margin: 0.2rem 0 0;
  font-size: 0.7rem;
  color: var(--muted);
}

.modal-form {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 0.95rem;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.95), rgba(248, 250, 252, 0.55));
}

.modal-form-head {
  margin-bottom: 0.75rem;
}

.modal-form-title {
  margin: 0;
  color: var(--ink);
  font-size: 0.98rem;
}

.modal-form-subtitle {
  margin: 0.2rem 0 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.modal-form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.8rem;
}

.modal-field {
  min-width: 0;
}

.modal-field--status {
  border: 1px solid #dbe5f0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.75);
  padding: 0.7rem 0.75rem;
}

.modal-field--notes {
  display: flex;
  flex-direction: column;
}

.modal-field label {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.35rem;
  font-weight: 600;
  color: var(--ink);
}

.modal-field-help {
  margin: 0.35rem 0 0;
  font-size: 0.76rem;
  color: var(--muted);
  line-height: 1.35;
}

.modal-field select,
.modal-field textarea {
  border-radius: 11px;
  border-color: #cbd5e1;
}

.modal-field select {
  min-height: 42px;
}

.modal-field textarea {
  min-height: 130px;
}

.required-pill {
  font-size: 0.66rem;
  line-height: 1;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  border: 1px solid #fda4af;
  background: #fff1f2;
  color: #be123c;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.input-error {
  border-color: #fb7185 !important;
  box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.12);
}

.modal-field-error {
  margin: 0.35rem 0 0;
  font-size: 0.76rem;
  color: #b91c1c;
  font-weight: 600;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.9rem 1.25rem 1.1rem;
  border-top: 1px solid var(--line);
  background: var(--panel-muted);
}

.modal-footer-hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.modal-footer-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}
.connection-status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.7rem;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  font-size: 0.8rem;
  font-weight: 500;
  color: #dc2626;
  transition: all 0.3s ease;
}

.connection-status.connected {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #16a34a;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #dc2626;
  animation: pulse-red 2s ease-in-out infinite;
}

.connection-status.connected .status-dot {
  background: #22c55e;
  animation: pulse-green 2s ease-in-out infinite;
}

.status-text {
  font-size: 0.75rem;
  white-space: nowrap;
}

@keyframes pulse-red {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  50% {
    opacity: 0.7;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0);
  }
}

@keyframes pulse-green {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  }
  50% {
    opacity: 0.7;
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0);
  }
}

/* Mobile optimizations for modal */
@media (max-width: 900px) {
  .modal-header {
    grid-template-columns: 1fr auto;
  }

  .modal-header-action-wrap {
    grid-column: 1 / -1;
    justify-self: stretch;
    max-width: none;
  }

  .modal-summary-grid {
    grid-template-columns: 1fr;
  }

  .modal-summary-card--difference {
    grid-column: auto;
  }

  .modal-form-grid {
    grid-template-columns: 1fr;
  }

  .status-step {
    flex-basis: 138px;
    min-width: 138px;
  }

  .modal-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .modal-footer-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 640px) {
  .status-filter-list {
    grid-template-columns: 1fr;
  }

  .modal-overlay {
    padding: 0.5rem;
  }

  .modal-content {
    border-radius: 14px;
    width: calc(100vw - 1rem);
    height: calc(100dvh - 1rem);
  }

  .modal-header {
    padding: 0.8rem 1rem;
  }

  .modal-subtitle {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
  }

  .modal-body {
    padding: 0.75rem;
  }

  .modal-form {
    padding: 0.75rem;
  }

  .modal-footer {
    padding: 0.75rem 1rem;
    flex-direction: column-reverse;
  }

  .modal-footer .btn {
    width: 100%;
  }

  .modal-footer-actions {
    width: 100%;
    flex-direction: column-reverse;
  }

  .panel-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .header-actions {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;
    width: 100%;
  }

  .connection-status {
    width: 100%;
    justify-content: center;
  }

  .filter-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-actions .pager {
    width: 100%;
    justify-content: space-between;
  }

  .filter-actions .pager button {
    flex: 1;
  }
}

@page {
  size: letter portrait;
  margin: 0.35in;
}

@media print {
  :global(body) {
    background: #fff;
  }

  :global(body *) {
    visibility: hidden;
  }

  .modal-overlay,
  .modal-overlay * {
    visibility: visible;
  }

  .modal-overlay {
    position: static;
    inset: auto;
    padding: 0;
    background: transparent;
    backdrop-filter: none;
  }

  .modal-content {
    width: 8.5in;
    min-height: 11in;
    height: auto;
    border-radius: 0;
    border: 1px solid #d1d5db;
    box-shadow: none;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .btn-close,
  .modal-footer-actions {
    display: none;
  }

  .modal-footer {
    justify-content: flex-start;
    background: #fff;
    border-top-color: #d1d5db;
  }
}
</style>
