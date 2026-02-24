-- Crear tabla para líneas especiales
CREATE TABLE IF NOT EXISTS special_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  line_code VARCHAR(5) NOT NULL UNIQUE COMMENT 'Primeros 5 caracteres del código de artículo',
  line_name VARCHAR(100) COMMENT 'Nombre descriptivo de la línea',
  tolerance_percentage DECIMAL(5,2) DEFAULT 5.00 COMMENT 'Umbral de diferencia permitido (%)',
  whatsapp_numbers TEXT COMMENT 'JSON array de números de WhatsApp para notificaciones',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Si la línea está activa para monitoreo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_line_code (line_code),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Líneas especiales para monitoreo de diferencias en conteos';

-- Insertar algunas líneas de ejemplo (opcional)
-- INSERT INTO special_lines (line_code, line_name, tolerance_percentage, whatsapp_numbers) 
-- VALUES 
--   ('12345', 'Electrónica', 5.00, '["5212345678901"]'),
--   ('67890', 'Línea Blanca', 10.00, '["5219876543210"]');
