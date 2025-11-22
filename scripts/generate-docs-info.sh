#!/bin/bash

# Script para generar información útil para la documentación
# Uso: bash scripts/generate-docs-info.sh

echo "=========================================="
echo "📚 GENERADOR DE INFORMACIÓN PARA DOCS"
echo "=========================================="
echo ""

# Crear carpeta de salida
mkdir -p /opt/invoice-system/docs-data
OUTPUT_DIR="/opt/invoice-system/docs-data"

# 1. Información de la base de datos
echo "1️⃣  Extrayendo información de base de datos..."
PGPASSWORD=azaleia_pg_2025_secure psql -h db.oifpvdrmibxqftnqxmsb.supabase.co -U whatsapp_user -d postgres -c "\dt invoice_system.*" > "$OUTPUT_DIR/db-tables.txt" 2>&1

# 2. Estructura de modelos Prisma
echo "2️⃣  Copiando schema de Prisma..."
cp /opt/invoice-system/prisma/schema.prisma "$OUTPUT_DIR/prisma-schema.prisma"

# 3. Variables de entorno (sin valores sensibles)
echo "3️⃣  Listando variables de entorno..."
cat /opt/invoice-system/.env | grep -E "^[A-Z_]+=.*" | sed 's/=.*/=***REDACTED***/g' > "$OUTPUT_DIR/env-variables.txt"

# 4. Lista de API endpoints
echo "4️⃣  Listando API endpoints..."
find /opt/invoice-system/src/app/api -name "route.ts" -type f | sed 's|/opt/invoice-system/src/app||g' | sed 's|/route.ts||g' > "$OUTPUT_DIR/api-endpoints.txt"

# 5. Estructura de carpetas
echo "5️⃣  Generando árbol de carpetas..."
tree -L 4 -I 'node_modules|.next|.git' /opt/invoice-system/src > "$OUTPUT_DIR/folder-structure.txt"

# 6. Dependencias del proyecto
echo "6️⃣  Extrayendo dependencias..."
cat /opt/invoice-system/package.json | jq '.dependencies' > "$OUTPUT_DIR/dependencies.json"
cat /opt/invoice-system/package.json | jq '.devDependencies' > "$OUTPUT_DIR/devDependencies.json"

# 7. Información de PM2
echo "7️⃣  Estado de PM2..."
pm2 list > "$OUTPUT_DIR/pm2-status.txt"
pm2 show invoice-system > "$OUTPUT_DIR/pm2-details.txt"

# 8. Docker containers
echo "8️⃣  Contenedores Docker..."
docker ps -a > "$OUTPUT_DIR/docker-containers.txt"
docker logs evolution-api --tail 100 > "$OUTPUT_DIR/evolution-logs.txt" 2>&1

# 9. Configuración de Nginx
echo "9️⃣  Configuración de Nginx..."
if [ -f /etc/nginx/sites-available/cockpit.azaleia.com.pe ]; then
    cp /etc/nginx/sites-available/cockpit.azaleia.com.pe "$OUTPUT_DIR/nginx-config.txt"
fi

# 10. Estadísticas del código
echo "🔟 Estadísticas del código..."
echo "=== Líneas de código por tipo ===" > "$OUTPUT_DIR/code-stats.txt"
echo "" >> "$OUTPUT_DIR/code-stats.txt"
echo "TypeScript/TSX:" >> "$OUTPUT_DIR/code-stats.txt"
find /opt/invoice-system/src -name "*.ts" -o -name "*.tsx" | xargs wc -l | tail -1 >> "$OUTPUT_DIR/code-stats.txt"
echo "" >> "$OUTPUT_DIR/code-stats.txt"
echo "Componentes React:" >> "$OUTPUT_DIR/code-stats.txt"
find /opt/invoice-system/src/components -name "*.tsx" | wc -l >> "$OUTPUT_DIR/code-stats.txt"
echo "" >> "$OUTPUT_DIR/code-stats.txt"
echo "API Routes:" >> "$OUTPUT_DIR/code-stats.txt"
find /opt/invoice-system/src/app/api -name "route.ts" | wc -l >> "$OUTPUT_DIR/code-stats.txt"
echo "" >> "$OUTPUT_DIR/code-stats.txt"
echo "Páginas:" >> "$OUTPUT_DIR/code-stats.txt"
find /opt/invoice-system/src/app -name "page.tsx" | wc -l >> "$OUTPUT_DIR/code-stats.txt"

# 11. Lista de servicios
echo "1️⃣1️⃣  Lista de servicios..."
ls -lh /opt/invoice-system/src/services/*.ts > "$OUTPUT_DIR/services-list.txt"

# 12. Configuración de Evolution API
echo "1️⃣2️⃣  Configuración Evolution API..."
if [ -f /opt/evolution-api/docker-compose.yml ]; then
    cp /opt/evolution-api/docker-compose.yml "$OUTPUT_DIR/evolution-docker-compose.yml"
fi

# 13. Sistema info
echo "1️⃣3️⃣  Información del sistema..."
echo "=== SISTEMA OPERATIVO ===" > "$OUTPUT_DIR/system-info.txt"
uname -a >> "$OUTPUT_DIR/system-info.txt"
echo "" >> "$OUTPUT_DIR/system-info.txt"
echo "=== NODE VERSION ===" >> "$OUTPUT_DIR/system-info.txt"
node --version >> "$OUTPUT_DIR/system-info.txt"
echo "" >> "$OUTPUT_DIR/system-info.txt"
echo "=== NPM VERSION ===" >> "$OUTPUT_DIR/system-info.txt"
npm --version >> "$OUTPUT_DIR/system-info.txt"
echo "" >> "$OUTPUT_DIR/system-info.txt"
echo "=== DOCKER VERSION ===" >> "$OUTPUT_DIR/system-info.txt"
docker --version >> "$OUTPUT_DIR/system-info.txt"
echo "" >> "$OUTPUT_DIR/system-info.txt"
echo "=== DISK USAGE ===" >> "$OUTPUT_DIR/system-info.txt"
df -h / >> "$OUTPUT_DIR/system-info.txt"

echo ""
echo "=========================================="
echo "✅ INFORMACIÓN GENERADA EXITOSAMENTE"
echo "=========================================="
echo ""
echo "📁 Archivos generados en: $OUTPUT_DIR"
echo ""
ls -lh "$OUTPUT_DIR"
echo ""
echo "📝 Usa estos archivos para completar DOCUMENTATION.md"
echo ""
