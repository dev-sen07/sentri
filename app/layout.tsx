import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Sentri',
  description: 'Plataforma de seguimiento académico',
  generator: 'Sentri',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

import { SidebarProvider } from "@/components/ui/sidebar";
import { ClientLayoutWrapper } from "@/components/client-layout-wrapper";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className="font-sans antialiased overflow-hidden">
        <TooltipProvider>
          <SidebarProvider>
            <ClientLayoutWrapper>
              {children}
            </ClientLayoutWrapper>
          </SidebarProvider>
        </TooltipProvider>
      </body>
    </html>
  )
}
