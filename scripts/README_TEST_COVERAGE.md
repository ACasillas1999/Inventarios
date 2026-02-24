# Scripts de Prueba de Cobertura

Este directorio contiene scripts SQL para generar y limpiar datos de prueba para validar las estadísticas de cobertura del sistema de inventarios.

## 📋 Archivos

### `seed_test_coverage_data.sql`
Script para generar datos de prueba de cobertura.

**¿Qué hace?**
- Crea 2 conteos de prueba con folios `TEST-COVERAGE-001` y `TEST-COVERAGE-002`
- Inserta 5,500 artículos contados (5,000 exactos + 500 con diferencias)
- Simula diferentes escenarios de conteo

**Resultado esperado:**
- Cobertura aumentará de ~0% a ~0.46% (5,500 / 1,198,126 artículos)

### `cleanup_test_coverage_data.sql`
Script para eliminar todos los datos de prueba generados.

**¿Qué hace?**
- Elimina todos los conteos con folio `TEST-COVERAGE-%`
- Elimina todos los detalles asociados
- Restaura las estadísticas al estado original

## 🚀 Cómo usar

### 1. Generar datos de prueba

**Opción A: SQL Server Management Studio (SSMS)**
```
1. Abre SSMS
2. Conéctate a tu servidor SQL Server
3. Abre el archivo: scripts/seed_test_coverage_data.sql
4. Ejecuta el script (F5)
5. Revisa los mensajes de salida
```

**Opción B: Línea de comandos**
```bash
sqlcmd -S tu_servidor -d inventarios -i seed_test_coverage_data.sql
```

**Opción C: Azure Data Studio**
```
1. Abre Azure Data Studio
2. Conecta a tu base de datos
3. Abre seed_test_coverage_data.sql
4. Ejecuta (Ctrl+Shift+E)
```

### 2. Verificar en la aplicación

1. Abre la aplicación web: `http://192.168.60.117:5173/reportes/cobertura`
2. Espera a que cargue (ahora con mensajes de progreso)
3. Verifica que:
   - **Cobertura Global** muestre ~0.46% (5,562 de 1,198,126 artículos)
   - **Cobertura por Sucursal** muestre datos
   - **Detalle de Cobertura** muestre la jerarquía expandible

### 3. Limpiar datos de prueba

Cuando termines de validar:

```sql
-- Ejecuta el script de limpieza
scripts/cleanup_test_coverage_data.sql
```

O manualmente:
```sql
DELETE FROM count_details WHERE count_id IN (SELECT id FROM counts WHERE folio LIKE 'TEST-COVERAGE-%');
DELETE FROM counts WHERE folio LIKE 'TEST-COVERAGE-%';
```

## 🔍 Validación Manual

### Verificar conteo de artículos
```sql
-- Total de artículos únicos contados
SELECT COUNT(DISTINCT item_code) as articulos_contados
FROM count_details;

-- Total de artículos en el sistema
SELECT COUNT(*) as total_articulos
FROM Articulos;

-- Porcentaje de cobertura
SELECT 
    COUNT(DISTINCT cd.item_code) * 100.0 / (SELECT COUNT(*) FROM Articulos) as porcentaje
FROM count_details cd;
```

### Verificar conteos de prueba
```sql
SELECT 
    c.folio,
    c.classification,
    c.status,
    COUNT(cd.id) as num_detalles,
    COUNT(DISTINCT cd.item_code) as articulos_unicos
FROM counts c
LEFT JOIN count_details cd ON c.id = cd.count_id
WHERE c.folio LIKE 'TEST-COVERAGE-%'
GROUP BY c.folio, c.classification, c.status;
```

## ⚠️ Advertencias

- **NO ejecutar en producción** sin revisar primero
- Los scripts usan `NEWID()` para selección aleatoria, por lo que cada ejecución será diferente
- Ajusta `@user_id` y `@branch_id` según tu configuración
- Los datos de prueba tienen el prefijo `TEST-COVERAGE-` para fácil identificación

## 📊 Números Esperados

| Métrica | Antes | Después del Script |
|---------|-------|-------------------|
| Artículos contados | 62 | 5,562 |
| Total artículos | 1,198,126 | 1,198,126 |
| Cobertura | 0.005% | 0.46% |

## 🐛 Troubleshooting

**Error: "Usuario con ID X no existe"**
- Solución: Edita el script y cambia `@user_id` al ID de un usuario válido

**Error: "Violation of PRIMARY KEY constraint"**
- Solución: Ya ejecutaste el script antes. Ejecuta primero `cleanup_test_coverage_data.sql`

**La cobertura no cambia en la app**
- Solución: Recarga la página completamente (Ctrl+F5)
- Verifica que el script se ejecutó sin errores

## 📝 Notas

- Los artículos se seleccionan aleatoriamente con `ORDER BY NEWID()`
- El primer conteo simula conteos exactos (sin diferencias)
- El segundo conteo simula diferencias aleatorias entre -10 y +10 unidades
- Los folios de prueba siempre empiezan con `TEST-COVERAGE-`
