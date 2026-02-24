<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { specialLinesService, stockService, type SpecialLine } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import MobileMenuToggle from '@/components/MobileMenuToggle.vue'
import Swal from 'sweetalert2'

const authStore = useAuthStore()

const lines = ref<SpecialLine[]>([])
const loading = ref(true)
const error = ref('')
const showModal = ref(false)
const editingLine = ref<SpecialLine | null>(null)
const searchText = ref('')

// Líneas disponibles (primeros 5 caracteres de códigos de artículos)
const availableLines = ref<string[]>([])
const loadingAvailableLines = ref(false)

const modalForm = reactive({
  line_code: '',
  line_name: '',
  tolerance_percentage: 5,
  whatsapp_numbers: [] as string[],
  is_active: true
})

const newWhatsAppNumber = ref('')

// Filtrar líneas por búsqueda
const filteredLines = computed(() => {
  if (!searchText.value.trim()) return lines.value
  
  const search = searchText.value.toLowerCase().trim()
  
  return lines.value.filter((line) => {
    if (line.line_code?.toLowerCase().includes(search)) return true
    if (line.line_name?.toLowerCase().includes(search)) return true
    return false
  })
})

const loadLines = async () => {
  try {
    loading.value = true
    error.value = ''
    const response = await specialLinesService.getAll()
    lines.value = response.lines || []
  } catch (err: any) {
    console.error('Error loading special lines:', err)
    error.value = 'No se pudieron cargar las líneas especiales'
  } finally {
    loading.value = false
  }
}

const loadAvailableLines = async () => {
  try {
    loadingAvailableLines.value = true
    // Obtener líneas de la primera sucursal disponible
    const branchId = authStore.user?.branches?.[0]?.id || 1
    const response = await stockService.getLines(branchId)
    availableLines.value = response.lines || []
  } catch (err) {
    console.error('Error loading available lines:', err)
    availableLines.value = []
  } finally {
    loadingAvailableLines.value = false
  }
}

const openNewLineModal = () => {
  editingLine.value = null
  Object.assign(modalForm, {
    line_code: '',
    line_name: '',
    tolerance_percentage: 5,
    whatsapp_numbers: [],
    is_active: true
  })
  showModal.value = true
  if (availableLines.value.length === 0) {
    loadAvailableLines()
  }
}

const openEditLineModal = (line: SpecialLine) => {
  editingLine.value = line
  Object.assign(modalForm, {
    line_code: line.line_code,
    line_name: line.line_name || '',
    tolerance_percentage: line.tolerance_percentage,
    whatsapp_numbers: specialLinesService.parseWhatsAppNumbers(line),
    is_active: line.is_active
  })
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingLine.value = null
  newWhatsAppNumber.value = ''
}

const addWhatsAppNumber = () => {
  const number = newWhatsAppNumber.value.trim()
  if (!number) return
  
  // Validar formato básico (números y +)
  if (!/^[\d+]+$/.test(number)) {
    Swal.fire({
      icon: 'warning',
      title: 'Formato inválido',
      text: 'El número solo debe contener dígitos y el símbolo +',
      confirmButtonText: 'Entendido'
    })
    return
  }
  
  if (modalForm.whatsapp_numbers.includes(number)) {
    Swal.fire({
      icon: 'info',
      title: 'Número duplicado',
      text: 'Este número ya está agregado',
      confirmButtonText: 'Entendido'
    })
    return
  }
  
  modalForm.whatsapp_numbers.push(number)
  newWhatsAppNumber.value = ''
}

const removeWhatsAppNumber = (index: number) => {
  modalForm.whatsapp_numbers.splice(index, 1)
}

