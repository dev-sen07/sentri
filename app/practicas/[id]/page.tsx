'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, PracticaRow, EntregaRow, Verificacion } from '@/lib/supabase'
import { cacheClear } from '@/lib/cache'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
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
import Editor from '@monaco-editor/react'
import { CheckCircle, XCircle, Maximize2, Minimize2, Clock, AlertTriangle } from 'lucide-react'

// ─── Pure static verification engine (no Pyodide needed) ───────────────────────
function verificarReglas(code: string, reglas: Verificacion[]): string | null {
  for (const regla of reglas) {
    const v = regla.valor ?? ''
    let pasa = true
    switch (regla.tipo) {
      case 'contiene_funcion':
        pasa = new RegExp(`def\\s+${v}\\s*\\(`).test(code)
        break
      case 'contiene_clase':
        pasa = new RegExp(`class\\s+${v}[:\\s(]`).test(code)
        break
      case 'usa_bucle_for':
        pasa = /\bfor\b/.test(code)
        break
      case 'usa_bucle_while':
        pasa = /\bwhile\b/.test(code)
        break
      case 'usa_recursion': {
        // Find all defined function names, then check if any calls itself
        const defMatches = [...code.matchAll(/def\s+(\w+)\s*\(/g)]
        pasa = defMatches.some(m => {
          const fnName = m[1]
          // count occurrences of that name being called (excluding the definition line)
          const calls = code.matchAll(new RegExp(`\\b${fnName}\\s*\\(`, 'g'))
          return [...calls].length >= 2 // at least def + 1 recursive call
        })
        break
      }
      case 'contiene_texto':
        pasa = code.includes(v)
        break
      case 'no_contiene_texto':
        pasa = !code.includes(v)
        break
    }
    if (!pasa) return regla.mensaje
  }
  return null // all passed
}

function normalizarCodigo(codigo: string) {
  return codigo
    .replace(/#.*$/gm, "") // quitar comentarios
    .replace(/\s+/g, "")   // quitar espacios
    .trim()
}

export default function ResolverPracticaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: practicaId } = use(params)
  const router = useRouter()
  // No resolvemos params extra aquí sino dentro del fetch async

  const [practica, setPractica] = useState<PracticaRow | null>(null)
  const [entrega, setEntrega] = useState<EntregaRow | null>(null)
  const [estudianteId, setEstudianteId] = useState<string>('')
  
  const [codigo, setCodigo] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [resultadoTerminal, setResultadoTerminal] = useState<string>('')
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [previewAlert, setPreviewAlert] = useState<{ actual: string; esperado: string; esCorrecto: boolean } | null>(null)
  const [reglasAlert, setReglasAlert] = useState<string | null>(null)
  const [isExpired, setIsExpired] = useState(false)
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

        // Get practice
        const { data: practicaData, error: pError } = await supabase
          .from('practicas')
          .select('*')
          .eq('id', practicaId)
          .single()

        if (pError || !practicaData) {
          console.error('Error fetching practica:', pError?.message)
          router.push('/practicas')
          return
        }
        
        // Verifica paralelo solo si es estudiante
        if (userData && practicaData.paralelo !== userData.paralelo) {
          router.push('/practicas')
          return
        }

        setPractica(practicaData)

        // Check deadline
        if (practicaData.fecha_limite) {
          setIsExpired(new Date() > new Date(practicaData.fecha_limite))
        }

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
  }, [practicaId, router])

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



  const evaluarYEnviar = async () => {
    if (submissionLock.current) return
    if (entrega) return
    if (isExpired) {
      setAlertMessage('El plazo de entrega para esta práctica ha vencido. Ya no es posible enviar soluciones.')
      return
    }

    submissionLock.current = true
    setEvaluating(true)
    setResultadoTerminal('Verificando reglas del código...\n')

    try {
      // ── Step 1: Static code rules check ────────────────────────────
      const reglas = practica?.configuracion?.verificaciones ?? []
      if (reglas.length > 0) {
        const fallo = verificarReglas(codigo, reglas)
        if (fallo) {
          setReglasAlert(fallo)
          setResultadoTerminal('❌ Verificación de reglas fallida: el código no cumple todos los requisitos.')
          submissionLock.current = false
          setEvaluating(false)
          return
        }
      }

      setResultadoTerminal('✅ Reglas verificadas. Comparando código con la solución base...\n')

      // 4. Validate output structually — show preview dialog
      const baseCodeInfo = practica?.codigo_base || ""
      const normalizadoEstudiante = normalizarCodigo(codigo)
      const normalizadoBase = normalizarCodigo(baseCodeInfo)
      
      const esCorrecto = normalizadoEstudiante === normalizadoBase

      if (esCorrecto) {
        setResultadoTerminal((prev) => prev + '✅ Código correcto estructuralmente. Confirma tu entrega.\n')
      } else {
        setResultadoTerminal((prev) => prev + '❌ El código no coincide con la estructura esperada.\n')
      }

      setPreviewAlert({ actual: codigo, esperado: baseCodeInfo, esCorrecto })
      
    } catch (err: unknown) {
      console.error('Error evaluando:', err)
      setResultadoTerminal((prev) => prev + "\nError interno del servidor/navegador.")
    } finally {
      setEvaluating(false)
      submissionLock.current = false // Liberamos el candado para permitir reintentos
    }
  }

  const confirmarEntrega = async () => {
    if (submissionLock.current) return
    submissionLock.current = true
    setEvaluating(true)
    
    try {
      if (estudianteId) {
        const notaToSend = (practica?.configuracion?.asistencia === true) ? 100 : null

        const { data: nuevaEntrega, error: insertError } = await supabase
          .from('entregas')
          .insert({
            practica_id: practicaId,
            estudiante_id: estudianteId,
            codigo: codigo,
            nota: notaToSend
          })
          .select()
          .single()

        if (insertError) throw insertError
        setEntrega(nuevaEntrega || { nota: notaToSend, codigo, fecha_entrega: new Date().toISOString() })

        cacheClear(`entregas_${estudianteId}`)

        if (practica?.configuracion?.asistencia) {
          const nowInstance = new Date()
          const fechaStr = nowInstance.toISOString().split('T')[0]
          const horaStr = `${String(nowInstance.getHours()).padStart(2, '0')}:${String(nowInstance.getMinutes()).padStart(2, '0')}`
          
          const { error: attendanceError } = await supabase.from('asistencias').insert([{
            estudiante_id: estudianteId,
            fecha: fechaStr,
            hora: horaStr,
            estado: 'presente'
          }])
          
          if (attendanceError) {
            console.error('Error al registrar asistencia:', attendanceError)
            setResultadoTerminal((prev) => prev + `\n❌ Error al registrar asistencia: ${attendanceError.message}`)
          } else {
            setResultadoTerminal((prev) => prev + "\n✅ Asistencia registrada automáticamente.")
          }
        }
      } else {
        setEntrega({
          id: 'preview',
          practica_id: practicaId,
          estudiante_id: 'auxiliar',
          codigo,
          nota: 100,
          fecha_entrega: new Date().toISOString()
        } as unknown as EntregaRow)
      }
      setPreviewAlert(null)
      
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
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground animate-pulse">Cargando práctica...</p>
        </div>
      </div>
    )
  }

  if (!practica) return null

  const esModoLectura = !!entrega

  return (
    <div className="bg-background">
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 flex space-x-4 items-center">
          <Button variant="outline" onClick={() => router.push('/practicas')}>
            &larr; Volver
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Resolución: {practica.nombre}</h1>
        </div>

        <div className={esModoLectura ? "flex flex-col gap-6" : "grid lg:grid-cols-3 gap-6"}>
          {/* Columna Izquierda: Instrucciones */}
          <div className="space-y-6">
            {/* Grade Result Card - shown after submission */}
            {entrega && (
              <div className={`rounded-2xl p-5 border-2 shadow-md ${
                entrega.nota !== null && entrega.nota >= 80
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700'
                  : entrega.nota !== null && entrega.nota >= 50
                  ? 'bg-yellow-50 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-700'
                  : entrega.nota === null
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {entrega.nota === null ? (
                    <Clock className="w-8 h-8 text-blue-500" />
                  ) : entrega.nota >= 80 ? (
                    <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="w-8 h-8 text-red-500" />
                  )}
                  <div>
                    <p className="font-bold text-sm text-muted-foreground">Resultado de tu entrega</p>
                    <p className="text-sm font-medium">
                      {entrega.nota === null 
                        ? '⏳ Práctica en revisión' 
                        : (practica?.configuracion?.asistencia ? 'Práctica como asistencia' : 'Práctica calificada')}
                    </p>
                  </div>
                </div>
                <div className="text-center py-2">

                  <span className={`text-4xl font-black ${
                    entrega.nota === null ? 'text-blue-600 dark:text-blue-400'
                    : entrega.nota >= 80 ? 'text-emerald-600 dark:text-emerald-400'
                    : entrega.nota >= 50 ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
                  }`}>
                    ASISTENCIA REGISTRADA
                  </span>
                  

                </div>
                {practica?.configuracion?.asistencia && (
                  <div className="mt-2 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                    Práctica como asistencia
                  </div>
                )}
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Enviado el {new Date(entrega.fecha_entrega).toLocaleString('es-ES')}
                </p>
              </div>
            )}

            {!esModoLectura && (
            <Card>
        <CardHeader className="pb-4">
          <CardTitle>Instrucciones de la Práctica</CardTitle>
          {/* Deadline badge */}
          {practica.fecha_limite && (
            <div className={`mt-2 flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border ${
              isExpired
                ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                : 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'
            }`}>
              {isExpired
                ? <><XCircle className="w-4 h-4 shrink-0" /> Plazo vencido — no se puede entregar</>
                : <><Clock className="w-4 h-4 shrink-0" /> Fecha límite: {new Date(practica.fecha_limite).toLocaleString('es-ES')}</>}
            </div>
          )}

          {/* Attendance indicator */}
          {practica.configuracion?.asistencia && (
            <div className="mt-2 flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
              <CheckCircle className="w-4 h-4 shrink-0" /> Esta práctica cuenta como <strong>Asistencia</strong>
            </div>
          )}
          {/* Verification rules summary */}
          {practica.configuracion?.verificaciones && practica.configuracion.verificaciones.length > 0 && (
            <div className="mt-2 bg-muted/60 border border-border rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Requisitos del código</p>
              <ul className="space-y-1">
                {practica.configuracion.verificaciones.map((r, i) => (
                  <li key={i} className="text-xs flex items-start gap-1.5">
                    <CheckCircle className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                    {r.mensaje}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm mb-1">Descripción:</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {practica.descripcion}
                  </p>
                </div>
                
                {/* <div>
                  <h3 className="font-semibold text-sm mb-1">El resultado exacto de la consola debe ser:</h3>
                  <pre className="bg-muted p-3 rounded-md border font-mono text-sm whitespace-pre-wrap">
                    {practica.resultado_esperado}
                  </pre>
                </div> */}
              </CardContent>
            </Card>
            )}

            
          </div>

          {/* Editores de Código */}
          <div className={esModoLectura ? "grid lg:grid-cols-1 gap-6" : "col-span-2"}>
          <Card className={`flex flex-col transition-all duration-300 bg-card ${
            isFullscreen && !esModoLectura
              ? "fixed inset-0 z-50 w-screen h-screen rounded-none border-0" 
              : "h-[75vh] min-h-[600px] overflow-hidden"
          }`}>
            <CardHeader className="pb-3 border-b shrink-0 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">{esModoLectura ? "Tu Código Enviado" : "Editor de Código (Python)"}</CardTitle>
              <div className="flex items-center space-x-3">
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
            </CardContent>
            <CardFooter className="pt-3 border-t bg-muted/30 flex space-x-3 shrink-0">
              <Button 
                className={"w-full"} 
                onClick={evaluarYEnviar}
                disabled={esModoLectura || evaluating || !codigo.trim()}
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
        </div>

        <AlertDialog open={!!alertMessage} onOpenChange={(open) => !open && setAlertMessage(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Acción Denegada</AlertDialogTitle>
              <AlertDialogDescription>{alertMessage}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setAlertMessage(null)}>Entendido</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!previewAlert} onOpenChange={(open) => !open && setPreviewAlert(null)}>
          <AlertDialogContent className="w-[95vw] min-w-[70vw] max-w-5xl max-h-[90vh] flex flex-col p-4 md:p-6 overflow-hidden">
            <AlertDialogHeader className="shrink-0 mb-2">
              <AlertDialogTitle className={`flex items-center gap-2 ${previewAlert?.esCorrecto ? "text-emerald-600" : "text-destructive"}`}>
                {previewAlert?.esCorrecto ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />} 
                {previewAlert?.esCorrecto ? "¡Todo se ve bien!" : "Resultado incorrecto"}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-sm">
                  {previewAlert?.esCorrecto 
                    ? <p>Tu código coincide con la estructura de la solución esperada. ¿Deseas entregar la práctica?</p>
                    : <p>La estructura de tu programa <strong>no coincide</strong> con el código base. Corrije tu código e inténtalo de nuevo.</p>
                  }
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid md:grid-cols-2 gap-4 mt-3 p-3 bg-muted/20 border rounded-xl overflow-y-auto max-h-[60vh] ">
              <div className="flex flex-col h-full min-h-[150px]">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide shrink-0">Tu código enviado</p>
                <pre className={`flex-1 p-3 rounded-lg font-mono text-xs whitespace-pre-wrap break-all border ${previewAlert?.esCorrecto ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"}`}>{previewAlert?.actual}</pre>
              </div>
              <div className="flex flex-col h-full min-h-[150px]">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide shrink-0">Solución (Código Base)</p>
                <pre className="flex-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 p-3 rounded-lg font-mono text-xs whitespace-pre-wrap break-all">{previewAlert?.esperado}</pre>
              </div>
            </div>
            <AlertDialogFooter className="shrink-0 mt-4 md:mt-6">
              <AlertDialogCancel onClick={() => setPreviewAlert(null)}>
                {previewAlert?.esCorrecto ? "Cancelar" : "Entendido, seguir intentando"}
              </AlertDialogCancel>
              {previewAlert?.esCorrecto && (
                <AlertDialogAction onClick={confirmarEntrega} disabled={evaluating} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {evaluating ? "Entregando..." : "Entregar Práctica"}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Code Rules Blocking Dialog */}
        <AlertDialog open={!!reglasAlert} onOpenChange={(open) => !open && setReglasAlert(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <AlertTriangle className="w-5 h-5" /> Reglas de programación no cumplidas
              </AlertDialogTitle>
              <AlertDialogDescription>
                <span className="block mb-2 text-foreground">
                  Tu código no cumple con uno de los requisitos estructurales definidos por el docente para esta práctica:
                </span>
                <span className="block p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-400 font-medium rounded-md">
                  {reglasAlert}
                </span>
                <span className="block mt-3 text-xs">
                  Asegúrate de revisar las Instrucciones de la Práctica (panel izquierdo) y adapta tu código antes de intentar entregarlo nuevamente.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => setReglasAlert(null)}>Entendido</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </main>
    </div>
  )
}
