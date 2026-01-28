# 🏗️ Arquitectura del Sistema - Inventarios Backend

## 📊 Diagrama de Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENTE (Vue.js Frontend)                    │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐              │
│  │  Dashboard │  │   Conteos  │  │  Reportes  │  ...         │
│  └────────────┘  └────────────┘  └────────────┘              │
└──────────────────┬─────────────┬────────────────────────────────┘
                   │             │
            HTTP/REST API    WebSocket (Socket.IO)
                   │             │
┌──────────────────┴─────────────┴────────────────────────────────┐
│              BACKEND (Node.js + Express)                        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ API Layer                                                 │ │
│  │  • authController    • stockController                    │ │
│  │  • countsController  • branchesController                 │ │
│  │  • JWT Middleware    • Error Handler                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              │                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Service Layer                                             │ │
│  │  • CountsService   - Lógica de negocio de conteos        │ │
│  │  • StockService    - Consultas de existencias            │ │
│  │  • CacheService    - Gestión de caché                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              │                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Connection Layer                                          │ │
│  │  • ConnectionManager - Gestiona pools de conexiones      │ │
│  │  • Health Monitor    - Monitorea estado de sucursales    │ │
│  │  • Retry Logic       - Reconexión automática             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              │                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ WebSocket Server                                          │ │
│  │  • Eventos en tiempo real                                │ │
│  │  • Salas por sucursal/conteo                             │ │
│  │  • Autenticación JWT                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
└──────────────────────┬────────────────────┬────────────────────┘
                       │                    │
                 Escritura              Lectura
                       │                    │
              ┌────────┴────────┐  ┌────────┴────────────────────┐
              │                 │  │                             │
        ┌─────┴─────┐      ┌────┴──┴─────┐   ┌─────────────┐   │
        │  MySQL    │      │ node-cache  │   │   Redis     │   │
        │  (Local)  │      │ (Memoria)   │   │ (Opcional)  │   │
        │           │      │             │   │             │   │
        │ • users   │      │ • stock     │   │ • sessions  │   │
        │ • counts  │      │ • items     │   │ • pub/sub   │   │
        │ • details │      │ • TTL auto  │   │             │   │
        │ • roles   │      └─────────────┘   └─────────────┘   │
        └───────────┘                                           │
                                                                │
              ┌──────────────┐  ┌──────────────┐              │
              │  Sucursal 1  │  │  Sucursal 6  │              │
              │  (MySQL)     │  │  (MySQL)     │              │
              │ readonly     │  │ readonly     │              │
              └──────────────┘  └──────────────┘              │
              ┌──────────────┐  ┌──────────────┐              │
              │  Sucursal 2  │  │  Sucursal 7  │              │
              └──────────────┘  └──────────────┘              │
              ┌──────────────┐  ┌──────────────┐              │
              │  Sucursal 3  │  │  Sucursal 8  │              │
              └──────────────┘  └──────────────┘              │
              ┌──────────────┐  ┌──────────────┐              │
              │  Sucursal 4  │  │  Sucursal 9  │              │
              └──────────────┘  └──────────────┘              │
              ┌──────────────┐  ┌──────────────┐              │
              │  Sucursal 5  │  │  Sucursal 10 │              │
              └──────────────┘  └──────────────┘              │
                                                                │
              └─────────────────────────────────────────────────┘
                        SOLO LECTURA (Read-Only)
```

## 🔄 Flujo de Datos

### 1. Consulta de Existencia (Lectura)

```
Cliente                                Backend                           Sucursal
   │                                      │                                 │
   │──── GET /api/stock/1/ABC123 ────────>│                                 │
   │     + JWT Token                      │                                 │
   │                                      │                                 │
   │                                      │─── Verificar JWT ───>           │
   │                                      │                                 │
   │                                      │─── Buscar en Caché ───>         │
   │                                      │      CacheService               │
   │                                      │                                 │
   │                            ┌─ SI ────│<─── ¿Encontrado? ──┘           │
   │                            │         │                                 │
   │                            │         │                                 │
   │<── { stock: 100 } ─────────┘         │                                 │
   │                                      │                                 │
   │                            ┌─ NO ────│                                 │
   │                            │         │                                 │
   │                            │         │── Query SQL ──────────────────>│
   │                            │         │   SELECT existencia             │
   │                            │         │   WHERE codigo = 'ABC123'       │
   │                            │         │                                 │
   │                            │         │<──── { stock: 100 } ───────────│
   │                            │         │                                 │
   │                            │         │─── Guardar en Caché ──>         │
   │                            │         │      TTL: 5 min                 │
   │                            │         │                                 │
   │<── { stock: 100 } ─────────┴─────────│                                 │
   │                                      │                                 │
