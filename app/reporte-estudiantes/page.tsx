'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, EstudianteRow } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
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
import { Download, FileText, Table as TableIcon } from 'lucide-react'

// Constants used for attendance points (same as mi-perfil)
const TOTAL_CLASES = 10
const PUNTOS_MAXIMOS = 10

type EstudianteReporte = EstudianteRow & {
  notaAsistencia: number
  puntosExtra: number
  puntosActividades: number
  puntosPresentaciones: number
  notaFinal: number
}

export default function ReporteEstudiantesPage() {
  const router = useRouter()
  const [estudiantes, setEstudiantes] = useState<EstudianteReporte[]>([])
  const [loading, setLoading] = useState(true)
  const [filterParalelo, setFilterParalelo] = useState<string>('all')

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

        // Fetch all data needed
        const [
          { data: estudiantesData },
          { data: asistenciasData },
          { data: extrasData },
          { data: actividadesData },
          { data: entregasData },
        ] = await Promise.all([
          supabase.from('estudiantes').select('*').order('apellido', { ascending: true }),
          supabase.from('asistencias').select('estudiante_id, estado'),
          supabase.from('extras').select('estudiante_id, puntos'),
          supabase.from('actividad_participantes').select('estudiante_id, actividades(ponderacion)'),
          supabase.from('presentaciones_entregas').select('estudiante_id, nota').eq('estado', 'revisado'),
        ])

        if (!estudiantesData) return

        const reporte = estudiantesData.map(est => {
          // Asistencias
          const presences = (asistenciasData || []).filter(
            a => a.estudiante_id === est.id && a.estado === 'presente'
          ).length
          const notaAsistencia = Math.min((presences / TOTAL_CLASES) * PUNTOS_MAXIMOS, PUNTOS_MAXIMOS)

          // Extras
          const extras = (extrasData || [])
            .filter(e => e.estudiante_id === est.id)
            .reduce((acc, curr) => acc + (Number(curr.puntos) || 0), 0)

          // Actividades
          const actividades = (actividadesData || [])
            .filter(a => a.estudiante_id === est.id)
            .reduce((acc, curr) => {
              const act = Array.isArray(curr.actividades) ? curr.actividades[0] : curr.actividades
              return acc + (Number(act?.ponderacion) || 0)
            }, 0)

          // Presentaciones
          const presentaciones = (entregasData || [])
            .filter(e => e.estudiante_id === est.id)
            .reduce((acc, curr) => acc + (Number(curr.nota) || 0), 0)

          const notaFinal = notaAsistencia + extras + actividades + presentaciones

          return {
            ...est,
            notaAsistencia,
            puntosExtra: extras,
            puntosActividades: actividades,
            puntosPresentaciones: presentaciones,
            notaFinal
          }
        })

        setEstudiantes(reporte)
      } catch (error) {
        console.error('Error fetching reporte:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReporte()
  }, [router])

  const filteredEstudiantes = filterParalelo === 'all' 
    ? estudiantes 
    : estudiantes.filter(e => e.paralelo === filterParalelo)

  const handleExportExcel = () => {
    const dataToExport = filteredEstudiantes.map((est, i) => ({
      'Nro': i + 1,
      'Apellidos': est.apellido,
      'Nombres': est.nombre,
      'CI': est.ci,
      'RU': est.ru,
      'Paralelo': est.paralelo,
      'Asistencias (pts)': est.notaAsistencia.toFixed(2),
      'Extras': est.puntosExtra.toFixed(2),
      'Actividades': est.puntosActividades.toFixed(2),
      'Prácticas': est.puntosPresentaciones.toFixed(2),
      'Nota Final': est.notaFinal.toFixed(2)
    }))

    const worksheet = XLSX.utils.json_to_sheet(dataToExport)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Final")
    XLSX.writeFile(workbook, `Reporte_Final_Sentri_${filterParalelo !== 'all' ? `Paralelo_${filterParalelo}` : 'General'}.xlsx`)
  }

  const handleExportPDF = () => {
    const doc = new jsPDF()
    
    // Header
    doc.setFontSize(16)
    doc.text(`Reporte Final de Estudiantes - ${filterParalelo !== 'all' ? `Paralelo ${filterParalelo}` : 'General'}`, 14, 20)
    
    doc.setFontSize(10)
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-BO')}`, 14, 28)

    const tableColumn = ["Nro", "Apellidos y Nombres", "CI", "RU", "Paralelo", "Nota Final"]
    const tableRows = filteredEstudiantes.map((est, i) => [
      i + 1,
      `${est.apellido} ${est.nombre}`,
      est.ci,
      est.ru,
      est.paralelo,
      est.notaFinal.toFixed(2)
    ])

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 118, 110] } // teal-700
    })

    doc.save(`Reporte_Final_Sentri_${filterParalelo !== 'all' ? `Paralelo_${filterParalelo}` : 'General'}.pdf`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 pt-8 pb-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reporte Final</h1>
            <p className="text-muted-foreground mt-2">
              Visualiza y exporta las notas consolidadas de los estudiantes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <Select value={filterParalelo} onValueChange={setFilterParalelo}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filtrar Paralelo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los paralelos</SelectItem>
                <SelectItem value="A">Paralelo A</SelectItem>
                <SelectItem value="B">Paralelo B</SelectItem>
                <SelectItem value="C">Paralelo C</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20" onClick={handleExportExcel}>
              <TableIcon className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" className="border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={handleExportPDF}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Listado de Estudiantes</CardTitle>
            <CardDescription>Mostrando {filteredEstudiantes.length} estudiantes del paralelo seleccionado.</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredEstudiantes.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No hay estudiantes para mostrar.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12 text-center">Nro</TableHead>
                      <TableHead>Apellidos y Nombres</TableHead>
                      <TableHead>CI</TableHead>
                      <TableHead>RU</TableHead>
                      <TableHead className="text-center">Paralelo</TableHead>
                      <TableHead className="text-right font-bold text-primary">Nota Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEstudiantes.map((est, index) => (
                      <TableRow key={est.id}>
                        <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{est.apellido} {est.nombre}</TableCell>
                        <TableCell>{est.ci}</TableCell>
                        <TableCell>{est.ru}</TableCell>
                        <TableCell className="text-center font-semibold">{est.paralelo}</TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-primary/10 text-primary font-bold">
                            {est.notaFinal.toFixed(2)}
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
      </main>
    </div>
  )
}
