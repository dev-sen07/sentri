'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  formatTiempo,
  LETRAS,
  mensajeDePregunta,
  mensajeDeProgreso,
  mensajeDeResultado,
  porcentajeAciertos,
} from '@/lib/recuperacion'
import { CompaneroAnimo, Confeti } from '@/components/companero-animo'
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
import { AlertCircle, CheckCircle, ClipboardCheck, Clock, Eye } from 'lucide-react'

type ItemLista = {
  id: string
  titulo: string
  puntos: number
  duracion_minutos: number
  total_preguntas: number
  max_intentos: number
  intentos_usados: number
  mejor_puntos: number | null
  estado: 'disponible' | 'en_curso' | 'finalizado'
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

type ExamenEnCurso = {
  estado: 'en_curso'
  intento_id: string
  titulo: string
  puntos: number
  numero: number
  max_intentos: number
  segundos_restantes: number
  respuestas: Record<string, number>
  preguntas: {
    id: string
    enunciado: string
    /** Ya vienen barajadas. Se responde con la posición en esta lista. */
    opciones: string[]
  }[]
}

/**
 * Enunciado difuminado: se lee solo mientras el mouse está encima o, en
 * celulares, mientras se mantiene presionado (no hay hover en una pantalla
 * táctil). Con teclado se revela al enfocarlo.
 *
 * Es un freno a las capturas y al copiado, no una protección real: el texto está
 * en la página y se puede leer desde las herramientas del navegador.
 */
function PreguntaDifuminada({ texto }: { texto: string }) {
  const [visible, setVisible] = useState(false)

  return (
    <div
      tabIndex={0}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setVisible(true)
      }}
      onPointerLeave={() => setVisible(false)}
      onPointerDown={(e) => {
        if (e.pointerType !== 'mouse') setVisible(true)
      }}
      onPointerUp={(e) => {
        if (e.pointerType !== 'mouse') setVisible(false)
      }}
      // Al arrastrar para hacer scroll el navegador cancela el toque: se oculta.
      onPointerCancel={() => setVisible(false)}
      onFocus={(e) => {
        if (e.currentTarget.matches(':focus-visible')) setVisible(true)
      }}
      onBlur={() => setVisible(false)}
      // El toque largo abre el menú de copiar en los celulares.
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      className="cursor-default touch-pan-y select-none rounded-lg outline-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p
        data-visible={visible}
        className={`font-medium leading-relaxed transition-[filter] duration-150 ${
          visible ? '' : 'blur-[7px]'
        }`}
      >
        {texto}
      </p>
    </div>
  )
}

/**
 * Compañero de una pregunta. Salta al responder, pero el mensaje es el mismo
 * sea la respuesta correcta o no: no debe servir de pista.
 */
function AnimoDePregunta({
  indice,
  respuesta,
}: {
  indice: number
  respuesta: number | undefined
}) {
  const respondida = respuesta !== undefined
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
        className="relative mb-1.5 animate-[comp-burbuja_0.25s_ease-out] rounded-xl rounded-bl-sm bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
      >
        {mensajeDePregunta(indice, respondida)}
      </p>
    </div>
  )
}

/**
 * Respuestas que quedaron sin confirmar en este dispositivo (recarga o reinicio
 * con mala señal). El servidor las vuelve a validar al enviarlas.
 */
function leerPendientes(
  clave: string,
  preguntas: ExamenEnCurso['preguntas'],
): Record<string, number> {
  try {
    const datos = JSON.parse(localStorage.getItem(clave) ?? '{}') as Record<
      string,
      unknown
    >
    const validas: Record<string, number> = {}
    preguntas.forEach((p) => {
      const opcion = datos[p.id]
      if (Number.isInteger(opcion) && (opcion as number) >= 0 && (opcion as number) <= 3) {
        validas[p.id] = opcion as number
      }
    })
    return validas
  } catch {
    return {}
  }
}

