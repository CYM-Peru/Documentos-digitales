# 📖 Guía para Completar la Documentación

## 🎯 Objetivo
Documentar completamente el sistema Azaleia Invoice & Movilidad de forma exhaustiva y profesional.

---

## 🚀 Pasos para Documentar (En Casa)

### Paso 1: Generar Información Automática (5 minutos)

```bash
# Conéctate al servidor
ssh root@147.93.10.141

# Ejecuta el script generador
cd /opt/invoice-system
bash scripts/generate-docs-info.sh

# Descarga los archivos generados a tu máquina local
# Desde tu máquina local:
scp -r root@147.93.10.141:/opt/invoice-system/docs-data ./docs-data-azaleia
```

Esto generará:
- ✅ Lista de tablas de base de datos
- ✅ Schema completo de Prisma
- ✅ Lista de variables de entorno
- ✅ Todos los API endpoints
- ✅ Estructura de carpetas
- ✅ Dependencias del proyecto
- ✅ Estado de servicios (PM2, Docker)
- ✅ Estadísticas de código

---

### Paso 2: Completar Secciones del DOCUMENTATION.md (2-3 horas)

Abre el archivo `/opt/invoice-system/DOCUMENTATION.md` y busca todos los `[TODO]`.

#### 2.1 Base de Datos (30 minutos)

**Usa:** `docs-data/db-tables.txt` y `docs-data/prisma-schema.prisma`

Para cada modelo en Prisma, documenta:
```markdown
**Invoice**
- id: UUID único
- organizationId: FK a Organization
- userId: FK a User (quien subió)
- documentType: Tipo de documento (FACTURA, BOLETA, etc.)
- rucEmisor: RUC del emisor (11 dígitos)
- razonSocialEmisor: Nombre/razón social
- serieNumero: Serie-número completo (F001-00012345)
- invoiceDate: Fecha de emisión
- subtotal: Base imponible sin IGV
- igvMonto: Monto del IGV
- totalAmount: Total con IGV
- currency: PEN o USD
- status: PENDING, PROCESSING, COMPLETED, FAILED
- sunatVerified: Boolean - validado con SUNAT
- imageUrl: URL de la imagen original
- ocrData: JSON con datos extraídos por Gemini
- createdAt, updatedAt: Timestamps
```

Haz lo mismo para TODOS los modelos:
- Organization
- User
- OrganizationSettings (¡importante! tiene muchos campos)
- Invoice
- MovilidadPlanilla
- MovilidadGasto

#### 2.2 API Endpoints (1 hora)

**Usa:** `docs-data/api-endpoints.txt`

Para CADA endpoint, documenta:

```markdown
### POST /api/planillas-movilidad

**Descripción:** Crea una nueva planilla de movilidad

**Autenticación:** Requerida (NextAuth session)

**Roles permitidos:** USER, ADMIN, SUPERVISOR

**Request Body:**
\`\`\`json
{
  "nombresApellidos": "Juan Pérez",
  "cargo": "Vendedor",
  "dni": "12345678",
  "centroCosto": "CC-VENTAS-01",
  "periodo": "Noviembre 2025",
  "fechaEmision": "2025-11-19",
  "tipoOperacion": "RENDICION",
  "nroRendicion": "R-2025-001",
  "gastos": [
    {
      "dia": 1,
      "mes": 11,
      "anio": 2025,
      "fechaGasto": "2025-11-01",
      "motivo": "Visita a cliente",
      "origen": "Oficina Lima",
      "destino": "Cliente ABC - Miraflores",
      "montoViaje": 15.00,
      "montoDia": 25.00
    }
  ],
  "totalViaje": 15.00,
  "totalDia": 25.00,
  "totalGeneral": 40.00
}
\`\`\`

**Response (200 OK):**
\`\`\`json
{
  "success": true,
  "message": "Planilla de movilidad guardada exitosamente. Pendiente de aprobación.",
  "planilla": {
    "id": "cm3qzx...",
    "estadoAprobacion": "PENDIENTE_APROBACION",
    // ... otros campos
  },
  "gastosCreados": 1
}
\`\`\`

**Comportamiento adicional:**
- Estado inicial: PENDIENTE_APROBACION
- Si WhatsApp está activado → envía notificación a aprobadores
- Almacena en PostgreSQL (NO en SQL Server hasta aprobación)

**Errores:**
- 401: No autenticado
- 400: Datos requeridos faltantes (nombre, cargo, DNI)
- 500: Error del servidor
```

Haz esto para TODOS los endpoints principales.