```

### 2. Crear Conteo (Escritura)

```
Cliente                         Backend                    Base Local
   │                               │                            │
   │── POST /api/counts ──────────>│                            │
   │   + JWT Token                 │                            │
   │   + data: {                   │                            │
   │       branch_id: 1,           │                            │
   │       type: 'ciclico'         │                            │
   │     }                         │                            │
   │                               │                            │
   │                               │─── Verificar JWT ──>       │
   │                               │                            │
   │                               │─── Generar Folio ──>       │
   │                               │                            │
   │                               │─── INSERT INTO counts ────>│
   │                               │                            │
   │                               │<─── { id: 1, folio } ──────│
   │                               │                            │
   │                               │─── Emitir WebSocket ──>    │
   │                               │    'count_created'         │
   │                               │                            │
   │<─── { count: {...} } ─────────│                            │
   │                               │                            │
```

### 3. Comparar Stock (Lectura Multi-Sucursal)

```
Cliente                    Backend                     Sucursales
   │                          │                             │
   │── POST /api/stock/       │                             │
   │   compare                │                             │
   │   items: [ABC, DEF]      │                             │
   │                          │                             │
   │                          │─┬─> Query SUC1 ────────────>│
   │                          │ │                           │
   │                          │ ├─> Query SUC1 ────────────>│
   │                          │ │                           │
   │                          │ └─> Query SUC1 ────────────>│
   │                          │                             │
   │                          │  Consultas en PARALELO      │
   │                          │                             │
   │                          │<─┬─ Results ────────────────│
   │                          │  │                          │
   │                          │<─┼─ Results ────────────────│
   │                          │  │                          │
   │                          │<─┴─ Results ────────────────│
   │                          │                             │
   │                          │─── Calcular diferencias ──> │
   │                          │                             │
   │<─ { comparisons: [...] }─│                             │
   │                          │                             │
```

## 🗄️ Modelo de Datos (Base Local)

```
┌─────────────┐         ┌─────────────┐
│    users    │────┬───>│    roles    │
│             │    │    │             │
│ • id        │    │    │ • id        │
│ • email     │    │    │ • name      │
│ • password  │    │    │ • permissions│
│ • role_id   │────┘    └─────────────┘
│ • status    │
└──────┬──────┘
       │ 1:N
       │
       ├─────────────────────┐
       │                     │
       ▼                     ▼
┌─────────────┐       ┌─────────────┐
│user_branches│       │   counts    │
│             │       │             │
│ • user_id   │       │ • id        │
│ • branch_id │       │ • folio     │
└──────┬──────┘       │ • branch_id │
       │              │ • type      │
       │              │ • status    │
       │              │ • responsible_user_id
       │              └──────┬──────┘
       │                     │ 1:N
       │                     │
       ▼                     ▼
┌─────────────┐       ┌──────────────┐
│  branches   │       │count_details │
│             │       │              │
│ • id        │       │ • id         │
│ • code      │       │ • count_id   │
│ • name      │       │ • item_code  │
│ • db_host   │       │ • system_stock│
│ • db_user   │       │ • counted_stock│
│ • status    │       │ • difference │
└─────────────┘       └──────┬───────┘
                             │ 1:N
                             │
                             ▼
                      ┌──────────────┐
                      │  requests    │
                      │              │
                      │ • id         │
                      │ • folio      │
                      │ • count_detail_id│
                      │ • status     │
                      └──────────────┘
```

## ⚡ Sistema de Pool de Conexiones

```
ConnectionManager
├── Branch 1 Pool
│   ├── Connection 1 [IDLE]
│   ├── Connection 2 [ACTIVE]
│   ├── Connection 3 [IDLE]
│   ├── Connection 4 [ACTIVE]
│   └── Connection 5 [IDLE]
│
├── Branch 2 Pool
│   ├── Connection 1 [ACTIVE]
│   ├── Connection 2 [IDLE]
│   ├── Connection 3 [ACTIVE]
│   ├── Connection 4 [IDLE]
│   └── Connection 5 [IDLE]
│
└── Branch N Pool
    └── ...

