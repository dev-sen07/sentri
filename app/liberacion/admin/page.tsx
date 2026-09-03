'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { supabase, LiberacionRow, ArchivoMetadata } from '@/lib/supabase'
import { cacheGet, cacheSet } from '@/lib/cache'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
// Tabs: using custom underline style (see marcar-asistencia pattern)
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/* ═══════════════════════════════════════════════════════════════
   NOTA: mapRawToLiberacionRow fue eliminada.
   La tabla 'liberaciones' ahora usa columnas planas directas
   (examen_pdf_url, examen_pdf_file_id, archivos_respuesta,
   drive_folder_id, finalizado_en) — ver migración Fase 3.
   ═══════════════════════════════════════════════════════════════ */

import {
  GraduationCap,
  Search,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle,
  Upload,
  FileText,
  FileCode,
  ExternalLink,
  Trash2,
  Send,
  ArrowLeft,
  Shield,
  Users,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Plus,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   HORARIOS DISPONIBLES
   ═══════════════════════════════════════════════════════════════ */

const HORARIOS = [
  {
    id: 'sab-10',
    label: 'Sábado 20/06/2026',
    hora: '10:00 - 15:00',
    dia: 'Sábado',
    inicio: new Date('2026-06-20T10:00:00-04:00'),
    fin: new Date('2026-06-20T15:00:00-04:00'),
  },
  {
    id: 'sab-18',
    label: 'Sábado 20/06/2026',
    hora: '18:00 - 20:00',
    dia: 'Sábado',
    inicio: new Date('2026-06-20T18:00:00-04:00'),
    fin: new Date('2026-06-20T20:00:00-04:00'),
  },
  {
    id: 'sab-20',
    label: 'Sábado 20/06/2026',
    hora: '20:00 - 22:00',
    dia: 'Sábado',
    inicio: new Date('2026-06-20T20:00:00-04:00'),
    fin: new Date('2026-06-20T22:00:00-04:00'),
  },
  {
    id: 'dom-18',
    label: 'Domingo 21/06/2026',
    hora: '18:00 - 20:00',
    dia: 'Domingo',
    inicio: new Date('2026-06-21T18:00:00-04:00'),
    fin: new Date('2026-06-21T20:00:00-04:00'),
  },
  {
    id: 'dom-20',
    label: 'Domingo 21/06/2026',
    hora: '20:00 - 22:00',
    dia: 'Domingo',
    inicio: new Date('2026-06-21T20:00:00-04:00'),
    fin: new Date('2026-06-21T22:00:00-04:00'),
  },
]

export function LiberacionAdminContent() {
  const [estudiantes, setEstudiantes] = useState<LiberacionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEstudiante, setSelectedEstudiante] = useState<LiberacionRow | null>(null)
  const [showUploadExamen, setShowUploadExamen] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // Grading state
  const [gradingEstudiante, setGradingEstudiante] = useState<LiberacionRow | null>(null)
  const [gradingNota, setGradingNota] = useState('')
  const [gradingSaving, setGradingSaving] = useState(false)

  // Tab & pagination state
  const [activeTab, setActiveTab] = useState('todos')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  // Schedule-specific exam states
  const [dialogHorarioId, setDialogHorarioId] = useState(HORARIOS[0].id)
  const [currentConfig, setCurrentConfig] = useState<{ pdf_url: string; pdf_file_id: string; pdf_name?: string } | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [deletingPdf, setDeletingPdf] = useState(false)

  const fetchEstudiantes = useCallback(async () => {
    const { data } = await supabase
      .from('liberaciones')
      .select('*')
      .order('creado_en', { ascending: false })

    if (data) {
      // Filtrar registros CONFIG_* — columnas ya vienen en formato plano
      const studentRows = (data as LiberacionRow[])
        .filter((r) => !r.ru.startsWith('CONFIG_'))
      setEstudiantes(studentRows)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchEstudiantes() }, [fetchEstudiantes])

  // Fetch current config when dialogHorarioId or showUploadExamen changes
  // Los registros CONFIG_* ahora guardan el PDF en columnas planas
  useEffect(() => {
    if (!showUploadExamen) return
    const fetchConfig = async () => {
      setLoadingConfig(true)
      try {
        const { data } = await supabase
          .from('liberaciones')
          .select('examen_pdf_url, examen_pdf_file_id')
          .eq('ru', `CONFIG_${dialogHorarioId}`)
          .maybeSingle()

        if (data?.examen_pdf_url) {
          setCurrentConfig({
            pdf_url: data.examen_pdf_url,
            pdf_file_id: data.examen_pdf_file_id ?? '',
          })
        } else {
          setCurrentConfig(null)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingConfig(false)
      }
    }
    fetchConfig()
  }, [dialogHorarioId, showUploadExamen])

  const handleUploadExamen = async () => {
    if (!pdfFile) return
    setUploadingPdf(true)

    try {
      const formData = new FormData()
      formData.append('studentName', 'Liberacion')
      formData.append('taskTitle', `Examen-${dialogHorarioId}`)
      formData.append('files', pdfFile)

      const res = await fetch('/api/storage/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Error al subir el PDF')
        return
      }

      const pdfUrl = data.files[0].drive_url
      const pdfFileId = data.files[0].drive_file_id

      const configRu = `CONFIG_${dialogHorarioId}`

      // 1. Check if config row already exists
      const { data: existingConfig } = await supabase
        .from('liberaciones')
        .select('id')
        .eq('ru', configRu)
        .maybeSingle()

      if (existingConfig) {
        // Actualizar columnas planas en el registro CONFIG
        const { error: errUpdate } = await supabase
          .from('liberaciones')
          .update({
            examen_pdf_url: pdfUrl,
            examen_pdf_file_id: pdfFileId,
          })
          .eq('ru', configRu)
        if (errUpdate) throw errUpdate
      } else {
        // Crear nuevo registro CONFIG con columnas planas
        const { error: errInsert } = await supabase
          .from('liberaciones')
          .insert({
            nombre: `Config Examen ${dialogHorarioId}`,
            ru: configRu,
            examen_pdf_url: pdfUrl,
            examen_pdf_file_id: pdfFileId,
          })
        if (errInsert) throw errInsert
      }

      // 2. Update all students with this schedule: asignarles el mismo PDF
      const { error: errStudents } = await supabase
        .from('liberaciones')
        .update({
          examen_pdf_url: pdfUrl,
          examen_pdf_file_id: pdfFileId,
        })
        .eq('horario_seleccionado', dialogHorarioId)

      if (errStudents) throw errStudents

      setShowUploadExamen(false)
      setPdfFile(null)
      fetchEstudiantes()
    } catch (err) {
      console.error(err)
      alert('Error al subir el examen')
    } finally {
      setUploadingPdf(false)
    }
  }

  const handleDeleteExamen = async () => {
    if (!currentConfig) return
    if (!confirm('¿Está seguro de eliminar el examen para este horario? Todos los estudiantes de este horario perderán el acceso al examen.')) return

    setDeletingPdf(true)
    try {
      // 1. Delete from Drive
      if (currentConfig.pdf_file_id) {
        await fetch('/api/storage/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: currentConfig.pdf_file_id }),
        })
      }

      const configRu = `CONFIG_${dialogHorarioId}`

      // 2. Limpiar columnas planas del registro CONFIG
      const { error: errUpdateConfig } = await supabase
        .from('liberaciones')
        .update({
          examen_pdf_url: null,
          examen_pdf_file_id: null,
        })
        .eq('ru', configRu)
      if (errUpdateConfig) throw errUpdateConfig

      // 3. Limpiar columnas planas de estudiantes con ese horario
      const { error: errUpdateStudents } = await supabase
        .from('liberaciones')
        .update({
          examen_pdf_url: null,
          examen_pdf_file_id: null,
        })
        .eq('horario_seleccionado', dialogHorarioId)
      if (errUpdateStudents) throw errUpdateStudents

      setCurrentConfig(null)
      fetchEstudiantes()
    } catch (err) {
      console.error(err)
      alert('Error al eliminar el examen')
    } finally {
      setDeletingPdf(false)
    }
  }

  const handleGrade = async () => {
    if (!gradingEstudiante || !gradingNota) return
    setGradingSaving(true)
    try {
      const { error } = await supabase
        .from('liberaciones')
        .update({
          nota: parseFloat(gradingNota),
        })
        .eq('id', gradingEstudiante.id)

      if (error) throw error

      setGradingEstudiante(null)
      setGradingNota('')
      fetchEstudiantes()
    } catch (err) {
      console.error(err)
    } finally {
      setGradingSaving(false)
    }
  }

  // View student details
  if (selectedEstudiante) {
    const archivos = (selectedEstudiante.archivos_respuesta as ArchivoMetadata[]) || []
    const horario = HORARIOS.find(h => h.id === selectedEstudiante.horario_seleccionado)

    return (
      <div className="h-screen bg-background overflow-y-auto">
        <main className="max-w-5xl mx-auto px-4 pt-6 sm:pt-8 pb-32">
          <Button
            variant="ghost"
            onClick={() => { setSelectedEstudiante(null); fetchEstudiantes() }}
            className="mb-6 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Volver a lista
          </Button>

          {/* Student detail header */}
          <Card className="mb-6 border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {selectedEstudiante.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-xl truncate">{selectedEstudiante.nombre}</CardTitle>
                    <CardDescription className="truncate">
                      RU: {selectedEstudiante.ru}
                      {horario && ` · ${horario.label} ${horario.hora}`}
                    </CardDescription>
                  </div>
                </div>
                <div className="sm:ml-auto shrink-0">
                  <EstadoBadgeDashboard estado={selectedEstudiante.estado} />
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Response files */}
          {archivos.length > 0 ? (
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Archivos de Respuesta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {archivos.map((archivo, i) => (
                  <a
                    key={i}
                    href={archivo.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border hover:bg-muted transition-colors"
                  >
                    {archivo.tipo === '.pdf' ? (
                      <FileText className="w-5 h-5 text-red-500 shrink-0" />
                    ) : (
                      <FileCode className="w-5 h-5 text-blue-500 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{archivo.nombre}</p>
                      <p className="text-xs text-muted-foreground">{(archivo.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                  </a>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-6 border-dashed">
              <CardContent className="py-12 text-center">
                <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">El estudiante aún no ha enviado archivos.</p>
              </CardContent>
            </Card>
          )}

          {/* Grade section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" />
                Calificación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="space-y-1.5 flex-1">
                  <Label htmlFor="nota-detail">Nota</Label>
                  <Input
                    id="nota-detail"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    placeholder="Ej: 75"
                    value={gradingNota || selectedEstudiante.nota?.toString() || ''}
                    onChange={(e) => setGradingNota(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => {
                    setGradingEstudiante(selectedEstudiante)
                    handleGrade()
                  }}
                  disabled={gradingSaving}
                  className="bg-amber-600 hover:bg-amber-700 text-white mt-6"
                >
                  {gradingSaving ? 'Guardando...' : 'Guardar Nota'}
                </Button>
              </div>
              {selectedEstudiante.nota !== null && (
                <p className="text-sm text-muted-foreground mt-3">
                  Nota actual: <span className="font-bold text-foreground">{selectedEstudiante.nota}</span>/100
                </p>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // Main list view
  const pendientes = estudiantes.filter(e => e.estado === 'pendiente')
  const confirmados = estudiantes.filter(e => e.estado === 'confirmado')
  const enExamen = estudiantes.filter(e => e.estado === 'en_examen')
  const finalizados = estudiantes.filter(e => e.estado === 'finalizado')

  const tabCounts: Record<string, number> = {
    todos: estudiantes.length,
    pendiente: pendientes.length,
    confirmado: confirmados.length,
    en_examen: enExamen.length,
    finalizado: finalizados.length,
  }

  const filteredEstudiantes = activeTab === 'todos'
    ? estudiantes
    : estudiantes.filter(e => e.estado === activeTab)

  const totalPages = Math.max(1, Math.ceil(filteredEstudiantes.length / ITEMS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedEstudiantes = filteredEstudiantes.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  )

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setCurrentPage(1)
  }

  return (
    <div className="h-screen bg-background overflow-y-auto">
      <main className="max-w-6xl mx-auto px-4 pt-6 sm:pt-8 pb-32">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-700 p-6 sm:p-8 text-white shadow-xl mb-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.90_0.10_60/0.25)_0%,_transparent_60%)]" />
          <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <span className="text-white/70 text-sm font-medium uppercase tracking-widest">Gestión</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Exámenes de Liberación</h1>
              <p className="text-white/80 text-sm sm:text-base">Gestiona los exámenes de liberación y califica las respuestas.</p>
            </div>
            <Button
              onClick={() => setShowUploadExamen(true)}
              className="bg-white/20 hover:bg-white/30 border border-white/30 text-white backdrop-blur-sm w-full sm:w-auto"
            >
              <Upload className="w-4 h-4 mr-2" /> Cargar Examen PDF
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[
            { label: 'Pendientes', value: pendientes.length, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
            { label: 'Confirmados', value: confirmados.length, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
            { label: 'En Examen', value: enExamen.length, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
            { label: 'Finalizados', value: finalizados.length, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
          ].map((stat) => (
            <Card key={stat.label} className={`${stat.bg} border-0`}>
              <CardContent className="p-3 sm:p-4 text-center">
                <div className={`text-2xl sm:text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs + List */}
        <div className="flex gap-0 border-b border-border mb-6 overflow-x-auto">
          {[
            { value: 'todos', label: 'Todos' },
            { value: 'pendiente', label: 'Pendientes' },
            { value: 'confirmado', label: 'Confirmados' },
            { value: 'en_examen', label: 'En Examen' },
            { value: 'finalizado', label: 'Finalizados' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              className={`px-4 sm:px-5 py-2.5 font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 border-b-2 -mb-px shrink-0 ${
                activeTab === tab.value
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              {tab.label}
              <span className="bg-foreground/10 text-foreground/60 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                {tabCounts[tab.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : paginatedEstudiantes.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <Users className="w-12 h-12 text-muted-foreground/40 mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">Sin estudiantes</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      {activeTab === 'todos'
                        ? 'No hay estudiantes registrados para liberación.'
                        : `No hay estudiantes con estado "${activeTab.replace('_', ' ')}".`
                      }
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid gap-2 sm:gap-3">
                    {paginatedEstudiantes.map((est) => {
                      const horario = HORARIOS.find(h => h.id === est.horario_seleccionado)
                      const archivos = (est.archivos_respuesta as ArchivoMetadata[]) || []

                      return (
                        <Card
                          key={est.id}
                          className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                          onClick={() => {
                            setSelectedEstudiante(est)
                            setGradingNota(est.nota?.toString() || '')
                          }}
                        >
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center justify-between gap-3 sm:gap-4">
                              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs sm:text-sm font-bold shrink-0">
                                  {est.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold truncate text-sm sm:text-base">{est.nombre}</p>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                    <span>RU: {est.ru}</span>
                                    {horario && <span className="hidden sm:inline">{horario.label} {horario.hora}</span>}
                                    {archivos.length > 0 && <span>{archivos.length} archivo(s)</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                <EstadoBadgeDashboard estado={est.estado} />
                                {est.nota !== null && (
                                  <div className="text-right hidden sm:block">
                                    <div className="text-xs text-muted-foreground">Nota</div>
                                    <div className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{est.nota}</div>
                                  </div>
                                )}
                                {est.estado === 'finalizado' && est.nota === null && (
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setGradingEstudiante(est)
                                      setGradingNota('')
                                    }}
                                    className="bg-amber-600 hover:bg-amber-700 text-white hidden sm:flex"
                                  >
                                    Calificar
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" className="text-muted-foreground group-hover:text-primary">
                                  <Eye className="w-4 h-4" />
                                  <span className="hidden sm:inline ml-1">Ver</span>
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 gap-2">
                      <p className="text-sm text-muted-foreground hidden sm:block">
                        Mostrando {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filteredEstudiantes.length)} de {filteredEstudiantes.length}
                      </p>
                      <p className="text-xs text-muted-foreground sm:hidden">
                        Pág {safePage}/{totalPages}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safePage <= 1}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(p => {
                            // Show first, last, and neighbors of current page
                            if (totalPages <= 5) return true
                            return p === 1 || p === totalPages || Math.abs(p - safePage) <= 1
                          })
                          .map((p, idx, arr) => (
                            <span key={p} className="contents">
                              {idx > 0 && arr[idx - 1] !== p - 1 && (
                                <span className="px-1 text-muted-foreground text-xs">…</span>
                              )}
                              <Button
                                variant={p === safePage ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCurrentPage(p)}
                                className={`h-8 w-8 p-0 text-xs ${p === safePage ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
                              >
                                {p}
                              </Button>
                            </span>
                          ))}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safePage >= totalPages}
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
        </div>

        {/* Upload Exam Dialog */}
        <AlertDialog open={showUploadExamen} onOpenChange={(open) => { setShowUploadExamen(open); if (!open) setPdfFile(null); }}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-500" />
                Cargar Examen de Liberación
              </AlertDialogTitle>
              <AlertDialogDescription>
                Suba el PDF con las instrucciones del examen por horario. Se aplicará a todos los estudiantes que seleccionen este horario.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="horario-select">Horario de Examen</Label>
                <Select value={dialogHorarioId} onValueChange={setDialogHorarioId}>
                  <SelectTrigger id="horario-select">
                    <SelectValue placeholder="Seleccione un horario" />
                  </SelectTrigger>
                  <SelectContent>
                    {HORARIOS.map((horario) => (
                      <SelectItem key={horario.id} value={horario.id}>
                        {horario.label} ({horario.hora})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loadingConfig ? (
                <div className="flex items-center justify-center py-6">
                  <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500"></span>
                  <span className="ml-2 text-sm text-muted-foreground">Cargando configuración...</span>
                </div>
              ) : currentConfig ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium truncate max-w-[220px]">
                        {currentConfig.pdf_name || 'Examen Cargado.pdf'}
                      </p>
                      <a
                        href={currentConfig.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-500 hover:underline inline-flex items-center gap-1 mt-0.5"
                      >
                        Ver PDF <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-500/10 h-8 px-2 flex-shrink-0"
                    disabled={deletingPdf}
                    onClick={handleDeleteExamen}
                  >
                    {deletingPdf ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></span>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                    pdfFile
                      ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'
                      : 'border-border hover:border-amber-400 hover:bg-muted/30'
                  }`}
                  onClick={() => pdfInputRef.current?.click()}
                >
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file && file.name.toLowerCase().endsWith('.pdf')) {
                        setPdfFile(file)
                      }
                    }}
                  />
                  {pdfFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-5 h-5 text-red-500" />
                      <span className="text-sm font-medium truncate max-w-[200px]">{pdfFile.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 h-7 px-2"
                        onClick={(e) => { e.stopPropagation(); setPdfFile(null) }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">Haz clic para subir el PDF del examen</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPdfFile(null)}>Cancelar</AlertDialogCancel>
              {!currentConfig && (
                <Button
                  onClick={handleUploadExamen}
                  disabled={uploadingPdf || !pdfFile}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {uploadingPdf ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      Subiendo...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Upload className="w-4 h-4" /> Publicar Examen
                    </span>
                  )}
                </Button>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Grading Dialog */}
        <AlertDialog open={!!gradingEstudiante} onOpenChange={(open) => { if (!open) setGradingEstudiante(null) }}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" />
                Calificar Examen
              </AlertDialogTitle>
              <AlertDialogDescription>
                {gradingEstudiante?.nombre} · RU: {gradingEstudiante?.ru}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="nota-grade">Nota *</Label>
                <Input
                  id="nota-grade"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="Ej: 75"
                  value={gradingNota}
                  onChange={(e) => setGradingNota(e.target.value)}
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button
                onClick={handleGrade}
                disabled={gradingSaving || !gradingNota}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {gradingSaving ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Guardando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Guardar Nota
                  </span>
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ESTADO BADGE (DASHBOARD - LIGHT THEME)
   ═══════════════════════════════════════════════════════════════ */

function EstadoBadgeDashboard({ estado }: { estado: string | null }) {
  const config: Record<string, { text: string; className: string; icon: React.ReactNode }> = {
    pendiente: {
      text: 'Pendiente',
      className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    confirmado: {
      text: 'Confirmado',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      icon: <CheckCircle className="w-3.5 h-3.5" />,
    },
    en_examen: {
      text: 'En Examen',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      icon: <GraduationCap className="w-3.5 h-3.5" />,
    },
    finalizado: {
      text: 'Finalizado',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      icon: <CheckCircle className="w-3.5 h-3.5" />,
    },
  }

  const c = config[estado ?? 'pendiente'] || config.pendiente
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${c.className}`}>
      {c.icon}
      {c.text}
    </span>
  )
}

export default function LiberacionAdminPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/laboratorio?tab=liberacion')
  }, [router])
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  )
}
