'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatFechaHora } from '@/lib/fecha'
import {
  formatTiempo,
  LETRAS,
  mensajeDePregunta,
  mensajeDeProgreso,
  mensajeDeResultado,
  porcentajeAciertos,
} from '@/lib/recuperacion'
import { CompaneroAnimo, Confeti } from '@/components/companero-animo'
import { BloqueCodigo, TextoConCodigo } from '@/components/texto-con-codigo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  ArrowRight,
  CalendarClock,
  CheckCircle,
  ClipboardCheck,
  Clock,
  Eye,
} from 'lucide-react'

type ItemLista = {
  id: string
  titulo: string
  puntos: number
  duracion_minutos: number
  fecha_limite: string | null
  total_preguntas: number
  max_intentos: number
  intentos_usados: number
  mejor_puntos: number | null
  estado: 'disponible' | 'en_curso' | 'finalizado' | 'vencida'
}

type Resultado = {
  estado: 'finalizado'
  recuperacion_id: string
  titulo: string
  puntos: number
  numero: number
  max_intentos: number
  correctas: number
  total_preguntas: number
  puntos_obtenidos: number
  mejor_puntos: number
  intentos_usados: number
  /** Marcadas en pantalla que llegaron al servidor después del límite. */
  rechazadas?: number
}

/** El servidor solo entrega la pregunta actual: no hay forma de ver las demás. */
type PreguntaEnCurso = {
  estado: 'en_curso'
  intento_id: string
  titulo: string
  puntos: number
  numero: number
  max_intentos: number
  segundos_restantes: number
  posicion: number
  total_preguntas: number
  respuesta: number | null
  pregunta: {
    id: string
    enunciado: string
    codigo: string | null
    /** Ya vienen barajadas. Se responde con la posición en esta lista. */
    opciones: string[]
  }
}

/** Sostener el dedo más que esto es leer, no elegir. */
const MS_TOQUE_LARGO = 300

/**
 * Inciso difuminado: se lee solo mientras el mouse está encima o, en celulares,
 * mientras se mantiene presionado (no hay hover en una pantalla táctil). Con
 * teclado se revela al enfocarlo.
 *
 * En celular leer y elegir usan el mismo dedo: un toque corto elige, y soltar
 * después de leer no marca nada.
 *
 * Es un freno a las capturas y al copiado, no una protección real: el texto está
 * en la página y se puede leer desde las herramientas del navegador.
 */
