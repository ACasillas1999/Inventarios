// ============================================
// TYPES & INTERFACES
// ============================================

export interface User {
  id: number
  email: string
  password: string
  name: string
  role_id: number
  status: 'active' | 'suspended' | 'inactive'
  created_at: Date
  updated_at: Date
  last_login: Date | null
}

export interface UserResponse {
  id: number
  email: string
  name: string
  role_id: number
  role_name?: string
  permissions?: string[]
  status: string
  created_at: Date
  updated_at: Date
  last_login: Date | null
  branches?: Branch[]
}

export interface Role {
  id: number
  name: string
  display_name: string
  description: string | null
  permissions: string[]
  created_at: Date
  updated_at: Date
}

export interface Branch {
  id: number
  code: string
  name: string
  db_host: string
  db_port: number
  db_user: string
  db_password: string
  db_database: string
  status: 'active' | 'inactive' | 'error'
  last_connection_check: Date | null
  connection_status: string
  created_at: Date
  updated_at: Date
}

export interface BranchResponse {
  id: number
  code: string
  name: string
  status: string
  connection_status: string
  last_connection_check: Date | null
}

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

export interface CountDetail {
  id: number
  count_id: number
  item_code: string
  item_description: string | null
  warehouse_id: number
  warehouse_name: string | null
  system_stock: number
  counted_stock: number
  difference: number
  difference_percentage: number
  unit: string | null
  counted_by_user_id: number | null
  counted_at: Date | null
  notes: string | null
  created_at: Date
  updated_at: Date
}

export interface Request {
  id: number
  folio: string
  count_id: number
  count_detail_id: number
  branch_id: number
  item_code: string
  system_stock: number
  counted_stock: number
  difference: number
  status: 'pendiente' | 'en_revision' | 'ajustado' | 'rechazado'
  requested_by_user_id: number
  reviewed_by_user_id: number | null
  reviewed_at: Date | null
  resolution_notes: string | null
  evidence_file: string | null
  created_at: Date
  updated_at: Date
}

export interface AuditLog {
  id: number
  user_id: number | null
  action: string
  entity_type: string
  entity_id: number
  old_values: any
  new_values: any
  ip_address: string | null
  user_agent: string | null
  created_at: Date
}

export interface Setting {
  id: number
  setting_key: string
  setting_value: string | null
  setting_type: 'string' | 'number' | 'boolean' | 'json'
  description: string | null
  created_at: Date
  updated_at: Date
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: UserResponse
}

export interface CreateCountRequest {
  branch_id: number
  almacen?: number // Warehouse number: 1=main branch, 2+=warehouses (default: 1)
  type: 'ciclico' | 'por_familia' | 'por_zona' | 'rango' | 'total'
  classification?: 'inventario' | 'ajuste'
  priority?: 'baja' | 'media' | 'alta' | 'urgente'
  responsible_user_id: number
  scheduled_date?: string
  notes?: string
  tolerance_percentage?: number

  // Opcional: evitar recontar artículos en el mes (usar con month_from/month_to)
  exclude_already_counted_month?: boolean
  month_from?: string // YYYY-MM-DD (inclusive)
  month_to?: string // YYYY-MM-DD (exclusive: primer día del siguiente mes)
  items?: string[] // códigos de artículos
  items_data?: Array<{ item_code: string; count: number }> // Para ajustes directos: código y cantidad física
}

export interface UpdateCountRequest {
  status?: 'pendiente' | 'contando' | 'contado' | 'cerrado' | 'cancelado'
  notes?: string
  started_at?: string
  finished_at?: string
  closed_at?: string
}

export interface CreateCountDetailRequest {
  item_code: string
  item_description?: string
  warehouse_id: number
  warehouse_name?: string
  system_stock: number
  counted_stock: number
  unit?: string
  notes?: string
}

export interface UpdateCountDetailRequest {
  counted_stock: number
  notes?: string
}

export interface StockQuery {
  branchId: number
  itemCode: string
}

export interface StockBatchQuery {
  branchId: number
  itemCodes: string[]
}

export interface StockResponse {
  branch_id: number
  branch_code: string
  item_code: string
  stock: number
  cached: boolean
}

export interface StockCompareRequest {
  count_id: number
  branch_id: number
  items: Array<{
    item_code: string
    counted_stock: number
  }>
}

export interface StockCompareResponse {
  item_code: string
  system_stock: number
  counted_stock: number
  difference: number
  difference_percentage: number
  exceeds_tolerance: boolean
}

// ============================================
// WEBSOCKET EVENTS
// ============================================

export interface WebSocketEvent {
  type: string
  data: any
  timestamp: Date
}

export interface StockUpdatedEvent extends WebSocketEvent {
  type: 'stock_updated'
  data: {
    branch_id: number
    item_code: string
    old_stock: number
    new_stock: number
  }
}

export interface CountProgressEvent extends WebSocketEvent {
  type: 'count_progress'
  data: {
    count_id: number
    folio: string
    total_items: number
    counted_items: number
    percentage: number
  }
}

export interface RequestStatusEvent extends WebSocketEvent {
  type: 'request_status'
  data: {
    request_id: number
    folio: string
    old_status: string
    new_status: string
  }
}

// ============================================
// DATABASE QUERY RESULTS
// ============================================

export interface ItemFromBranch {
  codigo: string  // Clave_Articulo
  descripcion: string  // Almacen
  almacen?: string
  existencia: number  // Existencia_Fisica (solo del Almacen = 1)
  existencia_fisica?: number
  existencia_teorica?: number
  Inventario_Minimo?: number
  Inventario_Maximo?: number
  inventario_minimo?: number
  inventario_maximo?: number
  Punto_Reorden?: number
  punto_reorden?: number
  Rack?: string
  Existencia_Teorica?: number
  Costo_Promedio?: number
  Costo_Promedio_Ant?: number
  Costo_Ult_Compra?: number
  Fecha_Ult_Compra?: any
  Costo_Compra_Ant?: number
  Fecha_Compra_Ant?: any
  costo_promedio?: number
  costo_promedio_ant?: number
  costo_ultima_compra?: number
  fecha_ult_compra?: any
  costo_compra_ant?: number
  fecha_compra_ant?: any
  pendiente_entrega?: number
  costo?: number  // Alias para compatibilidad
  linea?: string  // Línea = LEFT(Clave_Articulo, 5) - primeros 5 caracteres del código
  unidad?: string  // Para compatibilidad con frontend
}

export interface DashboardStats {
  open_counts: number
  scheduled_counts: number
  pending_requests: number
  closed_counts: number
}

export interface BranchDifference {
  branch_id: number
  branch_code: string
  branch_name: string
  total_items: number
  items_with_difference: number
  total_difference_value: number
  percentage_complete: number
}
