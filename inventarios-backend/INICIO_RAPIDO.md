# 🚀 Inicio Rápido - Inventarios Backend

Guía paso a paso para poner en marcha el backend en menos de 10 minutos.

## ✅ Pre-requisitos

- [x] Node.js 20+ instalado
- [x] MySQL 8+ instalado y corriendo
- [x] Acceso a las bases de datos de las sucursales
- [x] XAMPP corriendo (si usas XAMPP para MySQL)

## 📝 Pasos de Instalación

### 1️⃣ Instalar Dependencias

```bash
cd \\192.168.60.117\xampp\htdocs\inventarios-backend
npm install
```

Esto instalará todas las dependencias necesarias (~5-10 segundos).

### 2️⃣ Probar Conexión a Sucursales (IMPORTANTE)

Antes de continuar, prueba que puedes conectarte a las bases de datos de las sucursales:

```bash
# Edita primero el archivo test-branch-connection.js con tus datos reales
node test-branch-connection.js
```

Este script te dirá:
- ✅ Si la conexión funciona
- 📋 Qué tablas existen
- 🔍 La estructura de tu tabla de artículos
- 💡 Qué consultas SQL usar en tu código

**⚠️ SI FALLA ESTE PASO**, no continúes. Revisa:
- Host/IP correcto
- Puerto correcto (usualmente 3306)
- Usuario/contraseña correctos
- Firewall no está bloqueando

### 3️⃣ Configurar Variables de Entorno

El archivo `.env` ya existe, solo necesitas editarlo:

```bash
# Abre el archivo .env en tu editor
code .env
# o
notepad .env
```

**Configuraciones críticas a cambiar:**

```env
# 1. Base de datos local (donde está XAMPP)
DB_LOCAL_HOST=localhost
DB_LOCAL_PORT=3306
DB_LOCAL_USER=root
DB_LOCAL_PASSWORD=            # Tu contraseña de MySQL
DB_LOCAL_DATABASE=inventarios

# 2. JWT Secret (cámbialo a algo aleatorio)
JWT_SECRET=tu-clave-super-secreta-aqui-cambiala

# 3. Sucursales (IMPORTANTE - ajusta con tus datos reales)
BRANCH_DATABASES='[
  {
    "id": 1,
    "code": "SUC001",
    "name": "Sucursal Centro",
    "host": "192.168.60.10",      # ← IP real de tu sucursal
    "port": 3306,
    "user": "readonly",            # ← Usuario real
    "password": "password123",     # ← Contraseña real
    "database": "tienda1",         # ← Nombre real de la BD
    "poolMax": 5
  },
  {
    "id": 2,
    "code": "SUC002",
    "name": "Sucursal Norte",
    "host": "192.168.60.11",
    "port": 3306,
    "user": "readonly",
    "password": "password123",
    "database": "tienda2",
    "poolMax": 5
  }
]'
```

**💡 Tip**: Para JSON en el .env, todo debe estar en una sola línea sin saltos.

### 4️⃣ Adaptar Consultas SQL (CRÍTICO)

Abre el archivo `src/services/StockService.ts` y ajusta las consultas según tu esquema de base de datos.

**Línea ~44** - Consulta de existencia:

```typescript
// ANTES (ejemplo genérico):
const query = `
  SELECT existencia as stock
  FROM articulos
  WHERE codigo = ?
  LIMIT 1
`

// DESPUÉS (ajusta según TU esquema):
const query = `
  SELECT tu_columna_stock as stock
  FROM tu_tabla_articulos
  WHERE tu_columna_codigo = ?
  LIMIT 1
`
```

📄 Lee el archivo `CONFIGURACION_SUCURSALES.md` para más detalles.

### 5️⃣ Compilar el Proyecto

```bash
npm run build
```

Esto compila el TypeScript a JavaScript en la carpeta `dist/`.

### 6️⃣ Inicializar Base de Datos Local

```bash
npm run db:init
```

Esto creará:
- ✅ Base de datos `inventarios`
- ✅ Todas las tablas (users, roles, counts, branches, etc.)
- ✅ Roles por defecto (Admin, Inventarios, Auditor, Sucursal)
- ✅ Usuario administrador:
  - Email: `admin@inventarios.com`
  - Password: `admin123`

### 7️⃣ Iniciar el Servidor

```bash
npm run dev
```

Deberías ver algo como:

```
[info]: Starting Inventarios Backend...
[info]: Environment: development
[info]: Port: 3000
[info]: Local database connected successfully
[info]: 3 of 3 branch databases connected
[info]: WebSocket server enabled
[info]: 🚀 Server running on http://localhost:3000
[info]: 📊 Health check: http://localhost:3000/health
[info]: 🔌 WebSocket: ws://localhost:3000/ws
```

### 8️⃣ Verificar que Funciona

Abre otra terminal y prueba:

```bash
# Health check
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@inventarios.com\",\"password\":\"admin123\"}"
```

Deberías recibir un token JWT.

### 9️⃣ Probar Consulta de Stock

```bash
# Usa el token que recibiste en el paso anterior
curl http://localhost:3000/api/stock/1/TU-CODIGO-ARTICULO \
  -H "Authorization: Bearer tu-token-aqui"
```

Donde:
- `1` = ID de la sucursal
- `TU-CODIGO-ARTICULO` = Código real de un artículo que existe

## 🎉 ¡Listo!

Si llegaste hasta aquí, tu backend está funcionando.

## 🔍 Troubleshooting Común

### Error: "Cannot connect to local database"

**Solución:**
1. Verifica que MySQL esté corriendo
2. Verifica usuario/contraseña en `.env`
3. Crea la base de datos manualmente: `CREATE DATABASE inventarios;`

### Error: "Branch database connection failed"

**Solución:**
1. Ejecuta `node test-branch-connection.js` para diagnosticar
2. Verifica IPs, puertos, usuarios en `.env`
3. Verifica firewall/permisos de red

### Error: "Table 'articulos' doesn't exist"

**Solución:**
1. Revisa `CONFIGURACION_SUCURSALES.md`
2. Ajusta las consultas en `src/services/StockService.ts`
3. Usa el nombre correcto de tu tabla

### Error: "Unknown column 'codigo'"

**Solución:**
1. Ajusta el nombre de la columna en las consultas SQL
2. Usa el nombre real de tu columna de código

### Error: "EADDRINUSE: address already in use"

**Solución:**
1. Ya hay algo corriendo en el puerto 3000
2. Cambia el puerto en `.env`: `PORT=3001`
3. O detén el otro servicio

## 📚 Siguientes Pasos

1. **Conectar el Frontend**
   - El frontend Vue.js debe apuntar a `http://localhost:3000`
   - Actualizar la variable `VITE_API_URL` en el frontend

2. **Configurar Todas las Sucursales**
   - Agrega todas las sucursales al JSON en `.env`

3. **Probar WebSocket**
   - Conecta el frontend y verifica actualizaciones en tiempo real

4. **Crear Más Usuarios**
   - Usa el endpoint `/api/users` (por implementar) o directamente en BD

5. **Configurar para Producción**
   - Lee `README.md` sección "Despliegue en Producción"

## 🆘 Ayuda

Si algo no funciona:

1. Revisa los logs en `logs/combined.log` y `logs/error.log`
2. Revisa la consola donde corre `npm run dev`
3. Ejecuta `curl http://localhost:3000/health` para ver el estado
4. Verifica que MySQL esté corriendo: `mysql -u root -p -e "SELECT 1"`

## 📞 Comandos Útiles

```bash
# Reiniciar servidor
Ctrl + C  (para detener)
npm run dev  (para iniciar)

# Ver logs en tiempo real
tail -f logs/combined.log

# Limpiar y reconstruir
rm -rf dist
npm run build

# Reinicializar base de datos (⚠️ BORRA TODOS LOS DATOS)
npm run db:init
```

## ✅ Checklist de Verificación

- [ ] Node.js instalado (verifica: `node -v`)
- [ ] MySQL corriendo (verifica: `mysql -V`)
- [ ] Dependencias instaladas (`npm install`)
- [ ] Conexión a sucursales probada (`node test-branch-connection.js`)
- [ ] Archivo `.env` configurado
- [ ] Consultas SQL adaptadas en `StockService.ts`
- [ ] Proyecto compilado (`npm run build`)
- [ ] Base de datos local inicializada (`npm run db:init`)
- [ ] Servidor corriendo (`npm run dev`)
- [ ] Health check responde (`curl http://localhost:3000/health`)
- [ ] Login funciona (probado con curl)
- [ ] Consulta de stock funciona

¡Éxito! 🎊
