<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import {
  branchesService,
  usersService,
  bulkRequestsService,
  bulkRequestCommentsService,
  notificationsService,
  auditService,
  type Branch,
  type UserOption,
  type BulkRequest,
  type BulkRequestStatus,
  type BulkRequestComment,
  type BulkRequestFileDownload
} from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useSocketStore } from '@/stores/socket'
import MobileMenuToggle from '@/components/MobileMenuToggle.vue'

const auth = useAuthStore()
const socketStore = useSocketStore()
const route = useRoute()
const router = useRouter()

const MAX_FILES = 3
const ALLOWED_EXTENSIONS = ['.csv', '.xls', '.xlsx']

const canCreate = computed(() => auth.hasPermission('bulk_requests.create'))
const canManage = computed(() => auth.hasPermission('bulk_requests.manage'))
const canSeeList = computed(() => canCreate.value || canManage.value)

const priorityOptions = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'mostrador', label: 'Mostrador' }
]

const priorityLabel: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
  mostrador: 'Mostrador'
}

const statusLabelMap: Record<BulkRequestStatus, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  ajustado: 'Ajustado',
  rechazado: 'Rechazado'
}

const statusTransitions: Record<BulkRequestStatus, BulkRequestStatus[]> = {
  pendiente: ['en_revision'],
  en_revision: ['ajustado', 'rechazado'],
  ajustado: [],
  rechazado: []
}

const statusLabel = (status: string) => statusLabelMap[status as BulkRequestStatus] || status

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('es-MX') : '-')

// ============================================
// HISTORIAL DE ESTATUS
// ============================================

type StatusHistoryItem = {
  id: string
  status: BulkRequestStatus
  userLabel: string
  at: string
  isCurrent: boolean
}

type AuditLogRecord = {
  id?: number
  user_id: number | null
  user_name?: string | null
  entity_id: number
  old_values?: unknown
  new_values?: unknown
  created_at?: string
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

const toBulkRequestStatus = (value: unknown): BulkRequestStatus | null => {
  if (value === 'pendiente' || value === 'en_revision' || value === 'ajustado' || value === 'rechazado') {
    return value
  }
  return null
}

const statusHistoryLoading = ref(false)
const statusHistoryError = ref('')
const statusHistoryItems = ref<StatusHistoryItem[]>([])

const statusHistoryLegend = computed(() => {
  if (!managing.value) return 'Historial de cambios de estatus de la solicitud.'
  return `Estatus actual: ${statusLabel(managing.value.status)}.`
})

const buildInitialStatusHistory = (bulkRequest: BulkRequest): StatusHistoryItem => ({
  id: `created-${bulkRequest.id}`,
  status: 'pendiente',
  userLabel: bulkRequest.requested_by_name || `Usuario #${bulkRequest.requested_by_user_id}`,
  at: bulkRequest.created_at,
  isCurrent: false
})

const loadStatusHistory = async (bulkRequest: BulkRequest) => {
  statusHistoryLoading.value = true
  statusHistoryError.value = ''
  try {
    const response = await auditService.getLogs({
      entity_type: 'bulk_request',
      entity_id: bulkRequest.id,
      limit: 100,
      offset: 0
    })

    const logs = Array.isArray(response?.logs) ? (response.logs as AuditLogRecord[]) : []
    const updates = logs
      .map((log) => {
        const oldPayload = parseJsonObject(log.old_values)
        const newPayload = parseJsonObject(log.new_values)
        const oldStatus = toBulkRequestStatus(oldPayload?.status)
        const newStatus = toBulkRequestStatus(newPayload?.status)
        if (!newStatus) return null
        if (oldStatus && oldStatus === newStatus) return null
        return {
          id: `audit-${log.id ?? `${log.created_at ?? 'na'}-${newStatus}`}`,
          status: newStatus,
          userLabel: log.user_name || (log.user_id ? `Usuario #${log.user_id}` : 'Sistema'),
          at: log.created_at || bulkRequest.updated_at,
          isCurrent: false
        } as StatusHistoryItem
      })
      .filter((item): item is StatusHistoryItem => item !== null)
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

    const timeline = [buildInitialStatusHistory(bulkRequest), ...updates]
    const currentIdx = [...timeline]
      .map((item, idx) => ({ idx, match: item.status === bulkRequest.status }))
      .filter((x) => x.match)
      .map((x) => x.idx)
      .pop()

    statusHistoryItems.value = timeline.map((item, idx) => ({
      ...item,
      isCurrent: currentIdx === idx
    }))
  } catch (err) {
    console.error('Error loading bulk request status history', err)
    statusHistoryError.value = 'No se pudo cargar el historial de estatus.'
    statusHistoryItems.value = []
  } finally {
    statusHistoryLoading.value = false
  }
}

// ============================================
// FORM DE CREACIÓN
// ============================================

const branches = ref<Branch[]>([])
const connectedBranches = computed(() => branches.value.filter((b) => b.status === 'connected'))
const warehouses = ref<Array<{ id: number; name: string }>>([])
const warehousesLoading = ref(false)
const users = ref<UserOption[]>([])

const form = reactive({
  branch_id: '',
  warehouse_id: '',
  priority: 'media',
  responsible_user_id: '',
  notes: ''
})

const loading = ref(false)
const error = ref('')
const success = ref('')

type FilePreview = {
  name: string
  rows: string[][]
  truncated: boolean
  error?: string
}

const selectedFiles = ref<File[]>([])
const previews = ref<FilePreview[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)

const loadBranches = async () => {
  try {
    const data = await branchesService.getAll()
    branches.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error loading branches', err)
  }
}

const loadWarehouses = async (branchId: string) => {
  warehouses.value = []
  form.warehouse_id = ''
  if (!branchId) return
  try {
    warehousesLoading.value = true
    const resp = await branchesService.getWarehouses(Number(branchId))
    const list = Array.isArray(resp?.warehouses) ? resp.warehouses : []
    warehouses.value = list.map((w: any) => ({ id: w.id, name: w.name || `Almacén ${w.id}` }))
    if (warehouses.value.length === 0) {
      warehouses.value = [{ id: 1, name: 'Sucursal principal' }]
    }
  } catch (err) {
    console.error('Error loading warehouses', err)
    warehouses.value = [{ id: 1, name: 'Sucursal principal' }]
  } finally {
    warehousesLoading.value = false
  }
}

watch(() => form.branch_id, (branchId) => {
  loadWarehouses(branchId)
})

const loadUsers = async () => {
  try {
    const data = await usersService.getAll()
    users.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error loading users', err)
  }
}

const setDefaultResponsible = () => {
  if (auth.user?.id) {
    form.responsible_user_id = String(auth.user.id)
  }
}

const hasValidExtension = (fileName: string) => {
  const lower = fileName.toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

const buildCsvPreview = (file: File): Promise<FilePreview> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const lines = text.split(/\r?\n/).filter((line) => line.length > 0)
      const rows = lines.slice(0, 20).map((line) => line.split(','))
      resolve({ name: file.name, rows, truncated: lines.length > 20 })
    }
    reader.onerror = () => resolve({ name: file.name, rows: [], truncated: false, error: 'No se pudo leer el archivo' })
    reader.readAsText(file)
  })
}