const saveLine = async () => {
  try {
    if (!modalForm.line_code || modalForm.line_code.length !== 5) {
      Swal.fire({
        icon: 'warning',
        title: 'Código inválido',
        text: 'El código de línea debe tener exactamente 5 caracteres',
        confirmButtonText: 'Entendido'
      })
      return
    }
    
    if (modalForm.tolerance_percentage < 0 || modalForm.tolerance_percentage > 100) {
      Swal.fire({
        icon: 'warning',
        title: 'Tolerancia inválida',
        text: 'La tolerancia debe estar entre 0 y 100%',
        confirmButtonText: 'Entendido'
      })
      return
    }
    
    const data = {
      line_code: modalForm.line_code.toUpperCase(),
      line_name: modalForm.line_name || undefined,
      tolerance_percentage: modalForm.tolerance_percentage,
      whatsapp_numbers: modalForm.whatsapp_numbers.length > 0 ? modalForm.whatsapp_numbers : undefined,
      is_active: modalForm.is_active
    }
    
    if (editingLine.value) {
      await specialLinesService.update(editingLine.value.id, data)
      Swal.fire({
        icon: 'success',
        title: '¡Actualizado!',
        text: 'Línea especial actualizada correctamente',
        timer: 2000,
        showConfirmButton: false
      })
    } else {
      await specialLinesService.create(data)
      Swal.fire({
        icon: 'success',
        title: '¡Creado!',
        text: 'Línea especial creada correctamente',
        timer: 2000,
        showConfirmButton: false
      })
    }
    
    closeModal()
    await loadLines()
  } catch (err: any) {
    console.error('Error saving special line:', err)
    Swal.fire({
      icon: 'error',
      title: 'Error al guardar',
      text: err.response?.data?.error || err.message,
      confirmButtonText: 'Cerrar'
    })
  }
}

const deleteLine = async (line: SpecialLine) => {
  const result = await Swal.fire({
    icon: 'warning',
    title: '¿Estás seguro?',
    text: `Se eliminará la línea ${line.line_code}`,
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6b7280'
  })
  
  if (!result.isConfirmed) {
    return
  }
  
  try {
    await specialLinesService.delete(line.id)
    Swal.fire({
      icon: 'success',
      title: '¡Eliminado!',
      text: 'Línea especial eliminada correctamente',
      timer: 2000,
      showConfirmButton: false
    })
    await loadLines()
  } catch (err: any) {
    console.error('Error deleting special line:', err)
    Swal.fire({
      icon: 'error',
      title: 'Error al eliminar',
      text: err.response?.data?.error || err.message,
      confirmButtonText: 'Cerrar'
    })
  }
}

const toggleActive = async (line: SpecialLine) => {
  try {
    await specialLinesService.toggleActive(line.id, !line.is_active)
    await loadLines()
  } catch (err: any) {
    console.error('Error toggling special line:', err)
    Swal.fire({
      icon: 'error',
      title: 'Error al cambiar estado',
      text: err.response?.data?.error || err.message,
      confirmButtonText: 'Cerrar'
    })
  }
}

const getWhatsAppNumbers = (line: SpecialLine): string[] => {
  return specialLinesService.parseWhatsAppNumbers(line)
}

onMounted(async () => {
  await loadLines()
})
</script>

