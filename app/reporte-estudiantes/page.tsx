'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  supabase,
  EstudianteRow,
  VistaCalificacionesParcialRow,
  PeriodoParcialRow,
} from '@/lib/supabase'
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

type ParcialKey = 1 | 2 | 3
type FiltroParcial = 'all' | ParcialKey

type ParcialData = {
  parcial: ParcialKey
  nota_parcial: number
  nota_asistencia: number
  asistencias_presente: number
  total_clases_parcial: number
  tope_asistencia_parcial: number
  extras_acumulados: number
}

type EstudianteReporte = EstudianteRow & {
  notaAsistencia: number
  puntosExtra: number
  puntosActividades: number
  puntosPresentaciones: number
  notaFinal: number
  parciales: Record<ParcialKey, ParcialData | null>
}

type PeriodoInfo = {
  parcial: ParcialKey
  fecha_inicio: string
  fecha_fin: string
}

const PARCIALES: ParcialKey[] = [1, 2, 3]

function fmtFecha(iso?: string): string {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function ReporteEstudiantesPage() {
  const router = useRouter()
  const [estudiantes, setEstudiantes] = useState<EstudianteReporte[]>([])
  const [periodos, setPeriodos] = useState<PeriodoInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [filterParalelo, setFilterParalelo] = useState<string>('all')
  const [filterParcial, setFilterParcial] = useState<FiltroParcial>('all')

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

        // 4 queries en paralelo: estudiantes, nota global, notas por parcial, periodos
        const [
          { data: estudiantesData },
          { data: calificacionesData },
          { data: parcialesData },
          { data: periodosData },
        ] = await Promise.all([
          supabase.from('estudiantes').select('*').order('apellido', { ascending: true }),
          supabase.from('vista_calificaciones').select('*'),
          supabase.from('vista_calificaciones_parciales').select('*'),
          supabase.from('periodos_parciales').select('parcial, fecha_inicio, fecha_fin').eq('activo', true),
        ])

        if (!estudiantesData) return

        // Mapear calificaciones globales por estudiante_id (O(1))
        const calificacionesMap = new Map(
          (calificacionesData || []).map((c) => [c.estudiante_id, c]),
        )

        // Mapear parciales por estudiante_id -> parcial
        const parcialesMap = new Map<string, Record<ParcialKey, ParcialData | null>>()
        ;(parcialesData as VistaCalificacionesParcialRow[] | null)?.forEach((row) => {
          const entry = parcialesMap.get(row.estudiante_id) ?? { 1: null, 2: null, 3: null }
          entry[row.parcial] = {
            parcial: row.parcial,
            nota_parcial: Number(row.nota_parcial) || 0,
            nota_asistencia: Number(row.nota_asistencia) || 0,
            asistencias_presente: Number(row.asistencias_presente) || 0,
            total_clases_parcial: Number(row.total_clases_parcial) || 0,
            tope_asistencia_parcial: Number(row.tope_asistencia_parcial) || 0,
            extras_acumulados: Number(row.extras_acumulados) || 0,
          }
          parcialesMap.set(row.estudiante_id, entry)
        })

        const reporte: EstudianteReporte[] = estudiantesData.map((est) => {
          const cal = calificacionesMap.get(est.id)
          return {
            ...est,
            notaAsistencia: Number(cal?.nota_asistencia) || 0,
            puntosExtra: Number(cal?.puntos_extra) || 0,
            puntosActividades: Number(cal?.puntos_actividades) || 0,
            puntosPresentaciones: Number(cal?.puntos_presentaciones) || 0,
            notaFinal: Number(cal?.nota_final) || 0,
            parciales: parcialesMap.get(est.id) ?? { 1: null, 2: null, 3: null },
          }
        })

        setEstudiantes(reporte)
        setPeriodos(
          (periodosData as PeriodoParcialRow[] | null)?.map((p) => ({
            parcial: p.parcial,
            fecha_inicio: p.fecha_inicio,
            fecha_fin: p.fecha_fin,
          })) ?? [],
        )
      } catch (error) {
        console.error('Error fetching reporte:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReporte()
  }, [router])

  const filteredEstudiantes = useMemo(
    () =>
      filterParalelo === 'all'
        ? estudiantes
        : estudiantes.filter((e) => e.paralelo === filterParalelo),
    [estudiantes, filterParalelo],
  )

  const periodoActual = useMemo(
    () => (filterParcial === 'all' ? null : periodos.find((p) => p.parcial === filterParcial) ?? null),
    [periodos, filterParcial],
  )

  const filtroLabel = `${filterParalelo !== 'all' ? `Paralelo ${filterParalelo}` : 'General'}${
    filterParcial !== 'all' ? ` - Parcial ${filterParcial}` : ''
  }`

  const handleExportExcel = () => {
    const dataToExport = filteredEstudiantes.map((est, i) => {
      const base: Record<string, string | number> = {
        Nro: i + 1,
        Apellidos: est.apellido,
        Nombres: est.nombre,
        CI: est.ci,
        RU: est.ru,
        Paralelo: est.paralelo,
      }

      if (filterParcial === 'all') {
        PARCIALES.forEach((p) => {
          base[`Parcial ${p} (asist.)`] = (est.parciales[p]?.nota_asistencia ?? 0).toFixed(2)
          base[`Parcial ${p} (extras)`] = (est.parciales[p]?.extras_acumulados ?? 0).toFixed(2)
          base[`Parcial ${p} (nota)`] = (est.parciales[p]?.nota_parcial ?? 0).toFixed(2)
        })
      } else {
        const pv = est.parciales[filterParcial]
        base['Asistencias'] = `${pv?.asistencias_presente ?? 0}/${pv?.total_clases_parcial ?? 0}`
        base['Pts Asistencia'] = `${(pv?.nota_asistencia ?? 0).toFixed(2)}/${pv?.tope_asistencia_parcial ?? 0}`
        base['Extras acumulados'] = (pv?.extras_acumulados ?? 0).toFixed(2)
        base['Nota Parcial'] = (pv?.nota_parcial ?? 0).toFixed(2)
      }

      base['Asistencia global'] = est.notaAsistencia.toFixed(2)
      base['Extras'] = est.puntosExtra.toFixed(2)
      base['Actividades'] = est.puntosActividades.toFixed(2)
      base['Presentaciones'] = est.puntosPresentaciones.toFixed(2)
      base['Nota Final'] = est.notaFinal.toFixed(2)
      return base
    })

    const worksheet = XLSX.utils.json_to_sheet(dataToExport)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte')
    XLSX.writeFile(workbook, `Reporte_Sentri_${filtroLabel.replace(/ /g, '_')}.xlsx`)
  }

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' })

    doc.setFontSize(16)
    doc.text(`Reporte de Estudiantes - ${filtroLabel}`, 14, 20)

    doc.setFontSize(10)
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-BO')}`, 14, 28)
    if (periodoActual) {
      doc.text(
        `Periodo: ${fmtFecha(periodoActual.fecha_inicio)} a ${fmtFecha(periodoActual.fecha_fin)}`,
        14,
        34,
      )
    }

    let tableColumn: string[]
    let tableRows: (string | number)[][]

    if (filterParcial === 'all') {
      tableColumn = [
        'Nro', 'Apellidos y Nombres', 'CI', 'RU', 'Paralelo',
        'P1', 'P2', 'P3', 'Nota Final',
      ]
      tableRows = filteredEstudiantes.map((est, i) => [
        i + 1,
        `${est.apellido} ${est.nombre}`,
        est.ci,
        est.ru,
        est.paralelo,
        (est.parciales[1]?.nota_parcial ?? 0).toFixed(2),
        (est.parciales[2]?.nota_parcial ?? 0).toFixed(2),
        (est.parciales[3]?.nota_parcial ?? 0).toFixed(2),
        est.notaFinal.toFixed(2),
      ])
    } else {
      tableColumn = [
        'Nro', 'Apellidos y Nombres', 'CI', 'RU', 'Paralelo',
        'Asist.', 'Pts Asist.', 'Extras', 'Nota Parcial', 'Nota Final',
      ]
      tableRows = filteredEstudiantes.map((est, i) => {
        const pv = est.parciales[filterParcial]
        return [
          i + 1,
          `${est.apellido} ${est.nombre}`,
          est.ci,
          est.ru,
          est.paralelo,
          `${pv?.asistencias_presente ?? 0}/${pv?.total_clases_parcial ?? 0}`,
          `${(pv?.nota_asistencia ?? 0).toFixed(2)}/${pv?.tope_asistencia_parcial ?? 0}`,
          (pv?.extras_acumulados ?? 0).toFixed(2),
          (pv?.nota_parcial ?? 0).toFixed(2),
          est.notaFinal.toFixed(2),
        ]
      })
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: periodoActual ? 40 : 35,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 118, 110] },
    })

    doc.save(`Reporte_Sentri_${filtroLabel.replace(/ /g, '_')}.pdf`)
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
            <h1 className="text-3xl font-bold tracking-tight">Reporte de Estudiantes</h1>
            <p className="text-muted-foreground mt-2">
              Visualiza y exporta las notas por parcial y por paralelo.
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
            <Select
              value={String(filterParcial)}
              onValueChange={(v) => setFilterParcial(v === 'all' ? 'all' : (Number(v) as ParcialKey))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar Parcial" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Los 3 parciales</SelectItem>
                <SelectItem value="1">Parcial 1</SelectItem>
                <SelectItem value="2">Parcial 2</SelectItem>
                <SelectItem value="3">Parcial 3</SelectItem>
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
            <CardDescription>
              Mostrando {filteredEstudiantes.length} estudiantes - {filtroLabel}
              {periodoActual && ` (${fmtFecha(periodoActual.fecha_inicio)} a ${fmtFecha(periodoActual.fecha_fin)})`}
            </CardDescription>
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
                      {filterParcial === 'all' ? (
                        <>
                          <TableHead className="text-center">P1</TableHead>
                          <TableHead className="text-center">P2</TableHead>
                          <TableHead className="text-center">P3</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className="text-center">Asist.</TableHead>
                          <TableHead className="text-center">Pts Asist.</TableHead>
                          <TableHead className="text-center">Extras</TableHead>
                          <TableHead className="text-center font-bold">Nota Parcial</TableHead>
                        </>
                      )}
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
                        {filterParcial === 'all' ? (
                          <>
                            {PARCIALES.map((p) => (
                              <TableCell key={p} className="text-center">
                                {(est.parciales[p]?.nota_parcial ?? 0).toFixed(2)}
                              </TableCell>
                            ))}
                          </>
                        ) : (
                          (() => {
                            const pv = est.parciales[filterParcial]
                            return (
                              <>
                                <TableCell className="text-center">
                                  {pv?.asistencias_presente ?? 0}/{pv?.total_clases_parcial ?? 0}
                                </TableCell>
                                <TableCell className="text-center">
                                  {(pv?.nota_asistencia ?? 0).toFixed(2)}/{pv?.tope_asistencia_parcial ?? 0}
                                </TableCell>
                                <TableCell className="text-center text-emerald-600 dark:text-emerald-400">
                                  +{(pv?.extras_acumulados ?? 0).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-center font-semibold">
                                  {(pv?.nota_parcial ?? 0).toFixed(2)}
                                </TableCell>
                              </>
                            )
                          })()
                        )}
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
