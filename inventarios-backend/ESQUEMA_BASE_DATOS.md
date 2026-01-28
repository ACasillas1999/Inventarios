# 📊 Esquema de Base de Datos de Sucursales

## Tabla Principal: `Inventario_Maximo`

Esta es la tabla que contiene la información de inventario en las bases de datos de las sucursales.

### Columnas Identificadas

| Columna | Tipo | Descripción | Uso en el Sistema |
|---------|------|-------------|-------------------|
| `Clave_Articulo` | VARCHAR | Código único del artículo | Identificador principal (PRIMARY KEY) |
| `Almacen` | INT | ID del almacén/sucursal | Identificador de ubicación |
| `Inventario_Minimo` | DECIMAL | Stock mínimo permitido | Para alertas de reorden |
| `Inventario_Maximo` | DECIMAL | Stock máximo permitido | Para control de sobrestocking |
| `Punto_Reorden` | DECIMAL | Nivel para reordenar | Trigger para nuevas compras |
| `Rack` | VARCHAR | Ubicación física (rack/pasillo) | Para localización en almacén |
| `Existencia_Teorica` | DECIMAL | Stock teórico según sistema | Para comparación |
| **`Existencia_Fisica`** | DECIMAL | **Stock físico real** | **PRINCIPAL - Usado en conteos** |
| `Costo_Promedio` | DECIMAL | Costo promedio actual | Para valorización |
| `Costo_Promedio_Ant` | DECIMAL | Costo promedio anterior | Para comparaciones |
| `Costo_Ult_Compra` | DECIMAL | Costo de última compra | Para análisis de precios |
| `Fecha_Ult_Compra` | DATE | Fecha de última compra | Para análisis temporal |
| `Apartado` | DECIMAL | Cantidad apartada | Para disponibilidad real |
| `PendientedeEntrega` | DECIMAL | Pendiente de recibir | Para proyecciones |
| `Capacidad` | INT | Capacidad del rack/ubicación | Para gestión de espacio |

## 🔍 Consultas Implementadas

### 1. Obtener Existencia de un Artículo

```sql
SELECT Existencia_Fisica as stock
FROM Inventario_Maximo
WHERE Clave_Articulo = 'CODIGO_ARTICULO'
LIMIT 1
```

**Ejemplo:**
```sql
SELECT Existencia_Fisica as stock
FROM Inventario_Maximo
WHERE Clave_Articulo = '00001100AMWB'
LIMIT 1
```

**Resultado esperado:**
```
stock
------
0
```

### 2. Obtener Existencias de Múltiples Artículos (Batch)

```sql
SELECT Clave_Articulo as item_code, Existencia_Fisica as stock
FROM Inventario_Maximo
WHERE Clave_Articulo IN ('00001100AMWB', '00001100AMM', '00001100SAHA')
```

**Resultado esperado:**
```
item_code       | stock
----------------|------
00001100AMWB    | 0
00001100AMM     | 0
00001100SAHA    | 0
```

### 3. Obtener Información Completa de un Artículo

```sql
SELECT
  Clave_Articulo as codigo,
  Almacen as descripcion,
  Inventario_Minimo,
  Inventario_Maximo,
  Punto_Reorden,
  Rack,
  Existencia_Teorica,
  Existencia_Fisica,
  Costo_Promedio,
  Costo_Promedio_Ant,
  Costo_Ult_Compra
FROM Inventario_Maximo
WHERE Clave_Articulo = '00001100AMWB'
LIMIT 1
```

### 4. Buscar Artículos

```sql
SELECT
  Clave_Articulo as codigo,
  Almacen as descripcion,
  Existencia_Fisica as existencia,
  Rack,
  Costo_Promedio as costo
FROM Inventario_Maximo
WHERE (Clave_Articulo LIKE '%0000%' OR Almacen LIKE '%0000%')
ORDER BY Clave_Articulo
LIMIT 50 OFFSET 0
```

## 📝 Notas Importantes

### Diferencias entre Existencia Teórica y Física

- **`Existencia_Teorica`**: Lo que el sistema calcula que debería haber
- **`Existencia_Fisica`**: Lo que realmente hay físicamente

El sistema de conteos usa **`Existencia_Fisica`** como la fuente de verdad.

### Disponibilidad Real

Para calcular la disponibilidad real de un artículo:

```sql
Disponible = Existencia_Fisica - Apartado
```

