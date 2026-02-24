-- ============================================
-- Script para generar datos de prueba de cobertura (MySQL/MariaDB)
-- Propósito: Validar que las estadísticas de cobertura funcionan correctamente
-- sin necesidad de hacer conteos manuales
-- ============================================

-- IMPORTANTE: Este script es solo para PRUEBAS
-- Ejecutar en un entorno de desarrollo/testing, NO en producción

-- ============================================
-- PASO 1: Verificar estado actual
-- ============================================
SELECT 
    'ESTADO ACTUAL' as info,
    COUNT(DISTINCT cd.item_code) as articulos_contados,
    (SELECT COUNT(*) FROM Articulos) as total_articulos,
    ROUND(COUNT(DISTINCT cd.item_code) * 100.0 / (SELECT COUNT(*) FROM Articulos), 2) as porcentaje_cobertura
FROM count_details cd;

-- ============================================
-- PASO 2: Crear conteo de prueba #1
-- ============================================

-- Variables (ajustar según tu configuración)
SET @user_id = 1; -- ID del usuario que creará los conteos
SET @branch_id = 1; -- ID de la sucursal

-- Verificar que el usuario existe
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM users WHERE id = @user_id) 
        THEN CONCAT('✓ Usuario ID ', @user_id, ' existe')
        ELSE 'ERROR: Usuario no existe. Ajusta @user_id'
    END as verificacion_usuario;

-- Crear conteo de prueba #1
INSERT INTO counts (
    folio, 
    branch_id, 
    almacen,
    type, 
    classification, 
    status, 
    priority,
    responsible_user_id, 
    created_by_user_id,
    tolerance_percentage,
    created_at,
    updated_at
)
VALUES (
    'TEST-COVERAGE-001', 
    @branch_id, 
    1,
    'total', 
    'inventario', 
    'contado',
    'media',
    @user_id, 
    @user_id,
    5,
    NOW(),
    NOW()
);

-- Obtener el ID del conteo recién creado
SET @count_id_1 = LAST_INSERT_ID();

SELECT CONCAT('✓ Conteo de prueba #1 creado con ID: ', @count_id_1) as resultado;

-- ============================================
-- PASO 3: Insertar 5000 artículos aleatorios como contados
-- ============================================

INSERT INTO count_details (
    count_id, 
    item_code, 
    item_description,
    warehouse_id, 
    warehouse_name,
    system_stock, 
    counted_stock,
    unit,
    difference,
    difference_percentage,
    created_at,
    updated_at
)
SELECT 
    @count_id_1,
    a.Clave_Articulo,
    a.Descripcion,
    1,
    'Sucursal principal',
    IFNULL(a.Existencia_Fisica, 0),
    IFNULL(a.Existencia_Fisica, 0), -- Mismo valor para simular conteo exacto
    IFNULL(a.Unidad, 'PZA'),
    0, -- Sin diferencia
    0, -- 0% diferencia
    NOW(),
    NOW()
FROM Articulos a
WHERE a.Clave_Articulo IS NOT NULL
ORDER BY RAND() -- Orden aleatorio en MySQL
LIMIT 5000;

SELECT '✓ 5000 artículos insertados en conteo #1' as resultado;

-- ============================================
-- PASO 4: Crear conteo de prueba #2 con diferencias
-- ============================================

INSERT INTO counts (
    folio, 
    branch_id, 
    almacen,
    type, 
    classification, 
    status, 
    priority,
    responsible_user_id, 
    created_by_user_id,
    tolerance_percentage,
    created_at,
    updated_at
)
VALUES (
    'TEST-COVERAGE-002', 
    @branch_id, 
    1,
    'ciclico', 
    'inventario', 
    'contado',
    'alta',
    @user_id, 
    @user_id,
    5,
    NOW(),
    NOW()
);

SET @count_id_2 = LAST_INSERT_ID();

SELECT CONCAT('✓ Conteo de prueba #2 creado con ID: ', @count_id_2) as resultado;

-- Insertar 500 artículos con diferencias aleatorias
INSERT INTO count_details (
    count_id, 
    item_code, 
    item_description,
    warehouse_id, 
    warehouse_name,
    system_stock, 
    counted_stock,
    unit,
    difference,
    difference_percentage,
    created_at,
    updated_at
)
SELECT 
    @count_id_2,
    a.Clave_Articulo,
    a.Descripcion,
    1,
    'Sucursal principal',
    IFNULL(a.Existencia_Fisica, 0) as system_stock,
    -- Generar diferencia aleatoria entre -10 y +10
    IFNULL(a.Existencia_Fisica, 0) + FLOOR(RAND() * 21) - 10 as counted_stock,
    IFNULL(a.Unidad, 'PZA'),
    FLOOR(RAND() * 21) - 10 as difference,
    CASE 
        WHEN IFNULL(a.Existencia_Fisica, 0) = 0 THEN 0
        ELSE ROUND((FLOOR(RAND() * 21) - 10) * 100.0 / IFNULL(a.Existencia_Fisica, 1), 2)
    END as difference_percentage,
    NOW(),
    NOW()
FROM Articulos a
WHERE a.Clave_Articulo IS NOT NULL
    AND a.Clave_Articulo NOT IN (
        SELECT item_code FROM count_details WHERE count_id = @count_id_1
    )
ORDER BY RAND()
LIMIT 500;

SELECT '✓ 500 artículos con diferencias insertados en conteo #2' as resultado;

-- ============================================
-- PASO 5: Verificar resultados
-- ============================================

SELECT '=== RESULTADOS DESPUÉS DE INSERTAR DATOS DE PRUEBA ===' as info;

-- Estadísticas generales
SELECT 
    COUNT(DISTINCT cd.item_code) as articulos_contados,
    (SELECT COUNT(*) FROM Articulos) as total_articulos,
    ROUND(COUNT(DISTINCT cd.item_code) * 100.0 / (SELECT COUNT(*) FROM Articulos), 2) as porcentaje_cobertura
FROM count_details cd;

-- Detalles por conteo
SELECT 
    c.folio,
    c.classification,
    c.status,
    COUNT(cd.id) as num_detalles,
    COUNT(DISTINCT cd.item_code) as articulos_unicos,
    SUM(CASE WHEN cd.difference != 0 THEN 1 ELSE 0 END) as articulos_con_diferencia
FROM counts c
LEFT JOIN count_details cd ON c.id = cd.count_id
WHERE c.folio LIKE 'TEST-COVERAGE-%'
GROUP BY c.folio, c.classification, c.status;

SELECT '=== SCRIPT COMPLETADO ===' as info;
SELECT 'Recarga el reporte de cobertura en la aplicación para ver los cambios' as instruccion;
