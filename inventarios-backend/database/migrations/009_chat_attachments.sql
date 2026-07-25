-- Adjuntos (1 archivo por mensaje) en el chat de Diferencias y Diferencias masivas.
-- Nota: este proyecto no tiene runner de migraciones; el DDL real se aplica
-- desde el bloque inline en src/app.ts (initializeDatabases). Este archivo
-- queda solo como referencia versionada del esquema.

-- request_comments nunca quedó documentada en una migración anterior pese a que
-- commentsController.ts ya la usaba; se crea aquí si hiciera falta antes de alterarla.
CREATE TABLE IF NOT EXISTS request_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE request_comments
  ADD COLUMN IF NOT EXISTS attachment_original_name VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS attachment_stored_name VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS attachment_mime_type VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS attachment_size_bytes INT NULL;

ALTER TABLE bulk_request_comments
  ADD COLUMN IF NOT EXISTS attachment_original_name VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS attachment_stored_name VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS attachment_mime_type VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS attachment_size_bytes INT NULL;
