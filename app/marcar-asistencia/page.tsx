'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, EstudianteRow } from '@/lib/supabase'
import { cacheGet, cacheSet } from '@/lib/cache'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle, Clock, XCircle, CalendarDays, History, Search, UserCheck, RefreshCw } from "lucide-react"

type AttendanceStatus = 'presente' | 'ausente' | 'retraso'

interface AsistenciaRegistrada {
  id: string
  estudiante_id: string
  estudiante_nombre: string
  estudiante_apellido: string
  estudiante_ci: string
  fecha: string
  hora: string
  estado: AttendanceStatus
}

const STUDENTS_CACHE_KEY = 'estudiantes_index'
const STUDENTS_TTL = 10 * 60 * 1000 // 10 minutes
const HISTORY_TTL = 60 * 1000        // 1 minute for today's attendance

export default function MarcarAsistenciaPage() {
  const router = useRouter()
  const [view, setView] = useState<'register' | 'history'>('register')
  const [initialLoading, setInitialLoading] = useState(true)

  // Local index of all students
  const [studentsIndex, setStudentsIndex] = useState<EstudianteRow[]>([])
  const [indexLoading, setIndexLoading] = useState(false)

  // Search state
  const [codigoInput, setCodigoInput] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [foundStudent, setFoundStudent] = useState<EstudianteRow | null>(null)

  // Form state
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // History tab state
  const [asistenciasHoy, setAsistenciasHoy] = useState<AsistenciaRegistrada[]>([])
  const [fechaFiltro, setFechaFiltro] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)

  // ─── Load student index (from cache or Supabase) ───────────────────────────
  const loadStudentIndex = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = cacheGet<EstudianteRow[]>(STUDENTS_CACHE_KEY)
      if (cached) {
        setStudentsIndex(cached)
        return
      }
    }
    setIndexLoading(true)
    try {
      const { data, error } = await supabase
        .from('estudiantes')
        .select('id, nombre, apellido, ci, ru, correo, paralelo, codigo, user_id')
        .order('apellido', { ascending: true })

      if (!error && data) {
        setStudentsIndex(data as EstudianteRow[])
        cacheSet(STUDENTS_CACHE_KEY, data, STUDENTS_TTL)
      }
    } catch (err) {
      console.error('[index] Error loading students:', err)
    } finally {
      setIndexLoading(false)
    }
  }, [])

  // ─── Auth check & initial data ─────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/login'); return }

        const { data: roleData } = await supabase
          .from('usuarios_roles').select('rol').eq('user_id', session.user.id).single()

        if (!roleData || roleData.rol !== 'auxiliar') { router.push('/dashboard'); return }

        const today = new Date().toISOString().split('T')[0]
        const now = new Date()
        setFecha(today)
        setFechaFiltro(today)
        setHora(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)

        // Load student index (from cache if available)
        await loadStudentIndex()
      } catch (err) {
        console.error(err)
      } finally {
        setInitialLoading(false)
      }
    }
    init()
  }, [router, loadStudentIndex])

  // ─── Instant local search by código ────────────────────────────────────────
  const handleSearch = () => {
    const trimmed = codigoInput.trim().toUpperCase()
    if (!trimmed) { setSearchError('Ingresa un código para buscar'); return }
    setSearchError(null)
    setFoundStudent(null)

    const match = studentsIndex.find(
      s => (s.codigo ?? '').toUpperCase() === trimmed
    )

    if (!match) {
      // Fallback: search by CI or partial name if no código match
      const byCI = studentsIndex.find(s => s.ci === trimmed)
      if (byCI) { setFoundStudent(byCI); return }

      setSearchError(
        studentsIndex.length === 0
          ? 'El índice de estudiantes aún está cargando. Intenta de nuevo en un momento.'
          : `No se encontró ningún estudiante con código "${trimmed}"`
      )
    } else {
      setFoundStudent(match)
    }
  }

  // ─── History fetch (with lightweight caching) ──────────────────────────────
  const fetchHistory = useCallback(async (fechaTarget: string, forceRefresh = false) => {
    const histKey = `asistencias_${fechaTarget}`
    if (!forceRefresh) {
      const cached = cacheGet<AsistenciaRegistrada[]>(histKey)
      if (cached) { setAsistenciasHoy(cached); return }
    }
    setHistoryLoading(true)
    try {
      const { data, error } = await supabase
        .from('asistencias')
        .select('id, estudiante_id, fecha, hora, estado, estudiantes(nombre, apellido, ci)')
        .eq('fecha', fechaTarget)
        .order('hora', { ascending: false })

      if (!error && data) {
        const mapped: AsistenciaRegistrada[] = data.map(a => ({
          id: a.id,
          estudiante_id: a.estudiante_id,
          estudiante_nombre: (Array.isArray(a.estudiantes) ? a.estudiantes[0] : a.estudiantes)?.nombre || '',
          estudiante_apellido: (Array.isArray(a.estudiantes) ? a.estudiantes[0] : a.estudiantes)?.apellido || '',
          estudiante_ci: (Array.isArray(a.estudiantes) ? a.estudiantes[0] : a.estudiantes)?.ci || '',
          fecha: a.fecha,
          hora: a.hora,
          estado: a.estado as AttendanceStatus,
        }))
        setAsistenciasHoy(mapped)
        // Cache today's attendance for 1 minute; past dates for 10 min
        const isToday = new Date().toISOString().split('T')[0] === fechaTarget
        cacheSet(histKey, mapped, isToday ? HISTORY_TTL : STUDENTS_TTL)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (view === 'history') fetchHistory(fechaFiltro)
  }, [view, fechaFiltro, fetchHistory])

  // ─── Mark attendance ────────────────────────────────────────────────────────
  const handleMarkStatus = async (status: AttendanceStatus) => {
    if (!foundStudent) return
    if (!fecha || !hora) { setSubmitError('Completa la fecha y hora'); return }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { error: insertError } = await supabase.from('asistencias').insert([{
        estudiante_id: foundStudent.id,
        fecha, hora, estado: status,
      }])
      if (insertError) throw new Error(insertError.message)

      // Optimistic update: add to today's list in cache
      const histKey = `asistencias_${fecha}`
      const existing = cacheGet<AsistenciaRegistrada[]>(histKey) ?? []
      const newRecord: AsistenciaRegistrada = {
        id: crypto.randomUUID(),
        estudiante_id: foundStudent.id,
        estudiante_nombre: foundStudent.nombre,
        estudiante_apellido: foundStudent.apellido,
        estudiante_ci: foundStudent.ci,
        fecha,
        hora,
        estado: status,
      }
      cacheSet(histKey, [newRecord, ...existing], HISTORY_TTL)

      setSuccess(true)
      setFoundStudent(null)
      setCodigoInput('')
      const now = new Date()
      setHora(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error al registrar')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const getStatusBadge = (estado: AttendanceStatus) => {
    if (estado === 'presente') return (
      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap">
        <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Presente
      </span>
    )
    if (estado === 'retraso') return (
      <span className="inline-flex items-center gap-1.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" /> Retraso
      </span>
    )
    return (
      <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 shrink-0" /> Ausente
      </span>
    )
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground animate-pulse">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 sm:p-2.5 bg-emerald-500/10 rounded-xl shrink-0">
              <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Registro de Asistencia</h1>
          </div>
          <div className="ml-11 sm:ml-14 flex items-center gap-3 flex-wrap">
            <p className="text-muted-foreground text-sm">
              Busca al estudiante por su código y marca su asistencia.
            </p>
            {/* Index status indicator */}
            <span className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full border ${
              indexLoading
                ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
                : studentsIndex.length > 0
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                : 'bg-muted text-muted-foreground border-border'
            }`}>
              {indexLoading
                ? <><div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" /> Cargando índice...</>
                : <><div className="w-2 h-2 rounded-full bg-emerald-500" /> {studentsIndex.length} estudiantes en índice</>
              }
            </span>
            <button
              onClick={() => loadStudentIndex(true)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              title="Forzar recarga del índice"
            >
              <RefreshCw className="w-3 h-3" /> Actualizar índice
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border mb-6 overflow-x-auto">
          <button
            onClick={() => setView('register')}
            className={`px-4 sm:px-5 py-2.5 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 -mb-px shrink-0 ${
              view === 'register' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Registrar Asistencia</span>
            <span className="sm:hidden">Registrar</span>
          </button>
          <button
            onClick={() => setView('history')}
            className={`px-4 sm:px-5 py-2.5 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 -mb-px shrink-0 ${
              view === 'history' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Historial de Asistencia</span>
            <span className="sm:hidden">Historial</span>
          </button>
        </div>

        {/* ─── REGISTER TAB ─── */}
        {view === 'register' && (
          <div className="grid md:grid-cols-5 gap-5">

            {/* LEFT: Search + actions */}
            <div className="md:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="w-4 h-4 text-primary" />
                    Buscar por Código
                  </CardTitle>
                  <CardDescription className="text-xs">
                    La búsqueda es instantánea sobre el índice local.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ej: D9, D7, A1..."
                      value={codigoInput}
                      onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setSearchError(null); setFoundStudent(null) }}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      className="font-mono font-bold text-center text-base uppercase tracking-widest"
                      autoComplete="off"
                    />
                    <Button onClick={handleSearch} disabled={indexLoading} className="shrink-0">
                      <Search className="w-4 h-4" />
                      <span className="ml-1.5 hidden sm:inline">Buscar</span>
                    </Button>
                  </div>

                  {searchError && (
                    <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">
                      {searchError}
                    </p>
                  )}

                  {foundStudent && (
                    <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-1">
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="w-5 h-5 text-primary" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estudiante encontrado</span>
                      </div>
                      <p className="font-bold text-lg leading-tight">{foundStudent.nombre} {foundStudent.apellido}</p>
                      {foundStudent.codigo && (
                        <p className="font-mono font-bold text-yellow-600 dark:text-yellow-400 text-base tracking-widest">{foundStudent.codigo}</p>
                      )}
                      <div className="text-sm text-muted-foreground space-y-0.5 pt-1">
                        <p>CI: {foundStudent.ci || '—'}</p>
                        <p>Paralelo: {foundStudent.paralelo || '—'}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {foundStudent && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Registrar Estado</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {submitError && (
                      <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">
                        {submitError}
                      </p>
                    )}
                    {success && (
                      <div className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        ¡Asistencia registrada exitosamente!
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Fecha *</label>
                        <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Hora *</label>
                        <Input type="time" value={hora} onChange={e => setHora(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Marcar como:</p>
                      <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={submitting} onClick={() => handleMarkStatus('presente')}>
                        <CheckCircle className="w-4 h-4" />
                        {submitting ? 'Registrando...' : 'Presente ✓'}
                      </Button>
                      <Button className="w-full gap-2 bg-yellow-500 hover:bg-yellow-600 text-white" disabled={submitting} onClick={() => handleMarkStatus('retraso')}>
                        <Clock className="w-4 h-4" />
                        Retraso / Tardío
                      </Button>
                      <Button className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white" disabled={submitting} onClick={() => handleMarkStatus('ausente')}>
                        <XCircle className="w-4 h-4" />
                        Ausente ✗
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* RIGHT: today's list */}
            <div className="md:col-span-3">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div>
                      <CardTitle className="text-base">Registros de Hoy</CardTitle>
                      <CardDescription className="text-xs">
                        {fecha ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="self-start sm:self-auto" onClick={() => fetchHistory(fecha, true)}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Actualizar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {asistenciasHoy.length === 0 ? (
                    <div className="py-10 text-center">
                      <CalendarDays className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm">No hay registros para esta fecha aún.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {asistenciasHoy.map(a => (
                        <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors border border-border/40">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {a.estudiante_nombre.charAt(0)}{a.estudiante_apellido.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{a.estudiante_nombre} {a.estudiante_apellido}</p>
                              <p className="text-xs text-muted-foreground">CI: {a.estudiante_ci || '—'} · {a.hora}</p>
                            </div>
                          </div>
                          {getStatusBadge(a.estado)}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ─── HISTORY TAB ─── */}
        {view === 'history' && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <History className="w-5 h-5 text-primary shrink-0" /> Historial de Asistencia
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Consulta el registro por fecha</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={fechaFiltro}
                    onChange={e => { setFechaFiltro(e.target.value); fetchHistory(e.target.value) }}
                    className="w-full sm:w-auto"
                  />
                  <Button variant="outline" size="icon" onClick={() => fetchHistory(fechaFiltro, true)} title="Forzar recarga">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : asistenciasHoy.length === 0 ? (
                <div className="py-12 text-center">
                  <History className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">No hay registros para esta fecha.</p>
                </div>
              ) : (
                <div className="divide-y border rounded-xl overflow-hidden">
                  {asistenciasHoy.map(a => (
                    <div key={a.id} className="flex items-center justify-between gap-3 p-3 sm:p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs sm:text-sm font-bold shrink-0">
                          {a.estudiante_nombre.charAt(0)}{a.estudiante_apellido.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm sm:text-base truncate">{a.estudiante_nombre} {a.estudiante_apellido}</p>
                          <p className="text-xs text-muted-foreground">CI: {a.estudiante_ci || '—'} · {a.hora}</p>
                        </div>
                      </div>
                      {getStatusBadge(a.estado)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </main>
    </div>
  )
}
