# Sistema de Aprobación de Planillas de Movilidad

## Fecha: 19 de Noviembre, 2025

---

## Resumen

Se implementó un sistema completo de aprobación para las planillas de movilidad, donde:

1. **Usuarios normales** llenan planillas de movilidad
2. Las planillas quedan en estado **PENDIENTE_APROBACION**
3. **Amanda Arroyo** (rol APROBADOR) revisa y aprueba/rechaza
4. **Solo planillas aprobadas** van a SQL Server
5. Planillas rechazadas quedan como histórico sin acción

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE APROBACIÓN                           │
└─────────────────────────────────────────────────────────────────┘

1. Usuario llena planilla
   └─> POST /api/planillas-movilidad
       └─> Guarda en PostgreSQL
           └─> Estado: PENDIENTE_APROBACION

2. Amanda ve notificación (badge con contador)
   └─> Click en botón de aprobación
       └─> GET /api/planillas-movilidad/pendientes
           └─> Lista de planillas pendientes

3. Amanda aprueba o rechaza
   ├─> APROBAR
   │   └─> POST /api/planillas-movilidad/[id]/aprobar
   │       └─> Actualiza PostgreSQL: APROBADA
   │       └─> Envía a SQL Server ✓
   │       └─> Retorna success
   │
   └─> RECHAZAR
       └─> POST /api/planillas-movilidad/[id]/aprobar
           └─> Actualiza PostgreSQL: RECHAZADA
           └─> NO va a SQL Server
           └─> Queda como histórico
