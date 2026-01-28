-- Migración: Refinar estados de conteo
-- Pendiente -> pendiente (sin cambios)
-- En proceso -> contando
-- Terminado -> contado
-- Cerrado -> cerrado (sin cambios)
-- Añadir: cancelado

ALTER TABLE counts MODIFY COLUMN status ENUM('pendiente', 'contando', 'contado', 'cerrado', 'cancelado') DEFAULT 'pendiente';

-- Migrar datos existentes (si los hay con los nombres viejos, aunque el ALTER anterior podría fallar si hay datos no compatibles)
-- En este caso, como estamos cambiando el ENUM, el ALTER TABLE se encargará si los valores coinciden, 
-- pero para mayor seguridad lo hacemos paso a paso si es necesario.

UPDATE counts SET status = 'contando' WHERE status = 'en_proceso';
UPDATE counts SET status = 'contado' WHERE status = 'terminado';
