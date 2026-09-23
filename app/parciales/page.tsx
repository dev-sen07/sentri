'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, PeriodoParcialRow } from '@/lib/supabase'
import { parseFechaCivil, diaSemanaDe, formatFechaCorta } from '@/lib/fecha'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CalendarDays,
  Save,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react'

type ParcialForm = {
  parcial: 1 | 2 | 3
  fecha_inicio: string
  fecha_fin: string
  /** Dias en que se dicta clase: 0=domingo ... 6=sabado (igual que Date.getDay). */
  dias_semana: number[]
}

type FormState = Record<1 | 2 | 3, ParcialForm>

type FechaRegistrada = { fecha: string; origen: string | null }

const PARCIALES: Array<1 | 2 | 3> = [1, 2, 3]

const TOPES_FALLBACK: Record<1 | 2 | 3, number> = { 1: 3, 2: 3, 3: 4 }

/**
 * Orden de PRESENTACION: la semana empieza en lunes, como se lee aqui.
 *
 * `valor` mantiene la convencion numerica de Postgres (EXTRACT DOW) y de JS
 * (Date.getDay), donde 0 es domingo. Antes la lista se pintaba en ese orden
 * numerico (D L M X J V S), asi que el primer boton parecia "lunes" y en
 * realidad guardaba domingo. Nunca indexes este array por el valor del dia:
 * usa NOMBRE_DIA.
 */
const DIAS = [
  { valor: 1, corto: 'L', largo: 'Lunes' },
  { valor: 2, corto: 'M', largo: 'Martes' },
  { valor: 3, corto: 'X', largo: 'Miercoles' },
  { valor: 4, corto: 'J', largo: 'Jueves' },
  { valor: 5, corto: 'V', largo: 'Viernes' },
  { valor: 6, corto: 'S', largo: 'Sabado' },
  { valor: 0, corto: 'D', largo: 'Domingo' },
]

/** Nombre por valor de dia (0=domingo ... 6=sabado). */
const NOMBRE_DIA: Record<number, string> = Object.fromEntries(
  DIAS.map((d) => [d.valor, d.largo]),
)

/** 'lunes', 'lunes y miercoles', ... a partir de los valores guardados. */
function nombresDias(valores: number[]): string {
  const orden = DIAS.map((d) => d.valor)
  const nombres = [...valores]
    .sort((a, b) => orden.indexOf(a) - orden.indexOf(b))
    .map((v) => (NOMBRE_DIA[v] ?? '?').toLowerCase())
  if (nombres.length <= 1) return nombres[0] ?? ''
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1]
}

function buildEmptyForm(): FormState {
  return {
    1: { parcial: 1, fecha_inicio: '', fecha_fin: '', dias_semana: [] },
    2: { parcial: 2, fecha_inicio: '', fecha_fin: '', dias_semana: [] },
    3: { parcial: 3, fecha_inicio: '', fecha_fin: '', dias_semana: [] },
  }
}

/**
 * Cuantas sesiones de clase caen en el rango, por calendario.
 * No consulta asistencias: una clase cuenta aunque nadie haya asistido
 * o aunque aun no haya ocurrido.
 */
function contarClases(inicio: string, fin: string, dias: number[]): number {
  if (!inicio || !fin || dias.length === 0) return 0
  const desde = parseFechaCivil(inicio)
  const hasta = parseFechaCivil(fin)
  if (hasta < desde) return 0

  let total = 0
  const cursor = new Date(desde)
  while (cursor <= hasta) {
    if (dias.includes(cursor.getDay())) total++
    cursor.setDate(cursor.getDate() + 1)
  }
  return total
}

