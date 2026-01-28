-- Migración para actualizar los roles de usuario
-- Ejecutar en la base de datos 'inventarios'

-- 1. Limpiar roles existentes (opcional, pero recomendado para consistencia)
-- Si hay usuarios vinculados, primero actualizamos sus roles a un valor temporal o al nuevo admin
UPDATE users SET role_id = 1;

DELETE FROM roles;

-- 2. Insertar los nuevos roles solicitados
INSERT INTO roles (id, name, display_name, description, permissions) VALUES
(1, 'admin', 'Administrador', 'Acceso total al sistema', '["all"]'),
(2, 'jefe_almacen', 'Jefe de Almacén', 'Gestión de almacén y existencias', '["counts.view", "counts.update", "stock.view"]'),
(3, 'jefe_inventarios', 'Jefe de Inventarios', 'Gestión integral de inventarios', '["counts.create", "counts.update", "counts.view", "requests.create", "requests.update"]'),
(4, 'surtidores', 'Surtidores', 'Captura de conteos físicos', '["counts.view", "counts.update"]'),
(5, 'e_inventarios', 'Entradas Inventarios', 'Gestión de entradas y ajustes', '["counts.view", "requests.create"]');

-- 3. Asegurar que el usuario admin tenga el ID de rol correcto
UPDATE users SET role_id = 1 WHERE email = 'admin@inventarios.com';
