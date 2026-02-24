import axios, { type AxiosInstance, type AxiosError } from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const DASHBOARD_TIMEOUT_MS = 30000 // Dashboard stats puede tardar más por consultas agregadas
const STOCK_TIMEOUT_MS = 60000 // Consultas de stock pueden tardar en bases de datos grandes

// Crear instancia de axios
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000, // Timeout por defecto
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptor para agregar token a todas las requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor para manejar errores de respuesta
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token inválido o expirado
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ============================================
// AUTH ENDPOINTS
// ============================================

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: {
    id: number
    email: string
    name: string
    role_id: number
    role_name: string
    status: string
    branches?: Array<{
      id: number
      code: string
      name: string
      status: string
    }>
  }
}

export const authService = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', credentials)
    return response.data
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile')
    return response.data
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post('/auth/change-password', {
      currentPassword,
      newPassword
    })
    return response.data
  },

  logout: () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
  }
}

// ============================================
// BRANCHES ENDPOINTS
// ============================================

export interface Branch {
  id: number
  code: string
  name: string
  status: string
  // Backends de estado pueden devolver distintos campos; los marcamos opcionales
  connection_status?: string
  last_connection_check?: string | null
  lastCheck?: string | null
  errorMessage?: string
}

export interface UserOption {
  id: number
  name: string
  email?: string
  role_id?: number
  role_name?: string
  status?: string
  phone_number?: string | null
  branch_id?: number
  branch_name?: string
  branches?: Array<{
    id: number
    code?: string
    name: string
    status?: string
  }>
}

export const branchesService = {
  getAll: async (): Promise<Branch[]> => {
    const response = await api.get<Branch[]>('/branches')
    return response.data
  },

  getWarehouses: async (
    branchId: number
  ): Promise<{ warehouses: Array<{ id: number; name: string; habilitado?: number }> }> => {
    const response = await api.get(`/branches/${branchId}/warehouses`)
    return response.data
  },

  checkHealth: async (branchId: number) => {
    const response = await api.get(`/branches/${branchId}/health`)
    return response.data
  },

  checkAllHealth: async () => {
    const response = await api.get('/branches/health/all')
    return response.data
  },

  getFullList: async (): Promise<any[]> => {
    const response = await api.get('/branches/list/full')
    return response.data
  },

  create: async (data: any) => {
    const response = await api.post('/branches', data)
    return response.data
  },

  update: async (id: number, data: any) => {
    const response = await api.put(`/branches/${id}`, data)
    return response.data
  },

  delete: async (id: number) => {
    const response = await api.delete(`/branches/${id}`)
    return response.data
  }
}

// ============================================
// USERS ENDPOINTS
// ============================================

export const usersService = {
  getAll: async (): Promise<UserOption[]> => {
    const response = await api.get<UserOption[]>('/users')
    return response.data
  },

  create: async (data: {
    name: string
    email: string
    role_id?: number
    branch_id?: number
    branch_ids?: number[]
    phone_number?: string
    password?: string
  }) => {
    const response = await api.post('/users', data)
    return response.data
  },

  update: async (
    userId: number,
    data: {
      name?: string
      email?: string
      role_id?: number
      branch_ids?: number[]
      phone_number?: string
      password?: string
      status?: string
    }
  ) => {
    const response = await api.put(`/users/${userId}`, data)
    return response.data
  },

  updateStatus: async (userId: number, status: string) => {
    const response = await api.patch(`/users/${userId}`, { status })
    return response.data
  },

  changePassword: async (userId: number, newPassword: string) => {
    const response = await api.post(`/users/${userId}/change-password`, { newPassword })
    return response.data
  },

  updateNotifications: async (userId: number, subscriptions: Array<{ event_key: string, branch_id: number | null }>) => {
    const response = await api.put(`/users/${userId}/notifications`, { subscriptions })
    return response.data
  },

  resendInvite: async (userId: number) => {
    const response = await api.post(`/users/${userId}/resend-invite`)
    return response.data
  }
}

