'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, EstudianteRow } from '@/lib/supabase'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function MiPerfilPage() {
  const router = useRouter()
  const [estudiante, setEstudiante] = useState<EstudianteRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push('/login')
          return
        }

        // Check if user is estudiante
        const { data: roleData } = await supabase
          .from('usuarios_roles')
          .select('rol')
          .eq('user_id', session.user.id)
          .single()

        if (!roleData || roleData.rol !== 'estudiante') {
          router.push('/dashboard')
          return
        }

        // Get student info
        const { data: estudianteData } = await supabase
          .from('estudiantes')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (estudianteData) {
          setEstudiante(estudianteData)
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndFetchData()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  if (!estudiante) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">No se encontraron datos del estudiante</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="grid gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mi Perfil</h1>
            <p className="text-muted-foreground mt-2">Información personal del estudiante</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Información Personal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nombre</p>
                  <p className="text-lg font-semibold mt-1">{estudiante.nombre}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Apellido</p>
                  <p className="text-lg font-semibold mt-1">{estudiante.apellido}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">CI (Cédula)</p>
                    <p className="text-lg font-semibold mt-1">{estudiante.ci}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">RU (Registro Único)</p>
                    <p className="text-lg font-semibold mt-1">{estudiante.ru}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Correo Electrónico</p>
                  <p className="text-lg font-semibold mt-1">{estudiante.correo}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
