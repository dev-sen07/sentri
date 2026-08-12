CREATE TABLE public.roles (
  id     TEXT PRIMARY KEY,
  nombre TEXT NOT NULL
);

INSERT INTO public.roles (id, nombre) VALUES
  ('estudiante', 'Estudiante'),
  ('auxiliar',   'Auxiliar de la materia'),
  ('delegado',   'Delegado de Curso');

-- ─────────────────────────────────────────
-- usuarios_roles: asignación rol ↔ usuario auth
-- Un usuario solo puede tener UN rol activo (UNIQUE user_id)
-- ─────────────────────────────────────────
CREATE TABLE public.usuarios_roles (
  id         UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol        TEXT      NOT NULL REFERENCES public.roles(id),
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT uq_usuario_rol UNIQUE (user_id)
);

-- ─────────────────────────────────────────
-- estudiantes: datos del alumno
-- ─────────────────────────────────────────
CREATE TABLE public.estudiantes (
  id         UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre     TEXT      NOT NULL,
  apellido   TEXT      NOT NULL,
  ci         TEXT      UNIQUE,
  ru         TEXT      UNIQUE,
  correo     TEXT      NOT NULL UNIQUE,
  codigo     TEXT      UNIQUE,
  paralelo   TEXT      CHECK (paralelo IN ('A', 'B', 'C')),
  user_id    UUID      UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- ─────────────────────────────────────────
-- clases_grabadas: videos de clase
-- ─────────────────────────────────────────
CREATE TABLE public.clases_grabadas (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo      TEXT        NOT NULL,
  descripcion TEXT,
  url_video   TEXT        NOT NULL,
  creado_en   TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────
-- configuracion_notas: parámetros del sistema de notas (clave/valor)
-- ─────────────────────────────────────────
CREATE TABLE public.configuracion_notas (
  id          UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  clave       TEXT      NOT NULL UNIQUE,
  valor       NUMERIC   NOT NULL CHECK (valor >= 0),
  descripcion TEXT,
  updated_at  TIMESTAMP DEFAULT now()
);

INSERT INTO public.configuracion_notas (clave, valor, descripcion) VALUES
  ('total_clases',              10, 'Número total de clases del semestre'),
  ('puntos_maximos_asistencia', 10, 'Puntaje máximo por asistencia'),
  ('puntos_maximos_practicas',  20, 'Puntaje máximo por prácticas de laboratorio'),
  ('puntos_maximos_tareas',     30, 'Puntaje máximo por presentaciones/tareas'),
  ('puntos_maximos_actividades',10, 'Puntaje máximo por participación en actividades'),
  ('puntos_maximos_extras',     10, 'Puntaje máximo por puntos extras');


-- ┌─────────────────────────────────────────────────────────┐
-- │  PASO 3 — TABLAS CON FK A ESTUDIANTES                   │
-- └─────────────────────────────────────────────────────────┘

-- ─────────────────────────────────────────
-- asistencias
-- ─────────────────────────────────────────
CREATE TABLE public.asistencias (
  id             UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  estudiante_id  UUID      NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
  fecha          DATE      NOT NULL,
  hora           TIME      NOT NULL,
  estado         TEXT      NOT NULL CHECK (estado IN ('presente', 'ausente', 'retraso')),
  registrado_por UUID      REFERENCES auth.users(id),
  created_at     TIMESTAMP DEFAULT now()
);

-- ─────────────────────────────────────────
-- practicas: ejercicios de laboratorio Python
-- configuracion JSONB: { "verificaciones": [...], "asistencia": bool }
-- ─────────────────────────────────────────
CREATE TABLE public.practicas (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre             TEXT        NOT NULL,
  descripcion        TEXT        NOT NULL,
  resultado_esperado TEXT        NOT NULL,
  codigo_base        TEXT,
  paralelo           TEXT        NOT NULL CHECK (paralelo IN ('A', 'B', 'C')),
  fecha_limite       TIMESTAMPTZ,
  configuracion      JSONB,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- entregas: respuestas de código de prácticas
-- Una entrega por estudiante por práctica (UNIQUE)
-- ─────────────────────────────────────────
CREATE TABLE public.entregas (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  practica_id   UUID        NOT NULL REFERENCES public.practicas(id) ON DELETE CASCADE,
  estudiante_id UUID        NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
  codigo        TEXT        NOT NULL,
  nota          INTEGER     CHECK (nota BETWEEN 0 AND 100),
  fecha_entrega TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_entrega_practica_estudiante UNIQUE (practica_id, estudiante_id)
);

-- ─────────────────────────────────────────
-- extras: puntos adicionales por mérito
-- ─────────────────────────────────────────
CREATE TABLE public.extras (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  estudiante_id UUID        REFERENCES public.estudiantes(id) ON DELETE CASCADE,
  puntos        NUMERIC     NOT NULL CHECK (puntos > 0),
  descripcion   TEXT,
  creado_en     TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────
-- actividades: eventos de participación
-- ─────────────────────────────────────────
CREATE TABLE public.actividades (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT        NOT NULL,
  fecha       DATE        NOT NULL,
  hora_inicio TIME,
  hora_fin    TIME,
  ponderacion NUMERIC     NOT NULL CHECK (ponderacion >= 0),
  creado_en   TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────
-- actividad_participantes: relación actividad ↔ estudiante
-- Sin duplicados (UNIQUE)
-- ─────────────────────────────────────────
CREATE TABLE public.actividad_participantes (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  actividad_id  UUID        REFERENCES public.actividades(id) ON DELETE CASCADE,
  estudiante_id UUID        REFERENCES public.estudiantes(id) ON DELETE CASCADE,
  registrado_en TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_actividad_participante UNIQUE (actividad_id, estudiante_id)
);

-- ─────────────────────────────────────────
-- presentaciones_tareas: tareas con entrega de archivos
-- ─────────────────────────────────────────
CREATE TABLE public.presentaciones_tareas (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo       TEXT        NOT NULL,
  descripcion  TEXT,
  paralelo     TEXT        NOT NULL CHECK (paralelo IN ('A', 'B', 'C')),
  fecha_limite TIMESTAMPTZ,
  ponderacion  NUMERIC     CHECK (ponderacion >= 0),
  pdf_file_id  TEXT,
  pdf_url      TEXT,
  creado_en    TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────
-- presentaciones_entregas: archivos entregados por estudiantes
-- archivos JSONB: [{ nombre, drive_file_id, drive_url, tipo, size }]
-- Una entrega por tarea por estudiante (UNIQUE)
-- ─────────────────────────────────────────
CREATE TABLE public.presentaciones_entregas (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tarea_id        UUID        NOT NULL REFERENCES public.presentaciones_tareas(id) ON DELETE CASCADE,
  estudiante_id   UUID        NOT NULL REFERENCES public.estudiantes(id) ON DELETE CASCADE,
  archivos        JSONB       NOT NULL DEFAULT '[]',
  estado          TEXT        NOT NULL DEFAULT 'revision'
                              CHECK (estado IN ('revision', 'revisado')),
  nota            NUMERIC     CHECK (nota BETWEEN 0 AND 100),
  comentario      TEXT,
  drive_folder_id TEXT,
  entregado_en    TIMESTAMPTZ DEFAULT now(),
  revisado_en     TIMESTAMPTZ,
  CONSTRAINT uq_presentacion_por_tarea UNIQUE (tarea_id, estudiante_id)
);

-- ─────────────────────────────────────────
-- liberaciones: examen de liberación semestral
-- Columnas planas (no JSONB para examen_contenido/examen_respuesta)
-- Registros con ru LIKE 'CONFIG_%' = configuración interna del sistema
-- archivos_respuesta JSONB: [{ nombre, drive_file_id, drive_url, tipo, size }]
-- ─────────────────────────────────────────
CREATE TABLE public.liberaciones (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  estudiante_id        UUID        REFERENCES public.estudiantes(id) ON DELETE SET NULL,
  estado               TEXT        CHECK (estado IN ('pendiente', 'confirmado', 'en_examen', 'finalizado')),
  nota                 NUMERIC     CHECK (nota BETWEEN 0 AND 100),
  horario_seleccionado TEXT,
  -- Examen: PDF del enunciado (antes en examen_contenido JSONB)
  examen_pdf_url       TEXT,
  examen_pdf_file_id   TEXT,
  -- Respuesta del estudiante (antes en examen_respuesta JSONB)
  archivos_respuesta   JSONB,
  drive_folder_id      TEXT,
  -- Timestamps del flujo
  confirmado_en        TIMESTAMPTZ,
  finalizado_en        TIMESTAMPTZ,
  creado_en            TIMESTAMPTZ DEFAULT now()
);