// ============================================
// ROLES ENDPOINTS
// ============================================

export interface Role {
  id: number
  name: string
  display_name: string
  description?: string
  permissions: string[]
}

export const rolesService = {
  getAll: async (): Promise<Role[]> => {
    const response = await api.get<Role[]>('/roles')
    return response.data
  },
  getById: async (id: number): Promise<Role> => {
    const response = await api.get<Role>(`/roles/${id}`)
    return response.data
  },
  update: async (id: number, permissions: string[]): Promise<{ message: string }> => {
    const response = await api.put<{ message: string }>(`/roles/${id}`, { permissions })
    return response.data
  }
}

// ============================================
// STOCK ENDPOINTS
// ============================================

export const stockService = {
  getStock: async (branchId: number, itemCode: string) => {
    const response = await api.get(`/stock/${branchId}/${itemCode}`)
    return response.data
  },

  getBatchStock: async (branchId: number, itemCodes: string[]) => {
    const response = await api.post(`/stock/${branchId}/batch`, { itemCodes })
    return response.data
  },

  getStockAllBranches: async (itemCode: string) => {
    const response = await api.get(`/stock/all/${itemCode}`)
    return response.data
  },

  compareStock: async (data: {
    branch_id: number
    items: Array<{ item_code: string; counted_stock: number }>
  }) => {
    const response = await api.post('/stock/compare', data)
    return response.data
  },

  getItemInfo: async (branchId: number, itemCode: string) => {
    const response = await api.get(`/stock/${branchId}/item/${itemCode}`)
    return response.data
  },

  searchItems: async (
    branchId: number,
    search?: string,
    linea?: string,
    limit: number = 50,
    offset: number = 0,
    almacen: number = 1
  ) => {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (linea) params.append('linea', linea)
    params.append('almacen', almacen.toString())
    params.append('limit', limit.toString())
    params.append('offset', offset.toString())

    const response = await api.get(`/stock/${branchId}/items?${params.toString()}`, {
      timeout: STOCK_TIMEOUT_MS
    })
    return response.data
  },

  getWarehouses: async (
    branchId: number
  ): Promise<{ branch_id: number; warehouses: Array<{ almacen: number; nombre?: string }> }> => {
    const response = await api.get(`/stock/${branchId}/warehouses`, {
      timeout: STOCK_TIMEOUT_MS
    })
    return response.data
  },

  getLines: async (branchId: number): Promise<{ branch_id: number; lines: string[] }> => {
    const response = await api.get(`/stock/${branchId}/lines`, {
      timeout: STOCK_TIMEOUT_MS
    })
    return response.data
  },

  getItemCodes: async (
    branchId: number,
    linea?: string
  ): Promise<{ branch_id: number; item_codes: string[] }> => {
    const params = new URLSearchParams()
    if (linea) params.append('linea', linea)
    const response = await api.get(`/stock/${branchId}/item-codes?${params.toString()}`, {
      timeout: STOCK_TIMEOUT_MS
    })
    return response.data
  },

  getItemWarehousesStock: async (
    branchId: number,
    itemCode: string
  ): Promise<{
    item_code: string
    item_description: string
    item_line: string
    item_unit: string
    total_stock: number
    warehouses: Array<{
      warehouse_id: number
      warehouse_name: string
      stock: number
      rack: string | null
      avg_cost: number
      min_stock: number | null
      max_stock: number | null
      reorder_point: number | null
    }>
  }> => {
    const response = await api.get(`/stock/${branchId}/item/${encodeURIComponent(itemCode)}/warehouses`, {
      timeout: STOCK_TIMEOUT_MS
    })
    return response.data
  }
}

// ============================================
// COUNTS ENDPOINTS
// ============================================

