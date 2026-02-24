<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, nextTick } from 'vue'
import { branchesService, countsService, stockService, usersService, type Branch } from '@/services/api'
import MobileMenuToggle from '@/components/MobileMenuToggle.vue'
import { useRouter } from 'vue-router'
import Swal from 'sweetalert2'

type Warehouse = { id: number; name: string; habilitado?: number }
type SortKey = 'code' | 'description' | 'line' | 'unit' | 'stock' | `wh-${number}` | 'lastCount'

const router = useRouter()

const branches = ref<Branch[]>([])
const connectedBranches = computed(() => branches.value.filter(b => b.status === 'connected'))
const warehouses = ref<Warehouse[]>([])
const users = ref<Array<{ id: number; name: string }>>([])
const selectedBranchId = ref<number | ''>('')
const selectedWarehouseId = ref<'all' | number>('all')

const filters = reactive({
  search: '',
  line: '',
  limit: 80,
  dateFrom: '',
  dateTo: ''
})

const codesText = ref('')
const parseCodes = () => {
  return codesText.value
    .split(/[\s,;]+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
}
const items = ref<Array<{
  code: string
  description: string
  line: string
  unit: string
  stock: number
  warehouseId: number
  warehouseName: string
  lastCount?: string
  folio?: string
}>>([])

const viewMode = ref<'detail' | 'compare'>('detail')
const sortState = ref<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'code', dir: 'asc' })
const loading = ref(false)
const error = ref('')
const filtersOpen = ref(true)
const isCompactScreen = ref(false)
const showLineDropdown = ref(false)
const lineOptions = ref<string[]>([])
const BRANCH_KEY = 'warehouses.selectedBranch'
const WAREHOUSE_KEY = 'warehouses.selectedWarehouse'
let resizeHandler: (() => void) | null = null
let searchTimer: number | undefined

const EMPTY_LINE_VALUE = '__EMPTY__'


const hasBranch = computed(() => selectedBranchId.value !== '')

const enabledWarehouses = computed(() => warehouses.value.filter((w) => w.habilitado === undefined || w.habilitado === 1))

const warehouseColumns = computed(() => enabledWarehouses.value.map((w) => ({ id: w.id, label: w.name || `Almacén ${w.id}` })))

const displayCount = computed(() => items.value.length)

const lineOptionsComputed = computed(() => {
  const opts = [{ value: '', label: 'Todas las líneas' }, { value: EMPTY_LINE_VALUE, label: 'Sin línea' }]
  const seen = new Set<string>()
  for (const ln of lineOptions.value) {
    const val = (ln ?? '').toString()
    if (!val || seen.has(val)) continue
    seen.add(val)
    opts.push({ value: val, label: val })
  }
  return opts
})

const filteredLineOptions = computed(() => {
  const q = filters.line.toLowerCase()
  if (!q) return lineOptionsComputed.value
  return lineOptionsComputed.value.filter((opt) => opt.label.toLowerCase().includes(q))
})

const tableRows = computed(() => {
  const sorted = [...items.value]
  const { key, dir } = sortState.value
  sorted.sort((a, b) => {
    const getVal = (row: any) => {
      if (key === 'code') return row.code
      if (key === 'description') return row.description
      if (key === 'line') return row.line
      if (key === 'unit') return row.unit
      if (key === 'stock') return row.stock
      if (key === 'lastCount') return row.lastCount || ''
      if (key.startsWith('wh-')) return row.warehouseId === Number(key.slice(3)) ? row.stock : -Infinity
      return ''
    }
    const va = getVal(a)
    const vb = getVal(b)
    if (typeof va === 'number' && typeof vb === 'number') return dir === 'asc' ? va - vb : vb - va
    return dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
  })
  return sorted
})

