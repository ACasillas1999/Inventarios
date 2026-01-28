# Inventarios Backend

Backend API para sistema de gestión de inventarios con conexión a múltiples bases de datos de sucursales en tiempo real.

## 🚀 Características

- **Múltiples Bases de Datos**: Conexión simultánea a 10+ bases de datos de sucursales
- **Pool de Conexiones**: Sistema de pooling optimizado para cada sucursal
- **Caché Inteligente**: Sistema de caché en memoria para optimizar consultas repetidas
- **Tiempo Real**: WebSocket server para actualizaciones en tiempo real
- **Lectura Rápida**: Consultas paralelas a múltiples sucursales
- **Solo Lectura en Sucursales**: Las bases de datos de sucursales son read-only
- **Escritura Local**: Todas las operaciones de escritura se realizan en la BD local
- **Health Monitoring**: Monitoreo continuo del estado de conexiones

## 📋 Stack Tecnológico

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Lenguaje**: TypeScript
- **Base de Datos Local**: MySQL (escritura)
- **Bases de Datos Sucursales**: MySQL (solo lectura)
- **Caché**: node-cache (en memoria)
- **WebSockets**: Socket.IO
- **Autenticación**: JWT
- **Logging**: Winston

## 🛠️ Instalación

### 1. Clonar el repositorio

```bash
cd inventarios-backend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus configuraciones:

```env
# Server
PORT=3000
NODE_ENV=development

# Base de datos local (escritura)
DB_LOCAL_HOST=localhost
DB_LOCAL_PORT=3306
DB_LOCAL_USER=root
DB_LOCAL_PASSWORD=
DB_LOCAL_DATABASE=inventarios

# JWT
JWT_SECRET=tu-clave-secreta-super-segura
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=http://localhost:5173

# Bases de datos de sucursales (JSON array)
BRANCH_DATABASES='[
  {
    "id": 1,
    "code": "SUC001",
    "name": "Sucursal Centro",
    "host": "192.168.1.10",
    "port": 3306,
    "user": "readonly",
    "password": "readonly123",
    "database": "tienda_centro",
    "poolMax": 5
  }
]'
```

### 4. Inicializar la base de datos

```bash
# Primero compila el TypeScript
npm run build

# Luego ejecuta el script de inicialización
npm run db:init
```

Esto creará:
- Base de datos `inventarios`
- Todas las tablas necesarias
- Roles por defecto
- Usuario admin (email: admin@inventarios.com, password: admin123)

### 5. Iniciar el servidor

**Modo desarrollo (con hot reload):**
```bash
npm run dev
```

**Modo producción:**
```bash
npm run build
npm start
```

## 📚 API Endpoints

### Autenticación

```
POST   /api/auth/login              # Login de usuario
GET    /api/auth/profile            # Obtener perfil (requiere token)
POST   /api/auth/change-password    # Cambiar contraseña
```

### Stock (Existencias)

```
GET    /api/stock/:branchId/:itemCode           # Existencia de un artículo
POST   /api/stock/:branchId/batch               # Existencias múltiples artículos
GET    /api/stock/all/:itemCode                 # Existencia en todas las sucursales
POST   /api/stock/compare                       # Comparar stock vs conteo
GET    /api/stock/:branchId/item/:itemCode      # Info completa de artículo
GET    /api/stock/:branchId/items               # Buscar artículos (con filtros)
DELETE /api/stock/cache/:branchId/:itemCode?    # Invalidar caché
```

### Conteos

```
GET    /api/counts/stats/dashboard     # Estadísticas del dashboard
POST   /api/counts                     # Crear conteo
GET    /api/counts                     # Listar conteos (con filtros)
GET    /api/counts/:id                 # Obtener conteo por ID
GET    /api/counts/folio/:folio        # Obtener conteo por folio
PUT    /api/counts/:id                 # Actualizar conteo
DELETE /api/counts/:id                 # Eliminar conteo
GET    /api/counts/:id/details         # Obtener detalles de conteo
POST   /api/counts/:id/details         # Agregar detalle a conteo
PUT    /api/counts/details/:id         # Actualizar detalle
```

### Sucursales

```
GET    /api/branches              # Listar sucursales con estado
GET    /api/branches/:id/health   # Verificar salud de sucursal
GET    /api/branches/health/all   # Verificar salud de todas
```

### Health Check

```
GET    /health                    # Estado del servidor
```

## 🔌 WebSocket Events

### Conectar al WebSocket

```javascript
import io from 'socket.io-client'

const socket = io('http://localhost:3000', {
  path: '/ws',
  auth: {
    token: 'tu-jwt-token'
  }
})
```

### Eventos del Cliente → Servidor

```javascript
socket.emit('join_count', countId)        // Unirse a sala de conteo
socket.emit('leave_count', countId)       // Salir de sala de conteo
socket.emit('join_branch', branchId)      // Unirse a sala de sucursal
socket.emit('leave_branch', branchId)     // Salir de sala de sucursal
```

### Eventos del Servidor → Cliente

```javascript
// Actualización de stock
socket.on('stock_updated', (data) => {
  console.log(data)
  // {
  //   type: 'stock_updated',
  //   data: {
  //     branch_id: 1,
  //     item_code: 'ABC123',
  //     old_stock: 100,
  //     new_stock: 95
  //   },
  //   timestamp: '2025-01-01T12:00:00.000Z'
  // }
})

