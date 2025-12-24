# Quick Start - Recuperación de Contraseña

Guía rápida para usar el servicio de recuperación de contraseña.

## Flujo de Usuario

```
1. Usuario va a /login
   ↓
2. Click en "¿Olvidaste tu contraseña?"
   ↓
3. Redirige a /forgot-password
   ↓
4. Ingresa email/username y envía
   ↓
5. Recibe email con enlace de recuperación
   ↓
6. Click en enlace → /reset-password?token=xxx
   ↓
7. Ingresa nueva contraseña
   ↓
8. Contraseña actualizada → redirige a /login
   ↓
9. Login con nueva contraseña
```

## Configuración Inicial

### 1. Configurar SMTP (si no está configurado)

```sql
-- Insertar o actualizar NotificationSettings
INSERT INTO invoice_system.notification_settings (
  id,
  "smtpHost",
  "smtpPort",
  "smtpUser",
  "smtpPass",
  "smtpSecure",
  "emailFrom"
) VALUES (
  'default',
  'smtp.office365.com',
  587,
  'noreply@azaleia.com.pe',
  'tu-password-aqui',
  false,
  'Sistema Cockpit <noreply@azaleia.com.pe>'
) ON CONFLICT (id) DO UPDATE SET
  "smtpHost" = EXCLUDED."smtpHost",
  "smtpPort" = EXCLUDED."smtpPort",
  "smtpUser" = EXCLUDED."smtpUser",
  "smtpPass" = EXCLUDED."smtpPass",
  "smtpSecure" = EXCLUDED."smtpSecure",
  "emailFrom" = EXCLUDED."emailFrom";
```

O desde el Admin UI:
1. Ir a `/admin/settings`
2. Sección "Notificaciones por Email"
3. Completar datos SMTP

### 2. Verificar migración

```bash
cd /opt/invoice-system
npx prisma db push
npx prisma generate
```

## Uso Programático

### Ejemplo 1: Solicitar reset de contraseña

```typescript
import { PasswordRecoveryService } from '@/services/password-recovery'

async function requestPasswordReset(email: string) {
  const service = new PasswordRecoveryService()

  // Crear token
  const tokenData = await service.createResetToken(email)

  if (!tokenData) {
    console.log('Usuario no encontrado')
    return
  }

  // Enviar email
  const result = await service.sendResetEmail(
    email,
    tokenData.token,
    'Nombre Usuario'
  )

  console.log(result.success ? 'Email enviado' : result.error)
}
```

### Ejemplo 2: Validar token

```typescript
import { PasswordRecoveryService } from '@/services/password-recovery'

async function checkToken(token: string) {
  const service = new PasswordRecoveryService()

  const userId = await service.validateToken(token)

  if (userId) {
    console.log(`Token válido para usuario: ${userId}`)
    return true
  } else {
    console.log('Token inválido o expirado')
    return false
  }
}
```

### Ejemplo 3: Resetear contraseña

```typescript
import { PasswordRecoveryService } from '@/services/password-recovery'

async function resetPassword(token: string, newPassword: string) {
  const service = new PasswordRecoveryService()

  const result = await service.resetPassword(token, newPassword)

  if (result.success) {
    console.log('Contraseña actualizada correctamente')
  } else {
    console.error(`Error: ${result.message}`)
  }
}
```

### Ejemplo 4: Usar instancia singleton

```typescript
import { passwordRecoveryService } from '@/services/password-recovery'

// Usar directamente
const tokenData = await passwordRecoveryService.createResetToken('user@example.com')
```

## Pruebas

### Prueba completa del servicio

```bash
# Probar sin enviar email
npx ts-node scripts/test-password-recovery.ts usuario@ejemplo.com

# Probar con envío de email
npx ts-node scripts/test-password-recovery.ts usuario@ejemplo.com --send-email
```

### Prueba manual del flujo

1. **Solicitar reset**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/password-recovery/request \
     -H "Content-Type: application/json" \
     -d '{"email":"usuario@ejemplo.com"}'
   ```

2. **Validar token** (copiar token del email):
   ```bash
   curl http://localhost:3000/api/auth/password-recovery/reset?token=abc123...
   ```

3. **Resetear contraseña**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/password-recovery/reset \
     -H "Content-Type: application/json" \
     -d '{"token":"abc123...","newPassword":"nuevaPass123"}'
   ```

## API Endpoints

### POST /api/auth/password-recovery/request

Solicita recuperación de contraseña.

**Request:**
```json
{
  "email": "usuario@ejemplo.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Si el email está registrado, recibirás instrucciones..."
}
```

### POST /api/auth/password-recovery/reset

Resetea la contraseña.

**Request:**
```json
{
  "token": "abc123...",
  "newPassword": "miNuevaPass123"
}
```

**Response Success:**
```json
{
  "success": true,
  "message": "Contraseña actualizada correctamente"
}
```

**Response Error:**
```json
{
  "success": false,
  "message": "Token inválido o expirado",
  "error": "INVALID_TOKEN"
}
```

### GET /api/auth/password-recovery/reset?token=xxx

Valida token.

**Response:**
```json
{
  "valid": true,
  "message": "Token válido"
}
```

## URLs Frontend

- `/forgot-password` - Página de solicitud
- `/reset-password?token=xxx` - Página de reset
- `/login` - Login (con enlace "Olvidé mi contraseña")

## Mantenimiento

### Limpiar tokens expirados

```typescript
import { PasswordRecoveryService } from '@/services/password-recovery'

async function cleanupTokens() {
  const service = new PasswordRecoveryService()
  const count = await service.cleanupExpiredTokens()
  console.log(`Tokens limpiados: ${count}`)
}
```

### Cron job recomendado

```bash
# Limpiar diariamente a las 2 AM
# Crontab
0 2 * * * cd /opt/invoice-system && node -e "require('./dist/scripts/cleanup-tokens.js')"
```

## Troubleshooting

### Email no se envía

1. Verificar configuración SMTP:
   ```typescript
   import { PasswordRecoveryService } from '@/services/password-recovery'

   const config = {
     smtpHost: 'smtp.office365.com',
     smtpPort: 587,
     smtpUser: 'email@azaleia.com.pe',
     smtpPass: 'password',
     smtpSecure: false,
     emailFrom: 'Sistema <email@azaleia.com.pe>'
   }

   const result = await PasswordRecoveryService.testConnection(config)
   console.log(result)
   ```

2. Revisar logs del servidor
3. Verificar firewall/puerto 587

### Token inválido

- Verificar que no hayan pasado 15 minutos
- Comprobar que el token no haya sido usado
- Verificar URL completa del enlace

### Error de base de datos

```bash
cd /opt/invoice-system
npx prisma generate
npx prisma db push
```

## Seguridad

- Los tokens expiran en 15 minutos
- Los tokens se guardan hasheados (SHA-256)
- Los tokens son de un solo uso
- No se revela si el email existe
- Contraseñas con bcrypt (10 rounds)

## Variables de Entorno

```env
# .env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXT_PUBLIC_APP_URL=https://cockpit.azaleia.com.pe
```

## Archivos Principales

```
/opt/invoice-system/
├── src/services/password-recovery.ts          # Servicio principal
├── src/app/api/auth/password-recovery/
│   ├── request/route.ts                       # API: solicitar reset
│   └── reset/route.ts                         # API: resetear contraseña
├── src/app/forgot-password/page.tsx           # Página solicitud
├── src/app/reset-password/page.tsx            # Página reset
└── PASSWORD_RECOVERY_SERVICE.md               # Documentación completa
```

## Soporte

Para más información, consulta `PASSWORD_RECOVERY_SERVICE.md`.
