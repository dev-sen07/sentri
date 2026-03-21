'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { supabase, EstudianteRow } from '@/lib/supabase'

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function EstudiantesPage() {
  const router = useRouter()
  const [estudiantes, setEstudiantes] = useState<EstudianteRow[]>([])
  const [filteredEstudiantes, setFilteredEstudiantes] = useState<EstudianteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Modal states
  const [openModal, setOpenModal] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    ci: '',
    ru: '',
    correo: '',
    paralelo: 'A',
  })
  const [loadingRegistrar, setLoadingRegistrar] = useState(false)
  const [errorRegistrar, setErrorRegistrar] = useState<string | null>(null)
  const [successRegistrar, setSuccessRegistrar] = useState(false)

  // CSV Import states
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ total: 0, current: 0, success: 0, errors: 0 })
  const [importResult, setImportResult] = useState<{ errors: Array<{ row: number, message: string }> } | null>(null)

  const fetchEstudiantesData = async () => {
    const { data: estudiantesData, error } = await supabase
      .from('estudiantes')
      .select('*')
      .order('apellido', { ascending: true })

    if (error) throw error
    setEstudiantes(estudiantesData || [])
    setFilteredEstudiantes(estudiantesData || [])
  }

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
        await fetchEstudiantesData()
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
        est.ru.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (est.paralelo && est.paralelo.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    setFilteredEstudiantes(filtered)
  }, [searchTerm, estudiantes])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingRegistrar(true)
    setErrorRegistrar(null)
    setSuccessRegistrar(false)

    try {
      if (!formData.nombre || !formData.apellido || !formData.ci || !formData.ru || !formData.correo) {
        throw new Error('Todos los campos son requeridos')
      }

      const response = await fetch('/api/create-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          password: formData.ci, // Default password as CI
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al registrar estudiante')
      }

      setSuccessRegistrar(true)
      setFormData({
        nombre: '',
        apellido: '',
        ci: '',
        ru: '',
        correo: '',
        paralelo: 'A',
      })

      await fetchEstudiantesData()

      setTimeout(() => {
        setOpenModal(false)
        setSuccessRegistrar(false)
      }, 1500)
    } catch (err) {
      setErrorRegistrar(err instanceof Error ? err.message : 'Error al registrar estudiante')
    } finally {
      setLoadingRegistrar(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportResult(null)
    setImportProgress({ total: 0, current: 0, success: 0, errors: 0 })

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      transform: (value) => typeof value === 'string' ? value.trim() : value,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[]
        setImportProgress(prev => ({ ...prev, total: rows.length }))
        
        let successCount = 0
        let errorCount = 0
        const importErrors: Array<{ row: number, message: string }> = []

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          try {
            if (!row.nombre || !row.apellido || !row.ci || !row.ru || !row.correo || !row.paralelo) {
              throw new Error('Faltan campos requeridos')
            }

            const response = await fetch('/api/create-student', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...row,
                password: row.ci,
              }),
            })

            const data = await response.json()

            if (!response.ok) {
              throw new Error(data.error || 'Error al registrar estudiante')
            }

            successCount++
          } catch (err) {
            errorCount++
            importErrors.push({ row: i + 1, message: err instanceof Error ? err.message : 'Error desconocido' })
          } finally {
            setImportProgress(prev => ({ ...prev, current: i + 1, success: successCount, errors: errorCount }))
          }
        }

        await fetchEstudiantesData()
        setImportResult({ errors: importErrors })
        setImporting(false)
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      },
      error: (error) => {
        console.error('Error parsing CSV', error)
        setImporting(false)
      }
    })
  }

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
          <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Estudiantes</h1>
              <p className="text-muted-foreground mt-2">
                Total: {filteredEstudiantes.length} estudiantes
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                {importing ? `Importando (${importProgress.current}/${importProgress.total})` : 'Importar CSV'}
              </Button>
              <Dialog open={openModal} onOpenChange={setOpenModal}>
                <DialogTrigger asChild>
                  <Button disabled={importing}>Agregar Estudiante</Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Registrar Estudiante</DialogTitle>
                  <DialogDescription>
                    Completa todos los campos requeridos para agregar un nuevo estudiante.
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  {errorRegistrar && (
                    <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-md text-sm">
                      {errorRegistrar}
                    </div>
                  )}

                  {successRegistrar && (
                    <div className="bg-green-500/10 text-green-700 px-3 py-2 rounded-md text-sm">
                      Estudiante registrado exitosamente.
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="nombre" className="text-sm font-medium">Nombre *</label>
                      <Input id="nombre" name="nombre" type="text" placeholder="Juan" value={formData.nombre} onChange={handleChange} required />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="apellido" className="text-sm font-medium">Apellido *</label>
                      <Input id="apellido" name="apellido" type="text" placeholder="García" value={formData.apellido} onChange={handleChange} required />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="ci" className="text-sm font-medium">CI *</label>
                      <Input id="ci" name="ci" type="text" placeholder="1234567890" value={formData.ci} onChange={handleChange} required />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="ru" className="text-sm font-medium">RU *</label>
                      <Input id="ru" name="ru" type="text" placeholder="123456" value={formData.ru} onChange={handleChange} required />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="correo" className="text-sm font-medium">Correo Electrónico *</label>
                      <Input id="correo" name="correo" type="email" placeholder="juan@ejemplo.com" value={formData.correo} onChange={handleChange} required />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="paralelo" className="text-sm font-medium">Paralelo *</label>
                      <Select value={formData.paralelo} onValueChange={(value) => setFormData((prev) => ({ ...prev, paralelo: value }))}>
                        <SelectTrigger id="paralelo"><SelectValue placeholder="Selecciona un paralelo" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">Paralelo A</SelectItem>
                          <SelectItem value="B">Paralelo B</SelectItem>
                          <SelectItem value="C">Paralelo C</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button type="submit" className="w-full mt-4" disabled={loadingRegistrar}>
                    {loadingRegistrar ? 'Registrando...' : 'Registrar Estudiante'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          </div>
          
          {importResult && (
            <Card className={importResult.errors.length > 0 ? "border-amber-500" : "border-green-500"}>
              <CardHeader className="py-3">
                <CardTitle className="text-lg">Resultado de la importación</CardTitle>
                <CardDescription>
                  Se procesaron {importProgress.total} registros. Exitosos: <span className="text-green-600 font-bold">{importProgress.success}</span>. Errores: <span className="text-destructive font-bold">{importProgress.errors}</span>.
                </CardDescription>
              </CardHeader>
              {importResult.errors.length > 0 && (
                <CardContent>
                  <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-md max-h-40 overflow-y-auto">
                    <p className="font-semibold mb-2">Errores detallados:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      {importResult.errors.map((err, idx) => (
                        <li key={idx}>Fila {err.row}: {err.message}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

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
                        <TableHead>Paralelo</TableHead>
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
                          <TableCell className="font-bold text-center">{est.paralelo}</TableCell>
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
