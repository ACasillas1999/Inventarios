ALTER TABLE counts
ADD COLUMN classification ENUM('inventario', 'ajuste') NOT NULL DEFAULT 'inventario' AFTER type;

ALTER TABLE counts ADD INDEX idx_classification (classification);
