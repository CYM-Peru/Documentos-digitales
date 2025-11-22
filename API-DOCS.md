# 📖 Documentación API REST - Sistema de Facturas Azaleia

API REST para integrar sistemas externos con el sistema de procesamiento de facturas con IA.

## 🔐 Autenticación

Todas las peticiones requieren una **API Key** en el header:

```
X-API-Key: az_tu_api_key_aqui_64_caracteres_hex
```

### Generar una API Key

```bash
npx tsx generate-api-key.ts
```

Esto te dará una API Key que expira en 1 año.

---

## 📡 Endpoints Disponibles

### 1. **Listar Facturas**

Obtiene todas las facturas procesadas de tu organización.

**Request:**
```http
GET /api/public/invoices
Host: cockpit.azaleia.com.pe
X-API-Key: az_tu_api_key_aqui
```

**Parámetros de Query (opcionales):**

| Parámetro | Tipo | Descripción | Ejemplo |
|-----------|------|-------------|---------|
| `page` | integer | Número de página (default: 1) | `?page=2` |
| `limit` | integer | Resultados por página (max: 100, default: 50) | `?limit=20` |
| `status` | string | Filtrar por estado: `COMPLETED`, `PROCESSING`, `FAILED` | `?status=COMPLETED` |
| `startDate` | string | Fecha inicial (YYYY-MM-DD) | `?startDate=2025-11-01` |
| `endDate` | string | Fecha final (YYYY-MM-DD) | `?endDate=2025-11-30` |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "clxyz123abc",
      "status": "COMPLETED",
      "createdAt": "2025-11-03T15:30:00.000Z",
      "updatedAt": "2025-11-03T15:30:05.000Z",

      // DATOS DEL COMPROBANTE
      "documentType": "FACTURA ELECTRÓNICA",
      "documentTypeCode": "01",
      "serieNumero": "F001-00012345",
      "invoiceDate": "2025-11-02T00:00:00.000Z",

      // DATOS DEL EMISOR
      "rucEmisor": "20123456789",
      "razonSocialEmisor": "EMPRESA S.A.C.",
      "domicilioFiscalEmisor": "Av. Principal 123, Lima, Perú",

      // DATOS DEL RECEPTOR
      "rucReceptor": "20609042148",
      "dniReceptor": null,
      "razonSocialReceptor": "AZALEIA PERU S.A.C.",

      // MONTOS
      "subtotal": 100.00,
      "igvTasa": 18.0,
      "igvMonto": 18.00,
      "totalAmount": 118.00,
      "currency": "PEN",

      // VERIFICACIÓN SUNAT
      "sunatVerified": true,
      "sunatEstadoCp": "1",
      "sunatEstadoRuc": "00",
      "sunatObservaciones": [],
      "sunatVerifiedAt": "2025-11-03T15:30:05.000Z",

      // METADATA
      "imageUrl": "/uploads/org123/1730645400000-factura.jpg",
      "imageName": "factura.jpg",
      "googleSheetsRowId": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 245,
    "totalPages": 5
  },
  "_meta": {
    "timestamp": "2025-11-03T15:45:00.000Z",
    "apiVersion": "1.0"
  }
}
```

**Ejemplo con cURL:**
```bash
curl -H "X-API-Key: az_1234567890abcdef..." \
     "https://cockpit.azaleia.com.pe/api/public/invoices?page=1&limit=10&status=COMPLETED"
```

**Ejemplo con JavaScript/Node.js:**
```javascript
const response = await fetch('https://cockpit.azaleia.com.pe/api/public/invoices', {
  headers: {
    'X-API-Key': 'az_tu_api_key_aqui'
  }
});

const data = await response.json();
console.log(data.data); // Array de facturas
```

**Ejemplo con Python:**
```python
import requests

headers = {
    'X-API-Key': 'az_tu_api_key_aqui'
}

response = requests.get(
    'https://cockpit.azaleia.com.pe/api/public/invoices',
    headers=headers
)

data = response.json()
for invoice in data['data']:
    print(f"{invoice['serieNumero']} - S/ {invoice['totalAmount']}")