export interface Count {
  id: number
  folio: string
  branch_id: number
  almacen: number
  type: 'ciclico' | 'por_familia' | 'por_zona' | 'rango' | 'total'
  classification: 'inventario' | 'ajuste'
  priority: 'baja' | 'media' | 'alta' | 'urgente'
  status: 'pendiente' | 'contando' | 'contado' | 'cerrado' | 'cancelado'
  responsible_user_id: number
  created_by_user_id: number
  scheduled_date: string | null
  started_at: string | null
  finished_at: string | null
  closed_at: string | null
  notes: string | null
  tolerance_percentage: number
  created_at: string
  updated_at: string
}

export const countsService = {
  getDashboardStats: async () => {
    const response = await api.get('/counts/stats/dashboard', {
      timeout: DASHBOARD_TIMEOUT_MS
    })
    return response.data
  },

  create: async (data: {
    branch_id: number
    almacen?: number
    type: string
    classification?: 'inventario' | 'ajuste'
    priority?: string
    responsible_user_id: number
    scheduled_date?: string
    notes?: string
    tolerance_percentage?: number
    items?: string[]
    exclude_already_counted_month?: boolean
    month_from?: string
    month_to?: string
    items_data?: Array<{ item_code: string; count: number }>
  }) => {
    const response = await api.post<Count>('/counts', data)
    return response.data
  },

  getAll: async (filters?: {
    branch_id?: number
    status?: string | string[]
    type?: string
    responsible_user_id?: number
    date_from?: string
    date_to?: string
    scheduled_from?: string
    scheduled_to?: string
    search?: string
    limit?: number
    offset?: number
  }) => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null) return
        if (Array.isArray(value)) {
          if (!value.length) return
          params.append(key, value.join(','))
          return
        }
        params.append(key, value.toString())
      })
    }

    const response = await api.get(`/counts?${params.toString()}`)
    return response.data
  },

  getById: async (id: number) => {
    const response = await api.get<Count>(`/counts/${id}`)
    return response.data
  },

  getByFolio: async (folio: string) => {
    const response = await api.get<Count>(`/counts/folio/${folio}`)
    return response.data
  },

  update: async (
    id: number,
    data: {
      status?: string
      notes?: string
      started_at?: string
      finished_at?: string
      closed_at?: string
      responsible_user_id?: number
    }
  ) => {
    const response = await api.put<Count>(`/counts/${id}`, data)
    return response.data
  },

  getDetails: async (countId: number) => {
    const response = await api.get(`/counts/${countId}/details`)
    return response.data
  },

  addDetail: async (
    countId: number,
    data: {
      item_code: string
      item_description?: string
      warehouse_id: number
      warehouse_name?: string
      system_stock: number
      counted_stock: number
      unit?: string
      notes?: string
    }
  ) => {
    const response = await api.post(`/counts/${countId}/details`, data)
    return response.data
  },

  updateDetail: async (
    detailId: number,
    data: {
      counted_stock: number
      notes?: string
    }
  ) => {
    const response = await api.put(`/counts/details/${detailId}`, data)
    return response.data
  },

  delete: async (id: number) => {
    const response = await api.delete(`/counts/${id}`)
    return response.data
  },

  getDifferences: async () => {
    const response = await api.get('/counts/differences')
    return response.data
  },

  createRequestsFromCount: async (countId: number) => {
    const response = await api.post(`/counts/${countId}/requests`)
    return response.data
  },

  getItemsHistory: async (payload: {
    branch_id: number
    item_codes: string[]
    from: string
    to: string
    almacen?: number
  }): Promise<{
    branch_id: number
    from: string
    to: string
    almacen?: number
    items: Array<{ item_code: string; last_counted_at: string; count_id: number; folio: string; almacen: number }>
  }> => {
    const response = await api.post('/counts/history/items', payload)
    return response.data
  }
}

// ============================================
// REQUESTS (SOLICITUDES) ENDPOINTS
// ============================================

export type RequestStatus = 'pendiente' | 'en_revision' | 'ajustado' | 'rechazado'

