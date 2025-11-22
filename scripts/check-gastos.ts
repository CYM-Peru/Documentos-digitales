import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Checking planillas and their gastos...\n')

    const planillas = await prisma.movilidadPlanilla.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        gastos: true,
      },
    })

    console.log(`Found ${planillas.length} planillas:\n`)

    for (const planilla of planillas) {
      console.log(`---`)
      console.log(`ID: ${planilla.id}`)
      console.log(`Nombre: ${planilla.nombresApellidos}`)
      console.log(`Estado: ${planilla.estadoAprobacion}`)
      console.log(`Total: S/ ${planilla.totalGeneral}`)
      console.log(`Número de gastos: ${planilla.gastos.length}`)

      if (planilla.gastos.length > 0) {
        console.log(`Gastos:`)
        planilla.gastos.forEach((gasto, idx) => {
          console.log(`  ${idx + 1}. Fecha: ${gasto.fechaGasto || `${gasto.dia}/${gasto.mes}/${gasto.anio}`}`)
          console.log(`     Motivo: ${gasto.motivo || 'N/A'}`)
          console.log(`     Origen: ${gasto.origen || 'N/A'}`)
          console.log(`     Destino: ${gasto.destino || 'N/A'}`)
          console.log(`     Monto Viaje: S/ ${gasto.montoViaje}`)
          console.log(`     Monto Día: S/ ${gasto.montoDia}`)
        })
      } else {
        console.log(`  (sin gastos registrados)`)
      }
      console.log()
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
