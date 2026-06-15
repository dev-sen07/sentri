import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
