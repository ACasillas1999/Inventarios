<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { branchesService, stockService, type Branch } from '@/services/api'
import MobileMenuToggle from '@/components/MobileMenuToggle.vue'


type ItemRow = {
  code: string
  description: string
  line?: string
  unit?: string
  stock?: number
  rack?: string
  almacen?: string
  invMin?: number
  invMax?: number
  existenciaTeorica?: number
  existenciaFisica?: number
  costoPromedio?: number
  costoPromedioAnt?: number
  costoUltCompra?: number
  fechaUltCompra?: string
  costoCompraAnt?: number
  fechaCompraAnt?: string
  pendienteEntrega?: number
}
type ItemSortKey = 'code' | 'description' | 'line' | 'unit' | 'stock' | 'almacen'

const branches = ref<Branch[]>([])
const connectedBranches = computed(() => branches.value.filter(b => b.status === 'connected'))
const selectedBranchId = ref<number | ''>('')
const items = ref<ItemRow[]>([])
const lineOptions = ref<string[]>([])
const loading = ref(false)
const error = ref('')
const EMPTY_LINE_VALUE = '__EMPTY__'
const showLineDropdown = ref(false)
const BRANCH_STORAGE_KEY = 'items_selected_branch_id'
let searchDebounceTimer: number | undefined
const isMobile = ref(false)
const filtersOpen = ref(true)
const sortState = ref<{ key: ItemSortKey; dir: 'asc' | 'desc' }>({ key: 'code', dir: 'asc' })

const lineOptionsComputed = computed(() => {
  const opts = [{ value: EMPTY_LINE_VALUE, label: 'Sin línea' }]
  const seen = new Set<string>()
  for (const line of lineOptions.value) {
    const val = line ?? ''
    if (!val || seen.has(val)) continue
    seen.add(val)
    opts.push({ value: val, label: val })
  }
  return opts
})

const filteredLineOptions = computed(() => {
  const q = (filters.line || '').toString().toLowerCase()
  if (!q) return lineOptionsComputed.value
  return lineOptionsComputed.value.filter((opt) => opt.label.toLowerCase().includes(q))
})

const filters = reactive({
  search: '',
  line: '',
  limit: 50,
})

const hasBranchSelected = computed(() => selectedBranchId.value !== '')

const toggleSort = (key: ItemSortKey) => {
  if (sortState.value.key === key) {
    sortState.value.dir = sortState.value.dir === 'asc' ? 'desc' : 'asc'
  } else {
    sortState.value = { key, dir: 'asc' }
  }
}

const isSortActive = (key: ItemSortKey, dir: 'asc' | 'desc') =>
  sortState.value.key === key && sortState.value.dir === dir

const sortedItems = computed(() => {
  const list = [...items.value]
  const { key, dir } = sortState.value
  list.sort((a, b) => {
    const getValue = (item: ItemRow) => {
      if (key === 'code') return item.code || ''
      if (key === 'description') return item.description || ''
      if (key === 'line') return item.line || ''
      if (key === 'unit') return item.unit || ''
      if (key === 'stock') return Number(item.stock ?? -Infinity)
      if (key === 'almacen') return item.almacen || ''
      return ''
    }
    const va = getValue(a)
    const vb = getValue(b)
    if (typeof va === 'number' && typeof vb === 'number') return dir === 'asc' ? va - vb : vb - va
    return dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
  })
  return list
})

