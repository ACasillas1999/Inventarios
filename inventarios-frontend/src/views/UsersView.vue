<script setup lang="ts">
import { onMounted, ref, reactive, computed } from 'vue'
import { usersService, branchesService, rolesService, type Branch, type Role } from '../services/api'
import { useAuthStore } from '@/stores/auth'
import MobileMenuToggle from '@/components/MobileMenuToggle.vue'

const authStore = useAuthStore()
const currentUser = computed(() => authStore.user)

type UserRow = {
  id: number
  name: string
  email: string
  role_id?: number
  branch_id?: number
  phone_number?: string
  status: string
  role_name?: string
  branch_name?: string
  branches?: Branch[]
  subscriptions?: Array<{ event_key: string, branch_id: number | null }>
}

const users = ref<UserRow[]>([])
const branches = ref<Branch[]>([])
const connectedBranches = computed(() => branches.value.filter(b => b.status === 'connected'))
const loading = ref(true)
const saving = ref(false)
const rowAction = ref<number | null>(null)
const roles = ref<Role[]>([])
const error = ref('')
const success = ref('')
const showPasswordModal = ref(false)
const selectedUserId = ref<number | null>(null)
const selectedUserName = ref('')
const showUserModal = ref(false)
type UserSortKey = 'name' | 'email' | 'branch' | 'role' | 'status'
const userSortState = ref<{ key: UserSortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })

const form = reactive({
  id: null as number | null,
  name: '',
  email: '',
  branch_id: '' as string | number,
  role_id: '' as string | number,
  phone_number: '',
  password: '',
  subscriptions: [] as Array<{ event_key: string, branch_id: number | null }>
})

const passwordForm = reactive({
  newPassword: '',
  confirmPassword: ''
})

// Eliminado roleOptions estático

const normalizeStatus = (value?: string) => {
  const normalized = (value || '').toString().toLowerCase()
  if (normalized === 'active') return 'activo'
  if (normalized === 'suspended') return 'suspendido'
  if (normalized === 'pending') return 'pendiente'
  return normalized || 'activo'
}

const normalizeUsers = (payload: any): UserRow[] => {
  const list = Array.isArray(payload) ? payload : Array.isArray(payload?.users) ? payload.users : []
  return list.map((u: any) => ({
    id: u.id ?? u.user_id ?? 0,
    name: u.name ?? [u.first_name, u.last_name].filter(Boolean).join(' '),
    email: u.email ?? '',
    role_id: u.role_id ?? u.role?.id,
    role_name: u.role_name ?? u.role?.name ?? u.role ?? '',
    status: normalizeStatus(u.status),
    phone_number: u.phone_number || '',
    branch_id: u.branch_id ?? u.branch?.id ?? (u.branches?.length ? u.branches[0].id : undefined),
    branch_name: u.branch_name ?? u.branch?.name,
    branches: Array.isArray(u.branches) ? u.branches : u.branch ? [u.branch] : []
  }))
}

const branchNameById = computed(() => {
  const map = new Map<number, string>()
  branches.value.forEach((b) => {
    if (b.id !== undefined) {
      map.set(b.id, b.name)
    }
  })
  return map
})

const statusLabel = (status?: string) => {
  const normalized = normalizeStatus(status)
  if (normalized === 'activo') return 'Activo'
  if (normalized === 'pendiente') return 'Pendiente'
  if (normalized === 'suspendido') return 'Suspendido'
  return status || 'Sin estado'
}

const statusClass = (status?: string) => {
  const normalized = normalizeStatus(status)
  if (normalized === 'activo') return 'open'
  if (normalized === 'pendiente') return 'warning'
  return 'error'
}

const branchLabel = (user: UserRow) => {
  if (user.branches && user.branches.length > 0) {
    return user.branches.map((b: any) => b.name || b.code || `ID ${b.id}`).join(', ')
  }
  if (user.branch_name) return user.branch_name
  if (user.branch_id) return branchNameById.value.get(user.branch_id) || `ID ${user.branch_id}`
  return 'Sin sucursal'
}

