import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extrae un mensaje legible de cualquier cosa lanzada en un catch.
 *
 * En JS se puede lanzar cualquier valor, no solo Error. Los `catch (err: any)`
 * que accedian a `err.message` directamente fallaban con un segundo
 * TypeError ("cannot read property 'message' of undefined") que tapaba el
 * error original y dejaba al usuario sin ningun mensaje.
 */
export function mensajeDeError(err: unknown, fallback = 'Ocurrio un error inesperado'): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string' && err.trim()) return err
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message: unknown }).message
    if (typeof m === 'string' && m.trim()) return m
  }
  return fallback
}
