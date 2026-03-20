'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, EstudianteRow } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Mail, Hash, BookOpen, GraduationCap, Info, Tag } from 'lucide-react'

export default function MiPerfilPage() {
  const router = useRouter()
  const [estudiante, setEstudiante] = useState<EstudianteRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/login'); return }

        const { data: roleData } = await supabase
          .from('usuarios_roles').select('rol').eq('user_id', session.user.id).single()

        if (!roleData || roleData.rol !== 'estudiante') { router.push('/dashboard'); return }

        const { data: estudianteData } = await supabase
          .from('estudiantes').select('*').eq('user_id', session.user.id).single()

        if (estudianteData) setEstudiante(estudianteData)
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }
    checkAuthAndFetchData()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground animate-pulse">Cargando tu perfil...</p>
        </div>
      </div>
    )
  }

  if (!estudiante) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">No se encontraron datos del estudiante</p>
      </div>
    )
  }

  const getInitials = (nombre: string, apellido: string) =>
    `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase()

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-4 py-8 pb-16">

        {/* Banner gradient */}
        <div className="relative w-full h-48 sm:h-64 rounded-2xl mb-16 sm:mb-20 overflow-visible bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 shadow-xl">
          {/* Avatar floating at bottom-left */}
          <div className="absolute -bottom-12 sm:-bottom-16 left-8">
            <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-background shadow-xl">
              <AvatarFallback className="bg-primary text-primary-foreground text-3xl sm:text-5xl font-bold">
                {getInitials(estudiante.nombre, estudiante.apellido)}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Student badge top-right */}
          <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-white font-medium border border-white/30 shadow-sm flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Estudiante
          </div>

          {/* Codigo badge */}
          {estudiante.codigo && (
            <div className="absolute top-4 left-4 bg-yellow-400/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-yellow-900 font-bold text-sm border border-yellow-300 shadow-sm flex items-center gap-1.5">
              <Tag className="w-4 h-4" />
              {estudiante.codigo}
            </div>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Info Card */}
          <Card className="md:col-span-2 border-border shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-3xl font-bold">{estudiante.nombre} {estudiante.apellido}</CardTitle>
                  <CardDescription className="text-base mt-1 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> {estudiante.correo}
                  </CardDescription>
                </div>
                {/* Paralelo Badge */}
                <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full border border-primary/20 shrink-0">
                  <BookOpen className="w-5 h-5" />
                  <span className="font-semibold text-lg">Paralelo {estudiante.paralelo}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t">
                {/* CI */}
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-muted rounded-xl text-muted-foreground shrink-0">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cédula de Identidad</p>
                    <p className="text-lg font-semibold mt-1">{estudiante.ci}</p>
                  </div>
                </div>

                {/* RU */}
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-muted rounded-xl text-muted-foreground shrink-0">
                    <Hash className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Registro Único (RU)</p>
                    <p className="text-lg font-semibold mt-1">{estudiante.ru}</p>
                  </div>
                </div>
              </div>

              {/* Código destacado */}
              {estudiante.codigo && (
                <div className="mt-4 pt-4 border-t flex items-center gap-4">
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl text-yellow-700 dark:text-yellow-400 shrink-0">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Código de Estudiante</p>
                    <p className="text-2xl font-bold mt-0.5 tracking-widest text-yellow-700 dark:text-yellow-400 font-mono border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 inline-block px-3 py-1 rounded-lg">
                      {estudiante.codigo}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Academic Info Card */}
          <Card className="bg-gradient-to-br from-primary/5 to-muted border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Información Académica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-background p-4 rounded-xl shadow-sm border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Materia</p>
                <p className="font-semibold text-foreground">Programación</p>
              </div>
              <div className="bg-background p-4 rounded-xl shadow-sm border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Grupo Asignado</p>
                <p className="font-semibold text-foreground flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  Paralelo {estudiante.paralelo}
                </p>
              </div>
              {estudiante.codigo && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl shadow-sm border border-yellow-200 dark:border-yellow-800">
                  <p className="text-xs text-muted-foreground mb-1">Código Asignado</p>
                  <p className="font-bold text-xl font-mono text-yellow-700 dark:text-yellow-400 tracking-widest">
                    {estudiante.codigo}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
