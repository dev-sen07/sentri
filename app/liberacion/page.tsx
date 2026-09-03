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
import { LiberacionAdminContent } from './admin/page'
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

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function LiberacionContent() {
  const router = useRouter()
  const [isAuxiliar, setIsAuxiliar] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      const { data: roleData } = await supabase
        .from('usuarios_roles')
        .select('rol')
        .eq('user_id', session.user.id)
        .single()

      if (roleData?.rol === 'auxiliar') {
        setIsAuxiliar(true)
      } else {
        setUserId(session.user.id)
      }
      setCheckingAuth(false)
    }
    checkAuth()
  }, [router])

  if (checkingAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
          <p className="text-white/50 animate-pulse">Cargando...</p>
        </div>
      </div>
    )
  }

  if (isAuxiliar) {
    return <LiberacionAdminContent />
  }

  if (userId) {
    return <EstudianteAutenticadoView userId={userId} />
  }

  return null
}

export default function LiberacionPage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/laboratorio?tab=liberacion')
        return
      }
      setCheckingAuth(false)
    }
    checkAuth()
  }, [router])

  if (checkingAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
          <p className="text-white/50 animate-pulse">Cargando...</p>
        </div>
      </div>
    )
  }

  return <EstudianteLiberacionView />
}

/* ═══════════════════════════════════════════════════════════════
   VISTA ESTUDIANTE AUTENTICADO (CON CUENTA)
   Carga el registro de liberación directamente por user_id
   ═══════════════════════════════════════════════════════════════ */

