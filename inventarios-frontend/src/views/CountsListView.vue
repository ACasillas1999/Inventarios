<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { branchesService, countsService, stockService, usersService, specialLinesService, type Branch, type Count } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useRoute, useRouter } from 'vue-router'
import MobileMenuToggle from '@/components/MobileMenuToggle.vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventInput } from '@fullcalendar/core'
import esLocale from '@fullcalendar/core/locales/es'
import { useSocketStore } from '@/stores/socket'
import Swal from 'sweetalert2'

const authStore = useAuthStore()
const socketStore = useSocketStore()
const route = useRoute()
const router = useRouter()

const EMPTY_LINE_VALUE = '__EMPTY__'

const branches = ref<Branch[]>([])
const connectedBranches = computed(() => branches.value.filter(b => b.status === 'connected'))
const counts = ref<Count[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')

// Pagination state
const page = ref(1)
const limit = ref(25)
const totalPages = computed(() => Math.ceil(total.value / limit.value))

const socketCleanups: Array<() => void> = []
const showNewCountModal = ref(false)
const users = ref<any[]>([])
const modalWarehouses = ref<Array<{ almacen: number; nombre?: string }>>([])
const modalWarehouse = ref<number>(1) // Por defecto Almacén 1 (sucursal principal)
const modalLines = ref<string[]>([])
const modalLine = ref('') // valor seleccionado (usa '__EMPTY__' para "Sin línea")
const modalLineInput = ref('') // texto que escribe el usuario
const showModalLineDropdown = ref(false)
const modalItems = ref<Array<{ codigo: string; descripcion: string; existencia?: number; almacen?: string }>>([])
const modalItemsLoading = ref(false)
const modalItemsError = ref('')
const modalItemSearch = ref('')
const selectedItemCodes = ref<Set<string>>(new Set())
const selectAllFromLine = ref(false)
const totalItemsInLine = ref(0) // Total de artículos cuando se usa "Todos"
let modalSearchDebounceTimer: number | undefined
const excludeAlreadyCounted = ref(false)
const modalHistory = ref<Record<string, { last_counted_at: string; folio?: string; count_id?: number }>>({})
const modalHistoryLoading = ref(false)
const modalHistoryError = ref('')
let modalHistoryTimer: number | undefined

const filters = reactive({
  branch_id: '',
  statuses: ['pendiente', 'contando'] as string[],
  classification: '',
  date_from: '',
  date_to: ''
})

const searchText = ref('')
const isMobile = ref(false)
const filtersOpen = ref(true)

// Special lines state
const specialLines = ref<any[]>([])
const specialLinesMap = ref(new Map<string, any>())

// Helper to check if count contains special line items (uses backend field)
const countMayHaveSpecialLines = (count: any): boolean => {
  // Use backend-provided field if available
  if (count.has_special_lines !== undefined) {
    return Boolean(count.has_special_lines)
  }
  
  // Fallback: check manually if field not available
  if (specialLinesMap.value.size === 0) return false
  
  const itemCodes: string[] = []
  
  if (count.items_data && Array.isArray(count.items_data)) {
    itemCodes.push(...count.items_data.map((item: any) => String(item.item_code || '')))
  }
  
  if (count.item_codes && Array.isArray(count.item_codes)) {
    itemCodes.push(...count.item_codes.map((code: any) => String(code || '')))
  }
  
  for (const itemCode of itemCodes) {
    if (itemCode.length >= 5) {
      const lineCode = itemCode.substring(0, 5)
      if (specialLinesMap.value.has(lineCode)) {
        return true
      }
    }
  }
  
  return false
}


type CountsViewMode = 'cards' | 'table' | 'calendar'
const viewMode = ref<CountsViewMode>('table')
const calendarMonth = ref<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

const toISODate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const monthTitle = computed(() => {
  const dtf = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })
  return dtf.format(calendarMonth.value)
})

const calendarRange = computed(() => {
  const start = new Date(calendarMonth.value.getFullYear(), calendarMonth.value.getMonth(), 1)
  const end = new Date(calendarMonth.value.getFullYear(), calendarMonth.value.getMonth() + 1, 0)
  return { start, end, from: toISODate(start), to: toISODate(end) }
})

const filteredUsers = computed(() => {
  const role = authStore.user?.role_name || ''
  if (role === 'jefe_inventarios') {
    return users.value.filter((u) => u.role_slug === 'jefe_almacen')
  }
  if (role === 'jefe_almacen') {
    return users.value.filter((u) => u.role_slug === 'surtidores')
  }
  return users.value
})

const calendarDays = computed(() => {
  const { start, end } = calendarRange.value
  // Lunes como primer día (0..6)
  const startDow = (start.getDay() + 6) % 7
  const gridStart = new Date(start)
  gridStart.setDate(start.getDate() - startDow)

  const endDow = (end.getDay() + 6) % 7
  const gridEnd = new Date(end)
  gridEnd.setDate(end.getDate() + (6 - endDow))

  const days: Array<{ date: Date; iso: string; inMonth: boolean }> = []
  const cur = new Date(gridStart)
  while (cur <= gridEnd) {
    const iso = toISODate(cur)
    days.push({
      date: new Date(cur),
      iso,
      inMonth: cur.getMonth() === start.getMonth()
    })
    cur.setDate(cur.getDate() + 1)
  }
  return days
})

// Rango del mes para el modal (usa fecha programada o mes actual)
const modalMonthRange = computed(() => {
  const base = newCountForm.scheduled_date
    ? new Date(newCountForm.scheduled_date)
    : new Date()
  const start = new Date(base.getFullYear(), base.getMonth(), 1)
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 1)
  return { from: toISODate(start), to: toISODate(end) }
})

const scheduledISO = (value: any): string | null => {
  if (!value) return null
  const raw = String(value)
  if (raw.length >= 10) return raw.slice(0, 10)
  return null
}

const countsByScheduledDay = computed(() => {
  const map = new Map<string, Count[]>()
  for (const c of counts.value) {
    const iso = scheduledISO((c as any).scheduled_date)
    if (!iso) continue
    if (!map.has(iso)) map.set(iso, [])
    map.get(iso)!.push(c)
  }
  // ordenar por folio para consistencia
  for (const [k, list] of map.entries()) {
    list.sort((a, b) => String(a.folio).localeCompare(String(b.folio)))
    map.set(k, list)
  }
  return map
})

const unscheduledCounts = computed(() => {
  return counts.value.filter((c) => !scheduledISO((c as any).scheduled_date))
})

const modalAlreadyCountedCount = computed(() => {
  return modalItems.value.filter((it) => Boolean(modalHistory.value[it.codigo])).length
})

const selectedAlreadyCounted = computed(() => {
  return Array.from(selectedItemCodes.value).filter((c) => Boolean(modalHistory.value[c])).length
})

const prevMonth = () => {
  calendarMonth.value = new Date(calendarMonth.value.getFullYear(), calendarMonth.value.getMonth() - 1, 1)
}

const nextMonth = () => {
  calendarMonth.value = new Date(calendarMonth.value.getFullYear(), calendarMonth.value.getMonth() + 1, 1)
}

const goThisMonth = () => {
  const now = new Date()
  calendarMonth.value = new Date(now.getFullYear(), now.getMonth(), 1)
}

const openNewCountModalForDate = (iso: string) => {
  openNewCountModal()
  if (filters.branch_id) newCountForm.branch_id = filters.branch_id
  newCountForm.scheduled_date = iso
}

const newCountForm = reactive({
  branch_id: '',
  almacen: '',
  type: 'ciclico',
  classification: 'inventario',
  priority: 'media',
  responsible_user_id: '',
  scheduled_date: '',
  notes: '',
  tolerance_percentage: 5
})

const statusLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  contando: 'Contando',
  contado: 'Contado',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado'
}
const statusFilterOptions = ['pendiente', 'contando', 'contado', 'cerrado', 'cancelado'] as const

const typeLabel: Record<string, string> = {
  ciclico: 'Cíclico',
  por_familia: 'Por familia',
  por_zona: 'Por zona',
  rango: 'Por rango',
  total: 'Total'
}

const classificationLabel: Record<string, string> = {
  inventario: 'Inventario',
  ajuste: 'Ajuste'
}

const almacenLabel = (almacen: number | undefined) => {
  if (!almacen || almacen === 1) return 'Sucursal'
  return `Bodega ${almacen}`
}

const statusClass = (status: string) => {
  if (status === 'pendiente') return 'closed'
  if (status === 'contando') return 'progress'
  if (status === 'contado' || status === 'cerrado') return 'open'
  if (status === 'cancelado') return 'danger'
  return 'warning'
}

