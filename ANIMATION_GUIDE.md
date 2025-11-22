# 🎨 Guía de Implementación de Animaciones

## Componentes Creados

Ya tienes disponibles estos componentes en `/src/components/animations/`:

1. **FadeIn** - Fade-in al aparecer en viewport
2. **SlideUp** - Sube desde abajo con fade-in
3. **ScaleIn** - Scale-in con fade para cards destacadas
4. **AnimatedCard** - Cards con hover effects mejorados

## Cómo Aplicar las Animaciones

### 1. Importar los componentes

```tsx
import { FadeIn, SlideUp, ScaleIn, AnimatedCard } from '@/components/animations'
```

### 2. Envolver elementos existentes

#### ANTES (sin animación):
```tsx
<div className="bg-white rounded-lg shadow p-4">
  <h2>Mi Card</h2>
  <p>Contenido</p>
</div>
```

#### DESPUÉS (con animación):
```tsx
<SlideUp delay={0.2}>
  <AnimatedCard className="bg-white rounded-lg shadow p-4">
    <h2>Mi Card</h2>
    <p>Contenido</p>
  </AnimatedCard>
</SlideUp>
```

### 3. Ejemplos por Sección

#### Header/Navbar
```tsx
<FadeIn duration={0.5}>
  <header className="...">
    {/* contenido del header */}
  </header>
</FadeIn>
```

#### Cards de Estadísticas
```tsx
<div className="grid grid-cols-3 gap-4">
  <ScaleIn delay={0.1}>
    <div className="stat-card">...</div>
  </ScaleIn>
  <ScaleIn delay={0.2}>
    <div className="stat-card">...</div>
  </ScaleIn>
  <ScaleIn delay={0.3}>
    <div className="stat-card">...</div>
  </ScaleIn>
</div>
```

#### Lista de Items
```tsx
{items.map((item, index) => (
  <SlideUp key={item.id} delay={index * 0.1}>
    <AnimatedCard>
      {/* contenido del item */}
    </AnimatedCard>
  </SlideUp>
))}
```

## Propiedades de los Componentes

### FadeIn
- `delay?: number` - Retraso en segundos (default: 0)
- `duration?: number` - Duración en segundos (default: 0.6)
- `className?: string` - Clases CSS adicionales

### SlideUp
- `delay?: number` - Retraso en segundos (default: 0)
- `duration?: number` - Duración en segundos (default: 0.7)
- `distance?: number` - Distancia en píxeles (default: 50)
- `className?: string` - Clases CSS adicionales

### ScaleIn
- `delay?: number` - Retraso en segundos (default: 0)
- `duration?: number` - Duración en segundos (default: 0.5)
- `initialScale?: number` - Escala inicial (default: 0.9)
- `className?: string` - Clases CSS adicionales

### AnimatedCard
- `onClick?: () => void` - Función al hacer click
- `className?: string` - Clases CSS adicionales

## Tips de Uso

1. **Delays escalonados**: Usa delays incrementales (0.1, 0.2, 0.3) para efectos en cascada
2. **No abuses**: No todo necesita animarse, elige elementos clave
3. **Performance**: Las animaciones usan `useInView` - solo se ejecutan cuando el elemento es visible
4. **Mobile**: Las animaciones son sutiles y funcionan bien en móvil

## Siguiente Paso

Aplica gradualmente las animaciones empezando por:
1. Header principal
2. Cards de estadísticas
3. Lista de rendiciones/facturas
4. Modales y formularios
