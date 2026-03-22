"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, ClaseGrabadaRow } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import {
  Video,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  RefreshCw,
  PlayCircle,
} from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────

function getEmbedUrl(url: string): { type: "embed" | "link"; src: string } {
  try {
    const u = new URL(url);

    // YouTube
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      let videoId = "";
      if (u.hostname.includes("youtu.be")) {
        videoId = u.pathname.slice(1);
      } else {
        videoId = u.searchParams.get("v") || u.pathname.split("/").pop() || "";
      }
      if (videoId) {
        return { type: "embed", src: `https://www.youtube.com/embed/${videoId}` };
      }
    }

    // Google Drive: /file/d/{ID}/view → /file/d/{ID}/preview
    if (u.hostname === "drive.google.com" && u.pathname.includes("/file/d/")) {
      const parts = u.pathname.split("/");
      const idx = parts.indexOf("d");
      if (idx !== -1 && parts[idx + 1]) {
        return {
          type: "embed",
          src: `https://drive.google.com/file/d/${parts[idx + 1]}/preview`,
        };
      }
    }
  } catch {
    // invalid URL
  }
  return { type: "link", src: url };
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ClasesGrabadasPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAuxiliar, setIsAuxiliar] = useState(false);
  const [clases, setClases] = useState<ClaseGrabadaRow[]>([]);
  const [selectedClase, setSelectedClase] = useState<ClaseGrabadaRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ titulo: "", descripcion: "", url_video: "" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ─── fetch ────────────────────────────────────────────────────────────────

  const fetchClases = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: roleData } = await supabase
      .from("usuarios_roles")
      .select("rol")
      .eq("user_id", session.user.id)
      .single();

    setIsAuxiliar(roleData?.rol === "auxiliar");

    const { data } = await supabase
      .from("clases_grabadas")
      .select("*")
      .order("creado_en", { ascending: false });

    setClases((data as ClaseGrabadaRow[]) ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchClases();
      setLoading(false);
    })();
  }, [fetchClases]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchClases();
    setRefreshing(false);
  };

  // ─── form ─────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditId(null);
    setFormData({ titulo: "", descripcion: "", url_video: "" });
    setErrorMsg(null);
    setFormOpen(true);
  };

  const openEdit = (clase: ClaseGrabadaRow) => {
    setEditId(clase.id);
    setFormData({ titulo: clase.titulo, descripcion: clase.descripcion ?? "", url_video: clase.url_video });
    setErrorMsg(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.titulo.trim() || !formData.url_video.trim()) {
      setErrorMsg("El título y la URL del video son obligatorios.");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    const payload = {
      titulo: formData.titulo.trim(),
      descripcion: formData.descripcion.trim() || null,
      url_video: formData.url_video.trim(),
    };

    const { error } = editId
      ? await supabase.from("clases_grabadas").update(payload).eq("id", editId)
      : await supabase.from("clases_grabadas").insert(payload);

    if (error) { setErrorMsg(error.message); setSaving(false); return; }

    setFormOpen(false);
    await fetchClases();
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("clases_grabadas").delete().eq("id", deleteId);
    if (selectedClase?.id === deleteId) setSelectedClase(null);
    setDeleteId(null);
    await fetchClases();
  };

  // ─── loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground animate-pulse">Cargando clases grabadas...</p>
        </div>
      </div>
    );
  }

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Video className="w-6 h-6 text-violet-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Clases Grabadas</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {clases.length} clase{clases.length !== 1 ? "s" : ""} disponible{clases.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            {isAuxiliar && (
              <Button size="sm" onClick={openCreate} className="gap-2">
                <Plus className="w-4 h-4" /> Nueva Clase
              </Button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {clases.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="p-5 rounded-2xl bg-muted/60 border">
              <Video className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="font-semibold text-lg">No hay clases grabadas</p>
            <p className="text-muted-foreground text-sm max-w-sm">
              {isAuxiliar
                ? "Haz clic en \u201cNueva Clase\u201d para agregar el primer video."
                : "Todav\u00eda no hay clases grabadas disponibles."}
            </p>
            {isAuxiliar && (
              <Button onClick={openCreate} className="gap-2 mt-2">
                <Plus className="w-4 h-4" /> Nueva Clase
              </Button>
            )}
          </div>
        )}

        {/* Grid */}
        {clases.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {clases.map((c) => (
              <ClassCard
                key={c.id}
                clase={c}
                isAuxiliar={isAuxiliar}
                onPlay={() => setSelectedClase(c)}
                onEdit={() => openEdit(c)}
                onDelete={() => setDeleteId(c.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Video Player Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!selectedClase} onOpenChange={(open) => !open && setSelectedClase(null)}>
        <DialogContent className="min-w-[60vw] p-0 overflow-hidden rounded-2xl border-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-violet-500" />
              {selectedClase?.titulo}
            </DialogTitle>
            {selectedClase?.descripcion && (
              <DialogDescription className="text-sm mt-1">
                {selectedClase.descripcion}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedClase && (() => {
            const embed = getEmbedUrl(selectedClase.url_video);
            if (embed.type === "embed") {
              return (
                <div className="aspect-video w-full bg-black">
                  <iframe
                    src={embed.src}
                    className="w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              );
            }
            return (
              <div className="flex flex-col items-center justify-center gap-4 py-16 px-8">
                <Video className="w-12 h-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  Este video no puede reproducirse directamente.
                </p>
                <Button asChild>
                  <a href={selectedClase.url_video} target="_blank" rel="noopener noreferrer" className="gap-2">
                    <ExternalLink className="w-4 h-4" /> Abrir en nueva pesta\u00f1a
                  </a>
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Form Dialog (Auxiliar) ─────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) setFormOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Clase" : "Nueva Clase Grabada"}</DialogTitle>
            <DialogDescription>
              Ingresa el t\u00edtulo y el enlace del video (YouTube o Google Drive).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">T\u00edtulo *</label>
              <Input
                placeholder="Ej: Clase 3 \u2014 Funciones en Python"
                value={formData.titulo}
                onChange={(e) => setFormData((p) => ({ ...p, titulo: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Descripcion</label>
              <Textarea
                placeholder="Breve descripcion del contenido de la clase (opcional)"
                rows={3}
                value={formData.descripcion}
                onChange={(e) => setFormData((p) => ({ ...p, descripcion: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">URL del Video *</label>
              <Input
                placeholder="https://drive.google.com/file/d/..."
                value={formData.url_video}
                onChange={(e) => setFormData((p) => ({ ...p, url_video: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Soporta Google Drive y YouTube. El video se incrustar\u00e1 autom\u00e1ticamente.
              </p>
            </div>
            {errorMsg && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : editId ? "Guardar Cambios" : "Crear Clase"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar esta clase?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. El enlace del video ser\u00e1 eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              S\u00ed, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── ClassCard ─────────────────────────────────────────────────────────────────

function ClassCard({
  clase,
  isAuxiliar,
  onPlay,
  onEdit,
  onDelete,
}: {
  clase: ClaseGrabadaRow;
  isAuxiliar: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const fecha = new Date(clase.creado_en).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Card className="group flex flex-col hover:shadow-md transition-all duration-200 overflow-hidden border hover:border-violet-500/30">
      <button
        onClick={onPlay}
        className="relative w-full aspect-video bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center hover:opacity-90 transition-opacity"
        aria-label={`Reproducir ${clase.titulo}`}
      >
        <PlayCircle className="w-14 h-14 text-white/90 drop-shadow" />
      </button>

      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold line-clamp-2 leading-snug">
          {clase.titulo}
        </CardTitle>
        {clase.descripcion && (
          <CardDescription className="text-xs line-clamp-2 mt-1">
            {clase.descripcion}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="pt-0 flex items-center justify-between mt-auto">
        <span className="text-[11px] text-muted-foreground">{fecha}</span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onPlay}
            className="h-7 gap-1 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/30"
          >
            <PlayCircle className="w-3.5 h-3.5" /> Ver
          </Button>
          {isAuxiliar && (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
