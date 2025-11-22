# 🗄️ Integración SQL Server - Sistema de Facturas

## ✅ Estado: IMPLEMENTADO

La integración con SQL Server ha sido completada exitosamente. Ahora el sistema puede enviar facturas procesadas tanto a **Google Sheets** como a **SQL Server** simultáneamente.

---

## 📊 Tabla Destino

```sql
[AzaleiaPeru].[dbo].[CntCtaRendicionDocumentosIA]
```

### Estructura de Columnas

| Columna | Tipo | Descripción |
|---------|------|-------------|
| ID | NVARCHAR(50) | ID único de la factura |
| Fecha | DATETIME | Fecha de emisión |
| Estado | NVARCHAR(50) | COMPLETED, PENDING, FAILED |
| RUC Emisor | NVARCHAR(11) | RUC del emisor |
| Razón Social Emisor | NVARCHAR(500) | Razón social del emisor |
| Serie-Número | NVARCHAR(50) | Serie y número (F001-00012345) |
| Tipo Documento | NVARCHAR(100) | FACTURA ELECTRÓNICA, BOLETA, etc |
| Cantidad Items | INT | Número de items (actualmente siempre 1) |
| Item # | INT | Número de item (actualmente siempre 1) |
| Cantidad | DECIMAL(18,3) | Cantidad del producto (NULL por ahora) |
| Descripción Producto | NVARCHAR(500) | Descripción (NULL por ahora) |
| Código Producto | NVARCHAR(100) | Código producto (NULL por ahora) |
| Precio Unitario | DECIMAL(18,2) | Precio unitario (NULL por ahora) |
| Total Item | DECIMAL(18,2) | Total del item (NULL por ahora) |
| Subtotal Factura | DECIMAL(18,2) | Subtotal sin IGV |
| IGV | DECIMAL(18,2) | Monto del IGV |
| Total Factura | DECIMAL(18,2) | Total con IGV |
| Moneda | NVARCHAR(10) | PEN, USD |
| SUNAT Verificado | NVARCHAR(20) | SI, NO, PENDIENTE |
| Estado SUNAT | NVARCHAR(50) | VÁLIDO, NO EXISTE, ANULADO, RECHAZADO |

---

## 🚀 Configuración Rápida

### Paso 1: Editar Credenciales

Edita el archivo `scripts/configure-sql-server.ts`:

```typescript
const config = {
  organizationSlug: 'azaleia', // Tu organización
  sqlServerEnabled: true,
  sqlServerHost: 'azaleia-sql.database.windows.net', // Tu servidor
  sqlServerPort: 1433,
  sqlServerDatabase: 'AzaleiaPeru',
  sqlServerUser: 'tu_usuario',
  sqlServerPassword: 'tu_password',
  sqlServerEncrypt: true, // true para Azure SQL
  sqlServerTrustCert: false,
}
```

### Paso 2: Ejecutar Configuración

```bash
cd /opt/invoice-system
npx tsx scripts/configure-sql-server.ts
```

### Paso 3: Probar Conexión (Opcional)

```bash
# Edita scripts/test-sql-server.ts con tus credenciales
npx tsx scripts/test-sql-server.ts
```

---

## 🔧 Archivos Modificados/Creados

### Nuevos Archivos
- ✅ `src/services/sqlserver.ts` - Servicio SQL Server
- ✅ `scripts/test-sql-server.ts` - Script de prueba
- ✅ `scripts/configure-sql-server.ts` - Script de configuración

### Archivos Modificados
- ✅ `prisma/schema.prisma` - Agregados campos SQL Server
- ✅ `src/app/api/invoices/upload/route.ts` - Integrado envío a SQL Server
- ✅ `package.json` - Agregada dependencia `mssql`

### Nuevas Dependencias
```json
{
  "dependencies": {
    "mssql": "^11.0.1"
  },
  "devDependencies": {
    "@types/mssql": "^9.1.5"
  }
}
```

---

## 📋 Campos de Base de Datos (Prisma)

```prisma
// SQL Server Integration (encrypted)
sqlServerEnabled Boolean @default(false)
sqlServerHost    String? // Encrypted
sqlServerPort    Int?    @default(1433)
sqlServerDatabase String?
sqlServerUser    String? // Encrypted
sqlServerPassword String? // Encrypted
sqlServerEncrypt Boolean @default(true)
sqlServerTrustCert Boolean @default(false)
```

---

## 🔐 Seguridad

- ✅ Credenciales encriptadas con AES (ENCRYPTION_KEY)
- ✅ Host encriptado
- ✅ Usuario encriptado
- ✅ Password encriptado
- ✅ Soporte para SSL/TLS (Azure SQL)

---

## 🎯 Flujo de Procesamiento

```
1. Usuario sube factura
   ↓
2. Gemini AI extrae datos
   ↓
3. SUNAT valida comprobante (si está habilitado)
   ↓
4. SUNAT consulta RUC emisor (si está habilitado)
   ↓
5. Detección de duplicados (QR + RUC+Serie)
   ↓
6. Envío a Google Sheets (si está configurado)
   ↓
7. 🆕 Envío a SQL Server (si está configurado)  ← NUEVO
   ↓
8. Envío a n8n webhook (si está configurado)
```

