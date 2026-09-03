'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff, Sparkles, LogIn, GraduationCap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await signIn(`${username}@sentri.com`, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
      setLoading(false)
    }
  }

  return (
    <main className="h-screen w-full flex flex-col justify-center items-center bg-zinc-950 p-4 sm:p-8 overflow-y-auto relative">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-125 bg-gradient-to-b from-indigo-500/20 via-violet-500/10 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-125 h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-sm border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl relative z-10">
        <CardHeader className="text-center pb-4 pt-6">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-violet-500/30">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
            Bienvenido a Sentri
          </CardTitle>
          <CardDescription className="text-sm mt-1">
            Ingresa tus credenciales para acceder al sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/15 border border-destructive/30 text-destructive-foreground px-4 py-3 rounded-lg text-sm text-center font-medium animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-semibold text-white/90 tracking-wide">
                Correo Electrónico
              </label>
              <div className="flex items-center mt-2 h-11 bg-white/95 rounded-md shadow-inner ring-offset-background focus-within:ring-2 focus-within:ring-violet-500 focus-within:ring-offset-0">
                <Input
                  id="username"
                  type="text"
                  placeholder="nombre.apellido"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.trim())}
                  className="bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-950 placeholder:text-zinc-400 font-medium h-full rounded-r-none flex-1 min-w-0"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <div className="h-6 w-px bg-zinc-200 shrink-0" />
                <span className="px-3 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent whitespace-nowrap select-none">
                  @sentri.com
                </span>
              </div>
            </div>

            <div className="space-y-2 relative">
              <label htmlFor="password" className="text-sm font-semibold text-white/90 tracking-wide">
                Contraseña
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/95 border-0 mt-2 focus-visible:ring-2 focus-visible:ring-violet-500 text-zinc-950 placeholder:text-zinc-400 font-medium h-11 shadow-inner pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-7 -translate-y-1/2 text-muted-foreground hover:text-gray-900 transition-colors"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 text-base font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 shadow-lg shadow-violet-500/25 transition-all mt-2" 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Conectando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LogIn className="w-5 h-5" />
                  Iniciar Sesión
                </div>
              )}
            </Button>
          </form>

        </CardContent>
      </Card>
    </main>
  )
}