const formatDate = (date: string | null) => {
  if (!date) return '-'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const normalizeCounts = (payload: any): Count[] => {
  if (!payload) return []
  if (Array.isArray(payload.counts)) return payload.counts as Count[]
  if (Array.isArray(payload)) return payload as Count[]
  return []
}

const loadBranches = async () => {
  try {
    const data = await branchesService.getAll()
    branches.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error loading branches', err)
  }
}

const loadUsers = async () => {
  try {
    const data = await usersService.getAll()
    users.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error loading users', err)
  }
}

const openNewCountModal = () => {
  showNewCountModal.value = true
}

const closeNewCountModal = () => {
  showNewCountModal.value = false
  Object.assign(newCountForm, {
    branch_id: '',
    type: 'ciclico',
    classification: 'inventario',
    priority: 'media',
    responsible_user_id: '',
    scheduled_date: '',
    notes: '',
    tolerance_percentage: 5
  })
  modalWarehouses.value = []
  modalWarehouse.value = 1
  modalLines.value = []
  modalLine.value = ''
  modalLineInput.value = ''
  modalAdjustmentQuantities.value = {}
  modalAdjustmentQuantities.value = {}


  showModalLineDropdown.value = false
  modalItems.value = []
  modalItemsError.value = ''
  modalItemSearch.value = ''
  selectedItemCodes.value = new Set()
  selectAllFromLine.value = false
  totalItemsInLine.value = 0
  excludeAlreadyCounted.value = false
  modalHistory.value = {}
  modalHistoryError.value = ''
}

const modalAdjustmentQuantities = ref<Record<string, number>>({})

const setAdjustmentQuantity = (itemCode: string, value: string) => {
  const num = Number(value)
  // Allow whatever is typed, but store as number if valid. Storing 0 is valid.
  modalAdjustmentQuantities.value[itemCode] = isNaN(num) ? 0 : num
}

const getAdjustmentQuantity = (itemCode: string) => {
  return modalAdjustmentQuantities.value[itemCode] ?? ''
}

const modalLineOptionsComputed = computed(() => {
  const opts: Array<{ value: string; label: string }> = [
    { value: '', label: 'Todas las líneas' },
    { value: EMPTY_LINE_VALUE, label: 'Sin línea' }
  ]
  const seen = new Set<string>()
  for (const line of modalLines.value) {
    const val = (line ?? '').toString()
    if (!val || val === EMPTY_LINE_VALUE || seen.has(val)) continue
    seen.add(val)
    opts.push({ value: val, label: val })
  }
  return opts
})

const filteredModalLineOptions = computed(() => {
  const q = (modalLineInput.value || '').toString().toLowerCase()
  if (!q) return modalLineOptionsComputed.value
  return modalLineOptionsComputed.value.filter((opt) => opt.label.toLowerCase().includes(q))
})

// Contador de artículos ya contados
const alreadyCountedStats = computed(() => {
  if (selectAllFromLine.value) {
    // Cuando está en modo "Todos", contar del historial completo
    const counted = Object.keys(modalHistory.value).length
    const total = totalItemsInLine.value
    return { total, counted, percentage: total > 0 ? Math.round((counted / total) * 100) : 0 }
  } else {
    // Cuando está en modo manual, contar de los visibles
    const total = modalItems.value.length
    const counted = modalItems.value.filter((it) => modalHistory.value[it.codigo]).length
    return { total, counted, percentage: total > 0 ? Math.round((counted / total) * 100) : 0 }
  }
})

const loadModalWarehouses = async () => {
  modalWarehouses.value = []
  if (!newCountForm.branch_id) return
  try {
    const branchId = Number(newCountForm.branch_id)
    // Use branchesService to match Warehouses View logic and get correct debug info
    const resp = await branchesService.getWarehouses(branchId) as any
    console.log('Warehouses response:', resp)
    
    // Soporte para nueva estructura de respuesta con debug info
    const warehousesList = Array.isArray(resp) ? resp : (resp?.warehouses || [])
    
    if (resp?.debug_info) {
      console.log('%c DEBUG INFO ', 'background: #222; color: #bada55', resp.debug_info)
      console.log(`Connected to DB: ${resp.debug_info.database} on Host: ${resp.debug_info.host}`)
    }
    
    const rawList = Array.isArray(warehousesList) ? warehousesList : []
    
    // Normalizar datos (id -> almacen, name -> nombre) igual que en WarehousesView
    modalWarehouses.value = rawList.map((w: any) => ({
      almacen: w.id ?? w.warehouse_id ?? w.almacen,
      nombre: w.name ?? w.warehouse_name ?? w.nombre
    }))
    
    // Si no hay almacenes, agregar al menos el almacén 1 por defecto
    if (modalWarehouses.value.length === 0) {
      console.warn('No warehouses found, defaulting to 1')
      modalWarehouses.value = [{ almacen: 1, nombre: 'Sucursal principal' }]
    }
  } catch (err) {
    console.error('Error loading modal warehouses', err)
    modalWarehouses.value = [{ almacen: 1, nombre: 'Sucursal principal' }]
  }
}

const loadModalLines = async () => {
  modalLines.value = []
  modalLine.value = ''
  modalLineInput.value = ''
  if (!newCountForm.branch_id) return
  try {
    const branchId = Number(newCountForm.branch_id)
    const resp = await stockService.getLines(branchId)
    modalLines.value = Array.isArray(resp?.lines) ? resp.lines : []
  } catch (err) {
    console.error('Error loading modal lines', err)
    modalLines.value = []
  }
}

const normalizeModalItems = (payload: any) => {
  const list = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : []
  return list.map((it: any) => ({
    codigo: it.codigo || it.item_code || it.Clave_Articulo || '',
    descripcion: it.descripcion || it.Descripcion || it.Almacen || '',
    existencia: it.existencia ?? it.existencia_fisica ?? it.stock ?? undefined
  })).filter((it: any) => it.codigo)
}

const loadModalItems = async () => {
  modalItems.value = []
  modalItemsError.value = ''
  if (!newCountForm.branch_id) return
  
  console.log('Loading items for warehouse:', newCountForm.almacen)
  const selectedWarehouse = Number(newCountForm.almacen)
  if (!selectedWarehouse) {
    console.warn('No warehouse selected, aborting load')
    modalItemsError.value = 'Selecciona un almacén primero'
    return
  }
  
  try {
    modalItemsLoading.value = true
    const branchId = Number(newCountForm.branch_id)
    const linea =
      modalLine.value === EMPTY_LINE_VALUE ? EMPTY_LINE_VALUE : modalLine.value || undefined
    const resp = await stockService.searchItems(
      branchId,
      modalItemSearch.value || undefined,
      linea,
      200,
      0,
      selectedWarehouse // Use selected warehouse
    )
    const normalized = normalizeModalItems(resp)
    
    // Find selected warehouse info locally
    const selectedWhInfo = modalWarehouses.value.find(w => w.almacen === selectedWarehouse)
    const whName = selectedWhInfo?.nombre || `Almacén ${selectedWarehouse}`

    // Map items directly. searchItems returns all items matching the search/line.
    // 'existencia' field in response corresponds to stock in 'selectedWarehouse' (passed to searchItems).
    modalItems.value = normalized.map((item: any) => ({
      ...item,
      almacen: whName,
      existencia: item.existencia !== undefined ? item.existencia : 0
    }))

    scheduleModalHistory(modalItems.value.map((it) => it.codigo))
  } catch (err: any) {
    console.error('Error loading modal items', err)
    modalItemsError.value = err?.response?.data?.error || 'No se pudieron cargar los artículos'
  } finally {
    modalItemsLoading.value = false
  }
}

const scheduleModalItemsLoad = () => {
  if (modalSearchDebounceTimer) window.clearTimeout(modalSearchDebounceTimer)
  modalSearchDebounceTimer = window.setTimeout(() => {
    loadModalItems()
  }, 350)
}

const loadModalHistory = async (codes?: string[]) => {
  const branchId = Number(newCountForm.branch_id || 0)
  if (!branchId) {
    modalHistory.value = {}
    return
  }

  const items = codes ?? modalItems.value.map((it) => it.codigo)
  if (!items.length) {
    modalHistory.value = {}
    return
  }

  try {
    modalHistoryLoading.value = true
    modalHistoryError.value = ''
    const { from, to } = modalMonthRange.value
    const resp = await countsService.getItemsHistory({
      branch_id: branchId,
      item_codes: items,
      from,
      to,
      almacen: Number(newCountForm.almacen) || 1
    })
    const map: Record<string, { last_counted_at: string; folio?: string; count_id?: number }> = {}
    if (Array.isArray(resp?.items)) {
      resp.items.forEach((r: any) => {
        if (r?.item_code && r?.last_counted_at) {
          map[String(r.item_code)] = {
            last_counted_at: r.last_counted_at,
            folio: r.folio,
            count_id: r.count_id
          }
        }
      })
    }
    modalHistory.value = map
  } catch (err: any) {
    console.error('Error loading modal history', err)
    modalHistoryError.value = err?.response?.data?.error || 'No se pudo verificar historial'
  } finally {
    modalHistoryLoading.value = false
  }
}

const scheduleModalHistory = (codes?: string[]) => {
  if (modalHistoryTimer) window.clearTimeout(modalHistoryTimer)
  modalHistoryTimer = window.setTimeout(() => {
    loadModalHistory(codes)
  }, 300)
}

const toggleItem = (codigo: string, checked: boolean) => {
  const next = new Set(selectedItemCodes.value)
  if (checked) next.add(codigo)
  else next.delete(codigo)
  selectedItemCodes.value = next
}

const onItemCheckboxChange = (evt: Event, codigo: string) => {
  const target = evt.target as HTMLInputElement | null
  toggleItem(codigo, Boolean(target?.checked))
}

const onModalLineFocus = () => {
  if (!newCountForm.branch_id) return
  showModalLineDropdown.value = true
}

const onModalLineInput = async () => {
  if (!newCountForm.branch_id) return
  showModalLineDropdown.value = true

  if (modalLineInput.value.trim() === '') {
    modalLine.value = ''
    selectAllFromLine.value = false
    selectedItemCodes.value = new Set()
    await loadModalItems()
  }
}

const onModalLineBlur = () => {
  setTimeout(() => {
    showModalLineDropdown.value = false
  }, 120)
}

const selectModalLine = async (value: string) => {
  modalLine.value = value
  modalLineInput.value = value === EMPTY_LINE_VALUE ? 'Sin línea' : value
  showModalLineDropdown.value = false
  selectAllFromLine.value = false
  selectedItemCodes.value = new Set()
  await loadModalItems()
}

const createCount = async () => {
  try {
    if (!newCountForm.branch_id || !newCountForm.responsible_user_id) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Por favor completa todos los campos requeridos',
        confirmButtonText: 'Entendido'
      })
      return
    }

    let items: string[] | undefined
    if (selectAllFromLine.value) {
      const branchId = Number(newCountForm.branch_id)
      const linea =
        modalLine.value === EMPTY_LINE_VALUE ? EMPTY_LINE_VALUE : modalLine.value || undefined
      const resp = await stockService.getItemCodes(branchId, linea)
      items = Array.isArray(resp?.item_codes) ? resp.item_codes : []
    } else {
      items = Array.from(selectedItemCodes.value)
    }

    if (!items || items.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin artículos',
        text: 'Selecciona al menos un artículo (o usa "Todos")',
        confirmButtonText: 'Entendido'
      })
      return
    }

    const derivedType =
      selectAllFromLine.value && modalLine.value ? 'por_familia' : selectAllFromLine.value ? 'total' : 'ciclico'

    // Ya no filtramos manualmente los artículos seleccionados, 
    // permitimos que el usuario decida aunque ya hayan sido contados (verán el tag de aviso en la lista).
    let finalItems = items

    let itemsData: Array<{ item_code: string; count: number }> | undefined = undefined
    if (newCountForm.classification === 'ajuste' && !selectAllFromLine.value) {
       itemsData = []
       for (const code of finalItems) {
         const qty = modalAdjustmentQuantities.value[code]
         if (qty === undefined || qty === null) {
           Swal.fire({
             icon: 'warning',
             title: 'Cantidad faltante',
             text: `Falta ingresar la cantidad para el artículo ${code}`,
             confirmButtonText: 'Entendido'
           })
           return
         }
         itemsData.push({ item_code: code, count: qty })
       }
    }

    const response: any = await countsService.create({
      branch_id: Number(newCountForm.branch_id),
      almacen: Number(newCountForm.almacen),
      type: derivedType,
      classification: newCountForm.classification as any,
      priority: newCountForm.priority as any,
      responsible_user_id: Number(newCountForm.responsible_user_id),
      scheduled_date: newCountForm.scheduled_date || undefined,
      notes: newCountForm.notes || undefined,
      tolerance_percentage: newCountForm.tolerance_percentage,
      items: finalItems,
      items_data: itemsData,
      // Cuando se usa "Todos", dejar que el backend filtre
      exclude_already_counted_month: excludeAlreadyCounted.value && selectAllFromLine.value,
      month_from: excludeAlreadyCounted.value && selectAllFromLine.value ? modalMonthRange.value.from : undefined,
      month_to: excludeAlreadyCounted.value && selectAllFromLine.value ? modalMonthRange.value.to : undefined
    })

    // Handle multiple counts response
    const counts = response.counts || []
    const folios = response.folios || counts.map((c: any) => c.folio)

    console.log('Response:', response)
    console.log('Counts created:', counts.length, 'Folios:', folios)

    if (counts.length === 1) {
      Swal.fire({
        icon: 'success',
        title: '¡Conteo creado!',
        text: `Folio: ${folios[0]}`,
        timer: 2500,
        showConfirmButton: false
      })
    } else if (counts.length > 1) {
      Swal.fire({
        icon: 'success',
        title: '¡Conteos creados!',
        html: `Se crearon ${counts.length} conteos:<br><br>${folios.join('<br>')}`,
        confirmButtonText: 'Cerrar'
      })
    } else {
      Swal.fire({
        icon: 'info',
        title: 'Sin conteos',
        text: 'No se crearon conteos',
        confirmButtonText: 'Cerrar'
      })
    }
    
    closeNewCountModal()
    await loadCounts()
  } catch (err: any) {
    console.error('Error creating count', err)
    const errorMessage = err.response?.data?.error || err.message
    // Convert \n to <br> for proper HTML rendering
    const formattedMessage = errorMessage.replace(/\n/g, '<br>')
    
    Swal.fire({
      icon: 'error',
      title: 'Error al crear conteo',
      html: formattedMessage,
      confirmButtonText: 'Cerrar'
    })
  }
}

