import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Initialize a supabase client with the service role key to bypass RLS and use auth admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nombre, apellido, ci, ru, correo, password } = body

    if (!nombre || !apellido || !ci || !ru || !correo || !password) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // 1. Create the user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: correo,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: `${nombre} ${apellido}` }
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user.id

    // 2. Insert into roles table
    const { error: roleError } = await supabaseAdmin.from('usuarios_roles').insert([
      {
        user_id: userId,
        rol: 'estudiante'
      }
    ])

    if (roleError) {
      // rollback could ideally happen here or an RPC function is better, but this suffices for the scope
      console.error("Created user but failed to assign role", roleError)
    }

    // 3. Insert into estudiantes table
    const { error: estudianteError } = await supabaseAdmin.from('estudiantes').insert([
      {
        user_id: userId,
        nombre,
        apellido,
        ci,
        ru,
        correo,
      }
    ])

    if (estudianteError) {
      return NextResponse.json({ error: estudianteError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, user: authData.user }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