const comparisonRows = computed(() => {
  const map = new Map<string, any>()
  for (const row of items.value) {
    if (!map.has(row.code)) {
      map.set(row.code, {
        code: row.code,
        description: row.description,
        line: row.line,
        unit: row.unit,
        warehouses: {} as Record<number, number>,
        lastCount: row.lastCount,
        folio: row.folio
      })
    }
    const rec = map.get(row.code)
    rec.warehouses[row.warehouseId] = row.stock
    if (!rec.lastCount && row.lastCount) rec.lastCount = row.lastCount
    if (!rec.folio && row.folio) rec.folio = row.folio
  }

  const list = Array.from(map.values())
  const { key, dir } = sortState.value
  list.sort((a, b) => {
    const getVal = (r: any) => {
      if (key === 'code') return r.code
      if (key === 'description') return r.description
      if (key === 'line') return r.line
      if (key === 'unit') return r.unit
      if (key === 'lastCount') return r.lastCount || ''
      if (key.startsWith('wh-')) return r.warehouses[Number(key.slice(3))] ?? -Infinity
      return ''
    }
    const va = getVal(a)
    const vb = getVal(b)
    if (typeof va === 'number' && typeof vb === 'number') return dir === 'asc' ? va - vb : vb - va
    return dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
  })
  return list
})

