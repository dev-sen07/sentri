"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, EstudianteRow } from "@/lib/supabase";
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
} from "lucide-react";

const TOTAL_CLASES = 16;
const PUNTOS_MAXIMOS = 10;

export default function MiPerfilPage() {
  const router = useRouter();
  const [estudiante, setEstudiante] = useState<EstudianteRow | null>(null);
  const [loading, setLoading] = useState(true);

  // Attendance stats
  const [asistenciasPresente, setAsistenciasPresente] = useState(0);
  const [loadingAsistencias, setLoadingAsistencias] = useState(true);

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

        if (!roleData || roleData.rol !== "estudiante") {
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

          // Fetch attendance count
          const { data: asistenciasData } = await supabase
            .from("asistencias")
            .select("id, estado")
            .eq("estudiante_id", estudianteData.id);

          if (asistenciasData) {
            const presentes = asistenciasData.filter(
              (a) => a.estado === "presente",
            ).length;
            setAsistenciasPresente(presentes);
          }
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
        setLoadingAsistencias(false);
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
      const { data: { session } } = await supabase.auth.getSession();
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

  // Grade calculation: (presentes / 16) * 10, max 10
  const notaAsistencia = Math.min(
    (asistenciasPresente / TOTAL_CLASES) * PUNTOS_MAXIMOS,
    PUNTOS_MAXIMOS,
  );
  const notaFormateada = notaAsistencia.toFixed(2);
  const porcentajeAsistencia = Math.min(
    (asistenciasPresente / TOTAL_CLASES) * 100,
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
          {/* Main Info Card */}
          <Card className="lg:col-span-2 border-border shadow-sm">
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
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            {/* Academic Info Card */}
            <Card className="bg-gradient-to-br from-primary/5 to-muted border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Información Académica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-background p-4 rounded-xl shadow-sm border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Materia</p>
                  <p className="font-semibold text-foreground">
                    Programación II
                  </p>
                </div>
                <div className="bg-background p-4 rounded-xl shadow-sm border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">
                    Grupo Asignado
                  </p>
                  <p className="font-semibold text-foreground flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Paralelo {estudiante.paralelo}
                  </p>
                </div>
                {/* Attendance Grade Card */}
                <Card className="border-border shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-primary" />
                      Nota Actual
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loadingAsistencias ? (
                      <div className="h-16 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <>
                        {/* Big score */}
                        <div className="text-center py-2">
                          <span
                            className={`text-5xl font-black tabular-nums ${getNotaColor()}`}
                          >
                            {notaFormateada}
                          </span>
                          <span className="text-xl font-semibold text-muted-foreground">
                            {" "}
                            / 10
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                            <span>Progreso de asistencia</span>
                            <span>{porcentajeAsistencia.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-2.5 rounded-full transition-all duration-700 ${getBarColor()}`}
                              style={{ width: `${porcentajeAsistencia}%` }}
                            />
                          </div>
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center justify-between pt-1 border-t">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Users className="w-4 h-4" />
                            <span>Asistencias</span>
                          </div>
                          <div className="flex items-center gap-1 font-semibold text-sm">
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {asistenciasPresente}
                            </span>
                            <span className="text-muted-foreground">
                              / {TOTAL_CLASES}
                            </span>
                          </div>
                        </div>

                        {asistenciasPresente >= TOTAL_CLASES && (
                          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2 rounded-lg">
                            <CheckCircle className="w-4 h-4 shrink-0" />
                            ¡Asistencia completa! Tienes los 10 puntos.
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
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
              Ingresa tu contraseña actual y la nueva contraseña. Deberá tener al menos 6 caracteres.
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
