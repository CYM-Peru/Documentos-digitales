# Sistema de Planilla de Movilidad - Implementación Completada

## Resumen

Se ha implementado exitosamente el sistema de **Planilla de Movilidad** como una tercera opción junto a Rendición y Caja Chica, permitiendo digitalizar los gastos de transporte sin necesidad de usar papel.

---

## Características Implementadas

### 1. Nueva Opción de Operación

✅ **Selección de tipo:** Los usuarios ahora pueden elegir entre 3 opciones:
- 📋 **Rendición** - Gestión de rendiciones de gastos
- 💰 **Caja Chica** - Administración de gastos menores
- 🚗 **Planilla de Movilidad** - Registro de gastos de transporte **(NUEVO)**

### 2. Dos Modos de Ingreso

El sistema permite ingresar planillas de movilidad de dos formas:

#### Modo 1: Escanear Planilla
- Captura foto de planilla física existente
- Permite tomar foto con cámara o subir imagen
- Previsualización de la imagen capturada
- Luego permite completar los datos manualmente

#### Modo 2: Formulario Manual
- Ingreso completo desde cero
- Formulario digital con todos los campos de la planilla

### 3. Campos Capturados

**Cabecera:**
- N° de Planilla
- Razón Social (pre-cargado: CALZADOS AZALEIA PERU S.A.)
- RUC (pre-cargado: 20374412524)
- Periodo (ej: Noviembre 2025)
- Fecha de Emisión

**Datos del Trabajador:**
- Nombres y Apellidos (auto-completado del usuario logueado)
- Cargo
- DNI (obligatorio, máx 8 dígitos)
- Centro de Costo

**Gastos de Movilidad (múltiples registros):**
- Fecha del Gasto (Día/Mes/Año)
- Motivo del viaje
- Origen
- Destino
- Monto por Viaje
- Monto por Día

**Totales Calculados:**
- Total Viajes
- Total Día
- Total General

---

## Estructura de Base de Datos

### Tabla 1: CntCtaMovilidadPlanillas

Almacena la cabecera de cada planilla de movilidad.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| ID | NVARCHAR(255) | ID único (PK) |
| NroPlanilla | NVARCHAR(50) | Número de la planilla |
| RazonSocial | NVARCHAR(255) | Razón social de la empresa |
| RUC | NVARCHAR(50) | RUC de la empresa |
| Periodo | NVARCHAR(100) | Periodo al que corresponde |
| FechaEmision | DATETIME | Fecha de emisión |
| NombresApellidos | NVARCHAR(255) | Nombre del trabajador |
| Cargo | NVARCHAR(255) | Cargo del trabajador |
| DNI | NVARCHAR(20) | DNI del trabajador |
| CentroCosto | NVARCHAR(100) | Centro de costo |
| TotalViaje | FLOAT | Total de gastos por viaje |
| TotalDia | FLOAT | Total de gastos por día |
| TotalGeneral | FLOAT | Total general |
| Usuario | VARCHAR(100) | Usuario que creó la planilla |
| NroRend | INT | N° de Rendición (si aplica) |
| NroCajaChica | INT | N° de Caja Chica (si aplica) |
| TipoOperacion | VARCHAR(20) | RENDICION o CAJA_CHICA |
| Estado | NVARCHAR(255) | Estado de la planilla |
| OCRData | NVARCHAR(MAX) | Datos extraídos por OCR (JSON) |
| ImageUrl | NVARCHAR(500) | URL de la imagen escaneada |
| FechaCreacion | DATETIME | Fecha de creación |
| FechaModificacion | DATETIME | Fecha de modificación |

### Tabla 2: CntCtaMovilidadGastos

Almacena el detalle de cada gasto (múltiples por planilla).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| ID | INT IDENTITY | ID único (PK) |
| PlanillaID | NVARCHAR(255) | FK a CntCtaMovilidadPlanillas |
| FechaGasto | DATETIME | Fecha del gasto |
| Dia | INT | Día del gasto |
| Mes | INT | Mes del gasto |
| Anio | INT | Año del gasto |
| Motivo | NVARCHAR(500) | Motivo del viaje |
| Origen | NVARCHAR(255) | Lugar de origen |
| Destino | NVARCHAR(255) | Lugar de destino |
| MontoViaje | FLOAT | Monto del viaje |
| MontoDia | FLOAT | Monto por día |
| FechaCreacion | DATETIME | Fecha de creación |

**Relación:** Una planilla puede tener múltiples gastos (1:N con CASCADE DELETE).

---

## Archivos Creados/Modificados

### 1. Base de Datos
- ✅ `scripts/create-movilidad-table.sql` - Script SQL para crear tablas
- ✅ `scripts/create-movilidad-tables.ts` - Script para ejecutar creación

