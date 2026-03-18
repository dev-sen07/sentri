'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
  const [userRole, setUserRole] = useState<'estudiante' | 'auxiliar' | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push('/login')
          return
        }

        // Get user role
        const { data: roleData, error: roleError } = await supabase
          .from('usuarios_roles')
          .select('rol')
          .eq('user_id', session.user.id)
          .single()

        if (roleError) {
          console.error('Error fetching user role:', roleError.message, roleError.details)
        }

        if (roleData) {
          setUserRole(roleData.rol as 'estudiante' | 'auxiliar')
        }
        console.log('Role data:', roleData)

        setUserName(session.user.email?.split('@')[0] || 'Usuario')
        setLoading(false)
      } catch (error) {
        console.error('Error checking auth:', error)
        router.push('/login')
      }
    }

    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Bienvenido, {userName}
            </h1>
            <p className="text-muted-foreground mt-2">
              {userRole === 'auxiliar'
                ? 'Gestiona estudiantes y asistencias'
                : 'Consulta tus registros de asistencia'}
            </p>
          </div>

          {userRole === 'auxiliar' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Estudiantes</CardTitle>
                  <CardDescription>Ver lista de estudiantes</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <Link href="/estudiantes">Acceder</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Registrar Estudiante</CardTitle>
                  <CardDescription>Agregar nuevo estudiante</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <Link href="/registrar-estudiante">Acceder</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Marcar Asistencia</CardTitle>
                  <CardDescription>Registrar asistencias</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <Link href="/marcar-asistencia">Acceder</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Ver Asistencias</CardTitle>
                  <CardDescription>Historial de asistencias</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <Link href="/ver-asistencias">Acceder</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {userRole === 'estudiante' && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Mis Asistencias</CardTitle>
                  <CardDescription>Ver tus registros de asistencia</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <Link href="/mis-asistencias">Ver Asistencias</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Mi Perfil</CardTitle>
                  <CardDescription>Ver información personal</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <Link href="/mi-perfil">Ver Perfil</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
