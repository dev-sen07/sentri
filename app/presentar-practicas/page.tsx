'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, PresentacionTareaRow, PresentacionEntregaRow, ArchivoMetadata, EstudianteRow } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  FileUp,
  Plus,
  Upload,
  Trash2,
  ExternalLink,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  FileCode,
  ChevronLeft,
  Send,
  MessageSquare,
  Star,
  Eye,
} from 'lucide-react'
import { LaboratorioTabs } from '@/components/laboratorio-tabs'

type UserRole = 'estudiante' | 'auxiliar' | 'delegado'

type EntregaConEstudiante = PresentacionEntregaRow & {
  estudiantes?: EstudianteRow
}

export default function PresentarPracticasPage() {
  const router = useRouter()
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [estudianteId, setEstudianteId] = useState<string | null>(null)
  const [estudianteNombre, setEstudianteNombre] = useState<string>('')
  const [estudianteParalelo, setEstudianteParalelo] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      setUserId(session.user.id)

      const { data: roleData } = await supabase
        .from('usuarios_roles')
        .select('rol')
        .eq('user_id', session.user.id)
        .single()

      if (!roleData) { router.push('/dashboard'); return }
      const role = roleData.rol as UserRole
      setUserRole(role)

      if (role === 'estudiante' || role === 'delegado') {
        const { data: est } = await supabase
          .from('estudiantes')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (est) {
          setEstudianteId(est.id)
          setEstudianteNombre(`${est.nombre} ${est.apellido}`)
          setEstudianteParalelo(est.paralelo)
        }
      }

      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground animate-pulse">Cargando...</p>
        </div>
      </div>
    )
  }

  if (userRole === 'auxiliar') {
    return <AuxiliarView />
  }

  return (
    <EstudianteView
      estudianteId={estudianteId!}
      estudianteNombre={estudianteNombre}
      estudianteParalelo={estudianteParalelo}
    />
  )
}

/* ═══════════════════════════════════════════════════════════════
   VISTA ESTUDIANTE
   ═══════════════════════════════════════════════════════════════ */