export interface AdjustmentRequest {
  id: number
  folio: string
  count_id: number
  count_detail_id: number
  branch_id: number
  item_code: string
  system_stock: number
  counted_stock: number
  difference: number
  status: RequestStatus
  count_folio?: string
  count_classification?: 'inventario' | 'ajuste'
  warehouse_id?: number
  warehouse_name?: string
  requested_by_user_id: number
  requested_by_name?: string | null
  reviewed_by_user_id: number | null
  reviewed_by_name?: string | null
  reviewed_at: string | null
  resolution_notes: string | null
  evidence_file: string | null
  created_at: string
  updated_at: string
}

export const requestsService = {
  list: async (filters?: {
    status?: RequestStatus | RequestStatus[]
    branch_id?: number
    count_id?: number
    limit?: number
    offset?: number
  }): Promise<{ requests: AdjustmentRequest[]; total: number }> => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null) return
        if (Array.isArray(value)) {
          if (!value.length) return
          params.append(key, value.join(','))
          return
        }
        if (typeof value === 'string' && value.trim() === '') return
        params.append(key, String(value))
      })
    }
    const response = await api.get(`/requests?${params.toString()}`)
    return response.data
  }
  ,
  getById: async (id: number): Promise<AdjustmentRequest> => {
    const response = await api.get<AdjustmentRequest>(`/requests/${id}`)
    return response.data
  },
  update: async (
    id: number,
    data: {
      status?: RequestStatus
      resolution_notes?: string | null
      evidence_file?: string | null
    }
  ): Promise<AdjustmentRequest> => {
    const response = await api.patch<AdjustmentRequest>(`/requests/${id}`, data)
    return response.data
  }
}

// ============================================
// SPECIAL LINES ENDPOINTS
// ============================================

