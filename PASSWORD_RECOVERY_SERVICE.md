# Servicio de Recuperación de Contraseña

Sistema independiente y reutilizable de recuperación de contraseña por email para el Sistema Cockpit.

## Características

- **Generación de tokens seguros**: Tokens criptográficos de 32 bytes con hash SHA-256
- **Expiración automática**: Tokens válidos por 15 minutos
- **Envío de emails con nodemailer**: Integración con Office365/SMTP
- **Validación de tokens**: Sistema robusto de validación con múltiples verificaciones de seguridad
- **Reset de contraseña**: Actualización segura con bcrypt
- **Sistema de limpieza**: Función para eliminar tokens expirados
- **Diseño responsive**: UI moderna y adaptable a todos los dispositivos

## Arquitectura

```
/opt/invoice-system/
├── prisma/
│   └── schema.prisma                      # Modelo PasswordResetToken
├── src/
│   ├── services/
│   │   └── password-recovery.ts           # Servicio principal (microservicio)
│   ├── app/
│   │   ├── api/auth/password-recovery/
│   │   │   ├── request/route.ts           # POST - Solicitar reset
│   │   │   └── reset/route.ts             # POST/GET - Resetear contraseña
│   │   ├── forgot-password/
│   │   │   └── page.tsx                   # Página de solicitud
│   │   └── reset-password/
│   │       └── page.tsx                   # Página de reset
```

## Modelo de Datos

```prisma
model PasswordResetToken {
  id          String   @id @default(cuid())
  userId      String
  token       String   @unique        // Token hasheado (SHA-256)
  expiresAt   DateTime                // Expira en 15 minutos
  used        Boolean  @default(false)
  usedAt      DateTime?
  createdAt   DateTime @default(now())

  @@index([token])
  @@index([userId])
  @@index([expiresAt])
}
```

## API Endpoints

### POST /api/auth/password-recovery/request

Solicita un reseteo de contraseña.

**Request Body:**
```json
{
  "email": "usuario@ejemplo.com"  // O username (AARROYO)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Si el email está registrado, recibirás instrucciones de recuperación en breve"
}
```

**Nota de seguridad:** La API siempre devuelve el mismo mensaje exitoso para prevenir enumeración de usuarios.

### POST /api/auth/password-recovery/reset

Resetea la contraseña usando un token válido.

**Request Body:**
```json
{
  "token": "abc123...",           // Token recibido por email
  "newPassword": "miPass123"      // Nueva contraseña (min 6 caracteres)
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

### GET /api/auth/password-recovery/reset?token=abc123

Valida un token sin resetear la contraseña.

**Response:**
```json
{
  "valid": true,
  "message": "Token válido"
}
```

## Uso del Servicio

### Ejemplo básico

```typescript
import { PasswordRecoveryService } from '@/services/password-recovery'

const service = new PasswordRecoveryService()

// 1. Generar token y enviar email
const tokenData = await service.createResetToken('usuario@ejemplo.com')

if (tokenData) {
  await service.sendResetEmail(
    'usuario@ejemplo.com',
    tokenData.token,
    'Juan Pérez'
  )
}

// 2. Validar token
const userId = await service.validateToken(token)

// 3. Resetear contraseña
const result = await service.resetPassword(token, 'nuevaContraseña123')

if (result.success) {
  console.log('Contraseña actualizada')
}
```

### Instancia singleton

```typescript
import { passwordRecoveryService } from '@/services/password-recovery'

// Usar la instancia singleton
await passwordRecoveryService.createResetToken('user@example.com')
```

### Limpieza de tokens expirados

```typescript
// Ejecutar periódicamente (ej: cron job)
const service = new PasswordRecoveryService()
const deletedCount = await service.cleanupExpiredTokens()
console.log(`Tokens limpiados: ${deletedCount}`)
```

### Probar conexión SMTP

```typescript
const testResult = await PasswordRecoveryService.testConnection({
  smtpHost: 'smtp.office365.com',
  smtpPort: 587,
  smtpUser: 'noreply@empresa.com',
  smtpPass: 'password',
  smtpSecure: false,
  emailFrom: 'Sistema <noreply@empresa.com>'
})

