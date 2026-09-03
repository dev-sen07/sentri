'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, EstudianteRow, ActividadRow } from '@/lib/supabase'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Activity, Calendar, CheckCircle, Clock, Search,
  UserCheck, Users, RefreshCw, Lock,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Paralelo = 'A' | 'B' | 'C'

interface Participante {
  id: string
  estudiante_id: string
  nombre: string
  apellido: string
  ci: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isActividadCerrada(act: ActividadRow): boolean {
  if (!act.hora_fin) return false
  const now = new Date()
  const close = new Date(`${act.fecha}T${act.hora_fin}`)
  return now > close
}

function formatHora(h: string): string {
  return h.slice(0, 5)
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function MisActividadesPage() {
  const router = useRouter()
  const [initialLoading, setInitialLoading] = useState(true)
  const [paralelo, setParalelo] = useState<Paralelo | null>(null)

  // Activities
  const [actividades, setActividades] = useState<ActividadRow[]>([])
  const [loadingActividades, setLoadingActividades] = useState(false)

  // Selected activity
  const [actividadSeleccionada, setActividadSeleccionada] = useState<ActividadRow | null>(null)
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [loadingParticipantes, setLoadingParticipantes] = useState(false)

  // Search
  const [codigoInput, setCodigoInput] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [foundStudent, setFoundStudent] = useState<EstudianteRow | null>(null)
  const [addingParticipant, setAddingParticipant] = useState(false)
  const [addSuccess, setAddSuccess] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // ─── Auth check ──────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/login'); return }

        const { data: roleData } = await supabase
          .from('usuarios_roles').select('rol').eq('user_id', session.user.id).single()
        if (!roleData || roleData.rol !== 'delegado') { router.push('/dashboard'); return }

        // Get delegado's paralelo from estudiantes
        const { data: estudianteData } = await supabase
          .from('estudiantes')
          .select('paralelo')
          .eq('user_id', session.user.id)
          .single()

        if (estudianteData) setParalelo(estudianteData.paralelo as Paralelo)

        await fetchActividades()
      } catch (err) {
        console.error(err)
      } finally {
        setInitialLoading(false)
      }
    }
    init()
  }, [router])

  const fetchActividades = async () => {
    setLoadingActividades(true)
    try {
      const { data, error } = await supabase
        .from('actividades')
        .select('*')
        .order('fecha', { ascending: false })
      if (!error && data) setActividades(data as ActividadRow[])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingActividades(false)
    }
  }

  const handleSelectActividad = async (act: ActividadRow) => {
    setActividadSeleccionada(act)
    setFoundStudent(null)
    setCodigoInput('')
    setSearchError(null)
    setAddError(null)
    setAddSuccess(false)
    await fetchParticipantes(act.id)
  }

  const fetchParticipantes = async (actividadId: string) => {
    setLoadingParticipantes(true)
    try {
      const { data, error } = await supabase
        .from('actividad_participantes')
        .select('id, estudiante_id, estudiantes(nombre, apellido, ci)')
        .eq('actividad_id', actividadId)
        .order('registrado_en', { ascending: false })
      if (!error && data) {
        const mapped: Participante[] = data.map((p: any) => ({
          id: p.id,
          estudiante_id: p.estudiante_id,
          nombre: (Array.isArray(p.estudiantes) ? p.estudiantes[0] : p.estudiantes)?.nombre || '',
          apellido: (Array.isArray(p.estudiantes) ? p.estudiantes[0] : p.estudiantes)?.apellido || '',
          ci: (Array.isArray(p.estudiantes) ? p.estudiantes[0] : p.estudiantes)?.ci || '',
        }))
        setParticipantes(mapped)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingParticipantes(false)
    }
  }

  const handleSearch = async () => {
    const trimmed = codigoInput.trim().toUpperCase()
    if (!trimmed) { setSearchError('Ingresa un código para buscar'); return }
    setSearchError(null)
    setFoundStudent(null)
    setSearchLoading(true)

    try {
      // Search by codigo first, then by CI
      let { data, error } = await supabase
        .from('estudiantes')
        .select('*')
        .ilike('codigo', trimmed)
        .limit(1)

      if ((!data || data.length === 0) && !error) {
        const res = await supabase
          .from('estudiantes')
          .select('*')
          .eq('ci', trimmed)
          .limit(1)
        data = res.data
        error = res.error
      }

      if (error) {
        setSearchError('Error al buscar: ' + error.message)
        return
      }

      if (!data || data.length === 0) {
        setSearchError(`No se encontró ningún estudiante con código "${trimmed}"`)
        return
      }

      const result = data[0] as EstudianteRow

      // Validate same paralelo
      if (result.paralelo !== paralelo) {
        setSearchError(`Este estudiante es del Paralelo ${result.paralelo}. Solo puedes registrar estudiantes del Paralelo ${paralelo}.`)
        return
      }

      setFoundStudent(result)
    } catch (err) {
      setSearchError('Error inesperado al buscar')
      console.error(err)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleAgregarParticipante = async () => {
    if (!foundStudent || !actividadSeleccionada) return
    if (isActividadCerrada(actividadSeleccionada)) return

    setAddingParticipant(true)
    setAddError(null)
    try {
      const { error } = await supabase.from('actividad_participantes').insert([{
        actividad_id: actividadSeleccionada.id,
        estudiante_id: foundStudent.id,
      }])
      if (error) {
        if (error.code === '23505') throw new Error('Este estudiante ya está registrado en la actividad.')
        throw new Error(error.message)
      }
      setAddSuccess(true)
      setFoundStudent(null)
      setCodigoInput('')
      await fetchParticipantes(actividadSeleccionada.id)
      setTimeout(() => setAddSuccess(false), 3000)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Error al registrar')
    } finally {
      setAddingParticipant(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground animate-pulse">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background">
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 sm:p-2.5 bg-indigo-500/10 rounded-xl shrink-0">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Actividades</h1>
          </div>
          <div className="ml-11 sm:ml-14 flex items-center gap-3 flex-wrap">
            <p className="text-muted-foreground text-sm">
              Registra la asistencia de estudiantes del{' '}
              {paralelo ? (
                <span className="font-semibold text-foreground">Paralelo {paralelo}</span>
              ) : '—'} a las actividades.
            </p>
            {paralelo && (
              <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 px-2 py-0.5 rounded-full text-xs font-semibold border border-indigo-200 dark:border-indigo-800">
                Paralelo {paralelo}
              </span>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-5 gap-5">
          {/* LEFT: Activities list */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Actividades
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={fetchActividades} className="h-7 w-7">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingActividades ? (
                  <div className="py-8 flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : actividades.length === 0 ? (
                  <div className="py-8 text-center">
                    <Activity className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm">No hay actividades disponibles.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {actividades.map(act => {
                      const cerrada = isActividadCerrada(act)
                      return (
                        <button
                          key={act.id}
                          onClick={() => handleSelectActividad(act)}
                          className={`w-full text-left p-3 rounded-xl border transition-all ${
                            actividadSeleccionada?.id === act.id
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border/40 hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <p className="font-semibold text-sm truncate">{act.nombre}</p>
                            {cerrada ? (
                              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                                <Lock className="w-2.5 h-2.5" /> Cerrada
                              </span>
                            ) : (
                              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                                Abierta
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(act.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                            {act.hora_inicio && act.hora_fin && (
                              <span className="ml-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatHora(act.hora_inicio)} → {formatHora(act.hora_fin)}
                              </span>
                            )}
                          </p>
                          {act.ponderacion != null && (
                            <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mt-0.5">
                              {act.ponderacion} pts
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Register participants */}
          <div className="md:col-span-3 space-y-4">
            {!actividadSeleccionada ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Users className="w-12 h-12 mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">Selecciona una actividad para registrar participantes.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Activity info banner */}
                <div className={`flex items-start justify-between gap-4 p-4 rounded-xl border ${
                  isActividadCerrada(actividadSeleccionada)
                    ? 'bg-muted/50 border-border'
                    : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
                }`}>
                  <div>
                    <p className="font-bold text-base">{actividadSeleccionada.nombre}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(actividadSeleccionada.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      {actividadSeleccionada.hora_inicio && actividadSeleccionada.hora_fin && (
                        <span>· {formatHora(actividadSeleccionada.hora_inicio)} → {formatHora(actividadSeleccionada.hora_fin)}</span>
                      )}
                    </p>
                  </div>
                  {isActividadCerrada(actividadSeleccionada) ? (
                    <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold bg-muted text-muted-foreground px-3 py-1.5 rounded-full border">
                      <Lock className="w-3.5 h-3.5" /> Cerrada
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle className="w-3.5 h-3.5" /> Abierta
                    </span>
                  )}
                </div>

                {/* Search + register */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Search className="w-4 h-4 text-primary" />
                      Registrar Participante
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Solo puedes registrar estudiantes del Paralelo {paralelo}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isActividadCerrada(actividadSeleccionada) ? (
                      <div className="py-6 text-center">
                        <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-muted-foreground text-sm font-medium">Actividad cerrada</p>
                        <p className="text-muted-foreground text-xs mt-1">El registro ya no está disponible porque la hora de fin ha pasado.</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Código del estudiante..."
                            value={codigoInput}
                            onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setSearchError(null); setFoundStudent(null) }}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            className="font-mono font-bold text-center text-base uppercase tracking-widest"
                            autoComplete="off"
                            disabled={searchLoading}
                          />
                          <Button onClick={handleSearch} disabled={searchLoading} className="shrink-0">
                            <Search className="w-4 h-4" />
                            <span className="ml-1.5 hidden sm:inline">{searchLoading ? 'Buscando...' : 'Buscar'}</span>
                          </Button>
                        </div>

                        {searchError && (
                          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">
                            {searchError}
                          </p>
                        )}
                        {addError && (
                          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">
                            {addError}
                          </p>
                        )}
                        {addSuccess && (
                          <div className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 shrink-0" />¡Participante registrado!
                          </div>
                        )}

                        {foundStudent && (
                          <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                              <UserCheck className="w-4 h-4 text-primary" />
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estudiante encontrado</span>
                            </div>
                            <p className="font-bold text-base leading-tight">{foundStudent.nombre} {foundStudent.apellido}</p>
                            {foundStudent.codigo && (
                              <p className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm tracking-widest">{foundStudent.codigo}</p>
                            )}
                            <p className="text-xs text-muted-foreground">CI: {foundStudent.ci || '—'} · Paralelo: {foundStudent.paralelo}</p>
                            <Button
                              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={addingParticipant}
                              onClick={handleAgregarParticipante}
                            >
                              <CheckCircle className="w-4 h-4" />
                              {addingParticipant ? 'Registrando...' : 'Confirmar Asistencia'}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Participants list */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          Participantes
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {participantes.length} registrado{participantes.length !== 1 ? 's' : ''}
                        </CardDescription>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => fetchParticipantes(actividadSeleccionada.id)} className="h-7 w-7">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingParticipantes ? (
                      <div className="py-6 flex justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      </div>
                    ) : participantes.length === 0 ? (
                      <div className="py-8 text-center">
                        <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-muted-foreground text-sm">No hay participantes registrados aún.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {participantes.map(p => (
                          <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors border border-border/40">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {p.nombre.charAt(0)}{p.apellido.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{p.nombre} {p.apellido}</p>
                              <p className="text-xs text-muted-foreground">CI: {p.ci || '—'}</p>
                            </div>
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 ml-auto" />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
