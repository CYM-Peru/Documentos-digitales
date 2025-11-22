# Mejoras: Scroll en Móviles y Cajas Chicas con CodLocal

## Fecha: 19 de Noviembre, 2025

---

## Resumen de Cambios

Se realizaron dos mejoras importantes en el sistema:

1. ✅ **Mejorado el scroll en móviles** del formulario de planilla de movilidad
2. ✅ **Actualizada la query de cajas chicas** para incluir `CodLocal` y `NroRend`
3. ✅ **Actualizada la interfaz** para mostrar el local en el selector

---

## 1. Mejora del Scroll en Móviles

### Problema
El formulario de planilla de movilidad era difícil de usar en móviles porque:
- No tenía scroll adecuado
- El contenido se cortaba en pantallas pequeñas
- Los márgenes ocupaban mucho espacio en móviles

### Solución Implementada

**Archivo:** `src/components/MovilidadForm.tsx`

#### Modo Selección (Escanear vs Manual)
```tsx
// ANTES:
<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">

// DESPUÉS:
<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
  <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 md:p-8 my-4">
```

**Cambios:**
- ✅ Agregado `overflow-y-auto` al contenedor principal
- ✅ Padding adaptativo: `p-6` en móvil, `p-8` en desktop
- ✅ Margen vertical: `my-4` para evitar que toque los bordes

#### Modo OCR (Escanear)
```tsx
// ANTES:
<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
  <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 my-8">

// DESPUÉS:
<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
  <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 md:p-8 my-4 md:my-8 max-h-[90vh] overflow-y-auto">
```

**Cambios:**
- ✅ Agregado `max-h-[90vh]` para limitar altura al 90% del viewport
- ✅ Agregado `overflow-y-auto` al modal interno
- ✅ Padding y márgenes adaptativos

#### Modo Manual (Formulario Completo)
```tsx
// ANTES:
<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
  <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full p-8 my-8">

// DESPUÉS:
<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 md:p-4 overflow-y-auto">
  <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full p-4 md:p-8 my-4 md:my-8 max-h-[95vh] overflow-y-auto">
```

**Cambios:**
- ✅ Padding exterior reducido en móviles: `p-2` vs `p-4`
- ✅ Padding interior adaptativo: `p-4` en móvil, `p-8` en desktop
- ✅ Altura máxima del 95% del viewport
- ✅ Scroll interno independiente

### Beneficios
- 📱 Mejor experiencia en móviles
- ✅ Todo el contenido es accesible
- 👆 Scroll natural y fluido
- 📏 Aprovecha mejor el espacio en pantallas pequeñas

---

## 2. Query de Cajas Chicas con CodLocal

### Problema
La query anterior no incluía el campo `CodLocal` que es necesario para identificar a qué local pertenece cada caja chica.

### Query Anterior (Incorrecta)
```sql
-- Query con errores de sintaxis que el usuario proporcionó:
SELECT CodLocal, NroRend, CodUserAsg
FROM [dbo]. [CntCtaCajaChica]  -- Espacio incorrecto
DONDE CodUserAsg='JACHUY' Y CodEstado='00'  -- "DONDE" en lugar de "WHERE"
```

### Query Nueva (Correcta)
```sql
SELECT CodLocal, NroRend, CodUserAsg, CodEstado, NroCajaChica
FROM [dbo].[CntCtaCajaChica]
WHERE CodEstado = '00'
  AND CodUserAsg = @CodUserAsg
ORDER BY NroCajaChica DESC
```

**Archivo:** `src/services/sqlserver.ts`

**Cambios en el método `getCajasChicasPendientes()`:**

```typescript
// ANTES:
async getCajasChicasPendientes(codUserAsg: string): Promise<CajaChicaPendiente[]> {
  const result = await pool.request()
    .input('CodUserAsg', sql.VarChar(50), codUserAsg)
    .query(`
      SELECT CodUserAsg, CodEstado, NroCajaChica
      FROM AZALEIAPERU.DBO.CntCtaCajaChica
      WHERE CodEstado = '00'
        AND YEAR(FCHREG) >= 2025
        AND CodUserAsg = @CodUserAsg
      ORDER BY NroCajaChica DESC
    `)
}

// DESPUÉS:
async getCajasChicasPendientes(codUserAsg: string): Promise<CajaChicaPendiente[]> {
  const result = await pool.request()
    .input('CodUserAsg', sql.VarChar(50), codUserAsg)
    .query(`
      SELECT CodLocal, NroRend, CodUserAsg, CodEstado, NroCajaChica
      FROM [dbo].[CntCtaCajaChica]
      WHERE CodEstado = '00'
        AND CodUserAsg = @CodUserAsg
      ORDER BY NroCajaChica DESC
    `)
}
```

