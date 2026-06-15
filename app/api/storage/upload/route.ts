export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_EXTENSIONS = ['.py', '.pdf']
const MAX_FILE_SIZE = 5 * 1024 * 1024

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const studentName = formData.get('studentName') as string | null
    const taskTitle = formData.get('taskTitle') as string | null
    const files = formData.getAll('files') as File[]

    if (!studentName || !taskTitle) {
      return NextResponse.json(
        { error: 'studentName and taskTitle are required' },
        { status: 400 }
      )
    }

    if (!files.length) {
      return NextResponse.json(
        { error: 'At least one file is required' },
        { status: 400 }
      )
    }

    for (const file of files) {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: `Extensión no permitida: ${ext}. Solo ${ALLOWED_EXTENSIONS.join(', ')}` },
          { status: 400 }
        )
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `El archivo "${file.name}" supera el límite de 5MB` },
          { status: 400 }
        )
      }
    }

    const supabase = getSupabaseAdmin()
    const folderPath = `${studentName}/${taskTitle}`

    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
        const buffer = Buffer.from(await file.arrayBuffer())
        const storagePath = `${folderPath}/${file.name}`

        const { error } = await supabase.storage
          .from('entregas')
          .upload(storagePath, buffer, {
            contentType: ext === '.pdf' ? 'application/pdf' : 'text/x-python',
            upsert: true,
          })

        if (error) throw new Error(error.message)

        const { data: { publicUrl } } = supabase.storage
          .from('entregas')
          .getPublicUrl(storagePath)

        return {
          nombre: file.name,
          drive_file_id: storagePath,
          drive_url: publicUrl,
          tipo: ext,
          size: file.size,
        }
      })
    )

    return NextResponse.json({
      files: uploadedFiles,
      driveFolderId: folderPath,
    })
  } catch (error) {
    console.error('Storage upload error:', error)
    return NextResponse.json(
      { error: 'Error al subir los archivos' },
      { status: 500 }
    )
  }
}
