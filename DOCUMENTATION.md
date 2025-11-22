# 📚 Documentación Completa - Sistema Azaleia Invoice & Movilidad

> **Última actualización:** 2025-11-19
> **Versión del sistema:** 1.0.0
> **Autor:** Christian Palomino
> **Desarrollado con:** Claude AI (Anthropic)

---

## 📖 Índice

1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Arquitectura Técnica](#2-arquitectura-técnica)
3. [Módulos del Sistema](#3-módulos-del-sistema)
4. [Base de Datos](#4-base-de-datos)
5. [API Endpoints](#5-api-endpoints)
6. [Servicios e Integraciones](#6-servicios-e-integraciones)
7. [Configuración y Despliegue](#7-configuración-y-despliegue)
8. [Flujos de Usuario](#8-flujos-de-usuario)
9. [Seguridad y Autenticación](#9-seguridad-y-autenticación)
10. [Guías de Uso](#10-guías-de-uso)

---

## 1. Visión General del Sistema

### 1.1 Propósito
Sistema integral de gestión de documentos contables y gastos para Azaleia Perú, que automatiza:
- Procesamiento de facturas electrónicas con OCR/IA
- Gestión de Rendiciones de cuentas
- Administración de Cajas Chicas
- Control de Planillas de Movilidad
- Notificaciones automáticas por WhatsApp

### 1.2 Tecnologías Principales
- **Frontend/Backend:** Next.js 14 (App Router)
- **Base de Datos:** PostgreSQL (Supabase) + SQL Server (legacy)
- **ORM:** Prisma
- **IA/OCR:** Google Gemini Vision API
- **Autenticación:** NextAuth.js
- **WhatsApp:** Evolution API v2.1.1
- **Infraestructura:** PM2, Docker, Nginx

### 1.3 URLs del Sistema
- **Producción:** https://cockpit.azaleia.com.pe
- **Servidor:** 147.93.10.141
- **Puerto:** 3010 (interno), 443 (HTTPS externo)

---

## 2. Arquitectura Técnica

### 2.1 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUARIO FINAL                            │
│                    (https://cockpit.azaleia.com.pe)             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        NGINX (Puerto 443)                        │
│                     Reverse Proxy + SSL/TLS                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  NEXT.JS 14 APP (Puerto 3010)                    │
│                        PM2 Process Manager                        │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   App Router │  │ API Routes   │  │ Server       │          │
│  │   (SSR/CSR)  │  │ (/api/*)     │  │ Components   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────┬──────────┬──────────┬──────────┬──────────┬────────────┬──┘
     │          │          │          │          │            │
     ▼          ▼          ▼          ▼          ▼            ▼
┌─────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────┐ ┌──────────┐
│PostgreSQL│ │ SQL    │ │ Gemini │ │ SUNAT  │ │Evolution│ │ Google   │
│(Supabase)│ │ Server │ │ AI API │ │ API    │ │ API     │ │ Services │
│          │ │(Legacy)│ │        │ │        │ │(WhatsApp│ │          │
└─────────┘ └────────┘ └────────┘ └────────┘ └─────────┘ └──────────┘
```

### 2.2 Stack Tecnológico Detallado

#### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- TailwindCSS
- React Hook Form

#### Backend
- Next.js API Routes
- NextAuth.js (autenticación)
- Prisma ORM
- Node.js

#### Base de Datos
- **PostgreSQL (Principal):** Supabase - db.oifpvdrmibxqftnqxmsb.supabase.co
  - Schema: `invoice_system`
  - Schema: `evolution_api` (WhatsApp)
- **SQL Server (Legacy):** Sistema ERP existente
  - Base de datos: `SERVGAL_02`

#### Servicios Externos
- **Google Gemini AI:** Procesamiento OCR de facturas
- **SUNAT API:** Validación de comprobantes electrónicos
- **Evolution API:** Notificaciones WhatsApp (Docker)
- **Google Sheets/Drive:** Respaldo y sincronización (opcional)

### 2.3 Estructura de Carpetas

```
/opt/invoice-system/
├── src/
│   ├── app/                          # Next.js 14 App Router
│   │   ├── admin/                    # Panel de administración
│   │   │   ├── page.tsx              # Configuración del sistema
│   │   │   └── users/                # Gestión de usuarios
│   │   ├── api/                      # API Routes
│   │   │   ├── auth/                 # Autenticación (NextAuth)
│   │   │   ├── invoices/             # CRUD de facturas
│   │   │   ├── rendiciones/          # API de rendiciones
│   │   │   ├── cajas-chicas/         # API de cajas chicas
│   │   │   ├── planillas-movilidad/  # API de planillas
│   │   │   ├── whatsapp/             # API de WhatsApp
│   │   │   ├── webhooks/             # Webhooks externos
│   │   │   └── settings/             # Configuración
│   │   ├── aprobacion-planillas/     # Interfaz de aprobación
│   │   ├── planillas-movilidad/      # Gestión de planillas
│   │   ├── login/                    # Página de login
│   │   ├── select-operation/         # Selector de operación
│   │   ├── page.tsx                  # Dashboard principal
│   │   └── layout.tsx                # Layout raíz
│   ├── components/                   # Componentes React
│   │   ├── InvoiceCard.tsx           # Tarjeta de factura
│   │   ├── MovilidadForm.tsx         # Formulario de planilla
│   │   └── ...
│   ├── services/                     # Servicios backend
│   │   ├── gemini.ts                 # Gemini AI Vision
│   │   ├── sqlserver.ts              # Conexión SQL Server
│   │   ├── sunat.ts                  # Validación SUNAT
│   │   └── whatsapp.ts               # Evolution API
│   ├── lib/                          # Utilidades
│   │   ├── auth.ts                   # Configuración NextAuth
│   │   ├── prisma.ts                 # Cliente Prisma
│   │   └── encryption.ts             # Encriptación
│   └── types/                        # Tipos TypeScript
├── prisma/
│   └── schema.prisma                 # Esquema de base de datos
├── public/                           # Archivos estáticos
├── .env                              # Variables de entorno
├── package.json                      # Dependencias
├── next.config.js                    # Configuración Next.js
└── tsconfig.json                     # Configuración TypeScript
```

---

## 3. Módulos del Sistema

### 3.1 Módulo de Facturas y OCR

#### 3.1.1 Descripción
Sistema de procesamiento automático de facturas electrónicas peruanas usando IA.

#### 3.1.2 Flujo de Procesamiento
1. Usuario sube imagen/PDF de factura
2. Gemini Vision API extrae datos
3. Validación automática con SUNAT (opcional)
4. Almacenamiento en PostgreSQL
5. Asignación a Rendición/Caja Chica

#### 3.1.3 Datos Extraídos
- Tipo de documento (Factura, Boleta, etc.)
- RUC y Razón Social del emisor
- Serie y número de comprobante
- Fecha de emisión
- Subtotal, IGV, Total
- Código QR SUNAT
- Ítems/productos

#### 3.1.4 Archivos Principales
- `/src/app/api/invoices/upload/route.ts` - Upload y procesamiento
- `/src/services/gemini.ts` - Servicio Gemini AI
- `/src/services/sunat.ts` - Validación SUNAT
- `/src/components/InvoiceCard.tsx` - UI de factura

#### 3.1.5 Prompt de Gemini AI
[TODO: Documentar el prompt completo actualizado con soporte para Cajas Chicas y Planillas]

---

### 3.2 Módulo de Rendiciones

#### 3.2.1 Descripción
Gestión de rendiciones de cuentas con sincronización bidireccional SQL Server.

#### 3.2.2 Características
- Consulta de rendiciones pendientes desde SQL Server
- Asignación de facturas a rendiciones
- Actualización automática de montos
- Sincronización en tiempo real

#### 3.2.3 Campos SQL Server
[TODO: Documentar estructura de tabla RendicionCab en SQL Server]

#### 3.2.4 Archivos Principales
- `/src/app/api/rendiciones/route.ts`
- `/src/services/sqlserver.ts`

---

### 3.3 Módulo de Cajas Chicas

#### 3.3.1 Descripción
Administración de cajas chicas con soporte para tickets sin RUC formal.

#### 3.3.2 Características Especiales
- Acepta tickets sin RUC
- Acepta comprobantes sin IGV desglosado
- Validación flexible para gastos menores
- Sincronización con SQL Server

#### 3.3.3 Tipos de Comprobantes Aceptados
- Boletas de venta
- Tickets simples (farmacias, taxis, etc.)
- Recibos sin serie
- Vales internos

#### 3.3.4 Archivos Principales
- `/src/app/api/cajas-chicas/route.ts`
- [TODO: Completar lista de archivos]

---

### 3.4 Módulo de Planillas de Movilidad

#### 3.4.1 Descripción
Sistema completo de gestión de planillas de movilidad con workflow de aprobación.

#### 3.4.2 Estados del Workflow
1. **PENDIENTE_APROBACION** - Recién creada por usuario
2. **APROBADA** - Aprobada por APROBADOR → va a SQL Server
3. **RECHAZADA** - Rechazada con comentarios
4. **ASIGNADA** - Asignada a Rendición o Caja Chica

#### 3.4.3 Estructura de Datos

**Planilla (movilidad_planillas)**
- Datos del trabajador (nombre, DNI, cargo)
- Periodo y fecha de emisión
- Totales (viaje, día, general)
- Estado de aprobación
- Tipo de operación (RENDICION/CAJA_CHICA)

**Gastos (movilidad_gastos)**
- Fecha del gasto
- Origen y destino
- Motivo del viaje
- Montos (viaje, día)

#### 3.4.4 Archivos Principales
- `/src/app/page.tsx` - Dashboard y creación
- `/src/app/planillas-movilidad/[id]/print/page.tsx` - Vista de impresión
- `/src/app/aprobacion-planillas/page.tsx` - Interfaz de aprobación
- `/src/app/api/planillas-movilidad/route.ts` - CRUD básico
- `/src/app/api/planillas-movilidad/[id]/aprobar/route.ts` - Aprobar/Rechazar
- `/src/app/api/planillas-movilidad/[id]/asignar-destino/route.ts` - Asignar destino
- `/src/components/MovilidadForm.tsx` - Formulario de creación

#### 3.4.5 Roles y Permisos
- **USER:** Crear y ver sus propias planillas
- **APROBADOR:** Ver todas, aprobar/rechazar
- **ADMIN/SUPERVISOR:** Ver todas las planillas

---

### 3.5 Módulo de Notificaciones WhatsApp

#### 3.5.1 Descripción
Sistema de notificaciones automáticas usando Evolution API.

#### 3.5.2 Infraestructura
- **Evolution API v2.1.1** en Docker
- Puerto: 8080
- Base de datos: PostgreSQL schema `evolution_api`
- Webhooks para eventos en tiempo real

#### 3.5.3 Tipos de Notificaciones

**1. Planilla Creada → Aprobadores**
```
🚗 Nueva Planilla de Movilidad

📋 Usuario: Christian Palomino
💰 Monto Total: S/ 150.00

⏳ Pendiente de aprobación

👉 Ingresa al sistema para revisar
```

**2. Planilla Aprobada → Usuario**
```
✅ Planilla de Movilidad APROBADA

👤 Aprobada por: Juan Pérez
💰 Monto: S/ 150.00

🎉 Tu planilla ha sido aprobada exitosamente
```

**3. Planilla Rechazada → Usuario**
```
❌ Planilla de Movilidad RECHAZADA

👤 Rechazada por: Juan Pérez
💰 Monto: S/ 150.00
📝 Motivo: Falta sustento de algunos gastos

Por favor, revisa los detalles
```

#### 3.5.4 Configuración
- Campo `phone` en modelo User (formato: 51999999999)
- Números de aprobadores en OrganizationSettings
- Conexión via QR code en panel de admin

#### 3.5.5 Archivos Principales
- `/src/services/whatsapp.ts` - Servicio WhatsApp
- `/src/app/api/whatsapp/connect/route.ts` - Conexión QR
- `/src/app/api/webhooks/whatsapp/route.ts` - Webhook receptor
- `/opt/evolution-api/docker-compose.yml` - Configuración Docker

#### 3.5.6 Docker Compose
[TODO: Documentar configuración completa de docker-compose.yml]

---

## 4. Base de Datos

### 4.1 PostgreSQL (Supabase)

#### 4.1.1 Información de Conexión
- **Host:** db.oifpvdrmibxqftnqxmsb.supabase.co
- **Puerto:** 5432
- **Database:** postgres
- **User:** whatsapp_user
- **Password:** [Encriptado en .env]

#### 4.1.2 Schemas
- `invoice_system` - Datos principales del sistema
- `evolution_api` - Datos de Evolution API (WhatsApp)

#### 4.1.3 Modelos Prisma

**Organization**
[TODO: Documentar campos y relaciones]

**User**
```prisma
model User {
  id             String   @id @default(cuid())
  email          String   @unique
  name           String?
  phone          String?  // WhatsApp (51999999999)
  passwordHash   String?
  role           UserRole @default(USER)
  organizationId String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  active         Boolean  @default(true)
}
```
[TODO: Completar documentación de todos los modelos]

**Invoice**
[TODO: Documentar campos completos]

**MovilidadPlanilla**
[TODO: Documentar campos completos]

**MovilidadGasto**
[TODO: Documentar campos completos]

**OrganizationSettings**
[TODO: Documentar todos los campos de configuración incluyendo WhatsApp]

#### 4.1.4 Enums
```prisma
enum UserRole {
  USER
  ADMIN
  SUPERVISOR
  APROBADOR
  SUPER_ADMIN
  ORG_ADMIN
}

enum EstadoAprobacionMovilidad {
  PENDIENTE_APROBACION
  APROBADA
  RECHAZADA
}
```

### 4.2 SQL Server (Legacy ERP)

#### 4.2.1 Información de Conexión
[TODO: Documentar host, puerto, base de datos]

#### 4.2.2 Tablas Utilizadas

**RendicionCab**
[TODO: Documentar estructura completa]

**CajasChicasCab**
[TODO: Documentar estructura completa]

**MovilidadPlanillaCab**
[TODO: Documentar estructura completa]

---

## 5. API Endpoints

### 5.1 Autenticación
[TODO: Documentar endpoints de NextAuth]

### 5.2 Facturas/Invoices

**POST /api/invoices/upload**
[TODO: Documentar parámetros, respuesta, ejemplo]

**GET /api/invoices**
[TODO: Documentar]

### 5.3 Rendiciones

**GET /api/rendiciones**
[TODO: Documentar]

### 5.4 Cajas Chicas

**GET /api/cajas-chicas**
[TODO: Documentar]

### 5.5 Planillas de Movilidad

**POST /api/planillas-movilidad**
Crea una nueva planilla de movilidad
[TODO: Documentar parámetros completos, ejemplo de request/response]

**POST /api/planillas-movilidad/[id]/aprobar**
Aprueba o rechaza una planilla
[TODO: Documentar]

**GET /api/planillas-movilidad/pendientes**
Obtiene planillas pendientes de aprobación
[TODO: Documentar]

### 5.6 WhatsApp

**POST /api/whatsapp/connect**
Genera QR code para conectar WhatsApp
[TODO: Documentar]

**GET /api/whatsapp/connect**
Obtiene estado de conexión WhatsApp
[TODO: Documentar]

**POST /api/webhooks/whatsapp**
Webhook para eventos de Evolution API
[TODO: Documentar eventos]

---

## 6. Servicios e Integraciones

### 6.1 Google Gemini AI

#### Configuración
[TODO: Documentar API key, modelos disponibles, límites]

#### Prompt Completo
[TODO: Copiar prompt completo actualizado de gemini.ts]

### 6.2 SUNAT API

[TODO: Documentar integración con SUNAT]

### 6.3 Evolution API (WhatsApp)

[TODO: Documentar configuración completa, webhooks, eventos]

### 6.4 Google Services

[TODO: Documentar Sheets, Drive si aplica]

---

## 7. Configuración y Despliegue

### 7.1 Variables de Entorno

```bash
# Base de Datos
POSTGRES_USER=whatsapp_user
POSTGRES_PASSWORD=azaleia_pg_2025_secure
DATABASE_URL=postgresql://...

# NextAuth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://cockpit.azaleia.com.pe

# Gemini AI
GEMINI_API_KEY=...

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=B6D711FCDE4D4FD5936544120E713976

# [TODO: Completar todas las variables]
```

### 7.2 PM2 Configuration

```bash
pm2 start npm --name "invoice-system" -- start
pm2 save
pm2 startup
```

### 7.3 Nginx Configuration

[TODO: Documentar configuración de nginx]

### 7.4 Docker Services

**Evolution API**
```bash
cd /opt/evolution-api
docker-compose up -d
```

---

## 8. Flujos de Usuario

### 8.1 Flujo: Crear Planilla de Movilidad (USER)

1. Usuario hace login
2. Selecciona "PLANILLA_MOVILIDAD" en select-operation
3. Dashboard principal → Botón "+"
4. Completa formulario MovilidadForm
5. Agrega gastos (fecha, origen, destino, monto)
6. Selecciona tipo de operación (RENDICION/CAJA_CHICA)
7. Si selecciona, muestra dropdown con opciones disponibles
8. Click "Guardar Planilla"
9. Sistema crea planilla con estado PENDIENTE_APROBACION
10. **Notificación WhatsApp** enviada a aprobadores
11. Usuario ve planilla en "Mis Planillas"

### 8.2 Flujo: Aprobar Planilla (APROBADOR)

[TODO: Documentar flujo completo]

### 8.3 Flujo: Procesar Factura

[TODO: Documentar flujo completo]

---

## 9. Seguridad y Autenticación

### 9.1 NextAuth.js

[TODO: Documentar configuración de sesiones, providers]

### 9.2 Roles y Permisos

[TODO: Documentar permisos por rol]

### 9.3 Encriptación

[TODO: Documentar lib/encryption.ts]

---

## 10. Guías de Uso

### 10.1 Para Usuarios

[TODO: Crear guía paso a paso]

### 10.2 Para Aprobadores

[TODO: Crear guía paso a paso]

### 10.3 Para Administradores

[TODO: Crear guía paso a paso]

#### Conectar WhatsApp
1. Login como ADMIN
2. Ir a Configuración (/admin)
3. Click en tab "💬 WhatsApp"
4. Click "Generar Código QR"
5. Escanear con WhatsApp → Dispositivos vinculados
6. Esperar mensaje "✅ Conectado"
7. Ingresar números de aprobadores (51999999999,51888888888)
8. Activar toggle "Activar notificaciones WhatsApp"
9. Seleccionar qué eventos notificar
10. Guardar configuración

---

## 📝 Notas para Completar

Esta documentación está estructurada pero incompleta. Debes:

1. ✅ Completar todos los [TODO]
2. ✅ Agregar ejemplos de código real
3. ✅ Incluir capturas de pantalla de UI
4. ✅ Documentar todos los campos de base de datos
5. ✅ Documentar todos los endpoints con ejemplos
6. ✅ Crear diagramas de flujo visuales
7. ✅ Incluir casos de uso reales
8. ✅ Documentar troubleshooting común
9. ✅ Agregar guías de mantenimiento
10. ✅ Incluir información de respaldo y recuperación

---

## 🔗 Enlaces Útiles

- **Sistema en Producción:** https://cockpit.azaleia.com.pe
- **Documentación Next.js:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Evolution API Docs:** https://doc.evolution-api.com
- **Gemini AI Docs:** https://ai.google.dev/docs

---

**Fin de la Documentación**

*Última actualización: 2025-11-19*
*Versión: 1.0.0 (Estructura Base)*