Ejemplo:
```sql
SELECT
  Clave_Articulo,
  Existencia_Fisica,
  Apartado,
  (Existencia_Fisica - Apartado) as disponible
FROM Inventario_Maximo
WHERE Clave_Articulo = '00001100AMWB'
```

### Stock Pendiente (Proyección)

Para saber cuánto stock habrá una vez lleguen los pedidos:

```sql
Stock_Proyectado = Existencia_Fisica + PendientedeEntrega
```

## 🔐 Permisos Requeridos

El usuario de base de datos configurado en el backend **SOLO necesita permisos de lectura (SELECT)**:

```sql
-- Crear usuario de solo lectura
CREATE USER 'readonly'@'%' IDENTIFIED BY 'password_seguro';

-- Otorgar permisos SOLO de SELECT
GRANT SELECT ON nombre_base_datos.Inventario_Maximo TO 'readonly'@'%';

-- Aplicar cambios
FLUSH PRIVILEGES;
```

## 📊 Ejemplos de Datos

Basado en los datos visibles en la captura:

| Clave_Articulo | Almacen | Existencia_Fisica | Rack | Costo_Promedio |
|----------------|---------|-------------------|------|----------------|
| 00001100AMWB   | 1       | 0                 | 2    | 704.62         |
| 00001100AMM    | 1       | 0                 | 2    | 821.99         |
| 00001100SAHA   | 1       | 0                 | 2    | 263.02         |
| 00001100SARA   | 1       | 0                 | 2    | 205.68         |
| 00001100SAWB   | 1       | 0                 | 2    | 382.28         |

## ⚠️ Consideraciones

1. **Columna `Almacen` como ID**: La columna `Almacen` parece ser un ID numérico (1, 2, 3...) que identifica el almacén o sucursal. No es el nombre descriptivo.

2. **Valores en 0**: Muchos artículos tienen `Existencia_Fisica = 0`, lo cual es normal para artículos sin stock.

3. **Fechas antiguas**: Las fechas `Fecha_Ult_Compra` muestran `1901-01-01`, lo que probablemente significa "sin fecha" o valor por defecto.

4. **Índices recomendados**: Para mejorar el rendimiento, asegúrate de tener índices en:
   ```sql
   CREATE INDEX idx_clave_articulo ON Inventario_Maximo(Clave_Articulo);
   CREATE INDEX idx_almacen ON Inventario_Maximo(Almacen);
   CREATE INDEX idx_existencia ON Inventario_Maximo(Existencia_Fisica);
   ```

## 🚀 Testing

Para probar que el backend puede acceder correctamente:

```bash
# 1. Edita test-branch-connection.js con estos valores:
const TABLE_NAME = 'Inventario_Maximo'
const TEST_ITEM_CODE = '00001100AMWB'

# 2. Ejecuta el script
node test-branch-connection.js
```

Deberías ver:
- ✅ Conexión exitosa
- ✅ Tabla `Inventario_Maximo` encontrada
- ✅ Columnas listadas
- ✅ Artículo encontrado

## 📡 Endpoints de la API

Una vez configurado, puedes consultar:

```bash
# Obtener stock de un artículo en sucursal 1
curl http://localhost:3000/api/stock/1/00001100AMWB \
  -H "Authorization: Bearer tu-token"

# Respuesta:
# {
#   "branch_id": 1,
#   "item_code": "00001100AMWB",
#   "stock": 0
# }

# Buscar artículos que contengan "0000"
curl "http://localhost:3000/api/stock/1/items?search=0000&limit=10" \
  -H "Authorization: Bearer tu-token"
```

## ✅ Verificación

Para verificar que todo está funcionando correctamente:

1. **Iniciar el backend:**
   ```bash
   npm run dev
   ```

2. **Verificar health check:**
   ```bash
   curl http://localhost:3000/health
   ```

   Deberías ver:
   ```json
   {
     "status": "ok",
     "database": {
       "local": "connected",
       "branches": {
         "connected": N,
         "total": N
       }
     }
   }
   ```

3. **Login:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@inventarios.com","password":"admin123"}'
   ```

4. **Consultar stock:**
   ```bash
   curl http://localhost:3000/api/stock/1/00001100AMWB \
     -H "Authorization: Bearer TOKEN_DEL_PASO_3"
   ```

Si todos estos pasos funcionan, ¡el backend está completamente operativo! 🎉