<template>
  <section class="panel wide">
    <div class="panel-header">
      <div class="panel-title">
        <MobileMenuToggle />
        <div class="panel-title-text">
          <p class="eyebrow">Configuración</p>
          <h2>Líneas Especiales</h2>
          <p class="muted">Gestiona líneas con monitoreo especial y notificaciones por WhatsApp.</p>
        </div>
      </div>
      <div class="header-actions">
        <button v-if="authStore.hasPermission('admin')" class="btn" @click="openNewLineModal">
          + Nueva línea especial
        </button>
        <span class="tag accent">{{ lines.length }} líneas</span>
      </div>
    </div>

    <!-- Buscador -->
    <div class="search-bar" style="margin-bottom: 0.75rem">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input
          id="search-text"
          v-model="searchText"
          type="text"
          placeholder="Buscar por código o nombre de línea..."
          class="search-input"
        />
        <button
          v-if="searchText"
          class="clear-search"
          @click="searchText = ''"
          title="Limpiar búsqueda"
        >
          ×
        </button>
      </div>
      <div v-if="searchText && filteredLines.length !== lines.length" class="search-results-info">
        <span class="tag">{{ filteredLines.length }} de {{ lines.length }} líneas</span>
      </div>
    </div>

    <div v-if="loading" class="muted" style="padding: 1rem">Cargando líneas especiales...</div>
    <div v-else-if="error" class="error-message panel">
      <p>{{ error }}</p>
      <button class="btn" @click="loadLines">Reintentar</button>
    </div>

    <template v-else>
      <!-- Grid de tarjetas -->
      <div class="lines-grid">
        <div v-if="filteredLines.length === 0" class="empty-state">
          <p class="muted">
            {{ searchText ? 'No se encontraron líneas con ese criterio' : 'No hay líneas especiales configuradas' }}
          </p>
        </div>

        <div v-for="line in filteredLines" :key="line.id" class="line-card">
          <!-- Header -->
          <div class="line-card-header">
            <div class="line-code-badge">{{ line.line_code }}</div>
            <div class="line-status">
              <span :class="['status-badge', line.is_active ? 'active' : 'inactive']">
                {{ line.is_active ? '✓ Activa' : '✕ Inactiva' }}
              </span>
            </div>
          </div>

          <!-- Title -->
          <h3 class="line-card-title">
            {{ line.line_name || 'Sin nombre' }}
          </h3>

          <!-- Details -->
          <div class="line-card-details">
            <div class="line-detail-item">
              <span class="detail-label">TOLERANCIA</span>
              <span class="detail-value">{{ line.tolerance_percentage }}%</span>
            </div>

            <div class="line-detail-item">
              <span class="detail-label">WHATSAPP</span>
              <span class="detail-value">
                {{ getWhatsAppNumbers(line).length }} número(s)
              </span>
            </div>
          </div>

          <!-- WhatsApp Numbers -->
          <div v-if="getWhatsAppNumbers(line).length > 0" class="whatsapp-numbers">
            <span class="detail-label">NÚMEROS CONFIGURADOS</span>
            <div class="numbers-list">
              <div v-for="(number, idx) in getWhatsAppNumbers(line)" :key="idx" class="number-chip">
                📱 {{ number }}
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="line-card-footer">
            <button class="btn ghost small" @click="openEditLineModal(line)">
              ✏️ Editar
            </button>
            <button
              class="btn ghost small"
              :class="line.is_active ? 'warning' : 'success'"
              @click="toggleActive(line)"
            >
              {{ line.is_active ? '⏸ Desactivar' : '▶ Activar' }}
            </button>
            <button class="btn ghost small danger" @click="deleteLine(line)">
              🗑️ Eliminar
            </button>
          </div>
        </div>
      </div>
    </template>
  </section>

  <!-- Modal para crear/editar línea -->
  <div v-if="showModal" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ editingLine ? 'Editar línea especial' : 'Nueva línea especial' }}</h3>
        <button class="btn-close" @click="closeModal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div>
            <label for="line-code">Código de línea (5 caracteres) *</label>
            <input
              id="line-code"
              v-model="modalForm.line_code"
              type="text"
              maxlength="5"
              :disabled="!!editingLine"
              placeholder="Ej: 12345"
              @input="modalForm.line_code = modalForm.line_code.toUpperCase()"
            />
            <p class="muted small" style="margin-top: 0.25rem">
              Primeros 5 caracteres del código de artículo
            </p>
          </div>

          <div>
            <label for="line-name">Nombre descriptivo</label>
            <input
              id="line-name"
              v-model="modalForm.line_name"
              type="text"
              placeholder="Ej: Electrónica"
            />
          </div>

          <div>
            <label for="tolerance">Tolerancia (%)</label>
            <input
              id="tolerance"
              v-model.number="modalForm.tolerance_percentage"
              type="number"
              min="0"
              max="100"
              step="0.1"
            />
            <p class="muted small" style="margin-top: 0.25rem">
              Umbral de diferencia para enviar notificación
            </p>
          </div>

          <div>
            <label>
              <input type="checkbox" v-model="modalForm.is_active" />
              Línea activa
            </label>
          </div>
        </div>

        <!-- Números de WhatsApp -->
        <div class="modal-section">
          <h4>Números de WhatsApp</h4>
          <p class="muted small">Números que recibirán notificaciones cuando se detecten diferencias</p>

          <div class="whatsapp-input-group">
            <input
              v-model="newWhatsAppNumber"
              type="text"
              placeholder="Ej: 5212345678901"
              @keyup.enter="addWhatsAppNumber"
            />
            <button class="btn" @click="addWhatsAppNumber">+ Agregar</button>
          </div>

          <div v-if="modalForm.whatsapp_numbers.length > 0" class="whatsapp-list">
            <div
              v-for="(number, index) in modalForm.whatsapp_numbers"
              :key="index"
              class="whatsapp-item"
            >
              <span>📱 {{ number }}</span>
              <button class="btn-remove" @click="removeWhatsAppNumber(index)">×</button>
            </div>
          </div>
          <p v-else class="muted small" style="margin-top: 0.5rem">
            No hay números configurados
          </p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn ghost" @click="closeModal">Cancelar</button>
        <button class="btn" @click="saveLine">
          {{ editingLine ? 'Actualizar' : 'Crear' }} línea
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Search bar styles (reutilizando de CountsListView) */
.search-bar {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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
  padding: 0.75rem 1rem 0.75rem 2.75rem;
  border: 1px solid var(--line);
  border-radius: 12px;
  font-size: 0.95rem;
  background: var(--panel);
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
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
  padding-left: 0.5rem;
}

