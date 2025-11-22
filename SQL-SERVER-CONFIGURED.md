# ✅ SQL Server Configurado - Azaleia

## 🎉 Estado: FUNCIONANDO CORRECTAMENTE

La integración con SQL Server está **activa y funcionando**.

---

## 📊 Configuración Actual

```yaml
Servidor:     190.119.245.254
Puerto:       1433
Base de Datos: AzaleiaPeru
Usuario:      cpalomino
Tabla:        [dbo].[CntCtaRendicionDocumentosIA]
Estado:       ✅ HABILITADO
SSL/TLS:      Deshabilitado (SQL Server local)
```

---

## 🧪 Resultados de Pruebas (2025-11-11)

### Test de Conexión
```
✅ Conexión exitosa a 190.119.245.254:1433
✅ Acceso a base de datos AzaleiaPeru
✅ Pool de conexiones creado correctamente
```

### Test de Inserción
```
✅ Factura de prueba insertada correctamente
✅ Verificación de existencia: OK
✅ Mapeo de campos SUNAT: OK
```

### Estadísticas Actuales
```
Total Facturas:     8
Total Items:        8
Monto Acumulado:    S/ 413.56
Verificadas SUNAT:  3 facturas
Válidas:            3 facturas
```

---

## 🚀 Flujo Automático Configurado

Cuando proceses una nueva factura:

```
1. 📸 Usuario sube imagen
   ↓
2. 🤖 Gemini AI extrae datos
   ↓
3. ✅ SUNAT valida comprobante
   ↓
4. 🏢 SUNAT consulta RUC emisor
   ↓
5. 🔍 Detección de duplicados (QR + RUC+Serie)
   ↓
6. 📊 Envío a Google Sheets (si configurado)
   ↓
7. 🗄️ ENVÍO A SQL SERVER ← AUTOMÁTICO
   ↓
8. 🔔 Envío a n8n webhook (si configurado)
```

---

## 📋 Datos que se Guardan en SQL Server

### Campos Principales
- ✅ ID único de la factura
- ✅ Fecha de emisión
- ✅ Estado (COMPLETED, PENDING, FAILED)
- ✅ RUC Emisor (11 dígitos)
- ✅ Razón Social Emisor (oficial desde SUNAT)
- ✅ Serie-Número (ej: B002-00058549)
- ✅ Tipo Documento (FACTURA, BOLETA, etc)
- ✅ Subtotal Factura (sin IGV)
- ✅ IGV (monto)
- ✅ Total Factura (con IGV)
- ✅ Moneda (PEN, USD)
- ✅ SUNAT Verificado (SI/NO/PENDIENTE)
- ✅ Estado SUNAT (VÁLIDO/NO EXISTE/ANULADO/RECHAZADO)

### Campos de Items (NULL por ahora)
- Cantidad Items (actualmente: 1)
- Item # (actualmente: 1)
- Cantidad
- Descripción Producto
- Código Producto
- Precio Unitario
- Total Item

> **Nota**: Los campos de items se llenarán cuando se implemente extracción de productos individuales con IA.

---

## 🔐 Seguridad

- ✅ Credenciales encriptadas con AES-256
- ✅ Host encriptado
- ✅ Usuario encriptado
- ✅ Password encriptado
- ✅ Conexión directa al servidor SQL

### Clave de Encriptación
Las credenciales están encriptadas usando `ENCRYPTION_KEY` del archivo `.env`.

⚠️ **IMPORTANTE**: Si cambias la `ENCRYPTION_KEY`, deberás reconfigurar SQL Server.

---

## 📊 Verificación Manual en SQL Server

### Ver últimas facturas procesadas
```sql
SELECT TOP 10 *
FROM [AzaleiaPeru].[dbo].[CntCtaRendicionDocumentosIA]
ORDER BY [Fecha] DESC
```

### Ver solo facturas válidas SUNAT
```sql
SELECT *
FROM [AzaleiaPeru].[dbo].[CntCtaRendicionDocumentosIA]
WHERE [SUNAT Verificado] = 'SI'
  AND [Estado SUNAT] = 'VÁLIDO'
ORDER BY [Fecha] DESC
```

