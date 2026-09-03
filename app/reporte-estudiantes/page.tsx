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
import { FileText, Table as TableIcon } from 'lucide-react'

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

  // ─── Pagination ──────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

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

        // 2 queries optimizadas en lugar de 5:
        // 1. Estudiantes ordenados
        // 2. Vista de calificaciones (todo precalculado en SQL)
        const [
          { data: estudiantesData },
          { data: calificacionesData },
        ] = await Promise.all([
          supabase.from('estudiantes').select('*').order('apellido', { ascending: true }),
          supabase.from('vista_calificaciones').select('*'),
        ])

        if (!estudiantesData) return

        // Mapear calificaciones por estudiante_id para acceso O(1)
        const calificacionesMap = new Map(
          (calificacionesData || []).map(c => [c.estudiante_id, c])
        )

        const reporte = estudiantesData.map(est => {
          const cal = calificacionesMap.get(est.id)

          return {
            ...est,
            notaAsistencia: Number(cal?.nota_asistencia) || 0,
            puntosExtra: Number(cal?.puntos_extra) || 0,
            puntosActividades: Number(cal?.puntos_actividades) || 0,
            puntosPresentaciones: Number(cal?.puntos_presentaciones) || 0,
            notaFinal: Number(cal?.nota_final) || 0,
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

  // Reset to page 1 when filter or rows-per-page changes
  useEffect(() => { setCurrentPage(1) }, [filterParalelo, rowsPerPage])

  // Pagination math
  const totalRows = filteredEstudiantes.length
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage))
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows)
  const paginatedEstudiantes = filteredEstudiantes.slice(startIndex, endIndex)

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
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="bg-background">
      <main className="max-w-7xl mx-auto px-3 sm:px-4 pt-6 sm:pt-8 pb-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reporte Final</h1>
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
              Visualiza y exporta las notas consolidadas de los estudiantes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Select value={filterParalelo} onValueChange={setFilterParalelo}>
              <SelectTrigger className="w-[150px] sm:w-[160px]">
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
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg">Listado de Estudiantes</CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-0.5">
                  {totalRows === 0
                    ? 'No hay estudiantes para mostrar.'
                    : `Mostrando ${startIndex + 1}–${endIndex} de ${totalRows} estudiantes`}
                </CardDescription>
              </div>
              {/* Rows per page selector */}
              {totalRows > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                  <span className="text-xs hidden sm:inline">Filas por página:</span>
                  <Select value={String(rowsPerPage)} onValueChange={v => setRowsPerPage(Number(v))}>
                    <SelectTrigger className="h-8 w-[70px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {filteredEstudiantes.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No hay estudiantes para mostrar.</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Apellidos y Nombres</TableHead>
                        <TableHead className="hidden sm:table-cell">CI</TableHead>
                        <TableHead className="hidden md:table-cell">RU</TableHead>
                        <TableHead className="text-center">Paralelo</TableHead>
                        <TableHead className="text-right font-bold text-primary">Nota Final</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEstudiantes.map((est, index) => (
                        <TableRow key={est.id}>
                          <TableCell className="text-center text-muted-foreground text-xs">{startIndex + index + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{est.apellido} {est.nombre}</TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">{est.ci}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{est.ru}</TableCell>
                          <TableCell className="text-center font-semibold text-sm">{est.paralelo}</TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-primary/10 text-primary font-bold text-sm">
                              {est.notaFinal.toFixed(2)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* ─── Pagination Controls ─── */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground order-2 sm:order-1">
                      Página <span className="font-semibold">{currentPage}</span> de <span className="font-semibold">{totalPages}</span>
                    </p>
                    <div className="flex items-center gap-1 order-1 sm:order-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        «
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        ‹ Anterior
                      </Button>

                      {/* Page number pills */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(page =>
                            page === 1 ||
                            page === totalPages ||
                            Math.abs(page - currentPage) <= 1
                          )
                          .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
                            if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('ellipsis')
                            acc.push(page)
                            return acc
                          }, [])
                          .map((item, idx) =>
                            item === 'ellipsis' ? (
                              <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground text-xs">…</span>
                            ) : (
                              <Button
                                key={item}
                                variant={currentPage === item ? 'default' : 'outline'}
                                size="sm"
                                className="h-8 w-8 p-0 text-xs"
                                onClick={() => setCurrentPage(item as number)}
                              >
                                {item}
                              </Button>
                            )
                          )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Siguiente ›
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                      >
                        »
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
