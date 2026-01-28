-- ============================================
-- BASE DE DATOS LOCAL PARA INVENTARIOS
-- MySQL 8.0+
-- ============================================

CREATE DATABASE IF NOT EXISTS inventarios
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE inventarios;

-- ============================================
-- TABLA: Usuarios
-- ============================================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  status ENUM('active', 'suspended', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  INDEX idx_email (email),
  INDEX idx_role (role_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: Roles
-- ============================================
CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: Sucursales (configuración local)
-- ============================================
CREATE TABLE branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  db_host VARCHAR(255) NOT NULL,
  db_port INT DEFAULT 3306,
  db_user VARCHAR(100) NOT NULL,
  db_password VARCHAR(255) NOT NULL,
  db_database VARCHAR(100) NOT NULL,
  status ENUM('active', 'inactive', 'error') DEFAULT 'active',
  last_connection_check TIMESTAMP NULL,
  connection_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: Usuario-Sucursal (relación many-to-many)
-- ============================================
CREATE TABLE user_branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  branch_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_branch (user_id, branch_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_branch (branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: Conteos (folios)
-- ============================================
CREATE TABLE counts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  folio VARCHAR(50) NOT NULL UNIQUE,
  branch_id INT NOT NULL,
  type ENUM('ciclico', 'por_familia', 'por_zona', 'rango', 'total') NOT NULL,
  classification ENUM('inventario', 'ajuste') NOT NULL DEFAULT 'inventario',
  classification ENUM('inventario', 'ajuste') NOT NULL DEFAULT 'inventario',
  priority ENUM('baja', 'media', 'alta', 'urgente') DEFAULT 'media',
  status ENUM('pendiente', 'en_proceso', 'terminado', 'cerrado') DEFAULT 'pendiente',
  responsible_user_id INT NOT NULL,
  created_by_user_id INT NOT NULL,
  scheduled_date DATE,
  started_at TIMESTAMP NULL,
  finished_at TIMESTAMP NULL,
  closed_at TIMESTAMP NULL,
  notes TEXT,
  file_path VARCHAR(500),
  tolerance_percentage DECIMAL(5,2) DEFAULT 5.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (responsible_user_id) REFERENCES users(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  INDEX idx_folio (folio),
  INDEX idx_branch (branch_id),
  INDEX idx_status (status),
  INDEX idx_scheduled_date (scheduled_date),
  INDEX idx_responsible (responsible_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: Detalles de conteo
-- ============================================
CREATE TABLE count_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  count_id INT NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  item_description VARCHAR(500),
  warehouse_id INT NOT NULL DEFAULT 1,
  warehouse_name VARCHAR(255),
  system_stock DECIMAL(10,2) DEFAULT 0,
  counted_stock DECIMAL(10,2) DEFAULT 0,
  difference DECIMAL(10,2) GENERATED ALWAYS AS (counted_stock - system_stock) STORED,
  difference_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN system_stock = 0 AND counted_stock = 0 THEN 0
      WHEN system_stock = 0 THEN 100
      ELSE ((counted_stock - system_stock) / system_stock * 100)
    END
  ) STORED,
  unit VARCHAR(20),
  counted_by_user_id INT,
  counted_at TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (count_id) REFERENCES counts(id) ON DELETE CASCADE,
  FOREIGN KEY (counted_by_user_id) REFERENCES users(id),
  INDEX idx_count (count_id),
  INDEX idx_item_code (item_code),
  INDEX idx_warehouse (warehouse_id),
  INDEX idx_difference (difference),
  UNIQUE KEY unique_count_item_warehouse (count_id, item_code, warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: Solicitudes por diferencias
-- ============================================
CREATE TABLE requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  folio VARCHAR(50) NOT NULL UNIQUE,
  count_id INT NOT NULL,
  count_detail_id INT NOT NULL,
  branch_id INT NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  system_stock DECIMAL(10,2) NOT NULL,
  counted_stock DECIMAL(10,2) NOT NULL,
  difference DECIMAL(10,2) NOT NULL,
  status ENUM('pendiente', 'en_revision', 'ajustado', 'rechazado') DEFAULT 'pendiente',
  requested_by_user_id INT NOT NULL,
  reviewed_by_user_id INT,
  reviewed_at TIMESTAMP NULL,
  resolution_notes TEXT,
  evidence_file VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (count_id) REFERENCES counts(id),
  FOREIGN KEY (count_detail_id) REFERENCES count_details(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id),
  INDEX idx_folio (folio),
  INDEX idx_count (count_id),
  INDEX idx_branch (branch_id),
  INDEX idx_status (status),
  INDEX idx_item_code (item_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: Bitácora de auditoría
-- ============================================
CREATE TABLE audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: Configuración del sistema
-- ============================================
CREATE TABLE settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Roles por defecto
INSERT INTO roles (id, name, display_name, description, permissions) VALUES
(1, 'admin', 'Administrador', 'Acceso total al sistema', '["all"]'),
(2, 'jefe_almacen', 'Jefe de Almacén', 'Gestión de almacén y existencias', '["counts.view", "counts.update", "stock.view"]'),
(3, 'jefe_inventarios', 'Jefe de Inventarios', 'Gestión integral de inventarios', '["counts.create", "counts.update", "counts.view", "requests.create", "requests.update"]'),
(4, 'surtidores', 'Surtidores', 'Captura de conteos físicos', '["counts.view", "counts.update"]'),
(5, 'e_inventarios', 'Entradas Inventarios', 'Gestión de entradas y ajustes', '["counts.view", "requests.create"]');

-- Usuario administrador por defecto (password: admin123)
INSERT INTO users (email, password, name, role_id, status) VALUES
('admin@inventarios.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Administrador', 1, 'active');

-- Configuraciones por defecto
INSERT INTO settings (setting_key, setting_value, setting_type, description) VALUES
('tolerance_global', '5', 'number', 'Tolerancia global de diferencias en porcentaje'),
('folio_format', 'CNT-{YEAR}{MONTH}-{NUMBER}', 'string', 'Formato de folio de conteos'),
('pagination_limit', '50', 'number', 'Registros por página'),
('timezone', 'America/Mexico_City', 'string', 'Zona horaria del sistema'),
('cache_ttl_stock', '300', 'number', 'TTL de caché de existencias en segundos'),
('cache_ttl_items', '3600', 'number', 'TTL de caché de artículos en segundos');
