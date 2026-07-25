-- Diferencias masivas: solicitud tipo ticket con archivos adjuntos (CSV/Excel)
-- Nota: este proyecto no tiene runner de migraciones; el DDL real se aplica
-- desde el bloque inline en src/app.ts (initializeDatabases). Este archivo
-- queda solo como referencia versionada del esquema.

CREATE TABLE IF NOT EXISTS bulk_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  folio VARCHAR(50) NOT NULL UNIQUE,
  branch_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  warehouse_name VARCHAR(255),
  classification ENUM('ajuste') NOT NULL DEFAULT 'ajuste',
  priority ENUM('baja', 'media', 'alta', 'urgente', 'mostrador') DEFAULT 'media',
  responsible_user_id INT NOT NULL,
  requested_by_user_id INT NOT NULL,
  notes TEXT NOT NULL,
  status ENUM('pendiente', 'en_revision', 'ajustado', 'rechazado') DEFAULT 'pendiente',
  movement_number VARCHAR(100),
  resolution_notes TEXT,
  reviewed_by_user_id INT,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (responsible_user_id) REFERENCES users(id),
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id),
  INDEX idx_folio (folio),
  INDEX idx_branch (branch_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bulk_request_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bulk_request_id INT NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  stored_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(150),
  size_bytes INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bulk_request_id) REFERENCES bulk_requests(id) ON DELETE CASCADE,
  INDEX idx_bulk_request (bulk_request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bulk_request_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bulk_request_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bulk_request_id) REFERENCES bulk_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_bulk_request (bulk_request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permisos nuevos para el flujo de diferencias masivas
UPDATE roles
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'bulk_requests.create')
WHERE name IN ('jefe_inventarios', 'e_inventarios', 'gerente', 'auxiliar_gerente')
  AND NOT JSON_CONTAINS(permissions, '"bulk_requests.create"');

UPDATE roles
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'bulk_requests.manage')
WHERE name IN ('jefe_inventarios', 'e_inventarios')
  AND NOT JSON_CONTAINS(permissions, '"bulk_requests.manage"');
