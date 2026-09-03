'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, AsistenciaRow } from '@/lib/supabase'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function MisAsistenciasPage() {
  const router = useRouter()
  const [asistencias, setAsistencias] = useState<AsistenciaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [studentName, setStudentName] = useState<string | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    presente: 0,
    ausente: 0,
    retraso: 0,
  })

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

        // Check if user is estudiante or delegado
        const { data: roleData } = await supabase
          .from('usuarios_roles')
          .select('rol')
          .eq('user_id', session.user.id)
          .single()

        if (!roleData || (roleData.rol !== 'estudiante' && roleData.rol !== 'delegado')) {
          router.push('/dashboard')
          return
        }

        // Get student info
        const { data: estudianteData } = await supabase
          .from('estudiantes')
          .select('id, nombre, apellido')
          .eq('user_id', session.user.id)
          .single()

        if (estudianteData) {
          setStudentName(`${estudianteData.nombre} ${estudianteData.apellido}`)
        }

        // Fetch asistencias
        const { data: asistenciasData, error } = await supabase
          .from('asistencias')
          .select('*')
          .eq('estudiante_id', estudianteData?.id ?? 0)
          .order('fecha', { ascending: false })

        if (error) throw error

        const asistenciasList = asistenciasData || []
        setAsistencias(asistenciasList)
        console.log(asistenciasList)

        // Calculate stats
        const total = asistenciasList.length
        const presente = asistenciasList.filter((a) => a.estado === 'presente').length
        const ausente = asistenciasList.filter((a) => a.estado === 'ausente').length
        const retraso = asistenciasList.filter((a) => a.estado === 'retraso').length

        setStats({ total, presente, ausente, retraso })
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
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  const getEstadoBadgeColor = (estado: string) => {
    switch (estado) {
      case 'presente':
        return 'bg-green-100 text-green-800'
      case 'ausente':
        return 'bg-red-100 text-red-800'
      case 'retraso':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-background">

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mis Asistencias</h1>
            <p className="text-muted-foreground mt-2">Consulta tu historial de asistencias</p>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-green-700">Presentes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-700">{stats.presente}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-red-700">Ausentes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-700">{stats.ausente}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-yellow-700">Retrasos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-yellow-700">{stats.retraso}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Historial de Asistencias</CardTitle>
              <CardDescription>Tus registros de asistencia ordenados por fecha</CardDescription>
            </CardHeader>
            <CardContent>
              {asistencias.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No hay registros de asistencia
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {asistencias.map((asistencia) => (
                        <TableRow key={asistencia.id}>
                          <TableCell>
                            {new Date(asistencia.fecha).toLocaleDateString('es-ES', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </TableCell>
                          <TableCell>{asistencia.hora}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getEstadoBadgeColor(asistencia.estado)}`}
                            >
                              {asistencia.estado.charAt(0).toUpperCase() +
                                asistencia.estado.slice(1)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