const formatDate = (date?: string) => {
  if (!date) return '-'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const saveSelections = () => {
  if (selectedBranchId.value !== '') localStorage.setItem(BRANCH_KEY, String(selectedBranchId.value))
  localStorage.setItem(WAREHOUSE_KEY, String(selectedWarehouseId.value))
}

const restoreSelections = () => {
  const b = localStorage.getItem(BRANCH_KEY)
  const w = localStorage.getItem(WAREHOUSE_KEY)
  if (b) selectedBranchId.value = Number(b)
  if (w === 'all') selectedWarehouseId.value = 'all'
  else if (w) selectedWarehouseId.value = Number(w) || 'all'
}

const loadBranches = async () => {
  try {
    const resp = await branchesService.getAll()
    branches.value = Array.isArray(resp) ? resp : []
    const firstBranch = branches.value[0]
    if (!selectedBranchId.value && firstBranch) selectedBranchId.value = firstBranch.id
  } catch (err) {
    console.error('Error loading branches', err)
  }
}

const loadUsers = async () => {
  try {
    const resp = await usersService.getAll()
    users.value = Array.isArray(resp) ? resp : []
  } catch (err) {
    console.error('Error loading users', err)
  }
}

const loadWarehouses = async () => {
  warehouses.value = []
  if (!hasBranch.value) return
  try {
    const resp: any = await branchesService.getWarehouses(Number(selectedBranchId.value))
    const list = Array.isArray(resp) ? resp : resp?.warehouses || []
    warehouses.value = list
      .map((w: any) => ({ id: w.id ?? w.almacen ?? w.warehouse_id, name: w.name ?? w.nombre ?? w.warehouse_name ?? `Almacén ${w.id}`, habilitado: w.habilitado ?? w.enabled ?? 1 }))
      .filter((w: Warehouse) => w.id)
    if (selectedWarehouseId.value !== 'all' && !warehouses.value.some((w) => w.id === selectedWarehouseId.value)) {
      selectedWarehouseId.value = 'all'
    }
  } catch (err) {
    console.error('Error loading warehouses', err)
  }
}

const loadLines = async () => {
  lineOptions.value = []
  if (!hasBranch.value) return
  try {
    const resp = await stockService.getLines(Number(selectedBranchId.value))
    lineOptions.value = Array.isArray(resp?.lines) ? resp.lines : []
  } catch (err) {
    console.error('Error loading lines', err)
    lineOptions.value = []
  }
}

const normalizeItems = (raw: any[]): typeof items.value => {
  // Usar el almacén seleccionado como fallback cuando el item no trae campo almacen
  const fallbackWarehouseId =
    selectedWarehouseId.value !== 'all' ? Number(selectedWarehouseId.value) : (enabledWarehouses.value[0]?.id ?? 1)
  return raw.map((it: any) => {
    const warehouseId = Number(it.almacen ?? it.warehouse_id ?? it.almacen_id ?? fallbackWarehouseId)
    return {
      code: it.codigo ?? it.item_code ?? it.Clave_Articulo ?? '',
      description: it.descripcion ?? it.description ?? '',
      line: it.linea ?? it.line ?? '',
      unit: it.unidad ?? it.unit ?? '',
      stock: Number(it.existencia ?? it.stock ?? 0) || 0,
      warehouseId,
      warehouseName: warehouses.value.find((w) => w.id === warehouseId)?.name ?? `Almacén ${warehouseId}`,
      lastCount: it.last_counted_at ?? it.ultimo_conteo ?? undefined,
      folio: it.folio ?? undefined
    }
  }).filter((r) => r.code)
}

const loadHistory = async (codes: string[]) => {
  if (!codes.length || !hasBranch.value) return {}
  try {
    const resp: any = await countsService.getItemsHistory({
      branch_id: Number(selectedBranchId.value),
      item_codes: codes,
      from: filters.dateFrom || '2000-01-01',
      to: filters.dateTo || new Date().toISOString().slice(0, 10),
      almacen: selectedWarehouseId.value === 'all' ? undefined : Number(selectedWarehouseId.value)
    })
    const map: Record<string, { last_counted_at: string; folio?: string }> = {}
    if (Array.isArray(resp?.items)) {
      for (const r of resp.items) {
        if (r?.item_code) map[String(r.item_code)] = { last_counted_at: r.last_counted_at, folio: r.folio }
      }
    }
    return map
  } catch (err) {
    console.error('Error loading history', err)
    return {}
  }
}

const loadItems = async () => {
  if (!hasBranch.value) return
  try {
    loading.value = true
    error.value = ''
    const branchId = Number(selectedBranchId.value)
    const lineaParam = filters.line === EMPTY_LINE_VALUE ? EMPTY_LINE_VALUE : filters.line || undefined
    const hasSearchFilter = Boolean(filters.search?.trim()) || Boolean(lineaParam)
    const effectiveLimit = hasSearchFilter ? 0 : filters.limit
    let warehouseParam: number
    if (selectedWarehouseId.value === 'all') {
      const firstEnabled = enabledWarehouses.value[0]
      warehouseParam = firstEnabled ? firstEnabled.id : 1
    } else {
      warehouseParam = Number(selectedWarehouseId.value)
    }

    const inputCodes = parseCodes()
    let normalized: typeof items.value = []

    if (inputCodes.length > 0) {
      const rows: typeof items.value = []
      for (const code of inputCodes) {
        try {
          const resp = await stockService.getItemWarehousesStock(branchId, code)
          const whList = Array.isArray(resp?.warehouses) ? resp.warehouses : []
          for (const wh of whList) {
            const whId = Number((wh as any).warehouse_id ?? (wh as any).id ?? (wh as any).almacen ?? (wh as any).almacen_id ?? 1)
            // Filtrar por almacén seleccionado y habilitado
            const whEnabled = enabledWarehouses.value.find((w) => w.id === whId)
            if (!whEnabled || whEnabled.habilitado === 0) continue
            if (selectedWarehouseId.value !== 'all' && whId !== warehouseParam) continue
            rows.push({
              code: resp.item_code ?? code,
              description: resp.item_description ?? '',
              line: resp.item_line ?? '',
              unit: resp.item_unit ?? '',
              stock: Number(wh.stock ?? 0) || 0,
              warehouseId: whId,
              warehouseName: wh.warehouse_name ?? whEnabled.name ?? `Almacén ${whId}`,
              lastCount: undefined,
              folio: undefined
            })
          }
        } catch (err) {
          console.error('Error loading code', code, err)
        }
      }
      normalized = rows
    } else {
      const resp = await stockService.searchItems(branchId, filters.search || undefined, lineaParam, effectiveLimit, 0, warehouseParam)
      const rawList = Array.isArray(resp?.items) ? resp.items : Array.isArray(resp) ? resp : []
      normalized = normalizeItems(rawList)
    }

    const codes = normalized.map((i) => i.code)
    const history = await loadHistory(codes)
    items.value = normalized.map((it) => ({
      ...it,
      lastCount: history[it.code]?.last_counted_at ?? it.lastCount,
      folio: history[it.code]?.folio ?? it.folio
    }))
  } catch (err: any) {
    console.error('Error loading items', err)
    const msg = err?.response?.data?.error
    error.value = typeof msg === 'string' ? msg : 'No se pudieron cargar los artículos'
  } finally {
    loading.value = false
  }
}

const scheduleLoad = () => {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => loadItems(), 350)
}