const buildExcelPreview = (file: File): Promise<FilePreview> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) {
          resolve({ name: file.name, rows: [], truncated: false, error: 'El archivo Excel no tiene hojas' })
          return
        }
        const sheet = workbook.Sheets[firstSheetName]
        if (!sheet) {
          resolve({ name: file.name, rows: [], truncated: false, error: 'El archivo Excel no tiene hojas' })
          return
        }
        const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false })
        const rows = json.slice(0, 20).map((row) => (row || []).map((cell) => (cell === undefined || cell === null ? '' : String(cell))))
        resolve({ name: file.name, rows, truncated: json.length > 20 })
      } catch (err) {
        console.error('Error parsing excel preview', err)
        resolve({ name: file.name, rows: [], truncated: false, error: 'No se pudo leer el archivo Excel' })
      }
    }
    reader.onerror = () => resolve({ name: file.name, rows: [], truncated: false, error: 'No se pudo leer el archivo' })
    reader.readAsArrayBuffer(file)
  })
}

const buildPreview = (file: File): Promise<FilePreview> => {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.csv')) return buildCsvPreview(file)
  return buildExcelPreview(file)
}

const refreshPreviews = async () => {
  previews.value = await Promise.all(selectedFiles.value.map((file) => buildPreview(file)))
}

const onFilesSelected = async (event: Event) => {
  error.value = ''
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files || [])
  input.value = ''
  if (!picked.length) return

  const invalid = picked.find((file) => !hasValidExtension(file.name))
  if (invalid) {
    error.value = `Archivo no permitido: ${invalid.name}. Solo se aceptan .csv, .xls, .xlsx`
    return
  }

  const combined = [...selectedFiles.value, ...picked]
  if (combined.length > MAX_FILES) {
    error.value = `Solo puedes adjuntar hasta ${MAX_FILES} archivos`
    return
  }

  selectedFiles.value = combined
  await refreshPreviews()
}

const removeFile = async (index: number) => {
  selectedFiles.value = selectedFiles.value.filter((_, i) => i !== index)
  await refreshPreviews()
}

const resetForm = () => {
  form.branch_id = ''
  form.warehouse_id = ''
  form.priority = 'media'
  form.notes = ''
  setDefaultResponsible()
  selectedFiles.value = []
  previews.value = []
  error.value = ''
}

const submit = async () => {
  success.value = ''
  error.value = ''

  if (!form.branch_id || !form.warehouse_id || !form.responsible_user_id) {
    error.value = 'Sucursal, almacén y responsable son obligatorios'
    return
  }
  if (!form.notes.trim()) {
    error.value = 'Las observaciones son obligatorias'
    return
  }
  if (selectedFiles.value.length === 0) {
    error.value = 'Debes adjuntar al menos un archivo (CSV o Excel)'
    return
  }
  if (selectedFiles.value.length > MAX_FILES) {
    error.value = `Solo puedes adjuntar hasta ${MAX_FILES} archivos`
    return
  }

  const warehouseInfo = warehouses.value.find((w) => String(w.id) === String(form.warehouse_id))

  try {
    loading.value = true
    const created = await bulkRequestsService.create({
      branch_id: Number(form.branch_id),
      warehouse_id: Number(form.warehouse_id),
      warehouse_name: warehouseInfo?.name,
      priority: form.priority,
      responsible_user_id: Number(form.responsible_user_id),
      notes: form.notes.trim(),
      files: selectedFiles.value
    })

    success.value = `Solicitud masiva creada con folio ${created.folio}`
    resetForm()
    closeCreate()
    await loadRequests()
  } catch (err: any) {
    console.error('Error creating bulk request', err)
    error.value = err?.response?.data?.error || 'No se pudo crear la solicitud masiva'
  } finally {
    loading.value = false
  }
}

const showCreateModal = ref(false)

const openCreate = () => {
  resetForm()
  success.value = ''
  showCreateModal.value = true
}

const closeCreate = () => {
  showCreateModal.value = false
}

// ============================================
// LISTADO
// ============================================

const requests = ref<BulkRequest[]>([])
const listLoading = ref(false)
const listError = ref('')

const total = ref(0)
const offset = ref(0)
const isMobile = ref(false)
const filtersOpen = ref(true)

const filters = reactive<{
  statuses: BulkRequestStatus[]
  branch_id: number | ''
  priority: string
  date_from: string
  date_to: string
  limit: number
}>({
  statuses: ['pendiente', 'en_revision'],
  branch_id: '',
  priority: '',
  date_from: '',
  date_to: '',
  limit: 50
})

const pageInfo = computed(() => {
  const start = total.value === 0 ? 0 : offset.value + 1
  const end = Math.min(offset.value + filters.limit, total.value)
  return { start, end }
})

