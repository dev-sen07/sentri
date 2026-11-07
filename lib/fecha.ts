/**
 * Utilidades de fecha CIVIL (columnas DATE: asistencias.fecha, actividades.fecha...).
 *
 * Una fecha civil es "7 de septiembre", no un instante en el tiempo. Mezclarla
 * con UTC desplaza el dia y provoca los dos errores clasicos:
 *
 *   ESCRITURA  new Date().toISOString().split('T')[0]
 *              toISOString() devuelve el dia en UTC. En Bolivia (UTC-4), a
 *              partir de las 20:00 locales UTC ya es el dia siguiente, asi que
 *              una clase del lunes por la noche se guardaba como martes.
 *              Peor aun: la columna `hora` se saca con getHours() (local), asi
 *              que fecha y hora quedaban en dias distintos.
 *
 *   LECTURA    new Date('2026-09-07')
 *              Un string 'YYYY-MM-DD' se interpreta como medianoche UTC. Al
 *              renderizarlo en un huso negativo retrocede al dia anterior: el
 *              alumno que vino el lunes 7 veia "domingo, 6 de septiembre".
 *
 * Regla: para leer, usa parseFechaCivil/formatFechaLarga; para escribir, hoyISO.
 */

/** Fecha de hoy en el huso del usuario, como 'YYYY-MM-DD'. Sustituye a toISOString(). */
export function hoyISO(): string {
  return aISO(new Date())
}

/** Convierte un Date a 'YYYY-MM-DD' usando sus componentes LOCALES, no UTC. */
export function aISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

/** Hora actual local como 'HH:MM'. */
export function horaActual(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Parsea 'YYYY-MM-DD' como fecha local. Se ancla al mediodia para que ningun
 * cambio de horario de verano (±1h) pueda cruzar la medianoche.
 */
export function parseFechaCivil(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

/** Dia de la semana de una fecha civil: 0=domingo ... 6=sabado. */
export function diaSemanaDe(iso: string): number {
  return parseFechaCivil(iso).getDay()
}

/** 'lunes, 7 de septiembre de 2026' */
export function formatFechaLarga(iso: string): string {
  if (!iso) return '-'
  return parseFechaCivil(iso).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** 'lunes, 7 de septiembre' */
export function formatFechaMedia(iso: string): string {
  if (!iso) return '-'
  return parseFechaCivil(iso).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** '07/09/2026' */
export function formatFechaCorta(iso: string): string {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Una actividad esta cerrada cuando ya paso su hora_fin del dia de la
 * actividad. Sin hora_fin no cierra nunca.
 *
 * 'YYYY-MM-DDTHH:MM:SS' sin zona se interpreta como hora LOCAL, que es lo
 * correcto aqui: la hora de cierre es la del aula, no UTC.
 */
export function actividadCerrada(fecha: string, horaFin: string | null | undefined): boolean {
  if (!fecha || !horaFin) return false
  const cierre = new Date(`${fecha}T${horaFin}`)
  if (Number.isNaN(cierre.getTime())) return false
  return new Date() > cierre
}

/**
 * Un instante (timestamptz), a diferencia de las fechas civiles de arriba, se
 * muestra en el huso del usuario: '15/11/2026, 23:59'
 */
export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Instante -> valor de un <input type="datetime-local"> (hora local, sin zona). */
export function aInputFechaHora(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${aISO(d)}T${hora}`
}

/** 'HH:MM:SS' -> 'HH:MM' */
export function formatHora(h: string | null | undefined): string {
  return h ? h.slice(0, 5) : ''
}