const toggleUserSort = (key: UserSortKey) => {
  if (userSortState.value.key === key) {
    userSortState.value.dir = userSortState.value.dir === 'asc' ? 'desc' : 'asc'
  } else {
    userSortState.value = { key, dir: 'asc' }
  }
}

const isUserSortActive = (key: UserSortKey, dir: 'asc' | 'desc') =>
  userSortState.value.key === key && userSortState.value.dir === dir

const sortedUsers = computed(() => {
  const list = [...users.value]
  const { key, dir } = userSortState.value
  list.sort((a, b) => {
    const getValue = (user: UserRow) => {
      if (key === 'name') return user.name || ''
      if (key === 'email') return user.email || ''
      if (key === 'branch') return branchLabel(user)
      if (key === 'role') return user.role_name || ''
      if (key === 'status') return statusLabel(user.status)
      return ''
    }
    const va = getValue(a)
    const vb = getValue(b)
    return dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
  })
  return list
})

const nextStatusLabel = (status?: string) => {
  return normalizeStatus(status) === 'suspendido' ? 'Activar' : 'Suspender'
}

const loadBranches = async () => {
  try {
    const data = await branchesService.getAll()
    branches.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error loading branches', err)
  }
}

const loadRoles = async () => {
  try {
    const data = await rolesService.getAll()
    roles.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error loading roles', err)
  }
}

const loadUsers = async () => {
  try {
    loading.value = true
    error.value = ''
    const data = await usersService.getAll()
    users.value = normalizeUsers(data)
  } catch (err) {
    console.error('Error loading users', err)
    error.value = 'No se pudieron cargar los usuarios'
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.id = null
  form.name = ''
  form.email = ''
  form.branch_id = ''
  form.role_id = ''
  form.phone_number = ''
  form.password = ''
}

const openUserModal = (user?: UserRow) => {
  resetForm()
  if (user) {
    form.id = user.id
    form.name = user.name || ''
    form.email = user.email || ''
    form.branch_id = user.branch_id || ''
    form.role_id = user.role_id || ''
    form.phone_number = user.phone_number || ''
    form.subscriptions = Array.isArray(user.subscriptions) ? [...user.subscriptions] : []
  }
  showUserModal.value = true
  error.value = ''
  success.value = ''
}

const closeUserModal = () => {
  showUserModal.value = false
  resetForm()
}

const toggleSubscription = (eventKey: string, checked: boolean) => {
  if (checked) {
    if (!form.subscriptions.some(s => s.event_key === eventKey)) {
      form.subscriptions.push({ event_key: eventKey, branch_id: null })
    }
  } else {
    form.subscriptions = form.subscriptions.filter(s => s.event_key !== eventKey)
  }
}

const editUser = (user: UserRow) => {
  openUserModal(user)
}

const submitUser = async () => {
  success.value = ''
  error.value = ''
  
  // Validación básica
  if (!form.name || !form.email) {
    error.value = 'El nombre y el correo son obligatorios'
    return
  }

  // Contraseña obligatoria solo para nuevos usuarios
  if (!form.id && !form.password) {
    error.value = 'La contraseña es obligatoria para nuevos usuarios'
    return
  }

  try {
    saving.value = true
    const payload: any = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone_number: form.phone_number.trim() || null
    }
    if (form.role_id) payload.role_id = Number(form.role_id)
    if (form.branch_id) {
        payload.branch_id = Number(form.branch_id)
        payload.branch_ids = [Number(form.branch_id)]
    }

    if (form.id) {
       // Update existing
       if (form.password) payload.password = form.password
       await usersService.update(form.id, payload)
       success.value = 'Usuario actualizado correctamente'
    } else {
       // Create new
       if (!form.password) {
         error.value = 'La contraseña es obligatoria para nuevos usuarios'
         saving.value = false
         return
       }
       payload.password = form.password
       await usersService.create(payload)
       success.value = 'Usuario creado correctamente'
    }
    
    await loadUsers()
    
    // Si es edición y el usuario actual es admin, guardar suscripciones
    if (form.id && (currentUser.value?.role_name === 'Admin' || currentUser.value?.role_name === 'admin')) {
      await usersService.updateNotifications(form.id, form.subscriptions)
    }

    setTimeout(() => {
      closeUserModal()
      success.value = ''
    }, 1500)
  } catch (err) {
    console.error('Error creating user', err)
    const backendMsg = (err as any)?.response?.data?.message || (err as any)?.response?.data?.error
    error.value = backendMsg || 'No se pudo crear el usuario'
  } finally {
    saving.value = false
  }
}