```

---

## Base de Datos: PostgreSQL (Prisma)

### Enum: UserRole

```prisma
enum UserRole {
  SUPER_ADMIN
  ORG_ADMIN
  USER
  APROBADOR  // ← NUEVO
  @@schema("invoice_system")
}
```

### Enum: AprobacionEstado

```prisma
enum AprobacionEstado {
  PENDIENTE_APROBACION
  APROBADA
  RECHAZADA
  @@schema("invoice_system")
}
```

### Modelo: MovilidadPlanilla

```prisma
model MovilidadPlanilla {
  id             String   @id @default(cuid())
  organizationId String
  userId         String

  // Datos de la planilla
  nroPlanilla       String?
  razonSocial       String?
  ruc               String?
  periodo           String?
  fechaEmision      DateTime?

  // Datos del trabajador
  nombresApellidos  String
  cargo             String
  dni               String
  centroCosto       String?

  // Totales
  totalViaje        Float    @default(0)
  totalDia          Float    @default(0)
  totalGeneral      Float    @default(0)

  // Tipo de operación
  tipoOperacion     OperationType?
  nroRendicion      String?
  nroCajaChica      String?

  // Estado de aprobación ← NUEVO
  estadoAprobacion  AprobacionEstado @default(PENDIENTE_APROBACION)
  aprobadoPorId     String?
  aprobadoEn        DateTime?
  comentariosAprobacion String?

  // Imagen escaneada
  imageUrl          String?

  // Metadatos
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relaciones
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  aprobadoPor  User?        @relation("AprobadorPlanillas", fields: [aprobadoPorId], references: [id])
  gastos       MovilidadGasto[]

  @@index([estadoAprobacion])
  @@index([aprobadoPorId])
  @@map("movilidad_planillas")
  @@schema("invoice_system")
}
```

### Modelo: MovilidadGasto

```prisma
model MovilidadGasto {
  id          Int      @id @default(autoincrement())
  planillaId  String
  dia         Int?
  mes         Int?
  anio        Int?
  fechaGasto  DateTime?
  motivo      String?
  origen      String?
  destino     String?
  montoViaje  Float    @default(0)
  montoDia    Float    @default(0)
  createdAt   DateTime @default(now())

  planilla    MovilidadPlanilla @relation(fields: [planillaId], references: [id], onDelete: CASCADE)

  @@index([planillaId])
  @@map("movilidad_gastos")
  @@schema("invoice_system")
}
```

---

## API Endpoints

### 1. POST /api/planillas-movilidad

**Descripción:** Crear nueva planilla de movilidad

**Autorización:** Usuario autenticado

**Comportamiento:**
- Guarda planilla en PostgreSQL
- Estado inicial: `PENDIENTE_APROBACION`
- NO va a SQL Server todavía

**Request Body:**
```typescript
{
  nombresApellidos: string      // REQUERIDO
  cargo: string                 // REQUERIDO
  dni: string                   // REQUERIDO
  nroPlanilla?: string
  razonSocial?: string
  ruc?: string
  periodo?: string
  fechaEmision?: Date
  centroCosto?: string
  totalViaje?: number
  totalDia?: number
  totalGeneral?: number
  tipoOperacion?: 'RENDICION' | 'CAJA_CHICA' | 'PLANILLA_MOVILIDAD'
  nroRendicion?: string
  nroCajaChica?: string
  imageUrl?: string
  gastos?: Array<{
    dia?: number
    mes?: number
    anio?: number
    fechaGasto?: Date
    motivo?: string
    origen?: string
    destino?: string
    montoViaje?: number
    montoDia?: number
  }>
}
```

**Response:**
```typescript
{
  success: true,
  message: "Planilla de movilidad guardada exitosamente. Pendiente de aprobación.",
  planilla: MovilidadPlanilla,
  gastosCreados: number
}
```

---

### 2. GET /api/planillas-movilidad/pendientes

**Descripción:** Obtener todas las planillas de la organización

**Autorización:** Solo APROBADOR

**Response:**
```typescript
{
  success: true,
  planillas: MovilidadPlanilla[],
  total: number,
  pendientes: number,
  aprobadas: number,
  rechazadas: number
}
```

---

### 3. POST /api/planillas-movilidad/[id]/aprobar

**Descripción:** Aprobar o rechazar una planilla

**Autorización:** Solo APROBADOR

**Request Body:**
```typescript
{
  accion: 'APROBAR' | 'RECHAZAR',
  comentarios?: string  // Opcional para aprobar, requerido para rechazar
}
```

**Comportamiento APROBAR:**
1. Actualiza PostgreSQL: `estadoAprobacion = 'APROBADA'`
2. Registra `aprobadoPorId` y `aprobadoEn`
3. Envía planilla a SQL Server (si está configurado)
4. Retorna success

**Comportamiento RECHAZAR:**
1. Actualiza PostgreSQL: `estadoAprobacion = 'RECHAZADA'`
2. Registra `aprobadoPorId`, `aprobadoEn` y `comentariosAprobacion`
3. NO envía a SQL Server
4. Queda como histórico

**Response:**
```typescript
{
  success: true,
  message: string,
  planilla: MovilidadPlanilla,
  sqlServerSaved?: boolean,     // Solo para APROBAR
  sqlServerError?: string        // Si hubo error en SQL Server
}
```

**Validaciones:**
- Usuario debe tener rol `APROBADOR`
- Planilla debe estar en estado `PENDIENTE_APROBACION`
- Planilla debe pertenecer a la organización del aprobador
- Para RECHAZAR: comentarios es requerido

---

## Frontend

### Página de Aprobación: /aprobacion-planillas

**Ubicación:** `/opt/invoice-system/src/app/aprobacion-planillas/page.tsx`

**Características:**
- Solo accesible por usuarios con rol `APROBADOR`
- Muestra lista de planillas con filtros:
  - Pendientes (por defecto)
  - Todas
- Cada planilla muestra:
  - Datos del trabajador (nombre, cargo, DNI)
  - Totales (viaje, día, general)
  - Fecha de creación
  - Usuario que la creó
  - Estado actual
- Expandible para ver:
  - Detalle de gastos (tabla)
  - Campo para comentarios
  - Botones Aprobar / Rechazar
- Auto-actualiza cada 30 segundos
- Responsive design

**Interfaz:**
```typescript
interface MovilidadPlanilla {
  id: string
  nroPlanilla?: string | null
  razonSocial?: string | null
  ruc?: string | null
  periodo?: string | null
  fechaEmision?: string | null
  nombresApellidos: string
  cargo: string
  dni: string
  centroCosto?: string | null
  totalViaje: number
  totalDia: number
  totalGeneral: number
  tipoOperacion?: string | null
  nroRendicion?: string | null
  nroCajaChica?: string | null
  estadoAprobacion: string
  createdAt: string
  user: {
    name?: string | null
    email?: string | null
  }
  gastos: MovilidadGasto[]
}
```

---

### Notificación en Header

**Ubicación:** `/opt/invoice-system/src/app/page.tsx`

**Características:**
- Badge de notificación con contador en header
- Solo visible para rol `APROBADOR`
- Muestra número de planillas pendientes
- Auto-actualiza cada 30 segundos
- Click redirige a `/aprobacion-planillas`
- Badge rojo pulsante cuando hay pendientes
- Badge oculto cuando no hay pendientes

**Código:**
```typescript
// Estado
const [pendingPlanillasCount, setPendingPlanillasCount] = useState(0)

