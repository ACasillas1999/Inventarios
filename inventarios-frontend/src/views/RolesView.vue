<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue'
import { rolesService, type Role } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import MobileMenuToggle from '@/components/MobileMenuToggle.vue'

const authStore = useAuthStore()
const roles = ref<Role[]>([])
const loading = ref(true)
const saving = ref(false)

const showModal = ref(false)
const editingRole = ref<Role | null>(null)
const selectedPermissions = ref<string[]>([])

const availablePermissions = [
  { id: 'all', label: 'Acceso total (Admin)' },
  { id: 'counts.view', label: 'Ver conteos' },
  { id: 'counts.create', label: 'Crear nuevos folios' },
  { id: 'counts.update', label: 'Capturar conteos (stock)' },
  { id: 'requests.create', label: 'Crear solicitudes de ajuste' },
  { id: 'requests.update', label: 'Gestionar solicitudes (aprobar/rechazar)' },
  { id: 'stock.view', label: 'Consultar existencias' },
  { id: 'reports.view', label: 'Ver reportes y auditoría' },
  { id: 'reports.export', label: 'Exportar reportes' }
]

const loadRoles = async () => {
  try {
    loading.value = true
    const data = await rolesService.getAll()
    roles.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error loading roles', err)
  } finally {
    loading.value = false
  }
}

const openEdit = (role: Role) => {
  editingRole.value = role
  selectedPermissions.value = [...role.permissions]
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingRole.value = null
  selectedPermissions.value = []
}

const togglePermission = (permId: string) => {
  const idx = selectedPermissions.value.indexOf(permId)
  if (idx > -1) {
    selectedPermissions.value.splice(idx, 1)
  } else {
    selectedPermissions.value.push(permId)
  }
}

const savePermissions = async () => {
  if (!editingRole.value) return
  try {
    saving.value = true
    await rolesService.update(editingRole.value.id, selectedPermissions.value)
    
    // Actualizar localmente
    const idx = roles.value.findIndex(r => r.id === editingRole.value?.id)
    if (idx > -1 && roles.value[idx]) {
      roles.value[idx].permissions = [...selectedPermissions.value]
    }
    
    closeModal()
  } catch (err) {
    console.error('Error saving permissions', err)
    alert('No se pudieron guardar los cambios')
  } finally {
    saving.value = false
  }
}

const getScope = (roleName: string) => {
  if (roleName === 'admin') return 'Todas las sucursales'
  if (roleName === 'jefe_almacen') return 'Sucursal asignada'
  if (roleName === 'jefe_inventarios') return 'Todas las sucursales'
  if (roleName === 'surtidores') return 'Sucursal asignada'
  if (roleName === 'e_inventarios') return 'Sucursal asignada'
  return 'Sucursales asignadas'
}

const formatPermission = (perm: string) => {
  const found = availablePermissions.find(p => p.id === perm)
  return found ? found.label : perm
}

onMounted(loadRoles)
</script>

<template>
  <section class="panel wide">
    <div class="panel-header">
      <div class="panel-title">
        <MobileMenuToggle />
        <div class="panel-title-text">
          <p class="eyebrow">Seguridad</p>
          <h2>Roles y permisos</h2>
          <p class="muted">Define lo que cada rol puede hacer dentro del flujo de conteos.</p>
        </div>
      </div>
      <span class="tag accent">Configuración dinámica</span>
    </div>

    <div v-if="loading" class="muted" style="padding: 1.5rem">Cargando roles y permisos...</div>
    <div v-else class="panel-grid wide">
      <article v-for="role in roles" :key="role.id" class="panel role-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">ID #{{ role.id }}</p>
            <h3>{{ role.display_name }}</h3>
            <p class="muted">{{ getScope(role.name) }}</p>
          </div>
          <div class="header-right">
            <span class="tag success">{{ role.permissions.length }} permisos</span>
            <button 
              v-if="authStore.hasPermission('all')" 
              class="btn small ghost" 
              @click="openEdit(role)"
            >
              Editar
            </button>
          </div>
        </div>
        <ul class="muted list-permissions">
          <li v-for="permission in role.permissions" :key="permission">
            {{ formatPermission(permission) }}
          </li>
        </ul>
        <p v-if="role.description" class="muted role-description">
          {{ role.description }}
        </p>
      </article>
    </div>

    <!-- Modal de Edición -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Editar Permisos: {{ editingRole?.display_name }}</h3>
          <button class="btn-close" @click="closeModal">&times;</button>
        </div>
        <div class="modal-body">
          <p class="muted" style="margin-bottom: 1rem">
            Selecciona las acciones permitidas para este rol:
          </p>
          <div class="permissions-grid">
            <label v-for="perm in availablePermissions" :key="perm.id" class="perm-checkbox">
              <input 
                type="checkbox" 
                :checked="selectedPermissions.includes(perm.id)"
                @change="togglePermission(perm.id)"
              >
              <span class="perm-label">{{ perm.label }}</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn ghost" @click="closeModal">Cancelar</button>
          <button class="btn" :disabled="saving" @click="savePermissions">
            {{ saving ? 'Guardando...' : 'Guardar Cambios' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.role-card {
  display: flex;
  flex-direction: column;
}

.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.list-permissions {
  margin: 1rem 0;
  padding-left: 1.25rem;
  font-size: 0.9rem;
  flex: 1;
}

.list-permissions li {
  margin-bottom: 0.25rem;
}

.role-description {
  margin-top: auto;
  font-size: 0.85rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--line);
}

.btn.small {
  padding: 0.35rem 0.6rem;
  font-size: 0.85rem;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
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
  width: min(500px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 1.25rem;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 { margin: 0; }

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--muted);
}

.modal-body {
  padding: 1.25rem;
  overflow-y: auto;
}

.permissions-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.perm-checkbox {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: background 0.2s;
}

.perm-checkbox:hover {
  background: var(--panel-muted);
}

.perm-checkbox input {
  width: 1.1rem;
  height: 1.1rem;
  cursor: pointer;
}

.perm-label {
  font-size: 0.95rem;
  color: var(--ink);
}

.modal-footer {
  padding: 1.25rem;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