/* Lines grid */
.lines-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.line-card {
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 12px;
  padding: 1.25rem;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.line-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: rgba(37, 99, 235, 0.2);
}

.line-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.line-code-badge {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--accent);
  font-family: 'Courier New', monospace;
  background: rgba(37, 99, 235, 0.08);
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
}

.line-status {
  display: flex;
  gap: 0.5rem;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.35rem 0.65rem;
  border-radius: 6px;
  letter-spacing: 0.03em;
}

.status-badge.active {
  background: rgba(34, 197, 94, 0.12);
  color: #166534;
}

.status-badge.inactive {
  background: rgba(148, 163, 184, 0.12);
  color: #475569;
}

.line-card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 1rem 0;
  line-height: 1.3;
}

.line-card-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.line-detail-item {
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

.whatsapp-numbers {
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.numbers-list {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.number-chip {
  padding: 0.4rem 0.6rem;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 6px;
  font-size: 0.85rem;
  color: #166534;
  font-family: 'Courier New', monospace;
}

.line-card-footer {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.85rem;
  flex-wrap: wrap;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem 1rem;
}

/* Modal styles */
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
  max-width: 600px;
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

.modal-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px dashed var(--line);
}

.modal-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: var(--ink);
}

.whatsapp-input-group {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.whatsapp-input-group input {
  flex: 1;
}

.whatsapp-list {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.whatsapp-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 8px;
  font-family: 'Courier New', monospace;
}

.btn-remove {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--muted);
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.btn-remove:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

/* Responsive */
@media (max-width: 768px) {
  .lines-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .line-card {
    padding: 1rem;
  }

  .line-card-details {
    grid-template-columns: 1fr;
  }

  .line-card-footer {
    flex-direction: column;
  }

  .line-card-footer button {
    width: 100%;
  }

  .modal-content {
    max-width: 100%;
    max-height: 95vh;
    border-radius: 12px;
  }

  .whatsapp-input-group {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .line-card {
    padding: 0.85rem;
  }

  .line-code-badge {
    font-size: 1rem;
    padding: 0.35rem 0.6rem;
  }

  .status-badge {
    font-size: 0.7rem;
    padding: 0.3rem 0.5rem;
  }

  .modal-content {
    border-radius: 0;
    max-height: 100vh;
  }
}
</style>
