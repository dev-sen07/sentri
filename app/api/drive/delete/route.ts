export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { deleteFile } from '@/lib/google-drive'

export async function POST(req: NextRequest) {
  try {
    const { fileId } = await req.json()

    if (!fileId || typeof fileId !== 'string') {
      return NextResponse.json(
        { error: 'fileId is required and must be a string' },
        { status: 400 }
      )
    }

    await deleteFile(fileId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Drive delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete file from Google Drive' },
      { status: 500 }
    )
  }
}