const cancelCount = async (id: number) => {
  const result = await Swal.fire({
    icon: 'warning',
    title: '¿Estás seguro?',
    text: 'Esta acción cancelará el conteo y no se puede deshacer',
    showCancelButton: true,
    confirmButtonText: 'Sí, cancelar',
    cancelButtonText: 'No, mantener',
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6b7280'
  })
  
  if (!result.isConfirmed) {
    return
  }

  try {
    await countsService.update(id, { status: 'cancelado' })
    Swal.fire({
      icon: 'success',
      title: '¡Cancelado!',
      text: 'Conteo cancelado correctamente',
      timer: 2000,
      showConfirmButton: false
    })
    await loadCounts()
  } catch (err: any) {
    console.error('Error cancelling count', err)
    Swal.fire({
      icon: 'error',
      title: 'Error al cancelar',
      text: err.response?.data?.error || err.message,
      confirmButtonText: 'Cerrar'
    })
  }
}

watch(
  () => newCountForm.branch_id,
  async () => {
    if (!showNewCountModal.value) return
    selectAllFromLine.value = false
    selectedItemCodes.value = new Set()
    await loadModalLines()
    await loadModalItems()
  }
)

watch(
  () => selectAllFromLine.value,
  async (val) => {
    if (!showNewCountModal.value) return
    if (val) {
      selectedItemCodes.value = new Set()
      // Cargar el total de artículos cuando se marca "Todos"
      if (newCountForm.branch_id) {
        try {
          const branchId = Number(newCountForm.branch_id)
          const linea =
            modalLine.value === EMPTY_LINE_VALUE ? EMPTY_LINE_VALUE : modalLine.value || undefined
          const resp = await stockService.getItemCodes(branchId, linea)
          const allCodes = Array.isArray(resp?.item_codes) ? resp.item_codes : []
          totalItemsInLine.value = allCodes.length

          // Cargar historial de TODOS los artículos de la línea
          if (allCodes.length > 0) {
            await loadModalHistory(allCodes)
          }
        } catch (err) {
          console.error('Error loading total items count', err)
          totalItemsInLine.value = 0
        }
      }
    } else {
      totalItemsInLine.value = 0
      // Volver a cargar solo el historial de los artículos visibles
      await loadModalHistory()
    }
  }
)

// Actualizar total cuando cambie la línea y "Todos" esté activo
watch(
  () => modalLine.value,
  async () => {
    if (!showNewCountModal.value || !selectAllFromLine.value || !newCountForm.branch_id) return
    try {
      const branchId = Number(newCountForm.branch_id)
      const linea =
        modalLine.value === EMPTY_LINE_VALUE ? EMPTY_LINE_VALUE : modalLine.value || undefined
      const resp = await stockService.getItemCodes(branchId, linea)
      const allCodes = Array.isArray(resp?.item_codes) ? resp.item_codes : []
      totalItemsInLine.value = allCodes.length

      // Cargar historial de TODOS los artículos de la nueva línea
      if (allCodes.length > 0) {
        await loadModalHistory(allCodes)
      }
    } catch (err) {
      console.error('Error loading total items count', err)
      totalItemsInLine.value = 0
    }
  }
)

watch(
  () => newCountForm.scheduled_date,
  () => {
    if (!showNewCountModal.value) return
    scheduleModalHistory()
  }
)

const loadCounts = async () => {
  try {
    loading.value = true
    error.value = ''
    const params: any = {}
    if (filters.branch_id) params.branch_id = Number(filters.branch_id)
    if (filters.statuses.length) params.status = filters.statuses
    if (filters.classification) params.classification = filters.classification
    if (viewMode.value === 'calendar') {
      // Load all counts for calendar view (we'll filter by date on the frontend)
      // This allows showing counts with scheduled_date OR created_at
      params.limit = 5000
      params.offset = 0
    } else {
      if (filters.date_from) params.date_from = filters.date_from
      if (filters.date_to) params.date_to = filters.date_to
      params.limit = limit.value
      params.offset = (page.value - 1) * limit.value
      if (searchText.value.trim()) {
        params.search = searchText.value.trim()
      }
    }

    console.log('[Counts] Loading with params:', params)
    const response = await countsService.getAll(params)
    counts.value = normalizeCounts(response)
    total.value = (response && typeof (response as any).total === 'number' ? (response as any).total : counts.value.length) || 0
    console.log('[Counts] Loaded:', counts.value.length)
    console.log('Sample count:', counts.value[0])
  } catch (err: any) {
    console.error('Error loading counts', err)
    error.value = 'No se pudo cargar el listado de conteos'
  } finally {
    loading.value = false
  }
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

watch(
  () => [viewMode.value, calendarMonth.value.getFullYear(), calendarMonth.value.getMonth()],
  async () => {
    if (viewMode.value === 'calendar') await loadCounts()
  }
)

const branchNameById = computed(() => {
  const map = new Map<number, string>()
  branches.value.forEach((b) => {
    if (b.id !== undefined) {
      map.set(b.id, b.name)
    }
  })
  return map
})

const userNameById = computed(() => {
  const map = new Map<number, string>()
  users.value.forEach((u) => {
    if (u.id !== undefined) {
      map.set(u.id, u.name)
    }
  })
  return map
})

// Filtrar conteos por búsqueda de texto (Fallback en memoria si fuera necesario, pero ahora usamos servidor)
type CountSortKey =
  | 'folio'
  | 'branch'
  | 'warehouse'
  | 'classification'
  | 'status'
  | 'responsible'
  | 'created'
  | 'closed'
const sortState = ref<{ key: CountSortKey; dir: 'asc' | 'desc' }>({ key: 'created', dir: 'desc' })

const filteredCounts = computed(() => {
  return counts.value
})

const toggleSort = (key: CountSortKey) => {
  if (sortState.value.key === key) {
    sortState.value.dir = sortState.value.dir === 'asc' ? 'desc' : 'asc'
  } else {
    sortState.value = { key, dir: 'asc' }
  }
}

const isSortActive = (key: CountSortKey, dir: 'asc' | 'desc') =>
  sortState.value.key === key && sortState.value.dir === dir

const sortedFilteredCounts = computed(() => {
  const list = [...filteredCounts.value]
  const { key, dir } = sortState.value
  list.sort((a, b) => {
    const getValue = (count: Count) => {
      if (key === 'folio') return count.folio || ''
      if (key === 'branch') return branchNameById.value.get(count.branch_id) || ''
      if (key === 'warehouse') return (count as any).almacen_nombre || String(count.almacen || '')
      if (key === 'classification') return classificationLabel[count.classification] || count.classification || ''
      if (key === 'status') return statusLabel[count.status] || count.status || ''
      if (key === 'responsible') return (count as any).responsible_user_name || ''
      if (key === 'created') return new Date((count as any).created_at || 0).getTime()
      if (key === 'closed') return new Date((count as any).closed_at || 0).getTime()
      return ''
    }
    const va = getValue(a)
    const vb = getValue(b)
    if (typeof va === 'number' && typeof vb === 'number') return dir === 'asc' ? va - vb : vb - va
    return dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
  })
  return list
})

const resetFilters = () => {
  Object.assign(filters, {
    branch_id: '',
    statuses: ['pendiente', 'contando'],
    classification: '',
    date_from: '',
    date_to: ''
  })
  searchText.value = ''
  page.value = 1
  loadCounts()
}

// Watchers for automatic reload on filter/search change
watch([() => filters.branch_id, () => filters.statuses.join('|'), () => filters.classification, () => filters.date_from, () => filters.date_to], () => {
  page.value = 1
  loadCounts()
})

let searchDebounceTimer: number | undefined
watch(searchText, () => {
  if (searchDebounceTimer) window.clearTimeout(searchDebounceTimer)
  searchDebounceTimer = window.setTimeout(() => {
    page.value = 1
    loadCounts()
  }, 400)
})

watch(page, () => {
  loadCounts()
})


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
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  await loadBranches()
  await loadUsers()
  await loadSpecialLines()
  await loadCounts()

  // Real-time updates
  socketCleanups.push(socketStore.on('count_created', () => {
    console.log('Real-time: count_created')
    loadCounts()
  }))

  socketCleanups.push(socketStore.on('count_status_changed', () => {
    console.log('Real-time: count_status_changed')
    loadCounts()
  }))

  socketCleanups.push(socketStore.on('count_reassigned', () => {
    console.log('Real-time: count_reassigned')
    loadCounts()
  }))

  // Check for quick count parameters from warehouses view
  if (route.query.quick === 'true') {
    const branchId = route.query.branch
    const warehouseId = route.query.warehouse
    const itemCode = route.query.item

    if (branchId && warehouseId && itemCode) {
      // Set form values
      newCountForm.branch_id = String(branchId)
      newCountForm.almacen = String(warehouseId)
      newCountForm.classification = 'inventario'
      newCountForm.priority = 'media'
      newCountForm.tolerance_percentage = 5

      // Load warehouses and items for this branch
      await loadModalWarehouses()
      await loadModalLines()
      
      // Add the item to selected items
      selectedItemCodes.value = new Set([String(itemCode)])
      
      // Open the modal
      showNewCountModal.value = true

      // Clear query params
      router.replace({ query: {} })
    }
  }
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('resize', updateIsMobile)
  socketCleanups.forEach(fn => fn())
})