### 2. Backend
- ✅ `src/services/sqlserver.ts` - Agregados métodos:
  - `insertMovilidadPlanilla()` - Inserta planilla con gastos
  - `getMovilidadPlanillas()` - Obtiene planillas por usuario
  - `getMovilidadGastos()` - Obtiene gastos de una planilla
  - Interfaces: `MovilidadPlanillaData`, `MovilidadGasto`

- ✅ `src/app/api/planillas-movilidad/route.ts` - Nuevo endpoint (creado)
  - GET - Obtiene planillas del usuario
  - POST - Guarda nueva planilla

### 3. Frontend
- ✅ `src/components/MovilidadForm.tsx` - Nuevo componente (creado)
  - Modo selección (OCR vs Manual)
  - Modo OCR (captura de imagen)
  - Modo Manual (formulario completo)
  - Gestión de múltiples gastos
  - Cálculo automático de totales

- ✅ `src/app/select-operation/page.tsx` - Modificado
  - Agregada tercera opción: Planilla de Movilidad
  - Grid de 2 a 3 columnas
  - Tipo actualizado: `'RENDICION' | 'CAJA_CHICA' | 'PLANILLA_MOVILIDAD'`

- ✅ `src/app/page.tsx` - Modificado
  - Import de MovilidadForm
  - Estado `showMovilidadForm`
  - Tipo de operación actualizado
  - Botón principal adaptativo (cambia según tipo)
  - Selector de N°Rendición oculto para planillas
  - Header actualizado con emoji 🚗
  - Colores amber para planillas de movilidad

---

## Flujo de Uso

### Escenario Completo

```
1. Usuario inicia sesión
   ↓
2. Selecciona "🚗 Planilla de Movilidad"
   ↓
3. Sistema guarda tipo en sessionStorage
   ↓
4. Redirige a página principal con botón "Nueva Planilla"
   ↓
5. Usuario presiona "Nueva Planilla"
   ↓
6. Modal de selección: ¿Escanear o Manual?
   ↓
7a. ESCANEAR:                    7b. MANUAL:
   - Captura foto                   - Llena formulario directo
   - Preview de imagen              - Completa todos los campos
   - Continúa a formulario          - Agrega múltiples gastos
   - Completa datos                 - Ve totales calculados
   ↓                                ↓
8. Sistema calcula totales automáticamente
   ↓
9. Usuario presiona "Guardar Planilla"
   ↓
10. POST /api/planillas-movilidad
   ↓
11. Inserta en CntCtaMovilidadPlanillas + CntCtaMovilidadGastos
   ↓
12. ✅ Planilla guardada exitosamente
```

---

## Validaciones Implementadas

### Campos Obligatorios
- ✅ Nombres y Apellidos del trabajador
- ✅ Cargo del trabajador
- ✅ DNI del trabajador (8 dígitos)

### Validaciones de Gastos
- ✅ Al menos 1 gasto requerido
- ✅ Fechas con valores válidos (día 1-31, mes 1-12, año 2020-2030)
- ✅ Montos numéricos

### Cálculos Automáticos
- ✅ Total Viajes = Suma de todos los MontoViaje
- ✅ Total Día = Suma de todos los MontoDia
- ✅ Total General = Total Viajes + Total Día

---

## Endpoints API

### GET /api/planillas-movilidad
**Descripción:** Obtiene las planillas de movilidad del usuario autenticado

**Autenticación:** Requerida

**Response:**
```json
{
  "success": true,
  "planillas": [...],
  "username": "usuario"
}
```

### POST /api/planillas-movilidad
**Descripción:** Crea una nueva planilla de movilidad

**Autenticación:** Requerida

**Body:**
```json
{
  "id": "movilidad-1731234567890",
  "nroPlanilla": "012767",
  "razonSocial": "CALZADOS AZALEIA PERU S.A.",
  "ruc": "20374412524",
  "periodo": "Noviembre 2025",
  "fechaEmision": "2025-11-17",
  "nombresApellidos": "Mauro Tolentino",
  "cargo": "Sistemas",
  "dni": "41050731",
  "centroCosto": "CC001",
  "totalViaje": 21.50,
  "totalDia": 0,
  "totalGeneral": 21.50,
  "tipoOperacion": "RENDICION",
  "gastos": [
    {
      "dia": 4,
      "mes": 11,
      "anio": 2025,
      "motivo": "Monitoreo PC",
      "origen": "Paucarpata",
      "destino": "Paucarpata 014",
      "montoViaje": 4.00,
      "montoDia": 0
    },
    ...
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Planilla de movilidad guardada exitosamente",
  "gastosInsertados": 4
}
```

---

## Interfaz de Usuario

### Colores y Estilo

**Planilla de Movilidad** usa paleta **Amber/Orange**:
- Botón principal: `from-amber-600 to-orange-600`
- Badge header: `bg-amber-100 text-amber-700`
- Formulario: acentos en `amber-500`
- Totales: fondo `amber-50` con borde `amber-200`

