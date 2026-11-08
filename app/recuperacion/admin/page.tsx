'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  supabase,
  unoDe,
  RecuperacionRow,
  RecuperacionPreguntaRow,
  RecuperacionIntentoRow,
} from '@/lib/supabase'
import { aInputFechaHora, formatFechaHora } from '@/lib/fecha'
import { BloqueCodigo, TextoConCodigo } from '@/components/texto-con-codigo'
import {
  EJEMPLO_JSON,
  LETRAS,
  parsearPreguntas,
  porcentajeAciertos,
} from '@/lib/recuperacion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  AlertCircle,
  CheckCircle,
  ClipboardCheck,
  FileJson,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'

type Recuperacion = RecuperacionRow & {
  total_preguntas: number
  total_intentos: number
}

type IntentoConEstudiante = RecuperacionIntentoRow & {
  estudiante: {
    nombre: string
    apellido: string
    ci: string | null
    paralelo: string | null
  } | null
}

/** Intentos de un estudiante en una recuperación: su nota es la mejor. */
type FilaEstudiante = {
  estudiante_id: string
  estudiante: IntentoConEstudiante['estudiante']
  intentos: IntentoConEstudiante[]
  mejor: number | null
}

type Paralelo = RecuperacionRow['paralelos'][number]

const PARALELOS: Paralelo[] = ['A', 'B', 'C']

type Formulario = {
  id: string | null
  titulo: string
  puntos: string
  duracion_minutos: string
  preguntas_por_intento: string
  paralelos: Paralelo[]
  /** Valor de <input type="datetime-local">: hora local, sin zona. */
  fecha_limite: string
  /** '' = según la fecha en que se rinde */
  parcial: '' | '1' | '2' | '3'
}

const FORM_VACIO: Formulario = {
  id: null,
  titulo: '',
  puntos: '',
  duracion_minutos: '',
  preguntas_por_intento: '',
  paralelos: [...PARALELOS],
  fecha_limite: '',
  parcial: '',
}