#### 2.3 Flujos de Usuario (45 minutos)

Para cada flujo, crea un diagrama de texto:

```markdown
### Flujo: Crear y Aprobar Planilla de Movilidad

\`\`\`
┌─────────┐
│  USER   │
└────┬────┘
     │
     │ 1. Login (NextAuth)
     ▼
┌─────────────────────────┐
│  SELECT OPERATION       │
│  Selecciona:            │
│  PLANILLA_MOVILIDAD     │
└────────┬────────────────┘
         │
         │ 2. Click "+"
         ▼
┌─────────────────────────┐
│  FORMULARIO MOVILIDAD   │
│  - Datos trabajador     │
│  - Agregar gastos       │
│  - Seleccionar destino  │
└────────┬────────────────┘
         │
         │ 3. POST /api/planillas-movilidad
         ▼
┌─────────────────────────┐
│  POSTGRESQL             │
│  estado: PENDIENTE      │
└────────┬────────────────┘
         │
         │ 4. Notificación WhatsApp
         ▼
┌─────────────────────────┐
│  APROBADOR              │
│  Recibe mensaje WSP     │
└────────┬────────────────┘
         │
         │ 5. Login como APROBADOR
         ▼
┌─────────────────────────┐
│  APROBACION-PLANILLAS   │
│  Ve planillas pendientes│
└────────┬────────────────┘
         │
         │ 6a. Aprobar ─────┐   6b. Rechazar ──┐
         ▼                  │                   │
┌───────────────────┐      │   ┌───────────────▼────────┐
│ estado: APROBADA  │      │   │ estado: RECHAZADA      │
│ Se guarda en SQL  │      │   │ Con comentarios        │
│ Server            │      │   └───────────┬────────────┘
└─────┬─────────────┘      │               │
      │                    │               │
      │ 7a. Notif WSP      │               │ 7b. Notif WSP
      │ → Usuario          │               │ → Usuario
      │ "APROBADA"         │               │ "RECHAZADA"
      ▼                    │               ▼
┌────────────────┐         │        ┌────────────────┐
│ SQL SERVER     │         │        │ USER recibe    │
│ Tabla:         │         │        │ notificación   │
│ MovPlanillaCab │         │        │ + motivo       │
└────────────────┘         │        └────────────────┘
                           │
                           ▼
                    [FIN DEL FLUJO]
\`\`\`
```

Crea flujos para:
- ✅ Crear planilla de movilidad completo
- ✅ Procesar factura con OCR
- ✅ Asignar factura a rendición
- ✅ Asignar factura a caja chica
- ✅ Conectar WhatsApp (QR flow)

#### 2.4 Servicios e Integraciones (30 minutos)

**2.4.1 Gemini AI**

Copia el prompt COMPLETO de `/src/services/gemini.ts`:
- El prompt defaultPrompt completo (líneas 49-289 aproximadamente)
- Explica cada sección del prompt
- Incluye ejemplos de respuestas

**2.4.2 Evolution API**

Usa: `docs-data/evolution-docker-compose.yml`

Documenta:
- Variables de entorno
- Webhook URL configurada
- Eventos que escucha
- Cómo funciona el QR code flow

**2.4.3 SQL Server**

Conéctate y extrae estructura:
```sql
-- En SQL Server
SELECT
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('RendicionCab', 'CajasChicasCab', 'MovPlanillaCab')
ORDER BY TABLE_NAME, ORDINAL_POSITION
```

Documenta campos importantes.

#### 2.5 Configuración y Despliegue (20 minutos)

**Usa:**
- `docs-data/env-variables.txt`
- `docs-data/pm2-status.txt`
- `docs-data/nginx-config.txt`
- `docs-data/system-info.txt`

Documenta:
- Todas las variables de entorno (sin valores secretos)
- Comandos de PM2 para reiniciar
- Configuración de Nginx completa
- Configuración de SSL/TLS
- Puertos usados

---

### Paso 3: Agregar Diagramas Visuales (30 minutos)

Usa herramientas online como:
- https://excalidraw.com (diagramas)
- https://mermaid.live (diagramas de flujo)
- https://dbdiagram.io (diagramas de base de datos)

Crea:
1. **Diagrama de Arquitectura** completo con todos los servicios
2. **Diagrama de Base de Datos** (ERD) con relaciones
3. **Diagrama de Flujo** para cada proceso principal

Exporta como imágenes y súbelas a `/opt/invoice-system/docs/images/`

---

### Paso 4: Capturas de Pantalla (20 minutos)

