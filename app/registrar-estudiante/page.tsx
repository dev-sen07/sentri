'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function RegistrarEstudiantePage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    ci: '',
    ru: '',
    correo: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push('/login')
          return
        }

        // Check if user is auxiliar
        const { data: roleData } = await supabase
          .from('usuarios_roles')
          .select('rol')
          .eq('user_id', session.user.id)
          .single()

        if (!roleData || roleData.rol !== 'auxiliar') {
          router.push('/dashboard')
        }
      } catch (error) {
        console.error('Error checking auth:', error)
        router.push('/login')
      }
    }

    checkAuth()
  }, [router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      // Validate required fields
      if (!formData.nombre || !formData.apellido || !formData.ci || !formData.ru || !formData.correo) {
        throw new Error('Todos los campos son requeridos')
      }

      // Call internal API to securely create user & student record using Service Role
      const response = await fetch('/api/create-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: formData.nombre,
          apellido: formData.apellido,
          ci: formData.ci,
          ru: formData.ru,
          correo: formData.correo,
          password: formData.ci, // Default password as CI
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al registrar estudiante')
      }

      setSuccess(true)
      setFormData({
        nombre: '',
        apellido: '',
        ci: '',
        ru: '',
        correo: '',
      })

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/estudiantes')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar estudiante')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">


      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="grid gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Registrar Estudiante</h1>
            <p className="text-muted-foreground mt-2">Agrrega un nuevo estudiante al sistema</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Información del Estudiante</CardTitle>
              <CardDescription>Completa todos los campos requeridos</CardDescription>
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
                    Estudiante registrado exitosamente. Redireccionando...
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="nombre" className="text-sm font-medium">
                      Nombre *
                    </label>
                    <Input
                      id="nombre"
                      name="nombre"
                      type="text"
                      placeholder="Juan"
                      value={formData.nombre}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="apellido" className="text-sm font-medium">
                      Apellido *
                    </label>
                    <Input
                      id="apellido"
                      name="apellido"
                      type="text"
                      placeholder="García"
                      value={formData.apellido}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="ci" className="text-sm font-medium">
                      CI (Cédula de Identidad) *
                    </label>
                    <Input
                      id="ci"
                      name="ci"
                      type="text"
                      placeholder="1234567890"
                      value={formData.ci}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="ru" className="text-sm font-medium">
                      RU (Registro Único) *
                    </label>
                    <Input
                      id="ru"
                      name="ru"
                      type="text"
                      placeholder="123456"
                      value={formData.ru}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="correo" className="text-sm font-medium">
                    Correo Electrónico *
                  </label>
                  <Input
                    id="correo"
                    name="correo"
                    type="email"
                    placeholder="juan@ejemplo.com"
                    value={formData.correo}
                    onChange={handleChange}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Registrando...' : 'Registrar Estudiante'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