// Progreso de conteo
socket.on('count_progress', (data) => {
  console.log(data)
  // {
  //   type: 'count_progress',
  //   data: {
  //     count_id: 1,
  //     folio: 'CNT-202501-0001',
  //     total_items: 100,
  //     counted_items: 50,
  //     percentage: 50.00
  //   },
  //   timestamp: '2025-01-01T12:00:00.000Z'
  // }
})

// Cambio de estado de solicitud
socket.on('request_status', (data) => {
  console.log(data)
  // {
  //   type: 'request_status',
  //   data: {
  //     request_id: 1,
  //     folio: 'SOL-202501-0001',
  //     old_status: 'pendiente',
  //     new_status: 'aprobado'
  //   },
  //   timestamp: '2025-01-01T12:00:00.000Z'
  // }
})
```

## 🔧 Configuración de Sucursales

Las conexiones a bases de datos de sucursales se configuran en el archivo `.env` como un JSON array:

```json
{
  "id": 1,                           // ID único
  "code": "SUC001",                  // Código de la sucursal
  "name": "Sucursal Centro",         // Nombre descriptivo
  "host": "192.168.1.10",            // Host de la BD
  "port": 3306,                      // Puerto MySQL
  "user": "readonly",                // Usuario (solo lectura)
  "password": "readonly123",         // Contraseña
  "database": "tienda_centro",       // Nombre de la BD
  "poolMin": 2,                      // Conexiones mínimas en pool (opcional)
  "poolMax": 5                       // Conexiones máximas en pool (opcional)
}
```

### ⚠️ IMPORTANTE: Esquema de Bases de Datos de Sucursales

El backend asume que las bases de datos de sucursales tienen una tabla `articulos` con la siguiente estructura:

```sql
CREATE TABLE articulos (
  codigo VARCHAR(50) PRIMARY KEY,
  descripcion VARCHAR(500),
  linea VARCHAR(50),
  unidad VARCHAR(20),
  existencia DECIMAL(10,2),
  costo DECIMAL(10,2),
  precio DECIMAL(10,2),
  estatus VARCHAR(20)
);
```

**Si tu esquema es diferente**, debes modificar las consultas en:
- `src/services/StockService.ts`

## 🎯 Sistema de Caché

El sistema utiliza caché en memoria para optimizar las consultas a las bases de datos de sucursales:

### TTL (Time To Live)

- **Existencias**: 5 minutos (300 segundos)
- **Artículos**: 1 hora (3600 segundos)
- **Configuración**: 30 minutos (1800 segundos)

### Invalidación de Caché

El caché se invalida automáticamente al expirar el TTL, pero también puedes invalidarlo manualmente:

```bash
# Invalidar un artículo específico
DELETE /api/stock/cache/1/ABC123

# Invalidar toda una sucursal
DELETE /api/stock/cache/1
```

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

Respuesta:
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "uptime": 3600,
  "environment": "development",
  "database": {
    "local": "connected",
    "branches": {
      "connected": 8,
      "total": 10
    }
  }
}
```

### Logs

Los logs se guardan en el directorio `logs/`:

- `logs/combined.log` - Todos los logs
- `logs/error.log` - Solo errores

## 🔒 Autenticación

El sistema utiliza JWT (JSON Web Tokens) para autenticación.

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@inventarios.com",
    "password": "admin123"
  }'
```

Respuesta:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@inventarios.com",
    "name": "Administrador",
    "role_id": 1,
    "role_name": "admin"
  }
}
```

### Usar el Token

Incluye el token en el header `Authorization`:

```bash
curl -X GET http://localhost:3000/api/counts \
  -H "Authorization: Bearer tu-token-aqui"
```

## 🚀 Despliegue en Producción

### 1. Compilar

```bash
npm run build
```

### 2. Configurar variables de entorno

```bash
NODE_ENV=production
JWT_SECRET=clave-super-segura-aleatoria-larga
```

### 3. Iniciar con PM2

```bash
npm install -g pm2
pm2 start dist/app.js --name inventarios-backend
pm2 save
pm2 startup
```

## 📝 Scripts Disponibles

```bash
npm run dev          # Desarrollo con hot reload
npm run build        # Compilar TypeScript
npm start            # Iniciar en producción
npm run lint         # Linter
npm run format       # Formatear código
npm run db:init      # Inicializar base de datos
```

## 🤝 Roles y Permisos

El sistema incluye 4 roles por defecto:

1. **Admin** - Acceso total
2. **Inventarios** - Crear y gestionar conteos
3. **Auditor** - Solo lectura y reportes
4. **Sucursal** - Gestionar solicitudes de su sucursal

## 📄 Licencia

MIT

## 👨‍💻 Desarrollo

Desarrollado con ❤️ para sistema de inventarios multi-sucursal