```

---

### 2. **Obtener Factura por ID**

Obtiene los datos completos de una factura específica.

**Request:**
```http
GET /api/public/invoices/{invoice_id}
Host: cockpit.azaleia.com.pe
X-API-Key: az_tu_api_key_aqui
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "clxyz123abc",
    "status": "COMPLETED",
    "errorMessage": null,

    // DATOS COMPLETOS (incluye TODO lo de arriba + más detalles)
    "ocrData": {
      // JSON completo de lo que extrajo la IA
    },
    "user": {
      "name": "Usuario Admin",
      "email": "admin@azaleia.com.pe"
    },
    "imageSize": 245632,
    "n8nExecutionId": null,

    // ... todos los demás campos
  },
  "_meta": {
    "timestamp": "2025-11-03T15:45:00.000Z",
    "apiVersion": "1.0"
  }
}
```

**Ejemplo con cURL:**
```bash
curl -H "X-API-Key: az_1234567890abcdef..." \
     https://cockpit.azaleia.com.pe/api/public/invoices/clxyz123abc
```

---

## ❌ Códigos de Error

| Código | Significado |
|--------|-------------|
| `401` | API Key faltante, inválida o expirada |
| `404` | Factura no encontrada |
| `500` | Error interno del servidor |

**Ejemplo de Error:**
```json
{
  "error": "API Key requerida. Usa el header: X-API-Key"
}
```

---

## 📊 Estados de Facturas

| Estado | Descripción |
|--------|-------------|
| `PENDING` | Factura cargada, esperando procesamiento |
| `PROCESSING` | IA analizando la imagen |
| `COMPLETED` | Procesamiento completo con éxito |
| `FAILED` | Error al procesar |

---

## 🔐 Códigos de Verificación SUNAT

### Estado del Comprobante (`sunatEstadoCp`)

| Código | Significado |
|--------|-------------|
| `1` | ✅ Válido y activo en SUNAT |
| `0` | ❌ No existe en SUNAT |
| `2` | ⚠️ Anulado por el emisor |
| `3` | 🚫 Rechazado por SUNAT |

### Estado del RUC (`sunatEstadoRuc`)

| Código | Significado |
|--------|-------------|
| `00` | ✅ Activo |
| `01` | ⚠️ Baja provisional |
| `02` | ❌ Baja definitiva |
| `03` | ❌ Baja de oficio |

---

## 💡 Casos de Uso

### 1. **Sincronizar facturas cada hora**
```javascript
// Cron job que se ejecuta cada hora
setInterval(async () => {
  const lastSync = localStorage.getItem('lastSync') || '2025-11-01';

  const response = await fetch(
    `https://cockpit.azaleia.com.pe/api/public/invoices?startDate=${lastSync}`,
    { headers: { 'X-API-Key': 'az_...' } }
  );

  const { data } = await response.json();

  // Procesar facturas nuevas
  data.forEach(invoice => {
    guardarEnMiSistema(invoice);
  });

  localStorage.setItem('lastSync', new Date().toISOString().split('T')[0]);
}, 3600000); // 1 hora
```

### 2. **Validar facturas solo verificadas por SUNAT**
```bash
curl -H "X-API-Key: az_..." \
     "https://cockpit.azaleia.com.pe/api/public/invoices?status=COMPLETED" \
     | jq '.data[] | select(.sunatVerified == true)'
```

### 3. **Exportar a tu ERP**
```python
# Script para importar a tu sistema ERP
import requests
import json

API_KEY = 'az_tu_api_key_aqui'
headers = {'X-API-Key': API_KEY}

# Obtener facturas del mes
response = requests.get(
    'https://cockpit.azaleia.com.pe/api/public/invoices',
    params={'startDate': '2025-11-01', 'endDate': '2025-11-30'},
    headers=headers
)

facturas = response.json()['data']

for factura in facturas:
    # Solo facturas verificadas por SUNAT
    if factura.get('sunatVerified'):
        mi_erp.importar_factura({
            'ruc_proveedor': factura['rucEmisor'],
            'razon_social': factura['razonSocialEmisor'],
            'serie_numero': factura['serieNumero'],
            'subtotal': factura['subtotal'],
            'igv': factura['igvMonto'],
            'total': factura['totalAmount']
        })
```

---

## 🔒 Seguridad

- ✅ API Keys encriptadas en base de datos
- ✅ Validación de expiración automática
- ✅ Rate limiting (máximo 100 resultados por petición)
- ✅ Solo acceso a datos de tu organización
- ✅ HTTPS obligatorio en producción

---

## 📞 Soporte

¿Necesitas ayuda con la integración?
- Email: soporte@azaleia.com.pe
- Sistema: http://cockpit.azaleia.com.pe

---

**Versión API:** 1.0
**Última actualización:** 2025-11-03