**Comparación:**
- Rendición: Indigo/Purple 📋
- Caja Chica: Emerald/Green 💰
- Planilla Movilidad: Amber/Orange 🚗

### Componentes UI

**Selector de Modo:**
- 2 opciones lado a lado
- Escanear (azul) vs Manual (amber)
- Iconos visuales grandes

**Formulario:**
- Diseño responsive (mobile-first)
- Campos agrupados lógicamente
- Grid adaptativo (3 columnas en desktop)
- Tabla de gastos dinámica
- Botones + / - para agregar/eliminar gastos
- Vista de totales en tiempo real

---

## Integración con Sistema Existente

### Consistencia con Rendición/Caja Chica

✅ **Mismo flujo de selección de operación**
✅ **Misma estructura de sesión** (sessionStorage)
✅ **Mismo sistema de autenticación**
✅ **Misma conexión a SQL Server**
✅ **Mismo servicio de encriptación**
✅ **Misma estructura de respuestas API**

### Diferencias Clave

| Aspecto | Rendición/Caja Chica | Planilla Movilidad |
|---------|---------------------|-------------------|
| Tipo de documento | Facturas/Comprobantes | Planilla de gastos |
| OCR | Extrae datos de factura | Captura imagen de referencia |
| N° Asignado | Requerido (selector) | Opcional |
| Estructura datos | 1 documento = 1 registro | 1 planilla = múltiples gastos |
| Tablas SQL | CntCta...DocumentosIA | CntCtaMovilidad... (2 tablas) |

---

## Verificación y Testing

### 1. Compilación
```bash
cd /opt/invoice-system
npx tsc --noEmit  # ✅ Sin errores
npm run build     # ✅ Build exitoso
```

### 2. Tablas creadas
```sql
SELECT TOP 10 * FROM dbo.CntCtaMovilidadPlanillas  -- ✅ Tabla existe
SELECT TOP 10 * FROM dbo.CntCtaMovilidadGastos     -- ✅ Tabla existe
```

### 3. Endpoint registrado
```
✅ /api/planillas-movilidad (GET, POST)
```

### 4. Aplicación reiniciada
```bash
pm2 restart invoice-system  # ✅ Reiniciado correctamente
```

---

## Próximos Pasos Sugeridos

### Mejoras Futuras (Opcionales)

1. **OCR Automático:**
   - Integrar con Gemini Vision para extraer datos automáticamente
   - Reconocer campos de la planilla escaneada
   - Auto-rellenar formulario con datos extraídos

2. **Exportación:**
   - Exportar planillas a PDF
   - Exportar a Excel con formato de planilla original
   - Imprimir planilla digital

3. **Reportes:**
   - Dashboard de gastos de movilidad por período
   - Gráficos de rutas más frecuentes
   - Análisis de gastos por usuario/centro de costo

4. **Validaciones Adicionales:**
   - Validar que origen ≠ destino
   - Límites de monto por tipo de transporte
   - Alertas de gastos duplicados (misma ruta/fecha)

5. **Workflow de Aprobación:**
   - Estados: Pendiente → En Revisión → Aprobado → Rechazado
   - Notificaciones por email
   - Comentarios del aprobador

---

## Notas Técnicas

### Consideraciones de Seguridad
✅ Autenticación requerida en todos los endpoints
✅ Usuario extraído de sesión (no del body)
✅ Sanitización de strings en SQL Server
✅ Uso de parámetros preparados (sql.input)
✅ Validación de tipos en TypeScript

### Rendimiento
✅ Índices creados en ambas tablas
✅ Pool de conexiones SQL Server reutilizado
✅ Cierre automático de conexiones
✅ Transacciones para inserción de múltiples gastos

### Mantenibilidad
✅ Código organizado por responsabilidad
✅ Componentes reutilizables
✅ Interfaces TypeScript bien definidas
✅ Documentación inline con comentarios
✅ Logs descriptivos en consola

---

## Resumen Final

✅ **Sistema Completamente Funcional**

El sistema de Planilla de Movilidad está listo para usar:
- ✅ Tablas SQL Server creadas
- ✅ Backend API funcional
- ✅ Frontend responsive implementado
- ✅ Flujo completo de captura a guardado
- ✅ Integración perfecta con sistema existente
- ✅ Build y deployment exitosos

**Los usuarios ya pueden:**
1. Seleccionar "Planilla de Movilidad" como tipo de operación
2. Escanear planillas físicas existentes
3. Llenar formularios digitales desde cero
4. Agregar múltiples gastos por planilla
5. Ver totales calculados automáticamente
6. Guardar en SQL Server correctamente

**¡Todo listo para producción!** 🚀

---

**Fecha de Implementación:** 19 de Noviembre, 2025
**Desarrollado con:** Claude Code
**Stack:** Next.js 14, TypeScript, SQL Server, TailwindCSS
