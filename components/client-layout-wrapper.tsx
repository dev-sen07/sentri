'use client'

import { usePathname } from 'next/navigation'
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  // Hide sidebar on the login page or any other auth pages
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/liberacion'
  
  if (isAuthPage) {
    return <main className="flex-1 w-full h-screen relative">{children}</main>
  }

  // Mapear rutas a nombres legibles para el breadcrumb
  const getPageTitle = (path: string) => {
    if (path === '/') return 'Dashboard'
    if (path === '/marcar-asistencia') return 'Marcar Asistencia'
    if (path === '/estudiantes') return 'Estudiantes'
    if (path === '/laboratorio') return 'Laboratorio'
    if (path === '/practicas') return 'Prácticas'
    if (path === '/liberacion/admin') return 'Liberación'
    if (path === '/clases') return 'Clases'
    if (path === '/perfil') return 'Mi Perfil'
    if (path === '/reportes') return 'Reportes'
    return path.substring(1).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Dashboard'
  }

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header más moderno y minimalista */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl px-4 sm:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" />
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />
            <h2 className="text-sm font-semibold tracking-tight">
              {getPageTitle(pathname)}
            </h2>
          </div>
        </header>
        
        {/* Contenedor principal con scroll */}
        <div className="flex-1 overflow-auto">
          <div className="min-h-full flex flex-col">
            {children}
            
            {/* Footer sutil y moderno al final del contenido */}
            <footer className="mt-auto py-6 px-4 shrink-0 text-center text-xs text-zinc-400 dark:text-zinc-600">
              <p>© {new Date().getFullYear()} Sentri. Todos los derechos reservados.</p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}