### Estadísticas por estado SUNAT
```sql
SELECT
    [Estado SUNAT],
    COUNT(*) as Total,
    SUM(CAST([Total Factura] as DECIMAL(18,2))) as MontoTotal
FROM [AzaleiaPeru].[dbo].[CntCtaRendicionDocumentosIA]
GROUP BY [Estado SUNAT]
ORDER BY Total DESC
```

### Facturas de hoy
```sql
SELECT *
FROM [AzaleiaPeru].[dbo].[CntCtaRendicionDocumentosIA]
WHERE CAST([Fecha] as DATE) = CAST(GETDATE() as DATE)
ORDER BY [Fecha] DESC
```

---

## 🧪 Scripts Disponibles

### Probar Conexión
```bash
cd /opt/invoice-system
npx tsx scripts/test-sql-azaleia.ts
```

### Reconfigurar (si cambias credenciales)
```bash
cd /opt/invoice-system
nano scripts/configure-sql-server-azaleia.ts  # Editar credenciales
npx tsx scripts/configure-sql-server-azaleia.ts
pm2 restart invoice-system
```

---

## 📝 Monitoreo en Tiempo Real

### Ver logs del sistema
```bash
pm2 logs invoice-system --lines 100
```

### Ver solo logs de SQL Server
```bash
pm2 logs invoice-system --lines 100 | grep "SQL Server"
```

### Ver si hay errores
```bash
pm2 logs invoice-system --err --lines 50
```

### Buscar inserciones exitosas
```bash
pm2 logs invoice-system | grep "SQL Server - .* fila(s) insertada(s)"
```

---

## ✅ Próxima Factura Procesada

La próxima factura que proceses desde http://cockpit.azaleia.com.pe:
1. Se enviará a Google Sheets (si configurado)
2. ✨ **SE ENVIARÁ AUTOMÁTICAMENTE A SQL SERVER** ✨
3. Se enviará a n8n (si configurado)

**No necesitas hacer nada más**, todo es automático.

---

## 🐛 Troubleshooting

### Si no se insertan facturas en SQL Server

1. **Verifica que está habilitado:**
```bash
cd /opt/invoice-system
npx tsx scripts/test-sql-azaleia.ts
```

2. **Revisa los logs:**
```bash
pm2 logs invoice-system --lines 200
```

3. **Busca estos mensajes:**
   - ✅ `🗄️ Iniciando envío a SQL Server...`
   - ✅ `✅ SQL Server - 1 fila(s) insertada(s) correctamente`
   - ❌ `❌ SQL Server error:` (si hay error)

4. **Si hay error de conexión:**
```bash
# Verifica conectividad
nc -zv 190.119.245.254 1433

# Verifica credenciales
npx tsx scripts/test-sql-azaleia.ts
```

### Si las credenciales cambian

```bash
# Edita el script con las nuevas credenciales
nano /opt/invoice-system/scripts/configure-sql-server-azaleia.ts

# Ejecuta la reconfiguración
npx tsx scripts/configure-sql-server-azaleia.ts

# Reinicia el servicio
pm2 restart invoice-system
```

---

## 📞 Archivos Importantes

```
/opt/invoice-system/
├── scripts/
│   ├── configure-sql-server-azaleia.ts    ← Configuración con credenciales
│   ├── test-sql-azaleia.ts                ← Test de conexión
│   └── configure-sql-server.ts            ← Template genérico
├── src/services/
│   └── sqlserver.ts                       ← Servicio SQL Server
├── SQL-SERVER-INTEGRATION.md              ← Documentación técnica
└── SQL-SERVER-CONFIGURED.md               ← Este archivo
```

---

## 🎯 Resumen

| Aspecto | Estado |
|---------|--------|
| Configuración | ✅ COMPLETA |
| Conexión | ✅ FUNCIONANDO |
| Test Inserción | ✅ EXITOSO |
| Servicio Activo | ✅ CORRIENDO |
| Envío Automático | ✅ HABILITADO |

**Todo está listo y funcionando.**

Las facturas ahora se guardan automáticamente en SQL Server cada vez que se procesan.

---

**Configurado:** 2025-11-11
**Servidor:** 190.119.245.254:1433
**Base de Datos:** AzaleiaPeru
**Tabla:** [dbo].[CntCtaRendicionDocumentosIA]
**Estado:** ✅ ACTIVO
