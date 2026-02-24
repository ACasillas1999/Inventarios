<template>
  <div v-if="warehousesData" class="warehouses-panel panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Artículo</p>
        <h3>{{ warehousesData.item_code }}</h3>
        <p class="muted">{{ warehousesData.item_description }}</p>
      </div>
      <div class="item-meta">
        <span class="tag">Línea: {{ warehousesData.item_line }}</span>
        <span class="tag accent">Total: {{ warehousesData.total_stock }} {{ warehousesData.item_unit }}</span>
      </div>
    </div>

    <div class="warehouses-table">
      <table class="table">
        <thead>
          <tr>
            <th>Almacén</th>
            <th>Existencia Sistema</th>
            <th>Rack</th>
            <th>Costo Promedio</th>
            <th v-if="canCount">Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="wh in warehousesData.warehouses" :key="wh.warehouse_id">
            <td><strong>{{ wh.warehouse_name }}</strong></td>
            <td>{{ wh.stock }}</td>
            <td>{{ wh.rack || '-' }}</td>
            <td>${{ wh.avg_cost?.toFixed(2) || '0.00' }}</td>
            <td v-if="canCount">
              <button 
                class="btn small" 
                @click="$emit('count-warehouse', wh)"
                :disabled="isWarehouseCounted(wh.warehouse_id)"
              >
                {{ isWarehouseCounted(wh.warehouse_id) ? 'Contado' : 'Contar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface WarehouseStock {
  warehouse_id: number
  warehouse_name: string
  stock: number
  rack: string | null
  avg_cost: number
  min_stock: number | null
  max_stock: number | null
  reorder_point: number | null
}

interface WarehousesData {
  item_code: string
  item_description: string
  item_line: string
  item_unit: string
  total_stock: number
  warehouses: WarehouseStock[]
}

interface Props {
  warehousesData: WarehousesData | null
  canCount?: boolean
  countedWarehouses?: Set<number>
}

const props = withDefaults(defineProps<Props>(), {
  canCount: false,
  countedWarehouses: () => new Set()
})

defineEmits<{
  (e: 'count-warehouse', warehouse: WarehouseStock): void
}>()

const isWarehouseCounted = (warehouseId: number) => {
  return props.countedWarehouses?.has(warehouseId) || false
}
</script>

<style scoped>
.warehouses-panel {
  margin-top: 1rem;
}

.item-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.warehouses-table {
  margin-top: 1rem;
}

.btn.small {
  padding: 0.35rem 0.75rem;
  font-size: 0.875rem;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(15, 23, 42, 0.04);
  font-size: 0.875rem;
  font-weight: 600;
}

.tag.accent {
  background: rgba(37, 99, 235, 0.08);
  border-color: rgba(37, 99, 235, 0.2);
}
</style>
