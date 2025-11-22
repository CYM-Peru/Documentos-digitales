import './globals.css'
import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import Providers from '@/components/Providers'

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sistema de Gestión de Documentos',
  description: 'Sistema inteligente de gestión y procesamiento de documentos',
  manifest: '/manifest.json',
  themeColor: '#0ea5e9',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Invoice OCR',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={poppins.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