// Auto-refresh cada 30 segundos
useEffect(() => {
  if (status === 'authenticated' && session?.user?.role === 'APROBADOR') {
    loadPendingPlanillasCount()
    const interval = setInterval(() => {
      loadPendingPlanillasCount()
    }, 30000)
    return () => clearInterval(interval)
  }
}, [status, session?.user?.role])

// Función de carga
const loadPendingPlanillasCount = async () => {
  try {
    const response = await fetch('/api/planillas-movilidad/pendientes')
    const data = await response.json()
    if (data.success) {
      setPendingPlanillasCount(data.pendientes || 0)
    }
  } catch (error) {
    console.error('Error loading pending planillas count:', error)
  }
}

// Botón en header
{session.user.role === 'APROBADOR' && (
  <button
    onClick={() => router.push('/aprobacion-planillas')}
    className="relative p-2 hover:text-blue-600 rounded-lg transition-colors"
    title={`Aprobación de Planillas (${pendingPlanillasCount} pendientes)`}
  >
    <svg>✓ icon</svg>
    {pendingPlanillasCount > 0 && (
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center animate-pulse">
        {pendingPlanillasCount}
      </span>
    )}
  </button>
)}
```

---

## Integración con SQL Server

**Archivo:** `/opt/invoice-system/src/app/api/planillas-movilidad/[id]/aprobar/route.ts`

**Flujo:**
1. Al aprobar, se intenta guardar en SQL Server
2. Si SQL Server falla:
   - La aprobación en PostgreSQL se mantiene
   - Se registra el error
   - Se retorna `sqlServerSaved: false` y `sqlServerError: "mensaje"`
3. Si SQL Server tiene éxito:
   - Se retorna `sqlServerSaved: true`

**Datos enviados a SQL Server:**
```typescript
const sqlData = {
  id: string,
  nroPlanilla?: string,
  razonSocial?: string,
  ruc?: string,
  periodo?: string,
  fechaEmision?: Date,
  nombresApellidos?: string,
  cargo?: string,
  dni?: string,
  centroCosto?: string,
  totalViaje: number,
  totalDia: number,
  totalGeneral: number,
  usuario: string,              // Email sin @dominio
  nroRendicion?: string,
  nroCajaChica?: string,
  tipoOperacion?: 'RENDICION' | 'CAJA_CHICA',
  gastos: Array<{
    fechaGasto?: Date,
    dia?: number,
    mes?: number,
    anio?: number,
    motivo?: string,
    origen?: string,
    destino?: string,
    montoViaje: number,
    montoDia: number
  }>
}
```

**Tablas SQL Server:**
- `CntCtaMovilidadPlanillas`
- `CntCtaMovilidadGastos`

---

## Archivos Modificados/Creados

### Creados

1. ✅ `/opt/invoice-system/src/app/aprobacion-planillas/page.tsx`
   - Página de aprobación para Amanda

2. ✅ `/opt/invoice-system/src/app/api/planillas-movilidad/[id]/aprobar/route.ts`
   - API para aprobar/rechazar planillas

3. ✅ `/opt/invoice-system/src/app/api/planillas-movilidad/pendientes/route.ts`
   - API para obtener planillas pendientes

4. ✅ `/opt/invoice-system/SISTEMA-APROBACION-PLANILLAS.md`
   - Esta documentación

### Modificados

1. ✅ `/opt/invoice-system/prisma/schema.prisma`
   - Agregado rol `APROBADOR` a UserRole
   - Creado enum `AprobacionEstado`
   - Creados modelos `MovilidadPlanilla` y `MovilidadGasto`
   - Agregadas relaciones self-referencial en User

2. ✅ `/opt/invoice-system/src/app/api/planillas-movilidad/route.ts`
   - GET: Actualizado para leer de PostgreSQL
   - POST: Actualizado para guardar en PostgreSQL con estado PENDIENTE_APROBACION

3. ✅ `/opt/invoice-system/src/app/page.tsx`
   - Agregado badge de notificación para APROBADOR
   - Agregado auto-refresh de contador pendientes

---

## Comandos Ejecutados

```bash
# 1. Generar cliente Prisma con nuevos modelos
npx prisma generate

# 2. Sincronizar base de datos
npx prisma db push

# 3. Build de la aplicación
npm run build

# 4. Reiniciar PM2
pm2 restart invoice-system
```

---

## Estados de Planilla

```
┌─────────────────────────────────────────────────────────────┐
│                  ESTADOS DE PLANILLA                         │
└─────────────────────────────────────────────────────────────┘

PENDIENTE_APROBACION (inicial)
    │
    ├─> [Amanda APRUEBA]
    │   └─> APROBADA
    │       └─> Va a SQL Server ✓
    │
    └─> [Amanda RECHAZA]
        └─> RECHAZADA
            └─> Queda como histórico
            └─> NO va a SQL Server
