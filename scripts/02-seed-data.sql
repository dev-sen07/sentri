-- =========================
-- INSERTAR DATOS DE EJEMPLO
-- =========================

-- Nota: Los user_ids deben ser reemplazados con IDs reales de auth.users
-- Los usuarios se crearán a través de Supabase Auth, aquí solo creamos los estudiantes

-- ESTUDIANTES
insert into estudiantes (nombre, apellido, ci, ru, correo, user_id)
values 
  ('Juan', 'García', '12345678', '2020001', 'juan.garcia@example.com', null),
  ('María', 'López', '23456789', '2020002', 'maria.lopez@example.com', null),
  ('Carlos', 'Martínez', '34567890', '2020003', 'carlos.martinez@example.com', null),
  ('Ana', 'Rodríguez', '45678901', '2020004', 'ana.rodriguez@example.com', null),
  ('Pedro', 'Fernández', '56789012', '2020005', 'pedro.fernandez@example.com', null)
on conflict do nothing;

-- ASISTENCIAS de ejemplo (últimos 5 días)
insert into asistencias (estudiante_id, fecha, hora, estado)
select 
  e.id,
  (current_date - interval '4 days' + interval '1 day' * v)::date,
  ('08:00:00'::time + interval '5 minutes' * (random() * 60)::int),
  (array['presente', 'presente', 'presente', 'ausente', 'retraso'])[floor(random() * 5)::int + 1]
from estudiantes e
cross join lateral generate_series(0, 4) as v
on conflict do nothing;