console.log(testResult.success ? 'SMTP OK' : testResult.error)
```

## Configuración SMTP

El servicio utiliza la configuración SMTP existente del modelo `NotificationSettings`:

```typescript
// Campos requeridos en NotificationSettings
smtpHost: string     // smtp.office365.com
smtpPort: number     // 587
smtpUser: string     // email del remitente
smtpPass: string     // contraseña o app password
smtpSecure: boolean  // false para 587, true para 465
emailFrom: string    // "Sistema Cockpit <noreply@...>"
```

Para configurar:

1. Ve a Admin > Configuración
2. Sección "Notificaciones por Email"
3. Completa los datos SMTP (Office365 recomendado)

## Páginas de Usuario

### /forgot-password

Página para solicitar recuperación de contraseña:
- Formulario simple con email/username
- Validación en tiempo real
- Pantalla de confirmación
- Instrucciones claras
- Enlace de retorno al login

### /reset-password?token=abc123

Página para resetear contraseña:
- Validación automática del token
- Formulario de nueva contraseña
- Indicador de seguridad de contraseña
- Confirmación de contraseña
- Redirección automática al login tras éxito

### Enlace en Login

Se agregó un enlace "¿Olvidaste tu contraseña?" en la página de login.

## Email Template

El email enviado incluye:

- **Diseño moderno**: HTML responsivo con gradientes
- **Call-to-action destacado**: Botón grande para resetear
- **Información de expiración**: Aviso de 15 minutos
- **Instrucciones claras**: Pasos numerados
- **Alternativa de enlace**: Por si el botón no funciona
- **Branding**: Logo y colores de Azaleia

## Seguridad

### Medidas implementadas

1. **Tokens criptográficos**: Generados con `crypto.randomBytes(32)`
2. **Hash de tokens**: SHA-256 antes de guardar en BD (nunca texto plano)
3. **Expiración automática**: 15 minutos de validez
4. **Tokens de un solo uso**: Se marcan como usados tras reset
5. **Invalidación de tokens anteriores**: Al solicitar nuevo token
6. **No revelación de usuarios**: Mensajes genéricos en la API
7. **Rate limiting recomendado**: Implementar en producción
8. **Validación de contraseña**: Mínimo 6 caracteres
9. **HTTPS obligatorio**: En producción
10. **Sanitización de inputs**: En todas las entradas

### Recomendaciones adicionales

- Implementar rate limiting (ej: 3 intentos por hora)
- Monitorear intentos fallidos
- Logs de seguridad para auditoría
- CAPTCHA en formulario (opcional)
- Notificación al usuario de cambio de contraseña

## Mantenimiento

### Tarea programada recomendada

Crear un cron job para limpiar tokens expirados:

```typescript
// scripts/cleanup-tokens.ts
import { PasswordRecoveryService } from '@/services/password-recovery'

async function cleanupTokens() {
  const service = new PasswordRecoveryService()
  const count = await service.cleanupExpiredTokens()
  console.log(`[${new Date().toISOString()}] Tokens limpiados: ${count}`)
}

cleanupTokens()
```

Ejecutar diariamente:
```bash
# Crontab
0 2 * * * cd /opt/invoice-system && node scripts/cleanup-tokens.js
```

## Pruebas

### Test manual del flujo completo

1. **Solicitar reset**:
   - Ir a `/forgot-password`
   - Ingresar email o username
   - Verificar email recibido

2. **Validar token**:
   - Hacer clic en el enlace del email
   - Verificar que carga `/reset-password?token=...`
   - Comprobar validación automática

3. **Resetear contraseña**:
   - Ingresar nueva contraseña (min 6 caracteres)
   - Confirmar contraseña
   - Verificar indicador de seguridad
   - Enviar formulario

4. **Login con nueva contraseña**:
   - Redirección automática a `/login`
   - Iniciar sesión con nueva contraseña

### Test de expiración

```bash
# Solicitar reset
curl -X POST http://localhost:3000/api/auth/password-recovery/request \
  -H "Content-Type: application/json" \
  -d '{"email":"test@ejemplo.com"}'

# Esperar 16 minutos y verificar que el token expiró
```

### Test de seguridad

```typescript
// Intentar usar un token ya usado
const service = new PasswordRecoveryService()
const result1 = await service.resetPassword(token, 'pass1')
const result2 = await service.resetPassword(token, 'pass2') // Debe fallar
```

## Troubleshooting

### Email no se envía

1. Verificar configuración SMTP en `NotificationSettings`
2. Probar conexión: `PasswordRecoveryService.testConnection()`
3. Revisar logs del servidor
4. Verificar firewall/puerto 587
5. Para Office365: usar App Password en lugar de contraseña normal

### Token inválido

1. Verificar que no hayan pasado más de 15 minutos
2. Comprobar que el token no haya sido usado
3. Verificar que el token no fue modificado en la URL
4. Revisar logs de la API

### Error de base de datos

```bash
# Regenerar cliente Prisma
cd /opt/invoice-system
npx prisma generate

# Verificar migración
npx prisma db push
```

## Variables de Entorno

```env
# Requeridas para el servicio
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Para URLs en emails
NEXT_PUBLIC_APP_URL=https://cockpit.azaleia.com.pe
```

## Dependencias

```json
{
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "bcryptjs": "^2.4.3",
    "nodemailer": "^6.9.x",
    "next": "^14.x"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.x",
    "@types/nodemailer": "^6.4.x",
    "prisma": "^5.22.0"
  }
}
```

## Autor

Sistema Cockpit - Azaleia Perú S.A.

## Licencia

Uso interno - Confidencial

---

**Última actualización**: 2025-12-23
**Versión**: 1.0.0