Toma capturas de:
- Dashboard principal (vista USER)
- Formulario de planilla de movilidad
- Vista de aprobación (APROBADOR)
- Panel de admin - tab WhatsApp
- QR code de WhatsApp
- Modal de "Mis Planillas"
- Vista de impresión de planilla

Organiza en `/opt/invoice-system/docs/screenshots/`

---

### Paso 5: Troubleshooting y FAQ (15 minutos)

Agrega sección al final de DOCUMENTATION.md:

```markdown
## 11. Troubleshooting

### Q: El servicio Next.js no inicia
**A:** Verifica logs:
\`\`\`bash
pm2 logs invoice-system --lines 50
\`\`\`

### Q: Evolution API no responde
**A:** Reinicia el contenedor:
\`\`\`bash
docker restart evolution-api
docker logs evolution-api --tail 50
\`\`\`

### Q: No llegan notificaciones WhatsApp
**A:** Verifica:
1. WhatsApp está conectado: /admin → tab WhatsApp
2. whatsappEnabled = true en settings
3. Números de aprobadores configurados
4. Usuario tiene campo phone lleno
5. Revisa logs: \`pm2 logs invoice-system | grep WhatsApp\`

[Agrega más Q&A según experiencia]
```

---

### Paso 6: Crear README.md Principal (10 minutos)

Crea un README.md simple en la raíz:

```markdown
# 🏢 Sistema Azaleia - Invoice & Movilidad

Sistema integral de gestión de documentos contables y gastos.

## 🚀 Quick Start

\`\`\`bash
# Clonar repositorio (si aplica)
git clone ...

# Instalar dependencias
npm install

# Configurar .env
cp .env.example .env
# Editar .env con tus credenciales

# Generar Prisma Client
npx prisma generate

# Build
npm run build

# Iniciar con PM2
pm2 start npm --name "invoice-system" -- start
\`\`\`

## 📚 Documentación Completa

Ver [DOCUMENTATION.md](./DOCUMENTATION.md) para documentación exhaustiva.

## 🛠️ Stack Tecnológico

- Next.js 14
- PostgreSQL + Prisma
- Google Gemini AI
- Evolution API (WhatsApp)
- TypeScript + TailwindCSS

## 📞 Contacto

Christian Palomino - Azaleia Perú
```

---

## ✅ Checklist Final

Antes de dar por terminada la documentación:

- [ ] Todos los [TODO] completados
- [ ] Todos los modelos de Prisma documentados
- [ ] Todos los API endpoints documentados con ejemplos
- [ ] Todos los flujos de usuario diagramados
- [ ] Variables de entorno documentadas (sin secretos)
- [ ] Servicios externos documentados (Gemini, SUNAT, WhatsApp)
- [ ] Configuración de despliegue completa
- [ ] Diagramas visuales agregados
- [ ] Capturas de pantalla incluidas
- [ ] Sección de troubleshooting completa
- [ ] README.md principal creado
- [ ] Código comentado en archivos principales
- [ ] Guías de uso por rol completadas

---

## 📦 Archivos Finales

Tu proyecto debe quedar así:

```
/opt/invoice-system/
├── DOCUMENTATION.md          ← Documentación principal (completa)
├── DOCUMENTATION-GUIDE.md    ← Esta guía
├── README.md                 ← README simple
├── docs/
│   ├── images/              ← Diagramas visuales
│   │   ├── architecture.png
│   │   ├── database-erd.png
│   │   └── flows/
│   └── screenshots/         ← Capturas de pantalla
│       ├── dashboard.png
│       ├── planilla-form.png
│       └── ...
├── docs-data/               ← Datos generados automáticamente
│   ├── db-tables.txt
│   ├── api-endpoints.txt
│   └── ...
└── [resto del proyecto]
```

---

## 💡 Tips

1. **Usa herramientas de IA** para ayudarte a generar documentación técnica
2. **Sé específico** en ejemplos de código y respuestas JSON
3. **Incluye casos edge** y cómo manejarlos
4. **Documenta errores comunes** que has encontrado
5. **Mantén formato consistente** en toda la documentación
6. **Actualiza la fecha** al terminar cada sección

---

## 🎯 Tiempo Estimado Total: 3-4 horas

- Generación automática: 5 min
- Secciones principales: 2-3 horas
- Diagramas y capturas: 50 min
- Revisión final: 15 min

---

**¡Buena suerte con la documentación! 📚✨**

*Recuerda: Una buena documentación es el mejor regalo que puedes hacer a tu yo del futuro.*
