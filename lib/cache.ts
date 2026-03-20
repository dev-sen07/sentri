/**
 * localStorage cache utility with TTL support.
 * Avoids redundant Supabase requests by caching data locally.
 *
 * Usage:
 *   import { cacheGet, cacheSet, cacheClear } from '@/lib/cache'
 *   const data = cacheGet<EstudianteRow[]>('estudiantes') ?? await fetchFromSupabase()
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

/** Read from cache. Returns null if missing or expired. */
export function cacheGet<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`sentri:${key}`)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(`sentri:${key}`)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

/** Write to cache with optional TTL (ms). */
export function cacheSet<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  if (typeof window === 'undefined') return
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs }
    localStorage.setItem(`sentri:${key}`, JSON.stringify(entry))
  } catch (e) {
    console.warn('[cache] Error writing to localStorage:', e)
  }
}

/** Force-expire a key so next read re-fetches from Supabase. */
export function cacheClear(key: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(`sentri:${key}`)
}

/** Clear all sentri:* keys. */
export function cacheFlushAll(): void {
  if (typeof window === 'undefined') return
  Object.keys(localStorage)
    .filter(k => k.startsWith('sentri:'))
    .forEach(k => localStorage.removeItem(k))
}