export default function ParcialesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(buildEmptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [topes, setTopes] = useState<Record<1 | 2 | 3, number>>(TOPES_FALLBACK)
  const [fechasRegistradas, setFechasRegistradas] = useState<FechaRegistrada[]>(
    [],
  )

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

        const { data: periodos } = await supabase
          .from('periodos_parciales')
          .select('*')
          .order('parcial', { ascending: true })

        if (periodos && periodos.length > 0) {
          const next = buildEmptyForm()
          ;(periodos as PeriodoParcialRow[]).forEach((p) => {
            if (p.parcial === 1 || p.parcial === 2 || p.parcial === 3) {
              next[p.parcial] = {
                parcial: p.parcial,
                fecha_inicio: p.fecha_inicio,
                fecha_fin: p.fecha_fin,
                dias_semana: p.dias_semana ?? [],
              }
            }
          })
          setForm(next)
        }

        const { data: cfg } = await supabase
          .from('configuracion_notas')
          .select('clave, valor')
          .in('clave', [
            'puntos_parcial_1',
            'puntos_parcial_2',
            'puntos_parcial_3',
          ])

        if (cfg) {
          setTopes((prev) => {
            const next = { ...prev }
            cfg.forEach((c) => {
              const m = c.clave.match(/^puntos_parcial_(\d)$/)
              if (m) {
                const p = Number(m[1]) as 1 | 2 | 3
                next[p] = Number(c.valor)
              }
            })
            return next
          })
        }

        // Fechas distintas con registros. Via RPC porque un select directo a
        // asistencias se corta en las 1000 filas por defecto de PostgREST
        // (hay una fila por estudiante por clase) y el conteo salia truncado.
        const { data: fechas, error: rpcError } = await supabase.rpc(
          'fechas_con_asistencia',
        )
        if (rpcError) {
          console.error('fechas_con_asistencia no disponible:', rpcError)
        } else if (fechas) {
          setFechasRegistradas(fechas as FechaRegistrada[])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  const clasesPorParcial = useMemo(() => {
    return {
      1: contarClases(
        form[1].fecha_inicio,
        form[1].fecha_fin,
        form[1].dias_semana,
      ),
      2: contarClases(
        form[2].fecha_inicio,
        form[2].fecha_fin,
        form[2].dias_semana,
      ),
      3: contarClases(
        form[3].fecha_inicio,
        form[3].fecha_fin,
        form[3].dias_semana,
      ),
    } as Record<1 | 2 | 3, number>
  }, [form])

  /**
   * Registros de pase de lista que no caen en ninguna sesion de clase:
   * o quedan fuera de todos los rangos, o caen en un dia no lectivo.
   * Las asistencias de origen 'practica' se ignoran: se espera que caigan
   * en cualquier dia, por eso mismo ya no definen el total de clases.
   */
  const { fueraDeRango, diaNoLectivo } = useMemo(() => {
    const rangos = PARCIALES.filter(
      (p) => form[p].fecha_inicio && form[p].fecha_fin,
    )
    const fuera: string[] = []
    const noLectivo: string[] = []
    if (rangos.length === 0) return { fueraDeRango: fuera, diaNoLectivo: noLectivo }

    fechasRegistradas.forEach(({ fecha, origen }) => {
      if (origen === 'practica') return
      const parcial = rangos.find(
        (p) => fecha >= form[p].fecha_inicio && fecha <= form[p].fecha_fin,
      )
      if (!parcial) {
        fuera.push(fecha)
      } else if (!form[parcial].dias_semana.includes(diaSemanaDe(fecha))) {
        noLectivo.push(fecha)
      }
    })
    return { fueraDeRango: fuera, diaNoLectivo: noLectivo }
  }, [form, fechasRegistradas])

  const handleChange = (
    parcial: 1 | 2 | 3,
    campo: 'fecha_inicio' | 'fecha_fin',
    value: string,
  ) => {
    setSuccess(false)
    setError(null)
    setForm((prev) => ({
      ...prev,
      [parcial]: { ...prev[parcial], [campo]: value },
    }))
  }

  const toggleDia = (parcial: 1 | 2 | 3, dia: number) => {
    setSuccess(false)
    setError(null)
    setForm((prev) => {
      const actuales = prev[parcial].dias_semana
      const dias = actuales.includes(dia)
        ? actuales.filter((d) => d !== dia)
        : [...actuales, dia].sort((a, b) => a - b)
      return { ...prev, [parcial]: { ...prev[parcial], dias_semana: dias } }
    })
  }

  const validate = (): string | null => {
    for (const p of PARCIALES) {
      const { fecha_inicio, fecha_fin, dias_semana } = form[p]
      if (!fecha_inicio || !fecha_fin) {
        return `El Parcial ${p} debe tener fecha de inicio y fin.`
      }
      if (fecha_fin < fecha_inicio) {
        return `En el Parcial ${p}, la fecha fin no puede ser anterior a la de inicio.`
      }
      if (dias_semana.length === 0) {
        return `El Parcial ${p} debe tener al menos un dia de clase marcado.`
      }
      if (contarClases(fecha_inicio, fecha_fin, dias_semana) === 0) {
        return `En el Parcial ${p} no cae ninguna clase: el rango no incluye ningun ${nombresDias(dias_semana)}.`
      }
    }
    if (form[1].fecha_fin >= form[2].fecha_inicio) {
      return 'El Parcial 1 y el Parcial 2 se solapan. Ajusta las fechas.'
    }
    if (form[2].fecha_fin >= form[3].fecha_inicio) {
      return 'El Parcial 2 y el Parcial 3 se solapan. Ajusta las fechas.'
    }
    return null
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const payload = PARCIALES.map((p) => ({
        parcial: p,
        fecha_inicio: form[p].fecha_inicio,
        fecha_fin: form[p].fecha_fin,
        dias_semana: form[p].dias_semana,
        activo: true,
        actualizado_en: new Date().toISOString(),
      }))

      const { error: upsertError } = await supabase
        .from('periodos_parciales')
        .upsert(payload, { onConflict: 'parcial' })

      if (upsertError) throw upsertError

      setSuccess(true)
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron guardar los parciales.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground animate-pulse">Cargando...</p>
        </div>
      </div>
    )
  }

  const totalClases =
    clasesPorParcial[1] + clasesPorParcial[2] + clasesPorParcial[3]

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 sm:p-2.5 bg-info/10 rounded-xl shrink-0">
              <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-info" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Configurar Parciales
            </h1>
          </div>
          <p className="ml-11 sm:ml-14 text-muted-foreground text-sm">
            Define el rango de fechas y el dia de clase de cada parcial. Los
            estudiantes veran su avance por parcial segun estos periodos.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-info/30 bg-info/5 px-4 py-3 mb-6">
          <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            El total de clases se calcula por calendario: cuantas veces cae el
            dia de clase dentro del rango. Una clase cuenta aunque nadie haya
            asistido o aunque todavia no haya ocurrido. La asistencia se reparte{' '}
            <strong>
              {topes[1]} + {topes[2]} + {topes[3]} ={' '}
              {topes[1] + topes[2] + topes[3]} pts
            </strong>{' '}
            entre los parciales.
          </p>
        </div>

        {fueraDeRango.length > 0 && (
          <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5 rounded-lg mb-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Hay <strong>{fueraDeRango.length}</strong> fecha(s) con asistencia
              registrada fuera de los rangos definidos (
              {fueraDeRango.slice(0, 4).map(formatFechaCorta).join(', ')}
              {fueraDeRango.length > 4 ? '...' : ''}). Esas asistencias no
              contaran en ningun parcial.
            </span>
          </div>
        )}

        {diaNoLectivo.length > 0 && (
          <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5 rounded-lg mb-6">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Hay <strong>{diaNoLectivo.length}</strong> fecha(s) con pase de
              lista en un dia que no marcaste como dia de clase (
              {diaNoLectivo.slice(0, 4).map(formatFechaCorta).join(', ')}
              {diaNoLectivo.length > 4 ? '...' : ''}). Revisa los dias marcados
              o esas asistencias no se contaran.
            </span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {PARCIALES.map((p) => (
            <Card key={p} className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                    {p}
                  </span>
                  Parcial {p}
                  <span className="ml-auto text-xs font-semibold text-muted-foreground">
                    {topes[p]} pts
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {form[p].fecha_inicio && form[p].fecha_fin
                    ? `${formatFechaCorta(form[p].fecha_inicio)} a ${formatFechaCorta(form[p].fecha_fin)}`
                    : 'Sin configurar'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`inicio-${p}`} className="text-xs">
                    Fecha inicio
                  </Label>
                  <Input
                    id={`inicio-${p}`}
                    type="date"
                    value={form[p].fecha_inicio}
                    onChange={(e) =>
                      handleChange(p, 'fecha_inicio', e.target.value)
                    }
                    disabled={saving}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`fin-${p}`} className="text-xs">
                    Fecha fin
                  </Label>
                  <Input
                    id={`fin-${p}`}
                    type="date"
                    value={form[p].fecha_fin}
                    onChange={(e) =>
                      handleChange(p, 'fecha_fin', e.target.value)
                    }
                    disabled={saving}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Dia(s) de clase</Label>
                  <div className="flex gap-1">
                    {DIAS.map((d) => {
                      const activo = form[p].dias_semana.includes(d.valor)
                      return (
                        <button
                          key={d.valor}
                          type="button"
                          title={d.largo}
                          aria-label={d.largo}
                          aria-pressed={activo}
                          disabled={saving}
                          onClick={() => toggleDia(p, d.valor)}
                          className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold transition-colors disabled:opacity-50 ${
                            activo
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {d.corto}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground border-t pt-2">
                  {form[p].dias_semana.length === 0 ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      Marca el dia de clase para calcular el total
                    </span>
                  ) : (
                    <>
                      <strong className="text-foreground capitalize">
                        {nombresDias(form[p].dias_semana)}
                      </strong>
                      {' - '}
                      <strong className="text-foreground">
                        {clasesPorParcial[p]}
                      </strong>{' '}
                      clase(s) en este rango
                    </>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {totalClases > 0 && (
          <p className="text-sm text-muted-foreground mb-4">
            Total del semestre: <strong>{totalClases}</strong> clase(s).
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2.5 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2.5 rounded-lg mb-4">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Parciales guardados correctamente.</span>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Guardar Parciales
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  )
}