function EstudianteView({
  estudianteId,
  estudianteNombre,
  estudianteParalelo,
}: {
  estudianteId: string
  estudianteNombre: string
  estudianteParalelo: string
}) {
  const [tareas, setTareas] = useState<PresentacionTareaRow[]>([])
  const [entregas, setEntregas] = useState<Record<string, PresentacionEntregaRow>>({})
  const [loading, setLoading] = useState(true)
  const [selectedTarea, setSelectedTarea] = useState<PresentacionTareaRow | null>(null)

  const fetchData = useCallback(async () => {
    // Fetch tasks for student's paralelo
    const { data: tareasData } = await supabase
      .from('presentaciones_tareas')
      .select('*')
      .eq('paralelo', estudianteParalelo)
      .order('creado_en', { ascending: false })

    if (tareasData) setTareas(tareasData)

    // Fetch student's submissions
    const { data: entregasData } = await supabase
      .from('presentaciones_entregas')
      .select('*')
      .eq('estudiante_id', estudianteId)

    if (entregasData) {
      const map: Record<string, PresentacionEntregaRow> = {}
      entregasData.forEach((e) => { map[e.tarea_id] = e as PresentacionEntregaRow })
      setEntregas(map)
    }

    setLoading(false)
  }, [estudianteId, estudianteParalelo])

  useEffect(() => { fetchData() }, [fetchData])

  if (selectedTarea) {
    return (
      <EntregaDetailView
        tarea={selectedTarea}
        entrega={entregas[selectedTarea.id] || null}
        estudianteId={estudianteId}
        estudianteNombre={estudianteNombre}
        onBack={() => { setSelectedTarea(null); fetchData() }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-4 pt-8 pb-20">
        <LaboratorioTabs />
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-600 to-blue-700 p-8 text-white shadow-xl mb-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.90_0.10_180/0.25)_0%,_transparent_60%)]" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <FileUp className="w-6 h-6" />
              </div>
              <span className="text-white/70 text-sm font-medium uppercase tracking-widest">Entregas</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">Presentar Prácticas</h1>
            <p className="text-white/80">Sube tus archivos .py y .pdf para cada práctica asignada.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : tareas.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileUp className="w-12 h-12 text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No hay tareas asignadas</p>
              <p className="text-sm text-muted-foreground/70 mt-1">El auxiliar aún no ha creado tareas para tu paralelo.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {tareas.map((tarea) => {
              const entrega = entregas[tarea.id]
              const estado = entrega ? entrega.estado : 'pendiente'

              return (
                <Card
                  key={tarea.id}
                  className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border"
                  onClick={() => setSelectedTarea(tarea)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold truncate">{tarea.titulo}</h3>
                          <StatusBadge estado={estado} nota={entrega?.nota} />
                        </div>
                        {tarea.descripcion && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{tarea.descripcion}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {tarea.fecha_limite && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              Límite: {new Date(tarea.fecha_limite).toLocaleDateString('es-BO')}
                            </span>
                          )}
                          {tarea.ponderacion > 0 && (
                            <span className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5" />
                              Vale {tarea.ponderacion} pts
                            </span>
                          )}
                          {entrega && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" />
                              {(entrega.archivos as ArchivoMetadata[]).length} archivo(s)
                            </span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground group-hover:text-primary">
                        {estado === 'pendiente' ? 'Entregar →' : 'Ver detalle →'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   DETALLE DE ENTREGA (ESTUDIANTE)
   ═══════════════════════════════════════════════════════════════ */

function EntregaDetailView({
  tarea,
  entrega,
  estudianteId,
  estudianteNombre,
  onBack,
}: {
  tarea: PresentacionTareaRow
  entrega: PresentacionEntregaRow | null
  estudianteId: string
  estudianteNombre: string
  onBack: () => void
}) {
  const [archivos, setArchivos] = useState<ArchivoMetadata[]>(
    entrega ? (entrega.archivos as ArchivoMetadata[]) : []
  )
  const [driveFolderId, setDriveFolderId] = useState<string | null>(entrega?.drive_folder_id ?? null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isRevisado = entrega?.estado === 'revisado'

  const handleFiles = async (files: FileList | File[]) => {
    setError(null)
    const fileArray = Array.from(files)

    // Validate extensions
    for (const f of fileArray) {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase()
      if (ext !== '.py' && ext !== '.pdf') {
        setError(`Archivo "${f.name}" no permitido. Solo .py y .pdf`)
        return
      }
      if (f.size > 5 * 1024 * 1024) {
        setError(`Archivo "${f.name}" excede 5MB`)
        return
      }
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('studentName', estudianteNombre)
      formData.append('taskTitle', tarea.titulo)
      fileArray.forEach((f) => formData.append('files', f))

      const res = await fetch('/api/storage/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al subir archivos')
        return
      }

      setArchivos((prev) => [...prev, ...data.files])
      if (data.driveFolderId) setDriveFolderId(data.driveFolderId)
    } catch {
      setError('Error de conexión al subir archivos')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveFile = async (index: number) => {
    const file = archivos[index]
    try {
      await fetch('/api/storage/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: file.drive_file_id }),
      })
      setArchivos((prev) => prev.filter((_, i) => i !== index))
    } catch {
      setError('Error al eliminar archivo')
    }
  }

  const handleSubmit = async () => {
    if (archivos.length === 0) {
      setError('Debes subir al menos un archivo')
      return
    }

    setSaving(true)
    try {
      if (entrega) {
        // Update existing
        await supabase
          .from('presentaciones_entregas')
          .update({
            archivos: archivos,
            drive_folder_id: driveFolderId,
            entregado_en: new Date().toISOString(),
          })
          .eq('id', entrega.id)
      } else {
        // Create new
        await supabase
          .from('presentaciones_entregas')
          .insert({
            tarea_id: tarea.id,
            estudiante_id: estudianteId,
            archivos: archivos,
            estado: 'revision',
            drive_folder_id: driveFolderId,
          })
      }
      onBack()
    } catch {
      setError('Error al guardar la entrega')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-20">
        <Button variant="ghost" onClick={onBack} className="mb-6 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4 mr-1" /> Volver a tareas
        </Button>

        {/* Task info */}
        <Card className="mb-6 border-teal-200 dark:border-teal-900 bg-gradient-to-br from-teal-500/5 to-cyan-500/5">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{tarea.titulo}</CardTitle>
                {tarea.descripcion && <CardDescription className="mt-2 text-base">{tarea.descripcion}</CardDescription>}
              </div>
              <StatusBadge estado={entrega?.estado ?? 'pendiente'} nota={entrega?.nota} />
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              {tarea.fecha_limite && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Límite: {new Date(tarea.fecha_limite).toLocaleDateString('es-BO')}
                </span>
              )}
              {tarea.ponderacion > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  Ponderación: {tarea.ponderacion} pts
                </span>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* PDF Preview */}
        {tarea.pdf_url && (
          <Card className="mb-6 border-red-200 dark:border-red-900 bg-gradient-to-br from-red-500/5 to-orange-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-500" />
                Instrucciones de la Práctica
              </CardTitle>
              <CardDescription>Revisa el PDF antes de entregar tu resolución.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl overflow-hidden border bg-white dark:bg-gray-950 mb-3">
                <iframe
                  src={tarea.pdf_url ?? undefined}
                  className="w-full h-[500px]"
                  title="PDF de la práctica"
                />
              </div>
              <Button variant="outline" size="sm" asChild className="w-full">
                <a href={tarea.pdf_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir PDF en nueva pestaña
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Revisado feedback */}
        {isRevisado && entrega && (
          <Card className="mb-6 border-emerald-200 dark:border-emerald-900 bg-gradient-to-br from-emerald-500/5 to-green-500/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">Revisado</p>
                  <p className="text-sm text-muted-foreground">
                    {entrega.revisado_en ? new Date(entrega.revisado_en).toLocaleDateString('es-BO') : ''}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{entrega.nota}</p>
                  <p className="text-xs text-muted-foreground">puntos</p>
                </div>
              </div>
              {entrega.comentario && (
                <div className="mt-3 p-3 bg-background rounded-lg border text-sm">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" /> Comentario del auxiliar:
                  </p>
                  {entrega.comentario}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Files list */}
        {archivos.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Archivos subidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {archivos.map((archivo, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-3 min-w-0">
                    {archivo.tipo === '.pdf' ? (
                      <FileText className="w-5 h-5 text-red-500 shrink-0" />
                    ) : (
                      <FileCode className="w-5 h-5 text-blue-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{archivo.nombre}</p>
                      <p className="text-xs text-muted-foreground">{(archivo.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="ghost" size="sm" asChild>
                      <a href={archivo.drive_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                    {!isRevisado && (
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveFile(i)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Upload zone (only if not revisado) */}
        {!isRevisado && (
          <>
            <div
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer mb-4 ${
                dragOver
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/20 scale-[1.01]'
                  : 'border-border hover:border-teal-400 hover:bg-muted/30'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                handleFiles(e.dataTransfer.files)
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".py,.pdf"
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
                  <p className="text-sm text-muted-foreground">Subiendo archivos...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-teal-100 dark:bg-teal-900/30 rounded-2xl">
                    <Upload className="w-8 h-8 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <p className="font-medium">Arrastra archivos aquí o haz clic para seleccionar</p>
                    <p className="text-sm text-muted-foreground mt-1">Solo archivos .py y .pdf (máximo 5MB)</p>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 rounded-lg mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={saving || archivos.length === 0}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white py-6 text-base font-semibold"
              size="lg"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Guardando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  {entrega ? 'Actualizar Entrega' : 'Enviar Entrega'}
                </span>
              )}
            </Button>
          </>
        )}
      </main>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   VISTA AUXILIAR
   ═══════════════════════════════════════════════════════════════ */

function AuxiliarView() {
  const [tareas, setTareas] = useState<PresentacionTareaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedTarea, setSelectedTarea] = useState<PresentacionTareaRow | null>(null)
  const [filterParalelo, setFilterParalelo] = useState<string>('all')

  // Form state
  const [formTitulo, setFormTitulo] = useState('')
  const [formDescripcion, setFormDescripcion] = useState('')
  const [formParalelo, setFormParalelo] = useState<string>('A')
  const [formFechaLimite, setFormFechaLimite] = useState('')
  const [formPonderacion, setFormPonderacion] = useState('')
  const [formPdfFile, setFormPdfFile] = useState<File | null>(null)
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const fetchTareas = useCallback(async () => {
    const { data } = await supabase
      .from('presentaciones_tareas')
      .select('*')
      .order('creado_en', { ascending: false })
    if (data) setTareas(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchTareas() }, [fetchTareas])

  const handleCreateTarea = async () => {
    if (!formTitulo.trim()) return
    setFormSaving(true)
    setFormError(null)
    try {
      let pdfFileId: string | null = null
      let pdfUrl: string | null = null

      // Upload PDF to Drive if provided
      if (formPdfFile) {
        const formData = new FormData()
        formData.append('studentName', 'Tareas')
        formData.append('taskTitle', formTitulo.trim())
        formData.append('files', formPdfFile)

        const res = await fetch('/api/storage/upload', { method: 'POST', body: formData })
        const data = await res.json()

        if (!res.ok) {
          setFormError(data.error || 'Error al subir el PDF')
          setFormSaving(false)
          return
        }

        pdfFileId = data.files[0].drive_file_id
        pdfUrl = data.files[0].drive_url
      }

      await supabase.from('presentaciones_tareas').insert({
        titulo: formTitulo.trim(),
        descripcion: formDescripcion.trim() || null,
        paralelo: formParalelo,
        fecha_limite: formFechaLimite ? new Date(formFechaLimite).toISOString() : null,
        ponderacion: parseFloat(formPonderacion) || 0,
        pdf_file_id: pdfFileId,
        pdf_url: pdfUrl,
      })
      setShowCreateDialog(false)
      setFormTitulo('')
      setFormDescripcion('')
      setFormParalelo('A')
      setFormFechaLimite('')
      setFormPonderacion('')
      setFormPdfFile(null)
      setFormError(null)
      fetchTareas()
    } catch (err) {
      console.error(err)
    } finally {
      setFormSaving(false)
    }
  }

  const handleDeleteTarea = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta tarea y todas sus entregas?')) return
    await supabase.from('presentaciones_tareas').delete().eq('id', id)
    fetchTareas()
  }

  if (selectedTarea) {
    return (
      <AuxiliarEntregasView
        tarea={selectedTarea}
        onBack={() => { setSelectedTarea(null); fetchTareas() }}
      />
    )
  }

  const filteredTareas = filterParalelo === 'all'
    ? tareas
    : tareas.filter((t) => t.paralelo === filterParalelo)

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-6xl mx-auto px-4 pt-8 pb-20">
        <LaboratorioTabs />
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-600 to-blue-700 p-8 text-white shadow-xl mb-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.90_0.10_180/0.25)_0%,_transparent_60%)]" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <FileUp className="w-6 h-6" />
                </div>
                <span className="text-white/70 text-sm font-medium uppercase tracking-widest">Gestión</span>
              </div>
              <h1 className="text-3xl font-bold mb-2">Presentaciones</h1>
              <p className="text-white/80">Crea tareas y revisa las entregas de los estudiantes.</p>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-white/20 hover:bg-white/30 border border-white/30 text-white backdrop-blur-sm"
            >
              <Plus className="w-4 h-4 mr-2" /> Nueva Tarea
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm text-muted-foreground">Filtrar por paralelo:</span>
          <div className="flex gap-1.5">
            {['all', 'A', 'B', 'C'].map((p) => (
              <Button
                key={p}
                variant={filterParalelo === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterParalelo(p)}
                className="min-w-[3rem]"
              >
                {p === 'all' ? 'Todos' : p}
              </Button>
            ))}
          </div>
        </div>

        {/* Tasks list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredTareas.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileUp className="w-12 h-12 text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No hay tareas creadas</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Crea una nueva tarea para que los estudiantes suban sus archivos.</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" /> Crear Tarea
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredTareas.map((tarea) => (
              <Card
                key={tarea.id}
                className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                onClick={() => setSelectedTarea(tarea)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold truncate">{tarea.titulo}</h3>
                        <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
                          Paralelo {tarea.paralelo}
                        </span>
                      </div>
                      {tarea.descripcion && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{tarea.descripcion}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {tarea.fecha_limite && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Límite: {new Date(tarea.fecha_limite).toLocaleDateString('es-BO')}
                          </span>
                        )}
                        {tarea.ponderacion > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5" />
                            {tarea.ponderacion} pts
                          </span>
                        )}
                        {tarea.pdf_url && (
                          <span className="flex items-center gap-1 text-red-500">
                            <FileText className="w-3.5 h-3.5" />
                            PDF adjunto
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" className="text-muted-foreground group-hover:text-primary">
                        <Eye className="w-4 h-4 mr-1" /> Ver entregas
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        onClick={(e) => { e.stopPropagation(); handleDeleteTarea(tarea.id) }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Task Dialog */}
        <AlertDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Nueva Tarea de Presentación
              </AlertDialogTitle>
              <AlertDialogDescription>
                Los estudiantes podrán subir archivos .py y .pdf para esta tarea.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  placeholder="Ej: Práctica 3 - POO Básico"
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="descripcion">Descripción (opcional)</Label>
                <Textarea
                  id="descripcion"
                  placeholder="Nota breve para el estudiante..."
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  rows={2}
                />
              </div>

              {/* PDF Upload */}
              <div className="space-y-1.5">
                <Label>PDF de la Práctica *</Label>
                <div
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
                    formPdfFile
                      ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
                      : 'border-border hover:border-red-400 hover:bg-muted/30'
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
                      if (file) {
                        if (!file.name.toLowerCase().endsWith('.pdf')) {
                          setFormError('Solo se permiten archivos PDF')
                          return
                        }
                        setFormPdfFile(file)
                        setFormError(null)
                      }
                    }}
                  />
                  {formPdfFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-5 h-5 text-red-500" />
                      <span className="text-sm font-medium truncate">{formPdfFile.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 h-7 px-2"
                        onClick={(e) => { e.stopPropagation(); setFormPdfFile(null) }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <Upload className="w-6 h-6 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">Haz clic para subir el PDF con las instrucciones</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Paralelo *</Label>
                  <Select value={formParalelo} onValueChange={setFormParalelo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Paralelo A</SelectItem>
                      <SelectItem value="B">Paralelo B</SelectItem>
                      <SelectItem value="C">Paralelo C</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ponderacion">Ponderación (pts)</Label>
                  <Input
                    id="ponderacion"
                    type="number"
                    min="0"
                    placeholder="Ej: 10"
                    value={formPonderacion}
                    onChange={(e) => setFormPonderacion(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fecha-limite">Fecha Límite</Label>
                <Input
                  id="fecha-limite"
                  type="datetime-local"
                  value={formFechaLimite}
                  onChange={(e) => setFormFechaLimite(e.target.value)}
                />
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button onClick={handleCreateTarea} disabled={formSaving || !formTitulo.trim()}>
                {formSaving ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Creando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Crear Tarea
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
   VISTA DE ENTREGAS POR TAREA (AUXILIAR)
   ═══════════════════════════════════════════════════════════════ */

function AuxiliarEntregasView({
  tarea,
  onBack,
}: {
  tarea: PresentacionTareaRow
  onBack: () => void
}) {
  const [entregas, setEntregas] = useState<EntregaConEstudiante[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntrega, setSelectedEntrega] = useState<EntregaConEstudiante | null>(null)

  // Grading state
  const [gradingNota, setGradingNota] = useState('')
  const [gradingComentario, setGradingComentario] = useState('')
  const [gradingSaving, setGradingSaving] = useState(false)

  const fetchEntregas = useCallback(async () => {
    const { data } = await supabase
      .from('presentaciones_entregas')
      .select('*, estudiantes(*)')
      .eq('tarea_id', tarea.id)
      .order('entregado_en', { ascending: true })

    if (data) setEntregas(data as EntregaConEstudiante[])
    setLoading(false)
  }, [tarea.id])

  useEffect(() => { fetchEntregas() }, [fetchEntregas])

  const handleGrade = async () => {
    if (!selectedEntrega || !gradingNota) return
    setGradingSaving(true)
    try {
      await supabase
        .from('presentaciones_entregas')
        .update({
          estado: 'revisado',
          nota: parseFloat(gradingNota),
          comentario: gradingComentario.trim() || null,
          revisado_en: new Date().toISOString(),
        })
        .eq('id', selectedEntrega.id)

      setSelectedEntrega(null)
      setGradingNota('')
      setGradingComentario('')
      fetchEntregas()
    } catch (err) {
      console.error(err)
    } finally {
      setGradingSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-4 pt-8 pb-20">
        <Button variant="ghost" onClick={onBack} className="mb-6 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4 mr-1" /> Volver a tareas
        </Button>

        {/* Task header */}
        <Card className="mb-6 border-teal-200 dark:border-teal-900 bg-gradient-to-br from-teal-500/5 to-cyan-500/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900/40 rounded-xl">
                <FileUp className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <CardTitle className="text-xl">{tarea.titulo}</CardTitle>
                <CardDescription className="mt-1">
                  Paralelo {tarea.paralelo} · {tarea.ponderacion > 0 ? `${tarea.ponderacion} pts` : 'Sin ponderación'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Submissions list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : entregas.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileUp className="w-12 h-12 text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Sin entregas aún</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Ningún estudiante ha entregado archivos para esta tarea.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {entregas.map((entrega) => {
              const est = entrega.estudiantes
              const archivos = entrega.archivos as ArchivoMetadata[]

              return (
                <Card key={entrega.id} className="transition-all duration-150 hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {est ? `${est.nombre[0]}${est.apellido[0]}` : '??'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            {est ? `${est.nombre} ${est.apellido}` : 'Estudiante'}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{archivos.length} archivo(s)</span>
                            <span>Entregado: {new Date(entrega.entregado_en).toLocaleDateString('es-BO')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge estado={entrega.estado} nota={entrega.nota} />
                        {entrega.estado === 'revision' ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedEntrega(entrega)
                              setGradingNota(entrega.nota?.toString() ?? '')
                              setGradingComentario(entrega.comentario ?? '')
                            }}
                            className="bg-teal-600 hover:bg-teal-700 text-white"
                          >
                            Calificar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedEntrega(entrega)
                              setGradingNota(entrega.nota?.toString() ?? '')
                              setGradingComentario(entrega.comentario ?? '')
                            }}
                          >
                            Editar nota
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Files */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {archivos.map((archivo, i) => (
                        <a
                          key={i}
                          href={archivo.drive_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-muted/50 border hover:bg-muted transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {archivo.tipo === '.pdf' ? (
                            <FileText className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <FileCode className="w-3.5 h-3.5 text-blue-500" />
                          )}
                          <span className="truncate max-w-[150px]">{archivo.nombre}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Grading Dialog */}
        <AlertDialog open={!!selectedEntrega} onOpenChange={(open) => { if (!open) setSelectedEntrega(null) }}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-teal-600" />
                Calificar Entrega
              </AlertDialogTitle>
              <AlertDialogDescription>
                {selectedEntrega?.estudiantes
                  ? `${selectedEntrega.estudiantes.nombre} ${selectedEntrega.estudiantes.apellido}`
                  : 'Estudiante'}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="nota">Nota *</Label>
                <Input
                  id="nota"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="Ej: 85"
                  value={gradingNota}
                  onChange={(e) => setGradingNota(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comentario">Comentario (opcional)</Label>
                <Textarea
                  id="comentario"
                  placeholder="Feedback para el estudiante..."
                  value={gradingComentario}
                  onChange={(e) => setGradingComentario(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button
                onClick={handleGrade}
                disabled={gradingSaving || !gradingNota}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {gradingSaving ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Guardando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Marcar como Revisado
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
   STATUS BADGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function StatusBadge({ estado, nota }: { estado: string; nota?: number | null }) {
  if (estado === 'revisado') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
        <CheckCircle className="w-3.5 h-3.5" />
        Revisado {nota !== null && nota !== undefined ? `· ${nota}` : ''}
      </span>
    )
  }
  if (estado === 'revision') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
        <Clock className="w-3.5 h-3.5" />
        En Revisión
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
      <AlertCircle className="w-3.5 h-3.5" />
      Pendiente
    </span>
  )
}