**Nota:** Se eliminó el filtro `YEAR(FCHREG) >= 2025` para incluir todas las cajas chicas pendientes independiente del año.

---

## 3. Actualización de Interfaces TypeScript

### Interfaz CajaChicaPendiente

**Archivo:** `src/services/sqlserver.ts`

```typescript
// ANTES:
export interface CajaChicaPendiente {
  CodUserAsg: string
  CodEstado: string
  NroCajaChica: number
}

// DESPUÉS:
export interface CajaChicaPendiente {
  CodUserAsg: string
  CodEstado: string
  NroCajaChica: number
  CodLocal?: string      // ← NUEVO
  NroRend?: number       // ← NUEVO
}
```

### Interfaces en page.tsx

**Archivo:** `src/app/page.tsx`

```typescript
// Interfaz Rendicion actualizada:
interface Rendicion {
  CodUserAsg: string
  CodEstado: string
  NroRend: number
  CodLocal?: string       // ← NUEVO
  NroCajaChica?: number   // ← NUEVO
}

// Interfaz CajaChica actualizada:
interface CajaChica {
  CodUserAsg: string
  CodEstado: string
  NroCajaChica: number
  CodLocal?: string       // ← NUEVO
  NroRend?: number        // ← NUEVO
}
```

---

## 4. Actualización de la Interfaz de Usuario

### Selector de Cajas Chicas

**Archivo:** `src/app/page.tsx`

**ANTES:**
```tsx
{rendiciones.map((rend) => (
  <option key={rend.NroRend} value={rend.NroRend}>
    {operationType === 'RENDICION' ? 'Rendición' : 'Caja Chica'} N° {rend.NroRend}
  </option>
))}
```

**DESPUÉS:**
```tsx
{rendiciones.map((rend) => (
  <option key={rend.NroRend} value={rend.NroRend}>
    {operationType === 'RENDICION'
      ? `Rendición N° ${rend.NroRend}`
      : `Caja Chica N° ${rend.NroRend}${rend.CodLocal ? ` - Local: ${rend.CodLocal}` : ''}`
    }
  </option>
))}
```

**Ejemplos de visualización:**

Para **Rendiciones:**
```
Rendición N° 1001
Rendición N° 1002
Rendición N° 1003
```

Para **Cajas Chicas:**
```
Caja Chica N° 2501 - Local: AQP01
Caja Chica N° 2502 - Local: LIM02
Caja Chica N° 2503 - Local: CUS01
```

Si no tiene CodLocal:
```
Caja Chica N° 2504
```

---

## 5. Preservación de Datos en Transformación

**Archivo:** `src/app/page.tsx` - Método `loadRendiciones()`

```typescript
// ANTES: Solo mapeaba NroCajaChica a NroRend
const transformed = data.cajasChicas.map((cc: CajaChica) => ({
  CodUserAsg: cc.CodUserAsg,
  CodEstado: cc.CodEstado,
  NroRend: cc.NroCajaChica, // Mapear para reusar componente
}))

// DESPUÉS: Preserva todos los campos adicionales
const transformed = data.cajasChicas.map((cc: CajaChica) => ({
  CodUserAsg: cc.CodUserAsg,
  CodEstado: cc.CodEstado,
  NroRend: cc.NroCajaChica,       // Mapear para reusar componente
  CodLocal: cc.CodLocal,           // ← Preservar CodLocal
  NroCajaChica: cc.NroCajaChica,  // ← Preservar original
}))
```

**Razón:**
El sistema usa `NroRend` en el selector para reusar el mismo componente tanto para rendiciones como cajas chicas. Al transformar, se preservan también los campos adicionales para poder mostrarlos en la interfaz.

---

## 6. Actualización del Schema Prisma

**Problema:**
El enum `OperationType` no incluía `PLANILLA_MOVILIDAD`, causando error al intentar guardar planillas.

**Archivo:** `prisma/schema.prisma`

```prisma
// ANTES:
enum OperationType {
  RENDICION
  CAJA_CHICA

  @@schema("invoice_system")
}

// DESPUÉS:
enum OperationType {
  RENDICION
  CAJA_CHICA
  PLANILLA_MOVILIDAD  // ← NUEVO

  @@schema("invoice_system")
}
```

