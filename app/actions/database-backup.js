const path = require('node:path')
const fs = require('node:fs')

const { uploadToS3, fileExistsInS3 } = require('../services/s3-service')
const { FILE_STATUS } = require('../utils/constants')

// Supports comma-separated list of folders: DATABASE_BACKUP_FOLDER_URI=/path/a,/path/b
const DATABASE_BACKUP_FOLDERS = process.env.DATABASE_BACKUP_FOLDER_URI
  ? process.env.DATABASE_BACKUP_FOLDER_URI.split(',').map(f => f.trim()).filter(Boolean)
  : []

/**
 * Get the most recent backup file from a database backup folder
 * Files are named like: 2026-02-25.admin_axis.sql.gz
 */
const getLatestBackupFile = (folder) => {
  if (!fs.existsSync(folder)) {
    console.log(`[DB BACKUP] Folder not found: ${folder}`)
    return null
  }

  try {
    const files = fs.readdirSync(folder)
      .filter(file => file.endsWith('.sql.gz'))
      .map(file => ({
        name: file,
        path: path.join(folder, file),
        date: file.match(/^(\d{4}-\d{2}-\d{2})\./) ? file.match(/^(\d{4}-\d{2}-\d{2})\./)[1] : null
      }))
      .filter(file => file.date !== null)
      .sort((a, b) => b.date.localeCompare(a.date))

    return files.length > 0 ? files[0] : null
  } catch (error) {
    console.log(`[DB BACKUP] Error reading backup folder: ${error.message}`)
    return null
  }
}

/**
 * Upload the latest backup file from a single folder to S3
 */
const uploadFolderBackup = async (folder) => {
  const latestFile = getLatestBackupFile(folder)

  if (!latestFile) {
    console.log(`[DB BACKUP] No backup files found in ${folder}`)
    return { status: FILE_STATUS.SKIPPED, reason: 'No files found' }
  }

  const s3Key = `database/${latestFile.name}`

  const existsInS3 = await fileExistsInS3(s3Key)
  if (existsInS3) {
    console.log(`[DB BACKUP] Already in S3: ${s3Key}`)
    return { status: FILE_STATUS.SKIPPED, file: latestFile.name, reason: 'Already in S3' }
  }

  try {
    await uploadToS3(latestFile.path, s3Key)
    console.log(`[DB BACKUP] Uploaded: ${latestFile.name} -> ${s3Key}`)
    return { status: FILE_STATUS.OK, file: latestFile.name }
  } catch (error) {
    console.log(`[DB BACKUP ERROR] ${latestFile.name}: ${error.message}`)
    if (error.Code) console.log(`  AWS Code: ${error.Code}`)
    if (error.$metadata) console.log(`  HTTP Status: ${error.$metadata.httpStatusCode}`)
    return { status: FILE_STATUS.ERROR, file: latestFile.name, error: error.message }
  }
}

/**
 * Upload the latest database backup from all configured folders to S3
 */
const uploadDatabaseBackup = async () => {
  console.log(`\n[${new Date().toISOString()}] Starting database backup...`)

  if (DATABASE_BACKUP_FOLDERS.length === 0) {
    console.log('[DB BACKUP] DATABASE_BACKUP_FOLDER_URI not configured, skipping')
    return [{ status: FILE_STATUS.SKIPPED, reason: 'Not configured' }]
  }

  const results = []
  for (const folder of DATABASE_BACKUP_FOLDERS) {
    results.push(await uploadFolderBackup(folder))
  }
  return results
}

module.exports = { uploadDatabaseBackup, getLatestBackupFile }