const resetFilters = () => {
  filters.search = ''
  filters.line = ''
  filters.limit = 80
  filters.dateFrom = ''
  filters.dateTo = ''
  codesText.value = ''
  loadItems()
}

const hideLineDropdownDelayed = () => {
  window.setTimeout(() => {
    showLineDropdown.value = false
  }, 120)
}

const toggleSort = (key: SortKey) => {
  if (sortState.value.key === key) {
    sortState.value.dir = sortState.value.dir === 'asc' ? 'desc' : 'asc'
  } else {
    sortState.value = { key, dir: 'asc' }
  }
}

const isSortActive = (key: SortKey, dir: 'asc' | 'desc') => sortState.value.key === key && sortState.value.dir === dir

const updateLayoutFlags = () => {
  isCompactScreen.value = window.innerWidth < 900
  filtersOpen.value = !isCompactScreen.value
}

const onBranchChange = async () => {
  saveSelections()
  await loadWarehouses()
  await loadItems()
}

const onWarehouseChange = async () => {
  saveSelections()
  await loadItems()
}

const openQuickCount = async (itemCode: string, warehouseId: number) => {
  const { value: formValues } = await Swal.fire({
    title: 'Crear conteo rápido',
    html: `
      <div style="text-align: left; margin-bottom: 1rem;">
        <p style="margin: 0.5rem 0;"><strong>Artículo:</strong> ${itemCode}</p>
        <p style="margin: 0.5rem 0;"><strong>Almacén:</strong> ${warehouses.value.find(w => w.id === warehouseId)?.name || warehouseId}</p>
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.75rem; text-align: left;">
        <label style="display: flex; flex-direction: column; gap: 0.25rem;">
          <span style="font-weight: 600;">Responsable:</span>
          <select id="swal-user" class="swal2-input" style="margin: 0; width: 100%;">
            <option value="">Selecciona un usuario</option>
            ${users.value.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
          </select>
        </label>
        <label style="display: flex; flex-direction: column; gap: 0.25rem;">
          <span style="font-weight: 600;">Clasificación:</span>
          <select id="swal-classification" class="swal2-input" style="margin: 0; width: 100%;">
            <option value="inventario">Inventario</option>
            <option value="ajuste">Ajuste</option>
            <option value="auditoria">Auditoría</option>
          </select>
        </label>
        <label style="display: flex; flex-direction: column; gap: 0.25rem;">
          <span style="font-weight: 600;">Prioridad:</span>
          <select id="swal-priority" class="swal2-input" style="margin: 0; width: 100%;">
            <option value="baja">Baja</option>
            <option value="media" selected>Media</option>
            <option value="alta">Alta</option>
          </select>
        </label>
        <label style="display: flex; flex-direction: column; gap: 0.25rem;">
          <span style="font-weight: 600;">Notas (opcional):</span>
          <textarea id="swal-notes" class="swal2-textarea" style="margin: 0; width: 100%; min-height: 60px;" placeholder="Observaciones..."></textarea>
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Crear conteo',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const userId = (document.getElementById('swal-user') as HTMLSelectElement).value
      const classification = (document.getElementById('swal-classification') as HTMLSelectElement).value
      const priority = (document.getElementById('swal-priority') as HTMLSelectElement).value
      const notes = (document.getElementById('swal-notes') as HTMLTextAreaElement).value

      if (!userId) {
        Swal.showValidationMessage('Por favor selecciona un responsable')
        return false
      }

      return { userId, classification, priority, notes }
    }
  })

  if (formValues) {
    try {
      const response: any = await countsService.create({
        branch_id: Number(selectedBranchId.value),
        almacen: warehouseId,
        type: 'ciclico',
        classification: formValues.classification as any,
        priority: formValues.priority as any,
        responsible_user_id: Number(formValues.userId),
        notes: formValues.notes || undefined,
        tolerance_percentage: 5,
        items: [itemCode]
      })

      const counts = response.counts || []
      const folios = response.folios || counts.map((c: any) => c.folio)

      if (counts.length > 0) {
        await Swal.fire({
          icon: 'success',
          title: '¡Conteo creado!',
          text: `Folio: ${folios[0]}`,
          timer: 2500,
          showConfirmButton: false
        })
      }
    } catch (err: any) {
      console.error('Error creating quick count', err)
      const errorMessage = err.response?.data?.error || err.message
      const formattedMessage = errorMessage.replace(/\n/g, '<br>')
      
      Swal.fire({
        icon: 'error',
        title: 'Error al crear conteo',
        html: formattedMessage,
        confirmButtonText: 'Cerrar'
      })
    }
  }
}

onMounted(async () => {
  restoreSelections()
  updateLayoutFlags()
  resizeHandler = () => updateLayoutFlags()
  window.addEventListener('resize', resizeHandler)
  await loadBranches()
  await loadUsers()
  await loadWarehouses()
  await loadLines()
  await loadItems()
})

onBeforeUnmount(() => {
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  if (searchTimer) window.clearTimeout(searchTimer)
})

watch(() => selectedBranchId.value, () => {
  loadWarehouses()
})
</script>

<template>
  <section class="panel wide warehouses-view">
    <div class="warehouses-top">
      <div class="panel-header">
        <div class="panel-title">
          <MobileMenuToggle />
          <div class="panel-title-text">
            <p class="eyebrow">Inventario</p>
            <h2>Almacenes</h2>
            <p class="muted">Existencia por almacén y última vez que se contó cada artículo.</p>
          </div>
        </div>
        <div class="header-actions">
          <div class="segmented">
            <button :class="['segmented-btn', viewMode === 'compare' && 'active']" @click="viewMode = 'compare'">Comparativa</button>
            <button :class="['segmented-btn', viewMode === 'detail' && 'active']" @click="viewMode = 'detail'">Detalle</button>
          </div>
          <span class="tag count">{{ displayCount }} registros</span>
        </div>
      </div>

      <details class="filters-card" :open="filtersOpen">
        <summary class="filters-summary">
          <span>Filtros</span>
          <span class="muted">Toca para mostrar/ocultar</span>
        </summary>
        <div class="filters-body">
          <div class="filters-grid">
            <label class="field">
              <span class="label">Sucursal</span>
              <select v-model="selectedBranchId" @change="onBranchChange">
                <option v-for="branch in connectedBranches" :key="branch.id" :value="branch.id">{{ branch.name }}</option>
              </select>
            </label>
            <label class="field">
              <span class="label">Almacén</span>
              <select v-model="selectedWarehouseId" @change="onWarehouseChange">
                <option value="all">Todos</option>
                <option v-for="w in enabledWarehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
              </select>
            </label>
            <label class="field">
              <span class="label">Buscar</span>
              <input v-model="filters.search" type="text" placeholder="Código o descripción" @input="scheduleLoad" />
            </label>
            <label class="field line-field" @focusin="showLineDropdown = true" @focusout="hideLineDropdownDelayed">
              <span class="label">Línea / familia</span>
              <input v-model="filters.line" type="text" placeholder="Escribe o elige" @input="showLineDropdown = true" />
              <ul v-if="showLineDropdown" class="line-dropdown">
                <li v-for="opt in filteredLineOptions" :key="opt.value" @mousedown.prevent="filters.line = opt.value">{{ opt.label }}</li>
              </ul>
            </label>
            <label class="field">
              <span class="label">Límite</span>
              <input v-model.number="filters.limit" type="number" min="10" step="10" />
            </label>
            <label class="field">
              <span class="label">Desde</span>
              <input v-model="filters.dateFrom" type="date" />
            </label>
            <label class="field">
              <span class="label">Hasta</span>
              <input v-model="filters.dateTo" type="date" />
            </label>
          </div>

          <details class="codes-panel">
            <summary> Códigos (uno por línea, coma o espacio) </summary>
            <textarea v-model="codesText" rows="2" placeholder="Ingresa los códigos a buscar"></textarea>
          </details>

          <div class="filter-actions">
            <button class="btn primary" @click="loadItems" :disabled="loading">Buscar</button>
            <button class="btn ghost" @click="resetFilters" :disabled="loading">Limpiar</button>
          </div>
        </div>
      </details>
    </div>

    <div class="warehouses-table">
      <div v-if="error" class="alert error">{{ error }}</div>
      <div v-else-if="loading" class="alert muted">Cargando...</div>

      <div v-if="viewMode === 'detail'" class="table-scroll">
        <table class="table-card">
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
                  <span>Descripción</span>
                  <div class="sort">
                    <button :class="{ active: isSortActive('description', 'asc') }" @click="toggleSort('description')">▲</button>
                    <button :class="{ active: isSortActive('description', 'desc') }" @click="toggleSort('description')">▼</button>
                  </div>
                </div>
              </th>
              <th> Línea </th>
              <th> Unidad </th>
              <th>
                <div class="th-inner">
                  <span>Existencia</span>
                  <div class="sort">
                    <button :class="{ active: isSortActive('stock', 'asc') }" @click="toggleSort('stock')">▲</button>
                    <button :class="{ active: isSortActive('stock', 'desc') }" @click="toggleSort('stock')">▼</button>
                  </div>
                </div>
              </th>
              <th> Almacén </th>
              <th>
                <div class="th-inner">
                  <span>Último conteo</span>
                  <div class="sort">
                    <button :class="{ active: isSortActive('lastCount', 'asc') }" @click="toggleSort('lastCount')">▲</button>
                    <button :class="{ active: isSortActive('lastCount', 'desc') }" @click="toggleSort('lastCount')">▼</button>
                  </div>
                </div>
              </th>
              <th> Folio </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in tableRows" :key="row.code + '-' + row.warehouseId" class="clickable-row" @click="openQuickCount(row.code, row.warehouseId)">
              <td>{{ row.code }}</td>
              <td>{{ row.description }}</td>
              <td>{{ row.line || '—' }}</td>
              <td>{{ row.unit || '—' }}</td>
              <td class="num">{{ row.stock }}</td>
              <td>{{ row.warehouseName }}</td>
              <td>{{ formatDate(row.lastCount) }}</td>
              <td>{{ row.folio || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="table-scroll">
        <table class="table-card">
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
              <th>Descripción</th>
              <th>Unidad</th>
              <th>Último conteo</th>
              <th>Folio</th>
              <th v-for="wh in warehouseColumns" :key="wh.id" class="num">
                <div class="th-inner">
                  <span>{{ wh.label }}</span>
                  <div class="sort">
                    <button :class="{ active: isSortActive(`wh-${wh.id}` as SortKey, 'asc') }" @click="toggleSort(`wh-${wh.id}` as SortKey)">▲</button>
                    <button :class="{ active: isSortActive(`wh-${wh.id}` as SortKey, 'desc') }" @click="toggleSort(`wh-${wh.id}` as SortKey)">▼</button>
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in comparisonRows" :key="row.code" class="clickable-row" @click="openQuickCount(row.code, enabledWarehouses[0]?.id || 1)">
              <td>{{ row.code }}</td>
              <td>{{ row.description }}</td>
              <td>{{ row.unit || '—' }}</td>
              <td>{{ formatDate(row.lastCount) }}</td>
              <td>{{ row.folio || '—' }}</td>
              <td v-for="wh in warehouseColumns" :key="wh.id" class="num">{{ row.warehouses[wh.id] ?? 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.warehouses-view {
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 100dvh;
}

.warehouses-top {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}


.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.segmented {
  display: inline-flex;
  background: #f1f4ff;
  border-radius: 999px;
  padding: 4px;
  gap: 4px;
}

.segmented-btn {
  border: none;
  background: transparent;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  color: #1d2a5b;
  font-weight: 600;
}

.segmented-btn.active {
  background: #2e63f6;
  color: #fff;
  box-shadow: 0 6px 18px rgba(46, 99, 246, 0.25);
}

.tag.count {
  background: #f1f4ff;
  color: #2e63f6;
  padding: 6px 10px;
  border-radius: 12px;
  font-weight: 700;
}

.filters-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 0.35rem 0.5rem 0.75rem;
}

.filters-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  list-style: none;
  font-weight: 600;
  padding: 0.25rem 0.15rem;
}

.filters-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 0.85rem;
  color: #4b5563;
}

input, select, textarea {
  width: 100%;
  border: 1px solid #d8dce7;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 0.95rem;
  background: #fff;
}

textarea {
  min-height: 70px;
}

.line-field {
  position: relative;
}

.line-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  max-height: 180px;
  overflow-y: auto;
  z-index: 5;
}

.line-dropdown li {
  padding: 8px 10px;
  cursor: pointer;
}

.line-dropdown li:hover {
  background: #f1f5f9;
}

.codes-panel {
  background: #f8f9fb;
  border: 1px dashed #d5d7de;
  border-radius: 12px;
  padding: 0.35rem 0.5rem;
}

.codes-panel summary {
  cursor: pointer;
  font-weight: 600;
  list-style: none;
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn {
  border: none;
  border-radius: 12px;
  padding: 10px 14px;
  cursor: pointer;
  font-weight: 700;
}

.btn.primary {
  background: #2e63f6;
  color: #fff;
  box-shadow: 0 6px 18px rgba(46, 99, 246, 0.25);
}

.btn.primary:hover {
  background: #2453d8;
  box-shadow: 0 10px 22px rgba(46, 99, 246, 0.3);
}

.btn.ghost {
  background: #f1f5f9;
  color: #1f2937;
}

.btn.ghost:hover {
  background: #e8eef6;
  color: #1d4ed8;
}

.warehouses-table {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 0.75rem;
  max-width: 100%;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

.table-scroll {
  width: 100%;
  overflow: auto;
  max-width: 100%;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  max-height: 60vh;
}

.table-card {
  width: 100%;
  min-width: 100%;
  border-collapse: collapse;
}

table th, table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #eceff4;
  white-space: nowrap;
}

.num {
  text-align: right;
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
  color: #2e63f6;
}

.alert {
  margin: 0.35rem 0;
  padding: 10px 12px;
  border-radius: 10px;
}

.alert.error {
  background: #fee2e2;
  color: #991b1b;
}

.alert.muted {
  background: #f1f5f9;
  color: #475569;
}

.clickable-row {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.clickable-row:hover {
  background-color: #f0f7ff;
}

@media (max-width: 900px) {
  .warehouses-view {
    min-height: 100%;
    height: 100%;
    flex: 1;
    box-sizing: border-box;
  }
  .warehouses-top {
    position: sticky;
    top: 0;
    z-index: 5;
    background: var(--panel);
    padding-bottom: 0.5rem;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  }
  .table-scroll {
    max-height: none;
    height: 100%;
  }
  .table-card {
    width: max-content;
    min-width: 100%;
  }
  .filters-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .panel-header {
    flex-direction: column;
  }
  .filters-grid {
    grid-template-columns: 1fr;
  }
  .filters-card {
    padding: 0.35rem 0.35rem 0.6rem;
  }
  .warehouses-table {
    padding: 0.5rem;
  }
}
</style>
