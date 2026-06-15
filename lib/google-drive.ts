import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/drive.file']

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!email || !key) {
    throw new Error('Missing Google Service Account environment variables')
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: SCOPES,
  })
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() })
}

/**
 * Find a folder by name inside a parent folder.
 * Returns the folder ID if found, null otherwise.
 */
export async function findFolder(name: string, parentId: string): Promise<string | null> {
  const drive = getDrive()
  const res = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  })
  return res.data.files?.[0]?.id ?? null
}

/**
 * Create a folder inside a parent folder.
 * Returns the new folder ID.
 */
export async function createFolder(name: string, parentId: string): Promise<string> {
  const drive = getDrive()
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  return res.data.id!
}

/**
 * Find or create a folder. Returns the folder ID.
 */
export async function findOrCreateFolder(name: string, parentId: string): Promise<string> {
  const existing = await findFolder(name, parentId)
  if (existing) return existing
  return createFolder(name, parentId)
}

/**
 * Upload a file buffer to Google Drive inside the given parent folder.
 * Returns metadata about the uploaded file.
 */
export async function uploadFile(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  parentFolderId: string,
): Promise<{ id: string; name: string; webViewLink: string }> {
  const drive = getDrive()

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
    },
    media: {
      mimeType,
      body: require('stream').Readable.from(buffer),
    },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  })

  // Make the file readable by anyone with the link
  await drive.permissions.create({
    fileId: res.data.id!,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  })

  // Re-fetch to get the webViewLink after permission change
  const updated = await drive.files.get({
    fileId: res.data.id!,
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  })

  return {
    id: updated.data.id!,
    name: updated.data.name!,
    webViewLink: updated.data.webViewLink!,
  }
}

/**
 * Delete a file from Google Drive by its file ID.
 */
export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDrive()
  await drive.files.delete({ fileId })
}
