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
  rol: 'estudiante' | 'auxiliar'
}

export type PracticaRow = {
  id: string
  nombre: string
  descripcion: string
  resultado_esperado: string
  paralelo: 'A' | 'B' | 'C'
  creado_en: string
}

export type EntregaRow = {
  id: string
  practica_id: string
  estudiante_id: string
  codigo: string
  nota: number
  fecha_entrega: string
}
