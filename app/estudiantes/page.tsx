'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, EstudianteRow } from '@/lib/supabase'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function EstudiantesPage() {
  const router = useRouter()
  const [estudiantes, setEstudiantes] = useState<EstudianteRow[]>([])
  const [filteredEstudiantes, setFilteredEstudiantes] = useState<EstudianteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
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
          return
        }

        // Fetch estudiantes
        const { data: estudiantesData, error } = await supabase
          .from('estudiantes')
          .select('*')
          .order('apellido', { ascending: true })

        if (error) throw error

        setEstudiantes(estudiantesData || [])
        setFilteredEstudiantes(estudiantesData || [])
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndFetchData()
  }, [router])

  useEffect(() => {
    const filtered = estudiantes.filter(
      (est) =>
        est.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        est.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
        est.ci.toLowerCase().includes(searchTerm.toLowerCase()) ||
        est.ru.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredEstudiantes(filtered)
  }, [searchTerm, estudiantes])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Estudiantes</h1>
              <p className="text-muted-foreground mt-2">
                Total: {filteredEstudiantes.length} estudiantes
              </p>
            </div>
            <Button asChild>
              <a href="/registrar-estudiante">Agregar Estudiante</a>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Buscar Estudiantes</CardTitle>
              <CardDescription>Filtra por nombre, apellido, CI o RU</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Buscar estudiante..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lista de Estudiantes</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredEstudiantes.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No hay estudiantes registrados
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Apellido</TableHead>
                        <TableHead>CI</TableHead>
                        <TableHead>RU</TableHead>
                        <TableHead>Correo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEstudiantes.map((est) => (
                        <TableRow key={est.id}>
                          <TableCell className="font-medium">{est.nombre}</TableCell>
                          <TableCell>{est.apellido}</TableCell>
                          <TableCell>{est.ci}</TableCell>
                          <TableCell>{est.ru}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{est.correo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
