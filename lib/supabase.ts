import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Cliente de navegador único (SSR-safe) usado en toda la app.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

/**
 * Normaliza una relacion embebida de PostgREST.
 *
 * Segun como infiera la cardinalidad, PostgREST devuelve la relacion como
 * objeto o como array de un elemento. El codigo lo resolvia con
 * `Array.isArray(x) ? x[0] : x` repetido en cada sitio y tipado como `any`.
 */
export function unoDe<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null
  return rel ?? null
}

/** Datos minimos del estudiante que se embeben en varias consultas. */
export type EstudianteEmbebido = {
  nombre: string
  apellido: string
  ci: string
}

export type EstudianteRow = {
  id: string
  nombre: string
  apellido: string
  ci: string
  ru: string
  correo: string
  paralelo: 'A' | 'B' | 'C'
  codigo?: string | null
  user_id: string | null
}

export type AsistenciaRow = {
  id: string
  estudiante_id: string
  fecha: string
  hora: string
  estado: 'presente' | 'ausente' | 'retraso'
  // 'clase' = pase de lista normal; 'practica' = alta automatica al entregar
  origen?: 'clase' | 'practica'
}

export type UsuarioRolRow = {
  id: string
  user_id: string
  rol: 'estudiante' | 'auxiliar' | 'delegado'
}

export type VerificacionTipo =
  | 'contiene_funcion'
  | 'contiene_clase'
  | 'usa_bucle_for'
  | 'usa_bucle_while'
  | 'usa_recursion'
  | 'contiene_texto'
  | 'no_contiene_texto'

export type Verificacion = {
  tipo: VerificacionTipo
  valor?: string   // required for: contiene_funcion, contiene_clase, contiene_texto, no_contiene_texto
  mensaje: string  // shown to student if check fails
}

export type PracticaConfiguracion = {
  verificaciones: Verificacion[]
  asistencia?: boolean
}

export type PracticaRow = {
  id: string
  nombre: string
  descripcion: string
  resultado_esperado: string
  codigo_base: string
  paralelo: 'A' | 'B' | 'C'
  creado_en: string
  fecha_limite?: string | null       // ISO string from Supabase
  configuracion?: PracticaConfiguracion | null
}

export type EntregaRow = {
  id: string
  practica_id: string
  estudiante_id: string
  codigo: string
  nota: number
  fecha_entrega: string
}

export type ClaseGrabadaRow = {
  id: string
  titulo: string
  descripcion: string | null
  url_video: string
  creado_en: string
}

export type ExtraRow = {
  id: string
  estudiante_id: string
  puntos: number
  descripcion: string | null
  creado_en: string
}

export type ActividadRow = {
  id: string
  nombre: string
  fecha: string
  ponderacion?: number | null
  hora_inicio?: string | null
  hora_fin?: string | null
  creado_en: string
}

export type ActividadParticipanteRow = {
  id: string
  actividad_id: string
  estudiante_id: string
  registrado_en: string
}

export type ArchivoMetadata = {
  nombre: string
  drive_file_id: string
  drive_url: string
  tipo: string
  size: number
}

export type PresentacionTareaRow = {
  id: string
  titulo: string
  descripcion: string | null
  paralelo: 'A' | 'B' | 'C'
  fecha_limite: string | null
  ponderacion: number
  pdf_file_id: string | null
  pdf_url: string | null
  creado_en: string
}

export type PresentacionEntregaRow = {
  id: string
  tarea_id: string
  estudiante_id: string
  archivos: ArchivoMetadata[]
  estado: 'revision' | 'revisado'
  nota: number | null
  comentario: string | null
  drive_folder_id: string | null
  entregado_en: string
  revisado_en: string | null
}

export type ConfiguracionNotasRow = {
  id: string
  clave: string
  valor: number
  descripcion: string | null
  updated_at: string
}

export type VistaCalificacionesRow = {
  estudiante_id: string
  asistencias_presente: number
  total_clases: number
  nota_asistencia: number
  puntos_extra: number
  puntos_actividades: number
  puntos_presentaciones: number
  nota_final: number
}

export type PeriodoParcialRow = {
  id: string
  parcial: 1 | 2 | 3
  fecha_inicio: string
  fecha_fin: string
  // Dias de la semana en que se dicta clase: 0=domingo ... 6=sabado
  dias_semana: number[]
  activo: boolean
  creado_en: string
  actualizado_en: string
}

export type ClaseJustificadaRow = {
  fecha: string
  motivo: string
  // Solo una clase invalidada sale del total y deja de valer puntos
  invalidada: boolean
  creado_en: string
}

export type RecuperacionRow = {
  id: string
  titulo: string
  puntos: number
  duracion_minutos: number
  /** Cuantas preguntas del banco le tocan a cada intento. */
  preguntas_por_intento: number
  paralelos: ('A' | 'B' | 'C')[]
  max_intentos: number
  /** Después de esta fecha nadie puede empezar. */
  fecha_limite: string | null
  /** Parcial al que suma, hasta su tope; el excedente va al siguiente. null = por fecha. */
  parcial: 1 | 2 | 3 | null
  activa: boolean
  creado_en: string
}

/** Solo visible para el auxiliar: el estudiante nunca recibe `correcta`. */
export type RecuperacionPreguntaRow = {
  id: string
  recuperacion_id: string
  orden: number
  enunciado: string
  codigo: string | null
  opciones: string[]
  correcta: number
}

export type RecuperacionIntentoRow = {
  id: string
  recuperacion_id: string
  estudiante_id: string
  numero: number
  iniciado_en: string
  vence_en: string
  finalizado_en: string | null
  correctas: number | null
  total_preguntas: number | null
  puntos_obtenidos: number | null
}

export type VistaCalificacionesParcialRow = {
  estudiante_id: string
  parcial: 1 | 2 | 3
  fecha_inicio: string
  fecha_fin: string
  dias_semana: number[]
  tope_asistencia_parcial: number
  total_clases_parcial: number
  asistencias_presente: number
  nota_asistencia: number
  extras_acumulados: number
  nota_parcial: number
}

export type LiberacionRow = {
  id: string
  nombre: string
  ru: string
  paralelo: 'A' | 'B' | 'C' | null
  nota: number | null
  horario_seleccionado: string | null
  estado: 'pendiente' | 'confirmado' | 'en_examen' | 'finalizado' | null
  // Columnas migradas desde examen_contenido JSONB (Fase 3 de migración)
  examen_pdf_url: string | null
  examen_pdf_file_id: string | null
  // Columnas migradas desde examen_respuesta JSONB (Fase 3 de migración)
  archivos_respuesta: ArchivoMetadata[] | null
  drive_folder_id: string | null
  finalizado_en: string | null
  // Metadatos
  confirmado_en: string | null
  creado_en: string
  // FK hacia estudiantes (agregado en migración Fase 2)
  estudiante_id: string | null
}
