'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, EstudianteRow } from '@/lib/supabase'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { Input } from '@/components/ui/input'

export default function MarcarAsistenciaPage() {
  const router = useRouter()
  const [openEstudiante, setOpenEstudiante] = useState(false)
  const [estudiantes, setEstudiantes] = useState<EstudianteRow[]>([])
  const [selectedEstudiante, setSelectedEstudiante] = useState<string>('')
  const [fecha, setFecha] = useState<string>('')
  const [hora, setHora] = useState<string>('')
  const [estado, setEstado] = useState<'presente' | 'ausente' | 'retraso'>('presente')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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

        // Set today's date as default
        const today = new Date().toISOString().split('T')[0]
        setFecha(today)

        // Set current time as default
        const now = new Date()
        const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        setHora(timeString)
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setInitialLoading(false)
      }
    }

    checkAuthAndFetchData()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      if (!selectedEstudiante) {
        throw new Error('Debes seleccionar un estudiante')
      }

      if (!fecha || !hora) {
        throw new Error('Debes completar fecha y hora')
      }

      // Insert asistencia
      const { error: insertError } = await supabase.from('asistencias').insert([
        {
          estudiante_id: selectedEstudiante,
          fecha,
          hora,
          estado,
        },
      ])

      if (insertError) {
        throw new Error(insertError.message)
      }

      setSuccess(true)
      setSelectedEstudiante('')

      // Reset time and estado
      const now = new Date()
      const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      setHora(timeString)
      setEstado('presente')

      // Clear success message after 2 seconds
      setTimeout(() => {
        setSuccess(false)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar asistencia')
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="grid gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Marcar Asistencia</h1>
            <p className="text-muted-foreground mt-2">Registra la asistencia de un estudiante</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Registro de Asistencia</CardTitle>
              <CardDescription>Completa los datos para registrar la asistencia</CardDescription>
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
                    Asistencia registrada exitosamente
                  </div>
                )}

                <div className="space-y-2 flex flex-col">
                  <label htmlFor="estudiante" className="text-sm font-medium">
                    Estudiante *
                  </label>
                  <Popover open={openEstudiante} onOpenChange={setOpenEstudiante}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openEstudiante}
                        className="w-full justify-between"
                      >
                        {selectedEstudiante
                          ? (() => {
                              const est = estudiantes.find((e) => e.id === selectedEstudiante)
                              return est ? `${est.apellido}, ${est.nombre} (${est.ci || 'Sin CI'}) - Par: ${est.paralelo || 'N/A'}` : "Seleccionar un estudiante..."
                            })()
                          : "Selecciona un estudiante..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por nombre, apellido o CI..." />
                        <CommandEmpty>No se encontró ningún estudiante.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-auto">
                          {estudiantes.map((est) => (
                            <CommandItem
                              key={est.id}
                              value={`${est.nombre} ${est.apellido} ${est.ci || ''} ${est.paralelo || ''}`}
                              onSelect={() => {
                                setSelectedEstudiante(est.id)
                                setOpenEstudiante(false)
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${selectedEstudiante === est.id ? "opacity-100" : "opacity-0"}`}
                              />
                              {est.apellido}, {est.nombre} {est.ci ? `(${est.ci})` : ''} - Par: {est.paralelo || 'N/A'}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="fecha" className="text-sm font-medium">
                      Fecha *
                    </label>
                    <Input
                      id="fecha"
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="hora" className="text-sm font-medium">
                      Hora *
                    </label>
                    <Input
                      id="hora"
                      type="time"
                      value={hora}
                      onChange={(e) => setHora(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="estado" className="text-sm font-medium">
                    Estado *
                  </label>
                  <Select value={estado} onValueChange={(value: any) => setEstado(value)}>
                    <SelectTrigger id="estado">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presente">Presente</SelectItem>
                      <SelectItem value="ausente">Ausente</SelectItem>
                      <SelectItem value="retraso">Retraso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Registrando...' : 'Registrar Asistencia'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