const normalizeItems = (payload: unknown): ItemRow[] => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { items?: unknown })?.items)
      ? ((payload as { items?: unknown[] }).items as unknown[])
      : []

  return list.map((raw) => {
    const item = raw as Record<string, unknown>
    return {
      code: (item.codigo as string) || (item.item_code as string) || (item.Clave_Articulo as string) || '',
      description: (item.descripcion as string) || (item.Almacen as string) || (item.description as string) || '',
      line: (item.linea as string) || '',
      unit: (item.unidad as string) || (item.unit as string) || '',
      stock: (item.existencia as number) ?? (item.stock as number) ?? undefined,
      rack: (item.Rack as string) || (item.rack as string) || '',
      almacen: (item.almacen as string) || (item.Almacen as string) || '',
      invMin: (item.inventario_minimo as number) ?? (item.Inventario_Minimo as number),
      invMax: (item.inventario_maximo as number) ?? (item.Inventario_Maximo as number),
      existenciaTeorica: (item.existencia_teorica as number) ?? (item.Existencia_Teorica as number),
      existenciaFisica:
        (item.existencia_fisica as number) ?? (item.Existencia_Fisica as number) ?? (item.existencia as number) ?? (item.stock as number),
      costoPromedio: (item.costo_promedio as number) ?? (item.Costo_Promedio as number),
      costoPromedioAnt: (item.costo_promedio_ant as number) ?? (item.Costo_Promedio_Ant as number),
      costoUltCompra: (item.costo_ultima_compra as number) ?? (item.Costo_Ult_Compra as number),
      fechaUltCompra: (item.fecha_ult_compra as string) ?? (item.Fecha_Ult_Compra as string),
      costoCompraAnt: (item.costo_compra_ant as number) ?? (item.Costo_Compra_Ant as number),
      fechaCompraAnt: (item.fecha_compra_ant as string) ?? (item.Fecha_Compra_Ant as string),
      pendienteEntrega: (item.pendiente_entrega as number) ?? (item.PendientedeEntrega as number),
    }
  })
}

const loadBranches = async () => {
  try {
    const data = await branchesService.getAll()
    branches.value = Array.isArray(data) ? data : []
    if (selectedBranchId.value !== '' && !branches.value.some((b) => b.id === selectedBranchId.value)) {
      selectedBranchId.value = ''
    }
    if (branches.value.length > 0 && selectedBranchId.value === '') {
      const first = branches.value[0]
      selectedBranchId.value = first?.id ?? ''
    }
    if (hasBranchSelected.value) {
      await loadLines()
    }
  } catch (err: unknown) {
    console.error('Error loading branches', err)
  }
}

const loadLines = async () => {
  if (!hasBranchSelected.value) return
  try {
    const branchId = Number(selectedBranchId.value)
    const response = await stockService.getLines(branchId)
    const lines = Array.isArray(response?.lines) ? response.lines : []
    // Deduplicar; las líneas vacías se manejan con el sentinel
    const unique = Array.from(new Set(lines.filter((l) => l !== null && l !== undefined && l !== '')))
    lineOptions.value = unique
  } catch (err: unknown) {
    console.error('Error loading lines', err)
    lineOptions.value = []
  }
}

const loadItems = async () => {
  if (!hasBranchSelected.value) {
    error.value = 'Selecciona una sucursal para consultar artículos'
    return
  }

  try {
    loading.value = true
    error.value = ''
    const branchId = Number(selectedBranchId.value)
    const lineParam =
      filters.line === EMPTY_LINE_VALUE ? EMPTY_LINE_VALUE : filters.line || undefined
    const hasSearchFilter = Boolean(filters.search?.trim()) || Boolean(lineParam)
    const effectiveLimit = hasSearchFilter ? 0 : filters.limit
    const response = await stockService.searchItems(
      branchId,
      filters.search || undefined,
      lineParam,
      effectiveLimit,
      0
    )
    items.value = normalizeItems(response)
  } catch (err: unknown) {
    console.error('Error loading items', err)
    const apiMessage = (err as any)?.response?.data?.error
    const status = (err as any)?.response?.status
    error.value =
      typeof apiMessage === 'string' && apiMessage.length > 0
        ? apiMessage
        : typeof status === 'number'
          ? `No se pudieron cargar los artículos (HTTP ${status})`
          : 'No se pudieron cargar los artículos'
  } finally {
    loading.value = false
  }
}

