'use client'

import { usePathname } from 'next/navigation'

import { AppSidebar } from '@/components/app-sidebar'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/theme-toggle'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/marcar-asistencia': 'Marcar Asistencia',
  '/estudiantes': 'Estudiantes',
  '/laboratorio': 'Laboratorio',
  '/practicas': 'Prácticas',
  '/presentar-practicas': 'Presentar Prácticas',
  '/liberacion': 'Liberación',
  '/liberacion/admin': 'Liberación · Admin',
  '/clases-grabadas': 'Clases Grabadas',
  '/extras': 'Extras',
  '/mi-perfil': 'Mi Perfil',
  '/mis-asistencias': 'Mis Asistencias',
  '/mis-actividades': 'Mis Actividades',
  '/reporte-estudiantes': 'Reporte de Estudiantes',
  '/reporte-liberacion': 'Reporte de Liberación',
  '/parciales': 'Configurar Parciales',
  '/recuperacion': 'Recuperación',
  '/recuperacion/admin': 'Recuperación · Admin',
}

function getPageTitle(path: string) {
  if (PAGE_TITLES[path]) return PAGE_TITLES[path]
  const match = Object.keys(PAGE_TITLES)
    .filter((key) => key !== '/' && path.startsWith(key))
    .sort((a, b) => b.length - a.length)[0]
  if (match) return PAGE_TITLES[match]
  return (
    path
      .substring(1)
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase()) || 'Dashboard'
  )
}

export function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Auth pages render standalone — no sidebar chrome.
  const isAuthPage = pathname === '/login' || pathname === '/register'

  if (isAuthPage) {
    return <main className="relative min-h-dvh w-full">{children}</main>
  }

  return (
    <div className="flex h-dvh w-full bg-background">
      <AppSidebar />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-3 shadow-sm shadow-foreground/[0.03] backdrop-blur-xl sm:h-16 sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <SidebarTrigger
              className="size-9 shrink-0 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
              aria-label="Alternar menú lateral"
            />
            <div className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
            <div className="min-w-0">
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/75 sm:block">
                Sección actual
              </p>
              <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
                {getPageTitle(pathname)}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-background via-background to-primary/[0.035]">
          <div className="flex min-h-full flex-col">
            {children}

            <footer className="mt-auto hidden shrink-0 px-4 py-6 text-center text-xs text-muted-foreground/70 sm:block">
              <p>© {new Date().getFullYear()} Sentri. Todos los derechos reservados.</p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}
