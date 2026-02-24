<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { settingsService, branchesService } from '@/services/api'
import MobileMenuToggle from '@/components/MobileMenuToggle.vue'

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')

const branches = ref<any[]>([])
const showModal = ref(false)
const editingBranch = ref<any>(null)

const branchForm = reactive({
  code: '',
  name: '',
  host: '',
  port: 3306,
  user: 'consulta',
  password: '',
  database: '',
})

const generalForm = reactive({
  // Conexiones por defecto (para futuras sucursales)
  db_default_host: '',
  db_default_user: '',
  db_default_password: '',
  db_default_name: '',
  // General
  folio_format: '',
  pagination_limit: '50',
  timezone: 'America/Mexico_City',
})

const loadSettings = async () => {
  try {
    loading.value = true
    error.value = ''
    const settings = await settingsService.getAll()

    settings.forEach((s) => {
      if (Object.prototype.hasOwnProperty.call(generalForm, s.setting_key)) {
        ;(generalForm as any)[s.setting_key] = s.setting_value
      }
    })

    await loadBranches()
  } catch (err: any) {
    console.error('Error loading settings', err)
    error.value = 'No se pudieron cargar las configuraciones o sucursales'
  } finally {
    loading.value = false
  }
}

const loadBranches = async () => {
  const data = await branchesService.getFullList()
  branches.value = data
}

const saveGeneralSettings = async (keys: string[]) => {
  try {
    saving.value = true
    error.value = ''
    success.value = ''

    const payload: Record<string, string> = {}
    keys.forEach((k) => {
      payload[k] = (generalForm as any)[k]
    })

    await settingsService.update(payload)
    success.value = 'Preferencias guardadas correctamente'

    setTimeout(() => {
      success.value = ''
    }, 4000)
  } catch (err: any) {
    console.error('Error saving settings', err)
    error.value = err.response?.data?.error || 'Error al guardar las configuraciones'
  } finally {
    saving.value = false
  }
}

const openBranchModal = (branch: any = null) => {
  editingBranch.value = branch
  if (branch) {
    branchForm.code = branch.code
    branchForm.name = branch.name
    branchForm.host = branch.db_host
    branchForm.port = branch.db_port
    branchForm.user = branch.db_user
    branchForm.password = branch.db_password
    branchForm.database = branch.db_database
  } else {
    branchForm.code = ''
    branchForm.name = ''
    branchForm.host = generalForm.db_default_host || 'localhost'
    branchForm.port = 3306
    branchForm.user = generalForm.db_default_user || 'consulta'
    branchForm.password = generalForm.db_default_password || ''
    branchForm.database = generalForm.db_default_name || ''
  }
  showModal.value = true
}

const saveBranch = async () => {
  try {
    saving.value = true
    error.value = ''

    if (editingBranch.value) {
      await branchesService.update(editingBranch.value.id, branchForm)
      success.value = 'Sucursal actualizada correctamente'
    } else {
      await branchesService.create(branchForm)
      success.value = 'Sucursal creada correctamente'
    }

    showModal.value = false
    await loadBranches()

    setTimeout(() => {
      success.value = ''
    }, 4000)
  } catch (err: any) {
    console.error('Error saving branch', err)
    error.value = err.response?.data?.error || 'Error al guardar sucursal'
  } finally {
    saving.value = false
  }
}

