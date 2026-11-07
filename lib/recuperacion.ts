/** Utilidades de las recuperaciones: formato del JSON que carga el auxiliar. */

export const LETRAS = ['A', 'B', 'C', 'D'] as const

/** Pregunta lista para enviar a cargar_preguntas_recuperacion. */
export type PreguntaCargada = {
  enunciado: string
  /** Fragmento de código que acompaña al enunciado, con su sangría. */
  codigo: string | null
  opciones: string[]
  /** Indice dentro de `opciones`: 0=A ... 3=D */
  correcta: number
}

export const EJEMPLO_JSON = `[
  {
    "pregunta": "¿Qué imprime este código?",
    "codigo": [
      "def doble(x):",
      "    return x * 2",
      "",
      "print(doble(4))"
    ],
    "opciones": ["8", "4", "\`doble(4)\`", "Error"],
    "correcta": "A"
  },
  {
    "pregunta": "¿Qué comando crea una rama nueva en git?",
    "opciones": ["\`git branch\`", "\`git commit\`", "\`git push\`", "\`git status\`"],
    "correcta": "A"
  },
  {
    "pregunta": "¿Qué significa HTTP?",
    "opciones": ["Hyper Tool", "HyperText Transfer Protocol", "Host Transfer", "Ninguna"],
    "correcta": "B"
  }
]`

export function parsearPreguntas(texto: string): {
  preguntas: PreguntaCargada[]
  errores: string[]
} {
  let datos: unknown
  try {
    datos = JSON.parse(texto)
  } catch (err) {
    const detalle = err instanceof Error ? err.message : ''
    return { preguntas: [], errores: [`El JSON no es válido: ${detalle}`] }
  }

  if (!Array.isArray(datos)) {
    return {
      preguntas: [],
      errores: ['El JSON debe ser una lista de preguntas: [ {...}, {...} ]'],
    }
  }
  if (datos.length === 0) {
    return { preguntas: [], errores: ['La lista no tiene preguntas.'] }
  }

  const preguntas: PreguntaCargada[] = []
  const errores: string[] = []

  datos.forEach((item, i) => {
    const n = `Pregunta ${i + 1}`
    const fila = (item ?? {}) as Record<string, unknown>
    const antes = errores.length

    const enunciado = typeof fila.pregunta === 'string' ? fila.pregunta.trim() : ''
    if (!enunciado) errores.push(`${n}: falta el texto en "pregunta".`)

    // Una lista de líneas es más fácil de escribir en JSON que un texto con \n.
    let codigo: string | null = null
    if (Array.isArray(fila.codigo) && fila.codigo.every((l) => typeof l === 'string')) {
      codigo = (fila.codigo as string[]).join('\n')
    } else if (typeof fila.codigo === 'string') {
      codigo = fila.codigo
    } else if (fila.codigo !== undefined && fila.codigo !== null) {
      errores.push(`${n}: "codigo" debe ser un texto o una lista de líneas.`)
    }
    if (codigo !== null && !codigo.trim()) codigo = null

    // Sin trim del interior: un inciso puede ser código con sangría.
    const opciones = Array.isArray(fila.opciones)
      ? fila.opciones.map((o) =>
          typeof o === 'string' ? o.replace(/^\s*\n|\n\s*$/g, '').trimEnd() : '',
        )
      : []
    if (opciones.length !== 4) {
      errores.push(`${n}: "opciones" debe tener exactamente 4 textos.`)
    } else if (opciones.some((o) => !o.trim())) {
      errores.push(`${n}: hay una opcion vacia o que no es texto.`)
    } else if (new Set(opciones).size !== 4) {
      errores.push(`${n}: hay opciones repetidas.`)
    }

    const letra =
      typeof fila.correcta === 'string' ? fila.correcta.trim().toUpperCase() : ''
    const correcta = LETRAS.indexOf(letra as (typeof LETRAS)[number])
    if (correcta === -1) {
      errores.push(`${n}: "correcta" debe ser "A", "B", "C" o "D".`)
    }

    if (errores.length === antes) preguntas.push({ enunciado, codigo, opciones, correcta })
  })

  return { preguntas: errores.length > 0 ? [] : preguntas, errores }
}

/**
 * Mensajes de los companeros. NUNCA deben depender de si la respuesta es correcta:
 * el estudiante los ve mientras rinde, asi que serian una pista.
 */
const ANIMO_ANTES = [
  '¡Tú puedes con esta!',
  'Lee con calma, sin apuros.',
  'Confía en lo que estudiaste.',
  '¡Vamos, una a la vez!',
  'Respira hondo y a por ella.',
  'Piénsala bien, vas genial.',
  'Esta es tuya, ¡adelante!',
]

const ANIMO_DESPUES = [
  '¡Anotada! Sigue así.',
  '¡Listo! Vamos por la siguiente.',
  '¡Eso! Una menos.',
  '¡Buen ritmo, no aflojes!',
  'Guardada. ¡Sigue adelante!',
  '¡Vas avanzando muy bien!',
]

export function mensajeDePregunta(indice: number, respondida: boolean): string {
  return respondida
    ? ANIMO_DESPUES[indice % ANIMO_DESPUES.length]
    : ANIMO_ANTES[indice % ANIMO_ANTES.length]
}

export function mensajeDeProgreso(
  posicion: number,
  total: number,
  segundos: number,
): string {
  if (segundos <= 60) return '¡Último minuto! Confía en ti.'
  if (total > 1 && posicion === total - 1) return '¡Última pregunta!'
  if (posicion === 0) return '¡Empecemos! Tú puedes.'
  if (posicion >= total / 2) return '¡Ya pasaste la mitad!'
  return '¡Buen comienzo, sigue así!'
}

/** Mensaje final: aqui si se conoce la nota. */
export function mensajeDeResultado(proporcion: number): string {
  if (proporcion >= 1) return '¡Perfecto! Lo lograste todo.'
  if (proporcion >= 0.7) return '¡Excelente trabajo!'
  if (proporcion >= 0.5) return '¡Bien hecho! Vas por buen camino.'
  if (proporcion > 0) return '¡Buen esfuerzo! Sigue estudiando.'
  return 'No te rindas, sigue practicando.'
}

/** Porcentaje de aciertos, que es lo que define la nota: 100% = todos los puntos. */
export function porcentajeAciertos(correctas: number, total: number): number {
  return total > 0 ? Math.round((correctas / total) * 100) : 0
}

/** 90 -> '01:30'; 3700 -> '1:01:40' */
export function formatTiempo(segundos: number): string {
  const s = Math.max(0, segundos)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  const mmss = `${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`
  return h > 0 ? `${h}:${mmss}` : mmss
}
