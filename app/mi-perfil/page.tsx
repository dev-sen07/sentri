"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, EstudianteRow, VistaCalificacionesRow } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Mail,
  Hash,
  BookOpen,
  GraduationCap,
  Info,
  Tag,
  Lock,
  CheckCircle,
  Users,
  BarChart3,
  Star,
  Sparkles,
  Activity,
  FileUp,
} from "lucide-react";

export default function MiPerfilPage() {
  const router = useRouter();
  const [estudiante, setEstudiante] = useState<EstudianteRow | null>(null);
  const [loading, setLoading] = useState(true);

  // Calificaciones desde la vista SQL (una sola query)
  const [calificacion, setCalificacion] = useState<VistaCalificacionesRow | null>(null);
  const [loadingNotas, setLoadingNotas] = useState(true);

  // Detalle de presentaciones (para el desglose individual)
  const [presentacionesRevisadas, setPresentacionesRevisadas] = useState<{titulo: string; nota: number; ponderacion: number}[]>([]);

  // Change password dialog
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        const { data: roleData } = await supabase
          .from("usuarios_roles")
          .select("rol")
          .eq("user_id", session.user.id)
          .single();

        if (
          !roleData ||
          (roleData.rol !== "estudiante" && roleData.rol !== "delegado")
        ) {
          router.push("/dashboard");
          return;
        }

        const { data: estudianteData } = await supabase
          .from("estudiantes")
          .select("*")
          .eq("user_id", session.user.id)
          .single();

        if (estudianteData) {
          setEstudiante(estudianteData);

          // 1 query: obtener calificaciones consolidadas desde la vista SQL
          const { data: calificacionData } = await supabase
            .from("vista_calificaciones")
            .select("*")
            .eq("estudiante_id", estudianteData.id)
            .single();

          if (calificacionData) {
            setCalificacion(calificacionData);
          }

          // Query de detalle de presentaciones (para mostrar desglose individual)
          const { data: entregasData } = await supabase
            .from("presentaciones_entregas")
            .select("nota, tarea_id")
            .eq("estudiante_id", estudianteData.id)
            .eq("estado", "revisado");

          if (entregasData && entregasData.length > 0) {
            const tareaIds = entregasData.map((e) => e.tarea_id);
            const { data: tareasData } = await supabase
              .from("presentaciones_tareas")
              .select("id, titulo, ponderacion")
              .in("id", tareaIds);

            if (tareasData) {
              const detalles = entregasData.map((e) => {
                const t = tareasData.find((t) => t.id === e.tarea_id);
                return {
                  titulo: t?.titulo || "Tarea",
                  nota: Number(e.nota) || 0,
                  ponderacion: Number(t?.ponderacion) || 0,
                };
              });
              setPresentacionesRevisadas(detalles);
            }
          }
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
        setLoadingNotas(false);
      }
    };
    checkAuthAndFetchData();
  }, [router]);

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Por favor, completa todos los campos.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas nuevas no coinciden.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setPasswordLoading(true);
    try {
      // Validar contraseña actual
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        setPasswordError("No se pudo obtener la sesión actual.");
        setPasswordLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError("La contraseña actual es incorrecta.");
        setPasswordLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordError("Ocurrió un error inesperado.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleClosePasswordDialog = () => {
    setPasswordDialogOpen(false);
    setPasswordError(null);
    setPasswordSuccess(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground animate-pulse">
            Cargando tu perfil...
          </p>
        </div>
      </div>
    );
  }

  if (!estudiante) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-lg">
          No se encontraron datos del estudiante
        </p>
      </div>
    );
  }

  const getInitials = (nombre: string, apellido: string) =>
    `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();

  // Valores de la vista SQL (o defaults si aún no carga)
  const notaAsistencia = calificacion?.nota_asistencia ?? 0;
  const asistenciasPresente = calificacion?.asistencias_presente ?? 0;
  const totalClases = calificacion?.total_clases ?? 10;
  const puntosExtra = calificacion?.puntos_extra ?? 0;
  const puntosActividades = calificacion?.puntos_actividades ?? 0;
  const puntosPresentaciones = calificacion?.puntos_presentaciones ?? 0;
  const notaFinal = calificacion?.nota_final ?? 0;

  const notaFormateada = notaAsistencia.toFixed(2);
  const porcentajeAsistencia = Math.min(
    (asistenciasPresente / totalClases) * 100,
    100,
  );

  const getNotaColor = () => {
    if (notaAsistencia >= 9) return "text-emerald-600 dark:text-emerald-400";
    if (notaAsistencia >= 7) return "text-blue-600 dark:text-blue-400";
    if (notaAsistencia >= 5) return "text-yellow-600 dark:text-yellow-400";
    return "text-purple-600 dark:text-purple-400";
  };

  const getBarColor = () => {
    if (notaAsistencia >= 9) return "bg-emerald-500";
    if (notaAsistencia >= 7) return "bg-blue-500";
    if (notaAsistencia >= 5) return "bg-yellow-500";
    return "bg-purple-500";
  };

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

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            {/* Main Info Card */}
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-3xl font-bold">
                      {estudiante.nombre} {estudiante.apellido}
                    </CardTitle>
                    <CardDescription className="text-base mt-1 flex items-center gap-2">
                      <Mail className="w-4 h-4" /> {estudiante.correo}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 items-start sm:items-end">
                    {/* Paralelo Badge */}
                    <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full border border-primary/20 shrink-0">
                      <BookOpen className="w-5 h-5" />
                      <span className="font-semibold text-lg">
                        Paralelo {estudiante.paralelo}
                      </span>
                    </div>
                    {/* Change Password Button */}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-2 hover:bg-amber-500 bg-amber-400 text-amber-900 p-5 cursor-pointer"
                      onClick={() => setPasswordDialogOpen(true)}
                    >
                      <Lock className="w-4 h-4" />
                      Cambiar Contraseña
                    </Button>
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
                      <p className="text-sm font-medium text-muted-foreground">
                        Cédula de Identidad
                      </p>
                      <p className="text-lg font-semibold mt-1">
                        {estudiante.ci}
                      </p>
                    </div>
                  </div>

                  {/* RU */}
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-muted rounded-xl text-muted-foreground shrink-0">
                      <Hash className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Registro Único (RU)
                      </p>
                      <p className="text-lg font-semibold mt-1">
                        {estudiante.ru}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t flex items-center gap-4">
                    <div className="p-3 bg-gray-300 dark:bg-gray-900/30 rounded-xl text-gray-700 dark:text-gray-400 shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Materia
                      </p>
                      <p className="text-sm font-bold mt-0.5 tracking-widest text-gray-700 dark:text-gray-400 font-mono border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/20 inline-block px-3 py-1 rounded-lg">
                        PROGRAMACION II
                      </p>
                    </div>
                  </div>
                  {/* Código destacado */}
                  {estudiante.codigo && (
                    <div className="mt-4 pt-4 border-t flex items-center gap-4">
                      <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl text-yellow-700 dark:text-yellow-400 shrink-0">
                        <Tag className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Código de Estudiante
                        </p>
                        <p className="text-2xl font-bold mt-0.5 tracking-widest text-yellow-700 dark:text-yellow-400 font-mono border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 inline-block px-3 py-1 rounded-lg">
                          {estudiante.codigo}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Desglose de Notas */}
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-xl flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Desglose de Notas
                </CardTitle>
                <CardDescription>
                  Detalle de tus puntos acumulados por asistencia y actividades.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Asistencias Section */}
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    Nota de Asistencia
                    <span
                      className={`ml-auto text-xl font-bold ${getNotaColor()}`}
                    >
                      {notaFormateada} pts
                    </span>
                  </h3>
                  {loadingNotas ? (
                    <div className="h-10 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                          <span>Progreso de clases asistidas</span>
                          <span>
                            {asistenciasPresente} / {totalClases} (
                            {porcentajeAsistencia.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-700 ${getBarColor()}`}
                            style={{ width: `${porcentajeAsistencia}%` }}
                          />
                        </div>
                      </div>
                      {asistenciasPresente >= totalClases && (
                        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2 rounded-lg">
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          ¡Asistencia completa! Tienes los 10 puntos de
                          asistencia.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t"></div>

                {/* Extras Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      Puntos Extra
                    </h3>
                    {!loadingNotas && (
                      <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 px-3 py-1 rounded-full text-sm font-bold border border-amber-200 dark:border-amber-800">
                        +{(puntosExtra + puntosActividades).toFixed(2)} pts totales
                      </span>
                    )}
                  </div>
                  {loadingNotas ? (
                    <div className="h-10 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="bg-background p-3 rounded-xl border border-border/40 text-center flex items-center justify-between px-4">
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 focus:outline-none">
                          <Sparkles className="w-4 h-4" /> Puntos Directos
                        </p>
                        <p className="font-bold text-lg text-amber-600 dark:text-amber-400">
                          +{puntosExtra}
                        </p>
                      </div>
                      <div className="bg-background p-3 rounded-xl border border-border/40 text-center flex items-center justify-between px-4">
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Activity className="w-4 h-4" /> Actividades
                        </p>
                        <p className="font-bold text-lg text-amber-600 dark:text-amber-400">
                          +{puntosActividades}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t"></div>

                {/* Presentaciones Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <FileUp className="w-4 h-4 text-teal-500" />
                      Presentaciones
                    </h3>
                    {!loadingNotas && (
                      <span className="bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-400 px-3 py-1 rounded-full text-sm font-bold border border-teal-200 dark:border-teal-800">
                        +{puntosPresentaciones} pts
                      </span>
                    )}
                  </div>
                  {loadingNotas ? (
                    <div className="h-10 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    </div>
                  ) : presentacionesRevisadas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin presentaciones revisadas aún.</p>
                  ) : (
                    <div className="space-y-2">
                      {presentacionesRevisadas.map((p, i) => (
                        <div key={i} className="bg-background p-3 rounded-xl border border-border/40 flex items-center justify-between">
                          <p className="text-sm text-muted-foreground truncate">{p.titulo}</p>
                          <p className="font-bold text-teal-600 dark:text-teal-400 shrink-0 ml-4">
                            +{p.nota}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            {/* Global Grade Card */}

            {/* Academic Info Card */}

            <Card className="bg-gradient-to-br from-primary/5 to-muted border-primary/20 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Star className="w-6 h-6 text-primary fill-primary/20" />
                  Nota Global
                </CardTitle>
                <CardDescription>
                  Suma total de tu rendimiento actual
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingNotas ? (
                  <div className="h-24 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <span className="text-6xl font-black tabular-nums text-foreground">
                      {notaFinal.toFixed(2)}
                    </span>
                    <span className="text-lg font-semibold text-muted-foreground block mt-1">
                      Puntos Acumulados
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* ── Change Password AlertDialog ── */}
      <AlertDialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleClosePasswordDialog();
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Cambiar Contraseña
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ingresa tu contraseña actual y la nueva contraseña. Deberá tener
              al menos 6 caracteres.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {passwordSuccess ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <p className="text-center font-semibold text-emerald-600 dark:text-emerald-400">
                ¡Contraseña actualizada correctamente!
              </p>
              <p className="text-sm text-center text-muted-foreground">
                Tu contraseña ha sido cambiada. Usa la nueva contraseña la
                próxima vez que inicies sesión.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Contraseña actual</Label>
                <Input
                  id="current-password"
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={passwordLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Nueva contraseña</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={passwordLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">
                  Confirmar nueva contraseña
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={passwordLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleChangePassword();
                  }}
                />
              </div>
              {passwordError && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg">
                  {passwordError}
                </p>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleClosePasswordDialog}
              disabled={passwordLoading}
            >
              {passwordSuccess ? "Cerrar" : "Cancelar"}
            </AlertDialogCancel>
            {!passwordSuccess && (
              <Button
                onClick={handleChangePassword}
                disabled={passwordLoading}
                className="bg-primary hover:bg-primary/90"
              >
                {passwordLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Cambiando...
                  </span>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Cambiar Contraseña
                  </>
                )}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
