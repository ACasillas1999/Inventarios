-- ============================================
-- BASES DE DATOS DE PRUEBA PARA SUCURSALES
-- Simula la estructura de las tiendas reales
-- ============================================

-- ============================================
-- SUCURSAL 1 - Tienda Centro
-- ============================================
CREATE DATABASE IF NOT EXISTS tienda_centro
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE tienda_centro;

CREATE TABLE IF NOT EXISTS Inventario_Maximo (
  Clave_Articulo VARCHAR(50) PRIMARY KEY,
  Almacen VARCHAR(255),
  Inventario_Minimo DECIMAL(10,2) DEFAULT 0,
  Inventario_Maximo DECIMAL(10,2) DEFAULT 0,
  Punto_Reorden DECIMAL(10,2) DEFAULT 0,
  Rack VARCHAR(50),
  Existencia_Teorica DECIMAL(10,2) DEFAULT 0,
  Existencia_Fisica DECIMAL(10,2) DEFAULT 0,
  Costo_Promedio DECIMAL(10,2) DEFAULT 0,
  Costo_Promedio_Ant DECIMAL(10,2) DEFAULT 0,
  Costo_Ult_Compra DECIMAL(10,2) DEFAULT 0,
  Fecha_Ult_Compra DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar datos de prueba
INSERT INTO Inventario_Maximo (Clave_Articulo, Almacen, Inventario_Minimo, Inventario_Maximo, Punto_Reorden, Rack, Existencia_Teorica, Existencia_Fisica, Costo_Promedio, Costo_Ult_Compra) VALUES
('ART001', 'Laptop HP 15-dy2xxx', 5, 50, 10, 'A1-B2', 25, 24, 8500.00, 8300.00),
('ART002', 'Mouse Logitech M185', 20, 200, 50, 'C3-D4', 120, 118, 150.00, 145.00),
('ART003', 'Teclado Mecánico RGB', 10, 100, 25, 'A2-B3', 45, 46, 850.00, 870.00),
('ART004', 'Monitor Samsung 24"', 8, 80, 15, 'B1-C2', 32, 30, 2500.00, 2450.00),
('ART005', 'Audífonos Sony WH-1000XM4', 5, 50, 12, 'D1-E2', 18, 17, 4500.00, 4600.00),
('ART006', 'Webcam Logitech C920', 10, 80, 20, 'A3-B4', 35, 35, 1200.00, 1180.00),
('ART007', 'Disco SSD Kingston 500GB', 15, 150, 30, 'C1-D2', 75, 73, 850.00, 870.00),
('ART008', 'Memoria RAM DDR4 16GB', 20, 200, 40, 'B2-C3', 95, 98, 1200.00, 1180.00),
('ART009', 'Router TP-Link AC1750', 8, 60, 15, 'E1-F2', 28, 27, 950.00, 920.00),
('ART010', 'Impresora HP LaserJet', 3, 30, 8, 'F1-G2', 12, 11, 3500.00, 3550.00);

-- ============================================
-- SUCURSAL 2 - Tienda Norte
-- ============================================
CREATE DATABASE IF NOT EXISTS tienda_norte
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE tienda_norte;

CREATE TABLE IF NOT EXISTS Inventario_Maximo (
  Clave_Articulo VARCHAR(50) PRIMARY KEY,
  Almacen VARCHAR(255),
  Inventario_Minimo DECIMAL(10,2) DEFAULT 0,
  Inventario_Maximo DECIMAL(10,2) DEFAULT 0,
  Punto_Reorden DECIMAL(10,2) DEFAULT 0,
  Rack VARCHAR(50),
  Existencia_Teorica DECIMAL(10,2) DEFAULT 0,
  Existencia_Fisica DECIMAL(10,2) DEFAULT 0,
  Costo_Promedio DECIMAL(10,2) DEFAULT 0,
  Costo_Promedio_Ant DECIMAL(10,2) DEFAULT 0,
  Costo_Ult_Compra DECIMAL(10,2) DEFAULT 0,
  Fecha_Ult_Compra DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar datos de prueba (diferentes cantidades)
INSERT INTO Inventario_Maximo (Clave_Articulo, Almacen, Inventario_Minimo, Inventario_Maximo, Punto_Reorden, Rack, Existencia_Teorica, Existencia_Fisica, Costo_Promedio, Costo_Ult_Compra) VALUES
('ART001', 'Laptop HP 15-dy2xxx', 5, 50, 10, 'N1-A1', 18, 19, 8500.00, 8300.00),
('ART002', 'Mouse Logitech M185', 20, 200, 50, 'N2-B2', 150, 145, 150.00, 145.00),
('ART003', 'Teclado Mecánico RGB', 10, 100, 25, 'N3-C3', 52, 50, 850.00, 870.00),
('ART004', 'Monitor Samsung 24"', 8, 80, 15, 'N1-B1', 28, 30, 2500.00, 2450.00),
('ART005', 'Audífonos Sony WH-1000XM4', 5, 50, 12, 'N4-D4', 22, 21, 4500.00, 4600.00),
('ART006', 'Webcam Logitech C920', 10, 80, 20, 'N2-A2', 40, 38, 1200.00, 1180.00),
('ART007', 'Disco SSD Kingston 500GB', 15, 150, 30, 'N3-B3', 88, 90, 850.00, 870.00),
('ART008', 'Memoria RAM DDR4 16GB', 20, 200, 40, 'N1-C1', 110, 108, 1200.00, 1180.00),
('ART009', 'Router TP-Link AC1750', 8, 60, 15, 'N4-E4', 32, 35, 950.00, 920.00),
('ART010', 'Impresora HP LaserJet', 3, 30, 8, 'N2-F2', 15, 14, 3500.00, 3550.00);

-- ============================================
-- SUCURSAL 3 - Tienda Sur
-- ============================================
CREATE DATABASE IF NOT EXISTS tienda_sur
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE tienda_sur;

CREATE TABLE IF NOT EXISTS Inventario_Maximo (
  Clave_Articulo VARCHAR(50) PRIMARY KEY,
  Almacen VARCHAR(255),
  Inventario_Minimo DECIMAL(10,2) DEFAULT 0,
  Inventario_Maximo DECIMAL(10,2) DEFAULT 0,
  Punto_Reorden DECIMAL(10,2) DEFAULT 0,
  Rack VARCHAR(50),
  Existencia_Teorica DECIMAL(10,2) DEFAULT 0,
  Existencia_Fisica DECIMAL(10,2) DEFAULT 0,
  Costo_Promedio DECIMAL(10,2) DEFAULT 0,
  Costo_Promedio_Ant DECIMAL(10,2) DEFAULT 0,
  Costo_Ult_Compra DECIMAL(10,2) DEFAULT 0,
  Fecha_Ult_Compra DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar datos de prueba (diferentes cantidades)
INSERT INTO Inventario_Maximo (Clave_Articulo, Almacen, Inventario_Minimo, Inventario_Maximo, Punto_Reorden, Rack, Existencia_Teorica, Existencia_Fisica, Costo_Promedio, Costo_Ult_Compra) VALUES
('ART001', 'Laptop HP 15-dy2xxx', 5, 50, 10, 'S1-X1', 30, 28, 8500.00, 8300.00),
('ART002', 'Mouse Logitech M185', 20, 200, 50, 'S2-Y2', 95, 98, 150.00, 145.00),
('ART003', 'Teclado Mecánico RGB', 10, 100, 25, 'S3-Z3', 38, 40, 850.00, 870.00),
('ART004', 'Monitor Samsung 24"', 8, 80, 15, 'S1-Y1', 25, 23, 2500.00, 2450.00),
('ART005', 'Audífonos Sony WH-1000XM4', 5, 50, 12, 'S4-W4', 14, 15, 4500.00, 4600.00),
('ART006', 'Webcam Logitech C920', 10, 80, 20, 'S2-X2', 32, 30, 1200.00, 1180.00),
('ART007', 'Disco SSD Kingston 500GB', 15, 150, 30, 'S3-Y3', 68, 65, 850.00, 870.00),
('ART008', 'Memoria RAM DDR4 16GB', 20, 200, 40, 'S1-Z1', 82, 85, 1200.00, 1180.00),
('ART009', 'Router TP-Link AC1750', 8, 60, 15, 'S4-X4', 24, 22, 950.00, 920.00),
('ART010', 'Impresora HP LaserJet', 3, 30, 8, 'S2-W2', 9, 10, 3500.00, 3550.00);

-- ============================================
-- Crear usuarios de solo lectura para cada BD
-- ============================================
-- Usuario para tienda_centro
CREATE USER IF NOT EXISTS 'readonly_centro'@'localhost' IDENTIFIED BY 'centro123';
GRANT SELECT ON tienda_centro.* TO 'readonly_centro'@'localhost';

-- Usuario para tienda_norte
CREATE USER IF NOT EXISTS 'readonly_norte'@'localhost' IDENTIFIED BY 'norte123';
GRANT SELECT ON tienda_norte.* TO 'readonly_norte'@'localhost';

-- Usuario para tienda_sur
CREATE USER IF NOT EXISTS 'readonly_sur'@'localhost' IDENTIFIED BY 'sur123';
GRANT SELECT ON tienda_sur.* TO 'readonly_sur'@'localhost';

FLUSH PRIVILEGES;

-- ============================================
-- Información
-- ============================================
SELECT '✅ Bases de datos de prueba creadas exitosamente' as Status;
SELECT 'tienda_centro, tienda_norte, tienda_sur' as Databases_Created;
SELECT 'Usuarios: readonly_centro, readonly_norte, readonly_sur' as Users_Created;
SELECT 'Contraseñas: centro123, norte123, sur123' as Passwords;
