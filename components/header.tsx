'use client'

import { useRouter, usePathname } from 'next/navigation'
import { signOut } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface HeaderProps {
  userRole?: 'estudiante' | 'auxiliar'
  userName?: string
}

export function Header({ userRole, userName }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <header className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="font-semibold text-lg">
            Asistencias
          </Link>

          {userRole === 'auxiliar' && (
            <nav className="hidden md:flex gap-6">
              <Link
                href="/dashboard"
                className={`text-sm transition ${
                  pathname === '/dashboard'
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Inicio
              </Link>
              <Link
                href="/estudiantes"
                className={`text-sm transition ${
                  pathname === '/estudiantes'
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Estudiantes
              </Link>

              <Link
                href="/marcar-asistencia"
                className={`text-sm transition ${
                  pathname === '/marcar-asistencia'
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Marcar Asistencia
              </Link>
              <Link
                href="/crear-practica"
                className={`text-sm transition ${
                  pathname === '/crear-practica'
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Crear Práctica
              </Link>
            </nav>
          )}

          {userRole === 'estudiante' && (
            <nav className="hidden md:flex gap-6">
              <Link
                href="/dashboard"
                className={`text-sm transition ${
                  pathname === '/dashboard'
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Inicio
              </Link>
              <Link
                href="/mis-asistencias"
                className={`text-sm transition ${
                  pathname === '/mis-asistencias'
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Mis Asistencias
              </Link>
              <Link
                href="/laboratorio"
                className={`text-sm transition ${
                  pathname?.startsWith('/laboratorio') || pathname?.startsWith('/practicas') || pathname?.startsWith('/presentar-practicas') || pathname?.startsWith('/liberacion')
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Prácticas
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {userName && <span className="text-sm text-muted-foreground">{userName}</span>}
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Cerrar Sesión
          </Button>
        </div>
      </div>
    </header>
  )
}
