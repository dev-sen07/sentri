'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function CrearPracticaForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    resultado_esperado: '',
    paralelo: 'A',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)

  useEffect(() => {
    const checkAuthAndFetchEditData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push('/login')
          return
        }

        // Only auxiliar can create practices
        const { data: roleData } = await supabase
          .from('usuarios_roles')
          .select('rol')
          .eq('user_id', session.user.id)
          .single()

        if (!roleData || roleData.rol !== 'auxiliar') {
          router.push('/dashboard')
          return
        }

        // If edit mode, load practice data
        if (editId) {
          const { data, error: fetchError } = await supabase
            .from('practicas')
            .select('*')
            .eq('id', editId)
            .single()

          if (fetchError) {
            console.error('Error fetching practice to edit', fetchError)
          } else if (data) {
            setFormData({
              nombre: data.nombre,
              descripcion: data.descripcion,
              resultado_esperado: data.resultado_esperado,
              paralelo: data.paralelo,
            })
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error)
        router.push('/login')
      } finally {
        setAuthChecking(false)
      }
    }

    checkAuthAndFetchEditData()
  }, [router, editId])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      if (!formData.nombre || !formData.descripcion || !formData.resultado_esperado) {
        throw new Error('Todos los campos son requeridos')
      }

      if (editId) {
        // Modo Edición
        const { error: updateError } = await supabase
          .from('practicas')
          .update({
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            resultado_esperado: formData.resultado_esperado,
            paralelo: formData.paralelo,
          })
          .eq('id', editId)

        if (updateError) throw new Error(updateError.message)
        
        setSuccess(true)
        setTimeout(() => router.push('/practicas'), 1500)
      } else {
        // Modo Creación
        const { error: insertError } = await supabase.from('practicas').insert([
          {
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            resultado_esperado: formData.resultado_esperado,
            paralelo: formData.paralelo,
          },
        ])

        if (insertError) throw new Error(insertError.message)

        setSuccess(true)
        setFormData({
          nombre: '',
          descripcion: '',
          resultado_esperado: '',
          paralelo: 'A',
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la práctica')
    } finally {
      setLoading(false)
    }
  }

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="grid gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {editId ? 'Editar Práctica Python' : 'Crear Práctica Python'}
            </h1>
            <p className="text-muted-foreground mt-2">
              {editId 
                ? 'Modifica los detalles del ejercicio.' 
                : 'Asigna un nuevo ejercicio a los estudiantes de un paralelo específico.'}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalles del Ejercicio</CardTitle>
              <CardDescription>
                Define qué deben programar y la salida esperada en la consola
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-md text-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-500/10 text-green-700 px-3 py-2 rounded-md text-sm">
                    {editId ? 'Práctica actualizada con éxito. Redirigiendo...' : 'Práctica creada exitosamente.'}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="nombre" className="text-sm font-medium">
                      Nombre de la Práctica *
                    </label>
                    <Input
                      id="nombre"
                      name="nombre"
                      placeholder="Ej: Hola Mundo en Python"
                      value={formData.nombre}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="paralelo" className="text-sm font-medium">
                      Paralelo Destino *
                    </label>
                    <Select
                      value={formData.paralelo}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, paralelo: value }))
                      }
                    >
                      <SelectTrigger id="paralelo">
                        <SelectValue placeholder="Selecciona un paralelo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">Paralelo A</SelectItem>
                        <SelectItem value="B">Paralelo B</SelectItem>
                        <SelectItem value="C">Paralelo C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="descripcion" className="text-sm font-medium">
                    Descripción / Texto del Problema *
                  </label>
                  <Textarea
                    id="descripcion"
                    name="descripcion"
                    placeholder="Escribe un programa que imprima 'Hola Mundo'..."
                    rows={4}
                    value={formData.descripcion}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="resultado_esperado" className="text-sm font-medium">
                    Resultado Esperado (Terminal) *
                  </label>
                  <Textarea
                    id="resultado_esperado"
                    name="resultado_esperado"
                    placeholder="Hola Mundo"
                    rows={2}
                    value={formData.resultado_esperado}
                    onChange={handleChange}
                    className="font-mono bg-muted"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    El código del estudiante deberá imprimir exactamente este valor usando print() para obtener la nota completa. Ojo con espacios y mayúsculas.
                  </p>
                </div>

                <Button type="submit" className="w-full mt-4" disabled={loading}>
                  {loading ? 'Guardando...' : (editId ? 'Actualizar Práctica' : 'Publicar Práctica')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function CrearPracticaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    }>
      <CrearPracticaForm />
    </Suspense>
  )
}