const toggleStatus = async (user: UserRow) => {
  success.value = ''
  error.value = ''
  if (!user.id) return
  
  // Usar valores técnicos para el backend
  const currentStatus = (user.status || '').toLowerCase()
  const isSuspended = currentStatus === 'suspended' || currentStatus === 'suspendido'
  const newStatus = isSuspended ? 'active' : 'suspended'
  
  try {
    rowAction.value = user.id
    await usersService.updateStatus(user.id, newStatus)
    success.value = `Usuario ${newStatus === 'active' ? 'activado' : 'suspendido'}`
    await loadUsers()
  } catch (err) {
    console.error('Error updating user status', err)
    error.value = 'No se pudo actualizar el estatus'
  } finally {
    rowAction.value = null
  }
}

const openPasswordModal = (user: UserRow) => {
  if (!user.id) return
  selectedUserId.value = user.id
  selectedUserName.value = user.name
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  showPasswordModal.value = true
  error.value = ''
  success.value = ''
}

const closePasswordModal = () => {
  showPasswordModal.value = false
  selectedUserId.value = null
  selectedUserName.value = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
}

const submitPasswordChange = async () => {
  error.value = ''
  success.value = ''

  if (!passwordForm.newPassword) {
    error.value = 'La nueva contraseña es obligatoria'
    return
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    error.value = 'Las contraseñas no coinciden'
    return
  }

  if (!selectedUserId.value) return

  try {
    saving.value = true
    await usersService.changePassword(selectedUserId.value, passwordForm.newPassword)
    success.value = 'Contraseña actualizada correctamente'
    setTimeout(() => {
      closePasswordModal()
      success.value = ''
    }, 2000)
  } catch (err) {
    console.error('Error changing password', err)
    const backendMsg = (err as any)?.response?.data?.message || (err as any)?.response?.data?.error
    error.value = backendMsg || 'No se pudo cambiar la contraseña'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    loadBranches(),
    loadRoles(),
    loadUsers()
  ])
})
</script>

