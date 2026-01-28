# 🔧 Cómo Arreglar los Warnings de TypeScript

Los errores que ves son principalmente **warnings de variables no usadas**. No impiden que el código funcione, pero es buena práctica arreglarlos.

## Opción 1: Ignorar los warnings (RÁPIDO)

Modifica el `tsconfig.json` para que no falle en warnings:

```json
{
  "compilerOptions": {
    // ... otras opciones
    "noUnusedLocals": false,        // ← Cambia de true a false
    "noUnusedParameters": false     // ← Cambia de true a false
  }
}
```

Luego corre:
```bash
npm run build
```

## Opción 2: Arreglar manualmente (CORRECTO)

Abre cada archivo y prefija con `_` las variables no usadas:

### src/app.ts línea 21
```typescript
// ANTES:
import BranchesService from './services/BranchesService'

// DESPUÉS (comentar si no se usa todavía):
// import BranchesService from './services/BranchesService'
```

### src/app.ts línea 52
```typescript
// ANTES:
app.use((req: Request, res: Response, next) => {

// DESPUÉS:
app.use((req: Request, _res: Response, next) => {
```

### src/app.ts línea 59
```typescript
// ANTES:
app.get('/health', (req: Request, res: Response) => {

// DESPUÉS:
app.get('/health', (_req: Request, res: Response) => {
```

### src/app.ts línea 86
```typescript
// ANTES:
app.get('/', (req: Request, res: Response) => {

// DESPUÉS:
app.get('/', (_req: Request, res: Response) => {
```

### src/controllers/countsController.ts línea 225
```typescript
// ANTES:
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {

// DESPUÉS:
export const getDashboardStats = async (_req: AuthRequest, res: Response): Promise<void> => {
```

### src/middlewares/errorHandler.ts línea 16
```typescript
// ANTES:
  next: NextFunction

// DESPUÉS:
  _next: NextFunction
```

### src/routes/branches.routes.ts línea 15
```typescript
// ANTES:
router.get('/', async (req: Request, res: Response) => {

// DESPUÉS:
router.get('/', async (_req: Request, res: Response) => {
```

### src/routes/branches.routes.ts línea 57
```typescript
// ANTES:
router.get('/health/all', async (req: Request, res: Response) => {

// DESPUÉS:
router.get('/health/all', async (_req: Request, res: Response) => {
```

### src/services/BranchesService.ts línea 179
```typescript
// ANTES:
    errorMessage?: string

// DESPUÉS:
    _errorMessage?: string

// O mejor aún, eliminar ese parámetro si no se usa
```

## Opción 3: Usar el código aunque tenga warnings

Puedes usar `npm run dev` directamente sin compilar con `npm run build`.

```bash
npm run dev
```

Esto usa `tsx` que es más permisivo y va a funcionar sin problemas.

## 🎯 Recomendación

Para que funcione YA:

1. **Usa `npm run dev` en lugar de `npm run build`**
   ```bash
   npm run dev
   ```

2. Eso iniciará el servidor sin necesidad de compilar primero

3. Los warnings no afectan la funcionalidad

4. Puedes arreglarlos después cuando tengas tiempo
