-- ==========================================
-- SCRIPT PARA ARREGLAR RECURSIÓN INFINITA EN RLS
-- ==========================================

-- 1. Crear una función SECURITY DEFINER para verificar si el usuario es auxiliar
-- Al ser SECURITY DEFINER, esta función se ejecuta con los privilegios del creador
-- y puentea (bypasses) las políticas de RLS, evitando el bucle infinito.
CREATE OR REPLACE FUNCTION public.is_auxiliar()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_roles
    WHERE user_id = auth.uid() AND rol = 'auxiliar'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Eliminar las políticas recursivas anteriores
DROP POLICY IF EXISTS "Auxiliares can view all roles" ON public.usuarios_roles;
DROP POLICY IF EXISTS "Auxiliares can view all students" ON public.estudiantes;
DROP POLICY IF EXISTS "Auxiliares can insert students" ON public.estudiantes;
DROP POLICY IF EXISTS "Auxiliares can update students" ON public.estudiantes;
DROP POLICY IF EXISTS "Auxiliares can view all attendance" ON public.asistencias;
DROP POLICY IF EXISTS "Auxiliares can insert attendance" ON public.asistencias;
DROP POLICY IF EXISTS "Auxiliares can update attendance" ON public.asistencias;

-- 3. Recrear las políticas utilizando la nueva función is_auxiliar()
CREATE POLICY "Auxiliares can view all roles" ON public.usuarios_roles
  FOR SELECT USING (public.is_auxiliar());

CREATE POLICY "Auxiliares can view all students" ON public.estudiantes
  FOR SELECT USING (public.is_auxiliar());

CREATE POLICY "Auxiliares can insert students" ON public.estudiantes
  FOR INSERT WITH CHECK (public.is_auxiliar());

CREATE POLICY "Auxiliares can update students" ON public.estudiantes
  FOR UPDATE USING (public.is_auxiliar());

CREATE POLICY "Auxiliares can view all attendance" ON public.asistencias
  FOR SELECT USING (public.is_auxiliar());

CREATE POLICY "Auxiliares can insert attendance" ON public.asistencias
  FOR INSERT WITH CHECK (public.is_auxiliar());

CREATE POLICY "Auxiliares can update attendance" ON public.asistencias
  FOR UPDATE USING (public.is_auxiliar());
