-- =========================
-- CREAR EXTENSIÓN UUID
-- =========================
create extension if not exists "uuid-ossp";

-- =========================
-- TABLA DE ROLES
-- =========================
create table if not exists roles (
  id text primary key,
  nombre text not null
);

insert into roles (id, nombre) values 
  ('estudiante', 'Estudiante'),
  ('auxiliar', 'Auxiliar')
on conflict do nothing;

-- =========================
-- TABLA DE USUARIOS CON ROLES
-- =========================
create table if not exists usuarios_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rol text not null references roles(id),
  created_at timestamp default now()
);

-- =========================
-- TABLA DE ESTUDIANTES
-- =========================
create table if not exists estudiantes (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  apellido text not null,
  ci text unique,
  ru text unique,
  correo text unique not null,
  user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamp default now()
);

-- =========================
-- TABLA DE ASISTENCIAS
-- =========================
create table if not exists asistencias (
  id uuid primary key default uuid_generate_v4(),
  estudiante_id uuid not null references estudiantes(id) on delete cascade,
  fecha date not null,
  hora time not null,
  estado text check (estado in ('presente','ausente','retraso')) not null,
  registrado_por uuid references auth.users(id),
  created_at timestamp default now()
);

-- =========================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =========================
create index if not exists idx_usuarios_roles_user_id on usuarios_roles(user_id);
create index if not exists idx_asistencias_estudiante_fecha on asistencias(estudiante_id, fecha);
create index if not exists idx_asistencias_fecha on asistencias(fecha);

-- =========================
-- HABILITAR RLS
-- =========================
alter table roles enable row level security;
alter table usuarios_roles enable row level security;
alter table estudiantes enable row level security;
alter table asistencias enable row level security;

-- =========================
-- POLÍTICAS RLS PARA ROLES
-- =========================
create policy "Roles are readable by all" on roles
  for select using (true);

-- =========================
-- POLÍTICAS RLS PARA USUARIOS_ROLES
-- =========================
create policy "Users can view their own role" on usuarios_roles
  for select using (auth.uid() = user_id);

create policy "Auxiliares can view all roles" on usuarios_roles
  for select using (
    exists (
      select 1 from usuarios_roles ur
      where ur.user_id = auth.uid() and ur.rol = 'auxiliar'
    )
  );

-- =========================
-- POLÍTICAS RLS PARA ESTUDIANTES
-- =========================
create policy "Students can view themselves" on estudiantes
  for select using (auth.uid() = user_id);

create policy "Auxiliares can view all students" on estudiantes
  for select using (
    exists (
      select 1 from usuarios_roles ur
      where ur.user_id = auth.uid() and ur.rol = 'auxiliar'
    )
  );

create policy "Auxiliares can insert students" on estudiantes
  for insert with check (
    exists (
      select 1 from usuarios_roles ur
      where ur.user_id = auth.uid() and ur.rol = 'auxiliar'
    )
  );

create policy "Auxiliares can update students" on estudiantes
  for update using (
    exists (
      select 1 from usuarios_roles ur
      where ur.user_id = auth.uid() and ur.rol = 'auxiliar'
    )
  );

-- =========================
-- POLÍTICAS RLS PARA ASISTENCIAS
-- =========================
create policy "Students can view their own attendance" on asistencias
  for select using (
    estudiante_id in (
      select id from estudiantes where user_id = auth.uid()
    )
  );

create policy "Auxiliares can view all attendance" on asistencias
  for select using (
    exists (
      select 1 from usuarios_roles ur
      where ur.user_id = auth.uid() and ur.rol = 'auxiliar'
    )
  );

create policy "Auxiliares can insert attendance" on asistencias
  for insert with check (
    exists (
      select 1 from usuarios_roles ur
      where ur.user_id = auth.uid() and ur.rol = 'auxiliar'
    )
  );

create policy "Auxiliares can update attendance" on asistencias
  for update using (
    exists (
      select 1 from usuarios_roles ur
      where ur.user_id = auth.uid() and ur.rol = 'auxiliar'
    )
  );
