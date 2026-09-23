'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  supabase,
  EstudianteRow,
  VistaCalificacionesRow,
  VistaCalificacionesParcialRow,
} from '@/lib/supabase'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Hash,
  Lock,
  CheckCircle,
  Users,
  BarChart3,
  Star,
  Activity,
  CalendarDays,
  Fingerprint,
  BookOpen,
} from 'lucide-react'

const PARCIALES: Array<1 | 2 | 3> = [1, 2, 3]

const TOPES_FALLBACK: Record<1 | 2 | 3, number> = { 1: 3, 2: 3, 3: 4 }

type ParcialVista = {
  parcial: 1 | 2 | 3
  fecha_inicio: string
  fecha_fin: string
  tope: number
  asistencias_presente: number
  total_clases_parcial: number
  nota_asistencia: number
  extras_acumulados: number
  nota_parcial: number
  estado: 'en_curso' | 'finalizado' | 'sin_configurar'
}

function fmtFecha(iso: string): string {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function MiPerfilPage() {
  const router = useRouter()
  const [estudiante, setEstudiante] = useState<EstudianteRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [calificacion, setCalificacion] =
    useState<VistaCalificacionesRow | null>(null)
  const [parciales, setParciales] = useState<ParcialVista[]>([])
  const [presentacionesRevisadas, setPresentacionesRevisadas] = useState<
    { titulo: string; nota: number; ponderacion: number }[]
  >([])

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push('/login')
          return
        }

        const { data: roleData } = await supabase
          .from('usuarios_roles')
          .select('rol')
          .eq('user_id', session.user.id)
          .single()

        if (
          !roleData ||
          (roleData.rol !== 'estudiante' && roleData.rol !== 'delegado')
        ) {
          router.push('/dashboard')
          return
        }

        const { data: estudianteData } = await supabase
          .from('estudiantes')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (!estudianteData) return
        setEstudiante(estudianteData)

        const { data: calificacionData } = await supabase
          .from('vista_calificaciones')
          .select('*')
          .eq('estudiante_id', estudianteData.id)
          .single()

        if (calificacionData) setCalificacion(calificacionData)

        const [{ data: parcialesData }, { data: periodosData }, { data: cfgData }] =
          await Promise.all([
            supabase
              .from('vista_calificaciones_parciales')
              .select('*')
              .eq('estudiante_id', estudianteData.id),
            supabase.from('periodos_parciales').select('*').eq('activo', true),
            supabase
              .from('configuracion_notas')
              .select('clave, valor')
              .in('clave', [
                'puntos_parcial_1',
                'puntos_parcial_2',
                'puntos_parcial_3',
              ]),
          ])

        const topes: Record<number, number> = { ...TOPES_FALLBACK }
        cfgData?.forEach((c) => {
          const m = c.clave.match(/^puntos_parcial_(\\d)$/)
          if (m) topes[Number(m[1])] = Number(c.valor)
        })

        const hoy = new Date().toISOString().slice(0, 10)
        const porParcial = new Map<number, VistaCalificacionesParcialRow>(
          (parcialesData || []).map((r) => [r.parcial, r]),
        )

        const lista: ParcialVista[] = PARCIALES.map((p) => {
          const cfgPeriodo = periodosData?.find((x) => x.parcial === p)
          const fila = porParcial.get(p)

          let estado: ParcialVista['estado'] = 'sin_configurar'
          if (cfgPeriodo) {
            estado = hoy > cfgPeriodo.fecha_fin ? 'finalizado' : 'en_curso'
          }

          return {
            parcial: p,
            fecha_inicio: cfgPeriodo?.fecha_inicio ?? fila?.fecha_inicio ?? '',
            fecha_fin: cfgPeriodo?.fecha_fin ?? fila?.fecha_fin ?? '',
            tope: Number(fila?.tope_asistencia_parcial ?? topes[p]),
            asistencias_presente: Number(fila?.asistencias_presente ?? 0),
            total_clases_parcial: Number(fila?.total_clases_parcial ?? 0),
            nota_asistencia: Number(fila?.nota_asistencia ?? 0),
            extras_acumulados: Number(fila?.extras_acumulados ?? 0),
            nota_parcial: Number(fila?.nota_parcial ?? 0),
            estado,
          }
        })

        setParciales(lista)

        const { data: entregasData } = await supabase
          .from('presentaciones_entregas')
          .select('nota, tarea_id')
          .eq('estudiante_id', estudianteData.id)
          .eq('estado', 'revisado')

        if (entregasData && entregasData.length > 0) {
          const tareaIds = entregasData.map((e) => e.tarea_id)
          const { data: tareasData } = await supabase
            .from('presentaciones_tareas')
            .select('id, titulo, ponderacion')
            .in('id', tareaIds)

          if (tareasData) {
            setPresentacionesRevisadas(
              entregasData.map((e) => {
                const t = tareasData.find((t) => t.id === e.tarea_id)
                return {
                  titulo: t?.titulo || 'Tarea',
                  nota: Number(e.nota) || 0,
                  ponderacion: Number(t?.ponderacion) || 0,
                }
              }),
            )
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    checkAuthAndFetchData()
  }, [router])

  const handleChangePassword = async () => {
    setPasswordError(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Por favor, completa todos los campos.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contrasenas nuevas no coinciden.')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('La contrasena debe tener al menos 6 caracteres.')
      return
    }

    setPasswordLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.email) {
        setPasswordError('No se pudo obtener la sesion actual.')
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      })

      if (signInError) {
        setPasswordError('La contrasena actual es incorrecta.')
        return
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPasswordError(error.message)
      } else {
        setPasswordSuccess(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch {
      setPasswordError('Ocurrio un error inesperado.')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleClosePasswordDialog = () => {
    setPasswordDialogOpen(false)
    setPasswordError(null)
    setPasswordSuccess(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground animate-pulse">
            Cargando tu perfil...
          </p>
        </div>
      </div>
    )
  }

  if (!estudiante) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">
          No se encontraron datos del estudiante
        </p>
      </div>
    )
  }

  const initials = `${estudiante.nombre.charAt(0)}${estudiante.apellido.charAt(0)}`.toUpperCase()
  const codigoEstudiante = estudiante.codigo || estudiante.ru
  const notaAsistencia = calificacion?.nota_asistencia ?? 0
  const asistenciasPresente = calificacion?.asistencias_presente ?? 0
  const totalClases = calificacion?.total_clases ?? 10
  const puntosExtra = calificacion?.puntos_extra ?? 0
  const puntosActividades = calificacion?.puntos_actividades ?? 0
  const puntosPresentaciones = calificacion?.puntos_presentaciones ?? 0
  const notaFinal = calificacion?.nota_final ?? 0

  const notaColor =
    notaAsistencia >= 9
      ? 'text-emerald-600 dark:text-emerald-400'
      : notaAsistencia >= 7
        ? 'text-blue-600 dark:text-blue-400'
        : notaAsistencia >= 5
          ? 'text-yellow-600 dark:text-yellow-400'
          : 'text-purple-600 dark:text-purple-400'

  const barColor =
    notaAsistencia >= 9
      ? 'bg-emerald-500'
      : notaAsistencia >= 7
        ? 'bg-blue-500'
        : notaAsistencia >= 5
          ? 'bg-yellow-500'
          : 'bg-purple-500'

  const badgeFor = (estado: ParcialVista['estado']) =>
    estado === 'finalizado'
      ? {
          label: 'Finalizado',
          cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        }
      : estado === 'en_curso'
        ? {
            label: 'En curso',
            cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800',
          }
        : {
            label: 'Sin configurar',
            cls: 'bg-muted text-muted-foreground border-border',
          }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Mi Perfil
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPasswordDialogOpen(true)}
            className="gap-2"
          >
            <Lock className="w-4 h-4" />
            Cambiar contrasena
          </Button>
        </div>

        <Card className="overflow-hidden border-primary/20 shadow-sm">
          <div className="h-2 bg-gradient-to-r from-primary via-info to-emerald-500" />
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <Avatar className="h-16 w-16 shrink-0 ring-4 ring-primary/10">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="label-caps text-primary mb-1">Perfil del estudiante</p>
                  <CardTitle className="text-xl sm:text-2xl truncate">
                    {estudiante.nombre} {estudiante.apellido}
                  </CardTitle>
                  <CardDescription className="mt-1 truncate">
                    {estudiante.correo}
                  </CardDescription>
                </div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 sm:min-w-44">
                <p className="label-caps text-muted-foreground mb-1">Código de estudiante</p>
                <p className="font-mono text-lg font-bold tracking-wide text-primary">
                  {codigoEstudiante}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 border-t bg-muted/20 pt-4 sm:grid-cols-3">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <Hash className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">RU</span>
              <span className="truncate font-medium">{estudiante.ru}</span>
            </div>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <Fingerprint className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">CI</span>
              <span className="truncate font-medium">{estudiante.ci}</span>
            </div>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">Paralelo</span>
              <span className="font-medium">{estudiante.paralelo}</span>
            </div>
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-5 h-5 text-info" />
            <h2 className="text-lg font-semibold">Avance por Parcial</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {parciales.map((pv) => {
              const badge = badgeFor(pv.estado)
              return (
                <Card key={pv.parcial} className="border-border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      Parcial {pv.parcial}
                      <span
                        className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {pv.fecha_inicio && pv.fecha_fin
                        ? `${fmtFecha(pv.fecha_inicio)} a ${fmtFecha(pv.fecha_fin)}`
                        : 'Sin configurar'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-center">
                      <p className="text-3xl font-bold">
                        {pv.nota_parcial.toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground">
                          {' '}
                          / {pv.tope}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Nota del parcial
                      </p>
                    </div>
                    <div className="space-y-1.5 text-xs border-t pt-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" /> Asistencia
                        </span>
                        <span className="font-medium">
                          {pv.asistencias_presente}/{pv.total_clases_parcial}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" /> Pts asistencia
                        </span>
                        <span className="font-medium">
                          {pv.nota_asistencia.toFixed(2)} / {pv.tope}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Star className="w-3 h-3" /> Extras acumulados
                        </span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          +{pv.extras_acumulados.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        <Card className="border-primary/30 bg-primary/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Nota Global
            </CardTitle>
            <CardDescription className="text-xs">
              Asistencia (10 pts) + actividades + presentaciones + extras
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className={`text-4xl font-bold ${notaColor}`}>
                {notaFinal.toFixed(2)}
              </p>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${Math.min((notaAsistencia / 10) * 100, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Asistencia</span>
                <span className="font-medium">
                  {asistenciasPresente}/{totalClases} = {notaAsistencia.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actividades</span>
                <span className="font-medium">
                  {puntosActividades.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Presentaciones</span>
                <span className="font-medium">
                  {puntosPresentaciones.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Extras</span>
                <span className="font-medium">
                  {puntosExtra.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              Presentaciones calificadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {presentacionesRevisadas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aun no tienes presentaciones calificadas.
              </p>
            ) : (
              <div className="space-y-2">
                {presentacionesRevisadas.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0"
                  >
                    <span className="truncate">{p.titulo}</span>
                    <span className="font-medium shrink-0 ml-2">
                      {p.nota.toFixed(2)} / {p.ponderacion}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AlertDialog
        open={passwordDialogOpen}
        onOpenChange={(open) => !open && handleClosePasswordDialog()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar contrasena</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresa tu contrasena actual y la nueva contrasena.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {passwordSuccess ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2.5 rounded-lg">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Contrasena actualizada correctamente.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="current-password" className="text-xs">
                  Contrasena actual
                </Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={passwordLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs">
                  Nueva contrasena
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={passwordLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs">
                  Confirmar nueva contrasena
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={passwordLoading}
                />
              </div>
              {passwordError && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {passwordError}
                </p>
              )}
            </div>
          )}

          <AlertDialogFooter>
            {passwordSuccess ? (
              <Button onClick={handleClosePasswordDialog}>Cerrar</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleClosePasswordDialog}
                  disabled={passwordLoading}
                >
                  Cancelar
                </Button>
                <Button onClick={handleChangePassword} disabled={passwordLoading}>
                  {passwordLoading ? 'Guardando...' : 'Guardar'}
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}