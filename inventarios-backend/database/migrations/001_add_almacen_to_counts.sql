-- ============================================
-- Migration: Add almacen field to counts table
-- Purpose: Track which warehouse/almacén is being counted
-- ============================================

USE inventarios;

-- Add almacen column to counts table
-- Almacen 1 = Sucursal principal (main branch)
-- Almacen 2+ = Bodegas (warehouses)
ALTER TABLE counts
ADD COLUMN almacen INT DEFAULT 1 NOT NULL AFTER branch_id,
ADD INDEX idx_almacen (almacen);

-- Add comment to document the field
ALTER TABLE counts
MODIFY COLUMN almacen INT DEFAULT 1 NOT NULL COMMENT 'Warehouse number: 1=main branch, 2+=warehouses';