const scheduleLoadItems = () => {
  if (searchDebounceTimer) {
    window.clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = window.setTimeout(() => {
    loadItems()
  }, 350)
}

const resetFilters = () => {
  Object.assign(filters, { search: '', line: '', limit: 50 })
  loadItems()
}

const onLineInput = () => {
  showLineDropdown.value = true
}

const selectLine = async (value: string) => {
  filters.line = value
  showLineDropdown.value = false
  await loadItems()
}

const onLineFocus = () => {
  showLineDropdown.value = true
}

const onLineBlur = () => {
  setTimeout(() => {
    showLineDropdown.value = false
  }, 120)
}

const onBranchChange = async () => {
  if (selectedBranchId.value !== '') {
    localStorage.setItem(BRANCH_STORAGE_KEY, String(selectedBranchId.value))
  }
  await loadLines()
  await loadItems()
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

onMounted(async () => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  const storedBranchId = localStorage.getItem(BRANCH_STORAGE_KEY)
  if (storedBranchId) {
    const parsed = Number(storedBranchId)
    if (!Number.isNaN(parsed)) {
      selectedBranchId.value = parsed
    }
  }
  await loadBranches()
  await loadLines()
  await loadItems()
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('resize', updateIsMobile)
})
</script>

<template>
  <section class="panel wide">
    <div class="panel-header">
      <div class="panel-title">
        <MobileMenuToggle />
        <div class="panel-title-text">
          <p class="eyebrow">Catálogo</p>
          <h2>Artículos</h2>
          <p class="muted">
            Consulta artículos por sucursal directamente desde las bases de las tiendas.
          </p>
        </div>
      </div>
      <span class="tag accent">Sync maestro</span>
    </div>

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

    <div v-show="!isMobile || filtersOpen" class="form-grid" style="margin-bottom: 0.6rem">
      <div>
        <label for="branch">Sucursal</label>
        <select id="branch" v-model="selectedBranchId" @change="onBranchChange">
          <option value="">Selecciona</option>
          <option v-for="branch in connectedBranches" :key="branch.id ?? branch.code" :value="branch.id">
            {{ branch.name }}
          </option>
        </select>
      </div>
      <div>
        <label for="search">Buscar</label>
        <input
          id="search"
          v-model="filters.search"
          placeholder="Código o descripción"
          @input="scheduleLoadItems"
          @keyup.enter="loadItems"
        />
      </div>
      <div>
        <label for="line">Línea / familia</label>
        <div class="line-select">
          <input
            id="line"
            v-model="filters.line"
            placeholder="Escribe o elige"
            class="select-like"
            @focus="onLineFocus"
            @input="onLineInput"
            @blur="onLineBlur"
            @keyup.enter="loadItems"
          />
          <ul v-if="showLineDropdown && filteredLineOptions.length" class="line-dropdown">
            <li
              v-for="opt in filteredLineOptions"
              :key="opt.value || 'empty-line'"
              @mousedown.prevent="selectLine(opt.value)"
            >
              {{ opt.label }}
            </li>
          </ul>
        </div>
      </div>
      <div>
        <label for="limit">Límite</label>
        <input
          id="limit"
          v-model.number="filters.limit"
          type="number"
          min="1"
          max="200"
          @change="loadItems"
        />
      </div>
      <div class="actions filter-actions">
        <button class="btn" @click="loadItems">Buscar</button>
        <button class="btn ghost" @click="resetFilters">Limpiar</button>
      </div>
    </div>

    <div v-if="loading" class="muted" style="padding: 1rem">Buscando artículos...</div>
    <div v-else-if="error" class="error-message panel">
      <p>{{ error }}</p>
      <button class="btn" @click="loadItems">Reintentar</button>
    </div>
    <div v-else class="table-card">
      <div class="table-scroll">
        <table class="table">
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
              <th>
                <div class="th-inner">
                  <span>Línea</span>
                  <div class="sort">
                    <button :class="{ active: isSortActive('line', 'asc') }" @click="toggleSort('line')">▲</button>
                    <button :class="{ active: isSortActive('line', 'desc') }" @click="toggleSort('line')">▼</button>
                  </div>
                </div>
              </th>
              <th>
                <div class="th-inner">
                  <span>Unidad</span>
                  <div class="sort">
                    <button :class="{ active: isSortActive('unit', 'asc') }" @click="toggleSort('unit')">▲</button>
                    <button :class="{ active: isSortActive('unit', 'desc') }" @click="toggleSort('unit')">▼</button>
                  </div>
                </div>
              </th>
              <th>
                <div class="th-inner">
                  <span>Existencia</span>
                  <div class="sort">
                    <button :class="{ active: isSortActive('stock', 'asc') }" @click="toggleSort('stock')">▲</button>
                    <button :class="{ active: isSortActive('stock', 'desc') }" @click="toggleSort('stock')">▼</button>
                  </div>
                </div>
              </th>
              <th>
                <div class="th-inner">
                  <span>Almacén</span>
                  <div class="sort">
                    <button :class="{ active: isSortActive('almacen', 'asc') }" @click="toggleSort('almacen')">▲</button>
                    <button :class="{ active: isSortActive('almacen', 'desc') }" @click="toggleSort('almacen')">▼</button>
                  </div>
                </div>
              </th>
              <th>Inv. mín</th>
              <th>Inv. máx</th>
              <th>Exis. teórica</th>
              <th>Exis. física</th>
              <th>Rack</th>
              <th>Costo prom.</th>
              <th>Costo prom. ant.</th>
              <th>Costo última compra</th>
              <th>Fecha última compra</th>
              <th>Costo compra ant.</th>
              <th>Fecha compra ant.</th>
              <th>Pendiente entrega</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in sortedItems" :key="item.code">
              <td><strong>{{ item.code }}</strong></td>
              <td>{{ item.description }}</td>
              <td>{{ item.line || '-' }}</td>
              <td>{{ item.unit || '-' }}</td>
              <td>{{ item.stock ?? '-' }}</td>
              <td>{{ item.almacen || '-' }}</td>
              <td>{{ item.invMin ?? '-' }}</td>
              <td>{{ item.invMax ?? '-' }}</td>
              <td>{{ item.existenciaTeorica ?? '-' }}</td>
              <td>{{ item.existenciaFisica ?? '-' }}</td>
              <td>{{ item.rack || '-' }}</td>
              <td>{{ item.costoPromedio ?? '-' }}</td>
              <td>{{ item.costoPromedioAnt ?? '-' }}</td>
              <td>{{ item.costoUltCompra ?? '-' }}</td>
              <td>{{ item.fechaUltCompra || '-' }}</td>
              <td>{{ item.costoCompraAnt ?? '-' }}</td>
              <td>{{ item.fechaCompraAnt || '-' }}</td>
              <td>{{ item.pendienteEntrega ?? '-' }}</td>
            </tr>
            <tr v-if="sortedItems.length === 0">
              <td colspan="18" class="muted" style="text-align: center; padding: 1rem">
                Sin resultados
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
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

.actions {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
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

.filter-actions .btn {
  min-width: 118px;
  justify-content: center;
  height: 44px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #fff;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.18);
  letter-spacing: 0.01em;
  transition: transform 120ms ease, box-shadow 120ms ease, background 160ms ease;
}

.filter-actions .btn.ghost {
  background: #f8fafc;
  color: #1f2937;
  border: 1px solid #e5e7eb;
  box-shadow: none;
}

.filter-actions .btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 30px rgba(37, 99, 235, 0.24);
}

.filter-actions .btn.ghost:hover {
  background: #eef2ff;
  color: #1d4ed8;
  border-color: #c7d2fe;
  box-shadow: 0 6px 14px rgba(59, 130, 246, 0.12);
}

.filter-actions .btn:active {
  transform: translateY(0);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.18);
}

.select-like {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border-color, #d0d7de);
  border-radius: 8px;
  background: var(--surface-color, #fff);
  font: inherit;
  appearance: none;
  -webkit-appearance: none;
}

.select-like:focus {
  outline: 2px solid var(--primary-color, #2563eb);
  outline-offset: 1px;
}

.line-select {
  position: relative;
  width: 100%;
}

.line-dropdown {
  position: absolute;
  z-index: 10;
  margin-top: 0.15rem;
  width: 100%;
  background: var(--surface-color, #fff);
  border: 1px solid var(--border-color, #d0d7de);
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
  max-height: 220px;
  overflow-y: auto;
  list-style: none;
  padding: 0.25rem 0;
}

.line-dropdown li {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background 120ms ease;
}

.line-dropdown li:hover {
  background: rgba(37, 99, 235, 0.08);
}

.table-card {
  margin-top: 0.5rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  background: var(--surface-color, #fff);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  width: 100%;
  margin: 0;
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
}

.table-scroll .table {
  min-width: 100%;
}

@media (max-width: 1024px) {
  .filters-header {
    display: block;
  }
}
</style>