const deleteBranch = async (id: number) => {
  if (!confirm('¿Estás seguro de eliminar esta sucursal? Esta acción es irreversible.')) return

  try {
    saving.value = true
    await branchesService.delete(id)
    await loadBranches()
    success.value = 'Sucursal eliminada'
  } catch (err: any) {
    error.value = 'Error al eliminar sucursal'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <section class="panel wide">
    <div class="panel-header">
      <div class="panel-title">
        <MobileMenuToggle />
        <div class="panel-title-text">
          <p class="eyebrow">Configuración</p>
          <h2>Parámetros generales</h2>
          <p class="muted">Conexiones y preferencias del sistema.</p>
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <span v-if="loading" class="muted small">Cargando...</span>
        <span class="tag accent">Ajustes</span>
      </div>
    </div>

    <div v-if="success" class="success-message panel" style="margin-bottom: 1rem">
      {{ success }}
    </div>
    <div v-if="error" class="error-message panel" style="margin-bottom: 1rem">
      {{ error }}
    </div>

    <div class="panel-grid wide">
      <!-- Sección Sucursales (Dinamismo pedido por usuario) -->
      <section class="panel" style="grid-column: span 2">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Conexiones</p>
            <h3>Gestión de Sucursales</h3>
          </div>
          <button class="btn accent" @click="openBranchModal()">+ Agregar Sucursal</button>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Host</th>
                <th>Database</th>
                <th>Usuario</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="branch in branches" :key="branch.id">
                <td>
                  <strong>{{ branch.code }}</strong>
                </td>
                <td>{{ branch.name }}</td>
                <td>{{ branch.db_host }}</td>
                <td>{{ branch.db_database }}</td>
                <td>{{ branch.db_user }}</td>
                <td>
                  <div style="display: flex; gap: 0.4rem">
                    <button class="btn ghost small" @click="openBranchModal(branch)">Editar</button>
                    <button class="btn error ghost small" @click="deleteBranch(branch.id)">X</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Sección Conexiones Default -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Defectos</p>
            <h3>Credenciales Base</h3>
          </div>
          <span class="tag">Defaults</span>
        </div>
        <div class="form-grid">
          <div>
            <label for="host">Host Default</label>
            <input
              id="host"
              v-model="generalForm.db_default_host"
              placeholder="localhost"
              :disabled="loading"
            />
          </div>
          <div>
            <label for="user">Usuario Default</label>
            <input
              id="user"
              v-model="generalForm.db_default_user"
              placeholder="root"
              :disabled="loading"
            />
          </div>
          <div>
            <label for="password">Password Default</label>
            <input
              id="password"
              v-model="generalForm.db_default_password"
              type="password"
              placeholder="••••••"
              :disabled="loading"
            />
          </div>
          <div>
            <label for="dbname">Prefijo DB</label>
            <input
              id="dbname"
              v-model="generalForm.db_default_name"
              placeholder="inv_"
              :disabled="loading"
            />
          </div>
        </div>
        <div class="form-actions">
          <button
            class="btn ghost"
            :disabled="loading || saving"
            @click="
              saveGeneralSettings([
                'db_default_host',
                'db_default_user',
                'db_default_password',
                'db_default_name',
              ])
            "
          >
            Guardar defaults
          </button>
        </div>
      </section>

      <!-- Sección General -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">General</p>
            <h3>Preferencias</h3>
          </div>
          <span class="tag success">Sistema</span>
        </div>
        <div class="form-grid">
          <div>
            <label for="folio">Formato de folio</label>
            <input
              id="folio"
              v-model="generalForm.folio_format"
              placeholder="CNT-{YEAR}{MONTH}-{NUMBER}"
              :disabled="loading"
            />
          </div>
          <div>
            <label for="limit">Paginación</label>
            <input id="limit" v-model="generalForm.pagination_limit" type="number" :disabled="loading" />
          </div>
          <div>
            <label for="timezone">Zona horaria</label>
            <input
              id="timezone"
              v-model="generalForm.timezone"
              placeholder="America/Mexico_City"
              :disabled="loading"
            />
          </div>
        </div>
        <button
          class="btn ghost"
          style="margin-top: 0.6rem"
          :disabled="loading || saving"
          @click="saveGeneralSettings(['folio_format', 'pagination_limit', 'timezone'])"
        >
          Guardar preferencias
        </button>
      </section>
    </div>

    <!-- Modal para Agregar/Editar Sucursal -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>{{ editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal' }}</h3>
          <button class="btn-close" @click="showModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div>
              <label>Código (Breve)</label>
              <input v-model="branchForm.code" placeholder="MATRIZ" />
            </div>
            <div>
              <label>Nombre (Display)</label>
              <input v-model="branchForm.name" placeholder="Sucursal Matriz" />
            </div>
            <div>
              <label>Host / IP</label>
              <input v-model="branchForm.host" placeholder="192.168.1.10" />
            </div>
            <div>
              <label>Puerto</label>
              <input v-model.number="branchForm.port" type="number" placeholder="3306" />
            </div>
            <div>
              <label>Base de Datos</label>
              <input v-model="branchForm.database" placeholder="deasa_erp" />
            </div>
            <div>
              <label>Usuario DB</label>
              <input v-model="branchForm.user" placeholder="root" />
            </div>
            <div>
              <label>Password DB</label>
              <input v-model="branchForm.password" type="password" placeholder="••••••" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn ghost" @click="showModal = false">Cancelar</button>
          <button class="btn accent" :disabled="saving" @click="saveBranch">
            {{ saving ? 'Guardando...' : 'Guardar Sucursal' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.success-message {
  border-left: 4px solid var(--success);
  padding: 0.75rem 1rem;
}

.error-message {
  border-left: 4px solid var(--danger);
  padding: 0.75rem 1rem;
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
  backdrop-filter: blur(4px);
}

.modal-container {
  background: var(--panel);
  width: 90%;
  max-width: 600px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  padding: 1.25rem;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-body {
  padding: 1.25rem;
  max-height: 70vh;
  overflow-y: auto;
}

.modal-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--muted);
}

.table-wrap {
  margin-top: 1rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow-x: auto;
}

.small {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}
</style>