const toggleFilters = () => {
  filtersOpen.value = !filtersOpen.value
}

const updateIsMobile = () => {
  if (typeof window === 'undefined') return
  const nextIsMobile = window.matchMedia('(max-width: 1024px)').matches
  if (nextIsMobile !== isMobile.value) {
    isMobile.value = nextIsMobile
    filtersOpen.value = !nextIsMobile
  }
}

const branchName = (branchId: number) => branches.value.find((b) => b.id === branchId)?.name || `Sucursal ${branchId}`

const loadRequests = async () => {
  try {
    listLoading.value = true
    listError.value = ''
    const result = await bulkRequestsService.list({
      status: filters.statuses.length ? filters.statuses : undefined,
      branch_id: filters.branch_id || undefined,
      priority: filters.priority || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      limit: filters.limit,
      offset: offset.value
    })
    requests.value = Array.isArray(result?.requests) ? result.requests : []
    total.value = Number(result?.total ?? 0)
  } catch (err) {
    console.error('Error loading bulk requests', err)
    listError.value = 'No se pudieron cargar las solicitudes'
  } finally {
    listLoading.value = false
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

// ============================================
// MODAL DE GESTIÓN
// ============================================

const showManageModal = ref(false)
const managing = ref<BulkRequest | null>(null)
const manageStatus = ref<BulkRequestStatus>('pendiente')
const modalHeaderToneClass = computed(() =>
  managing.value?.status ? `modal-header--${managing.value.status}` : 'modal-header--default'
)
const showImagePreviewModal = ref(false)
const previewImageUrl = ref('')
const manageMovementNumber = ref('')
const manageResolutionNotes = ref('')
const savingManage = ref(false)
const manageError = ref('')
const downloadingFileId = ref<number | null>(null)
const fileDownloads = ref<Map<number, BulkRequestFileDownload[]>>(new Map())
const fileDownloadsLoading = ref<Set<number>>(new Set())
const expandedFileId = ref<number | null>(null)

const loadFileDownloads = async (bulkRequestId: number, fileId: number) => {
  fileDownloadsLoading.value.add(fileId)
  try {
    const resp = await bulkRequestsService.getFileDownloads(bulkRequestId, fileId)
    fileDownloads.value.set(fileId, Array.isArray(resp?.downloads) ? resp.downloads : [])
  } catch (err) {
    console.error('Error loading file downloads', err)
  } finally {
    fileDownloadsLoading.value.delete(fileId)
  }
}

const toggleFileDownloads = (fileId: number) => {
  expandedFileId.value = expandedFileId.value === fileId ? null : fileId
}

const bulkRequestStatusOptions: BulkRequestStatus[] = ['pendiente', 'en_revision', 'ajustado', 'rechazado']

const isManageStatusOptionDisabled = (option: BulkRequestStatus) => {
  if (!managing.value) return false
  const current = managing.value.status
  return option !== current && !statusTransitions[current].includes(option)
}

const requiresMovementNumber = computed(() => manageStatus.value === 'ajustado')
const requiresRejectionReason = computed(() => manageStatus.value === 'rechazado')

const isStatusChangeValid = computed(() => {
  if (!managing.value) return false
  const current = managing.value.status
  if (manageStatus.value === current) return false
  return statusTransitions[current].includes(manageStatus.value)
})

const canSaveManage = computed(() => {
  if (!isStatusChangeValid.value) return false
  if (requiresMovementNumber.value && !manageMovementNumber.value.trim()) return false
  if (requiresRejectionReason.value && !manageResolutionNotes.value.trim()) return false
  return true
})

// ============================================
// CHAT EN VIVO
// ============================================

const chatComments = ref<BulkRequestComment[]>([])
const chatLoading = ref(false)
const chatError = ref('')
const chatMessage = ref('')
const chatSending = ref(false)
const chatScrollRef = ref<HTMLDivElement | null>(null)

const chatFile = ref<File | null>(null)
const chatFilePreviewUrl = ref('')
const chatFileInputRef = ref<HTMLInputElement | null>(null)
const attachmentUrls = ref<Map<number, string>>(new Map())
const attachmentLoading = ref<Set<number>>(new Set())

const isImageMime = (mime?: string | null) => !!mime && mime.startsWith('image/')

const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const scrollChatToBottom = () => {
  setTimeout(() => {
    if (chatScrollRef.value) {
      chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight
    }
  }, 50)
}

const loadAttachmentPreview = async (comment: BulkRequestComment) => {
  if (!managing.value) return
  if (!isImageMime(comment.attachment_mime_type)) return
  if (attachmentUrls.value.has(comment.id) || attachmentLoading.value.has(comment.id)) return
  attachmentLoading.value.add(comment.id)
  try {
    const blob = await bulkRequestCommentsService.downloadAttachment(managing.value.id, comment.id)
    attachmentUrls.value.set(comment.id, URL.createObjectURL(blob))
  } catch (err) {
    console.error('Error loading attachment preview', err)
  } finally {
    attachmentLoading.value.delete(comment.id)
  }
}

const preloadImageAttachments = () => {
  chatComments.value.forEach((c) => {
    if (isImageMime(c.attachment_mime_type)) void loadAttachmentPreview(c)
  })
}

const openImagePreview = (commentId: number) => {
  const url = attachmentUrls.value.get(commentId)
  if (url) {
    previewImageUrl.value = url
    showImagePreviewModal.value = true
  }
}

const downloadCommentAttachment = async (comment: BulkRequestComment) => {
  if (!managing.value || !comment.attachment_original_name) return
  try {
    const blob = await bulkRequestCommentsService.downloadAttachment(managing.value.id, comment.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = comment.attachment_original_name
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Error downloading attachment', err)
    alert('No se pudo descargar el adjunto')
  }
}

const clearAttachmentUrls = () => {
  attachmentUrls.value.forEach((url) => URL.revokeObjectURL(url))
  attachmentUrls.value = new Map()
}

const onChatFileSelected = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    alert('El archivo supera el límite de 10MB')
    return
  }
  if (chatFilePreviewUrl.value) URL.revokeObjectURL(chatFilePreviewUrl.value)
  chatFile.value = file
  chatFilePreviewUrl.value = file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
}

const removeChatFile = () => {
  if (chatFilePreviewUrl.value) URL.revokeObjectURL(chatFilePreviewUrl.value)
  chatFile.value = null
  chatFilePreviewUrl.value = ''
}

const loadComments = async (bulkRequestId: number) => {
  chatLoading.value = true
  chatError.value = ''
  try {
    const resp = await bulkRequestCommentsService.list(bulkRequestId)
    chatComments.value = Array.isArray(resp?.comments) ? resp.comments : []
    scrollChatToBottom()
    preloadImageAttachments()
  } catch (err) {
    console.error('Error loading comments', err)
    chatError.value = 'No se pudo cargar el chat.'
  } finally {
    chatLoading.value = false
  }
}

const sendComment = async () => {
  if (!managing.value) return
  const msg = chatMessage.value.trim()
  if ((!msg && !chatFile.value) || chatSending.value) return
  chatSending.value = true
  try {
    await bulkRequestCommentsService.create(managing.value.id, { message: msg, file: chatFile.value || undefined })
    chatMessage.value = ''
    removeChatFile()
    // El WebSocket agrega el mensaje; si no hay WS se puede recargar manualmente
  } catch (err) {
    console.error('Error sending comment', err)
    alert('No se pudo enviar el mensaje.')
  } finally {
    chatSending.value = false
  }
}

let bulkRequestCommentCleanup: (() => void) | null = null

const openManage = (row: BulkRequest) => {
  managing.value = row
  manageStatus.value = row.status
  manageMovementNumber.value = row.movement_number || ''
  manageResolutionNotes.value = row.resolution_notes || ''
  manageError.value = ''
  showManageModal.value = true
  void loadStatusHistory(row)

  fileDownloads.value = new Map()
  expandedFileId.value = null
  row.files?.forEach((file) => void loadFileDownloads(row.id, file.id))

  chatComments.value = []
  chatMessage.value = ''
  chatError.value = ''
  void loadComments(row.id)
  socketStore.joinBulkRequest(row.id)

  notificationsService.markReadForEntity('bulk_request', row.id).catch((err) => {
    console.error('Error marking notifications read', err)
  })
}

const closeManage = () => {
  if (managing.value) {
    socketStore.leaveBulkRequest(managing.value.id)
  }
  showManageModal.value = false
  managing.value = null
  statusHistoryItems.value = []
  statusHistoryError.value = ''
  statusHistoryLoading.value = false
  fileDownloads.value = new Map()
  expandedFileId.value = null
  chatComments.value = []
  chatMessage.value = ''
  chatError.value = ''
  removeChatFile()
  clearAttachmentUrls()
}

const saveManage = async () => {
  if (!managing.value || !canSaveManage.value) return
  try {
    savingManage.value = true
    manageError.value = ''
    const updated = await bulkRequestsService.updateStatus(managing.value.id, {
      status: manageStatus.value,
      movement_number: requiresMovementNumber.value ? manageMovementNumber.value.trim() : undefined,
      resolution_notes: requiresRejectionReason.value ? manageResolutionNotes.value.trim() : undefined
    })
    const index = requests.value.findIndex((r) => r.id === updated.id)
    if (index !== -1) requests.value[index] = updated
    managing.value = updated
    manageStatus.value = updated.status
    void loadStatusHistory(updated)
  } catch (err: any) {
    console.error('Error updating bulk request status', err)
    manageError.value = err?.response?.data?.error || 'No se pudo actualizar el estatus'
  } finally {
    savingManage.value = false
  }
}

const downloadFile = async (bulkRequestId: number, file: { id: number; original_name: string }) => {
  try {
    downloadingFileId.value = file.id
    const blob = await bulkRequestsService.downloadFile(bulkRequestId, file.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.original_name
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    void loadFileDownloads(bulkRequestId, file.id)
  } catch (err) {
    console.error('Error downloading file', err)
    manageError.value = 'No se pudo descargar el archivo'
  } finally {
    downloadingFileId.value = null
  }
}

const openFromQuery = async () => {
  const openId = Number(route.query.open)
  if (!Number.isFinite(openId) || openId <= 0) return

  try {
    const bulkRequest = await bulkRequestsService.getById(openId)
    openManage(bulkRequest)
  } catch (err) {
    console.error('Error opening bulk request from notification', err)
  }
  const { open: _open, ...restQuery } = route.query
  router.replace({ query: restQuery })
}

watch(() => route.query.open, (value) => {
  if (value) openFromQuery()
})

onMounted(async () => {
  auth.initializeAuth()
  setDefaultResponsible()
  updateIsMobile()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateIsMobile)
  }
  await Promise.all([loadBranches(), loadUsers()])
  if (canSeeList.value) {
    await loadRequests()
  }

  await openFromQuery()

  bulkRequestCommentCleanup = socketStore.on('bulk_request_comment', (payload: any) => {
    const comment = payload?.data
    if (!comment || !managing.value || comment.bulk_request_id !== managing.value.id) return
    if (!chatComments.value.find((c) => c.id === comment.id)) {
      chatComments.value.push(comment)
      scrollChatToBottom()
      if (isImageMime(comment.attachment_mime_type)) void loadAttachmentPreview(comment)
    }
  })
})

