# Configuración de Bases de Datos de Sucursales

## 📋 Información Importante

Este backend está diseñado para conectarse a **múltiples bases de datos de sucursales** de forma simultánea y consultar las existencias de artículos en tiempo real.

## ⚠️ PASO CRÍTICO: Adaptar Consultas SQL

El código actual asume que tus bases de datos de sucursales tienen una tabla llamada `articulos` con ciertas columnas. **DEBES ADAPTAR LAS CONSULTAS** según tu esquema real.

### Archivo a Modificar

📁 **`src/services/StockService.ts`**

### Consultas a Personalizar

#### 1. Consulta de Existencia Simple

```typescript
// LÍNEA ~44 en StockService.ts
const query = `
  SELECT existencia as stock
  FROM articulos
  WHERE codigo = ?
  LIMIT 1
`
```

**Cambia según tu esquema:**
- `articulos` → nombre de tu tabla
- `existencia` → nombre de tu columna de stock/existencia
- `codigo` → nombre de tu columna de código de artículo

#### 2. Consulta de Existencias Múltiples (Batch)

```typescript
// LÍNEA ~82 en StockService.ts
const query = `
  SELECT codigo as item_code, existencia as stock
  FROM articulos
  WHERE codigo IN (${placeholders})
`
```

#### 3. Consulta de Información Completa del Artículo

```typescript
// LÍNEA ~145 en StockService.ts
const query = `
  SELECT
    codigo,
    descripcion,
    linea,
    unidad,
    existencia,
    costo,
    precio,
    estatus
  FROM articulos
  WHERE codigo = ?
  LIMIT 1
`
```

**Personaliza según las columnas que tengas disponibles.**

#### 4. Búsqueda de Artículos

```typescript
// LÍNEA ~202 en StockService.ts
let query = `
  SELECT
    codigo,
    descripcion,
    linea,
    unidad,
    existencia,
    estatus
  FROM articulos
  WHERE 1=1
`
```

## 📝 Ejemplos de Adaptación

### Ejemplo 1: Esquema Simple

Si tu tabla se llama `productos` y solo tiene `cod_producto` y `stock`:

```typescript
const query = `
  SELECT stock
  FROM productos
  WHERE cod_producto = ?
  LIMIT 1
`
```

### Ejemplo 2: Esquema con Almacén

Si manejas múltiples almacenes:

```typescript
const query = `
  SELECT SUM(cantidad) as stock
  FROM existencias
  WHERE codigo_articulo = ?
  AND almacen_id = ?
  GROUP BY codigo_articulo
`
```

### Ejemplo 3: Esquema con Vista

Si ya tienes una vista consolidada:

```typescript
const query = `
  SELECT existencia_total as stock
  FROM vw_existencias_actuales
  WHERE sku = ?
  LIMIT 1
`
```

## 🔍 Cómo Identificar tu Esquema

### Paso 1: Conectar a una Base de Datos de Sucursal

```sql
USE tu_base_datos_sucursal;
```

### Paso 2: Ver las Tablas

```sql
SHOW TABLES;
```

### Paso 3: Ver la Estructura de la Tabla de Artículos

```sql
DESCRIBE nombre_de_tu_tabla_articulos;
-- o
SHOW CREATE TABLE nombre_de_tu_tabla_articulos;
```

### Paso 4: Consulta de Prueba

```sql
SELECT * FROM nombre_de_tu_tabla_articulos LIMIT 5;
```

## 📊 Esquema Esperado (Referencia)

El sistema funciona mejor si tu base de datos tiene:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `codigo` | VARCHAR | Código único del artículo |
| `descripcion` | VARCHAR | Descripción del artículo |
| `existencia` | DECIMAL | Stock/existencia actual |
| `linea` | VARCHAR | Línea o categoría (opcional) |
| `unidad` | VARCHAR | Unidad de medida (opcional) |
| `costo` | DECIMAL | Costo (opcional) |
| `precio` | DECIMAL | Precio (opcional) |
| `estatus` | VARCHAR | Estado del artículo (opcional) |

## 🔧 Modificación Paso a Paso

### 1. Abre el archivo

```bash
code src/services/StockService.ts
```

### 2. Busca la línea ~44 (método `queryStockFromDatabase`)

### 3. Reemplaza la consulta

**ANTES:**
```typescript
const query = `
  SELECT existencia as stock
  FROM articulos
  WHERE codigo = ?
  LIMIT 1
`
```

**DESPUÉS (ejemplo):**
```typescript
const query = `
  SELECT cantidad as stock
  FROM tbl_productos
  WHERE sku = ?
  LIMIT 1
`
```

### 4. Repite para todas las consultas en el archivo

### 5. Prueba con un artículo real

```bash
npm run dev

# En otra terminal
curl http://localhost:3000/api/stock/1/CODIGO-REAL-ARTICULO \
  -H "Authorization: Bearer tu-token"
```

## 🚨 Errores Comunes

### Error: "Table 'articulos' doesn't exist"

**Solución:** Cambia `articulos` por el nombre real de tu tabla.

### Error: "Unknown column 'existencia'"

**Solución:** Cambia `existencia` por el nombre real de tu columna de stock.

### Error: "Unknown column 'codigo'"

**Solución:** Cambia `codigo` por el nombre real de tu columna de código/SKU.

## 📞 Testing de Conexión

### Script de Prueba Rápida

Crea un archivo `test-connection.ts`:

```typescript
import mysql from 'mysql2/promise'

const testConnection = async () => {
  const connection = await mysql.createConnection({
    host: '192.168.1.10',
    port: 3306,
    user: 'readonly',
    password: 'readonly123',
    database: 'tienda_centro'
  })

  // Prueba 1: Listar tablas
  const [tables] = await connection.query('SHOW TABLES')
  console.log('Tablas:', tables)

  // Prueba 2: Describir tabla de artículos
  const [columns] = await connection.query('DESCRIBE nombre_tu_tabla')
  console.log('Columnas:', columns)

  // Prueba 3: Consulta de prueba
  const [rows] = await connection.query('SELECT * FROM nombre_tu_tabla LIMIT 1')
  console.log('Datos:', rows)

  await connection.end()
}

testConnection()
```

## ✅ Checklist Final

- [ ] Identificar el nombre de la tabla de artículos
- [ ] Identificar el nombre de la columna de código/SKU
- [ ] Identificar el nombre de la columna de existencia/stock
- [ ] Modificar consultas en `StockService.ts`
- [ ] Probar conexión a una sucursal
- [ ] Probar consulta de existencia de un artículo
- [ ] Configurar todas las sucursales en `.env`
- [ ] Verificar que el caché funciona correctamente

## 💡 Recomendaciones

1. **Empieza con una sucursal**: Configura y prueba con una sola sucursal primero
2. **Usuario de solo lectura**: Crea un usuario MySQL con permisos SOLO de SELECT
3. **Índices**: Asegúrate de que la columna de código tenga un índice para consultas rápidas
4. **Pool pequeño**: Para pruebas, usa `poolMax: 2` y luego aumenta según necesidad

## 🎯 Siguiente Paso

Una vez que hayas adaptado las consultas:

```bash
# 1. Instalar dependencias
npm install

# 2. Inicializar base de datos local
npm run build
npm run db:init

# 3. Iniciar servidor
npm run dev

# 4. Probar health check
curl http://localhost:3000/health
```
