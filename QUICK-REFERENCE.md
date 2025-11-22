# 🚀 Quick Reference - Sistema Azaleia

## 📍 Información Básica

| Item | Valor |
|------|-------|
| **URL Producción** | https://cockpit.azaleia.com.pe |
| **Servidor** | 147.93.10.141 |
| **Usuario SSH** | root |
| **Puerto Next.js** | 3010 |
| **Puerto Evolution** | 8080 |
| **Base de Datos** | PostgreSQL (Supabase) |

---

## 🔑 Comandos Importantes

### PM2 (Next.js)
```bash
# Ver status
pm2 status

# Ver logs
pm2 logs invoice-system --lines 50

# Reiniciar
pm2 restart invoice-system

# Recargar sin downtime
pm2 reload invoice-system

# Detener
pm2 stop invoice-system

# Iniciar
pm2 start invoice-system
```

### Build y Deploy
```bash
cd /opt/invoice-system

# Build completo
npm run build

# Reiniciar PM2
pm2 restart invoice-system

# Ver logs en tiempo real
pm2 logs invoice-system
```

### Docker (Evolution API)
```bash
cd /opt/evolution-api

# Ver containers
docker ps

# Logs
docker logs evolution-api --tail 100
docker logs evolution-api -f  # Follow mode

# Reiniciar
docker restart evolution-api

# Detener
docker-compose down

# Iniciar
docker-compose up -d

# Ver configuración
docker inspect evolution-api
```

### Base de Datos
```bash
# Conectar a PostgreSQL
PGPASSWORD=azaleia_pg_2025_secure psql -h db.oifpvdrmibxqftnqxmsb.supabase.co -U whatsapp_user -d postgres

# Aplicar cambios de schema
cd /opt/invoice-system
POSTGRES_PASSWORD=azaleia_pg_2025_secure npx prisma db push

# Generar Prisma Client
npx prisma generate

# Ver estado de migraciones
npx prisma migrate status
```

### Nginx
```bash
# Test configuración
nginx -t

# Recargar
systemctl reload nginx

# Reiniciar
systemctl restart nginx

# Ver logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 📂 Ubicaciones Importantes

| Qué | Dónde |
|-----|-------|
| **Aplicación** | `/opt/invoice-system/` |
| **Logs PM2** | `~/.pm2/logs/` |
| **Evolution API** | `/opt/evolution-api/` |
| **Nginx config** | `/etc/nginx/sites-available/cockpit.azaleia.com.pe` |
| **SSL certs** | `/etc/letsencrypt/live/cockpit.azaleia.com.pe/` |
| **Uploads** | `/opt/invoice-system/public/uploads/` |

---

## 🗄️ Base de Datos

### PostgreSQL (Principal)
```
Host: db.oifpvdrmibxqftnqxmsb.supabase.co
Port: 5432
Database: postgres
User: whatsapp_user
Password: [Ver .env]

Schemas:
- invoice_system (datos del app)
- evolution_api (WhatsApp)
```

### SQL Server (Legacy)
```
Host: [Ver .env - SQLSERVER_HOST]
Database: SERVGAL_02
User: [Ver .env]

Tablas principales:
- RendicionCab
- CajasChicasCab
- MovPlanillaCab
```

---

## 🔗 APIs y Servicios

### Evolution API (WhatsApp)
```
URL: http://localhost:8080
API Key: B6D711FCDE4D4FD5936544120E713976

Endpoints:
- GET  /instance/connectionState/{name}
- POST /instance/create
- GET  /instance/connect/{name}
- POST /message/sendText/{name}
```

### Gemini AI
```
API Key: [Ver .env - GEMINI_API_KEY]
Modelo: gemini-2.0-flash-exp
Rate Limit: 1,500 requests/día (gratis)
```

### SUNAT API
```
URL: apiperu.dev/api
Token: [Ver .env - SUNAT_API_TOKEN]
```

---

## 👥 Roles de Usuario

| Rol | Permisos |
|-----|----------|
| **USER** | Crear planillas, subir facturas, ver sus documentos |
| **APROBADOR** | Todo lo de USER + aprobar/rechazar planillas |
| **ADMIN** | Todo lo de APROBADOR + gestión de usuarios |
| **SUPERVISOR** | Ver todas las planillas, sin modificar |
| **ORG_ADMIN** | Configuración de organización |
| **SUPER_ADMIN** | Acceso completo al sistema |

---

## 🚨 Troubleshooting Rápido

### App no carga
```bash
# 1. Verifica PM2
pm2 status

# 2. Revisa logs
pm2 logs invoice-system --lines 100

