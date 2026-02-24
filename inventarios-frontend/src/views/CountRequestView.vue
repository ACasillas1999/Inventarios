<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  branchesService,
  countsService,
  stockService,
  usersService,
  type Branch,
  type UserOption
} from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import MobileMenuToggle from '@/components/MobileMenuToggle.vue'

const auth = useAuthStore()
const branches = ref<Branch[]>([])
const connectedBranches = computed(() => branches.value.filter(b => b.status === 'connected'))
const users = ref<UserOption[]>([])
const loading = ref(false)
const error = ref('')
const success = ref('')
const searchLoading = ref(false)

const form = reactive({
  branch_id: '',
  type: 'ciclico',
  priority: 'media',
  responsible_user_id: '',
  scheduled_date: '',
  tolerance: 5,
  notes: ''
})

type ItemRow = {
  code: string
  description: string
  line?: string
  unit?: string
  stock?: number
}

const itemSearch = ref('')
const searchResults = ref<ItemRow[]>([])
const selectedItems = ref<ItemRow[]>([])

const searchItems = async () => {
  if (!form.branch_id) {
    error.value = 'Selecciona una sucursal antes de buscar artículos'
    return
  }
  if (!itemSearch.value || itemSearch.value.length < 2) {
    searchResults.value = []
    return
  }
  try {
    searchLoading.value = true
    const branchId = Number(form.branch_id)
    const response = await stockService.searchItems(branchId, itemSearch.value, undefined, 20)
    const list = Array.isArray((response as any)?.items) ? (response as any).items : response
    searchResults.value = (list || []).map((item: any) => ({
      code: item.codigo || item.item_code || '',
      description: item.descripcion || item.Almacen || '',
      line: item.linea || '',
      unit: item.unidad || '',
      stock: item.existencia ?? item.stock ?? undefined
    }))
  } catch (err) {
    console.error('Error searching items', err)
  } finally {
    searchLoading.value = false
  }
}

const addItem = (item: ItemRow) => {
  if (selectedItems.value.some((i) => i.code === item.code)) return
  selectedItems.value.push(item)
}

const removeItem = (code: string) => {
  selectedItems.value = selectedItems.value.filter((i) => i.code !== code)
}

const loadBranches = async () => {
  try {
    const data = await branchesService.getAll()
    branches.value = Array.isArray(data) ? data : []
    if (branches.value.length && !form.branch_id) {
      const first = branches.value[0]
      form.branch_id = String(first?.id ?? '')
    }
  } catch (err: unknown) {
    console.error('Error loading branches', err)
  }
}

const loadUsers = async () => {
  try {
    const data = await usersService.getAll()
    users.value = Array.isArray(data) ? data : []
    if (!form.responsible_user_id && users.value.length) {
      const self = users.value.find((u) => u.id === auth.user?.id)
      const fallback = users.value[0]
      form.responsible_user_id = String(self?.id ?? fallback?.id ?? '')
    }
  } catch (err: unknown) {
    console.error('Error loading users', err)
  }
}

const setDefaultResponsible = () => {
  if (auth.user?.id) {
    form.responsible_user_id = String(auth.user.id)
  }
}

