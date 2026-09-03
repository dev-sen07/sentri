'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Download, GraduationCap, Table as TableIcon, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type LiberacionReporte = {
  id: string
  nombre: string
  ru: string
  nota: number | null
  estado: string
  horario_seleccionado: string | null
}

export default function ReporteLiberacionPage() {
  const router = useRouter()
  const [registros, setRegistros] = useState<LiberacionReporte[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEstado, setFilterEstado] = useState<string>('all')

  useEffect(() => {
    const fetchReporte = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
          return
        }

        const { data: roleData } = await supabase
          .from('usuarios_roles')
          .select('rol')
          .eq('user_id', session.user.id)
          .single()

        if (!roleData || roleData.rol !== 'auxiliar') {
          router.push('/dashboard')
          return
        }

        const { data: liberacionesData } = await supabase
          .from('liberaciones')
          .select('id, nombre, ru, nota, estado, horario_seleccionado')
          .not('ru', 'like', 'CONFIG_%')
          .order('nombre', { ascending: true })

        if (liberacionesData) {
          setRegistros(liberacionesData)
        }
      } catch (error) {
        console.error('Error fetching reporte liberación:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReporte()
  }, [router])

  const filteredRegistros = filterEstado === 'all'
    ? registros
    : registros.filter(r => r.estado === filterEstado)

  const estadoLabel = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'Pendiente'
      case 'confirmado': return 'Confirmado'
      case 'en_examen': return 'En Examen'
      case 'finalizado': return 'Finalizado'
      default: return estado
    }
  }

  const estadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
      case 'confirmado': return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
      case 'en_examen': return 'bg-orange-500/15 text-orange-400 border-orange-500/30'
      case 'finalizado': return 'bg-green-500/15 text-green-400 border-green-500/30'
      default: return 'bg-white/10 text-white/60'
    }
  }

  const handleExportExcel = () => {
    const dataToExport = filteredRegistros.map((reg, i) => ({
      'Nro': i + 1,
      'Nombre': reg.nombre,
      'RU': reg.ru,
      'Nota': reg.nota !== null ? reg.nota : 'Sin calificar',
      'Estado': estadoLabel(reg.estado),
    }))

    const worksheet = XLSX.utils.json_to_sheet(dataToExport)

    // Auto-size columns
    const colWidths = [
      { wch: 5 },   // Nro
      { wch: 35 },  // Nombre
      { wch: 12 },  // RU
      { wch: 15 },  // Nota
      { wch: 15 },  // Estado
    ]
    worksheet['!cols'] = colWidths

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Liberación')
    XLSX.writeFile(workbook, `Reporte_Liberacion_${filterEstado !== 'all' ? estadoLabel(filterEstado) : 'General'}.xlsx`)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
          <p className="text-muted-foreground animate-pulse">Cargando reporte...</p>
        </div>
      </div>
    )
  }

  // Stats
  const totalRegistros = registros.length
  const finalizados = registros.filter(r => r.estado === 'finalizado').length
  const conNota = registros.filter(r => r.nota !== null)
  const promedioNota = conNota.length > 0
    ? (conNota.reduce((sum, r) => sum + (r.nota || 0), 0) / conNota.length).toFixed(2)
    : '—'

  return (
    <div className="bg-background">
      <main className="max-w-7xl mx-auto px-4 pt-8 pb-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Dashboard
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/15 rounded-xl">
                <GraduationCap className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Reporte de Liberación</h1>
                <p className="text-muted-foreground mt-1">
                  Notas del examen de liberación de los estudiantes.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="en_examen">En Examen</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20"
              onClick={handleExportExcel}
            >
              <TableIcon className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Registrados</p>
              <p className="text-3xl font-bold text-amber-500">{totalRegistros}</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/20 bg-gradient-to-br from-green-500/10 to-emerald-500/5">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Finalizados</p>
              <p className="text-3xl font-bold text-green-500">{finalizados}</p>
            </CardContent>
          </Card>
          <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-purple-500/5">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Promedio Notas</p>
              <p className="text-3xl font-bold text-violet-500">{promedioNota}</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Listado de Exámenes de Liberación</CardTitle>
            <CardDescription>
              Mostrando {filteredRegistros.length} registro{filteredRegistros.length !== 1 ? 's' : ''} {filterEstado !== 'all' ? `con estado "${estadoLabel(filterEstado)}"` : ''}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredRegistros.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No hay registros para mostrar.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12 text-center">Nro</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>RU</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead className="text-right font-bold text-amber-500">Nota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegistros.map((reg, index) => (
                      <TableRow key={reg.id}>
                        <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{reg.nombre}</TableCell>
                        <TableCell>{reg.ru}</TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${estadoColor(reg.estado)}`}>
                            {estadoLabel(reg.estado)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {reg.nota !== null ? (
                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 font-bold">
                              {reg.nota}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Sin calificar</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