# 3. Reinicia
pm2 restart invoice-system

# 4. Si no funciona, rebuild
cd /opt/invoice-system
npm run build
pm2 restart invoice-system
```

### WhatsApp no funciona
```bash
# 1. Verifica Evolution API
docker ps | grep evolution
docker logs evolution-api --tail 50

# 2. Test API
curl http://localhost:8080/

# 3. Reinicia
docker restart evolution-api

# 4. Verifica en admin panel
# https://cockpit.azaleia.com.pe/admin -> tab WhatsApp
```

### Base de datos no responde
```bash
# Test conexión PostgreSQL
PGPASSWORD=azaleia_pg_2025_secure psql -h db.oifpvdrmibxqftnqxmsb.supabase.co -U whatsapp_user -d postgres -c "SELECT NOW();"

# Ver conexiones activas
PGPASSWORD=azaleia_pg_2025_secure psql -h db.oifpvdrmibxqftnqxmsb.supabase.co -U whatsapp_user -d postgres -c "SELECT * FROM pg_stat_activity;"
```

### Nginx problemas SSL
```bash
# Renovar certificados
certbot renew --nginx

# Test configuración
nginx -t

# Recargar
systemctl reload nginx
```

---

## 📊 Monitoreo

### Ver uso de recursos
```bash
# CPU y memoria
htop

# Disco
df -h

# Procesos de Node
ps aux | grep node

# Conexiones de red
netstat -tulpn | grep -E '3010|8080'
```

### Verificar servicios
```bash
# PM2
pm2 list

# Docker
docker ps

# Nginx
systemctl status nginx

# PostgreSQL (remoto)
PGPASSWORD=azaleia_pg_2025_secure psql -h db.oifpvdrmibxqftnqxmsb.supabase.co -U whatsapp_user -d postgres -c "\l"
```

---

## 🔐 Variables de Entorno Críticas

```bash
# Base de datos
DATABASE_URL=postgresql://...
POSTGRES_USER=whatsapp_user
POSTGRES_PASSWORD=azaleia_pg_2025_secure

# NextAuth
NEXTAUTH_SECRET=[valor secreto]
NEXTAUTH_URL=https://cockpit.azaleia.com.pe

# Gemini AI
GEMINI_API_KEY=AIzaSy...

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=B6D711FCDE4D4FD5936544120E713976

# SQL Server
SQLSERVER_HOST=[IP del servidor]
SQLSERVER_DATABASE=SERVGAL_02
SQLSERVER_USER=[usuario]
SQLSERVER_PASSWORD=[password]
```

---

## 📞 Contactos

| Quién | Para Qué |
|-------|----------|
| **Christian Palomino** | Usuario principal, requerimientos |
| **Supabase Support** | Problemas con PostgreSQL |
| **Hosting Provider** | Problemas de servidor |

---

## 🔄 Backup y Restore

### Backup Base de Datos
```bash
# PostgreSQL
PGPASSWORD=azaleia_pg_2025_secure pg_dump -h db.oifpvdrmibxqftnqxmsb.supabase.co -U whatsapp_user -d postgres -n invoice_system > backup_$(date +%Y%m%d).sql

# Comprimir
gzip backup_$(date +%Y%m%d).sql
```

### Backup Archivos
```bash
# Todo el proyecto
cd /opt
tar -czf invoice-system-backup-$(date +%Y%m%d).tar.gz invoice-system/

# Solo uploads
cd /opt/invoice-system
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz public/uploads/
```

### Restore
```bash
# Base de datos
PGPASSWORD=azaleia_pg_2025_secure psql -h db.oifpvdrmibxqftnqxmsb.supabase.co -U whatsapp_user -d postgres < backup_20251119.sql

# Archivos
cd /opt
tar -xzf invoice-system-backup-20251119.tar.gz
```

---

## 📱 Endpoints API Principales

```
POST   /api/auth/signin              - Login
GET    /api/invoices                 - Listar facturas
POST   /api/invoices/upload          - Subir factura
GET    /api/rendiciones              - Listar rendiciones
GET    /api/cajas-chicas             - Listar cajas chicas
POST   /api/planillas-movilidad      - Crear planilla
POST   /api/planillas-movilidad/[id]/aprobar  - Aprobar/Rechazar
GET    /api/planillas-movilidad/pendientes    - Ver pendientes
POST   /api/whatsapp/connect         - Generar QR WhatsApp
GET    /api/whatsapp/connect         - Estado WhatsApp
POST   /api/webhooks/whatsapp        - Webhook Evolution
```

---

**Última actualización:** 2025-11-19