// Reload warehouses when branch changes
watch(() => newCountForm.branch_id, async (newVal) => {
  newCountForm.almacen = '' // Reset selected warehouse
  modalItems.value = [] // Clear items
  if (newVal) {
    await loadModalWarehouses()
  } else {
    modalWarehouses.value = []
  }
})

// Reload items when warehouse changes
watch(() => newCountForm.almacen, () => {
  loadModalItems()
})

// FullCalendar configuration
const calendarOptions = ref({
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  locale: esLocale,
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth'
  },
  events: [] as EventInput[],
  eventClick: (info: any) => {
    const countId = info.event.extendedProps.countId
    if (countId) {
      window.open(`/conteos/${countId}`, '_blank')
    }
  },
  dateClick: (info: any) => {
    openNewCountModalForDate(info.dateStr)
  },
  height: 'auto',
  eventDisplay: 'block'
})

// Convert counts to calendar events
const calendarEvents = computed<EventInput[]>(() => {
  return counts.value.map(count => {
    // Use scheduled_date if available, otherwise fall back to created_at
    const scheduledDate = (count as any).scheduled_date
    const createdDate = (count as any).created_at
    const eventDate = scheduledDate || createdDate
    
    // Color based on status
    let backgroundColor = '#94a3b8' // default gray
    let borderColor = '#64748b'
    
    if (count.status === 'pendiente') {
      backgroundColor = '#f59e0b'
      borderColor = '#d97706'
    } else if (count.status === 'contando') {
      backgroundColor = '#3b82f6'
      borderColor = '#2563eb'
    } else if (count.status === 'contado' || count.status === 'cerrado') {
      backgroundColor = '#22c55e'
      borderColor = '#16a34a'
    } else if (count.status === 'cancelado') {
      backgroundColor = '#ef4444'
      borderColor = '#dc2626'
    }
    
    return {
      id: String(count.id),
      title: `${count.folio} - ${classificationLabel[count.classification] || count.classification}`,
      start: eventDate ? (typeof eventDate === 'string' ? eventDate.split('T')[0] : new Date(eventDate).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
      backgroundColor,
      borderColor,
      extendedProps: {
        countId: count.id,
        status: count.status,
        branch: branchNameById.value.get(count.branch_id) || `ID ${count.branch_id}`,
        responsible: (count as any).responsible_user_name || 'Sin asignar'
      }
    }
  })
})

// Update calendar events when counts change
watch(calendarEvents, (newEvents) => {
  console.log('[Calendar] Events updated:', newEvents.length, 'events')
  console.log('Events:', newEvents)
  calendarOptions.value.events = newEvents
}, { immediate: true })

// Also watch counts directly to debug
watch(counts, (newCounts) => {
  console.log('[Counts] Changed:', newCounts.length, 'counts')
  console.log('View mode:', viewMode.value)
})

</script>

<template>
  <section class="panel wide">
    <div class="panel-top">
      <div class="panel-header">
        <div class="panel-title">
          <MobileMenuToggle />
          <div class="panel-title-text">
            <p class="eyebrow">Operaci&oacute;n</p>
            <h2>
              Listado de conteos
              <span :class="['socket-status-dot', { connected: socketStore.connected }]"
                    :title="socketStore.connected ? 'Conectado en tiempo real' : 'Sin conexi&oacute;n real-time'"></span>
            </h2>
            <p class="muted">Vista de todos los conteos con filtros por sucursal, estado y fecha.</p>
          </div>
        </div>
        <div class="header-actions">
          <div class="mode-tabs">
            <button class="tab" :class="{ active: viewMode === 'cards' }" type="button" @click="viewMode = 'cards'; loadCounts()">
              Tarjetas
            </button>
            <button class="tab" :class="{ active: viewMode === 'table' }" type="button" @click="viewMode = 'table'; loadCounts()">
              Tabla
            </button>
            <button class="tab" :class="{ active: viewMode === 'calendar' }" type="button" @click="viewMode = 'calendar'; loadCounts()">
              Calendario
            </button>
          </div>
          <button v-if="authStore.hasPermission('counts.create')" class="btn" @click="openNewCountModal">Nuevo conteo</button>
          <span class="tag accent">{{ total }} conteos</span>
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

        <div v-show="!isMobile || filtersOpen" class="filters-body">
          <div class="search-bar">
            <div class="search-input-wrapper">
              <span class="search-icon">&#128269;</span>
              <input
                id="search-text"
                v-model="searchText"
                type="text"
                placeholder="Buscar por folio, sucursal, responsable, estado..."
                class="search-input"
              />
              <button
                v-if="searchText"
                class="clear-search"
                @click="searchText = ''"
                title="Limpiar b&uacute;squeda"
              >
                &times;
              </button>
            </div>
            <div v-if="searchText && filteredCounts.length !== counts.length" class="search-results-info">
              <span class="tag">{{ filteredCounts.length }} de {{ counts.length }} conteos</span>
            </div>
          </div>

          <div class="form-grid">
            <div>
              <label for="branch">Sucursal</label>
              <select id="branch" v-model="filters.branch_id" @change="loadCounts">
                <option value="">Todas</option>
                <option v-for="branch in connectedBranches" :key="branch.id ?? branch.code" :value="branch.id">
                  {{ branch.name }}
                </option>
              </select>
            </div>
            <div class="status-filter">
              <label class="status-filter-title">Estado</label>
              <div class="status-filter-list">
                <label
                  v-for="statusOption in statusFilterOptions"
                  :key="statusOption"
                  class="status-filter-option"
                >
                  <input
                    v-model="filters.statuses"
                    type="checkbox"
                    :value="statusOption"
                  />
                  <span>{{ statusLabel[statusOption] || statusOption }}</span>
                </label>
              </div>
            </div>
            <div>
              <label for="classification">Clasificaci&oacute;n</label>
              <select id="classification" v-model="filters.classification" @change="loadCounts">
                <option value="">Todas</option>
                <option value="inventario">Inventario</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </div>
            <div v-if="viewMode !== 'calendar'">
              <label for="date-from">Fecha desde</label>
              <input id="date-from" v-model="filters.date_from" type="date" @change="loadCounts" />
            </div>
            <div v-if="viewMode !== 'calendar'">
              <label for="date-to">Fecha hasta</label>
              <input id="date-to" v-model="filters.date_to" type="date" @change="loadCounts" />
            </div>
            <div class="actions">
              <button class="btn" @click="loadCounts">Filtrar</button>
              <button class="btn ghost" @click="resetFilters">
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="muted" style="padding: 1rem">Cargando conteos...</div>
    <div v-else-if="error" class="error-message panel">
      <p>{{ error }}</p>
      <button class="btn" @click="loadCounts">Reintentar</button>
    </div>

	    <template v-else>
	      <!-- Card-based layout for cards view -->
	      <div v-if="viewMode === 'cards'" class="counts-cards-grid">
          <div v-if="sortedFilteredCounts.length === 0" class="empty-state">
            <p class="muted">{{ searchText ? 'No se encontraron conteos con ese criterio' : 'Sin conteos registrados' }}</p>
          </div>
          
          <div v-for="count in sortedFilteredCounts" :key="count.id" class="count-card">
            <!-- Header: Folio + Status Badge -->
            <div class="count-card-header">
              <router-link :to="{ name: 'conteos-detalle', params: { id: count.id } }" class="count-folio-link">
                {{ count.folio }}
              </router-link>
              <div style="display: flex; gap: 0.35rem; align-items: center;">
                <span 
                  v-if="countMayHaveSpecialLines(count)" 
                  class="status-badge special-line-badge"
                  title="Este conteo contiene artículos de líneas especiales"
                >
                  ⭐
                </span>
                <span :class="['status-badge', statusClass(count.status)]">
                  {{ statusLabel[count.status] || count.status }}
                </span>
              </div>
            </div>

            <!-- Title: Branch Name -->
            <h3 class="count-card-title">
              {{ branchNameById.get(count.branch_id) || `Sucursal ID ${count.branch_id}` }}
            </h3>

            <!-- Details Grid -->
            <div class="count-card-details">
              <div class="count-detail-item">
                <span class="detail-label">CLASIFICACIÓN</span>
                <span class="detail-value" :style="{ color: count.classification === 'ajuste' ? 'var(--accent)' : 'inherit' }">
                  {{ classificationLabel[count.classification] || count.classification }}
                </span>
              </div>

              <div class="count-detail-item">
                <span class="detail-label">ALMACÉN</span>
                <span class="detail-value">
                  {{ (count as any).almacen_nombre || `Almacén ${count.almacen || 1}` }}
                </span>
              </div>

              <div class="count-detail-item">
                <span class="detail-label">RESPONSABLE</span>
                <span class="detail-value user-badge">
                  <span class="user-avatar">{{ ((count as any).responsible_user_name || 'S')[0].toUpperCase() }}</span>
                  {{ (count as any).responsible_user_name || 'Sin asignar' }}
                </span>
              </div>

              <div class="count-detail-item">
                <span class="detail-label">CREACIÓN</span>
                <span class="detail-value">{{ formatDate((count as any).created_at ?? null) }}</span>
              </div>
            </div>

            <!-- Articles Section -->
            <div v-if="(count as any).item_codes" class="count-articles-section">
              <span class="detail-label">ARTÍCULOS ({{ (count as any).item_codes.split(',').length }})</span>
              <div class="articles-codes">
                {{ (count as any).item_codes }}
              </div>
            </div>

            <!-- Footer: Actions -->
            <div class="count-card-footer">
              <div class="card-actions">
                <router-link :to="{ name: 'conteos-detalle', params: { id: count.id } }" class="btn-link-primary">
                  Ver detalles →
                </router-link>
                <button
                  v-if="count.status === 'pendiente'"
                  class="btn ghost small danger"
                  @click="cancelCount(count.id)"
                  title="Cancelar conteo"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
	      </div>

        <!-- Traditional table view -->
        <div v-else-if="viewMode === 'table'" class="table-scroll">
          <table v-if="!isMobile" class="table table-full">
            <thead>
              <tr>
                <th>
                  <div class="th-sort">
                    <span>Folio</span>
                    <div class="th-sort-buttons">
                      <button :class="{ active: isSortActive('folio', 'asc') }" @click="toggleSort('folio')">&#9650;</button>
                      <button :class="{ active: isSortActive('folio', 'desc') }" @click="toggleSort('folio')">&#9660;</button>
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
                    <span>Almacén</span>
                    <div class="th-sort-buttons">
                      <button :class="{ active: isSortActive('warehouse', 'asc') }" @click="toggleSort('warehouse')">&#9650;</button>
                      <button :class="{ active: isSortActive('warehouse', 'desc') }" @click="toggleSort('warehouse')">&#9660;</button>
                    </div>
                  </div>
                </th>
                <th>
                  <div class="th-sort">
                    <span>Clasificación</span>
                    <div class="th-sort-buttons">
                      <button :class="{ active: isSortActive('classification', 'asc') }" @click="toggleSort('classification')">&#9650;</button>
                      <button :class="{ active: isSortActive('classification', 'desc') }" @click="toggleSort('classification')">&#9660;</button>
                    </div>
                  </div>
                </th>
                <th>Artículos</th>
                <th>
                  <div class="th-sort">
                    <span>Estado</span>
                    <div class="th-sort-buttons">
                      <button :class="{ active: isSortActive('status', 'asc') }" @click="toggleSort('status')">&#9650;</button>
                      <button :class="{ active: isSortActive('status', 'desc') }" @click="toggleSort('status')">&#9660;</button>
                    </div>
                  </div>
                </th>
                <th>
                  <div class="th-sort">
                    <span>Responsable</span>
                    <div class="th-sort-buttons">
                      <button :class="{ active: isSortActive('responsible', 'asc') }" @click="toggleSort('responsible')">&#9650;</button>
                      <button :class="{ active: isSortActive('responsible', 'desc') }" @click="toggleSort('responsible')">&#9660;</button>
                    </div>
                  </div>
                </th>
                <th>
                  <div class="th-sort">
                    <span>Creación</span>
                    <div class="th-sort-buttons">
                      <button :class="{ active: isSortActive('created', 'asc') }" @click="toggleSort('created')">&#9650;</button>
                      <button :class="{ active: isSortActive('created', 'desc') }" @click="toggleSort('created')">&#9660;</button>
                    </div>
                  </div>
                </th>
                <th>
                  <div class="th-sort">
                    <span>Cierre</span>
                    <div class="th-sort-buttons">
                      <button :class="{ active: isSortActive('closed', 'asc') }" @click="toggleSort('closed')">&#9650;</button>
                      <button :class="{ active: isSortActive('closed', 'desc') }" @click="toggleSort('closed')">&#9660;</button>
                    </div>
                  </div>
                </th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="count in sortedFilteredCounts" :key="count.id">
                <td data-label="Folio">
                  <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <strong>{{ count.folio }}</strong>
                    <span 
                      v-if="countMayHaveSpecialLines(count)" 
                      class="special-line-badge"
                      title="Este conteo contiene artículos de líneas especiales"
                      style="font-size: 0.9rem; padding: 0.2rem 0.4rem;"
                    >
                      ⭐
                    </span>
                  </div>
                </td>
                <td data-label="Sucursal">{{ branchNameById.get(count.branch_id) || `ID ${count.branch_id}` }}</td>
                <td data-label="Almacén">
                  <span v-if="(count as any).almacen_nombre" class="tag" style="font-size: 0.8rem">
                    {{ (count as any).almacen_nombre }}
                  </span>
                  <span v-else class="muted">Almacén {{ count.almacen || 1 }}</span>
                </td>
                <td data-label="Clasificación">
                  <strong :style="{ color: count.classification === 'ajuste' ? 'var(--accent)' : 'inherit' }">
                    {{ classificationLabel[count.classification] || count.classification }}
                  </strong>
                </td>
                <td data-label="Artículos">
                  <div class="item-codes-cell">
                    {{ (count as any).item_codes || '-' }}
                  </div>
                </td>
                <td data-label="Estado">
                  <span :class="['status', statusClass(count.status)]">
                    {{ statusLabel[count.status] || count.status }}
                  </span>
                </td>
                <td data-label="Responsable">{{ (count as any).responsible_user_name || 'Sin asignar' }}</td>
                <td data-label="Creación">{{ formatDate((count as any).created_at ?? null) }}</td>
                <td data-label="Cierre">{{ formatDate((count as any).closed_at ?? null) }}</td>
                <td data-label="Acciones">
                  <div style="display: flex; gap: 0.25rem;">
                    <router-link :to="{ name: 'conteos-detalle', params: { id: count.id } }" class="btn ghost small">Ver</router-link>
                    <button
                      v-if="count.status === 'pendiente'"
                      class="btn ghost small danger"
                      @click="cancelCount(count.id)"
                    >
                      Cancelar
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="sortedFilteredCounts.length === 0">
                <td colspan="10" class="muted" style="text-align: center; padding: 1rem">
                  {{ searchText ? 'No se encontraron conteos con ese criterio' : 'Sin conteos registrados' }}
                </td>
              </tr>
            </tbody>
          </table>

          <table v-else class="table table-split">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Sucursal</th>
                <th>Clasificación</th>
                <th>Estado</th>
                <th>Creación</th>
                <th rowspan="2">Ver</th>
              </tr>
              <tr>
                <th>Almacén</th>
                <th>Artículo</th>
                <th>Responsable</th>
                <th>Cierre</th>
                <th class="th-empty" aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="count in sortedFilteredCounts" :key="count.id">
                <tr class="row-split row-split-top">
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                      <strong>{{ count.folio }}</strong>
                      <span 
                        v-if="countMayHaveSpecialLines(count)" 
                        class="special-line-badge"
                        title="Este conteo contiene artículos de líneas especiales"
                        style="font-size: 0.9rem; padding: 0.2rem 0.4rem;"
                      >
                        ⭐
                      </span>
                    </div>
                  </td>
                  <td>{{ branchNameById.get(count.branch_id) || `ID ${count.branch_id}` }}</td>
                  <td>
                    <strong :style="{ color: count.classification === 'ajuste' ? 'var(--accent)' : 'inherit' }">
                      {{ classificationLabel[count.classification] || count.classification }}
                    </strong>
                  </td>
                  <td>
                    <span :class="['status', statusClass(count.status)]">
                      {{ statusLabel[count.status] || count.status }}
                    </span>
                  </td>
                  <td>{{ formatDate((count as any).created_at ?? null) }}</td>
                  <td rowspan="2" class="cell-actions">
                    <div style="display: flex; gap: 0.25rem;">
                      <router-link :to="{ name: 'conteos-detalle', params: { id: count.id } }" class="btn ghost small">Ver</router-link>
                      <button
                        v-if="count.status === 'pendiente'"
                        class="btn ghost small danger"
                        @click="cancelCount(count.id)"
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
                <tr class="row-split row-split-bottom">
                  <td>
                    <span v-if="(count as any).almacen_nombre" class="tag" style="font-size: 0.8rem">
                      {{ (count as any).almacen_nombre }}
                    </span>
                    <span v-else class="muted">Almacén {{ count.almacen || 1 }}</span>
                  </td>
                  <td>
                    <div class="item-codes-cell">
                      {{ (count as any).item_codes || '-' }}
                    </div>
                  </td>
                  <td>{{ (count as any).responsible_user_name || 'Sin asignar' }}</td>
                  <td>{{ formatDate((count as any).closed_at ?? null) }}</td>
                  <td class="cell-empty" aria-hidden="true"></td>
                </tr>
              </template>
              <tr v-if="sortedFilteredCounts.length === 0">
                <td colspan="6" class="muted" style="text-align: center; padding: 1rem">
                  {{ searchText ? 'No se encontraron conteos con ese criterio' : 'Sin conteos registrados' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination UI -->
        <div v-if="viewMode !== 'calendar' && totalPages > 1" class="pagination-container">
          <div class="pagination-info">
            Mostrando <strong>{{ counts.length }}</strong> de <strong>{{ total }}</strong> conteos
          </div>
          <div class="pagination-controls">
            <button 
              class="btn ghost small" 
              :disabled="page === 1" 
              @click="page--"
            >
              &larr; Anterior
            </button>
            <div class="pagination-pages">
              Página <strong>{{ page }}</strong> de <strong>{{ totalPages }}</strong>
            </div>
            <button 
              class="btn ghost small" 
              :disabled="page >= totalPages" 
              @click="page++"
            >
              Siguiente &rarr;
            </button>
          </div>
        </div>


	      <div v-if="viewMode === 'calendar'" class="calendar-wrap">
          <FullCalendar :options="calendarOptions" />
	      </div>
	    </template>
	  </section>

  <!-- Modal para nuevo conteo -->
  <div v-if="showNewCountModal" class="modal-overlay" @click="closeNewCountModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Nuevo conteo</h3>
        <button class="btn-close" @click="closeNewCountModal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div>
            <label for="modal-branch">Sucursal *</label>
            <select id="modal-branch" v-model="newCountForm.branch_id" required>
              <option value="">Selecciona una sucursal</option>
              <option v-for="branch in connectedBranches" :key="branch.id ?? branch.code" :value="branch.id">
                {{ branch.name }}
              </option>
            </select>
          </div>
          <div>
            <label for="modal-almacen">Almacén *</label>
            <select id="modal-almacen" v-model.number="newCountForm.almacen" required>
              <option value="">Selecciona un almacén</option>
              <option v-for="w in modalWarehouses" :key="w.almacen" :value="w.almacen">
                {{ w.nombre || `Almacén ${w.almacen}` }}
              </option>
            </select>
          </div>
          <div>
            <label for="modal-type">Tipo de conteo *</label>
            <select id="modal-type" v-model="newCountForm.type" required>
              <option value="ciclico">Cíclico</option>
              <option value="por_zona">Por zona</option>
              <option value="por_familia">Por familia</option>
              <option value="rango">Rango</option>
              <option value="total">Total</option>
            </select>
          </div>
          <div>
            <label for="modal-classification">Clasificación *</label>
            <select id="modal-classification" v-model="newCountForm.classification" required>
              <option value="inventario">Inventario</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>
          <div>
            <label for="modal-priority">Prioridad</label>
            <select id="modal-priority" v-model="newCountForm.priority">
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <div>
            <label for="modal-user">Responsable *</label>
            <select id="modal-user" v-model="newCountForm.responsible_user_id" required>
              <option value="">Selecciona un usuario</option>
              <option v-for="user in filteredUsers" :key="user.id" :value="user.id">
                {{ user.name }} {{ user.role_name ? ` - [${user.role_name}]` : '' }}
              </option>
            </select>
          </div>
          <div>
            <label for="modal-date">Fecha programada</label>
            <input
              id="modal-date"
              v-model="newCountForm.scheduled_date"
              type="date"
            />
          </div>
          <div>
            <label for="modal-tolerance">Tolerancia (%)</label>
            <input
              id="modal-tolerance"
              v-model.number="newCountForm.tolerance_percentage"
              type="number"
              min="0"
              max="100"
              step="0.1"
            />
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-header">
            <div>
              <h4>Art&iacute;culos a contar</h4>
              <p class="muted small">Selecciona una l&iacute;nea y luego elige art&iacute;culos (o usa "Todos").</p>
            </div>
            <div class="pill">
              <span v-if="selectAllFromLine">
                Todos ({{ totalItemsInLine.toLocaleString() }})
              </span>
              <span v-else>{{ selectedItemCodes.size }} seleccionados</span>
            </div>
          </div>

          <div class="form-grid" style="margin-top: 0.5rem">
            <div>
              <label for="modal-line">L&iacute;nea / familia</label>
              <div class="line-select">
                <input
                  id="modal-line"
                  v-model="modalLineInput"
                  placeholder="Escribe o elige"
                  class="select-like"
                  :disabled="!newCountForm.branch_id"
                  @focus="onModalLineFocus"
                  @input="onModalLineInput"
                  @blur="onModalLineBlur"
                />
                <ul
                  v-if="showModalLineDropdown && filteredModalLineOptions.length"
                  class="line-dropdown"
                >
                  <li
                    v-for="opt in filteredModalLineOptions"
                    :key="opt.value || 'all-lines'"
                    @mousedown.prevent="selectModalLine(opt.value)"
                  >
                    {{ opt.label }}
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <label for="modal-item-search">Buscar art&iacute;culo</label>
              <input
                id="modal-item-search"
                v-model="modalItemSearch"
                placeholder="C&oacute;digo o descripci&oacute;n"
                :disabled="!newCountForm.branch_id || selectAllFromLine"
                @input="scheduleModalItemsLoad"
                @keyup.enter="loadModalItems"
              />
            </div>

            <div class="items-toggle">
              <label class="checkbox">
                <input type="checkbox" v-model="selectAllFromLine" :disabled="!newCountForm.branch_id" />
                <span>
                  Todos los art&iacute;culos
                  <span v-if="modalLine">de esta l&iacute;nea</span>
                  <span v-else>de la sucursal</span>
                </span>
              </label>
              <p class="muted small" style="margin: 0.2rem 0 0">El tipo de conteo se asigna autom&aacute;ticamente.</p>
            </div>

            <div class="items-toggle" style="margin-top: 0.5rem">
              <label class="checkbox">
                <input type="checkbox" v-model="excludeAlreadyCounted" :disabled="!newCountForm.branch_id" />
                <span>Excluir art&iacute;culos ya contados este mes</span>
              </label>
              <p class="muted small" style="margin: 0.2rem 0 0">
                Filtrar art&iacute;culos que ya fueron contados en el mes
                <span v-if="newCountForm.scheduled_date">({{ modalMonthRange.from }} - {{ modalMonthRange.to }})</span>
                <span v-else>(mes actual)</span>
              </p>
            </div>
          </div>

          <!-- Aviso de articulos ya contados -->
          <div v-if="alreadyCountedStats.counted > 0" class="info-banner" style="margin-top: 0.75rem">
            <span class="tag warning">{{ alreadyCountedStats.counted.toLocaleString() }} de {{ alreadyCountedStats.total.toLocaleString() }} art&iacute;culos</span>
            ya fueron contados este mes ({{ alreadyCountedStats.percentage }}%)
            <span v-if="selectAllFromLine && excludeAlreadyCounted" class="muted small" style="margin-left: 0.5rem">
              - Se excluir&aacute;n autom&aacute;ticamente
            </span>
          </div>

          <div class="items-picker">
            <div v-if="!newCountForm.branch_id" class="muted" style="padding: 0.75rem 0">
              Selecciona una sucursal para cargar art&iacute;culos.
            </div>
            <div v-else-if="modalItemsLoading" class="muted" style="padding: 0.75rem 0">
              Cargando art&iacute;culos...
            </div>
            <div v-else-if="modalItemsError" class="error-message" style="margin-top: 0.5rem">
              {{ modalItemsError }}
            </div>
            <div v-else class="items-list">
              <div v-for="it in modalItems" :key="it.codigo" class="item-row">
                <label class="item-check">
                  <input
                    type="checkbox"
                    :checked="selectedItemCodes.has(it.codigo)"
                    :disabled="selectAllFromLine"
                    @change="onItemCheckboxChange($event, it.codigo)"
                  />
                  <div class="item-main">
                    <div class="item-code">
                      {{ it.codigo }}
                      <span v-if="modalHistory[it.codigo]" class="tag warning" style="margin-left: 0.5rem; font-size: 0.7rem">
                        Contado {{ new Date(modalHistory[it.codigo]?.last_counted_at ?? '').toLocaleDateString() }}
                        <span v-if="modalHistory[it.codigo]?.folio"> - {{ modalHistory[it.codigo]?.folio }}</span>
                      </span>
                    </div>
                    <div class="item-desc">{{ it.descripcion }}</div>
                    <div v-if="it.almacen" class="item-warehouse-info">
                      <span class="tag" style="font-size: 0.75rem; background: rgba(37, 99, 235, 0.08); border-color: rgba(37, 99, 235, 0.2)">
                        Alm. {{ it.almacen }}
                      </span>
                    </div>
                  </div>
                  <div class="item-meta">
                    <span class="muted small">Existencia</span>
                    <span>{{ it.existencia ?? '-' }}</span>
                  </div>
                </label>

                <div v-if="newCountForm.classification === 'ajuste' && (selectedItemCodes.has(it.codigo) || selectAllFromLine)" class="adj-qty">
                   <input 
                      type="number" 
                      placeholder="Cant."
                      class="qty-input"
                      style="width: 80px; padding: 0.25rem;"
                      @input="(e: any) => setAdjustmentQuantity(it.codigo, e.target.value)"
                      :value="getAdjustmentQuantity(it.codigo)"
                      @click.stop
                   />
                </div>
              </div>
              <div v-if="modalItems.length === 0" class="muted" style="padding: 0.75rem 0">
                Sin resultados
              </div>
            </div>

            <p class="muted small" style="margin: 0.5rem 0 0">
              Selecci&oacute;n manual muestra hasta 200 resultados. "Todos" incluye todo el cat&aacute;logo seg&uacute;n la l&iacute;nea.
            </p>
          </div>
        </div>

        <div style="margin-top: 0.75rem">
          <label for="modal-notes">Notas</label>
          <textarea
            id="modal-notes"
            v-model="newCountForm.notes"
            placeholder="Observaciones adicionales..."
          ></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn ghost" @click="closeNewCountModal">Cancelar</button>
        <button class="btn" @click="createCount">Crear conteo</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ============================================
   FILTERS TOGGLE (MOBILE)
   ============================================ */
.panel-top {
  margin-bottom: 0.6rem;
  padding: 0.65rem;
  border: 1px solid #dbe5f0;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.9), rgba(255, 255, 255, 0.88));
}

.panel-top .panel-header {
  margin-bottom: 0.5rem;
  align-items: center;
}

.panel-top .filters {
  border: 1px solid #dbe5f0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  padding: 0.5rem;
}

.filters-body {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.filters .form-grid {
  margin-bottom: 0;
  gap: 0.45rem;
}

.filters .form-grid > div {
  padding: 0.45rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.filters-header {
  display: none;
  margin-bottom: 0.6rem;
}

/* Pagination Styles */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 0;
  margin-top: 1rem;
  border-top: 1px solid var(--line);
  flex-wrap: wrap;
  gap: 1rem;
}

.pagination-info {
  font-size: 0.9rem;
  color: var(--muted);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.pagination-pages {
  font-size: 0.9rem;
  color: var(--ink);
}

@media (max-width: 640px) {
  .pagination-container {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
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

@media (max-width: 1024px) {
  .filters-header {
    display: block;
  }
}

/* ============================================
   SEARCH BAR STYLES
   ============================================ */

.search-bar {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.45rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 1rem;
  font-size: 1.1rem;
  pointer-events: none;
  opacity: 0.5;
}

.search-input {
  width: 100%;
  padding: 0.58rem 0.85rem 0.58rem 2.35rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  font-size: 0.9rem;
  background: var(--panel);
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.search-input::placeholder {
  color: var(--muted);
}

.clear-search {
  position: absolute;
  right: 0.75rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--muted);
  cursor: pointer;
  padding: 0.25rem;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.clear-search:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.search-results-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-left: 0;
}

/* Search bar responsive */
@media (max-width: 768px) {
  .search-input {
    padding: 0.65rem 1rem 0.65rem 2.5rem;
    font-size: 0.9rem;
  }
  
  .search-icon {
    left: 0.85rem;
    font-size: 1rem;
  }
}

@media (max-width: 480px) {
  .search-input {
    padding: 0.6rem 0.85rem 0.6rem 2.25rem;
    font-size: 0.85rem;
  }
  
  .search-icon {
    left: 0.75rem;
    font-size: 0.9rem;
  }
  
  .search-input::placeholder {
    font-size: 0.85rem;
  }
}

.actions {
  display: flex;
  gap: 0.35rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.status-filter {
  min-width: 0;
}

.status-filter-title {
  display: block;
  margin-bottom: 0.2rem;
  font-size: 0.82rem;
}

.status-filter-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem 0.45rem;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
}

.status-filter-option {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  font-size: 0.8rem;
  color: #1f2937;
  cursor: pointer;
}

.status-filter-option input[type='checkbox'] {
  margin: 0;
  width: 13px;
  height: 13px;
  accent-color: var(--accent);
}

.filters :deep(label) {
  margin-bottom: 0.15rem;
  font-size: 0.82rem;
}

.filters :deep(select),
.filters :deep(input) {
  padding: 0.44rem 0.56rem;
  font-size: 0.89rem;
  border-radius: 9px;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  width: 100%;
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
  font-weight: 700;
  white-space: nowrap;
  font-size: 0.9rem;
}

.tab.active {
  background: rgba(37, 99, 235, 0.12);
  color: var(--ink);
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.month-title {
  font-weight: 800;
  text-transform: capitalize;
  padding: 0.45rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
  min-width: 170px;
  text-align: center;
}

.month-today {
  margin-top: 0.35rem;
}

.calendar-wrap {
  margin-top: 0.25rem;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(140px, 1fr));
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
  background: var(--panel);
}

.calendar-dow {
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--line);
  background: rgba(15, 23, 42, 0.03);
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 800;
}

.calendar-cell {
  min-height: 120px;
  padding: 0.55rem 0.55rem 0.7rem;
  border-bottom: 1px solid var(--line);
  border-right: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.9);
}

.calendar-cell:nth-child(7n) {
  border-right: 0;
}

.calendar-cell-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.35rem;
}

.calendar-date {
  border: 0;
  background: rgba(37, 99, 235, 0.1);
  color: var(--accent-strong);
  font-weight: 900;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  cursor: pointer;
}

.calendar-date:hover {
  background: rgba(37, 99, 235, 0.16);
}

.calendar-events {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.calendar-event {
  display: block;
  padding: 0.3rem 0.45rem;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  text-decoration: none;
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--ink);
  background: rgba(15, 23, 42, 0.03);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calendar-event.progress {
  background: rgba(37, 99, 235, 0.1);
  border-color: rgba(37, 99, 235, 0.2);
  color: var(--accent-strong);
}

.calendar-event.open {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.22);
  color: #166534;
}

.calendar-event.closed {
  background: rgba(245, 158, 11, 0.14);
  border-color: rgba(245, 158, 11, 0.22);
  color: #92400e;
}

.calendar-event:hover {
  filter: brightness(0.98);
}

/* FullCalendar Styles */
.calendar-wrap {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid var(--line);
}

/* Override FullCalendar default styles */
:deep(.fc) {
  font-family: inherit;
}

:deep(.fc-toolbar-title) {
  font-size: 1.5rem !important;
  font-weight: 600;
  color: var(--ink);
}

:deep(.fc-button) {
  background: var(--accent) !important;
  border-color: var(--accent) !important;
  text-transform: capitalize !important;
  padding: 0.5rem 1rem !important;
  border-radius: 8px !important;
}

:deep(.fc-button:hover) {
  background: var(--accent-strong) !important;
}

:deep(.fc-button-active) {
  background: var(--accent-strong) !important;
}

:deep(.fc-daygrid-day-number) {
  color: var(--ink);
  font-weight: 600;
  padding: 0.5rem;
}

:deep(.fc-day-today) {
  background: rgba(37, 99, 235, 0.05) !important;
}

:deep(.fc-event) {
  border-radius: 6px;
  padding: 2px 6px;
  margin: 2px 0;
  font-size: 0.85rem;
  cursor: pointer;
  border-width: 1px !important;
}

:deep(.fc-event-title) {
  font-weight: 500;
}

:deep(.fc-daygrid-event-dot) {
  display: none;
}

/* ============================================
   COUNTS CARDS LAYOUT
   ============================================ */

.counts-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.count-card {
  background: #fff;
  border: 1px solid #d1d5db;
  border-left: 4px solid #d1d5db;
  border-radius: 12px;
  padding: 1.25rem;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.count-card:has(.status-badge.progress) {
  border-left-color: #2563eb;
}

.count-card:has(.status-badge.open) {
  border-left-color: #16a34a;
}

.count-card:has(.status-badge.closed) {
  border-left-color: #d97706;
}

.count-card:has(.status-badge.danger) {
  border-left-color: #dc2626;
}

.count-card:hover {
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  border-color: #9ca3af;
  transform: translateY(-1px);
}

.count-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.count-folio-link {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
  letter-spacing: 0.01em;
}

.count-folio-link:hover {
  text-decoration: underline;
}

.status-badge {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0.35rem 0.65rem;
  border-radius: 6px;
  letter-spacing: 0.03em;
}

.status-badge.closed {
  background: rgba(245, 158, 11, 0.14);
  color: #92400e;
}

.status-badge.progress {
  background: rgba(37, 99, 235, 0.12);
  color: var(--accent-strong);
}

.status-badge.open {
  background: rgba(34, 197, 94, 0.12);
  color: #166534;
}

.status-badge.danger {
  background: rgba(239, 68, 68, 0.12);
  color: #991b1b;
}

.count-card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 1rem 0;
  line-height: 1.3;
}

.count-card-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.count-detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.detail-value {
  font-size: 0.9rem;
  color: var(--ink);
  font-weight: 500;
}

.user-badge {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
}

.count-articles-section {
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.articles-codes {
  margin-top: 0.5rem;
  padding: 0.65rem 0.75rem;
  background: rgba(15, 23, 42, 0.03);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  font-size: 0.8rem;
  color: var(--muted);
  font-family: 'Courier New', monospace;
  line-height: 1.6;
  max-height: 80px;
  overflow-y: auto;
  word-break: break-all;
}

.item-codes-cell {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
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

.th-empty {
  background: #fff;
}

.cell-empty {
  background: #fff;
}

.cell-actions {
  vertical-align: middle;
}

.table-split th:last-child,
.table-split td.cell-actions {
  width: 72px;
  text-align: center;
}

.count-card-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 0.85rem;
}

.articles-count {
  font-size: 0.85rem;
  color: var(--muted);
  font-style: italic;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-link-primary {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
  transition: color 0.2s ease;
}

.btn-link-primary:hover {
  color: var(--accent-strong);
  text-decoration: underline;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem 1rem;
}

/* ============================================
   RESPONSIVE STYLES
   ============================================ */

/* Tablet and below */
@media (max-width: 1024px) {
  .panel-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .header-actions {
    justify-content: flex-start;
    align-items: center;
  }

  .mode-tabs {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .mode-tabs::-webkit-scrollbar {
    height: 6px;
  }

  .mode-tabs::-webkit-scrollbar-thumb {
    background: rgba(15, 23, 42, 0.18);
    border-radius: 999px;
  }

  .table {
    min-width: 900px;
    table-layout: auto;
  }

  .table th,
  .table td {
    font-size: 0.9rem;
    padding: 0.55rem 0.4rem;
    white-space: normal;
  }

  .form-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .calendar-grid {
    grid-template-columns: repeat(7, minmax(100px, 1fr));
    overflow-x: auto;
  }
  
  .calendar-cell {
    min-height: 100px;
    padding: 0.4rem;
  }

  .calendar-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  :deep(.fc) {
    min-width: 700px;
  }
}

/* Mobile */
@media (max-width: 768px) {
  /* Header responsivo */
  .panel-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .header-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .mode-tabs {
    width: 100%;
    justify-content: flex-start;
  }
  
  .tab {
    flex: 1 0 auto;
    padding: 0.5rem 0.5rem;
    font-size: 0.85rem;
    text-align: center;
  }

  .header-actions .btn {
    width: 100%;
  }

  .header-actions .tag {
    align-self: flex-start;
  }
  
  /* Filtros responsivos */
  .form-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .status-filter-list {
    grid-template-columns: 1fr;
  }
  
  .actions {
    grid-column: 1;
    width: 100%;
  }
  
  .actions button {
    flex: 1;
  }
  
  /* Vista de tarjetas */
  .counts-cards-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  
  .count-card {
    padding: 1rem;
  }

  .count-card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
  }

  .count-card-details {
    grid-template-columns: 1fr;
    gap: 0.65rem;
  }
  
  .count-card-title {
    font-size: 1rem;
  }
  
  .articles-codes {
    font-size: 0.75rem;
    padding: 0.5rem;
  }
  
  /* Vista de tabla - 2 filas por registro (móvil) */
  .table-scroll {
    overflow-x: auto;
  }

  .table-split {
    width: 100%;
    min-width: 0;
    table-layout: fixed;
    border: 1px solid var(--line);
    border-collapse: collapse;
    background: #fff;
  }

  .table-split th,
  .table-split td {
    font-size: 0.78rem;
    padding: 0.45rem 0.35rem;
    white-space: normal;
    word-break: break-word;
    overflow-wrap: anywhere;
    line-height: 1.2;
    vertical-align: top;
  }

  .table-split th {
    font-size: 0.7rem;
  }

  .row-split-top td {
    border-bottom: 0;
  }

  .row-split-bottom td {
    border-top: 0;
    border-bottom: 2px solid var(--line);
  }

  .row-split-top td.cell-actions {
    border-bottom: 2px solid var(--line);
  }

  .table-split .cell-actions > div {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
  }

  .table-split .item-codes-cell {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: normal;
  }
  
  /* Calendario responsivo */
  .calendar-grid {
    grid-template-columns: repeat(7, minmax(80px, 1fr));
  }
  
  .calendar-dow {
    font-size: 0.7rem;
    padding: 0.4rem 0.3rem;
  }
  
  .calendar-cell {
    min-height: 80px;
    padding: 0.3rem;
  }
  
  .calendar-date {
    width: 28px;
    height: 28px;
    font-size: 0.85rem;
  }
  
  .calendar-event {
    font-size: 0.7rem;
    padding: 0.25rem 0.35rem;
  }
  
  .month-title {
    font-size: 0.9rem;
    min-width: 140px;
    padding: 0.4rem 0.6rem;
  }
  
  /* FullCalendar mobile */
  .calendar-wrap {
    padding: 0.75rem;
  }
  
  :deep(.fc-toolbar) {
    flex-direction: column;
    gap: 0.75rem;
  }
  
  :deep(.fc-toolbar-chunk) {
    display: flex;
    justify-content: center;
  }
  
  :deep(.fc-toolbar-title) {
    font-size: 1.1rem !important;
  }
  
  :deep(.fc-button) {
    padding: 0.4rem 0.75rem !important;
    font-size: 0.85rem !important;
  }
  
  :deep(.fc-daygrid-day-number) {
    font-size: 0.85rem;
    padding: 0.3rem;
  }
  
  :deep(.fc-event) {
    font-size: 0.75rem;
    padding: 1px 4px;
  }

  :deep(.fc) {
    min-width: 560px;
  }
}

/* Small mobile */
@media (max-width: 480px) {
  .tab {
    padding: 0.4rem 0.3rem;
    font-size: 0.75rem;
  }
  
  .count-card {
    padding: 0.85rem;
  }
  
  .count-folio-link {
    font-size: 0.8rem;
  }
  
  .status-badge {
    font-size: 0.65rem;
    padding: 0.3rem 0.5rem;
  }
  
  .detail-label {
    font-size: 0.65rem;
  }
  
  .detail-value {
    font-size: 0.85rem;
  }
  
  .calendar-grid {
    grid-template-columns: repeat(7, minmax(60px, 1fr));
  }
  
  .calendar-dow {
    font-size: 0.65rem;
    padding: 0.3rem 0.2rem;
  }
  
  .calendar-cell {
    min-height: 60px;
    padding: 0.2rem;
  }
  
  .calendar-date {
    width: 24px;
    height: 24px;
    font-size: 0.75rem;
  }
  
  .calendar-event {
    font-size: 0.65rem;
    padding: 0.2rem 0.3rem;
  }

  :deep(.fc) {
    min-width: 480px;
  }
}

/* ============================================
   END COUNTS CARDS LAYOUT
   ============================================ */

.mutedDay {
  opacity: 0.62;
  background: rgba(15, 23, 42, 0.02);
}

.unscheduled-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.unscheduled-item {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: 12px;
  text-decoration: none;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.8);
}

.unscheduled-item:hover {
  background: var(--panel-muted);
}



/* ============================================
   MODAL STYLES
   ============================================ */

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  overflow-y: auto;
}

.modal-content {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 18px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  margin: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem;
  border-bottom: 1px solid var(--line);
}

.modal-header h3 {
  margin: 0;
  color: var(--ink);
  font-size: 1.25rem;
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
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.btn-close:hover {
  background: var(--panel-muted);
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
  flex-wrap: wrap;
}

/* Modal responsive */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 0.5rem;
    align-items: flex-start;
  }
  
  .modal-content {
    max-width: 100%;
    max-height: 95vh;
    border-radius: 12px;
    margin-top: 0.5rem;
  }
  
  .modal-header {
    padding: 1rem;
  }
  
  .modal-header h3 {
    font-size: 1.1rem;
  }
  
  .modal-body {
    padding: 1rem;
  }
  
  .modal-footer {
    padding: 0.85rem 1rem;
  }
  
  .modal-footer button {
    flex: 1;
    min-width: 120px;
  }
}

@media (max-width: 480px) {
  .modal-overlay {
    padding: 0;
  }
  
  .modal-content {
    border-radius: 0;
    max-height: 100vh;
    margin-top: 0;
  }
  
  .modal-header {
    padding: 0.85rem;
  }
  
  .modal-header h3 {
    font-size: 1rem;
  }
  
  .modal-body {
    padding: 0.85rem;
  }
  
  .modal-footer {
    padding: 0.75rem 0.85rem;
  }
}

/* Ocultar "Tipo de conteo" (se deriva automáticamente) */
.form-grid > div:has(> #modal-type) {
  display: none;
}

/* Fallback (si :has() no está disponible) */
label[for='modal-type'],
#modal-type {
  display: none;
}

.modal-section {
  margin-top: 0.9rem;
  padding-top: 0.9rem;
  border-top: 1px dashed var(--line);
}

.modal-section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.modal-section-header h4 {
  margin: 0;
  font-size: 1rem;
  color: var(--ink);
}

.small {
  font-size: 0.85rem;
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(37, 99, 235, 0.08);
  color: var(--ink);
  font-weight: 600;
  white-space: nowrap;
}

.items-toggle {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
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

.info-banner {
  padding: 0.65rem 0.85rem;
  background: #fff7ed;
  border: 1px solid #fdba74;
  border-radius: 10px;
  font-size: 0.9rem;
  color: var(--ink);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.items-picker {
  margin-top: 0.75rem;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
  padding: 0.75rem;
}

.items-list {
  max-height: 280px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.item-row {
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  margin-bottom: 0.5rem;
}

.item-check {
  display: grid;
  grid-template-columns: 18px 1fr auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.6rem 0.7rem;
  cursor: pointer;
}

.item-check input[type='checkbox'] {
  cursor: pointer;
}

.item-main {
  min-width: 0;
}

.item-code {
  font-weight: 700;
  color: var(--ink);
  letter-spacing: 0.01em;
  font-size: 0.9rem;
}

.item-desc {
  color: var(--muted);
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 90px;
}

/* Items picker responsive */
@media (max-width: 768px) {
  .items-picker {
    padding: 0.5rem;
  }
  
  .items-list {
    max-height: 220px;
  }
  
  .item-check {
    grid-template-columns: 16px 1fr;
    gap: 0.5rem;
    padding: 0.5rem;
  }
  
  .item-meta {
    grid-column: 2;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.25rem;
    min-width: auto;
  }
  
  .item-code {
    font-size: 0.85rem;
  }
  
  .item-desc {
    font-size: 0.8rem;
  }
  
  .item-warehouse-info {
    margin-top: 0.25rem;
  }
}

@media (max-width: 480px) {
  .items-list {
    max-height: 180px;
  }
  
  .item-check {
    padding: 0.4rem;
  }
  
  .item-code {
    font-size: 0.8rem;
  }
  
  .item-desc {
    font-size: 0.75rem;
  }
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

/* Special Lines Badge */
.special-line-badge {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%) !important;
  color: #78350f !important;
  font-weight: 700 !important;
  border: 1px solid #f59e0b !important;
  box-shadow: 0 2px 6px rgba(245, 158, 11, 0.25) !important;
  font-size: 1rem;
  padding: 0.3rem 0.5rem;
  cursor: help;
  transition: transform 0.2s ease;
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
}

.socket-status-dot.connected {
  background-color: #22c55e; /* Verde: conectado */
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.7);
}

.special-line-badge:hover {
  transform: scale(1.05);
}
</style>
