<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { countsService, stockService, specialLinesService, usersService, branchesService, type Count } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import MobileMenuToggle from '@/components/MobileMenuToggle.vue'
import { useSocketStore } from '@/stores/socket'

const authStore = useAuthStore()
const socketStore = useSocketStore()
import WarehousesStockDisplay from '@/components/WarehousesStockDisplay.vue'

type CountDetailRow = {
  id: number
  item_code: string
  item_description: string | null
  warehouse_id?: number
  warehouse_name?: string | null
  system_stock: number | string | null
  counted_stock: number | string | null
  unit?: string | null
  counted_by_user_id?: number | null
  counted_at?: string | null
  notes?: string | null
}

type ViewMode = 'captura' | 'tabla'

const statusLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  contando: 'Contando',
  contado: 'Contado',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado'
}

const statusClass = (status: string) => {
  if (status === 'pendiente') return 'closed'
  if (status === 'contando') return 'progress'
  if (status === 'contado' || status === 'cerrado') return 'open'
  if (status === 'cancelado') return 'danger'
  return 'warning'
}

const route = useRoute()
const MOBILE_VIEW_BREAKPOINT = 900

const getDefaultViewMode = (): ViewMode => {
  if (typeof window === 'undefined') return 'tabla'
  return window.matchMedia(`(max-width: ${MOBILE_VIEW_BREAKPOINT}px)`).matches ? 'captura' : 'tabla'
}

const count = ref<Count | null>(null)
const details = ref<CountDetailRow[]>([])
const loading = ref(true)
const error = ref('')

const updatingDetailId = ref<number | null>(null)
const actionMessage = ref('')
const socketCleanups: Array<() => void> = []

const showLookup = ref(false)
const viewMode = ref<ViewMode>(getDefaultViewMode())
const showSummaryModal = ref(false)
const creatingRequests = ref(false)
const requestsResult = ref<{ created: number; skipped: number; total_differences: number } | null>(null)
const justFinished = ref(false)

const captureSearch = ref('')
const showOnlyPending = ref(true)
const selectedIndex = ref(0)

const captureCountedStock = ref('')
const captureNotes = ref('')
const countedInputEl = ref<HTMLInputElement | null>(null)

// Warehouse-related state
const warehousesData = ref<any>(null)
const loadingWarehouses = ref(false)
const countedWarehouses = ref(new Set<number>())

// Reassignment state
const users = ref<any[]>([])
const showReassignModal = ref(false)
const reassignLoading = ref(false)
const selectedNewResponsible = ref<number | ''>('')

const branches = ref<any[]>([])

const loadBranches = async () => {
  try {
    const data = await branchesService.getAll()
    branches.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error loading branches', err)
  }
}

const filteredReassignUsers = computed(() => {
  const role = authStore.user?.role_name || ''
  if (role === 'jefe_almacen') {
    return users.value.filter((u) => u.role_slug === 'surtidores')
  }
  if (role === 'jefe_inventarios') {
    return users.value.filter((u) => u.role_slug === 'jefe_almacen')
  }
  return users.value
})

// Special lines state
const specialLines = ref<any[]>([])
const specialLinesMap = ref(new Map<string, any>())

// Helper to check if item belongs to special line
const getSpecialLineForItem = (itemCode: string) => {
  if (!itemCode || itemCode.length < 5) return null
  const lineCode = itemCode.substring(0, 5)
  return specialLinesMap.value.get(lineCode) || null
}

const parseRouteId = (value: unknown): number | '' => {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === undefined || raw === null || raw === '') return ''
  const num = Number(raw)
  return Number.isFinite(num) && num > 0 ? num : ''
}