<template>
  <section class="panel wide">
    <div class="panel-header">
      <div class="panel-title">
        <MobileMenuToggle />
        <div class="panel-title-text">
        <p class="eyebrow">Seguridad</p>
        <h2>Administración de usuarios</h2>
        <p class="muted">Control de cuentas, sucursales asignadas y roles disponibles.</p>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn" @click="openUserModal()">Nuevo usuario</button>
        <button class="btn ghost" @click="loadUsers">Recargar</button>
      </div>
    </div>

    <div v-if="success && !showUserModal && !showPasswordModal" class="success-message">{{ success }}</div>
    <div v-if="error && !showUserModal && !showPasswordModal" class="error-message">{{ error }}</div>

    <div v-if="loading" class="muted" style="padding: 0.75rem">Cargando usuarios...</div>
    <table v-else class="table" style="margin-top: 0.75rem">
      <thead>
        <tr>
          <th>
            <div class="th-inner">
              <span>Usuario</span>
              <div class="sort">
                <button :class="{ active: isUserSortActive('name', 'asc') }" @click="toggleUserSort('name')">▲</button>
                <button :class="{ active: isUserSortActive('name', 'desc') }" @click="toggleUserSort('name')">▼</button>
              </div>
            </div>
          </th>
          <th>
            <div class="th-inner">
              <span>Correo</span>
              <div class="sort">
                <button :class="{ active: isUserSortActive('email', 'asc') }" @click="toggleUserSort('email')">▲</button>
                <button :class="{ active: isUserSortActive('email', 'desc') }" @click="toggleUserSort('email')">▼</button>
              </div>
            </div>
          </th>
          <th>
            <div class="th-inner">
              <span>Sucursal</span>
              <div class="sort">
                <button :class="{ active: isUserSortActive('branch', 'asc') }" @click="toggleUserSort('branch')">▲</button>
                <button :class="{ active: isUserSortActive('branch', 'desc') }" @click="toggleUserSort('branch')">▼</button>
              </div>
            </div>
          </th>
          <th>
            <div class="th-inner">
              <span>Rol</span>
              <div class="sort">
                <button :class="{ active: isUserSortActive('role', 'asc') }" @click="toggleUserSort('role')">▲</button>
                <button :class="{ active: isUserSortActive('role', 'desc') }" @click="toggleUserSort('role')">▼</button>
              </div>
            </div>
          </th>
          <th>
            <div class="th-inner">
              <span>Estatus</span>
              <div class="sort">
                <button :class="{ active: isUserSortActive('status', 'asc') }" @click="toggleUserSort('status')">▲</button>
                <button :class="{ active: isUserSortActive('status', 'desc') }" @click="toggleUserSort('status')">▼</button>
              </div>
            </div>
          </th>
          <th v-if="authStore.hasPermission('all')">Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in sortedUsers" :key="user.id ?? user.email">
          <td><strong>{{ user.name }}</strong></td>
          <td>{{ user.email }}</td>
          <td>{{ branchLabel(user) }}</td>
          <td>{{ user.role_name || `Rol #${user.role_id ?? ''}` }}</td>
          <td>
            <span :class="['status', statusClass(user.status)]">{{ statusLabel(user.status) }}</span>
          </td>
          <td v-if="authStore.hasPermission('all')">
            <div class="actions">
              <button class="btn ghost btn-sm" @click="editUser(user)">
                Editar
              </button>
              <button class="btn ghost btn-sm" :disabled="rowAction === user.id" @click="toggleStatus(user)">
                {{ rowAction === user.id ? '...' : nextStatusLabel(user.status) }}
              </button>
              <button class="btn ghost btn-sm" @click="openPasswordModal(user)" title="Cambiar contraseña">
                🔑
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="sortedUsers.length === 0">
          <td colspan="6" class="muted" style="text-align: center; padding: 0.8rem">Sin usuarios</td>
        </tr>
      </tbody>
    </table>
  </section>

  <!-- Modal para cambiar contraseña -->
  <div v-if="showPasswordModal" class="modal-overlay" @click="closePasswordModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Cambiar contraseña</h3>
        <button class="btn-close" @click="closePasswordModal">×</button>
      </div>
      <div class="modal-body">
        <p class="muted">Cambiar contraseña para: <strong>{{ selectedUserName }}</strong></p>

        <div style="margin-top: 1rem">
          <label for="new-password">Nueva contraseña</label>
          <input
            id="new-password"
            v-model="passwordForm.newPassword"
            type="password"
            placeholder="Nueva contraseña"
          />
        </div>

        <div style="margin-top: 0.75rem">
          <label for="confirm-password">Confirmar contraseña</label>
          <input
            id="confirm-password"
            v-model="passwordForm.confirmPassword"
            type="password"
            placeholder="Confirmar contraseña"
          />
        </div>

        <p v-if="success" class="success-message" style="margin-top: 0.75rem">{{ success }}</p>
        <p v-if="error" class="error-message" style="margin-top: 0.75rem">{{ error }}</p>
      </div>
      <div class="modal-footer">
        <button class="btn" :disabled="saving" @click="submitPasswordChange">
          {{ saving ? 'Guardando...' : 'Cambiar contraseña' }}
        </button>
        <button class="btn ghost" :disabled="saving" @click="closePasswordModal">Cancelar</button>
      </div>
    </div>
  </div>

  <!-- Modal para crear/editar usuario -->
  <div v-if="showUserModal" class="modal-overlay" @click="closeUserModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ form.id ? 'Editar usuario' : 'Nuevo usuario' }}</h3>
        <button class="btn-close" @click="closeUserModal">×</button>
      </div>
      <div class="modal-body">
        <div class="form-vertical">
          <div class="form-group">
            <label for="modal-name">Nombre</label>
            <input id="modal-name" v-model="form.name" placeholder="Nombre completo" />
          </div>
          <div class="form-group">
            <label for="modal-email">Correo</label>
            <input id="modal-email" v-model="form.email" placeholder="correo@empresa.com" />
          </div>
          <div class="form-group">
            <label for="modal-phone">Teléfono (WhatsApp)</label>
            <input id="modal-phone" v-model="form.phone_number" placeholder="Ej: 521..." />
          </div>
          <div class="form-grid-modal">
            <div class="form-group">
              <label for="modal-branch">Sucursal</label>
              <select id="modal-branch" v-model="form.branch_id">
                <option value="">Selecciona</option>
                <option v-for="branch in connectedBranches" :key="branch.id ?? branch.code" :value="branch.id">
                  {{ branch.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label for="modal-role">Rol</label>
              <select id="modal-role" v-model="form.role_id">
                <option value="">Selecciona</option>
                <option v-for="role in roles" :key="role.id" :value="role.id">
                  {{ role.display_name }}
                </option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="modal-password">{{ form.id ? 'Nueva contraseña (opcional)' : 'Contraseña' }}</label>
            <input id="modal-password" v-model="form.password" type="password" :placeholder="form.id ? 'Dejar en blanco para no cambiar' : 'Contraseña inicial'" />
          </div>

          <!-- Configuración de notificaciones (Solo Admin) -->
          <div v-if="currentUser?.role_name === 'Admin' || currentUser?.role_name === 'admin'" class="notification-settings" style="margin-top: 1.5rem; border-top: 1px solid #eee; padding-top: 1rem;">
            <h4 style="margin-bottom: 0.75rem; font-size: 0.9rem; color: #666;">🔔 Notificaciones de WhatsApp</h4>
            <div class="subscription-item" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
              <input type="checkbox" id="sub-finished" :checked="form.subscriptions.some(s => s.event_key === 'count_finished')" 
                     @change="(e: any) => toggleSubscription('count_finished', e.target.checked)" />
              <label for="sub-finished" style="font-size: 0.85rem;">Recibir avisos de conteos terminados</label>
            </div>
            <div class="subscription-item" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
              <input type="checkbox" id="sub-requests" :checked="form.subscriptions.some(s => s.event_key === 'request_created')" 
                     @change="(e: any) => toggleSubscription('request_created', e.target.checked)" />
              <label for="sub-requests" style="font-size: 0.85rem;">Recibir avisos de solicitudes de ajuste</label>
            </div>
          </div>
        </div>

        <p v-if="success" class="success-message" style="margin-top: 1rem">{{ success }}</p>
        <p v-if="error" class="error-message" style="margin-top: 1rem">{{ error }}</p>
      </div>
      <div class="modal-footer">
        <button class="btn" :disabled="saving" @click="submitUser">
          {{ saving ? 'Guardando...' : (form.id ? 'Guardar cambios' : 'Crear usuario') }}
        </button>
        <button class="btn ghost" :disabled="saving" @click="closeUserModal">Cancelar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-actions {
  display: flex;
  gap: 0.5rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
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

.actions {
  display: flex;
  gap: 0.25rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.85rem;
}

.success-message {
  color: var(--success);
  margin-top: 0.4rem;
}

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
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--line);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: var(--muted);
  line-height: 1;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-close:hover {
  background: var(--panel-muted);
  color: var(--text);
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 1.5rem;
  border-top: 1px solid var(--line);
}

.form-vertical {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-grid-modal {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
</style>