onUnmounted(() => {
  bulkRequestCommentCleanup?.()
  if (managing.value) {
    socketStore.leaveBulkRequest(managing.value.id)
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateIsMobile)
  }
  clearAttachmentUrls()
  removeChatFile()
})
</script>

<template>
  <section v-if="canSeeList" class="panel wide">
    <div class="panel-top">
      <div class="panel-header">
        <div class="panel-title">
          <MobileMenuToggle />
          <div class="panel-title-text">
            <p class="eyebrow">Solicitudes</p>
            <h2>Diferencias masivas</h2>
            <p class="muted">Solicitudes de ajuste masivo por archivo (CSV/Excel) y su seguimiento.</p>
          </div>
        </div>
        <div class="header-actions">
          <div class="connection-status" :class="{ connected: socketStore.connected }">
            <span class="status-dot"></span>
            <span class="status-text">{{ socketStore.connected ? 'Conectado' : 'Desconectado' }}</span>
          </div>
          <span class="tag accent">{{ total }} solicitudes</span>
          <button class="btn ghost" :disabled="listLoading" @click="loadRequests">Actualizar</button>
          <button v-if="canCreate" class="btn" @click="openCreate">Nueva solicitud masiva</button>
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
                v-for="statusOption in bulkRequestStatusOptions"
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
            <label>Prioridad</label>
            <select v-model="filters.priority" @change="applyFilters">
              <option value="">Todas</option>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
              <option value="mostrador">Mostrador</option>
            </select>
          </div>
          <div>
            <label>Fecha Desde</label>
            <input
              v-model="filters.date_from"
              type="date"
              @change="applyFilters"
            />
          </div>
          <div>
            <label>Fecha Hasta</label>
            <input
              v-model="filters.date_to"
              type="date"
              @change="applyFilters"
            />
          </div>
          <div>
            <label>Límite</label>
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

    <p v-if="success" class="success-message">{{ success }}</p>
    <p v-if="listError" class="error-message">{{ listError }}</p>

    <div class="table-wrap">
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Sucursal</th>
              <th>Almacén</th>
              <th>Prioridad</th>
              <th>Responsable</th>
              <th>Archivos</th>
              <th>Estatus</th>
              <th>Creada</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in requests" :key="row.id">
              <td><strong>{{ row.folio }}</strong></td>
              <td>{{ row.branch_name || branchName(row.branch_id) }}</td>
              <td>{{ row.warehouse_name || `Almacén ${row.warehouse_id}` }}</td>
              <td>
                <span :class="['priority-badge', row.priority || 'media']">
                  {{ priorityLabel[row.priority] || row.priority }}
                </span>
              </td>
              <td>{{ row.responsible_name || '-' }}</td>
              <td>{{ row.files?.length || 0 }}</td>
              <td>
                <span :class="['status-pill', row.status]">{{ statusLabel(row.status) }}</span>
              </td>
              <td class="muted">{{ formatDateTime(row.created_at) }}</td>
              <td>
                <button v-if="canManage" class="btn small" @click="openManage(row)">Gestionar</button>
              </td>
            </tr>
            <tr v-if="!listLoading && requests.length === 0">
              <td colspan="9" class="muted" style="text-align: center; padding: 1rem">
                Sin solicitudes registradas
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- Modal gestión -->
  <div v-if="showManageModal" class="modal-overlay" @click="closeManage">
    <div class="modal-content" @click.stop>
      <div class="modal-header" :class="modalHeaderToneClass">
        <div>
          <p class="eyebrow">Diferencias masivas</p>
          <h3 v-if="managing">{{ managing.folio }}</h3>
          <p v-if="managing" class="muted">
            {{ managing.branch_name || branchName(managing.branch_id) }} · {{ managing.warehouse_name || `Almacén ${managing.warehouse_id}` }}
          </p>
        </div>
        <button class="btn-close" type="button" aria-label="Cerrar" @click="closeManage">&times;</button>
      </div>

      <div v-if="managing" class="modal-body">
        <div class="modal-summary-grid">
          <div>
            <p class="detail-label">Prioridad</p>
            <p class="detail-value">{{ priorityLabel[managing.priority] || managing.priority }}</p>
          </div>
          <div>
            <p class="detail-label">Responsable</p>
            <p class="detail-value">{{ managing.responsible_name || '-' }}</p>
          </div>
          <div>
            <p class="detail-label">Solicitó</p>
            <p class="detail-value">{{ managing.requested_by_name || '-' }}</p>
          </div>
          <div>
            <p class="detail-label">Estatus actual</p>
            <p class="detail-value">
              <span :class="['status-pill', managing.status]">{{ statusLabel(managing.status) }}</span>
            </p>
          </div>
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

        <div class="modal-notes">
          <p class="detail-label">Observaciones</p>
          <p class="detail-value">{{ managing.notes }}</p>
        </div>

        <div class="modal-files">
          <p class="detail-label">Archivos adjuntos</p>
          <div v-if="!managing.files?.length" class="muted">Sin archivos</div>
          <div v-else class="file-list">
            <div v-for="file in managing.files" :key="file.id" class="file-list-entry">
              <div class="file-list-item">
                <span>{{ file.original_name }}</span>
                <div class="file-list-actions">
                  <button
                    type="button"
                    class="file-downloads-count"
                    @click="toggleFileDownloads(file.id)"
                  >
                    {{ fileDownloadsLoading.has(file.id) ? '...' : (fileDownloads.get(file.id)?.length || 0) }} descargas
                  </button>
                  <button
                    class="btn ghost small"
                    :disabled="downloadingFileId === file.id"
                    @click="downloadFile(managing.id, file)"
                  >
                    {{ downloadingFileId === file.id ? 'Descargando...' : 'Descargar' }}
                  </button>
                </div>
              </div>
              <div v-if="expandedFileId === file.id" class="file-downloads-list">
                <p v-if="!fileDownloads.get(file.id)?.length" class="muted">Nadie ha descargado este archivo.</p>
                <div v-else v-for="d in fileDownloads.get(file.id)" :key="d.id" class="file-downloads-item">
                  <span>{{ d.user_name || `Usuario #${d.user_id}` }}</span>
                  <span class="muted">{{ formatDateTime(d.downloaded_at) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-form">
          <div class="modal-form-grid">
            <div>
              <label for="manage-status">Nuevo estatus</label>
              <select id="manage-status" v-model="manageStatus">
                <option
                  v-for="opt in bulkRequestStatusOptions"
                  :key="opt"
                  :value="opt"
                  :disabled="isManageStatusOptionDisabled(opt)"
                >
                  {{ statusLabel(opt) }}
                </option>
              </select>
            </div>
            <div v-if="requiresMovementNumber">
              <label for="manage-movement">
                Número de movimiento (MAGIC)
                <span class="required-pill">Obligatorio</span>
              </label>
              <input id="manage-movement" v-model="manageMovementNumber" type="text" placeholder="Ej. 123456" />
            </div>
          </div>
          <div v-if="requiresRejectionReason" style="margin-top: 0.6rem">
            <label for="manage-rejection">
              Motivo de rechazo
              <span class="required-pill">Obligatorio</span>
            </label>
            <textarea id="manage-rejection" v-model="manageResolutionNotes" rows="3" placeholder="Explica el motivo..."></textarea>
          </div>
        </div>

        <p v-if="manageError" class="error-message">{{ manageError }}</p>

        <!-- Chat en vivo -->
        <section class="chat-section">
          <div class="chat-section-head">
            <div class="chat-section-title-row">
              <span class="chat-icon">&#128172;</span>
              <h4>Chat en vivo</h4>
              <span class="chat-badge">{{ chatComments.length }}</span>
            </div>
            <p class="chat-subtitle">Comunicación en tiempo real sobre esta solicitud.</p>
          </div>

          <div class="chat-messages" ref="chatScrollRef">
            <p v-if="chatLoading" class="chat-empty">Cargando mensajes...</p>
            <p v-else-if="chatError" class="chat-empty chat-empty--error">{{ chatError }}</p>
            <p v-else-if="chatComments.length === 0" class="chat-empty">Sin mensajes aún. ¡Inicia la conversación!</p>
            <div v-else class="chat-list">
              <div
                v-for="c in chatComments"
                :key="c.id"
                class="chat-bubble"
                :class="{ 'chat-bubble--own': c.user_id === auth.user?.id }"
              >
                <div class="chat-bubble-meta">
                  <span class="chat-bubble-author">{{ c.user_name || 'Usuario' }}</span>
                  <span class="chat-bubble-time">{{ formatDateTime(c.created_at) }}</span>
                </div>
                <p v-if="c.message" class="chat-bubble-text">{{ c.message }}</p>
                <div v-if="c.attachment_original_name" class="chat-attachment">
                  <img
                    v-if="isImageMime(c.attachment_mime_type) && attachmentUrls.get(c.id)"
                    :src="attachmentUrls.get(c.id)"
                    class="chat-attachment-image"
                    :alt="c.attachment_original_name"
                    @click="openImagePreview(c.id)"
                  />
                  <p v-else-if="isImageMime(c.attachment_mime_type)" class="chat-attachment-loading">Cargando imagen...</p>
                  <button
                    v-else
                    type="button"
                    class="chat-attachment-file"
                    @click="downloadCommentAttachment(c)"
                  >
                    <span class="chat-attachment-icon">&#128206;</span>
                    <span class="chat-attachment-name">{{ c.attachment_original_name }}</span>
                    <span class="chat-attachment-size">{{ formatFileSize(c.attachment_size_bytes) }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="chatFile" class="chat-file-chip">
            <img v-if="chatFilePreviewUrl" :src="chatFilePreviewUrl" class="chat-file-chip-thumb" alt="" />
            <span v-else class="chat-attachment-icon">&#128206;</span>
            <span class="chat-file-chip-name">{{ chatFile.name }}</span>
            <button type="button" class="chat-file-chip-remove" @click="removeChatFile">&times;</button>
          </div>

          <form class="chat-input-row" @submit.prevent="sendComment">
            <label class="chat-attach-btn" title="Adjuntar archivo">
              &#128206;
              <input
                ref="chatFileInputRef"
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                style="display: none"
                @change="onChatFileSelected"
              />
            </label>
            <input
              id="bulk-chat-message-input"
              v-model="chatMessage"
              type="text"
              placeholder="Escribe un mensaje..."
              maxlength="2000"
              autocomplete="off"
              :disabled="chatSending"
              class="chat-input"
            />
            <button type="submit" class="btn chat-send-btn" :disabled="(!chatMessage.trim() && !chatFile) || chatSending">
              {{ chatSending ? '...' : 'Enviar' }}
            </button>
          </form>
        </section>
      </div>

      <div class="modal-footer">
        <button class="btn ghost" @click="closeManage">Cerrar</button>
        <button class="btn" :disabled="!canSaveManage || savingManage" @click="saveManage">
          {{ savingManage ? 'Guardando...' : 'Guardar cambios' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Modal creación -->
  <div v-if="showCreateModal" class="modal-overlay" @click="closeCreate">
    <div class="modal-content modal-content--wide" @click.stop>
      <div class="modal-header">
        <div>
          <p class="eyebrow">Solicitudes</p>
          <h3>Nueva solicitud masiva</h3>
          <p class="muted">Ajuste masivo por archivo. Adjunta hasta {{ MAX_FILES }} archivos CSV o Excel.</p>
        </div>
        <button class="btn-close" type="button" aria-label="Cerrar" @click="closeCreate">&times;</button>
      </div>

      <div class="modal-body">
        <div class="form-grid">
          <div>
            <label for="bulk-branch">Sucursal *</label>
            <select id="bulk-branch" v-model="form.branch_id" required>
              <option value="">Selecciona</option>
              <option v-for="branch in connectedBranches" :key="branch.id" :value="branch.id">
                {{ branch.name }}
              </option>
            </select>
          </div>
          <div>
            <label for="bulk-warehouse">Almacén *</label>
            <select id="bulk-warehouse" v-model="form.warehouse_id" :disabled="!form.branch_id || warehousesLoading" required>
              <option value="">{{ warehousesLoading ? 'Cargando...' : 'Selecciona' }}</option>
              <option v-for="wh in warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
            </select>
          </div>
          <div>
            <label for="bulk-classification">Clasificación</label>
            <select id="bulk-classification" value="ajuste" disabled>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>
          <div>
            <label for="bulk-priority">Prioridad</label>
            <select id="bulk-priority" v-model="form.priority">
              <option v-for="opt in priorityOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div>
            <label for="bulk-responsible">Responsable *</label>
            <select id="bulk-responsible" v-model="form.responsible_user_id" required>
              <option value="">Selecciona</option>
              <option v-for="user in users" :key="user.id" :value="user.id">
                {{ user.name }}{{ user.role_name ? ` - [${user.role_name}]` : '' }}
              </option>
            </select>
          </div>
        </div>

        <div>
          <label for="bulk-notes">Observaciones *</label>
          <textarea
            id="bulk-notes"
            v-model="form.notes"
            placeholder="Describe el motivo del ajuste masivo..."
            required
          ></textarea>
        </div>

        <section class="panel-inner">
          <div class="panel-inner-header">
            <div>
              <p class="eyebrow">Archivos</p>
              <h3>Adjuntar CSV o Excel</h3>
              <p class="muted">Mínimo 1 archivo, máximo {{ MAX_FILES }}. Formatos: .csv, .xls, .xlsx</p>
            </div>
            <label class="btn ghost file-picker-btn">
              Seleccionar archivos
              <input
                ref="fileInputRef"
                type="file"
                multiple
                accept=".csv,.xls,.xlsx"
                style="display: none"
                @change="onFilesSelected"
              />
            </label>
          </div>

          <p v-if="selectedFiles.length === 0" class="muted">No hay archivos seleccionados.</p>

          <div v-for="(preview, index) in previews" :key="preview.name + index" class="file-preview-card">
            <div class="file-preview-head">
              <strong>{{ preview.name }}</strong>
              <button type="button" class="btn ghost small" @click="removeFile(index)">Quitar</button>
            </div>
            <p v-if="preview.error" class="error-message">{{ preview.error }}</p>
            <div v-else-if="preview.rows.length" class="preview-table-wrap">
              <table class="preview-table">
                <tbody>
                  <tr v-for="(row, rIndex) in preview.rows" :key="rIndex">
                    <td v-for="(cell, cIndex) in row" :key="cIndex">{{ cell }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-if="preview.truncated" class="muted small-note">Mostrando las primeras 20 filas...</p>
            </div>
            <p v-else class="muted">Archivo vacío o sin datos para previsualizar.</p>
          </div>
        </section>

        <p v-if="error" class="error-message">{{ error }}</p>
      </div>

      <div class="modal-footer">
        <button class="btn ghost" :disabled="loading" @click="closeCreate">Cancelar</button>
        <button class="btn" :disabled="loading" @click="submit">
          {{ loading ? 'Enviando...' : 'Crear solicitud masiva' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Modal de vista previa de imagen -->
  <div v-if="showImagePreviewModal" class="image-preview-overlay" @click="showImagePreviewModal = false">
    <div class="image-preview-container" @click.stop>
      <button class="btn-close-preview" type="button" aria-label="Cerrar" @click="showImagePreviewModal = false">&times;</button>
      <img :src="previewImageUrl" class="image-preview-img" alt="Vista previa de adjunto" />
    </div>
  </div>
</template>

<style scoped>
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 1.1rem;
  box-shadow: var(--surface-glow, 0 15px 40px rgba(31, 41, 55, 0.08));
}

.panel.wide {
  width: 100%;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.9rem;
  flex-wrap: wrap;
}

.panel-title {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.panel-title-text h2 {
  margin: 0.15rem 0;
}

.muted {
  color: var(--muted);
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--panel-muted);
  color: var(--ink);
}

.tag.accent {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.3rem;
  color: var(--ink);
}

select,
input[type='text'],
textarea {
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  font: inherit;
  background: #fff;
}

select:disabled {
  background: var(--panel-muted);
  color: var(--muted);
}

textarea {
  min-height: 80px;
  resize: vertical;
}

.panel-inner {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 0.9rem;
  background: var(--panel-muted);
}

.panel-inner-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.file-picker-btn {
  cursor: pointer;
  white-space: nowrap;
}

.file-preview-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 0.75rem;
  margin-top: 0.6rem;
}

.file-preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.preview-table-wrap {
  overflow-x: auto;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.preview-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.8rem;
}

.preview-table td {
  padding: 0.35rem 0.55rem;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}

.small-note {
  font-size: 0.75rem;
  margin-top: 0.35rem;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.9rem;
}

.success-message {
  color: var(--success);
  margin-top: 0.5rem;
}

.error-message {
  color: var(--danger);
  margin-top: 0.5rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.header-actions select {
  width: auto;
}

.table-wrap {
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  min-width: 860px;
}

.table th,
.table td {
  text-align: left;
  padding: 0.6rem 0.65rem;
  border-bottom: 1px solid var(--line);
  font-size: 0.88rem;
}

.table th {
  background: var(--panel-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
}

.priority-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.priority-badge.baja { background: #f1f5f9; color: #64748b; }
.priority-badge.media { background: #e0e7ff; color: #4338ca; }
.priority-badge.alta { background: #fef08a; color: #a16207; }
.priority-badge.urgente { background: #fee2e2; color: #b91c1c; }
.priority-badge.mostrador { background: #f3e8ff; color: #7c3aed; }

.status-pill {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}
.status-pill.pendiente { background: #fef3c7; color: #b45309; }
.status-pill.en_revision { background: #dbeafe; color: #1d4ed8; }
.status-pill.ajustado { background: #dcfce7; color: #047857; }
.status-pill.rechazado { background: #fee2e2; color: #be123c; }

.btn.small {
  padding: 0.35rem 0.65rem;
  font-size: 0.8rem;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.56);
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
  box-shadow: 0 24px 65px rgba(15, 23, 42, 0.35);
  width: min(640px, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-content--wide {
  width: min(820px, calc(100vw - 2rem));
}

.modal-header {
  --header-accent: #2563eb;
  --header-bg-start: rgba(37, 99, 235, 0.18);
  --header-bg-end: rgba(255, 255, 255, 0.45);
  --header-line: #bfdbfe;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.15rem;
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

.modal-header .eyebrow {
  color: var(--header-accent);
}

/* Image Preview Modal */
.image-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 1rem;
}

.image-preview-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview-img {
  max-width: 100%;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
}

.btn-close-preview {
  position: absolute;
  top: -15px;
  right: -15px;
  background: #fff;
  border: 1px solid var(--line);
  cursor: pointer;
  font-size: 1.5rem;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transition: all 0.15s ease;
  z-index: 10;
  line-height: 1;
}

.btn-close-preview:hover {
  background: var(--panel-muted);
  color: var(--ink);
  transform: scale(1.05);
}

.btn-close {
  border: none;
  background: transparent;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  color: var(--muted);
}

.modal-body {
  padding: 1rem 1.15rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
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
  color: var(--danger);
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

.modal-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.6rem;
}

.detail-label {
  font-size: 0.7rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-weight: 700;
  margin: 0 0 0.15rem;
}

.detail-value {
  font-size: 0.9rem;
  margin: 0;
}

.modal-notes,
.modal-files,
.modal-form {
  border-top: 1px solid var(--line);
  padding-top: 0.8rem;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.4rem;
}

.file-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-muted);
  font-size: 0.85rem;
}

.file-list-entry {
  display: flex;
  flex-direction: column;
}

.file-list-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.file-downloads-count {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--muted);
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.file-downloads-count:hover {
  background: var(--panel-muted);
  color: var(--ink);
}

.file-downloads-list {
  margin-top: 0.35rem;
  margin-left: 0.6rem;
  padding: 0.5rem 0.65rem;
  border-left: 2px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.file-downloads-item {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.78rem;
}

.modal-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  align-items: end;
  gap: 0.6rem;
}

.modal-form-grid label {
  min-height: 2.3em;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

/* ============================================
   CHAT EN VIVO
   ============================================ */
.chat-section {
  border-top: 1px solid var(--line);
  padding-top: 0.8rem;
}

.chat-section-head {
  margin-bottom: 0.6rem;
}

.chat-section-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
}

.chat-section-title-row h4 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--ink);
}

.chat-icon {
  font-size: 1.05rem;
  line-height: 1;
}

.chat-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.3rem;
  height: 1.3rem;
  padding: 0 0.3rem;
  background: var(--accent);
  color: #fff;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
}

.chat-subtitle {
  font-size: 0.78rem;
  color: var(--muted);
  margin: 0;
}

.chat-messages {
  min-height: 100px;
  max-height: 220px;
  overflow-y: auto;
  background: var(--panel-muted);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 0.65rem;
  margin-bottom: 0.65rem;
  display: flex;
  flex-direction: column;
  scroll-behavior: smooth;
}

.chat-empty {
  text-align: center;
  color: var(--muted);
  font-size: 0.82rem;
  margin: auto;
  padding: 1rem 0;
}

.chat-empty--error {
  color: var(--danger);
}

.chat-list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  width: 100%;
}

.chat-bubble {
  display: flex;
  flex-direction: column;
  max-width: 80%;
  align-self: flex-start;
}

.chat-bubble--own {
  align-self: flex-end;
  align-items: flex-end;
}

.chat-bubble-meta {
  display: flex;
  gap: 0.4rem;
  align-items: baseline;
  margin-bottom: 0.15rem;
}

.chat-bubble-author {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted);
}

.chat-bubble-time {
  font-size: 0.65rem;
  color: var(--muted);
}

.chat-bubble-text {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 12px 12px 12px 4px;
  background: #fff;
  border: 1px solid var(--line);
  font-size: 0.84rem;
  color: var(--ink);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-bubble--own .chat-bubble-text {
  border-radius: 12px 12px 4px 12px;
  background: var(--accent);
  color: #fff;
  border-color: var(--accent-strong);
}

.chat-attachment {
  margin-top: 0.35rem;
}

.chat-attachment-image {
  max-width: 220px;
  max-height: 220px;
  border-radius: 10px;
  border: 1px solid var(--line);
  cursor: pointer;
  display: block;
}

.chat-attachment-loading {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
  font-style: italic;
}

.chat-attachment-file {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--ink);
  max-width: 220px;
}

.chat-bubble--own .chat-attachment-file {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  color: #fff;
}

.chat-attachment-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-attachment-size {
  color: var(--muted);
  font-size: 0.72rem;
  white-space: nowrap;
}

.chat-file-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-muted);
  margin-bottom: 0.5rem;
  max-width: 100%;
}

.chat-file-chip-thumb {
  width: 28px;
  height: 28px;
  object-fit: cover;
  border-radius: 6px;
}

.chat-file-chip-name {
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.chat-file-chip-remove {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  color: var(--muted);
}

.chat-attach-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  font-size: 1.1rem;
}

.chat-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.chat-input {
  flex: 1;
}

.chat-send-btn {
  padding: 0.55rem 1rem;
  font-size: 0.85rem;
  white-space: nowrap;
}

.required-pill {
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background: rgba(220, 38, 38, 0.12);
  color: var(--danger);
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.9rem 1.15rem;
  border-top: 1px solid var(--line);
  background: var(--panel-muted);
}

@media (max-width: 768px) {
  .table {
    min-width: 760px;
  }
}

/* Panel top & Filters styling */
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
  cursor: pointer;
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

.filters .form-grid {
  display: grid;
  grid-template-columns: minmax(140px, 1.4fr) minmax(110px, 1fr) minmax(100px, 1fr) minmax(120px, 1.1fr) minmax(120px, 1.1fr) minmax(70px, 0.7fr);
  gap: 0.5rem;
}

.filters .form-grid > div {
  padding: 0.4rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.filters select,
.filters input {
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
  border-radius: 8px;
  height: 34px;
  box-sizing: border-box;
}

.status-filter {
  min-width: 0;
}

.status-filter-title {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.8rem;
}

.status-filter-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.2rem 0.4rem;
  padding: 0.4rem 0.5rem;
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

@media (max-width: 1024px) {
  .filters-header {
    display: block;
  }
  .filters .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
