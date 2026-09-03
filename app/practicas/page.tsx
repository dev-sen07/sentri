"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, PracticaRow } from "@/lib/supabase";
import { cacheGet, cacheSet } from "@/lib/cache";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
// Tabs: using custom underline style (see marcar-asistencia pattern)
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen,
  ClipboardCheck,
  Plus,
  Star,
  Clock,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
interface PracticaWithEstado extends PracticaRow {
  entrega?: { nota: number; fecha_entrega: string };
}

interface EntregaRevision {
  id: string;
  practica_id: string;
  estudiante_id: string;
  codigo: string;
  nota: number | null;
  fecha_entrega: string;
  estudiantes?: { nombre: string; apellido: string; ci: string } | null;
  practicas?: { nombre: string } | null;
}

export function PracticasContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUserAuxiliar, setIsUserAuxiliar] = useState(false);
  const [errorDialog, setErrorDialog] = useState<string | null>(null);
  const [practicas, setPracticas] = useState<PracticaWithEstado[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [entregasAll, setEntregasAll] = useState<EntregaRevision[]>([]);
  const [gradingEntrega, setGradingEntrega] = useState<EntregaRevision | null>(
    null,
  );
  const [newNota, setNewNota] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    resultado_esperado: "",
    codigo_base: "",
    paralelos: [] as string[],
    fecha_limite: "",
    configuracion_json: "", // raw JSON string for the textarea
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [auxTab, setAuxTab] = useState<'ver' | 'revisar'>('ver');

  // Cache keys (per paralelo, resolved after first fetch)
  const [estudianteParalelo, setEstudianteParalelo] = useState<string>("");
  const [estudianteId, setEstudianteIdState] = useState<string>("");

  const fetchAllData = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const { data: roleData } = await supabase
        .from("usuarios_roles")
        .select("rol")
        .eq("user_id", session.user.id)
        .single();
      const isAuxiliar = roleData?.rol === "auxiliar";
      setIsUserAuxiliar(isAuxiliar);

      if (!isAuxiliar) {
        // ── Student path: use cache ─────────────────────────────
        let estId = estudianteId;
        let estParalelo = estudianteParalelo;

        // Only fetch student profile once, then reuse
        if (!estId || !estParalelo) {
          const cached = cacheGet<{ id: string; paralelo: string }>("mi_perfil_basico");
          if (cached && !forceRefresh) {
            estId = cached.id;
            estParalelo = cached.paralelo;
          } else {
            const { data: userData } = await supabase
              .from("estudiantes")
              .select("id, paralelo")
              .eq("user_id", session.user.id)
              .single();
            if (!userData) { router.push("/dashboard"); return; }
            estId = userData.id;
            estParalelo = userData.paralelo;
            cacheSet("mi_perfil_basico", { id: estId, paralelo: estParalelo }, 30 * 60 * 1000);
          }
          setEstudianteIdState(estId);
          setEstudianteParalelo(estParalelo);
        }

        // Practicas for this paralelo
        const practicasCacheKey = `practicas_paralelo_${estParalelo}`;
        let practicasData: PracticaRow[] | null = forceRefresh
          ? null
          : cacheGet<PracticaRow[]>(practicasCacheKey);

        if (!practicasData) {
          const { data, error } = await supabase
            .from("practicas")
            .select("*")
            .eq("paralelo", estParalelo)
            .order("creado_en", { ascending: false });
          if (error) throw error;
          practicasData = data || [];
          cacheSet(practicasCacheKey, practicasData, 5 * 60 * 1000);
        }

        // Entregas for this student
        const entregasCacheKey = `entregas_${estId}`;
        let entregasRaw: { practica_id: string; nota: number; fecha_entrega: string }[] | null =
          forceRefresh ? null : cacheGet(entregasCacheKey);

        if (!entregasRaw) {
          const { data: entregasData, error: entregasError } = await supabase
            .from("entregas")
            .select("practica_id, nota, fecha_entrega")
            .eq("estudiante_id", estId);
          if (!entregasError && entregasData) {
            entregasRaw = entregasData;
            cacheSet(entregasCacheKey, entregasRaw, 2 * 60 * 1000);
          } else {
            entregasRaw = [];
          }
        }

        const entregasMap = new Map(entregasRaw.map((e) => [e.practica_id, e]));
        setPracticas(
          practicasData.map((p) => ({
            ...p,
            entrega: entregasMap.get(p.id) as { nota: number; fecha_entrega: string } | undefined,
          }))
        );

      } else {
        // ── Auxiliar path: always fresh (managing data, no cache needed) ─
        const { data: entregasRevisar, error: entregasError } = await supabase
          .from("entregas")
          .select(`*, estudiantes(nombre, apellido, ci), practicas(nombre)`)
          .order("fecha_entrega", { ascending: false });
        if (!entregasError && entregasRevisar) {
          const mapped = entregasRevisar.map((e) => ({
            ...e,
            estudiantes: Array.isArray(e.estudiantes) ? e.estudiantes[0] : e.estudiantes,
            practicas: Array.isArray(e.practicas) ? e.practicas[0] : e.practicas,
          }));
          setEntregasAll(mapped as any);
        }

        const { data: practicasData, error: practicasError } = await supabase
          .from("practicas")
          .select("*")
          .order("creado_en", { ascending: false });
        if (practicasError) throw practicasError;
        setPracticas((practicasData || []).map((p) => ({ ...p })));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, estudianteId, estudianteParalelo]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const executeDelete = async () => {
    if (!deleteId) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from("practicas")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;
      setPracticas((prev) => prev.filter((p) => p.id !== deleteId));
    } catch (error: any) {
      setErrorDialog("Error al eliminar: " + error.message);
    } finally {
      setDeleteId(null);
      setLoading(false);
    }
  };

  const openEditDialog = (practicaId: string) => {
    const pract = practicas.find((p) => p.id === practicaId);
    if (pract) {
      setFormData({
        nombre: pract.nombre,
        descripcion: pract.descripcion,
        resultado_esperado: pract.resultado_esperado,
        codigo_base: pract.codigo_base || "",
        paralelos: [pract.paralelo], // Editing only updates the specific copy
        fecha_limite: pract.fecha_limite
          ? new Date(pract.fecha_limite).toISOString().slice(0, 16)
          : "",
        configuracion_json: pract.configuracion
          ? JSON.stringify(pract.configuracion, null, 2)
          : "",
      });
      setEditId(pract.id);
      setFormError(null);
      setConfigError(null);
      setFormOpen(true);
    }
  };

  const openCreateDialog = () => {
    setFormData({
      nombre: "",
      descripcion: "",
      resultado_esperado: "",
      codigo_base: "",
      paralelos: ["A"], // Default checked
      fecha_limite: "",
      configuracion_json: JSON.stringify({
        verificaciones: [
          { tipo: "contiene_funcion", valor: "mi_funcion", mensaje: "Debes definir una función llamada mi_funcion()" }
        ],
        asistencia: true,
      }, null, 2),
    });
    setEditId(null);
    setFormError(null);
    setConfigError(null);
    setFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setConfigError(null);
    try {
      if (!formData.nombre || !formData.descripcion || !formData.resultado_esperado || !formData.codigo_base)
        throw new Error("Todos los campos requeridos deben estar completos");

      // Parse JSON config if provided
      let configuracion = null;
      if (formData.configuracion_json.trim()) {
        try {
          configuracion = JSON.parse(formData.configuracion_json);
          if (!configuracion.verificaciones || !Array.isArray(configuracion.verificaciones))
            throw new Error('El JSON debe tener una propiedad "verificaciones" que sea un array.');
        } catch (jsonErr) {
          setConfigError('JSON inválido: ' + (jsonErr instanceof Error ? jsonErr.message : String(jsonErr)));
          setFormLoading(false);
          return;
        }
      }

      if (formData.paralelos.length === 0)
        throw new Error("Debes seleccionar al menos un paralelo.");

      if (editId) {
        // Editing always edits just the 1 selected copy
        const payload = {
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          resultado_esperado: formData.resultado_esperado,
          codigo_base: formData.codigo_base,
          paralelo: formData.paralelos[0] || "A",
          fecha_limite: formData.fecha_limite ? new Date(formData.fecha_limite).toISOString() : null,
          configuracion: configuracion,
        };
        const { error } = await supabase.from("practicas").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        // Creating assigns to multiple paralelos at once (creates duplicated rows)
        const payloads = formData.paralelos.map((pID) => ({
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          resultado_esperado: formData.resultado_esperado,
          codigo_base: formData.codigo_base,
          paralelo: pID,
          fecha_limite: formData.fecha_limite ? new Date(formData.fecha_limite).toISOString() : null,
          configuracion: configuracion,
        }))
        const { error } = await supabase.from("practicas").insert(payloads);
        if (error) throw error;
      }
      setFormOpen(false);
      fetchAllData(true);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setFormLoading(false);
    }
  };

  const handleGradeSubmit = async () => {
    if (!gradingEntrega) return;
    const notaNum = parseInt(newNota);
    if (isNaN(notaNum) || notaNum < 0 || notaNum > 100) {
      setErrorDialog("La nota debe ser entre 0 y 100");
      return;
    }
    try {
      const { error } = await supabase
        .from("entregas")
        .update({ nota: notaNum })
        .eq("id", gradingEntrega.id);
      if (error) throw error;
      setEntregasAll((prev) =>
        prev.map((e) =>
          e.id === gradingEntrega.id ? { ...e, nota: notaNum } : e,
        ),
      );
      setGradingEntrega(null);
      setNewNota("");
    } catch (err: any) {
      setErrorDialog("Error al calificar: " + err.message);
    }
  };

  const getNotaColor = (nota: number | null) => {
    if (nota === null) return "text-muted-foreground";
    if (nota >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (nota >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  if (loading && practicas.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground animate-pulse">Cargando...</p>
        </div>
      </div>
    );
  }

  const renderPracticasGrid = () => (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {practicas.length} práctica(s){!isUserAuxiliar && " disponibles para tu paralelo"}
        </p>
        <div className="flex items-center gap-2">
          {!isUserAuxiliar && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={refreshing}
              onClick={() => fetchAllData(true)}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Actualizando..." : "Actualizar"}
            </Button>
          )}
          {isUserAuxiliar && (
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="w-4 h-4" /> Crear Práctica
            </Button>
          )}
        </div>
      </div>

      {practicas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-muted-foreground">
              No hay prácticas disponibles en este momento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {practicas.map((practica) => (
            <Card
              key={practica.id}
              className={`flex flex-col transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group ${practica.entrega ? "border-emerald-200/60 dark:border-emerald-800/60" : ""}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">
                    {practica.nombre}
                  </CardTitle>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-primary/10 text-primary rounded-full shrink-0 border border-primary/20">
                    Paralelo {practica.paralelo}
                  </span>
                </div>
                <CardDescription className="flex items-center gap-1.5 text-xs">
                  <Clock className="w-3 h-3" />
                  {new Date(practica.creado_en).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="line-clamp-3 text-sm text-muted-foreground leading-relaxed">
                  {practica.descripcion}
                </p>

                {practica.entrega && (
                  <div className={`mt-4 p-3 rounded-xl border text-sm ${
                    practica.entrega.nota === null 
                      ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                      : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                  }`}>
                    <div className={`flex items-center gap-1.5 font-semibold mb-1 ${
                      practica.entrega.nota === null 
                        ? "text-blue-700 dark:text-blue-400"
                        : "text-emerald-700 dark:text-emerald-400"
                    }`}>
                      {practica.entrega.nota === null ? <Clock className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      {practica.entrega.nota === null 
                        ? "En revisión" 
                        : (practica.configuracion?.asistencia ? "Práctica como asistencia" : "Entregada")}
                    </div>
                    
                    {practica.entrega.nota !== null && !practica.configuracion?.asistencia && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">
                          Nota:
                        </span>
                        <span
                          className={`font-bold text-xl ${getNotaColor(practica.entrega.nota)}`}
                        >
                          {practica.entrega.nota ?? "—"}
                          <span className="text-sm font-normal text-muted-foreground">
                            /100
                          </span>
                        </span>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(practica.entrega.fecha_entrega).toLocaleString(
                        "es-ES",
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-2 pt-3 border-t bg-muted/20">
                <Button
                  className="w-full"
                  variant={practica.entrega ? "outline" : "default"}
                  onClick={() => router.push(`/practicas/${practica.id}`)}
                  disabled={!isUserAuxiliar && !!practica.entrega && !!practica.configuracion?.asistencia}
                >
                  {isUserAuxiliar
                    ? "Vista Previa"
                    : practica.entrega
                      ? (practica.configuracion?.asistencia ? "Asistencia registrada" : "Ver mi entrega")
                      : "Resolver Práctica"}
                </Button>
                {isUserAuxiliar && (
                  <div className="flex w-full gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-1/2"
                      onClick={() => openEditDialog(practica.id)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-1/2"
                      onClick={() => setDeleteId(practica.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-background">
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Prácticas</h1>
          </div>
          <p className="text-muted-foreground ml-14">
            {isUserAuxiliar
              ? "Gestiona los ejercicios de Python y revisa las entregas de los estudiantes."
              : "Resuelve los ejercicios de Python asignados a tu paralelo."}
          </p>
        </div>

        {isUserAuxiliar ? (
          <div>
            {/* Tabs */}
            <div className="flex gap-0 border-b border-border mb-6 overflow-x-auto">
              <button
                onClick={() => setAuxTab('ver')}
                className={`px-4 sm:px-5 py-2.5 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 -mb-px shrink-0 ${
                  auxTab === 'ver' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Ver Prácticas</span>
                <span className="sm:hidden">Prácticas</span>
              </button>
              <button
                onClick={() => setAuxTab('revisar')}
                className={`px-4 sm:px-5 py-2.5 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 -mb-px shrink-0 ${
                  auxTab === 'revisar' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Revisar Entregas</span>
                <span className="sm:hidden">Entregas</span>
                {entregasAll.filter((e) => e.nota === null).length > 0 && (
                  <span className="ml-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {entregasAll.filter((e) => e.nota === null).length}
                  </span>
                )}
              </button>
            </div>

            {auxTab === 'ver' && renderPracticasGrid()}

            {auxTab === 'revisar' && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <ClipboardCheck className="w-5 h-5 text-primary" />{" "}
                          Entregas de Estudiantes
                        </CardTitle>
                        <CardDescription>
                          Asigna o modifica las calificaciones a las entregas
                          recibidas.
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <div className="text-center px-4 py-2 bg-muted rounded-xl">
                          <div className="text-2xl font-bold">
                            {entregasAll.length}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total
                          </div>
                        </div>
                        <div className="text-center px-4 py-2 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-800">
                          <div className="text-2xl font-bold text-orange-600">
                            {entregasAll.filter((e) => e.nota === null).length}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Pendientes
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {entregasAll.length === 0 ? (
                      <div className="py-16 text-center">
                        <ClipboardCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
                        <p className="text-muted-foreground">
                          No hay entregas disponibles para revisar.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y border rounded-xl overflow-hidden">
                        {entregasAll.map((entrega) => (
                          <div
                            key={entrega.id}
                            className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                {entrega.estudiantes?.nombre?.charAt(0)}
                                {entrega.estudiantes?.apellido?.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold">
                                  {entrega.estudiantes?.nombre}{" "}
                                  {entrega.estudiantes?.apellido}
                                  <span className="text-xs text-muted-foreground ml-2 font-normal">
                                    CI: {entrega.estudiantes?.ci}
                                  </span>
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Práctica:{" "}
                                  <span className="font-medium text-foreground">
                                    {entrega.practicas?.nombre}
                                  </span>
                                </p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3" />{" "}
                                  {new Date(
                                    entrega.fecha_entrega,
                                  ).toLocaleString("es-ES")}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div className="text-xs text-muted-foreground">
                                  Nota
                                </div>
                                <div
                                  className={`font-bold text-2xl ${getNotaColor(entrega.nota)}`}
                                >
                                  {entrega.nota !== null ? entrega.nota : "—"}
                                  <span className="text-sm font-normal text-muted-foreground">
                                    /100
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <Button
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => {
                                    setNewNota(entrega.nota?.toString() || "");
                                    setGradingEntrega(entrega);
                                  }}
                                >
                                  <Star className="w-3.5 h-3.5" /> Calificar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    router.push(
                                      `/practicas/${entrega.practica_id}?estudiante=${entrega.estudiante_id}`,
                                    )
                                  }
                                >
                                  Ver Código
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
            )}
          </div>
        ) : (
          renderPracticasGrid()
        )}

        {/* Dialog Crear/Editar Práctica */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                {editId ? "Editar Práctica Python" : "Nueva Práctica Python"}
              </DialogTitle>
              <DialogDescription>
                Define qué deben programar los estudiantes y la salida esperada
                en consola.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
              {formError && (
                <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-lg text-sm border border-destructive/20">
                  {formError}
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="nombre" className="text-sm font-medium">
                    Nombre de la Práctica *
                  </label>
                  <Input
                    id="nombre"
                    placeholder="Ej: Hola Mundo en Python"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, nombre: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Paralelos Destino *
                  </label>
                  <div className="flex gap-4 p-3 border rounded-md bg-muted/30">
                    {["A", "B", "C"].map((p) => (
                      <div key={p} className="flex items-center space-x-2">
                        <Checkbox
                          id={`paralelo-${p}`}
                          checked={formData.paralelos.includes(p)}
                          disabled={!!editId && !formData.paralelos.includes(p)} // Can't change parallel in edit mode easily
                          onCheckedChange={(checked: boolean) => {
                            if (editId) return; // Prevent changing parallels when editing
                            setFormData((prev) => ({
                              ...prev,
                              paralelos: checked
                                ? [...prev.paralelos, p]
                                : prev.paralelos.filter((x) => x !== p),
                            }));
                          }}
                        />
                        <label
                          htmlFor={`paralelo-${p}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-foreground block"
                        >
                          <strong>{p}</strong>
                        </label>
                      </div>
                    ))}
                  </div>
                  {editId && (
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Nota: Al editar una práctica, solo estás modificando la copia asignada a este paralelo específico.
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="descripcion" className="text-sm font-medium">
                  Descripción / Texto del Problema *
                </label>
                <Textarea
                  id="descripcion"
                  placeholder="Escribe un programa que imprima 'Hola Mundo'..."
                  rows={4}
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, descripcion: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="resultado_esperado" className="text-sm font-medium">
                  Resultado Esperado (Terminal) *
                </label>
                <Textarea
                  id="resultado_esperado"
                  placeholder="Hola Mundo"
                  rows={2}
                  value={formData.resultado_esperado}
                  onChange={(e) => setFormData((p) => ({ ...p, resultado_esperado: e.target.value }))}
                  className="font-mono bg-muted"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  El código deberá imprimir exactamente este valor con print(). Ojo con espacios y mayúsculas.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="codigo_base" className="text-sm font-medium">
                  Código Base / Solución Exacta *
                </label>
                <Textarea
                  id="codigo_base"
                  placeholder="def funcion():&#10;    print('Hola Mundo')"
                  rows={4}
                  value={formData.codigo_base}
                  onChange={(e) => setFormData((p) => ({ ...p, codigo_base: e.target.value }))}
                  className="font-mono bg-muted"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  El código del estudiante será validado estructuralmente contra este código (ignorando espacios y comentarios).
                </p>
              </div>

              {/* ── Fecha Límite ─── */}
              <div className="space-y-2">
                <label htmlFor="fecha_limite" className="text-sm font-medium flex items-center gap-2">
                  Fecha y hora límite de entrega
                  <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                </label>
                <Input
                  id="fecha_limite"
                  type="datetime-local"
                  value={formData.fecha_limite}
                  onChange={(e) => setFormData((p) => ({ ...p, fecha_limite: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Pasada esta hora, el estudiante no podrá entregar la práctica.
                </p>
              </div>

              {/* ── Verificaciones JSON ─── */}
              <div className="space-y-2">
                <label htmlFor="config_json" className="text-sm font-medium flex items-center gap-2">
                  Reglas de verificación de código
                  <span className="text-xs text-muted-foreground font-normal">(opcional — JSON)</span>
                </label>
                {configError && (
                  <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-lg text-xs border border-destructive/20">
                    {configError}
                  </div>
                )}
                <Textarea
                  id="config_json"
                  rows={8}
                  value={formData.configuracion_json}
                  onChange={(e) => { setFormData((p) => ({ ...p, configuracion_json: e.target.value })); setConfigError(null); }}
                  className="font-mono text-xs bg-muted"
                  placeholder={'\{\n  "verificaciones": [\n    \{ "tipo": "contiene_funcion", "valor": "suma", "mensaje": "Define la función suma()" \},\n    \{ "tipo": "usa_bucle_for", "mensaje": "Usa un bucle for" \}\n  ]\n\}'}
                />
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground transition-colors">Ver tipos disponibles</summary>
                  <div className="mt-2 space-y-1 pl-2 border-l-2 border-border">
                    {([
                      ['contiene_funcion','def nombre()', 'valor requerido'],
                      ['contiene_clase','class Nombre', 'valor requerido'],
                      ['usa_bucle_for','for … in …', ''],
                      ['usa_bucle_while','while …', ''],
                      ['usa_recursion','función que se llama a sí misma', ''],
                      ['contiene_texto','texto literal en el código', 'valor requerido'],
                      ['no_contiene_texto','prohíbe texto', 'valor requerido'],
                    ] as [string,string,string][]).map(([tipo,desc,nota]) => (
                      <p key={tipo}><code className="bg-muted px-1 rounded">{tipo}</code> — {desc}{nota && <span className="text-yellow-600 dark:text-yellow-400"> ({nota})</span>}</p>
                    ))}
                  </div>
                </details>
              </div>

              <Button type="submit" className="w-full" disabled={formLoading}>
                {formLoading ? "Guardando..." : editId ? "Actualizar Práctica" : "Publicar Práctica"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog Calificar */}
        <Dialog
          open={!!gradingEntrega}
          onOpenChange={(open) => !open && setGradingEntrega(null)}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" /> Asignar
                Calificación
              </DialogTitle>
              <DialogDescription>
                {gradingEntrega &&
                  `Calificando a ${gradingEntrega.estudiantes?.nombre} ${gradingEntrega.estudiantes?.apellido}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="nota" className="text-sm font-medium">
                  Nota (0 – 100)
                </label>
                <Input
                  id="nota"
                  type="number"
                  min="0"
                  max="100"
                  value={newNota}
                  onChange={(e) => setNewNota(e.target.value)}
                  placeholder="Ej. 100"
                  className="text-2xl font-bold h-14 text-center"
                />
              </div>
              <Button onClick={handleGradeSubmit} className="w-full gap-2">
                <CheckCircle className="w-4 h-4" /> Guardar Nota
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* AlertDialogs */}
        <AlertDialog
          open={!!deleteId}
          onOpenChange={(open) => !open && setDeleteId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar Práctica?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción es irreversible. Se eliminará la práctica y todas
                sus entregas asociadas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={executeDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={!!errorDialog}
          onOpenChange={(open) => !open && setErrorDialog(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Error</AlertDialogTitle>
              <AlertDialogDescription>{errorDialog}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setErrorDialog(null)}>
                Entendido
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}

export default function PracticasPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/laboratorio?tab=practicas");
  }, [router]);
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}
