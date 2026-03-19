'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, PracticaRow, EntregaRow } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import Editor from '@monaco-editor/react'
import Script from 'next/script'
import { Play, CheckCircle, XCircle, Maximize2, Minimize2 } from 'lucide-react'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loadPyodide: () => Promise<any>
    pyodideInstance: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runPythonAsync: (code: string) => Promise<any>
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ResolverPracticaPage({ params }: { params: any }) {
  const router = useRouter()
  // No resolvemos params extra aquí sino dentro del fetch async

  const [practica, setPractica] = useState<PracticaRow | null>(null)
  const [entrega, setEntrega] = useState<EntregaRow | null>(null)
  const [estudianteId, setEstudianteId] = useState<string>('')
  
  const [codigo, setCodigo] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [pyodideReady, setPyodideReady] = useState(false)
  const [resultadoTerminal, setResultadoTerminal] = useState<string>('')
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // Ref to prevent multiple submissions
  const submissionLock = useRef(false)

  useEffect(() => {
    const fetchPracticaAndAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
          return
        }

        // Get user role
        const { data: roleData } = await supabase
          .from('usuarios_roles')
          .select('rol')
          .eq('user_id', session.user.id)
          .single()

        const isAuxiliar = roleData?.rol === 'auxiliar'

        let userData = null
        if (!isAuxiliar) {
          // Get student
          const { data } = await supabase
            .from('estudiantes')
            .select('id, paralelo')
            .eq('user_id', session.user.id)
            .single()

          if (!data) {
            router.push('/dashboard')
            return
          }
          userData = data
          setEstudianteId(userData.id)
        }

        let practicaId = params?.id
        if (params instanceof Promise) {
          const unwrapped = await params
          practicaId = unwrapped.id
        }

        // Fetch practica details
        const { data: practicaData, error: practicaError } = await supabase
          .from('practicas')
          .select('*')
          .eq('id', practicaId)
          .single()

        if (practicaError || !practicaData) {
          router.push('/practicas')
          return
        }
        
        // Verifica paralelo solo si es estudiante
        if (userData && practicaData.paralelo !== userData.paralelo) {
          router.push('/practicas')
          return
        }

        setPractica(practicaData)

        // Ver si ya hay entrega
        if (userData) {
          const { data: entregaData } = await supabase
            .from('entregas')
            .select('*')
            .eq('practica_id', practicaId)
            .eq('estudiante_id', userData.id)
            .single()

          if (entregaData) {
            setEntrega(entregaData)
            setCodigo(entregaData.codigo)
          } else {
            // default python code
            setCodigo("# Escribe tu código Python aquí\n# Nota: No puedes pegar código, debes typearlo.\n\n")
          }
        } else {
          // Es auxiliar
          setCodigo("# Modo vista previa (Auxiliar)\n# Puedes probar el código aquí, pero no se guardará la nota en BD.\n\n")
        }

      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPracticaAndAuth()
  }, [params, router])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorDidMount = (editor: any) => {
    // Intercept keyboard paste (Ctrl+V or Cmd+V)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.onKeyDown((e: any) => {
      if ((e.ctrlKey || e.metaKey) && (e.browserEvent.key === 'v' || e.browserEvent.key === 'V')) {
        e.preventDefault()
        e.stopPropagation()
        setAlertMessage("Pegar código está estrictamente prohibido en esta práctica. Debes escribir el código tú mismo para asegurar que aprendas.")
      }
    })

    // Backup: block mouse/DOM paste
    const domNode = editor.getDomNode ? editor.getDomNode() : editor.getContainerDOMNode()
    if (domNode) {
      domNode.addEventListener('paste', (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
      }, true)
    }
  }

  const initPyodide = async () => {
    if (!window.pyodideInstance && window.loadPyodide) {
      window.pyodideInstance = await window.loadPyodide()
    }
    setPyodideReady(true)
  }

  const ejecutarCodigo = async () => {
    if (!window.pyodideInstance) return
    if (evaluating) return
    
    setEvaluating(true)
    setResultadoTerminal("Ejecutando código de forma segura en tu navegador...\n")

    try {
      await window.pyodideInstance.runPythonAsync(`
import sys
import io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
      `)

      let executionError = ""
      try {
        await window.pyodideInstance.runPythonAsync(codigo)
      } catch (err: unknown) {
        executionError = err instanceof Error ? err.message : String(err)
      }

      const capturedStdout = await window.pyodideInstance.runPythonAsync(`sys.stdout.getvalue()`)
      const capturedStderr = await window.pyodideInstance.runPythonAsync(`sys.stderr.getvalue()`)

      const outputFinal = String(capturedStdout || '') + String(capturedStderr || '') + (executionError ? "\\nError: " + String(executionError) : "")
      setResultadoTerminal(outputFinal)
    } catch (err: unknown) {
      console.error('Error ejecutando:', err)
      setResultadoTerminal((prev) => prev + "\nError interno del motor Python.")
    } finally {
      setEvaluating(false)
    }
  }

  const evaluarYEnviar = async () => {
    let practicaId = params?.id
    if (params instanceof Promise) {
      practicaId = (await params).id
    }

    if (!window.pyodideInstance) return
    if (submissionLock.current) return
    if (entrega) return // ya enviado

    submissionLock.current = true
    setEvaluating(true)
    setResultadoTerminal("Evaluando y enviando código...\n")

    try {
      await window.pyodideInstance.runPythonAsync(`
import sys
import io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
      `)

      let executionError = ""
      try {
        await window.pyodideInstance.runPythonAsync(codigo)
      } catch (err: unknown) {
        executionError = err instanceof Error ? err.message : String(err)
      }

      const capturedStdout = await window.pyodideInstance.runPythonAsync(`sys.stdout.getvalue()`)
      const capturedStderr = await window.pyodideInstance.runPythonAsync(`sys.stderr.getvalue()`)

      const outputFinal = String(capturedStdout || '') + String(capturedStderr || '') + (executionError ? "\\nError: " + String(executionError) : "")
      setResultadoTerminal(outputFinal)

      // 4. Calificar (100 si coincide exactamente con el esperado)
      const esperadoStr = practica!.resultado_esperado.trim()
      const alumnoStr = String(capturedStdout || '').trim()
      
      const esCorrecto = (esperadoStr === alumnoStr) && !executionError
      const notaFinal = esCorrecto ? 100 : 0

      // 5. Guardar en Supabase o simular guardado
      if (estudianteId) {
        const { data: nuevaEntrega, error: insertError } = await supabase
          .from('entregas')
          .insert({
            practica_id: practicaId,
            estudiante_id: estudianteId,
            codigo: codigo,
            nota: notaFinal
          })
          .select()
          .single()

        if (insertError) throw insertError

        setEntrega(nuevaEntrega || { nota: notaFinal, codigo, fecha_entrega: new Date().toISOString() })
      } else {
        // Modo previo (auxiliar)
        setEntrega({
          id: 'preview',
          practica_id: practicaId,
          estudiante_id: 'auxiliar',
          codigo,
          nota: notaFinal,
          fecha_entrega: new Date().toISOString()
        } as unknown as EntregaRow)
      }
      
    } catch (err: unknown) {
      console.error('Error evaluando o enviando:', err)
      setResultadoTerminal((prev) => prev + "\nError interno del servidor/navegador.")
    } finally {
      setEvaluating(false)
      submissionLock.current = false
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando práctica...</p>
      </div>
    )
  }

  if (!practica) return null

  const esModoLectura = !!entrega

  return (
    <div className="min-h-screen bg-background">
      <Script 
        src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js" 
        onLoad={initPyodide}
      />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 flex space-x-4 items-center">
          <Button variant="outline" onClick={() => router.push('/practicas')}>
            &larr; Volver
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Resolución: {practica.nombre}</h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Columna Izquierda: Instrucciones */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Instrucciones de la Práctica</CardTitle>
                {entrega && (
                  <CardDescription className="font-semibold mt-2 flex items-center gap-2">
                    {entrega.nota === 100 ? (
                      <span className="text-green-600 flex items-center"><CheckCircle className="w-4 h-4 mr-1"/> Práctica Resuelta Correctamente (100/100)</span>
                    ) : (
                      <span className="text-red-600 flex items-center"><XCircle className="w-4 h-4 mr-1"/> Práctica Enviada con Errores ({entrega.nota}/100)</span>
                    )}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm mb-1">Descripción:</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {practica.descripcion}
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-sm mb-1">El resultado exacto de la consola debe ser:</h3>
                  <pre className="bg-muted p-3 rounded-md border font-mono text-sm whitespace-pre-wrap">
                    {practica.resultado_esperado}
                  </pre>
                </div>
              </CardContent>
            </Card>

            
          </div>

          {/* Columna Derecha: Editor de Código */}
          <Card className={`flex flex-col transition-all duration-300 bg-card ${
            isFullscreen 
              ? "fixed inset-0 z-50 w-screen h-screen rounded-none border-0" 
              : "h-[75vh] min-h-[600px] overflow-hidden"
          }`}>
            <CardHeader className="pb-3 border-b shrink-0 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Editor de Código (Python)</CardTitle>
              <div className="flex items-center space-x-3">
                {!pyodideReady && !esModoLectura && (
                  <span className="text-xs text-muted-foreground animate-pulse">Cargando motor Python...</span>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 relative min-h-0 flex flex-col">
              <div className="flex-1 min-h-[200px] relative">
                <Editor
                  height="100%"
                  defaultLanguage="python"
                  value={codigo}
                  theme="vs-dark"
                  onChange={(value) => setCodigo(value || '')}
                  onMount={handleEditorDidMount}
                  options={{
                    readOnly: esModoLectura || evaluating,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                  }}
                />
              </div>
            {resultadoTerminal && (
              <div className="border-t bg-black custom-scrollbar flex flex-col">
                <div className="text-xs text-muted-foreground/80 px-4 py-1.5 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center font-mono">
                  <span>TERMINAL DE SALIDA</span>
                  <button onClick={() => setResultadoTerminal('')} className="hover:text-white transition-colors" title="Limpiar terminal">✕</button>
                </div>
                <pre className="text-green-400 p-4 font-mono text-sm whitespace-pre-wrap overflow-y-auto max-h-[250px] min-h-[100px]">
                  {resultadoTerminal}
                </pre>
              </div>
            )}
            </CardContent>
            <CardFooter className="pt-3 border-t bg-muted/30 flex space-x-3 shrink-0">
              {!esModoLectura && (
                <Button 
                  type="button"
                  variant="secondary"
                  className="w-1/2" 
                  onClick={ejecutarCodigo}
                  disabled={!pyodideReady || evaluating || !codigo.trim()}
                >
                  <Play className="w-4 h-4 mr-2" /> 
                  {evaluating ? "Ejecutando..." : "Probar Código"}
                </Button>
              )}
              
              <Button 
                className={esModoLectura ? "w-full" : "w-1/2"} 
                onClick={evaluarYEnviar}
                disabled={!pyodideReady || esModoLectura || evaluating || !codigo.trim()}
              >
                {evaluating ? (
                  "Enviando..."
                ) : esModoLectura ? (
                  "Práctica ya enviada"
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" /> Entregar Práctica
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <AlertDialog open={!!alertMessage} onOpenChange={(open) => !open && setAlertMessage(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Acción Denegada</AlertDialogTitle>
              <AlertDialogDescription>
                {alertMessage}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setAlertMessage(null)}>Entendido</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </main>
    </div>
  )
}
