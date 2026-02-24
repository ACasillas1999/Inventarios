-- ============================================
-- Script para LIMPIAR datos de prueba de cobertura (MySQL/MariaDB)
-- ============================================

-- Verificar qué se va a eliminar
SELECT 
    'REGISTROS A ELIMINAR' as info,
    (SELECT COUNT(*) FROM count_details WHERE count_id IN (SELECT id FROM counts WHERE folio LIKE 'TEST-COVERAGE-%')) as count_details_a_eliminar,
    (SELECT COUNT(*) FROM counts WHERE folio LIKE 'TEST-COVERAGE-%') as counts_a_eliminar;

-- Eliminar detalles de conteo
DELETE FROM count_details 
WHERE count_id IN (SELECT id FROM counts WHERE folio LIKE 'TEST-COVERAGE-%');

SELECT '✓ Detalles de conteo eliminados' as resultado;

-- Eliminar conteos
DELETE FROM counts 
WHERE folio LIKE 'TEST-COVERAGE-%';

SELECT '✓ Conteos de prueba eliminados' as resultado;

-- Verificar estado final
SELECT 
    '=== VERIFICACIÓN DESPUÉS DE LIMPIEZA ===' as info,
    COUNT(DISTINCT cd.item_code) as articulos_contados,
    (SELECT COUNT(*) FROM Articulos) as total_articulos,
    ROUND(COUNT(DISTINCT cd.item_code) * 100.0 / (SELECT COUNT(*) FROM Articulos), 2) as porcentaje_cobertura
FROM count_details cd;

SELECT '=== LIMPIEZA COMPLETADA ===' as info;