function Examen({
  examen,
  onResultado,
}: {
  examen: ExamenEnCurso
  onResultado: (r: Resultado) => void
}) {
  const clavePendientes = `recuperacion:${examen.intento_id}:pendientes`
  const [respuestas, setRespuestas] = useState(() => ({
    ...(examen.respuestas ?? {}),
    ...leerPendientes(clavePendientes, examen.preguntas),
  }))
  const [restante, setRestante] = useState(examen.segundos_restantes)
  const [finalizando, setFinalizando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState(false)
  const [errorFinal, setErrorFinal] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)

  // Respuestas marcadas que aún no confirmó el servidor.
  const pendientes = useRef(new Map<string, number>())
  const vaciando = useRef<Promise<void> | null>(null)
  const terminando = useRef(false)
  const rechazadas = useRef(0)
  const intentoId = examen.intento_id

  /** Copia las pendientes al dispositivo: recargar no debe perderlas. */
  const persistir = useCallback(() => {
    try {
      if (pendientes.current.size === 0) localStorage.removeItem(clavePendientes)
      else {
        localStorage.setItem(
          clavePendientes,
          JSON.stringify(Object.fromEntries(pendientes.current)),
        )
      }
    } catch {
      // Sin almacenamiento (modo privado) solo se pierde este respaldo.
    }
  }, [clavePendientes])

  /** Envía las pendientes de una en una. Si falla la red, quedan para reintentar. */
  const vaciar = useCallback((): Promise<void> => {
    if (vaciando.current) return vaciando.current

    const tarea = (async () => {
      while (pendientes.current.size > 0) {
        const [pregunta, opcion] = [...pendientes.current.entries()][0]
        const { data, error } = await supabase.rpc('responder_recuperacion', {
          p_intento: intentoId,
          p_pregunta: pregunta,
          p_opcion: opcion,
        })
        if (error) {
          setErrorGuardado(true)
          return
        }
        if (data !== 'guardado') {
          // Ya no se aceptan: se cuentan para avisarle junto con la nota, porque
          // en pantalla siguen marcadas.
          rechazadas.current += pendientes.current.size
          pendientes.current.clear()
          persistir()
          setErrorGuardado(false)
          return
        }
        // Si cambió de opción mientras viajaba, la nueva sigue pendiente.
        if (pendientes.current.get(pregunta) === opcion) {
          pendientes.current.delete(pregunta)
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
      Object.entries(leerPendientes(clavePendientes, examen.preguntas)).forEach(
        ([pregunta, opcion]) => pendientes.current.set(pregunta, opcion),
      )
      await vaciar()
    }
    init()
  }, [clavePendientes, examen.preguntas, vaciar])

  const terminar = useCallback(
    async (tiempoAgotado: boolean) => {
      if (terminando.current) return
      terminando.current = true
      setFinalizando(true)
      setErrorFinal(null)

      await vaciar()

      // Terminando a mano no se califica con respuestas sin guardar. Si se acabó
      // el tiempo sí: el servidor ya no aceptaría más.
      if (!tiempoAgotado && pendientes.current.size > 0) {
        terminando.current = false
        setFinalizando(false)
        setErrorFinal(
          'Hay respuestas sin guardar. Revisa tu conexión y vuelve a intentarlo.',
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
    const fin = Date.now() + examen.segundos_restantes * 1000
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((fin - Date.now()) / 1000))
      setRestante(r)
      if (r === 0) void terminar(true)
    }, 1000)
    return () => clearInterval(id)
  }, [examen.segundos_restantes, terminar])

  const elegir = (pregunta: string, opcion: number) => {
    setRespuestas((prev) => ({ ...prev, [pregunta]: opcion }))
    pendientes.current.set(pregunta, opcion)
    persistir()
    void vaciar()
  }

  const total = examen.preguntas.length
  const respondidas = examen.preguntas.filter(
    (p) => respuestas[p.id] !== undefined,
  ).length
  const sinResponder = total - respondidas
  const bloqueado = finalizando || restante === 0
  const avance = total > 0 ? (respondidas / total) * 100 : 0

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-8">
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{examen.titulo}</p>
            <p className="truncate text-xs text-muted-foreground">
              {examen.max_intentos > 1 &&
                `Oportunidad ${examen.numero} de ${examen.max_intentos} · `}
              {respondidas} de {total} respondidas
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
          {mensajeDeProgreso(respondidas, total, restante)}
        </p>

        {/* El compañero camina por la barra a medida que se responde. */}
        <div className="relative mt-6 h-1.5 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${avance}%` }}
          />
          <div
            className="absolute -top-[26px] -translate-x-1/2 transition-[left] duration-500 ease-out"
            style={{ left: `clamp(14px, ${avance}%, calc(100% - 14px))` }}
          >
            <CompaneroAnimo
              key={respondidas}
              indice={0}
              feliz={respondidas > 0}
              className="h-7 w-7"
            />
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-info/30 bg-info/5 px-4 py-3">
        <Eye className="mt-0.5 h-5 w-5 shrink-0 text-info" />
        <p className="text-sm text-muted-foreground">
          <span className="pointer-coarse:hidden">
            Las preguntas están difuminadas: pasa el mouse sobre cada una para
            leerla.
          </span>
          <span className="hidden pointer-coarse:inline">
            Las preguntas están difuminadas: mantén presionada cada una con el
            dedo para leerla.
          </span>{' '}
          Cada respuesta se guarda al marcarla. El tiempo sigue corriendo aunque
          cierres la página.
        </p>
      </div>

      {errorGuardado && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            No se pudo guardar tu última respuesta. Revisa tu conexión.
          </span>
          <Button size="xs" variant="outline" onClick={() => void vaciar()}>
            Reintentar
          </Button>
        </div>
      )}

      <ol className="space-y-3">
        {examen.preguntas.map((p, i) => (
          <li key={p.id}>
            <Card className="border-border shadow-sm">
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <PreguntaDifuminada texto={p.enunciado} />
                  </div>
                </div>
                <div className="space-y-2">
                  {p.opciones.map((opcion, pos) => {
                    const marcada = respuestas[p.id] === pos
                    return (
                      <label
                        key={pos}
                        className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                          marcada
                            ? 'border-primary bg-primary/10 font-medium'
                            : 'border-border hover:bg-muted'
                        } ${bloqueado ? 'pointer-events-none opacity-60' : ''}`}
                      >
                        <input
                          type="radio"
                          name={p.id}
                          className="sr-only"
                          checked={marcada}
                          disabled={bloqueado}
                          onChange={() => elegir(p.id, pos)}
                        />
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold ${
                            marcada
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border text-muted-foreground'
                          }`}
                        >
                          {LETRAS[pos]}
                        </span>
                        <span className="min-w-0 break-words">{opcion}</span>
                      </label>
                    )
                  })}
                </div>
                <AnimoDePregunta indice={i} respuesta={respuestas[p.id]} />
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      {errorFinal && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorFinal}</span>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button
          onClick={() =>
            restante === 0 ? void terminar(true) : setConfirmar(true)
          }
          disabled={finalizando}
          className="w-full gap-2 sm:w-auto"
        >
          <CheckCircle className="h-4 w-4" />
          {finalizando ? 'Finalizando...' : 'Finalizar recuperación'}
        </Button>
      </div>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Finalizar la recuperación?</AlertDialogTitle>
            <AlertDialogDescription>
              {sinResponder > 0
                ? `Te faltan ${sinResponder} pregunta(s) por responder y contarán como incorrectas. `
                : ''}
              Después no podrás cambiar tus respuestas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir respondiendo</AlertDialogCancel>
            <AlertDialogAction onClick={() => void terminar(false)}>
              Finalizar
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
  const [examen, setExamen] = useState<ExamenEnCurso | null>(null)
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
      return
    }
    const r = data as ExamenEnCurso | Resultado
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

  if (examen) return <Examen examen={examen} onResultado={onResultado} />

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
                    </div>
                  </div>
                  {item.estado === 'finalizado' ? (
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
              {porIniciar?.total_preguntas} preguntas al azar. El tiempo empieza
              ahora y no se detiene aunque cierres la página.{' '}
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
