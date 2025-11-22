import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const invoice = await prisma.invoice.findFirst({
    orderBy: { createdAt: 'desc' },
  })

  if (!invoice || !invoice.ocrData) {
    console.log('No invoice data found')
    return
  }

  const ocrData = invoice.ocrData as any
  const textAnnotations = ocrData.rawData?.textAnnotations || []

  if (textAnnotations.length === 0) {
    console.log('No text annotations')
    return
  }

  // Extract lines the same way vision.ts does
  const words = textAnnotations.slice(1)
  const lines: string[] = []
  let currentLine = ''
  let lastY = -1

  for (const word of words) {
    const vertices = word.boundingPoly?.vertices || []
    if (vertices.length === 0) continue

    const y = vertices[0].y || 0

    // New line detection (if Y coordinate changes significantly)
    if (lastY !== -1 && Math.abs(y - lastY) > 10) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim())
      }
      currentLine = word.description
    } else {
      currentLine += ' ' + word.description
    }

    lastY = y
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim())
  }

  console.log('\n📝 LÍNEAS DETECTADAS:\n')
  lines.forEach((line, i) => {
    const lineLower = line.toLowerCase()

    // Marcar líneas importantes
    let marker = ''
    if (lineLower.includes('op') && lineLower.includes('gravada')) marker = '⚠️ SUBTOTAL'
    if (lineLower.includes('i.g.v')) marker = '⚠️ IGV'
    if (lineLower.includes('total') && lineLower.includes('pagar')) marker = '⚠️ TOTAL'
    if (lineLower.includes('importe') && lineLower.includes('total')) marker = '⚠️ IMPORTE'

    console.log(`${i}: ${line} ${marker}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
