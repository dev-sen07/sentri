'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, EstudianteRow, ActividadRow } from '@/lib/supabase'
import { cacheGet, cacheSet } from '@/lib/cache'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Star, PlusCircle, Search, UserCheck, Sparkles, Activity,
  CheckCircle, RefreshCw, Users, Calendar, Trash2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExtraRegistrado {
  id: string
  estudiante_id: string
  puntos: number
  descripcion: string | null
  creado_en: string
}

interface ActividadConParticipantes extends ActividadRow {
  participantes?: Array<{
    id: string
    estudiante_id: string
    nombre: string
    apellido: string
    ci: string
  }>
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

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ExtrasPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'puntos' | 'actividades'>('puntos')
  const [initialLoading, setInitialLoading] = useState(true)



  // ─── Auth check ────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/login'); return }

        const { data: roleData } = await supabase
          .from('usuarios_roles').select('rol').eq('user_id', session.user.id).single()
        if (!roleData || roleData.rol !== 'auxiliar') { router.push('/dashboard'); return }


      } catch (err) {
        console.error(err)
      } finally {
        setInitialLoading(false)
      }
    }
    init()
  }, [router])



  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
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
            <div className="p-2 sm:p-2.5 bg-amber-500/10 rounded-xl shrink-0">
              <Star className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Extras</h1>
          </div>
          <div className="ml-11 sm:ml-14 flex items-center gap-3 flex-wrap">
            <p className="text-muted-foreground text-sm">
              Administra puntos extra y actividades especiales.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border mb-6 overflow-x-auto">
          <button
            onClick={() => setTab('puntos')}
            className={`px-4 sm:px-5 py-2.5 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 -mb-px shrink-0 ${
              tab === 'puntos' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Puntos Extra
          </button>
          <button
            onClick={() => setTab('actividades')}
            className={`px-4 sm:px-5 py-2.5 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 -mb-px shrink-0 ${
              tab === 'actividades' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            <Activity className="w-4 h-4" />
            Actividades
          </button>
        </div>

        {/* ─── PUNTOS EXTRA TAB ─── */}
        {tab === 'puntos' && (
          <PuntosExtraTab />
        )}

        {/* ─── ACTIVIDADES TAB ─── */}
        {tab === 'actividades' && (
          <ActividadesTab />
        )}

      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: Puntos Extra
// ─────────────────────────────────────────────────────────────────────────────
function PuntosExtraTab() {
  // Search
  const [searchLoading, setSearchLoading] = useState(false)
  const [codigoInput, setCodigoInput] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [foundStudent, setFoundStudent] = useState<EstudianteRow | null>(null)

  // Form
  const [puntos, setPuntos] = useState('1')
  const [descripcion, setDescripcion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // History of extras for found student
  const [extras, setExtras] = useState<ExtraRegistrado[]>([])
  const [loadingExtras, setLoadingExtras] = useState(false)

  const handleSearchPoints = async () => {
    const trimmed = codigoInput.trim().toUpperCase()
    if (!trimmed) { setSearchError('Ingresa un código para buscar'); return }
    setSearchError(null)
    setFoundStudent(null)
    setExtras([])
    setSearchLoading(true)

    try {
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

      if (error) throw error

      if (!data || data.length === 0) {
        setSearchError(`No se encontró ningún estudiante con código "${trimmed}"`)
        return
      }

      const match = data[0] as EstudianteRow
      setFoundStudent(match)
      fetchExtras(match.id)
    } catch (err) {
      console.error(err)
      setSearchError('Error al buscar estudiante')
    } finally {
      setSearchLoading(false)
    }
  }

  const fetchExtras = async (estudianteId: string) => {
    setLoadingExtras(true)
    try {
      const { data, error } = await supabase
        .from('extras')
        .select('*')
        .eq('estudiante_id', estudianteId)
        .order('creado_en', { ascending: false })
        .limit(10)
      if (!error && data) setExtras(data as ExtraRegistrado[])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingExtras(false)
    }
  }

  const handleAgregarPuntos = async () => {
    if (!foundStudent) return
    const puntosNum = parseFloat(puntos)
    if (isNaN(puntosNum) || puntosNum <= 0) {
      setSubmitError('Los puntos deben ser un número mayor a 0')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { error } = await supabase.from('extras').insert([{
        estudiante_id: foundStudent.id,
        puntos: puntosNum,
        descripcion: descripcion.trim() || null,
      }])
      if (error) throw new Error(error.message)
      setSuccess(true)
      setPuntos('1')
      setDescripcion('')
      await fetchExtras(foundStudent.id)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error al registrar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid md:grid-cols-5 gap-5">
      {/* LEFT: Search + form */}
      <div className="md:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              Buscar por Código
            </CardTitle>
            <CardDescription className="text-xs">
              Busca al estudiante por su código o CI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Ej: D9, D7, A1..."
                value={codigoInput}
                onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setSearchError(null) }}
                onKeyDown={e => e.key === 'Enter' && handleSearchPoints()}
                className="font-mono font-bold text-center text-base uppercase tracking-widest"
                autoComplete="off"
              />
              <Button onClick={handleSearchPoints} disabled={searchLoading} className="shrink-0">
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
                  <p className="font-mono font-bold text-amber-600 dark:text-amber-400 text-base tracking-widest">{foundStudent.codigo}</p>
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
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Agregar Puntos Extra
              </CardTitle>
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
                  ¡Puntos registrados exitosamente!
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Puntos *</label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={puntos}
                  onChange={e => setPuntos(e.target.value)}
                  placeholder="1"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Descripción (opcional)</label>
                <Input
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="Ej: Participación en exposición..."
                />
              </div>
              <Button
                className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                disabled={submitting}
                onClick={handleAgregarPuntos}
              >
                <Star className="w-4 h-4" />
                {submitting ? 'Registrando...' : 'Agregar Puntos'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* RIGHT: Extras history */}
      <div className="md:col-span-3">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-base">Historial de Puntos Extra</CardTitle>
            <CardDescription className="text-xs">
              {foundStudent
                ? `Últimos registros de ${foundStudent.nombre} ${foundStudent.apellido}`
                : 'Busca un estudiante para ver su historial'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!foundStudent ? (
              <div className="py-12 text-center">
                <Star className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">Busca un estudiante para ver su historial de puntos.</p>
              </div>
            ) : loadingExtras ? (
              <div className="py-12 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : extras.length === 0 ? (
              <div className="py-12 text-center">
                <Sparkles className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">No hay puntos extra registrados aún.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {extras.map(extra => (
                  <div key={extra.id} className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors border border-border/40">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {extra.descripcion || <span className="text-muted-foreground italic">Sin descripción</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(extra.creado_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 px-3 py-1 rounded-full text-sm font-bold shrink-0">
                      <Star className="w-3 h-3" />+{extra.puntos}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Actividades
// ─────────────────────────────────────────────────────────────────────────────
function ActividadesTab() {
  // Search
  const [searchLoading, setSearchLoading] = useState(false)
  // Create activity form
  const [nombreActividad, setNombreActividad] = useState('')
  const [fechaActividad, setFechaActividad] = useState(new Date().toISOString().split('T')[0])
  const [ponderacionActividad, setPonderacionActividad] = useState('10')
  const [horaInicioActividad, setHoraInicioActividad] = useState('')
  const [horaFinActividad, setHoraFinActividad] = useState('')
  const [creatingActividad, setCreatingActividad] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState(false)

  // Activities list
  const [actividades, setActividades] = useState<ActividadConParticipantes[]>([])
  const [loadingActividades, setLoadingActividades] = useState(false)

  // Selected activity for participants
  const [actividadSeleccionada, setActividadSeleccionada] = useState<ActividadConParticipantes | null>(null)
  const [participantes, setParticipantes] = useState<Array<{ id: string; estudiante_id: string; nombre: string; apellido: string; ci: string }>>([])
  const [loadingParticipantes, setLoadingParticipantes] = useState(false)

  // Participant search
  const [codigoInput, setCodigoInput] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [foundStudent, setFoundStudent] = useState<EstudianteRow | null>(null)
  const [addingParticipant, setAddingParticipant] = useState(false)
  const [addSuccess, setAddSuccess] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    fetchActividades()
  }, [])

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

  const handleCrearActividad = async () => {
    if (!nombreActividad.trim()) { setCreateError('El nombre es requerido'); return }
    const notasNum = parseFloat(ponderacionActividad)
    if (isNaN(notasNum) || notasNum <= 0) {
      setCreateError('La ponderación debe ser un número mayor a 0')
      return
    }

    setCreatingActividad(true)
    setCreateError(null)
    try {
      const { error } = await supabase.from('actividades').insert([{
        nombre: nombreActividad.trim(),
        fecha: fechaActividad,
        ponderacion: notasNum,
        hora_inicio: horaInicioActividad || null,
        hora_fin: horaFinActividad || null,
      }])
      if (error) throw new Error(error.message)
      setCreateSuccess(true)
      setNombreActividad('')
      setPonderacionActividad('10')
      setHoraInicioActividad('')
      setHoraFinActividad('')
      await fetchActividades()
      setTimeout(() => setCreateSuccess(false), 3000)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear')
    } finally {
      setCreatingActividad(false)
    }
  }

  const handleSelectActividad = async (actividad: ActividadConParticipantes) => {
    setActividadSeleccionada(actividad)
    setFoundStudent(null)
    setCodigoInput('')
    setSearchError(null)
    setAddError(null)
    setAddSuccess(false)
    await fetchParticipantes(actividad.id)
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
        const mapped = data.map((p: any) => ({
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

  const handleSearchActivities = async () => {
    const trimmed = codigoInput.trim().toUpperCase()
    if (!trimmed) { setSearchError('Ingresa un código para buscar'); return }
    setSearchError(null)
    setFoundStudent(null)
    setSearchLoading(true)

    try {
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

      if (error) throw error

      if (!data || data.length === 0) {
        setSearchError(`No se encontró ningún estudiante con código "${trimmed}"`)
        return
      }

      setFoundStudent(data[0] as EstudianteRow)
    } catch (err) {
      console.error(err)
      setSearchError('Error al buscar estudiante')
    } finally {
      setSearchLoading(false)
    }
  }

  const handleAgregarParticipante = async () => {
    if (!foundStudent || !actividadSeleccionada) return
    if (isActividadCerrada(actividadSeleccionada)) {
      setAddError('Esta actividad ya está cerrada y no se admiten nuevos registros.')
      return
    }

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

  return (
    <div className="grid md:grid-cols-5 gap-5">
      {/* LEFT: Create activity + Activity list */}
      <div className="md:col-span-2 space-y-4">
        {/* Create Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-primary" />
              Nueva Actividad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {createError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">
                {createError}
              </p>
            )}
            {createSuccess && (
              <div className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />¡Actividad creada!
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
              <Input
                value={nombreActividad}
                onChange={e => { setNombreActividad(e.target.value); setCreateError(null) }}
                onKeyDown={e => e.key === 'Enter' && handleCrearActividad()}
                placeholder="Ej: Exposición de proyectos..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Fecha *</label>
                <Input
                  type="date"
                  value={fechaActividad}
                  onChange={e => setFechaActividad(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nota / Puntos *</label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={ponderacionActividad}
                  onChange={e => setPonderacionActividad(e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Hora Inicio</label>
                <Input
                  type="time"
                  value={horaInicioActividad}
                  onChange={e => setHoraInicioActividad(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Hora Fin</label>
                <Input
                  type="time"
                  value={horaFinActividad}
                  onChange={e => setHoraFinActividad(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="w-full gap-2"
              disabled={creatingActividad}
              onClick={handleCrearActividad}
            >
              <PlusCircle className="w-4 h-4" />
              {creatingActividad ? 'Creando...' : 'Crear Actividad'}
            </Button>
          </CardContent>
        </Card>

        {/* Activity list */}
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
              <div className="py-6 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : actividades.length === 0 ? (
              <div className="py-6 text-center">
                <Activity className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">No hay actividades creadas.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {actividades.map(act => (
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
                      <span className="inline-flex shrink-0 items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        <Star className="w-2.5 h-2.5" />{act.ponderacion} pts
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(act.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {act.hora_inicio && act.hora_fin && (
                        <span className="ml-1">· {act.hora_inicio.slice(0,5)} → {act.hora_fin.slice(0,5)}</span>
                      )}
                    </p>
                    {act.hora_fin && (() => {
                      const now = new Date()
                      const close = new Date(`${act.fecha}T${act.hora_fin}`)
                      return now > close ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full mt-1.5">
                          Cerrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full mt-1.5">
                          Abierta
                        </span>
                      )
                    })()}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RIGHT: Participants panel */}
      <div className="md:col-span-3 space-y-4">
        {!actividadSeleccionada ? (
          <Card className="h-full flex flex-col">
            <CardContent className="flex-1 flex flex-col items-center justify-center py-16">
              <Users className="w-12 h-12 mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">Selecciona una actividad para ver y registrar participantes.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Search participant */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="w-4 h-4 text-primary" />
                  Registrar Participante
                </CardTitle>
                <CardDescription className="text-xs">
                  Actividad: <span className="font-semibold">{actividadSeleccionada.nombre}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Código o CI del estudiante..."
                    value={codigoInput}
                    onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setSearchError(null); setFoundStudent(null) }}
                    onKeyDown={e => e.key === 'Enter' && handleSearchActivities()}
                    className="font-mono font-bold text-center text-base uppercase tracking-widest"
                    autoComplete="off"
                  />
                  <Button onClick={handleSearchActivities} disabled={searchLoading} className="shrink-0">
                    <Search className="w-4 h-4" />
                    <span className="ml-1.5 hidden sm:inline">Buscar</span>
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
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <UserCheck className="w-4 h-4 text-primary" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estudiante encontrado</span>
                        </div>
                        <p className="font-bold text-base leading-tight">{foundStudent.nombre} {foundStudent.apellido}</p>
                        {foundStudent.codigo && (
                          <p className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm tracking-widest">{foundStudent.codigo}</p>
                        )}
                        <p className="text-xs text-muted-foreground">CI: {foundStudent.ci || '—'} · Paralelo: {foundStudent.paralelo || '—'}</p>
                      </div>
                    </div>
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
  )
}