function OpcionDifuminada({
  nombre,
  posicion,
  texto,
  marcada,
  bloqueada,
  onElegir,
}: {
  nombre: string
  posicion: number
  texto: string
  marcada: boolean
  bloqueada: boolean
  onElegir: () => void
}) {
  const [visible, setVisible] = useState(false)
  const inicioToque = useRef<number | null>(null)
  const fueLargo = useRef(false)

  return (
    <label
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setVisible(true)
      }}
      onPointerLeave={() => {
        setVisible(false)
        inicioToque.current = null
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return
        inicioToque.current = Date.now()
        fueLargo.current = false
        setVisible(true)
      }}
      onPointerUp={(e) => {
        if (e.pointerType === 'mouse') return
        fueLargo.current =
          inicioToque.current !== null &&
          Date.now() - inicioToque.current >= MS_TOQUE_LARGO
        inicioToque.current = null
        setVisible(false)
      }}
      // Al arrastrar para hacer scroll el navegador cancela el toque: se oculta.
      onPointerCancel={() => {
        inicioToque.current = null
        setVisible(false)
      }}
      onClick={(e) => {
        if (fueLargo.current) {
          fueLargo.current = false
          e.preventDefault()
        }
      }}
      // El toque largo abre el menú de copiar en los celulares.
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      className={`flex min-h-11 cursor-pointer touch-pan-y select-none items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors [-webkit-touch-callout:none] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
        marcada
          ? 'border-primary bg-primary/10 font-medium'
          : 'border-border hover:bg-muted'
      } ${bloqueada ? 'pointer-events-none opacity-60' : ''}`}
    >
      <input
        type="radio"
        name={nombre}
        className="sr-only"
        checked={marcada}
        disabled={bloqueada}
        onChange={onElegir}
        onFocus={(e) => {
          if (e.currentTarget.matches(':focus-visible')) setVisible(true)
        }}
        onBlur={() => setVisible(false)}
      />
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold ${
          marcada
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border text-muted-foreground'
        }`}
      >
        {LETRAS[posicion]}
      </span>
      <div
        data-visible={visible}
        className={`min-w-0 flex-1 transition-[filter] duration-150 ${
          visible ? '' : 'blur-[6px]'
        }`}
      >
        <TextoConCodigo texto={texto} />
      </div>
    </label>
  )
}

/**
 * Compañero de la pregunta. Salta al responder, pero el mensaje es el mismo
 * sea la respuesta correcta o no: no debe servir de pista.
 */
function AnimoDePregunta({
  indice,
  respuesta,
}: {
  indice: number
  respuesta: number | null
}) {
  const respondida = respuesta !== null
  return (
    <div className="flex items-end gap-2 pt-1">
      {/* key: cambiar de opción repite el salto */}
      <CompaneroAnimo
        key={respuesta ?? 'sin-responder'}
        indice={indice}
        feliz={respondida}
        className="h-11 w-11"
      />
      <p
        key={respondida ? 'despues' : 'antes'}
        data-animo
        className="relative mb-1.5 animate-[comp-burbuja_0.25s_ease-out] rounded-xl rounded-bl-sm bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
      >
        {mensajeDePregunta(indice, respondida)}
      </p>
    </div>
  )
}

/**
 * Respuesta que quedó sin confirmar en este dispositivo (recarga o reinicio con
 * mala señal). El servidor la vuelve a validar al enviarla.
 */
function leerPendiente(clave: string, preguntaId: string): number | null {
  try {
    const datos = JSON.parse(localStorage.getItem(clave) ?? '{}') as {
      pregunta?: string
      opcion?: unknown
    }
    const { opcion } = datos
    return datos.pregunta === preguntaId &&
      Number.isInteger(opcion) &&
      (opcion as number) >= 0 &&
      (opcion as number) <= 3
      ? (opcion as number)
      : null
  } catch {
    return null
  }
}

function Examen({
  inicial,
  onResultado,
}: {
  inicial: PreguntaEnCurso
  onResultado: (r: Resultado) => void
}) {
  const intentoId = inicial.intento_id
  const clavePendiente = `recuperacion:${intentoId}:pendiente`

  const [actual, setActual] = useState(inicial)
  const [marcada, setMarcada] = useState<number | null>(
    () => leerPendiente(clavePendiente, inicial.pregunta.id) ?? inicial.respuesta,
  )
  const [restante, setRestante] = useState(inicial.segundos_restantes)
  const [finalizando, setFinalizando] = useState(false)
  const [avanzando, setAvanzando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState(false)
  const [errorFinal, setErrorFinal] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<'pasar' | 'finalizar' | null>(null)

  // Respuesta marcada que aún no confirmó el servidor.
  const pendiente = useRef<{ pregunta: string; opcion: number } | null>(null)
  const vaciando = useRef<Promise<void> | null>(null)
  const terminando = useRef(false)
  const rechazadas = useRef(0)
  const tarjeta = useRef<HTMLElement | null>(null)

  /** Copia la pendiente al dispositivo: recargar no debe perderla. */
  const persistir = useCallback(() => {
    try {
      if (pendiente.current) {
        localStorage.setItem(clavePendiente, JSON.stringify(pendiente.current))
      } else {
        localStorage.removeItem(clavePendiente)
      }
    } catch {
      // Sin almacenamiento (modo privado) solo se pierde este respaldo.
    }
  }, [clavePendiente])

  /** Envía la pendiente. Si falla la red, queda para reintentar. */
  const vaciar = useCallback((): Promise<void> => {
    if (vaciando.current) return vaciando.current

    const tarea = (async () => {
      while (pendiente.current) {
        const { pregunta, opcion } = pendiente.current
        const { data, error } = await supabase.rpc('responder_recuperacion', {
          p_intento: intentoId,
          p_pregunta: pregunta,
          p_opcion: opcion,
        })
        if (error) {
          setErrorGuardado(true)
          return
        }
        if (data === 'otra_pregunta') {
          // Avanzó desde otra pestaña: esta ya no es la pregunta actual.
          pendiente.current = null
          persistir()
          setErrorGuardado(false)
          setErrorFinal(
            'Avanzaste desde otra pestaña o dispositivo. Recarga la página para continuar.',
          )
          return
        }
        if (data !== 'guardado') {
          // Ya no se acepta: se cuenta para avisarle junto con la nota, porque
          // en pantalla sigue marcada.
          rechazadas.current += 1
          pendiente.current = null
          persistir()
          setErrorGuardado(false)
          return
        }
        // Si cambió de opción mientras viajaba, la nueva sigue pendiente.
        if (
          pendiente.current?.pregunta === pregunta &&
          pendiente.current.opcion === opcion
        ) {
          pendiente.current = null
          persistir()
        }
      }
      setErrorGuardado(false)
    })().finally(() => {
      vaciando.current = null
    })

    vaciando.current = tarea
    return tarea
  }, [intentoId, persistir])

  // Reenvía lo que quedó sin confirmar en una visita anterior.
  useEffect(() => {
    const init = async () => {
      const opcion = leerPendiente(clavePendiente, inicial.pregunta.id)
      if (opcion !== null) {
        pendiente.current = { pregunta: inicial.pregunta.id, opcion }
      }
      await vaciar()
    }
    init()
  }, [clavePendiente, inicial.pregunta.id, vaciar])

  const terminar = useCallback(
    async (tiempoAgotado: boolean) => {
      if (terminando.current) return
      terminando.current = true
      setFinalizando(true)
      setErrorFinal(null)

      await vaciar()

      // Terminando a mano no se califica con una respuesta sin guardar. Si se
      // acabó el tiempo sí: el servidor ya no aceptaría más.
      if (!tiempoAgotado && pendiente.current) {
        terminando.current = false
        setFinalizando(false)
        setErrorFinal(
          'Tu respuesta no se guardó. Revisa tu conexión y vuelve a intentarlo.',
        )
        return
      }

      const { data, error } = await supabase.rpc('finalizar_recuperacion', {
        p_intento: intentoId,
      })
      if (error) {
        terminando.current = false
        setFinalizando(false)
        setErrorFinal(
          tiempoAgotado
            ? 'Se acabó el tiempo y no se pudo conectar. Tus respuestas guardadas se calificarán igual: vuelve a intentarlo o recarga la página.'
            : 'No se pudo finalizar. Revisa tu conexión y vuelve a intentarlo.',
        )
        return
      }
      onResultado({ ...(data as Resultado), rechazadas: rechazadas.current })
    },
    [intentoId, onResultado, vaciar],
  )

  // Se calcula contra una hora fija, no restando 1: los celulares frenan los
  // intervalos con la pantalla apagada y el contador se atrasaría.
  useEffect(() => {
    const fin = Date.now() + inicial.segundos_restantes * 1000
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((fin - Date.now()) / 1000))
      setRestante(r)
      if (r === 0) void terminar(true)
    }, 1000)
    return () => clearInterval(id)
  }, [inicial.segundos_restantes, terminar])

  const elegir = (opcion: number) => {
    setMarcada(opcion)
    pendiente.current = { pregunta: actual.pregunta.id, opcion }
    persistir()
    void vaciar()
  }

  /** Pasa a la siguiente sin vuelta atrás. Primero debe quedar guardada la actual. */
  const siguiente = async () => {
    if (avanzando) return
    setAvanzando(true)
    setErrorFinal(null)
    try {
      await vaciar()
      if (pendiente.current) {
        setErrorFinal(
          'Tu respuesta no se guardó. Revisa tu conexión y vuelve a intentarlo.',
        )
        return
      }
      const { data, error } = await supabase.rpc('avanzar_recuperacion', {
        p_intento: intentoId,
        p_posicion: actual.posicion,
      })
      if (error) {
        setErrorFinal('No se pudo avanzar. Revisa tu conexión y vuelve a intentarlo.')
        return
      }
      const r = data as PreguntaEnCurso | Resultado | { estado: 'vencido' }
      if (r.estado === 'vencido') {
        await terminar(true)
      } else if (r.estado === 'finalizado') {
        onResultado({ ...r, rechazadas: rechazadas.current })
      } else {
        setActual(r)
        setMarcada(r.respuesta)
        tarjeta.current?.scrollIntoView({ block: 'nearest' })
      }
    } finally {
      setAvanzando(false)
    }
  }

  const total = actual.total_preguntas
  const esUltima = actual.posicion >= total - 1
  const bloqueado = finalizando || avanzando || restante === 0
  const avance =
    total > 0 ? ((actual.posicion + (marcada !== null ? 1 : 0)) / total) * 100 : 0

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-8">
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{actual.titulo}</p>
            <p className="truncate text-xs text-muted-foreground">
              {actual.max_intentos > 1 &&
                `Oportunidad ${actual.numero} de ${actual.max_intentos} · `}
              Pregunta {actual.posicion + 1} de {total}
            </p>
          </div>
          <div
            role="timer"
            aria-label="Tiempo restante"
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-base font-semibold tabular-nums ${
              restante <= 60
                ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400'
                : 'border-border'
            }`}
          >
            <Clock className="h-4 w-4" />
            {formatTiempo(restante)}
          </div>
        </div>

        <p className="mt-1 text-xs font-medium text-primary">
          {mensajeDeProgreso(actual.posicion, total, restante)}
        </p>

        {/* El compañero camina por la barra a medida que se avanza. */}
        <div className="relative mt-6 h-1.5 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${avance}%` }}
          />
          <div
            data-caminante
            className="absolute -top-[26px] -translate-x-1/2 transition-[left] duration-500 ease-out"
            style={{ left: `clamp(14px, ${avance}%, calc(100% - 14px))` }}
          >
            <CompaneroAnimo
              key={`${actual.posicion}-${marcada ?? 'x'}`}
              indice={0}
              feliz={avance > 0}
              className="h-7 w-7"
            />
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-info/30 bg-info/5 px-4 py-3">
        <Eye className="mt-0.5 h-5 w-5 shrink-0 text-info" />
        <p className="text-sm text-muted-foreground">
          <span className="pointer-coarse:hidden">
            Los incisos están difuminados: pasa el mouse sobre cada uno para leerlo.
          </span>
          <span className="hidden pointer-coarse:inline">
            Los incisos están difuminados: mantén presionado cada uno para leerlo y
            dale un toque corto para elegirlo.
          </span>{' '}
          <strong className="font-semibold">
            No podrás volver a las preguntas anteriores.
          </strong>{' '}
          El tiempo sigue corriendo aunque cierres la página.
        </p>
      </div>

      {errorGuardado && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            No se pudo guardar tu respuesta. Revisa tu conexión.
          </span>
          <Button size="xs" variant="outline" onClick={() => void vaciar()}>
            Reintentar
          </Button>
        </div>
      )}

      <section
        ref={tarjeta}
        // key: la pregunta nueva entra animada y sin rastros de la anterior.
        key={actual.pregunta.id}
        className="scroll-mt-32 animate-[comp-burbuja_0.25s_ease-out]"
      >
        <Card className="border-border shadow-sm">
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                {actual.posicion + 1}
              </span>
              <TextoConCodigo
                data-enunciado
                texto={actual.pregunta.enunciado}
                className="flex-1 pt-0.5 font-medium leading-relaxed"
              />
            </div>
            {actual.pregunta.codigo && (
              <BloqueCodigo codigo={actual.pregunta.codigo} />
            )}
            <div className="space-y-2">
              {actual.pregunta.opciones.map((opcion, pos) => (
                <OpcionDifuminada
                  key={pos}
                  nombre={actual.pregunta.id}
                  posicion={pos}
                  texto={opcion}
                  marcada={marcada === pos}
                  bloqueada={bloqueado}
                  onElegir={() => elegir(pos)}
                />
              ))}
            </div>
            <AnimoDePregunta indice={actual.posicion} respuesta={marcada} />
          </CardContent>
        </Card>
      </section>

      {errorFinal && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorFinal}</span>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        {esUltima ? (
          <Button
            onClick={() =>
              restante === 0 ? void terminar(true) : setConfirmar('finalizar')
            }
            disabled={finalizando || avanzando}
            className="w-full gap-2 sm:w-auto"
          >
            <CheckCircle className="h-4 w-4" />
            {finalizando ? 'Finalizando...' : 'Finalizar'}
          </Button>
        ) : (
          <Button
            onClick={() =>
              marcada === null ? setConfirmar('pasar') : void siguiente()
            }
            disabled={bloqueado}
            className="w-full gap-2 sm:w-auto"
          >
            {avanzando ? 'Guardando...' : 'Siguiente'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <AlertDialog
        open={confirmar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setConfirmar(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar === 'pasar'
                ? '¿Pasar sin responder?'
                : '¿Finalizar la recuperación?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar === 'pasar'
                ? 'Esta pregunta contará como incorrecta y no podrás volver a ella.'
                : `${
                    marcada === null
                      ? 'Esta última pregunta contará como incorrecta. '
                      : ''
                  }Después no podrás cambiar tus respuestas.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {confirmar === 'pasar' ? 'Quedarme aquí' : 'Seguir respondiendo'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmar === 'pasar') void siguiente()
                else void terminar(false)
              }}
            >
              {confirmar === 'pasar' ? 'Pasar' : 'Finalizar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

export default function RecuperacionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [lista, setLista] = useState<ItemLista[]>([])
  const [error, setError] = useState<string | null>(null)
  const [iniciando, setIniciando] = useState<string | null>(null)
  const [porIniciar, setPorIniciar] = useState<ItemLista | null>(null)
  const [examen, setExamen] = useState<PreguntaEnCurso | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const cargarLista = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('mis_recuperaciones')
    if (rpcError) {
      console.error(rpcError)
      setError('No se pudieron cargar las recuperaciones.')
      return
    }
    setLista((data ?? []) as ItemLista[])
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

        if (roleData?.rol === 'auxiliar') {
          router.push('/recuperacion/admin')
          return
        }
        if (roleData?.rol !== 'estudiante' && roleData?.rol !== 'delegado') {
          router.push('/dashboard')
          return
        }

        await cargarLista()
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router, cargarLista])

  const abrir = async (item: ItemLista) => {
    setPorIniciar(null)
    setIniciando(item.id)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('iniciar_recuperacion', {
      p_recuperacion: item.id,
    })
    setIniciando(null)
    if (rpcError) {
      setError(rpcError.message)
      await cargarLista()
      return
    }
    const r = data as PreguntaEnCurso | Resultado
    if (r.estado === 'en_curso') setExamen(r)
    else setResultado(r)
  }

  const onResultado = useCallback((r: Resultado) => {
    setExamen(null)
    setResultado(r)
  }, [])

  const volverALista = async () => {
    setResultado(null)
    await cargarLista()
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

  if (examen) return <Examen inicial={examen} onResultado={onResultado} />

  if (resultado) {
    const proporcion =
      resultado.total_preguntas > 0
        ? resultado.correctas / resultado.total_preguntas
        : 0
    const quedan = resultado.max_intentos - resultado.intentos_usados
    const notaPerfecta = Number(resultado.mejor_puntos) >= Number(resultado.puntos)
    return (
      <main className="relative mx-auto w-full max-w-md px-4 py-8">
        {proporcion >= 0.5 && <Confeti />}
        <Card className="relative border-border text-center shadow-sm">
          <CardHeader>
            <CompaneroAnimo
              indice={resultado.numero}
              feliz={proporcion > 0}
              className="mx-auto mb-1 h-20 w-20"
            />
            <p className="text-base font-semibold">
              {mensajeDeResultado(proporcion)}
            </p>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {resultado.titulo}
              {resultado.max_intentos > 1 &&
                ` · oportunidad ${resultado.numero} de ${resultado.max_intentos}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-4xl font-bold tabular-nums">
                {Number(resultado.puntos_obtenidos).toFixed(2)}
                <span className="text-lg font-medium text-muted-foreground">
                  {' '}
                  / {Number(resultado.puntos).toFixed(2)} pts
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {resultado.correctas} de {resultado.total_preguntas} respuestas
                correctas (
                {porcentajeAciertos(resultado.correctas, resultado.total_preguntas)}%)
              </p>
            </div>
            {(resultado.rechazadas ?? 0) > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                {resultado.rechazadas} respuesta(s) llegaron después del límite de
                tiempo y no se contaron.
              </p>
            )}
            {resultado.max_intentos > 1 && (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                Tu nota es la mejor de tus oportunidades:{' '}
                <strong className="tabular-nums">
                  {Number(resultado.mejor_puntos).toFixed(2)} pts
                </strong>
                .
                {quedan > 0 && !notaPerfecta && (
                  <>
                    {' '}
                    Te queda {quedan} oportunidad{quedan > 1 ? 'es' : ''}.
                  </>
                )}
              </p>
            )}
            <Button onClick={() => void volverALista()} className="w-full">
              Volver
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-3">
          <div className="shrink-0 rounded-xl bg-info/10 p-2 sm:p-2.5">
            <ClipboardCheck className="h-5 w-5 text-info sm:h-6 sm:w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Recuperación
          </h1>
        </div>
        <p className="ml-11 text-sm text-muted-foreground sm:ml-14">
          Cuestionarios de selección múltiple con tiempo límite. Tu nota depende
          del porcentaje de aciertos: con el 100% obtienes todos los puntos.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No hay recuperaciones disponibles por ahora.
        </p>
      ) : (
        <div className="space-y-3">
          {lista.map((item, i) => {
            const usadas = Number(item.intentos_usados)
            return (
              <Card key={item.id} className="border-border shadow-sm">
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <CompaneroAnimo indice={i} className="h-11 w-11" />
                    <div className="min-w-0">
                      <p className="font-semibold">{item.titulo}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.total_preguntas} preguntas · {item.duracion_minutos}{' '}
                        min · vale {Number(item.puntos).toFixed(2)} pts
                      </p>
                      {item.fecha_limite && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                          Hasta el {formatFechaHora(item.fecha_limite)}
                        </p>
                      )}
                      {item.estado !== 'vencida' && (
                        <p className="text-xs text-muted-foreground">
                          {item.max_intentos > 1
                            ? `Oportunidades usadas: ${usadas} de ${item.max_intentos}${
                                item.mejor_puntos !== null
                                  ? ` · tu mejor nota: ${Number(item.mejor_puntos).toFixed(2)} pts`
                                  : ''
                              }`
                            : usadas > 0
                              ? 'Ya usaste tu oportunidad'
                              : 'Tienes una sola oportunidad'}
                        </p>
                      )}
                    </div>
                  </div>
                  {item.estado === 'vencida' ? (
                    <p className="shrink-0 text-sm font-semibold text-muted-foreground">
                      Plazo vencido
                    </p>
                  ) : item.estado === 'finalizado' ? (
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {Number(item.mejor_puntos ?? 0).toFixed(2)} /{' '}
                      {Number(item.puntos).toFixed(2)} pts
                    </p>
                  ) : (
                    <Button
                      disabled={iniciando !== null}
                      onClick={() =>
                        item.estado === 'en_curso'
                          ? void abrir(item)
                          : setPorIniciar(item)
                      }
                      className="w-full shrink-0 sm:w-auto"
                    >
                      {iniciando === item.id
                        ? 'Abriendo...'
                        : item.estado === 'en_curso'
                          ? 'Continuar'
                          : usadas > 0
                            ? 'Usar otra oportunidad'
                            : 'Comenzar'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AlertDialog
        open={porIniciar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setPorIniciar(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {porIniciar && porIniciar.max_intentos > 1
                ? `¿Comenzar la oportunidad ${Number(porIniciar.intentos_usados) + 1} de ${porIniciar.max_intentos}?`
                : '¿Comenzar la recuperación?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tendrás {porIniciar?.duracion_minutos} minutos para responder{' '}
              {porIniciar?.total_preguntas} preguntas al azar, una por una y sin
              poder volver atrás. El tiempo empieza ahora y no se detiene aunque
              cierres la página
              {porIniciar?.fecha_limite &&
                `, y se corta el ${formatFechaHora(porIniciar.fecha_limite)} si ese plazo llega antes`}
              .{' '}
              {porIniciar && porIniciar.max_intentos > 1
                ? 'Cuenta tu mejor nota.'
                : 'Tienes una sola oportunidad.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Todavía no</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (porIniciar) void abrir(porIniciar)
              }}
            >
              Comenzar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
