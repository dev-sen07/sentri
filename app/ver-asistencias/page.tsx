'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, AsistenciaRow } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AsistenciaWithEstudiante extends AsistenciaRow {
  estudiantes?: {
    nombre: string
    apellido: string
    paralelo?: string
  }
}

export default function VerAsistenciasPage() {
  const router = useRouter()
  const [asistencias, setAsistencias] = useState<AsistenciaWithEstudiante[]>([])
  const [filteredAsistencias, setFilteredAsistencias] = useState<AsistenciaWithEstudiante[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<'todos' | 'presente' | 'ausente' | 'retraso'>(
    'todos'
  )

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

        // Check if user is auxiliar
        const { data: roleData } = await supabase
          .from('usuarios_roles')
          .select('rol')
          .eq('user_id', session.user.id)
          .single()

        if (!roleData || roleData.rol !== 'auxiliar') {
          router.push('/dashboard')
          return
        }

        // Fetch asistencias with student names
        const { data: asistenciasData, error } = await supabase
          .from('asistencias')
          .select(
            `
            *,
            estudiantes:estudiante_id(nombre, apellido, paralelo)
          `
          )
          .order('fecha', { ascending: false })

        if (error) throw error

        setAsistencias(asistenciasData as AsistenciaWithEstudiante[] || [])
        setFilteredAsistencias(asistenciasData as AsistenciaWithEstudiante[] || [])
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndFetchData()
  }, [router])

  useEffect(() => {
    let filtered = asistencias

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (a) =>
          a.estudiantes?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.estudiantes?.apellido.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by estado
    if (estadoFilter !== 'todos') {
      filtered = filtered.filter((a) => a.estado === estadoFilter)
    }

    setFilteredAsistencias(filtered)
  }, [searchTerm, estadoFilter, asistencias])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Historial de Asistencias</h1>
            <p className="text-muted-foreground mt-2">
              Total: {filteredAsistencias.length} registros
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
              <CardDescription>Busca y filtra registros de asistencia</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Buscar por estudiante</label>
                <Input
                  placeholder="Nombre o apellido..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Estado</label>
                <Select value={estadoFilter} onValueChange={(value: any) => setEstadoFilter(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="presente">Presente</SelectItem>
                    <SelectItem value="ausente">Ausente</SelectItem>
                    <SelectItem value="retraso">Retraso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Asistencias</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredAsistencias.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No hay registros de asistencia
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estudiante</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAsistencias.map((asistencia) => (
                        <TableRow key={asistencia.id}>
                          <TableCell className="font-medium">
                            {asistencia.estudiantes?.apellido}, {asistencia.estudiantes?.nombre} {asistencia.estudiantes?.paralelo ? `(Paralelo ${asistencia.estudiantes.paralelo})` : ''}
                          </TableCell>
                          <TableCell>
                            {new Date(asistencia.fecha).toLocaleDateString('es-ES')}
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