function Aviso({ tipo, children }: { tipo: 'error' | 'ok'; children: React.ReactNode }) {
  const clases =
    tipo === 'error'
      ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400'
      : 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
  const Icono = tipo === 'error' ? AlertCircle : CheckCircle
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${clases}`}>
      <Icono className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** Banco de preguntas: lo muestra y, sin intentos, permite reemplazarlo. */
function PanelPreguntas({
  rec,
  onCambio,
}: {
  rec: Recuperacion
  onCambio: () => Promise<void>
}) {
  const [existentes, setExistentes] = useState<RecuperacionPreguntaRow[]>([])
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const { data, error: selectError } = await supabase
      .from('recuperacion_preguntas')
      .select('*')
      .eq('recuperacion_id', rec.id)
      .order('orden', { ascending: true })
    if (selectError) setError(selectError.message)
    else setExistentes((data ?? []) as RecuperacionPreguntaRow[])
  }, [rec.id])

  useEffect(() => {
    const init = async () => {
      await cargar()
    }
    init()
  }, [cargar])

  const { preguntas, errores } = useMemo(
    () =>
      texto.trim() ? parsearPreguntas(texto) : { preguntas: [], errores: [] },
    [texto],
  )

  const leerArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setOk(null)
    setError(null)
    setTexto(await archivo.text())
  }

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    setOk(null)
    const { data, error: rpcError } = await supabase.rpc(
      'cargar_preguntas_recuperacion',
      { p_recuperacion: rec.id, p_preguntas: preguntas },
    )
    setGuardando(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setTexto('')
    setOk(`Se cargaron ${data} preguntas al banco.`)
    await Promise.all([cargar(), onCambio()])
  }

  const bloqueada = rec.total_intentos > 0

  return (
    <div className="space-y-4 border-t pt-4">
      {bloqueada ? (
        <p className="text-sm text-muted-foreground">
          Ya hay estudiantes que la rindieron, así que el banco de preguntas no se
          puede cambiar.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor={`json-${rec.id}`} className="text-sm">
              Cargar banco de preguntas en JSON
              {existentes.length > 0 && (
                <span className="font-normal text-muted-foreground">
                  {' '}
                  (reemplaza las {existentes.length} actuales)
                </span>
              )}
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setTexto(EJEMPLO_JSON)}
              >
                Ver ejemplo
              </Button>
              <Button asChild type="button" size="sm" variant="outline" className="gap-1.5">
                <label className="cursor-pointer">
                  <FileJson className="h-4 w-4" />
                  Subir archivo
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="sr-only"
                    onChange={(e) => void leerArchivo(e)}
                  />
                </label>
              </Button>
            </div>
          </div>
          <Textarea
            id={`json-${rec.id}`}
            value={texto}
            onChange={(e) => {
              setOk(null)
              setError(null)
              setTexto(e.target.value)
            }}
            spellCheck={false}
            rows={8}
            placeholder={'[\n  {\n    "pregunta": "...",\n    "opciones": ["...", "...", "...", "..."],\n    "correcta": "A"\n  }\n]'}
            className="max-h-80 overflow-y-auto font-mono text-xs md:text-xs"
          />
          {errores.length > 0 && (
            <Aviso tipo="error">
              <ul className="space-y-0.5">
                {errores.slice(0, 8).map((e) => (
                  <li key={e} className="break-words">
                    {e}
                  </li>
                ))}
                {errores.length > 8 && <li>... y {errores.length - 8} error(es) más.</li>}
              </ul>
            </Aviso>
          )}
          {preguntas.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                className={`text-sm ${
                  preguntas.length < rec.preguntas_por_intento
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground'
                }`}
              >
                {preguntas.length} preguntas para el banco.{' '}
                {preguntas.length < rec.preguntas_por_intento
                  ? `No alcanzan: a cada estudiante le tocan ${rec.preguntas_por_intento}.`
                  : `A cada estudiante le tocan ${rec.preguntas_por_intento} al azar. El 100% de aciertos da ${Number(rec.puntos).toFixed(2)} pts.`}
              </p>
              <Button size="sm" disabled={guardando} onClick={() => void guardar()}>
                {guardando ? 'Guardando...' : `Guardar ${preguntas.length} preguntas`}
              </Button>
            </div>
          )}
        </div>
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      {existentes.length > 0 && (
        <ol className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {existentes.map((p, i) => (
            <li key={p.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex gap-1.5 font-medium">
                <span className="shrink-0">{i + 1}.</span>
                <TextoConCodigo texto={p.enunciado} />
              </div>
              {p.codigo && <BloqueCodigo codigo={p.codigo} className="mt-1.5" />}
              <ul className="mt-1.5 grid gap-x-3 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                {p.opciones.map((o, idx) => (
                  <li
                    key={idx}
                    className={`flex min-w-0 gap-1 ${
                      idx === p.correcta
                        ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                        : ''
                    }`}
                  >
                    <span className="shrink-0">{LETRAS[idx]}.</span>
                    <TextoConCodigo texto={o} />
                    {idx === p.correcta && <span className="shrink-0">(correcta)</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** Notas por estudiante. Reiniciar borra sus oportunidades y retira sus puntos. */
function PanelResultados({
  rec,
  onCambio,
}: {
  rec: Recuperacion
  onCambio: () => Promise<void>
}) {
  const [intentos, setIntentos] = useState<IntentoConEstudiante[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aReiniciar, setAReiniciar] = useState<FilaEstudiante | null>(null)

  const cargar = useCallback(async () => {
    const { data, error: selectError } = await supabase
      .from('recuperacion_intentos')
      .select(
        'id, recuperacion_id, estudiante_id, numero, iniciado_en, vence_en, finalizado_en, correctas, total_preguntas, puntos_obtenidos, estudiante:estudiantes(nombre, apellido, ci, paralelo)',
      )
      .eq('recuperacion_id', rec.id)
    setCargando(false)
    if (selectError) {
      setError(selectError.message)
      return
    }
    const filas = (data ?? []).map((f) => ({
      ...f,
      estudiante: unoDe(f.estudiante),
    })) as IntentoConEstudiante[]
    setIntentos(filas)
  }, [rec.id])

  const porEstudiante = useMemo(() => {
    const mapa = new Map<string, FilaEstudiante>()
    intentos.forEach((i) => {
      const fila = mapa.get(i.estudiante_id) ?? {
        estudiante_id: i.estudiante_id,
        estudiante: i.estudiante,
        intentos: [],
        mejor: null,
      }
      fila.intentos.push(i)
      if (i.puntos_obtenidos !== null) {
        fila.mejor = Math.max(fila.mejor ?? 0, Number(i.puntos_obtenidos))
      }
      mapa.set(i.estudiante_id, fila)
    })
    return [...mapa.values()].sort((a, b) =>
      (a.estudiante?.apellido ?? '').localeCompare(b.estudiante?.apellido ?? ''),
    )
  }, [intentos])

  useEffect(() => {
    const init = async () => {
      await cargar()
    }
    init()
  }, [cargar])

  const reiniciar = async () => {
    if (!aReiniciar) return
    const estudianteId = aReiniciar.estudiante_id
    setAReiniciar(null)
    setError(null)
    const { error: deleteError } = await supabase
      .from('recuperacion_intentos')
      .delete()
      .eq('recuperacion_id', rec.id)
      .eq('estudiante_id', estudianteId)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    await Promise.all([cargar(), onCambio()])
  }

  return (
    <div className="space-y-3 border-t pt-4">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : porEstudiante.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía ningún estudiante la rindió.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[38rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Estudiante</th>
                <th className="py-2 pr-3 font-medium">Paralelo</th>
                {Array.from({ length: rec.max_intentos }, (_, n) => (
                  <th key={n} className="py-2 pr-3 font-medium">
                    {rec.max_intentos > 1 ? `Oportunidad ${n + 1}` : 'Aciertos'}
                  </th>
                ))}
                <th className="py-2 pr-3 font-medium">Nota</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {porEstudiante.map((fila) => (
                <tr key={fila.estudiante_id} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    {fila.estudiante
                      ? `${fila.estudiante.apellido} ${fila.estudiante.nombre}`
                      : '-'}
                  </td>
                  <td className="py-2 pr-3">{fila.estudiante?.paralelo ?? '-'}</td>
                  {Array.from({ length: rec.max_intentos }, (_, n) => {
                    const intento = fila.intentos.find((i) => i.numero === n + 1)
                    return (
                      <td key={n} className="py-2 pr-3 tabular-nums">
                        {!intento ? (
                          <span className="text-muted-foreground">-</span>
                        ) : intento.finalizado_en ? (
                          `${intento.correctas}/${intento.total_preguntas} · ${porcentajeAciertos(intento.correctas ?? 0, intento.total_preguntas ?? 0)}%`
                        ) : (
                          <span className="text-muted-foreground">En curso</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="py-2 pr-3 font-semibold tabular-nums">
                    {fila.mejor === null
                      ? '-'
                      : `${fila.mejor.toFixed(2)} / ${Number(rec.puntos).toFixed(2)}`}
                  </td>
                  <td className="py-2 text-right">
                    <Button size="xs" variant="ghost" onClick={() => setAReiniciar(fila)}>
                      Reiniciar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog
        open={aReiniciar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setAReiniciar(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reiniciar a este estudiante?</AlertDialogTitle>
            <AlertDialogDescription>
              {aReiniciar?.estudiante?.nombre} {aReiniciar?.estudiante?.apellido}{' '}
              perderá sus respuestas y los puntos obtenidos, y podrá volver a
              rendirla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void reiniciar()}>
              Reiniciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function RecuperacionAdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [lista, setLista] = useState<Recuperacion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Formulario | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [abierto, setAbierto] = useState<{
    id: string
    panel: 'preguntas' | 'resultados'
  } | null>(null)
  const [aEliminar, setAEliminar] = useState<Recuperacion | null>(null)

  const cargar = useCallback(async () => {
    // Antes de mostrar notas: quien cerro el navegador tambien debe tener la suya.
    const { error: cerrarError } = await supabase.rpc(
      'cerrar_recuperaciones_vencidas',
    )
    if (cerrarError) console.error(cerrarError)

    const { data, error: selectError } = await supabase
      .from('recuperaciones')
      .select('*, recuperacion_preguntas(count), recuperacion_intentos(count)')
      .order('creado_en', { ascending: false })
    if (selectError) {
      setError(selectError.message)
      return
    }
    setLista(
      (data ?? []).map((r) => ({
        ...r,
        total_preguntas: unoDe(r.recuperacion_preguntas)?.count ?? 0,
        total_intentos: unoDe(r.recuperacion_intentos)?.count ?? 0,
      })) as Recuperacion[],
    )
  }, [])

  useEffect(() => {
    const init = async () => {
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

        if (!roleData || roleData.rol !== 'auxiliar') {
          router.push('/dashboard')
          return
        }

        await cargar()
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router, cargar])

  const guardarFormulario = async () => {
    if (!form) return
    const titulo = form.titulo.trim()
    const puntos = Number(form.puntos)
    const minutos = Number(form.duracion_minutos)
    const porIntento = Number(form.preguntas_por_intento)
    if (!titulo) return setError('Escribe un título.')
    if (!(puntos > 0) || puntos > 999) {
      return setError('Los puntos deben ser mayores a 0.')
    }
    if (!Number.isInteger(minutos) || minutos < 1 || minutos > 600) {
      return setError('El tiempo debe ser un número entero de 1 a 600 minutos.')
    }
    if (!Number.isInteger(porIntento) || porIntento < 1) {
      return setError('Indica cuántas preguntas le tocan a cada estudiante.')
    }
    if (form.paralelos.length === 0) {
      return setError('Elige al menos un paralelo.')
    }
    if (!form.fecha_limite) {
      return setError('Indica la fecha límite de entrega.')
    }
    // Editar el título de una ya vencida no debe exigir cambiarle la fecha.
    const original = lista.find((r) => r.id === form.id)
    const fechaCambio = aInputFechaHora(original?.fecha_limite) !== form.fecha_limite
    if (fechaCambio && new Date(form.fecha_limite) <= new Date()) {
      return setError('La fecha límite debe ser futura.')
    }

    setGuardando(true)
    setError(null)
    const fila = {
      titulo,
      puntos,
      duracion_minutos: minutos,
      preguntas_por_intento: porIntento,
      paralelos: form.paralelos,
      // new Date lo lee como hora local; toISOString guarda el instante correcto.
      fecha_limite: new Date(form.fecha_limite).toISOString(),
      parcial: form.parcial ? Number(form.parcial) : null,
    }
    const { error: saveError } = form.id
      ? await supabase.from('recuperaciones').update(fila).eq('id', form.id)
      : await supabase.from('recuperaciones').insert(fila)
    setGuardando(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setForm(null)
    await cargar()
  }

  const cambiarActiva = async (rec: Recuperacion) => {
    setError(null)
    const { error: updateError } = await supabase
      .from('recuperaciones')
      .update({ activa: !rec.activa })
      .eq('id', rec.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await cargar()
  }

  const eliminar = async () => {
    if (!aEliminar) return
    const id = aEliminar.id
    setAEliminar(null)
    setError(null)
    const { error: deleteError } = await supabase
      .from('recuperaciones')
      .delete()
      .eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    if (abierto?.id === id) setAbierto(null)
    await cargar()
  }

  const alternarPanel = (id: string, panel: 'preguntas' | 'resultados') => {
    setAbierto((prev) =>
      prev?.id === id && prev.panel === panel ? null : { id, panel },
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="animate-pulse text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  const editandoConIntentos =
    form?.id != null &&
    (lista.find((r) => r.id === form.id)?.total_intentos ?? 0) > 0

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-info/10 p-2 sm:p-2.5">
              <ClipboardCheck className="h-5 w-5 text-info sm:h-6 sm:w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Recuperación
            </h1>
          </div>
          <p className="ml-11 text-sm text-muted-foreground sm:ml-14">
            La nota se calcula sola por porcentaje de aciertos: el 100% da todos los
            puntos, el 50% la mitad. Se suma a los extras del estudiante.
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setError(null)
            setForm(FORM_VACIO)
          }}
        >
          <Plus className="h-4 w-4" />
          Nueva recuperación
        </Button>
      </div>

      {error && (
        <div className="mb-4">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

      {form && (
        <Card className="mb-4 border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {form.id ? 'Editar recuperación' : 'Nueva recuperación'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem_7rem_9rem]">
              <div className="space-y-1.5">
                <Label htmlFor="rec-titulo" className="text-xs">
                  Título
                </Label>
                <Input
                  id="rec-titulo"
                  value={form.titulo}
                  maxLength={150}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-puntos" className="text-xs">
                  Vale (pts)
                </Label>
                <Input
                  id="rec-puntos"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.puntos}
                  disabled={editandoConIntentos}
                  onChange={(e) => setForm({ ...form, puntos: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-minutos" className="text-xs">
                  Tiempo (min)
                </Label>
                <Input
                  id="rec-minutos"
                  type="number"
                  min="1"
                  max="600"
                  step="1"
                  value={form.duracion_minutos}
                  onChange={(e) =>
                    setForm({ ...form, duracion_minutos: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-por-intento" className="text-xs">
                  Preguntas por estudiante
                </Label>
                <Input
                  id="rec-por-intento"
                  type="number"
                  min="1"
                  step="1"
                  value={form.preguntas_por_intento}
                  disabled={editandoConIntentos}
                  onChange={(e) =>
                    setForm({ ...form, preguntas_por_intento: e.target.value })
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Cuántas preguntas del banco le salen a cada estudiante, no las
              oportunidades (siempre es una). Con 10 preguntas, 5 aciertos son el 50%
              de los puntos.
            </p>
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="rec-fecha-limite" className="text-xs">
                Fecha límite de entrega
              </Label>
              <Input
                id="rec-fecha-limite"
                type="datetime-local"
                value={form.fecha_limite}
                onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Después de esta fecha nadie puede empezar, y quien esté respondiendo
                se corta en ese momento con lo que lleve.
              </p>
            </div>
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="rec-parcial" className="text-xs">
                Suma al parcial
              </Label>
              <select
                id="rec-parcial"
                value={form.parcial}
                onChange={(e) =>
                  setForm({ ...form, parcial: e.target.value as Formulario['parcial'] })
                }
                className="h-9 w-full rounded-xl border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Según la fecha en que se rinde</option>
                <option value="1">Parcial 1</option>
                <option value="2">Parcial 2</option>
                <option value="3">Parcial 3</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Llena ese parcial hasta su tope, contando lo que el estudiante ya
                tenía. Lo que sobre pasa al parcial siguiente.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Paralelos que pueden rendirla</Label>
              <div className="flex gap-2">
                {PARALELOS.map((p) => {
                  const marcado = form.paralelos.includes(p)
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-label={`Paralelo ${p}`}
                      aria-pressed={marcado}
                      onClick={() =>
                        setForm({
                          ...form,
                          paralelos: marcado
                            ? form.paralelos.filter((x) => x !== p)
                            : PARALELOS.filter(
                                (x) => x === p || form.paralelos.includes(x),
                              ),
                        })
                      }
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                        marcado
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>
            {editandoConIntentos && (
              <p className="text-xs text-muted-foreground">
                Los puntos y la cantidad de preguntas no se pueden cambiar porque ya
                hay estudiantes que la empezaron. Un tiempo nuevo solo aplica a los
                intentos que aún no empezaron.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button disabled={guardando} onClick={() => void guardarFormulario()}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Aún no hay recuperaciones. Crea la primera y carga sus preguntas.
        </p>
      ) : (
        <div className="space-y-3">
          {lista.map((rec) => (
            <Card key={rec.id} className="border-border shadow-sm">
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{rec.titulo}</p>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          rec.activa
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {rec.activa ? 'Activa' : 'Oculta'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Banco de {rec.total_preguntas} ·{' '}
                      {rec.preguntas_por_intento} por estudiante ·{' '}
                      {rec.duracion_minutos} min · 100% de aciertos ={' '}
                      {Number(rec.puntos).toFixed(2)} pts
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Paralelos {rec.paralelos.join(', ')} · {rec.max_intentos}{' '}
                      {rec.max_intentos === 1 ? 'oportunidad' : 'oportunidades'} ·{' '}
                      {rec.total_intentos} intento(s)
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {rec.parcial
                        ? `Suma al Parcial ${rec.parcial} (excedente al siguiente) · `
                        : 'Suma al parcial de la fecha en que se rinde · '}
                      {rec.fecha_limite
                        ? `Hasta el ${formatFechaHora(rec.fecha_limite)}`
                        : 'Sin fecha límite'}
                      {rec.fecha_limite &&
                        new Date(rec.fecha_limite) <= new Date() &&
                        ' · plazo vencido'}
                    </p>
                    {rec.total_preguntas < rec.preguntas_por_intento && (
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        Faltan{' '}
                        {rec.preguntas_por_intento - rec.total_preguntas} preguntas
                        en el banco para poder activarla.
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={rec.activa ? 'outline' : 'default'}
                    disabled={
                      !rec.activa && rec.total_preguntas < rec.preguntas_por_intento
                    }
                    onClick={() => void cambiarActiva(rec)}
                  >
                    {rec.activa ? 'Ocultar' : 'Activar'}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    aria-expanded={abierto?.id === rec.id && abierto.panel === 'preguntas'}
                    onClick={() => alternarPanel(rec.id, 'preguntas')}
                  >
                    <ListChecks className="h-4 w-4" />
                    Preguntas
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    aria-expanded={abierto?.id === rec.id && abierto.panel === 'resultados'}
                    onClick={() => alternarPanel(rec.id, 'resultados')}
                  >
                    <Users className="h-4 w-4" />
                    Resultados
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    onClick={() => {
                      setError(null)
                      setForm({
                        id: rec.id,
                        titulo: rec.titulo,
                        puntos: String(rec.puntos),
                        duracion_minutos: String(rec.duracion_minutos),
                        preguntas_por_intento: String(rec.preguntas_por_intento),
                        paralelos: rec.paralelos,
                        fecha_limite: aInputFechaHora(rec.fecha_limite),
                        parcial: rec.parcial
                          ? (String(rec.parcial) as Formulario['parcial'])
                          : '',
                      })
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => setAEliminar(rec)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </Button>
                </div>

                {abierto?.id === rec.id && abierto.panel === 'preguntas' && (
                  <PanelPreguntas rec={rec} onCambio={cargar} />
                )}
                {abierto?.id === rec.id && abierto.panel === 'resultados' && (
                  <PanelResultados rec={rec} onCambio={cargar} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={aEliminar !== null}
        onOpenChange={(open) => {
          if (!open) setAEliminar(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{aEliminar?.titulo}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran sus preguntas
              {aEliminar && aEliminar.total_intentos > 0
                ? ` y los ${aEliminar.total_intentos} intento(s). Los puntos que ganaron esos estudiantes se retiran de sus notas`
                : ''}
              . No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void eliminar()}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