export interface SpecialLine {
  id: number
  line_code: string
  line_name: string | null
  tolerance_percentage: number
  whatsapp_numbers: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export const specialLinesService = {
  getAll: async (activeOnly: boolean = false): Promise<{ lines: SpecialLine[] }> => {
    const params = activeOnly ? '?active=true' : ''
    const response = await api.get(`/special-lines${params}`)
    return response.data
  },

  getById: async (id: number): Promise<SpecialLine> => {
    const response = await api.get<SpecialLine>(`/special-lines/${id}`)
    return response.data
  },

  create: async (data: {
    line_code: string
    line_name?: string
    tolerance_percentage?: number
    whatsapp_numbers?: string[]
    is_active?: boolean
  }): Promise<SpecialLine> => {
    const response = await api.post<SpecialLine>('/special-lines', data)
    return response.data
  },

  update: async (
    id: number,
    data: {
      line_name?: string
      tolerance_percentage?: number
      whatsapp_numbers?: string[]
      is_active?: boolean
    }
  ): Promise<SpecialLine> => {
    const response = await api.put<SpecialLine>(`/special-lines/${id}`, data)
    return response.data
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/special-lines/${id}`)
    return response.data
  },

  toggleActive: async (id: number, isActive: boolean): Promise<SpecialLine> => {
    const response = await api.post<SpecialLine>(`/special-lines/${id}/toggle`, { is_active: isActive })
    return response.data
  },

  // Helper para parsear números de WhatsApp
  parseWhatsAppNumbers: (specialLine: SpecialLine): string[] => {
    if (!specialLine.whatsapp_numbers) return []
    try {
      const numbers = JSON.parse(specialLine.whatsapp_numbers)
      return Array.isArray(numbers) ? numbers : []
    } catch {
      return []
    }
  }
}

// ============================================
// REPORTS ENDPOINTS
// ============================================

export const reportsService = {
  getAuditKPIs: async (filters: { branch_id?: number, date_from?: string, date_to?: string }) => {
    const params = new URLSearchParams()
    if (filters.branch_id) params.append('branch_id', filters.branch_id.toString())
    if (filters.date_from) params.append('date_from', filters.date_from)
    if (filters.date_to) params.append('date_to', filters.date_to)

    const response = await api.get(`/reports/audit?${params.toString()}`)
    return response.data
  },
  getCompanyOverview: async () => {
    const response = await api.get('/reports/company-overview', {
      timeout: STOCK_TIMEOUT_MS // 60 seconds for large company-wide calculations
    })
    return response.data
  },
  getCoverageReport: async (branchId?: number) => {
    const url = branchId ? `/reports/coverage?branch_id=${branchId}` : '/reports/coverage'
    const response = await api.get(url, {
      timeout: STOCK_TIMEOUT_MS // 60 seconds for coverage calculations
    })
    return response.data
  },
  getLineStats: async (filters: { branch_id?: number, date_from?: string, date_to?: string }) => {
    const params = new URLSearchParams()
    if (filters.branch_id) params.append('branch_id', filters.branch_id.toString())
    if (filters.date_from) params.append('date_from', filters.date_from)
    if (filters.date_to) params.append('date_to', filters.date_to)

    const response = await api.get(`/reports/line-stats?${params.toString()}`, {
      timeout: STOCK_TIMEOUT_MS // 60 seconds for stats calculations
    })
    return response.data
  },
  getProductivityStats: async (filters: { branch_id?: number, date_from?: string, date_to?: string }) => {
    const params = new URLSearchParams()
    if (filters.branch_id) params.append('branch_id', filters.branch_id.toString())
    if (filters.date_from) params.append('date_from', filters.date_from)
    if (filters.date_to) params.append('date_to', filters.date_to)

    const response = await api.get(`/reports/productivity?${params.toString()}`)
    return response.data
  }
}

export const auditService = {
  getLogs: async (filters: { user_id?: number, entity_type?: string, entity_id?: number, date_from?: string, date_to?: string, limit?: number, offset?: number }) => {
    const params = new URLSearchParams()
    if (filters.user_id) params.append('user_id', filters.user_id.toString())
    if (filters.entity_type) params.append('entity_type', filters.entity_type)
    if (filters.entity_id) params.append('entity_id', filters.entity_id.toString())
    if (filters.date_from) params.append('date_from', filters.date_from)
    if (filters.date_to) params.append('date_to', filters.date_to)
    if (filters.limit) params.append('limit', filters.limit.toString())
    if (filters.offset) params.append('offset', filters.offset.toString())

    const response = await api.get(`/audit?${params.toString()}`)
    return response.data
  }
}

// ============================================
// TEST DATA ENDPOINTS (Admin only)
// ============================================

export const testDataService = {
  getStats: async (): Promise<{
    total_articles: number
    counted_articles: number
    coverage_percentage: number
    test_counts: number
    test_details: number
    has_test_data: boolean
  }> => {
    const response = await api.get('/test-data/stats')
    return response.data
  },

  seedCoverage: async (): Promise<{
    message: string
    counts_created: number
    items_added: number
    before: { counted_articles: number; coverage_percentage: number }
    after: { counted_articles: number; coverage_percentage: number }
  }> => {
    const response = await api.post('/test-data/seed-coverage')
    return response.data
  },

  cleanupCoverage: async (): Promise<{
    message: string
    counts_deleted: number
    details_deleted: number
    after: { counted_articles: number; coverage_percentage: number }
  }> => {
    const response = await api.delete('/test-data/cleanup-coverage')
    return response.data
  }
}

// ============================================
// SETTINGS ENDPOINTS
// ============================================

export interface Setting {
  id: number
  setting_key: string
  setting_value: string
  setting_type: 'string' | 'number' | 'boolean' | 'json'
  description: string
}

export const settingsService = {
  getAll: async (): Promise<Setting[]> => {
    const response = await api.get<Setting[]>('/settings')
    return response.data
  },

  update: async (settings: Record<string, string>): Promise<{ message: string }> => {
    const response = await api.patch<{ message: string }>('/settings', { settings })
    return response.data
  }
}

export default api
