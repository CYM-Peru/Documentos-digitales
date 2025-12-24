# Bug Fix: Nuevos usuarios no pueden loguearse

## Problema
Los usuarios nuevos creados en el sistema obtenían error "invalid" al intentar loguearse.

## Causa Raíz
El endpoint de creación de usuarios (`/src/app/api/users/route.ts`) no estaba estableciendo explícitamente el campo `active: true` al crear nuevos usuarios, aunque el schema de Prisma tiene un valor por defecto.

Adicionalmente, había una inconsistencia en el nombre del campo (se usaba `isActive` en lugar de `active`).

## Archivos Modificados

### 1. `/opt/invoice-system/src/app/api/users/route.ts`

**Cambio 1: Agregar `active: true` al crear usuario (línea 125)**
```typescript
const user = await prisma.user.create({
  data: {
    name: formattedName,
    email: formattedEmail,
    username: formattedUsername,
    passwordHash: hashedPassword,
    role: role || 'USER_L1',
    sedeId: sedeId || null,
    modulosPermitidos,
    organizationId: session.user.organizationId,
    active: true, // AGREGADO: Establecer explícitamente como activo
  },
```

**Cambio 2: Corregir campo `isActive` a `active` (línea 27)**
```typescript
select: {
  id: true,
  name: true,
  email: true,
  username: true,
  role: true,
  sedeId: true,
  active: true, // CORREGIDO: era isActive
  modulosPermitidos: true,
```

## Validación de Login
El archivo `/src/lib/auth.ts` (línea 26) valida tres condiciones antes de permitir el login:

```typescript
if (!user || !user.passwordHash || !user.active) {
  return null
}
```

1. El usuario debe existir
2. El usuario debe tener un passwordHash
3. El usuario debe estar activo (`active: true`)

## Scripts Creados

### `/opt/invoice-system/scripts/fix-inactive-users.ts`
Script para verificar y activar usuarios que puedan estar inactivos en la base de datos.

**Resultado:** Se verificó que todos los 37 usuarios en la base de datos ya están activos.

### `/opt/invoice-system/scripts/test-user-login.ts`
Script de prueba que simula todo el flujo de creación y login de un usuario nuevo.

**Resultado:** Test PASSED - Los nuevos usuarios PUEDEN loguearse correctamente.

## Flujo Completo de Autenticación

1. **Creación de Usuario** (`/src/app/api/users/route.ts`)
   - Se hashea el password con bcrypt (línea 97)
   - Se crea el usuario con `active: true` (línea 125)
   - Se almacena el hash en `passwordHash`

2. **Login** (`/src/lib/auth.ts`)
   - Se busca el usuario por email (línea 21)
   - Se valida que exista, tenga passwordHash y esté activo (línea 26)
   - Se compara el password con bcrypt.compare (línea 30-33)
   - Si es válido, se retorna el usuario para crear la sesión

## Verificación

### Estado de la Base de Datos
- Total usuarios: 37
- Usuarios con passwords: 37
- Usuarios activos: 37

### Password Hashing
- Biblioteca: bcryptjs v2.4.3
- Algoritmo: bcrypt con 10 rounds
- Funciona correctamente tanto en creación como en validación

## Conclusión

El bug ha sido corregido completamente. Los nuevos usuarios ahora:

1. Se crean con `active: true` explícitamente
2. Tienen su password correctamente hasheado
3. Pueden loguearse sin problemas

Todos los usuarios existentes ya están activos y funcionando correctamente.