### Comandos Ejecutados:
```bash
# 1. Generar cliente Prisma con nuevo enum
npx prisma generate

# 2. Sincronizar base de datos
npx prisma db push

# 3. Rebuild de la aplicación
npm run build

# 4. Reiniciar PM2
pm2 restart invoice-system
```

**Resultado:**
✅ Base de datos actualizada correctamente
✅ Enum disponible en TypeScript
✅ Sistema funcional

---

## Archivos Modificados

1. ✅ `src/components/MovilidadForm.tsx` - Mejoras de scroll
2. ✅ `src/services/sqlserver.ts` - Query actualizada + interfaces
3. ✅ `src/app/page.tsx` - Interfaces actualizadas + UI mejorada
4. ✅ `prisma/schema.prisma` - Enum actualizado

---

## Testing

### 1. Compilación TypeScript
```bash
npx tsc --noEmit
```
✅ Sin errores

### 2. Build de Next.js
```bash
npm run build
```
✅ Build exitoso

### 3. Prisma
```bash
npx prisma generate
npx prisma db push
```
✅ Base de datos sincronizada

### 4. PM2
```bash
pm2 restart invoice-system
pm2 status
```
✅ Aplicación online

---

## Ejemplo de Uso

### Escenario: Usuario "JACHUY" en Local "AQP01"

**Query SQL ejecutada:**
```sql
SELECT CodLocal, NroRend, CodUserAsg, CodEstado, NroCajaChica
FROM [dbo].[CntCtaCajaChica]
WHERE CodEstado = '00'
  AND CodUserAsg = 'JACHUY'
ORDER BY NroCajaChica DESC
```

**Resultado:**
| CodLocal | NroRend | CodUserAsg | CodEstado | NroCajaChica |
|----------|---------|------------|-----------|--------------|
| AQP01    | 1001    | JACHUY     | 00        | 2501         |
| AQP01    | 1002    | JACHUY     | 00        | 2502         |
| LIM02    | 1003    | JACHUY     | 00        | 2503         |

**Visualización en el selector:**
```
Caja Chica N° 2501 - Local: AQP01
Caja Chica N° 2502 - Local: AQP01
Caja Chica N° 2503 - Local: LIM02
```

---

## Beneficios de las Mejoras

### Scroll en Móviles:
- 📱 **Mejor UX en móviles** - Formulario completamente accesible
- 👆 **Scroll natural** - Comportamiento esperado por usuarios
- 📏 **Optimización de espacio** - Márgenes y padding adaptativos
- ✅ **Todo visible** - Sin contenido cortado

### CodLocal en Cajas Chicas:
- 🏢 **Identificación clara** - Sabes a qué local pertenece cada caja
- 📊 **Mejor gestión** - Facilita control por local
- 🎯 **Precisión** - Evita confusiones entre locales
- ✅ **Query correcta** - Sintaxis SQL válida

### Enum PLANILLA_MOVILIDAD:
- ✅ **Sistema completo** - Todos los tipos de operación disponibles
- 🔒 **Type-safe** - TypeScript + Prisma garantizan tipos correctos
- 📊 **Base de datos** - PostgreSQL actualizado con nuevo valor

---

## Notas Técnicas

### Responsive Design
Se usa la convención de Tailwind CSS:
- Sin prefijo = móvil (por defecto)
- `md:` = tablet y desktop (768px+)

Ejemplo:
```tsx
p-4 md:p-8
// móvil: padding 1rem (16px)
// desktop: padding 2rem (32px)
```

### Overflow Behavior
```tsx
max-h-[95vh] overflow-y-auto
```
- `max-h-[95vh]`: Altura máxima del 95% del viewport height
- `overflow-y-auto`: Scroll vertical cuando el contenido excede la altura

### SQL Server Query
Se usa `[dbo].[CntCtaCajaChica]` con corchetes correctos en lugar de `[dbo]. [CntCtaCajaChica]` (con espacio).

---

## Resumen Final

✅ **Scroll mejorado** en todos los modales del formulario de movilidad
✅ **Query actualizada** para incluir CodLocal y NroRend
✅ **Interfaces TypeScript** correctamente tipadas
✅ **UI actualizada** para mostrar local en selector
✅ **Enum Prisma** sincronizado con base de datos
✅ **Build exitoso** sin errores
✅ **Aplicación reiniciada** y funcionando

**Todo listo para usar!** 🚀

---

**Desarrollado con:** Claude Code
**Fecha:** 19 de Noviembre, 2025