const submit = async () => {
  success.value = ''
  error.value = ''

  if (!form.branch_id || !form.type || !form.responsible_user_id) {
    error.value = 'Sucursal, tipo y responsable son obligatorios'
    return
  }

  try {
    loading.value = true
    const payload = {
      branch_id: Number(form.branch_id),
      type: form.type,
      priority: form.priority,
      responsible_user_id: Number(form.responsible_user_id),
      scheduled_date: form.scheduled_date || undefined,
      notes: form.notes || undefined,
      tolerance_percentage: form.tolerance ? Number(form.tolerance) : undefined
    }

    const result = await countsService.create(payload)

    // Pre-cargar detalles con los artículos seleccionados
    if (selectedItems.value.length > 0) {
      const branchId = Number(form.branch_id)
      for (const item of selectedItems.value) {
        try {
          const info = await stockService.getItemInfo(branchId, item.code)
          const systemStock = (info as any)?.Existencia_Fisica ?? (info as any)?.existencia ?? 0
          await countsService.addDetail(result.id, {
            item_code: item.code,
            item_description: item.description,
            warehouse_id: 1,
            system_stock: systemStock,
            counted_stock: 0,
            unit: item.unit
          })
        } catch (err) {
          console.error(`No se pudo pre-cargar el artículo ${item.code}`, err)
        }
      }
    }

    success.value = `Conteo creado con folio ${result.folio}`
    selectedItems.value = []
  } catch (err: any) {
    console.error('Error creating count', err)
    error.value = 'No se pudo crear el conteo'
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.type = 'ciclico'
  form.priority = 'media'
  form.scheduled_date = ''
  form.notes = ''
  form.tolerance = 5
  selectedItems.value = []
  setDefaultResponsible()
}

onMounted(async () => {
  auth.initializeAuth()
  setDefaultResponsible()
  await loadBranches()
  await loadUsers()
})
</script>

<template>
  <section class="panel wide">
    <div class="panel-header">
      <div class="panel-title">
        <MobileMenuToggle />
        <div class="panel-title-text">
          <p class="eyebrow">Programación</p>
          <h2>Solicitud de conteo</h2>
          <p class="muted">Crea un folio de conteo con responsable y prioridad.</p>
        </div>
      </div>
      <span class="tag accent">Ticket</span>
    </div>

    <div class="form-grid">
      <div>
        <label for="branch">Sucursal</label>
        <select id="branch" v-model="form.branch_id">
          <option value="">Selecciona</option>
          <option v-for="branch in connectedBranches" :key="branch.id ?? branch.code" :value="branch.id">
            {{ branch.name }}
          </option>
        </select>
      </div>
      <div>
        <label for="type">Tipo de conteo</label>
        <select id="type" v-model="form.type">
          <option value="ciclico">Cíclico</option>
          <option value="por_familia">Por familia</option>
          <option value="por_zona">Por zona</option>
          <option value="rango">Rango de artículos</option>
          <option value="total">Total</option>
        </select>
      </div>
      <div>
        <label for="priority">Prioridad</label>
        <select id="priority" v-model="form.priority">
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
      </div>
      <div>
        <label for="responsable">Responsable</label>
        <select id="responsable" v-model="form.responsible_user_id">
          <option value="">Selecciona</option>
          <option v-for="user in users" :key="user.id" :value="user.id">
            {{ user.name }} ({{ user.email }})
          </option>
        </select>
      </div>
      <div>
        <label for="date">Fecha programada</label>
        <input id="date" v-model="form.scheduled_date" type="datetime-local" />
      </div>
      <div>
        <label for="tolerance">Tolerancia (%)</label>
        <input id="tolerance" v-model.number="form.tolerance" type="number" min="0" max="100" step="0.1" />
      </div>
    </div>
    <div style="margin-top: 0.6rem">
      <label for="comments">Comentarios</label>
      <textarea id="comments" v-model="form.notes" placeholder="Detalles, alcance, notas para la sucursal"></textarea>
    </div>

    <section class="panel" style="margin-top: 0.75rem">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Alcance</p>
          <h3>Selecciona artículos o línea</h3>
        </div>
        <span class="tag">Opcional</span>
      </div>
      <div class="form-grid">
        <div>
          <label for="item-search">Buscar artículo</label>
          <input
            id="item-search"
            v-model="itemSearch"
            placeholder="Código o descripción (min 2 caracteres)"
            @keyup.enter="searchItems"
          />
        </div>
        <div class="actions">
          <button class="btn" :disabled="searchLoading" @click="searchItems">Buscar</button>
        </div>
      </div>

      <div v-if="searchLoading" class="muted" style="padding: 0.5rem 0">Buscando...</div>
      <div v-else class="panel-grid">
        <div class="panel">
          <p class="eyebrow">Resultados</p>
          <ul class="muted" v-if="searchResults.length === 0">
            <li>Sin resultados</li>
          </ul>
          <div v-else class="results">
            <div v-for="item in searchResults" :key="item.code" class="result-row">
              <div>
                <strong>{{ item.code }}</strong>
                <p class="muted">{{ item.description }}</p>
              </div>
              <div class="muted">Existencia: {{ item.stock ?? '-' }}</div>
              <button class="btn ghost" @click="addItem(item)">Agregar</button>
            </div>
          </div>
        </div>

        <div class="panel">
          <p class="eyebrow">Seleccionados</p>
          <ul class="muted" v-if="selectedItems.length === 0">
            <li>No hay artículos seleccionados</li>
          </ul>
          <div v-else class="results">
            <div v-for="item in selectedItems" :key="item.code" class="result-row">
              <div>
                <strong>{{ item.code }}</strong>
                <p class="muted">{{ item.description }}</p>
              </div>
              <div class="muted">Existencia: {{ item.stock ?? '-' }}</div>
              <button class="btn ghost" @click="removeItem(item.code)">Quitar</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="form-actions">
      <button class="btn" :disabled="loading" @click="submit">Generar folio</button>
      <button class="btn ghost" :disabled="loading" @click="resetForm">Limpiar</button>
    </div>

    <p v-if="success" class="success-message">{{ success }}</p>
    <p v-if="error" class="error-message">{{ error }}</p>
  </section>

  <div class="panel-grid">
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Al guardar</p>
          <h3>Estado pendiente</h3>
        </div>
        <span class="tag">Asignación</span>
      </div>
      <ul class="muted">
        <li>Se crea el conteo en estado <strong>Pendiente</strong>.</li>
        <li>Se asigna responsable o área (Inventarios / Sucursal).</li>
        <li>Opcional: adjuntar lista de artículos para el alcance.</li>
      </ul>
    </section>
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Acciones rápidas</p>
          <h3>Workflow</h3>
        </div>
        <span class="tag success">Listo</span>
      </div>
      <ul class="muted">
        <li>Botón para comenzar conteo cuando esté asignado.</li>
        <li>Envía notificación a sucursal y responsable.</li>
        <li>Bitácora de creación y cambios de estado.</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.success-message {
  color: var(--success);
  margin-top: 0.5rem;
}

.results {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--line);
  border-radius: 10px;
}
</style>