---

## ⚙️ Características Implementadas

### ✅ Conexión Pooling
- Pool de conexiones reutilizable
- Timeout configurable (30 segundos)
- Cierre automático de conexiones

### ✅ Manejo de Errores
- No falla el proceso completo si SQL Server falla
- Logs detallados de errores
- Reintentos automáticos en pool

### ✅ Mapeo de Estados SUNAT
```typescript
sunatVerified: boolean → 'SI' | 'NO' | 'PENDIENTE'
estadoCp: '0' | '1' | '2' | '3' → 'NO EXISTE' | 'VÁLIDO' | 'ANULADO' | 'RECHAZADO'
```

### ✅ Soporte para Items Futuros
El servicio ya está preparado para cuando el OCR extraiga items individuales:
```typescript
items?: Array<{
  itemNumber: number
  cantidad: number
  descripcion: string
  codigoProducto?: string
  precioUnitario: number
  totalItem: number
}>
```

---

## 🧪 Testing

### Prueba de Conexión
```bash
npx tsx scripts/test-sql-server.ts
```

**Pruebas incluidas:**
1. ✅ Crear servicio
2. ✅ Probar conexión
3. ✅ Insertar factura
4. ✅ Verificar existencia
5. ✅ Actualizar factura
6. ✅ Obtener estadísticas

### Prueba Real con Factura
1. Sube una factura desde la UI: http://cockpit.azaleia.com.pe
2. Verifica los logs de PM2:
   ```bash
   pm2 logs invoice-system --lines 50
   ```
3. Busca los logs:
   ```
   🗄️ Iniciando envío a SQL Server...
   ✅ SQL Server - 1 fila(s) insertada(s) correctamente
   ```

---

## 📊 Verificación en SQL Server

```sql
-- Ver últimas facturas insertadas
SELECT TOP 10 *
FROM [AzaleiaPeru].[dbo].[CntCtaRendicionDocumentosIA]
ORDER BY [Fecha] DESC

-- Contar facturas por estado SUNAT
SELECT
    [Estado SUNAT],
    COUNT(*) as Total
FROM [AzaleiaPeru].[dbo].[CntCtaRendicionDocumentosIA]
GROUP BY [Estado SUNAT]

-- Facturas verificadas por SUNAT
SELECT *
FROM [AzaleiaPeru].[dbo].[CntCtaRendicionDocumentosIA]
WHERE [SUNAT Verificado] = 'SI'
AND [Estado SUNAT] = 'VÁLIDO'
```

---

## 🐛 Troubleshooting

### Error: "Login failed for user"
- Verifica usuario y contraseña en `configure-sql-server.ts`
- Verifica que el usuario tenga permisos en la base de datos

### Error: "Could not connect to server"
- Verifica el nombre del servidor
- Verifica que el firewall permita conexiones desde tu IP
- Para Azure SQL: Agrega tu IP en el firewall de Azure

### Error: "Connection timeout"
- Verifica conectividad de red
- Aumenta el timeout en `sqlserver.ts` (línea ~47)

### Logs de Debugging
```bash
# Ver logs en tiempo real
pm2 logs invoice-system --lines 100

# Ver solo errores
pm2 logs invoice-system --err

# Ver logs de últimas 24 horas
pm2 logs invoice-system --timestamp
```

---

## 📝 Notas Importantes

### Items Individuales (Futuro)
Actualmente el OCR no extrae items individuales de productos. Por ahora:
- Se inserta **1 fila por factura** con campos generales
- Campos de items quedan en NULL
- `Cantidad Items = 1`, `Item # = 1`

Cuando se implemente extracción de items:
- Se insertarán **múltiples filas por factura** (una por item)
- Los campos de factura se repetirán en cada fila
- Los campos de items se llenarán con datos reales

### Duplicados
Si una factura es detectada como duplicada:
- **NO se valida en SUNAT** (ahorro de llamadas API)
- **NO se consulta el RUC** (ya se hizo en la original)
- **SÍ se envía a SQL Server** (para registro)

### Encriptación
Las credenciales se encriptan usando la `ENCRYPTION_KEY` del `.env`:
```bash
# .env
ENCRYPTION_KEY=tu_clave_de_32_caracteres_minimo
```

⚠️ **IMPORTANTE**: Si cambias la `ENCRYPTION_KEY`, deberás reconfigurar SQL Server.

---

## 🎉 ¡Listo!

El sistema ahora envía automáticamente las facturas a:
- ✅ Google Sheets (si está configurado)
- ✅ SQL Server (si está configurado)
- ✅ n8n Webhook (si está configurado)

Todo funciona en **paralelo** y de forma **no bloqueante**. Si alguna integración falla, las demás continúan normalmente.

---

## 📞 Soporte

Para más información:
- Documentación API: `/opt/invoice-system/API-DOCS.md`
- Logs del sistema: `pm2 logs invoice-system`
- Repositorio: `/opt/invoice-system`

**Versión**: 1.1.0
**Última actualización**: 2025-11-11