const safeNumber = (v: unknown): number | null => {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const raw = String(v).trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

const initialParamId = parseRouteId(route.params.id)
const initialQueryId = parseRouteId(route.query.id)
const searchId = ref<number | ''>(initialParamId !== '' ? initialParamId : initialQueryId)
const searchFolio = ref(route.query.folio ? String(route.query.folio) : '')

const hasTarget = computed(() => searchId.value !== '' || Boolean(searchFolio.value))
const hasRouteId = computed(() => parseRouteId(route.params.id) !== '')

const canStart = computed(() => {
  if (count.value?.status !== 'pendiente') return false
  const branch = branches.value.find(b => b.id === count.value?.branch_id)
  if (branch && branch.status !== 'connected') return false
  return true
})
const canEdit = computed(() => count.value?.status === 'contando')
const isClosed = computed(() => count.value?.status === 'cerrado' || count.value?.status === 'contado')
const isCancelled = computed(() => count.value?.status === 'cancelado')
const isEditable = computed(() => canEdit.value && updatingDetailId.value === null && !isClosed.value && !isCancelled.value)

const isCounted = (d: CountDetailRow) => Boolean(d.counted_at || d.counted_by_user_id)

const diffClass = (diff: number) => {
  if (diff === 0) return 'open'
  return diff > 0 ? 'progress' : 'error'
}

const diffLabel = (diff: number) => {
  if (diff === 0) return 'Sin diferencia'
  return diff > 0 ? `+${diff}` : `${diff}`
}

const detailDifference = (detail: CountDetailRow): number => {
  return (safeNumber(detail.counted_stock) ?? 0) - (safeNumber(detail.system_stock) ?? 0)
}

const differenceRows = computed(() => {
  return details.value
    .filter((d) => isCounted(d))
    .map((d) => {
      const systemStock = safeNumber(d.system_stock) ?? 0
      const countedStock = safeNumber(d.counted_stock) ?? 0
      const difference = countedStock - systemStock
      return {
        id: d.id,
        item_code: d.item_code,
        item_description: d.item_description,
        system_stock: systemStock,
        counted_stock: countedStock,
        difference
      }
    })
    .filter((d) => d.difference !== 0)
})

const diffsPlus = computed(() => differenceRows.value.filter((d) => d.difference > 0))
const diffsMinus = computed(() => differenceRows.value.filter((d) => d.difference < 0))
const totalPlus = computed(() => diffsPlus.value.reduce((acc, d) => acc + d.difference, 0))
const totalMinus = computed(() => diffsMinus.value.reduce((acc, d) => acc + Math.abs(d.difference), 0))

const filteredDetails = computed(() => {
  let list = details.value
  if (showOnlyPending.value) list = list.filter((d) => !isCounted(d))

  const q = captureSearch.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((d) => {
    const code = (d.item_code || '').toLowerCase()
    const desc = (d.item_description || '').toLowerCase()
    return code.includes(q) || desc.includes(q)
  })
})

const selectedDetail = computed<CountDetailRow | null>(() => {
  const list = filteredDetails.value
  if (!list.length) return null
  const idx = Math.min(Math.max(selectedIndex.value, 0), list.length - 1)
  return list[idx] || null
})

// Display type based on classification
const displayType = computed(() => {
  if (!count.value) return ''
  const classification = count.value.classification || count.value.type || ''
  const typeMap: Record<string, string> = {
    'inventario': 'Inventario',
    'ajuste': 'Ajuste',
    'ciclico': 'Cíclico'
  }
  return typeMap[classification.toLowerCase()] || classification
})

// Display tolerance - use special line tolerance if applicable
const displayTolerance = computed(() => {
  if (!count.value) return { value: 0, source: 'default' }
  
  // Check if count has items from special lines
  const specialLinesInCount = new Map<string, any>()
  
  for (const detail of details.value) {
    const itemCode = String(detail.item_code || '')
    if (itemCode.length >= 5) {
      const lineCode = itemCode.substring(0, 5)
      const specialLine = specialLinesMap.value.get(lineCode)
      if (specialLine) {
        specialLinesInCount.set(lineCode, specialLine)
      }
    }
  }
  
  if (specialLinesInCount.size === 0) {
    // No special lines, use count's default tolerance
    return {
      value: count.value.tolerance_percentage || 0,
      source: 'default',
      label: `${count.value.tolerance_percentage || 0}%`
    }
  }
  
  if (specialLinesInCount.size === 1) {
    // Single special line, use its tolerance
    const entry = Array.from(specialLinesInCount.entries())[0]
    if (!entry) return { value: count.value.tolerance_percentage || 0, source: 'default', label: `${count.value.tolerance_percentage || 0}%` }
    
    const [lineCode, line] = entry
    return {
      value: line.tolerance_percentage,
      source: 'special_line',
      label: `${line.tolerance_percentage}% (Línea ${lineCode})`,
      lineCode,
      lineName: line.line_name
    }
  }
  
  // Multiple special lines
  const tolerances = Array.from(specialLinesInCount.values()).map(l => l.tolerance_percentage)
  const uniqueTolerance = new Set(tolerances)
  
  if (uniqueTolerance.size === 1) {
    // All have same tolerance
    return {
      value: tolerances[0],
      source: 'special_lines_same',
      label: `${tolerances[0]}% (Líneas especiales)`,
      count: specialLinesInCount.size
    }
  }
  
  // Different tolerances
  return {
    value: Math.min(...tolerances),
    source: 'special_lines_mixed',
    label: 'Varía por línea',
    tooltip: Array.from(specialLinesInCount.entries())
      .map(([code, line]) => `${code}: ${line.tolerance_percentage}%`)
      .join(', '),
    count: specialLinesInCount.size
  }
})

const countedTotal = computed(() => details.value.filter((d) => isCounted(d)).length)
const totalItems = computed(() => details.value.length)
const pendingTotal = computed(() => Math.max(totalItems.value - countedTotal.value, 0))
const progressPct = computed(() =>
  totalItems.value ? Math.round((countedTotal.value / totalItems.value) * 100) : 0
)

const focusCountedInput = async () => {
  await nextTick()
  countedInputEl.value?.focus()
  countedInputEl.value?.select?.()
}

const clampIndex = () => {
  const len = filteredDetails.value.length
  if (len <= 0) {
    selectedIndex.value = 0
    return
  }
  selectedIndex.value = Math.min(Math.max(selectedIndex.value, 0), len - 1)
}

const syncCaptureFields = async () => {
  const d = selectedDetail.value
  if (!d) {
    captureCountedStock.value = ''
    captureNotes.value = ''
    return
  }

  const counted = safeNumber(d.counted_stock)
  captureCountedStock.value = counted === null ? '' : String(counted)
  captureNotes.value = (d.notes ?? '') || ''
  await focusCountedInput()
}

const loadUsers = async () => {
  try {
    const data = await usersService.getAll()
    users.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error loading users', err)
  }
}

const openReassignModal = async () => {
  await loadUsers()
  selectedNewResponsible.value = count.value?.responsible_user_id || ''
  showReassignModal.value = true
}

const reassignCount = async () => {
  if (!count.value || !selectedNewResponsible.value) return
  
  try {
    reassignLoading.value = true
    await countsService.update(count.value.id, {
      responsible_user_id: Number(selectedNewResponsible.value)
    })
    await loadCount()
    showReassignModal.value = false
    actionMessage.value = 'Responsable actualizado correctamente'
  } catch (err: any) {
    console.error('Error reassigning count:', err)
    alert(err?.response?.data?.error || 'No se pudo reasignar el conteo')
  } finally {
    reassignLoading.value = false
  }
}



const loadDetails = async (id: number) => {
  const result = await countsService.getDetails(id)
  details.value = Array.isArray(result) ? (result as CountDetailRow[]) : []
  selectedIndex.value = 0
}

const loadCount = async () => {
  if (!hasTarget.value) {
    error.value = 'Proporciona un ID o folio para consultar el conteo'
    loading.value = false
    return
  }

  try {
    loading.value = true
    error.value = ''
    actionMessage.value = ''
    let data: Count | null = null

    if (searchId.value) {
      data = await countsService.getById(Number(searchId.value))
    } else if (searchFolio.value) {
      data = await countsService.getByFolio(String(searchFolio.value))
    }

    if (!data) {
      error.value = 'No se encontró el conteo solicitado'
      return
    }

    count.value = data
    await loadDetails(data.id)
    await syncCaptureFields()
  } catch (err: any) {
    console.error('Error loading count detail', err)
    error.value = 'No se pudo cargar el detalle del conteo'
  } finally {
    loading.value = false
  }
}

const startCount = async () => {
  if (!count.value) return
  try {
    actionMessage.value = ''
    await countsService.update(count.value.id, { status: 'contando' })
    await loadCount()
    actionMessage.value = 'Conteo iniciado'
  } catch (err: any) {
    console.error('Error starting count', err)
    if (err?.response?.status === 409) {
      actionMessage.value = 'El conteo ya fue iniciado por otro usuario'
      return
    }
    actionMessage.value = 'No se pudo iniciar el conteo'
  }
}

const cancelCount = async () => {
  if (!count.value) return
  if (!confirm('¿Estás seguro de que deseas cancelar este conteo?')) return

  try {
    actionMessage.value = ''
    await countsService.update(count.value.id, { status: 'cancelado' })
    await loadCount()
    actionMessage.value = 'Conteo cancelado'
  } catch (err: any) {
    console.error('Error cancelling count', err)
    actionMessage.value = 'No se pudo cancelar el conteo'
  }
}

const saveDetail = async (detail: CountDetailRow) => {
  if (!count.value) return

  const countedVal = safeNumber(detail.counted_stock)
  if (countedVal === null) {
    actionMessage.value = 'Captura una cantidad para guardar'
    return
  }

  try {
    updatingDetailId.value = detail.id
    const updated = await countsService.updateDetail(detail.id, {
      counted_stock: countedVal,
      notes: detail.notes ?? undefined
    })

    if (updated && (updated as any).specialLineAlerts) {
      console.group('⭐ Special Line Alerts Result')
      console.log('Results:', (updated as any).specialLineAlerts)
      console.groupEnd()
    }

    const idx = details.value.findIndex((d) => d.id === detail.id)
    if (idx >= 0 && updated) {
      details.value[idx] = { ...(details.value[idx] as any), ...(updated as any) }
    }

    await maybeCloseCount()
    actionMessage.value = `Artículo ${detail.item_code} actualizado`
  } catch (err) {
    console.error('Error updating detail', err)
    actionMessage.value = 'No se pudo actualizar el artículo'
  } finally {
    updatingDetailId.value = null
  }
}

const goPrev = async () => {
  selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  await syncCaptureFields()
}

const goNext = async () => {
  const len = filteredDetails.value.length
  selectedIndex.value = Math.min(selectedIndex.value + 1, Math.max(len - 1, 0))
  await syncCaptureFields()
}

const adjustCountedStock = (delta: number, evt?: MouseEvent) => {
  if (!canEdit.value || isClosed.value) return

  let step = delta
  if (evt?.shiftKey) step = delta * 10
  if (evt?.altKey) step = delta * 0.1

  const current = safeNumber(captureCountedStock.value) ?? 0
  const next = Math.max(0, current + step)
  const rounded = Math.round((next + Number.EPSILON) * 100) / 100
  captureCountedStock.value = String(rounded)
}

const saveCurrent = async (goNextAfter: boolean) => {
  const d = selectedDetail.value
  if (!d) return

  const countedVal = safeNumber(captureCountedStock.value)
  if (countedVal === null) {
    actionMessage.value = 'Captura una cantidad para guardar'
    return
  }

  const payload: CountDetailRow = {
    ...(d as any),
    counted_stock: countedVal,
    notes: captureNotes.value ? captureNotes.value : null
  }

  await saveDetail(payload)

  if (goNextAfter) {
    // Con "solo pendientes", el elemento se elimina del filtro tras guardarlo; el indice ya apunta al siguiente.
    clampIndex()
  }

  await syncCaptureFields()
}

const maybeCloseCount = async () => {
  if (!count.value) return
  if (count.value.status !== 'contando') return

  const allCounted = details.value.length > 0 && details.value.every((d) => isCounted(d))
  if (!allCounted) return

  try {
    // Backend cierra automáticamente al último guardado. Solo refrescamos estado.
    const updated = await countsService.getById(count.value.id)
    count.value = updated
    if (updated.status === 'cerrado') {
      justFinished.value = true
      showSummaryModal.value = true
      requestsResult.value = null
    }
  } catch (err) {
    console.error('Error closing count', err)
  }
}

const loadWarehousesStock = async (itemCode: string) => {
  if (!count.value) return
  
  try {
    loadingWarehouses.value = true
    warehousesData.value = await stockService.getItemWarehousesStock(
      count.value.branch_id,
      itemCode
    )
    
    // Check which warehouses are already counted
    countedWarehouses.value.clear()
    for (const detail of details.value) {
      if (detail.item_code === itemCode && detail.warehouse_id) {
        countedWarehouses.value.add(detail.warehouse_id)
      }
    }
  } catch (err) {
    console.error('Error loading warehouses:', err)
    warehousesData.value = null
  } finally {
    loadingWarehouses.value = false
  }
}

const handleCountWarehouse = async (warehouse: any) => {
  if (!count.value || !warehousesData.value) return
  
  try {
    actionMessage.value = ''
    
    // Create count detail for this warehouse
    await countsService.addDetail(count.value.id, {
      item_code: warehousesData.value.item_code,
      item_description: warehousesData.value.item_description,
      warehouse_id: warehouse.warehouse_id,
      warehouse_name: warehouse.warehouse_name,
      system_stock: warehouse.stock,
      counted_stock: 0, // User will enter later
      unit: warehousesData.value.item_unit
    })
    
    // Mark as counted
    countedWarehouses.value.add(warehouse.warehouse_id)
    
    // Reload details
    await loadDetails(count.value.id)
    
    actionMessage.value = `Almacén ${warehouse.warehouse_name} agregado al conteo`
  } catch (err: any) {
    console.error('Error adding warehouse to count:', err)
    actionMessage.value = err?.response?.data?.error || 'Error al agregar almacén al conteo'
  }
}

const createAdjustmentRequests = async () => {
  if (!count.value) return
  if (count.value.status !== 'cerrado' && count.value.status !== 'contado') return
  if (differenceRows.value.length === 0) return

  try {
    creatingRequests.value = true
    const resp = await countsService.createRequestsFromCount(count.value.id)
    requestsResult.value = {
      created: Number(resp?.created ?? 0),
      skipped: Number(resp?.skipped ?? 0),
      total_differences: Number(resp?.total_differences ?? 0)
    }
  } catch (err: any) {
    console.error('Error creating requests', err)
    alert(err?.response?.data?.error || 'No se pudieron crear las solicitudes')
  } finally {
    creatingRequests.value = false
  }
}

const loadSpecialLines = async () => {
  try {
    const response = await specialLinesService.getAll(true) // Only active lines
    specialLines.value = response.lines || []
    
    // Create map for quick lookup
    specialLinesMap.value.clear()
    for (const line of specialLines.value) {
      specialLinesMap.value.set(line.line_code, line)
    }
  } catch (err) {
    console.error('Error loading special lines:', err)
    // Don't show error to user, just log it
  }
}

onMounted(async () => {
  await Promise.all([
    loadCount(),
    loadSpecialLines(),
    loadBranches()
  ])
  if (hasRouteId.value) showLookup.value = false
})

watch(
  () => route.params.id,
  async (nextId) => {
    const parsed = parseRouteId(nextId)
    if (parsed === '') return
    searchId.value = parsed
    showLookup.value = false
    await loadCount()
  }
)

watch(
  () => selectedDetail.value?.id,
  async () => {
    await syncCaptureFields()
  }
)

watch(
  () => showOnlyPending.value,
  async () => {
    selectedIndex.value = 0
    await syncCaptureFields()
  }
)

watch(
  () => captureSearch.value,
  async () => {
    selectedIndex.value = 0
    await syncCaptureFields()
    
    // Load warehouses if search looks like an item code (at least 8 characters)
    const searchTerm = captureSearch.value.trim()
    if (searchTerm.length >= 8 && count.value) {
      await loadWarehousesStock(searchTerm)
    } else {
      warehousesData.value = null
    }
  }
)
// Redesign Logic
import { onUnmounted } from 'vue'

const elapsedTime = ref('00:00:00')
let timerInterval: number | undefined

const updateTimer = () => {
  if (!count.value?.started_at) {
    elapsedTime.value = '00:00:00'
    return
  }
  const start = new Date(count.value.started_at).getTime()
  
  // Determine end time: finished_at > closed_at > now
  let end = new Date().getTime()
  if (count.value.finished_at) {
    end = new Date(count.value.finished_at).getTime()
  } else if (count.value.closed_at) {
    end = new Date(count.value.closed_at).getTime()
  }

  const diff = Math.max(0, end - start)
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  elapsedTime.value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

onMounted(() => {
  timerInterval = setInterval(updateTimer, 1000)
  
  if (initialParamId) {
    socketStore.joinCount(Number(initialParamId))
  }

  socketCleanups.push(socketStore.on('status_updated', (event: any) => {
    if (event.count_id === Number(initialParamId)) {
      loadCount()
    }
  }))

  socketCleanups.push(socketStore.on('detail_added', (event: any) => {
    if (event.count_id === Number(initialParamId)) {
      loadDetails(event.count_id)
    }
  }))

  socketCleanups.push(socketStore.on('reassigned', (event: any) => {
    if (event.count_id === Number(initialParamId)) {
      loadCount()
    }
  }))
})

onUnmounted(() => {
  clearInterval(timerInterval)
  if (initialParamId) {
    socketStore.leaveCount(Number(initialParamId))
  }
  socketCleanups.forEach(fn => fn())
})

const recentHistory = computed(() => {
  return details.value
    .filter((d) => isCounted(d))
    .sort((a, b) => {
      const dateA = new Date(a.counted_at || 0).getTime()
      const dateB = new Date(b.counted_at || 0).getTime()
      return dateB - dateA
    })
    .slice(0, 5)
})
</script>

<template>
  <section class="panel wide">
    <div class="panel-header">
      <div class="panel-title">
        <MobileMenuToggle />
        <div class="panel-title-text">
          <p class="eyebrow">Captura</p>
          <h2>
            Detalle del conteo: {{ count?.folio }}
            <span :class="['socket-status-dot', { connected: socketStore.connected }]" 
                  :title="socketStore.connected ? 'Conectado en tiempo real' : 'Sin conexión real-time'"></span>
          </h2>
          <p class="muted">Captura articulo por articulo (modo captura) o revisa todo en tabla.</p>
        </div>
      </div>
      <div class="header-actions">
        <template v-if="!hasRouteId || showLookup">
          <input v-model="searchId" type="number" min="1" placeholder="ID de conteo" style="width: 140px" />
          <input v-model="searchFolio" placeholder="Folio (ej. CNT-202501-0001)" style="width: 220px" />
          <button class="btn" @click="loadCount">Buscar</button>
        </template>
        <template v-else>
          <button class="btn ghost" @click="showLookup = true">Cambiar conteo</button>
        </template>
      </div>
    </div>

    <div v-if="loading" class="muted" style="padding: 1rem">Cargando detalle...</div>
    <div v-else-if="error" class="error-message panel">
      <p>{{ error }}</p>
      <button class="btn" @click="loadCount">Reintentar</button>
    </div>
    <template v-else>
      <div v-if="count" class="panel-grid">
        <div class="panel">
          <p class="eyebrow">Folio</p>
          <h3>{{ count.folio }}</h3>
          <p class="muted">Sucursal ID: {{ count.branch_id }}</p>
        </div>
        <div class="panel">
          <p class="eyebrow">Tipo</p>
          <h3>{{ displayType }}</h3>
          <p class="muted" :title="displayTolerance.tooltip || ''">
            Tolerancia: {{ displayTolerance.label }}
          </p>
        </div>
        <div class="panel">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <p class="eyebrow">Responsable</p>
            <button 
              v-if="count?.status === 'pendiente' && (authStore.userRole === 'jefe_almacen' || authStore.isAdmin || authStore.userRole === 'jefe_inventarios')"
              class="btn small ghost"
              style="padding: 2px 8px; font-size: 0.75rem;"
              @click="openReassignModal"
            >
              Reasignar
            </button>
          </div>
          <h3>{{ (count as any).responsible_user_name || 'Sin asignar' }}</h3>
          <p class="muted">
            Estado: <span :class="['status', statusClass(count.status)]">{{ statusLabel[count.status] || count.status }}</span>
          </p>
        </div>
        <div class="panel">
          <p class="eyebrow">Acciones</p>
          <div class="actions" style="display: flex; gap: 0.5rem;">
            <button
              class="btn"
              :disabled="!canStart || !authStore.hasPermission('counts.update')"
              @click="startCount"
            >
              Iniciar conteo
            </button>
            <button
              v-if="canStart"
              class="btn ghost danger"
              :disabled="!authStore.hasPermission('counts.update')"
              @click="cancelCount"
            >
              Cancelar
            </button>
            <button class="btn ghost" @click="loadCount">Refrescar</button>
          </div>
          <p class="muted" v-if="actionMessage">{{ actionMessage }}</p>
        </div>
      </div>

      <div class="capture-toolbar">
        <div class="mode-tabs">
          <button class="tab" :class="{ active: viewMode === 'captura' }" @click="viewMode = 'captura'">
            Captura
          </button>
          <button class="tab" :class="{ active: viewMode === 'tabla' }" @click="viewMode = 'tabla'">
            Tabla
          </button>
        </div>

        <div class="progress">
          <div class="progress-top">
            <span class="muted small">Progreso</span>
            <span class="pill">{{ countedTotal }}/{{ totalItems }} ({{ progressPct }}%)</span>
          </div>
          <div class="progress-bar">
            <div class="progress-bar-fill" :style="{ width: `${progressPct}%` }"></div>
          </div>
          <div class="muted small">Pendientes: {{ pendingTotal }}</div>
        </div>
      </div>

      <div v-if="viewMode === 'captura'" class="dashboard-wrap">
        <!-- Header Metrics -->
        <div class="dashboard-metrics">
          <div class="metric-card">
            <div class="metric-icon blue">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <div>
              <p class="metric-label">Tiempo Transcurrido</p>
              <p class="metric-value">{{ elapsedTime }}</p>
            </div>
          </div>
          <!-- Removed Articles Counted Metric -->
          <div class="metric-card">
            <div class="metric-icon blue">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><line x1="16" y1="21" x2="16" y2="8"></line></svg>
            </div>
            <div>
              <p class="metric-label">Progreso Total</p>
              <p class="metric-value">{{ progressPct }}%</p>
            </div>
          </div>
        </div>

        <div class="dashboard-grid">
          <!-- Left Column: Product & Capture -->
          <section class="dashboard-main">
            <!-- Navigation / Search Integrated -->
            <div class="capture-controls embedded">
               <input v-model="captureSearch" class="search-input" placeholder="Buscar código o descripción (o escanea)" />
            </div>

            <div v-if="!selectedDetail" class="empty-state">
               <p>No hay artículos para mostrar con el filtro actual.</p>
            </div>
            
            <div v-else class="product-card">
               <div class="card-header">
                 <h2 class="card-title">PRODUCTO</h2>
                 <div class="header-badges" style="display: flex; gap: 0.5rem; align-items: center;">
                   <span v-if="selectedDetail.warehouse_name" class="status-badge" style="background: rgba(37, 99, 235, 0.1); color: #2563eb;">
                     📍 {{ selectedDetail.warehouse_name }}
                   </span>
                   <span class="status-badge" :class="isCounted(selectedDetail) ? 'completed' : 'pending'">
                     {{ isCounted(selectedDetail) ? 'Contado' : 'Pendiente' }}
                   </span>
                 </div>
               </div>
               
               <div class="product-info">
                 <div class="info-group">
                   <p class="label">ID</p>
                   <p class="value">{{ selectedDetail.item_code }}</p>
                 </div>
                 <div class="info-group wide">
                   <p class="label">Descripción</p>
                   <p class="value description">{{ selectedDetail.item_description || '-' }}</p>
                 </div>
                 <div class="info-group">
                   <p class="label">Almacén</p>
                   <p class="value">{{ selectedDetail.warehouse_name || ('Almacén ' + (selectedDetail.warehouse_id || 1)) }}</p>
                 </div>
                 <div class="info-group">
                   <p class="label">Línea</p>
                   <p class="value">
                     {{ selectedDetail.item_code.substring(0, 5) }}
                     <span v-if="getSpecialLineForItem(selectedDetail.item_code)" class="special-line-text">(Especial)</span>
                   </p>
                 </div>
               </div>
               
               <div class="stock-section">
                  <div class="stock-box system">
                    <label>Stock en Sistema</label>
                    <div class="stock-value">{{ safeNumber(selectedDetail.system_stock) ?? '-' }}</div>
                  </div>
                  
                  <div class="stock-box physical">
                    <label>Stock Físico</label>
                    <div class="stepper-wrapper">
                      <button class="stepper-btn" @click="adjustCountedStock(-1, $event)" :disabled="!isEditable || updatingDetailId === selectedDetail.id">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </button>
                      <input 
                        ref="countedInputEl"
                        v-model="captureCountedStock" 
                        type="number" 
                        class="stepper-input" 
                        :disabled="!isEditable || updatingDetailId === selectedDetail.id"
                        @keyup.enter="saveCurrent(true)"
                      />
                      <button class="stepper-btn up" @click="adjustCountedStock(1, $event)" :disabled="!isEditable || updatingDetailId === selectedDetail.id">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                      </button>
                    </div>
                  </div>
                  <div class="stock-box difference">
                    <label>Diferencia</label>
                    <div v-if="!isCounted(selectedDetail)" class="status warning">Pendiente</div>
                    <div v-else :class="['status', diffClass(detailDifference(selectedDetail))]">
                      {{ diffLabel(detailDifference(selectedDetail)) }}
                    </div>
                  </div>
               </div>
               
               <div class="notes-section">
                 <label>Notas Opcionales</label>
                 <textarea 
                   v-model="captureNotes" 
                   rows="3" 
                   class="notes-input" 
                   placeholder="Escribe observaciones aquí..."
                   :disabled="!isEditable || updatingDetailId === selectedDetail.id"
                 ></textarea>
               </div>
               
               <div class="action-footer">
                   <button class="btn ghost" :disabled="!authStore.hasPermission('counts.update')" @click="saveCurrent(false)">Guardar</button>
                   <button class="btn primary" :disabled="!authStore.hasPermission('counts.update')" @click="saveCurrent(true)">Guardar y Siguiente</button>
               </div>
            </div>

            <!-- Warehouses Stock Display (Original preserved) -->
            <WarehousesStockDisplay v-if="warehousesData" :warehouses-data="warehousesData" :can-count="canEdit" :counted-warehouses="countedWarehouses" @count-warehouse="handleCountWarehouse" />
          </section>

          <!-- Right Column: Sidebar Removed -->
        </div>
      </div>

      <div v-else>
        <!-- Métricas también en vista tabla -->
        <div class="dashboard-metrics" style="margin-top: 0.75rem; margin-bottom: 0.75rem">
          <div class="metric-card">
            <div class="metric-icon blue">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <div>
              <p class="metric-label">Tiempo Transcurrido</p>
              <p class="metric-value">{{ elapsedTime }}</p>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon blue">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><line x1="16" y1="21" x2="16" y2="8"></line></svg>
            </div>
            <div>
              <p class="metric-label">Progreso Total</p>
              <p class="metric-value">{{ countedTotal }}/{{ totalItems }} ({{ progressPct }}%)</p>
            </div>
          </div>
        </div>
        <div class="table-card">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Almacén</th>
                <th>Descripcion</th>
                <th>Stock sistema</th>
                <th>Cantidad contada</th>
                <th>Diferencia</th>
                <th>Notas</th>
                <th v-if="canEdit">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in details" :key="line.id" :class="{ 'counted-row': isCounted(line) }">
                <td>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <strong>{{ line.item_code }}</strong>
                    <span 
                      v-if="getSpecialLineForItem(line.item_code)" 
                      class="special-line-badge"
                      :title="`Línea especial: ${getSpecialLineForItem(line.item_code).line_name || getSpecialLineForItem(line.item_code).line_code} (Tolerancia: ${getSpecialLineForItem(line.item_code).tolerance_percentage}%)`"
                    >
                      ⭐
                    </span>
                  </div>
                  <div v-if="line.item_code" class="muted small" style="margin-top: 0.15rem">
                    Línea: {{ line.item_code.substring(0, 5) }}
                    <span v-if="getSpecialLineForItem(line.item_code)" class="special-line-text">
                      (Especial)
                    </span>
                  </div>
                </td>
                <td>
                  <span class="tag" style="background: rgba(37, 99, 235, 0.1); border-color: rgba(37, 99, 235, 0.2); font-weight: 600">
                    📍 {{ line.warehouse_name || 'Almacén ' + (line.warehouse_id || 1) }}
                  </span>
                </td>
                <td>{{ line.item_description || '-' }}</td>
                <td>{{ safeNumber(line.system_stock) ?? '-' }}</td>
                <td>
                  <template v-if="canEdit">
                    <input v-model.number="(line as any).counted_stock" type="number" min="0" style="width: 120px" />
                  </template>
                  <template v-else>
                    {{ line.counted_stock ?? '-' }}
                  </template>
                </td>
                <td>
                  <template v-if="!isCounted(line)">
                    <span class="status warning">Pendiente</span>
                  </template>
                  <template v-else>
                    <span
                      :class="[
                        'status',
                        diffClass(detailDifference(line))
                      ]"
                    >
                      {{ diffLabel(detailDifference(line)) }}
                    </span>
                  </template>
                </td>
                <td>
                  <template v-if="canEdit">
                    <input
                      v-model="(line as any).notes"
                      type="text"
                      placeholder="Sin notas"
                      style="width: 200px"
                    />
                  </template>
                  <template v-else>
                    {{ line.notes || '-' }}
                  </template>
                </td>
                <td v-if="canEdit">
                  <button class="btn" :disabled="updatingDetailId === line.id" @click="saveDetail(line)">
                    Guardar
                  </button>
                </td>
              </tr>
              <tr v-if="details.length === 0">
                <td :colspan="canEdit ? 8 : 7" class="muted" style="text-align: center; padding: 1rem">
                  Sin detalles
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </div><!-- /table-card -->
      </div><!-- /v-else -->
    </template>
  </section>

  <!-- Modal resumen de cierre -->
  <div v-if="showSummaryModal" class="modal-overlay" @click="showSummaryModal = false">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Resumen de diferencias</h3>
        <button class="btn-close" @click="showSummaryModal = false">&times;</button>
      </div>
      <div class="modal-body">
        <p class="muted" style="margin-top: 0">
          Conteo <strong>{{ count?.folio }}</strong> cerrado.
        </p>

        <div class="summary-grid">
          <div class="summary-card">
            <p class="eyebrow">De más</p>
            <h4>{{ diffsPlus.length }}</h4>
            <p class="muted">Total: {{ totalPlus }}</p>
          </div>
          <div class="summary-card">
            <p class="eyebrow">De menos</p>
            <h4>{{ diffsMinus.length }}</h4>
            <p class="muted">Total: {{ totalMinus }}</p>
          </div>
        </div>

        <div v-if="differenceRows.length === 0" class="status open" style="margin-top: 0.75rem">
          Sin diferencias: no hay solicitudes por generar.
        </div>

        <div v-else class="summary-lists">
          <div class="summary-list">
            <h4>De más</h4>
            <div v-for="r in diffsPlus.slice(0, 8)" :key="r.id" class="summary-row">
              <div class="code">{{ r.item_code }}</div>
              <div class="desc">{{ r.item_description || '-' }}</div>
              <div class="diff plus">+{{ r.difference }}</div>
            </div>
            <p class="muted small" v-if="diffsPlus.length > 8">… y {{ diffsPlus.length - 8 }} más</p>
          </div>
          <div class="summary-list">
            <h4>De menos</h4>
            <div v-for="r in diffsMinus.slice(0, 8)" :key="r.id" class="summary-row">
              <div class="code">{{ r.item_code }}</div>
              <div class="desc">{{ r.item_description || '-' }}</div>
              <div class="diff minus">{{ r.difference }}</div>
            </div>
            <p class="muted small" v-if="diffsMinus.length > 8">… y {{ diffsMinus.length - 8 }} más</p>
          </div>
        </div>

        <div v-if="requestsResult" class="status open" style="margin-top: 0.75rem">
          Solicitudes creadas: <strong>{{ requestsResult.created }}</strong>
          <span v-if="requestsResult.skipped"> (omitidas: {{ requestsResult.skipped }})</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn ghost" @click="showSummaryModal = false">Cerrar</button>
        <button
          class="btn"
          :disabled="creatingRequests || differenceRows.length === 0"
          @click="createAdjustmentRequests"
        >
          {{ creatingRequests ? 'Creando...' : 'Crear solicitud(es) de ajuste' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Modal Reasignar Responsable -->
  <div v-if="showReassignModal" class="modal-overlay" @click="showReassignModal = false">
    <div class="modal-content" @click.stop style="max-width: 400px;">
      <div class="modal-header">
        <h3>Reasignar Responsable</h3>
        <button class="btn-close" @click="showReassignModal = false">&times;</button>
      </div>
      <div class="modal-body">
        <p class="muted" style="margin-bottom: 1rem">
          Selecciona al nuevo responsable para este conteo:
        </p>
        <div class="form-group">
          <label for="new-responsible">Nuevo Responsable</label>
          <select id="new-responsible" v-model="selectedNewResponsible" class="input-full">
            <option value="">Selecciona un usuario</option>
            <option v-for="user in filteredReassignUsers" :key="user.id" :value="user.id">
              {{ user.name }} - [{{ user.role_name }}]
            </option>
          </select>
        </div>
      </div>
      <div class="modal-footer" style="padding: 1rem; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 0.5rem;">
        <button class="btn ghost" @click="showReassignModal = false">Cancelar</button>
        <button class="btn" :disabled="reassignLoading || !selectedNewResponsible" @click="reassignCount">
          {{ reassignLoading ? 'Actualizando...' : 'Confirmar Cambio' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.capture-toolbar {
  margin-top: 0.75rem;
  display: flex;
  gap: 1rem;
  align-items: stretch;
  justify-content: space-between;
  flex-wrap: wrap;
}

.mode-tabs {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 999px;
  overflow: hidden;
  background: var(--panel);
}

.tab {
  padding: 0.45rem 0.85rem;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--muted);
  font-weight: 600;
}

.tab.active {
  background: rgba(37, 99, 235, 0.12);
  color: var(--ink);
}

.progress {
  min-width: 280px;
  flex: 1;
  max-width: 520px;
}

.progress-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.progress-bar {
  height: 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(15, 23, 42, 0.06);
  overflow: hidden;
  margin: 0.35rem 0 0.25rem;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #2563eb, #60a5fa);
}

.table tbody tr.counted-row {
  background: rgba(34, 197, 94, 0.04);
}

.table tbody tr.counted-row:hover {
  background: rgba(34, 197, 94, 0.08);
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(37, 99, 235, 0.08);
  font-weight: 700;
}

.small {
  font-size: 0.85rem;
}

.capture-controls {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.capture-search {
  flex: 1;
  min-width: 260px;
}

.checkbox {
  display: inline-flex;
  gap: 0.55rem;
  align-items: center;
  user-select: none;
  font-weight: 600;
}

.checkbox input[type='checkbox'] {
  width: 16px;
  height: 16px;
}

.counter-nav {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.2rem 0.35rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--panel);
}

.counter-btn {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
  font-size: 1.25rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 120ms ease, transform 120ms ease, opacity 120ms ease;
}

.counter-btn:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.08);
  transform: translateY(-1px);
}

.counter-btn:active:not(:disabled) {
  transform: translateY(0);
}

.counter-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.counter-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(37, 99, 235, 0.08);
  font-weight: 800;
  letter-spacing: 0.02em;
  user-select: none;
}

.counter-bracket {
  color: var(--muted);
  font-weight: 900;
}

.counter-num {
  min-width: 1.6ch;
  text-align: center;
  color: var(--ink);
}

.capture-card {
  margin-top: 0.75rem;
}

.capture-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.capture-code {
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  margin-top: 0.15rem;
}

.capture-desc {
  max-width: 720px;
}

.capture-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.capture-warning {
  padding: 0.55rem 0.75rem;
  border-radius: 12px;
}

.capture-body {
  margin-top: 0.9rem;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1rem;
}

.capture-field label {
  display: block;
  margin-bottom: 0.35rem;
  font-weight: 700;
}

.qty-stepper {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.qty-btn {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
  font-size: 1.4rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 120ms ease, transform 120ms ease, opacity 120ms ease;
}

.qty-btn:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.08);
  transform: translateY(-1px);
}

