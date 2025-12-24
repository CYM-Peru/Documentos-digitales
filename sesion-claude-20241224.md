# Sesión Claude Code - 24 Diciembre 2024

## Resumen de cambios realizados

### 1. Fix: Campos vacíos en SQL Server
- Cambiado `sanitizeRequired()` para usar "SV" (sin valor) en lugar de valores inventados
- Eliminados defaults falsos como "CALZADOS AZALEIA", "SIN RAZON SOCIAL", "00000000000"
- Agregada validación de campos críticos con advertencias en consola
- Archivos modificados: `src/services/sqlserver.ts`

### 2. Fix: Archivos estáticos 404
- Copiados archivos estáticos al directorio standalone:
  - `.next/static` → `.next/standalone/.next/static`
  - `public` → `.next/standalone/public`

### 3. Respaldo en GitHub
- Commit: `0ef91ea`
- Repo: `github.com:CYM-Peru/Documentos-digitales.git`
- Branch: `main`

## Archivo .env (GUARDAR EN LUGAR SEGURO)

```env
# Database - Supabase PostgreSQL
DATABASE_URL=postgresql://postgres:Azaleia.2025@db.oifpvdrmibxqftnqxmsb.supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:Azaleia.2025@db.oifpvdrmibxqftnqxmsb.supabase.co:5432/postgres

# NextAuth Configuration
NEXTAUTH_URL=https://cockpit.azaleia.com.pe
NEXTAUTH_SECRET=bpdzDGcgxViDoJRaNuGjm3JLfAY+Dje3+5qXGsmOtVM=

# Encryption for sensitive credentials
ENCRYPTION_KEY=VZiDXD4ZTjgs4FuOlWdvDboOBm7ctFE3lUPRd/wa19E=

# Initial Super Admin
SUPER_ADMIN_EMAIL=admin@azaleia.com.pe
SUPER_ADMIN_PASSWORD=admin123

# Application
NODE_ENV=production
PORT=3010

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/app/public/uploads

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://oifpvdrmibxqftnqxmsb.supabase.co
```

## Comandos para restaurar después del snapshot

```bash
cd /opt/invoice-system
git pull origin main
npm install
npm run build
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
sudo systemctl restart invoice-system
```

## Contexto previo (de sesiones anteriores)

- Filtros abiertas/cerradas: Arreglados para usar `getRendicionStatus()`
- Lógica: Abiertas = CodEstado='00', Cerradas = todo lo demás
- Panel de emails: Agregado botón en admin para acceder a `/admin/configuracion-emails`
- Recovery de contraseña: Implementado con tokens y email