Health Monitor (cada 30 segundos)
├── Ping Branch 1 ──> ✅ OK
├── Ping Branch 2 ──> ✅ OK
├── Ping Branch 3 ──> ❌ ERROR
│   └── Retry en 30s
└── Ping Branch N ──> ✅ OK
```

## 🚀 Optimizaciones de Performance

### 1. Caché en Memoria

```
Cache Layer (node-cache)
├── stock:1:ABC123 ────> 100 (TTL: 5 min)
├── stock:1:DEF456 ────> 50  (TTL: 5 min)
├── stock:2:ABC123 ────> 95  (TTL: 5 min)
├── item:ABC123    ────> {   (TTL: 1 hora)
│                         codigo: "ABC123",
│                         descripcion: "...",
│                         ...
│                       }
└── branch_items:1 ────> [...] (TTL: 1 hora)
```

### 2. Consultas Paralelas

```javascript
// En lugar de consultar sucursales secuencialmente:
for (const branch of branches) {
  const stock = await getStock(branch.id, itemCode)  // ❌ LENTO
}

// Se consultan en paralelo:
const promises = branches.map(branch =>
  getStock(branch.id, itemCode)
)
const results = await Promise.all(promises)  // ✅ RÁPIDO
```

### 3. Pool de Conexiones Siempre Abierto

```
Conexión tradicional (lenta):
Request ──> Abrir conexión ──> Query ──> Cerrar ──> Response
           (500ms)             (50ms)    (100ms)

Pool de conexiones (rápido):
Request ──> Tomar del pool ──> Query ──> Regresar al pool ──> Response
           (5ms)               (50ms)    (5ms)
```

## 🔌 WebSocket - Eventos en Tiempo Real

```
WebSocket Server
├── Salas Globales
│   ├── user:1       (Usuario específico)
│   ├── user:2
│   ├── role:1       (Todos los admins)
│   └── role:2       (Todos los inventarios)
│
├── Salas de Conteos
│   ├── count:1      (Usuarios trabajando en conteo 1)
│   ├── count:2
│   └── count:N
│
└── Salas de Sucursales
    ├── branch:1     (Usuarios viendo sucursal 1)
    ├── branch:2
    └── branch:N

Eventos:
• stock_updated      ──> Emitir a sala branch:X
• count_progress     ──> Emitir a sala count:X
• request_status     ──> Emitir globalmente
• count_created      ──> Emitir a role:admin y role:inventarios
```

## 📦 Estructura de Archivos

```
inventarios-backend/
├── src/
│   ├── app.ts                    # Entry point
│   ├── config/
│   │   └── database.ts           # Configuraciones de BD
│   ├── connections/
│   │   └── ConnectionManager.ts  # Gestor de pools
│   ├── controllers/              # Lógica de endpoints
│   ├── middlewares/              # Auth, errores, etc.
│   ├── routes/                   # Definición de rutas
│   ├── services/                 # Lógica de negocio
│   ├── types/                    # TypeScript types
│   ├── utils/                    # Utilidades (logger, cache)
│   └── websocket/                # WebSocket server
├── database/
│   └── schema.sql                # Schema de BD local
└── logs/                         # Logs de aplicación
```

## 🔐 Flujo de Autenticación

```
1. Login
   │
   ├──> POST /api/auth/login
   │    { email, password }
   │
   ├──> Verificar credenciales en BD local
   │
   ├──> Generar JWT token
   │    Payload: { id, email, role_id }
   │    Secret: JWT_SECRET del .env
   │    Expira: 24 horas
   │
   └──> Retornar { token, user }

2. Request Autenticado
   │
   ├──> GET /api/stock/1/ABC123
   │    Header: Authorization: Bearer <token>
   │
   ├──> authMiddleware verifica token
   │    • Decodifica JWT
   │    • Verifica firma
   │    • Verifica expiración
   │
   ├──> Agrega req.user al request
   │
   └──> Continúa al controller
```

## 📈 Escalabilidad

El sistema está diseñado para escalar:

1. **Horizontal**: Agregar más instancias del backend con load balancer
2. **Vertical**: Aumentar recursos del servidor
3. **Caché**: Opcional Redis para compartir caché entre instancias
4. **Base de datos**: Replicación master-slave para lectura distribuida

## 🎯 Buenas Prácticas Implementadas

✅ Separation of Concerns (Controllers, Services, Models)
✅ Error Handling centralizado
✅ Logging estructurado (Winston)
✅ Validación de datos
✅ Autenticación JWT
✅ Conexiones pooling
✅ Caché inteligente
✅ Health monitoring
✅ Graceful shutdown
✅ TypeScript para type safety
✅ Environment variables
✅ CORS configurado
✅ Helmet para seguridad
✅ Compression para respuestas