.qty-btn:active:not(:disabled) {
  transform: translateY(0);
}

.qty-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.qty-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(37, 99, 235, 0.08);
  font-weight: 900;
  user-select: none;
}

.qty-bracket {
  color: var(--muted);
}

.qty-input {
  width: 120px;
  height: 44px;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 1.15rem;
  font-weight: 900;
  text-align: center;
  color: var(--ink);
  outline: none;
  padding: 0;
  appearance: textfield;
}

.qty-input::-webkit-outer-spin-button,
.qty-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.capture-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.table-card {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
  max-width: 100%;
}

.table-scroll {
  overflow-x: auto;
  max-width: 100%;
  -webkit-overflow-scrolling: touch;
}

.table {
  width: 100%;
  min-width: 100%;
}

@media (max-width: 900px) {
  .panel-header {
    position: sticky;
    top: 0;
    z-index: 5;
    background: var(--panel);
  }

  .table {
    width: max-content;
    min-width: 900px;
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 18px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 860px;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.2rem;
  border-bottom: 1px solid var(--line);
}

.modal-header h3 {
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.8rem;
  color: var(--muted);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.btn-close:hover {
  background: rgba(15, 23, 42, 0.06);
  color: var(--ink);
}

.modal-body {
  padding: 1.2rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.2rem;
  border-top: 1px solid var(--line);
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.summary-card {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 0.9rem;
  background: rgba(255, 255, 255, 0.7);
}

.summary-card h4 {
  margin: 0.15rem 0 0.1rem;
  font-size: 1.6rem;
}

.summary-lists {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 0.85rem;
}

.summary-list {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 0.9rem;
  background: rgba(255, 255, 255, 0.7);
}

.summary-list h4 {
  margin: 0 0 0.6rem;
}

.summary-row {
  display: grid;
  grid-template-columns: 140px 1fr 110px;
  gap: 0.6rem;
  align-items: center;
  padding: 0.45rem 0.35rem;
  border-top: 1px dashed rgba(15, 23, 42, 0.12);
}

.summary-row:first-of-type {
  border-top: none;
}

.summary-row .code {
  font-weight: 800;
  color: var(--ink);
  letter-spacing: 0.01em;
}

.summary-row .desc {
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-row .diff {
  text-align: right;
  font-weight: 900;
}

.summary-row .diff.plus {
  color: #1d4ed8;
}

.summary-row .diff.minus {
  color: #b91c1c;
}

@media (max-width: 860px) {
  .capture-body {
    grid-template-columns: 1fr;
  }
  .progress {
    max-width: none;
  }
  .summary-grid {
    grid-template-columns: 1fr;
  }
  .summary-lists {
    grid-template-columns: 1fr;
  }
  .summary-row {
    grid-template-columns: 110px 1fr 90px;
  }
}
/* Dashboard Redesign Styles */
.dashboard-wrap {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.dashboard-metrics {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.metric-card {
  background: white;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 200px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--line);
}

.metric-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.metric-icon.blue {
  background: #eff6ff;
  color: #3b82f6;
}

.metric-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 600;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.metric-value {
  font-size: 1.25rem;
  font-weight: 800;
  color: #1f2937;
  margin: 0;
  line-height: 1.2;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr; /* Single column layout (sidebar removed) */
  gap: 1.5rem;
  align-items: start;
}

.dashboard-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.sidebar-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.progress-card {
  background: white;
  padding: 1.2rem;
  border-radius: 16px;
  border: 1px solid var(--line);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: #4b5563;
  font-size: 0.9rem;
}

.progress-track {
  height: 10px;
  background: #f3f4f6;
  border-radius: 99px;
  overflow: hidden;
}

.progress-fill {
  background: #2563eb;
  height: 100%;
  border-radius: 99px;
  transition: width 0.3s ease;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.history-item {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  padding: 0.75rem;
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-meta p {
  margin: 0;
}

.history-time {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 2px;
}

.history-code {
  font-weight: 700;
  color: #1f2937;
}

.history-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
  background: #dcfce7;
  color: #15803d;
}

/* Product Card Area */
.dashboard-main {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.capture-controls.embedded {
  display: flex;
  gap: 0.75rem;
}

.capture-controls.embedded .search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--line);
  font-size: 1rem;
}

.capture-controls.embedded .nav-buttons {
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 0 0.5rem;
  gap: 0.5rem;
}

.nav-btn {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  padding: 0 0.5rem;
  cursor: pointer;
  color: #6b7280;
  line-height: 1;
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-counter {
  font-weight: 600;
  color: #374151;
  font-variant-numeric: tabular-nums;
}

.product-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.card-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #111827;
  letter-spacing: 0.05em;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-badge.pending {
  background: #fef3c7;
  color: #d97706;
}

.status-badge.completed {
  background: #dcfce7;
  color: #15803d;
}

.product-info {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1.5rem;
  overflow: hidden; /* Prevent grid blowout */
}

/* ... existing styles ... */

.info-group .value.description {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  display: block;
}

.info-group.wide {
  min-width: 0; /* Critical for flex/grid truncation */
}

.stock-section {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.5rem;
  background: #f9fafb; /* Light gray bg for stock area */
  padding: 1.5rem;
  border-radius: 16px;
}

.stock-box label {
  display: block;
  font-weight: 700;
  color: #374151;
  margin-bottom: 0.5rem;
}

.stock-value {
  font-size: 2.5rem;
  font-weight: 600;
  color: #1f2937;
  text-align: center;
}

.stepper-wrapper {
  display: flex;
  align-items: stretch;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  height: 56px;
  overflow: hidden;
}

.stepper-btn {
  padding: 0 1rem;
  background: white;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.stepper-btn:hover:not(:disabled) {
  background: #f3f4f6;
  color: #4b5563;
}

.stepper-input {
  flex: 1;
  border: none;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  padding: 0;
  -moz-appearance: textfield;
}

.stepper-input:focus {
  ring: 0;
  outline: none;
}

.notes-section label {
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.notes-input {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1rem;
  background: #f9fafb;
  font-family: inherit;
  resize: none;
}

.notes-input:focus {
  background: white;
  border-color: #3b82f6;
  outline: none;
}

.action-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 0.5rem;
}

.action-footer .btn {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border-radius: 10px;
}

@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  .product-info {
    grid-template-columns: 1fr;
  }
  .stock-section {
    grid-template-columns: 1fr;
  }
}

/* Special Lines Badges */
.special-line-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  padding: 0.25rem 0.4rem;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  border-radius: 6px;
  cursor: help;
  transition: transform 0.2s ease;
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
}

.special-line-badge:hover {
  transform: scale(1.1);
}

.special-line-text {
  color: #f59e0b;
  font-weight: 600;
  margin-left: 0.25rem;
}

.status-badge.special-line {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #78350f;
  font-weight: 700;
  border: 1px solid #f59e0b;
  box-shadow: 0 2px 6px rgba(245, 158, 11, 0.25);
}
.socket-status-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #ef4444; /* Rojo: desconectado */
  margin-left: 10px;
  box-shadow: 0 0 5px rgba(239, 68, 68, 0.5);
  transition: all 0.3s ease;
  vertical-align: middle;
}

.socket-status-dot.connected {
  background-color: #22c55e; /* Verde: conectado */
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.7);
}

</style>
