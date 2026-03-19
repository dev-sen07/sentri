'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, PracticaRow } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface PracticaWithEstado extends PracticaRow {
  entrega?: {
    nota: number
    fecha_entrega: string
  }
}

export default function PracticasPage() {
  const router = useRouter()
  const [practicas, setPracticas] = useState<PracticaWithEstado[]>([])
  const [loading, setLoading] = useState(true)
  const [isUserAuxiliar, setIsUserAuxiliar] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [errorDialog, setErrorDialog] = useState<string | null>(null)

  useEffect(() => {
    const fetchPracticas = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push('/login')
          return
        }

        // Check user role first
        const { data: roleData } = await supabase
          .from('usuarios_roles')
          .select('rol')
          .eq('user_id', session.user.id)
          .single()

        const isAuxiliar = roleData?.rol === 'auxiliar'
        setIsUserAuxiliar(isAuxiliar)

        let query = supabase.from('practicas').select('*').order('creado_en', { ascending: false })
        let estudianteId = null

        if (!isAuxiliar) {
          // Verify if user is student and get their parallel
          const { data: userData } = await supabase
            .from('estudiantes')
            .select('id, paralelo')
            .eq('user_id', session.user.id)
            .single()

          if (!userData) {
            router.push('/dashboard')
            return
          }
          query = query.eq('paralelo', userData.paralelo)
          estudianteId = userData.id
        }

        // Fetch practicas available
        const { data: practicasData, error: practicasError } = await query

        if (practicasError) throw practicasError

        let entregasMap = new Map()

        if (estudianteId) {
          // Fetch user's submissions
          const { data: entregasData, error: entregasError } = await supabase
            .from('entregas')
            .select('practica_id, nota, fecha_entrega')
            .eq('estudiante_id', estudianteId)

          if (!entregasError && entregasData) {
            entregasMap = new Map(entregasData.map(e => [e.practica_id, e]))
          }
        }

        const practicasWithStatus = (practicasData || []).map((practica) => ({
          ...practica,
          entrega: entregasMap.get(practica.id) as { nota: number; fecha_entrega: string } | undefined
        }))

        setPracticas(practicasWithStatus)

      } catch (error) {
        console.error('Error fetching prácticas:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPracticas()
  }, [router])

  const confirmDelete = (id: string) => {
    setDeleteId(id)
  }

  const executeDelete = async () => {
    if (!deleteId) return
    try {
      setLoading(true)
      const { error } = await supabase.from('practicas').delete().eq('id', deleteId)
      if (error) throw error
      setPracticas(prev => prev.filter(p => p.id !== deleteId))
    } catch (error: unknown) {
      setErrorDialog('Error al eliminar: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setDeleteId(null)
      setLoading(false)
    }
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Prácticas Disponibles</h1>
          <p className="text-muted-foreground mt-2">
            Resuelve los ejercicios en Python asignados.
          </p>
        </div>

        {practicas.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No hay prácticas disponibles para tu paralelo en este momento.
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {practicas.map((practica) => (
              <Card key={practica.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{practica.nombre}</CardTitle>
                  <CardDescription>
                    Creado el: {new Date(practica.creado_en).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {practica.descripcion}
                  </p>
                  
                  {practica.entrega && (
                    <div className="mt-4 p-3 bg-muted rounded-md border text-sm">
                      <div className="font-medium mb-1 text-primary">Práctica Entregada</div>
                      <div>Nota: <span className="font-bold">{practica.entrega.nota}/100</span></div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Entregado el: {new Date(practica.entrega.fecha_entrega).toLocaleString()}
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button 
                    className="w-full" 
                    variant={practica.entrega ? "outline" : "default"}
                    onClick={() => router.push(`/practicas/${practica.id}`)}
                  >
                    {isUserAuxiliar 
                      ? "Probar en modo Vista Previa" 
                      : (practica.entrega ? "Ver mi entrega" : "Resolver Práctica")}
                  </Button>
                  
                  {isUserAuxiliar && (
                    <div className="flex w-full gap-2 mt-2">
                       <Button variant="secondary" className="w-1/2" onClick={() => router.push(`/crear-practica?edit=${practica.id}`)}>
                         Editar
                       </Button>
                       <Button variant="destructive" className="w-1/2" onClick={() => confirmDelete(practica.id)}>
                         Eliminar
                       </Button>
                    </div>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar Práctica?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción es irreversible y eliminará esta práctica junto con todas las entregas subidas por los estudiantes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!errorDialog} onOpenChange={(open) => !open && setErrorDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Error</AlertDialogTitle>
              <AlertDialogDescription>
                {errorDialog}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setErrorDialog(null)}>Entendido</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
      </main>
    </div>
  )
}