```

---

## Roles y Permisos

| Acción                          | USER | APROBADOR | ORG_ADMIN | SUPER_ADMIN |
|---------------------------------|------|-----------|-----------|-------------|
| Crear planilla                  | ✓    | ✓         | ✓         | ✓           |
| Ver propias planillas           | ✓    | ✓         | ✓         | ✓           |
| Ver todas planillas org         | ✗    | ✓         | ✓         | ✓           |
| Aprobar/Rechazar planillas      | ✗    | ✓         | ✗         | ✗           |
| Ver página /aprobacion-planillas| ✗    | ✓         | ✗         | ✗           |
| Ver badge de notificaciones     | ✗    | ✓         | ✗         | ✗           |

**Nota:** El sistema está diseñado específicamente para que solo el rol `APROBADOR` pueda ver y aprobar planillas. Incluso los administradores no tienen acceso a esta función.

---

## Testing

### Escenario 1: Usuario crea planilla

1. Usuario normal inicia sesión
2. Selecciona "Planilla de Movilidad"
3. Llena formulario (manual o escanea)
4. Click en "Guardar"
5. **Resultado esperado:**
   - Planilla guardada en PostgreSQL
   - Estado: PENDIENTE_APROBACION
   - Mensaje: "Pendiente de aprobación"
   - NO aparece en SQL Server

### Escenario 2: Amanda aprueba planilla

1. Amanda (APROBADOR) inicia sesión
2. Ve badge con "1" en el header
3. Click en badge → redirige a /aprobacion-planillas
4. Ve planilla pendiente
5. Click en "Ver detalle"
6. Revisa gastos
7. (Opcional) Agrega comentarios
8. Click en "Aprobar"
9. **Resultado esperado:**
   - Planilla actualizada: APROBADA
   - Planilla enviada a SQL Server
   - Badge actualizado a "0"
   - Mensaje: "Planilla aprobada correctamente"

### Escenario 3: Amanda rechaza planilla

1. Amanda ve planilla pendiente
2. Click en "Ver detalle"
3. Agrega comentario: "Faltan comprobantes"
4. Click en "Rechazar"
5. **Resultado esperado:**
   - Planilla actualizada: RECHAZADA
   - NO va a SQL Server
   - Queda visible en histórico
   - Mensaje: "Planilla rechazada correctamente"

### Escenario 4: Usuario intenta acceder a página de aprobación

1. Usuario normal intenta acceder a /aprobacion-planillas
2. **Resultado esperado:**
   - Alerta: "No tiene permisos para acceder a esta página"
   - Redirige a /

---

## Beneficios del Sistema

1. **Control de calidad**
   - Revisión antes de enviar a SQL Server
   - Evita errores en datos contables

2. **Trazabilidad**
   - Quién creó la planilla
   - Quién la aprobó/rechazó
   - Cuándo fue aprobada/rechazada
   - Comentarios del aprobador

3. **Histórico completo**
   - Planillas rechazadas se mantienen
   - Útil para auditorías
   - Sin pérdida de información

4. **Notificaciones en tiempo real**
   - Badge con contador
   - Auto-refresh cada 30 segundos
   - No se pierden planillas pendientes

5. **Separación de responsabilidades**
   - Usuarios crean
   - Aprobador valida
   - Sistema sincroniza

---

## Próximos Pasos (Opcionales)

### Mejoras Futuras

1. **Notificaciones por email**
   - Notificar a Amanda cuando hay nueva planilla
   - Notificar al usuario cuando su planilla es aprobada/rechazada

2. **Dashboard de métricas**
   - Tiempo promedio de aprobación
   - Tasa de rechazo
   - Planillas por usuario

3. **Edición de planillas rechazadas**
   - Permitir que usuario corrija y reenvíe
   - Mantener versiones anteriores

4. **Múltiples aprobadores**
   - Flujo de aprobación en cascada
   - Aprobador por departamento

5. **Exportación de reportes**
   - Excel con planillas filtradas
   - PDF de planilla individual

---

## Resumen Final

✅ **Sistema completo de aprobación implementado**
✅ **Base de datos actualizada y sincronizada**
✅ **APIs funcionales y probadas**
✅ **Interfaz de usuario intuitiva**
✅ **Notificaciones en tiempo real**
✅ **Build exitoso sin errores**
✅ **Aplicación reiniciada y online**

**Todo listo para producción!** 🚀

---

**Desarrollado con:** Claude Code
**Fecha:** 19 de Noviembre, 2025
