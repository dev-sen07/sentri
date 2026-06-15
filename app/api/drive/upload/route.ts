export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { findOrCreateFolder, uploadFile } from '@/lib/google-drive'

const ALLOWED_EXTENSIONS = ['.py', '.pdf']
const MAX_FILE_SIZE = 5 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    if (!rootFolderId) {
      return NextResponse.json(
        { error: 'GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured' },
        { status: 500 }
      )
    }

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
          { error: `Invalid file extension: ${ext}. Only ${ALLOWED_EXTENSIONS.join(', ')} are allowed` },
          { status: 400 }
        )
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds the maximum size of 5MB` },
          { status: 400 }
        )
      }
    }

    const studentFolderId = await findOrCreateFolder(studentName, rootFolderId)
    const taskFolderId = await findOrCreateFolder(taskTitle, studentFolderId)

    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer())
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
        const mimeType = ext === '.pdf' ? 'application/pdf' : 'text/x-python'
        const result = await uploadFile(file.name, mimeType, buffer, taskFolderId)
        return {
          nombre: file.name,
          drive_file_id: result.id,
          drive_url: result.webViewLink,
          tipo: ext,
          size: file.size,
        }
      })
    )

    return NextResponse.json({
      files: uploadedFiles,
      driveFolderId: studentFolderId,
    })
  } catch (error) {
    console.error('Drive upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload files to Google Drive' },
      { status: 500 }
    )
  }
}
