-- Bitácora de quién y cuántas veces se descargó cada archivo adjunto
-- de una solicitud de diferencias masivas.
-- Nota: este proyecto no tiene runner de migraciones; el DDL real se aplica
-- desde el bloque inline en src/app.ts (initializeDatabases). Este archivo
-- queda solo como referencia versionada del esquema.

CREATE TABLE IF NOT EXISTS bulk_request_file_downloads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bulk_request_file_id INT NOT NULL,
  user_id INT NOT NULL,
  downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bulk_request_file_id) REFERENCES bulk_request_files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_file (bulk_request_file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