function EstudianteAutenticadoView({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [estudiante, setEstudiante] = useState<LiberacionRow | null>(null)
  const [notaActual, setNotaActual] = useState<number | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    const fetchRegistro = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('liberaciones')
          .select('*')
          .eq('estudiante_id', userId)
          .maybeSingle()

        if (fetchError) throw fetchError

        if (!data) {
          setError('No tienes un registro de liberación asignado. Contacta al auxiliar.')
          setLoading(false)
          return
        }

        const libData = data as LiberacionRow

        const { data: calData } = await supabase
          .from('vista_calificaciones')
          .select('nota_final')
          .eq('estudiante_id', userId)
          .single()

        if (calData) setNotaActual(calData.nota_final)

        setEstudiante(libData)

        if (libData.estado === 'pendiente') {
          setShowWarning(true)
        }
      } catch {
        setError('Error de conexión. Intente nuevamente.')
      } finally {
        setLoading(false)
      }
    }

    fetchRegistro()
  }, [userId])

  const updateEstudianteState = (updated: LiberacionRow) => {
    setEstudiante(updated)
  }

  const handleConfirm = () => {
    setConfirming(true)
    setShowWarning(false)
    setConfirming(false)
  }

  const handleSelectHorario = async (horarioId: string) => {
    if (!estudiante) return

    const horario = HORARIOS.find(h => h.id === horarioId)
    if (!horario) return

    try {
      const { data: configData } = await supabase
        .from('liberaciones')
        .select('examen_pdf_url, examen_pdf_file_id')
        .eq('ru', `CONFIG_${horarioId}`)
        .maybeSingle()

      const pdfUrl = configData?.examen_pdf_url ?? null
      const pdfFileId = configData?.examen_pdf_file_id ?? null

      const { error: updateError } = await supabase
        .from('liberaciones')
        .update({
          horario_seleccionado: horarioId,
          estado: 'confirmado',
          confirmado_en: new Date().toISOString(),
          examen_pdf_url: pdfUrl,
          examen_pdf_file_id: pdfFileId,
        })
        .eq('id', estudiante.id)

      if (updateError) throw updateError

      updateEstudianteState({
        ...estudiante,
        horario_seleccionado: horarioId,
        estado: 'confirmado',
        confirmado_en: new Date().toISOString(),
        examen_pdf_url: pdfUrl,
        examen_pdf_file_id: pdfFileId,
      })
    } catch {
      setError('Error al confirmar horario. Intente nuevamente.')
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground animate-pulse">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background">
      <main className="max-w-5xl mx-auto px-4 pt-8 pb-20">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-orange-700 p-8 text-white shadow-xl mb-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.90_0.10_60/0.25)_0%,_transparent_60%)]" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <GraduationCap className="w-6 h-6" />
              </div>
              <span className="text-white/70 text-sm font-medium uppercase tracking-widest">Examen</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">Examen de Liberación</h1>
            <p className="text-white/80">
              Registra tu horario y presenta tu examen de liberación.
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 px-4 py-3 rounded-lg mb-6">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!estudiante ? (
          /* Sin registro asignado */
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <GraduationCap className="w-12 h-12 text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Sin registro de liberación</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                No tienes un registro asignado. Contacta al auxiliar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Student info card */}
            <Card className="mb-6">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 font-bold text-base shrink-0">
                      {estudiante.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{estudiante.nombre}</p>
                      <p className="text-sm text-muted-foreground">RU: {estudiante.ru}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:ml-auto">
                    {notaActual !== null && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                        <span className="text-xs text-muted-foreground">Nota semestre:</span>
                        <span className="text-base font-bold text-violet-500">{notaActual.toFixed(2)}</span>
                      </div>
                    )}
                    <EstadoBadge estado={estudiante.estado} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Phases */}
            {estudiante.estado === 'pendiente' && (
              <SeleccionHorarioView
                onSelect={handleSelectHorario}
                onShowWarning={() => setShowWarning(true)}
              />
            )}

            {estudiante.estado === 'confirmado' && (
              <ExamenDisponibilidadView
                estudiante={estudiante}
                onUpdate={updateEstudianteState}
                onError={setError}
              />
            )}

            {estudiante.estado === 'en_examen' && (
              <ExamenPresentacionView
                estudiante={estudiante}
                onUpdate={updateEstudianteState}
                onError={setError}
              />
            )}

            {estudiante.estado === 'finalizado' && (
              <ExamenFinalizadoView estudiante={estudiante} />
            )}
          </>
        )}

        {/* Warning Dialog — aparece al entrar si está pendiente */}
        <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-3 text-amber-500">
                <div className="p-2 bg-amber-500/15 rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                Advertencia Importante
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base mt-4 leading-relaxed">
                Al registrarte en el examen de liberación debes saber que:
                <div className="mt-4 space-y-3">
                  {notaActual !== null && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-xl border">
                      <span className="text-sm text-muted-foreground">Nota actual del semestre:</span>
                      <span className="text-xl font-bold">{notaActual.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl space-y-2">
                    <p className="text-destructive font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Esta nota será reemplazada por 0 (cero)
                    </p>
                    <p className="text-destructive/80 text-sm">
                      Solo se tomará en cuenta la nota obtenida en el examen de liberación.
                    </p>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel>
                Cancelar
              </AlertDialogCancel>
              <Button
                onClick={handleConfirm}
                disabled={confirming}
                className="bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              >
                {confirming ? 'Procesando...' : 'Entendido, continuar'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   VISTA ESTUDIANTE (SIN AUTENTICACIÓN)
   ═══════════════════════════════════════════════════════════════ */

function EstudianteLiberacionView() {
  const router = useRouter()
  const [ru, setRu] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estudiante, setEstudiante] = useState<LiberacionRow | null>(null)
  const [notaActual, setNotaActual] = useState<number | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Cache key based on RU
  const getCacheKey = (ruVal: string) => `liberacion_${ruVal.trim()}`

  const handleSearch = async () => {
    if (!ru.trim()) return
    setSearching(true)
    setError(null)
    setEstudiante(null)
    setNotaActual(null)

    const cacheKey = getCacheKey(ru)

    try {
      // Try cache first
      const cached = cacheGet<{ estudiante: LiberacionRow; notaActual: number | null }>(cacheKey)
      if (cached) {
        setEstudiante(cached.estudiante)
        setNotaActual(cached.notaActual)

        // If still pending, show warning
        if (cached.estudiante.estado === 'pendiente') {
          setShowWarning(true)
        }
        setSearching(false)

        // Refresh silently in background to catch estado/nota changes
        refreshFromSupabase(ru.trim(), cacheKey, false)
        return
      }

      // No cache — full fetch
      await refreshFromSupabase(ru.trim(), cacheKey, true)
    } catch {
      setError('Error de conexión. Intente nuevamente.')
      setSearching(false)
    }
  }

  const refreshFromSupabase = async (ruVal: string, cacheKey: string, isFirstLoad: boolean) => {
    try {
      // Fetch liberacion — columnas planas gracias a la migración Fase 3
      const { data, error: fetchError } = await supabase
        .from('liberaciones')
        .select('*')
        .eq('ru', ruVal)
        .single()

      if (fetchError || !data) {
        if (isFirstLoad) {
          setError('Registro Universitario no encontrado. Verifique que su RU esté registrado para el examen de liberación.')
        }
        return
      }

      // Data ya viene en formato plano — no se necesita mapeo
      const libData = data as LiberacionRow

      // Obtener nota actual desde vista_calificaciones
      // Usamos estudiante_id de liberaciones (FK agregada en migración Fase 2)
      // Fallback: buscar por RU si estudiante_id aún no está migrado
      let nota: number | null = null
      const estudianteId = libData.estudiante_id

      if (estudianteId) {
        // Camino optimizado: una sola query con el FK directo
        const { data: calData } = await supabase
          .from('vista_calificaciones')
          .select('nota_final')
          .eq('estudiante_id', estudianteId)
          .single()
        if (calData) nota = calData.nota_final
      } else {
        // Fallback: buscar estudiante por RU (compatibilidad durante migración)
        const { data: estData } = await supabase
          .from('estudiantes')
          .select('id')
          .eq('ru', ruVal)
          .single()
        if (estData) {
          const { data: calData } = await supabase
            .from('vista_calificaciones')
            .select('nota_final')
            .eq('estudiante_id', estData.id)
            .single()
          if (calData) nota = calData.nota_final
        }
      }

      // Save to cache (30 min TTL)
      cacheSet(cacheKey, { estudiante: libData, notaActual: nota }, 30 * 60 * 1000)

      // Update state
      setEstudiante(libData)
      setNotaActual(nota)

      if (isFirstLoad && libData.estado === 'pendiente') {
        setShowWarning(true)
      }
    } catch {
      if (isFirstLoad) {
        setError('Error de conexión. Intente nuevamente.')
      }
    } finally {
      if (isFirstLoad) {
        setSearching(false)
      }
    }
  }

  // Helper to update both state and cache
  const updateEstudianteState = (updated: LiberacionRow) => {
    setEstudiante(updated)
    const cacheKey = getCacheKey(updated.ru)
    cacheSet(cacheKey, { estudiante: updated, notaActual }, 30 * 60 * 1000)
  }

  const handleConfirm = async () => {
    if (!estudiante) return
    setConfirming(true)
    // Just close the warning dialog and proceed to schedule selection
    setShowWarning(false)
    setConfirming(false)
  }

  const handleSelectHorario = async (horarioId: string) => {
    if (!estudiante) return

    const horario = HORARIOS.find(h => h.id === horarioId)
    if (!horario) return

    try {
      // 1. Obtener config del horario elegido
      //    Los registros CONFIG_* guardan el PDF del examen en columnas planas
      const { data: configData } = await supabase
        .from('liberaciones')
        .select('examen_pdf_url, examen_pdf_file_id')
        .eq('ru', `CONFIG_${horarioId}`)
        .maybeSingle()

      const pdfUrl = configData?.examen_pdf_url ?? null
      const pdfFileId = configData?.examen_pdf_file_id ?? null

      // 2. Actualizar registro del estudiante con columnas planas
      const { error: updateError } = await supabase
        .from('liberaciones')
        .update({
          horario_seleccionado: horarioId,
          estado: 'confirmado',
          confirmado_en: new Date().toISOString(),
          examen_pdf_url: pdfUrl,
          examen_pdf_file_id: pdfFileId,
        })
        .eq('id', estudiante.id)

      if (updateError) throw updateError

      updateEstudianteState({
        ...estudiante,
        horario_seleccionado: horarioId,
        estado: 'confirmado',
        confirmado_en: new Date().toISOString(),
        examen_pdf_url: pdfUrl,
        examen_pdf_file_id: pdfFileId,
      })
    } catch {
      setError('Error al confirmar horario. Intente nuevamente.')
    }
  }

  // Not searched yet — show search form
  if (!estudiante) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center p-4 overflow-y-auto relative">
        {/* Background decorations */}
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-amber-500/15 via-orange-500/10 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-[30%] left-[5%] w-[300px] h-[300px] bg-orange-600/8 rounded-full blur-3xl pointer-events-none" />

        <Card className="w-full max-w-md border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl relative z-10">
          <CardHeader className="text-center pb-6 pt-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-amber-500/30">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              Examen de Liberación
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Ingrese su Registro Universitario para acceder al examen
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-8">
            <div className="space-y-5">
              {error && (
                <div className="bg-red-500/15 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm text-center font-medium animate-in fade-in slide-in-from-top-2">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="ru" className="text-sm font-semibold text-white/90 tracking-wide">
                  Registro Universitario (RU)
                </label>
                <Input
                  id="ru"
                  type="text"
                  placeholder="Ej: 2301456"
                  value={ru}
                  onChange={(e) => setRu(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="bg-white/95 border-0 mt-2 focus-visible:ring-2 focus-visible:ring-amber-500 text-zinc-950 placeholder:text-zinc-400 font-medium h-11 shadow-inner"
                  required
                />
              </div>

              <Button
                onClick={handleSearch}
                disabled={searching || !ru.trim()}
                className="w-full h-11 text-base font-semibold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 border-0 shadow-lg shadow-amber-500/25 transition-all"
              >
                {searching ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Buscando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    Buscar RU
                  </div>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-white/50 hover:text-white/80 hover:bg-white/5"
                onClick={() => router.push('/login')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al inicio de sesión
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Warning Dialog */}
        <AlertDialog open={showWarning} onOpenChange={(open) => { if (!open) router.push('/login') }}>
          <AlertDialogContent className="max-w-md bg-zinc-900 border-white/10">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-3 text-amber-400">
                <div className="p-2 bg-amber-500/20 rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                Advertencia Importante
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base text-white/70 mt-4 leading-relaxed">
                ¿Está seguro de continuar? Al confirmar el examen de liberación:
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-white/70 text-sm">Nota actual del semestre:</span>
                    <span className="text-xl font-bold text-white">{notaActual !== null ? notaActual.toFixed(2) : '0.00'}</span>
                  </div>
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2">
                    <p className="text-red-300 font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Esta nota será reemplazada por 0 (cero)
                    </p>
                    <p className="text-red-300/80 text-sm">
                      Si decide continuar, solo se tomará en cuenta la nota obtenida en el examen de liberación.
                    </p>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel
                onClick={() => router.push('/login')}
                className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
              >
                Cancelar
              </AlertDialogCancel>
              <Button
                onClick={handleConfirm}
                disabled={confirming}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold"
              >
                {confirming ? 'Procesando...' : 'Sí, continuar con la liberación'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  // Student found — render based on estado
  return (
    <div className="h-screen bg-zinc-950 overflow-y-auto relative">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-amber-500/10 via-orange-500/5 to-transparent pointer-events-none" />

      <div className="max-w-3xl mx-auto px-4 pt-6 sm:pt-8 pb-32 relative z-10">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => { setEstudiante(null); setRu(''); setError(null); setNotaActual(null) }}
          className="mb-4 sm:mb-6 text-white/50 hover:text-white/80 hover:bg-white/5"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Buscar otro RU
        </Button>

        {/* Student info header */}
        <Card className="mb-6 border-white/10 bg-black/40 backdrop-blur-xl">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-lg sm:text-xl font-bold shadow-lg shadow-amber-500/20 shrink-0">
                  {estudiante.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-white truncate">{estudiante.nombre}</h2>
                  <p className="text-white/50 text-sm">RU: {estudiante.ru}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:ml-auto">
                {notaActual !== null && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/15 border border-violet-500/30 rounded-xl">
                    <span className="text-xs text-violet-300/70">Nota semestre:</span>
                    <span className="text-lg font-bold text-violet-300">{notaActual.toFixed(2)}</span>
                  </div>
                )}
                <EstadoBadge estado={estudiante.estado} />
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 px-4 py-3 rounded-lg mb-6">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Phase: Pending → Select Schedule */}
        {estudiante.estado === 'pendiente' && (
          <SeleccionHorarioView
            onSelect={handleSelectHorario}
            onShowWarning={() => setShowWarning(true)}
          />
        )}

        {/* Phase: Confirmed → Show schedule + exam availability */}
        {estudiante.estado === 'confirmado' && (
          <ExamenDisponibilidadView
            estudiante={estudiante}
            onUpdate={(updated) => updateEstudianteState(updated)}
            onError={setError}
          />
        )}

        {/* Phase: In exam → Show exam + upload */}
        {estudiante.estado === 'en_examen' && (
          <ExamenPresentacionView
            estudiante={estudiante}
            onUpdate={(updated) => updateEstudianteState(updated)}
            onError={setError}
          />
        )}

        {/* Phase: Finished */}
        {estudiante.estado === 'finalizado' && (
          <ExamenFinalizadoView estudiante={estudiante} />
        )}

        {/* Warning Dialog */}
        <AlertDialog open={showWarning} onOpenChange={(open) => { if (!open) router.push('/login') }}>
          <AlertDialogContent className="max-w-md bg-zinc-900 border-white/10">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-3 text-amber-400">
                <div className="p-2 bg-amber-500/20 rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                Advertencia Importante
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base text-white/70 mt-4 leading-relaxed">
                ¿Está seguro de continuar? Al confirmar el examen de liberación:
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-white/70 text-sm">Nota actual del semestre:</span>
                    <span className="text-xl font-bold text-white">{notaActual !== null ? notaActual.toFixed(2) : '0.00'}</span>
                  </div>
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2">
                    <p className="text-red-300 font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Esta nota será reemplazada por 0 (cero)
                    </p>
                    <p className="text-red-300/80 text-sm">
                      Si decide continuar, solo se tomará en cuenta la nota obtenida en el examen de liberación.
                    </p>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel
                onClick={() => router.push('/login')}
                className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
              >
                Cancelar
              </AlertDialogCancel>
              <Button
                onClick={handleConfirm}
                disabled={confirming}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold"
              >
                {confirming ? 'Procesando...' : 'Sí, continuar'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SELECCIÓN DE HORARIO
   ═══════════════════════════════════════════════════════════════ */

function SeleccionHorarioView({
  onSelect,
  onShowWarning,
}: {
  onSelect: (horarioId: string) => void
  onShowWarning: () => void
}) {
  const [selectedHorario, setSelectedHorario] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const handleConfirmHorario = async () => {
    if (!selectedHorario) return
    setConfirming(true)
    await onSelect(selectedHorario)
    setConfirming(false)
  }

  return (
    <div className="space-y-6">
      <Card className="border-amber-500/20 bg-amber-500/5 backdrop-blur-xl">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-amber-300">Nota del semestre: 0</p>
              <p className="text-sm text-amber-200/60 mt-1">
                Ha aceptado que su nota del semestre será 0 y solo contará la nota del examen de liberación.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 mt-2 h-8 text-xs"
                onClick={onShowWarning}
              >
                Ver advertencia completa
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-400" />
          Seleccione su horario de examen
        </h3>
        <p className="text-sm text-white/50 mb-4">
          Elija el horario en el que realizará su examen de liberación. Esta elección es definitiva.
        </p>

        <div className="grid gap-3">
          {HORARIOS.map((horario) => {
            const isPast = new Date() > horario.fin
            return (
              <Card
                key={horario.id}
                className={`transition-all duration-200 border-2 ${
                  isPast 
                    ? 'border-white/5 bg-black/50 opacity-60 cursor-not-allowed'
                    : selectedHorario === horario.id
                      ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10 cursor-pointer'
                      : 'border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/5 cursor-pointer'
                }`}
                onClick={() => !isPast && setSelectedHorario(horario.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        isPast
                          ? 'bg-white/5 text-white/20'
                          : selectedHorario === horario.id
                            ? 'bg-amber-500/30 text-amber-300'
                            : 'bg-white/5 text-white/40'
                      }`}>
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`font-semibold ${isPast ? 'text-white/40' : selectedHorario === horario.id ? 'text-amber-300' : 'text-white'}`}>
                            {horario.label}
                          </p>
                          {isPast && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded border border-red-500/20">Finalizado</span>
                          )}
                        </div>
                        <p className={`text-sm ${isPast ? 'text-white/30' : selectedHorario === horario.id ? 'text-amber-200/70' : 'text-white/50'}`}>
                          {horario.hora}
                        </p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      isPast
                        ? 'border-white/10'
                        : selectedHorario === horario.id
                          ? 'border-amber-500 bg-amber-500'
                          : 'border-white/20'
                    }`}>
                      {selectedHorario === horario.id && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Button
          onClick={handleConfirmHorario}
          disabled={!selectedHorario || confirming}
          className="w-full mt-6 h-12 text-base font-semibold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 border-0 shadow-lg shadow-amber-500/20"
        >
          {confirming ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              Confirmando...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Confirmar Horario
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   DISPONIBILIDAD DEL EXAMEN (ESTADO: CONFIRMADO)
   ═══════════════════════════════════════════════════════════════ */

function ExamenDisponibilidadView({
  estudiante,
  onUpdate,
  onError,
}: {
  estudiante: LiberacionRow
  onUpdate: (updated: LiberacionRow) => void
  onError: (msg: string) => void
}) {
  const horario = HORARIOS.find(h => h.id === estudiante.horario_seleccionado)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (!horario) {
    return (
      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="p-6 text-center">
          <p className="text-red-400">Error: Horario no encontrado</p>
        </CardContent>
      </Card>
    )
  }

  const isInRange = now >= horario.inicio && now <= horario.fin
  const isPast = now > horario.fin
  const isFuture = now < horario.inicio

  const handleStartExam = async () => {
    if (!estudiante.examen_pdf_url) {
      onError('El examen aún no ha sido habilitado por el auxiliar.')
      return
    }

    try {
      const { error: updateError } = await supabase
        .from('liberaciones')
        .update({ estado: 'en_examen' })
        .eq('id', estudiante.id)

      if (updateError) throw updateError
      onUpdate({ ...estudiante, estado: 'en_examen' })
    } catch {
      onError('Error al iniciar el examen.')
    }
  }

  // Countdown for future exams
  const getCountdown = () => {
    if (!isFuture) return ''
    const diff = horario.inicio.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    return `${hours}h ${minutes}m ${seconds}s`
  }

  return (
    <div className="space-y-6">
      {/* Selected schedule card */}
      <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 backdrop-blur-xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
              <Calendar className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-amber-300/70 font-medium">Horario seleccionado</p>
              <p className="text-lg font-bold text-white">{horario.label}</p>
              <p className="text-amber-200/60">{horario.hora}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exam availability status */}
      {isFuture && (
        <Card className="border-blue-500/20 bg-blue-500/5 backdrop-blur-xl">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-blue-400 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Examen programado</h3>
            <p className="text-white/50 mb-4">
              Su examen estará disponible cuando inicie su horario seleccionado.
            </p>
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300 font-mono font-bold text-lg">{getCountdown()}</span>
            </div>
            {!estudiante.examen_pdf_url && (
              <p className="text-amber-300/60 text-sm mt-4 flex items-center gap-1.5 justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
                El auxiliar aún no ha cargado el examen
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isInRange && (
        <Card className="border-emerald-500/20 bg-emerald-500/5 backdrop-blur-xl">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">¡Su examen está disponible!</h3>
            <p className="text-white/50 mb-6">
              Puede iniciar su examen de liberación ahora.
            </p>
            {estudiante.examen_pdf_url ? (
              <Button
                onClick={handleStartExam}
                className="h-12 px-8 text-base font-semibold bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 shadow-lg shadow-emerald-500/20"
              >
                <GraduationCap className="w-5 h-5 mr-2" />
                Iniciar Examen
              </Button>
            ) : (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-amber-300 font-medium flex items-center gap-2 justify-center">
                  <AlertTriangle className="w-4 h-4" />
                  El auxiliar aún no ha cargado el examen
                </p>
                <p className="text-amber-200/50 text-sm mt-1">
                  Espere a que el auxiliar habilite el contenido del examen.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isPast && (
        <Card className="border-red-500/20 bg-red-500/5 backdrop-blur-xl">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Horario expirado</h3>
            <p className="text-white/50">
              El horario para su examen de liberación ha finalizado.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PRESENTACIÓN DEL EXAMEN (ESTADO: EN_EXAMEN)
   Similar a presentar-practicas
   ═══════════════════════════════════════════════════════════════ */

function ExamenPresentacionView({
  estudiante,
  onUpdate,
  onError,
}: {
  estudiante: LiberacionRow
  onUpdate: (updated: LiberacionRow) => void
  onError: (msg: string) => void
}) {
  const [archivos, setArchivos] = useState<ArchivoMetadata[]>(
    (estudiante.archivos_respuesta as ArchivoMetadata[]) || []
  )
  const [driveFolderId, setDriveFolderId] = useState<string | null>(estudiante.drive_folder_id ?? null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const horario = HORARIOS.find(h => h.id === estudiante.horario_seleccionado)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const isPast = horario ? now > horario.fin : false

  const handleFiles = async (files: FileList | File[]) => {
    if (isPast) return
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
      formData.append('studentName', estudiante.nombre)
      formData.append('taskTitle', `Liberacion-${estudiante.ru}`)
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
    if (isPast) return
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
      setError('Debe subir al menos un archivo')
      return
    }

    setSaving(true)
    try {
      const finalizadoEn = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('liberaciones')
        .update({
          examen_respuesta: {
            archivos: archivos,
            drive_folder_id: driveFolderId,
            finalizado_en: finalizadoEn,
          },
          estado: 'finalizado',
        })
        .eq('id', estudiante.id)

      if (updateError) throw updateError

      onUpdate({
        ...estudiante,
        archivos_respuesta: archivos,
        drive_folder_id: driveFolderId,
        estado: 'finalizado',
        finalizado_en: finalizadoEn,
      })
    } catch {
      setError('Error al guardar la entrega')
      onError('Error al guardar la entrega')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Exam header */}
      <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-green-500/5 backdrop-blur-xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
              <GraduationCap className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-emerald-300/70 font-medium">Examen en curso</p>
              <p className="text-lg font-bold text-white">Examen de Liberación</p>
              {horario && (
                <p className="text-emerald-200/60 text-sm">{horario.label} · {horario.hora}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PDF Preview */}
      {estudiante.examen_pdf_url && (
        <Card className="border-red-500/20 bg-red-500/5 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <FileText className="w-5 h-5 text-red-400" />
              Instrucciones del Examen
            </CardTitle>
            <CardDescription className="text-white/50">
              Revise el PDF con las instrucciones antes de entregar su resolución.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl overflow-hidden border border-white/10 bg-white mb-3">
              <iframe
                src={estudiante.examen_pdf_url}
                className="w-full h-[500px]"
                title="PDF del examen de liberación"
              />
            </div>
            <Button variant="outline" size="sm" asChild className="w-full border-white/10 text-white/70 hover:text-white hover:bg-white/5">
              <a href={estudiante.examen_pdf_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir PDF en nueva pestaña
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Files list */}
      {archivos.length > 0 && (
        <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white">Archivos subidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {archivos.map((archivo, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                  {archivo.tipo === '.pdf' ? (
                    <FileText className="w-5 h-5 text-red-400 shrink-0" />
                  ) : (
                    <FileCode className="w-5 h-5 text-blue-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate text-white">{archivo.nombre}</p>
                    <p className="text-xs text-white/40">{(archivo.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="ghost" size="sm" asChild className="text-white/50 hover:text-white hover:bg-white/5">
                    <a href={archivo.drive_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPast}
                    onClick={() => handleRemoveFile(i)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upload zone */}
      {isPast ? (
        <div className="p-6 text-center border-2 border-dashed border-red-500/30 bg-red-500/5 rounded-2xl">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">Tiempo concluido</h3>
          <p className="text-sm text-red-200/70">
            El horario de su examen ha finalizado. Ya no es posible modificar ni subir más archivos.
          </p>
        </div>
      ) : (
        <div
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer ${
            dragOver
              ? 'border-amber-500 bg-amber-500/10 scale-[1.01]'
              : 'border-white/15 hover:border-amber-400/50 hover:bg-white/5'
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
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
              <p className="text-sm text-white/50">Subiendo archivos...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-amber-500/10 rounded-2xl">
                <Upload className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-white">Arrastra archivos aquí o haz clic para seleccionar</p>
                <p className="text-sm text-white/40 mt-1">Solo archivos .py y .pdf (máximo 5MB)</p>
              </div>
            </div>
          )}
        </div>
      )}


      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={saving || archivos.length === 0}
        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-lg shadow-amber-500/20"
      >
        {saving ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            Enviando...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Enviar Examen
          </span>
        )}
      </Button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   EXAMEN FINALIZADO
   ═══════════════════════════════════════════════════════════════ */

function ExamenFinalizadoView({ estudiante }: { estudiante: LiberacionRow }) {
  const archivos = (estudiante.archivos_respuesta as ArchivoMetadata[]) || []

  return (
    <div className="space-y-6">
      <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-green-500/5 backdrop-blur-xl">
        <CardContent className="p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Examen Enviado</h3>
          <p className="text-white/50 mb-6">
            Su examen de liberación ha sido enviado exitosamente. El auxiliar revisará su entrega.
          </p>

          {estudiante.nota !== null && (
            <div className="inline-flex items-center gap-3 px-6 py-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <span className="text-white/60 text-sm">Nota:</span>
              <span className="text-4xl font-black text-emerald-400">{estudiante.nota}</span>
              <span className="text-white/40 text-sm">/100</span>
            </div>
          )}

          {estudiante.nota === null && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-medium">Pendiente de calificación</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submitted files */}
      {archivos.length > 0 && (
        <Card className="border-white/10 bg-black/30 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white">Archivos enviados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {archivos.map((archivo, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                  {archivo.tipo === '.pdf' ? (
                    <FileText className="w-5 h-5 text-red-400 shrink-0" />
                  ) : (
                    <FileCode className="w-5 h-5 text-blue-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate text-white">{archivo.nombre}</p>
                    <p className="text-xs text-white/40">{(archivo.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild className="text-white/50 hover:text-white hover:bg-white/5">
                  <a href={archivo.drive_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {estudiante.finalizado_en && (
        <p className="text-center text-xs text-white/30">
          Enviado el {new Date(estudiante.finalizado_en).toLocaleString('es-BO')}
        </p>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ESTADO BADGE
   ═══════════════════════════════════════════════════════════════ */

function EstadoBadge({ estado }: { estado: string | null }) {
  const config: Record<string, { text: string; className: string; icon: React.ReactNode }> = {
    pendiente: {
      text: 'Pendiente',
      className: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    confirmado: {
      text: 'Confirmado',
      className: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      icon: <CheckCircle className="w-3.5 h-3.5" />,
    },
    en_examen: {
      text: 'En Examen',
      className: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: <GraduationCap className="w-3.5 h-3.5" />,
    },
    finalizado: {
      text: 'Finalizado',
      className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
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


