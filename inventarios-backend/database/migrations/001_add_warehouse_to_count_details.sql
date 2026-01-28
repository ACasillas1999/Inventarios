-- ============================================
-- MIGRACIÓN: Agregar soporte de almacenes a count_details
-- ============================================

USE inventarios;

-- 1. Eliminar la restricción UNIQUE actual
ALTER TABLE count_details DROP INDEX unique_count_item;

-- 2. Agregar columna warehouse_id
ALTER TABLE count_details 
ADD COLUMN warehouse_id INT NULL AFTER item_description,
ADD COLUMN warehouse_name VARCHAR(255) NULL AFTER warehouse_id;

-- 3. Crear nueva restricción UNIQUE que incluya warehouse_id
ALTER TABLE count_details 
ADD UNIQUE KEY unique_count_item_warehouse (count_id, item_code, warehouse_id);

-- 4. Agregar índice para warehouse_id
ALTER TABLE count_details 
ADD INDEX idx_warehouse (warehouse_id);

-- 5. Actualizar registros existentes (asignar warehouse_id = 1 por defecto)
UPDATE count_details SET warehouse_id = 1 WHERE warehouse_id IS NULL;

-- 6. Hacer warehouse_id NOT NULL después de actualizar
ALTER TABLE count_details 
MODIFY COLUMN warehouse_id INT NOT NULL;
