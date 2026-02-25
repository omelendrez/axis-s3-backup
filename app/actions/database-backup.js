const path = require('node:path')
const fs = require('node:fs')
require('dotenv').config()

const { uploadToS3, fileExistsInS3 } = require('../services/s3-service')
const { FILE_STATUS } = require('../utils/constants')

const DATABASE_BACKUP_FOLDER = process.env.DATABASE_BACKUP_FOLDER_URI

/**
 * Get the most recent backup file from the database backup folder
 * Files are named like: 2026-02-25.admin_axis.sql.gz
 */
const getLatestBackupFile = () => {
  if (!DATABASE_BACKUP_FOLDER) {
    return null
  }

  if (!fs.existsSync(DATABASE_BACKUP_FOLDER)) {
    console.log(`[DB BACKUP] Folder not found: ${DATABASE_BACKUP_FOLDER}`)
    return null
  }

  const files = fs.readdirSync(DATABASE_BACKUP_FOLDER)
    .filter(file => file.endsWith('.sql.gz'))
    .map(file => ({
      name: file,
      path: path.join(DATABASE_BACKUP_FOLDER, file),
      // Parse date from filename (format: YYYY-MM-DD.name.sql.gz)
      date: file.match(/^(\d{4}-\d{2}-\d{2})\./) ? file.match(/^(\d{4}-\d{2}-\d{2})\./)[1] : null
    }))
    .filter(file => file.date !== null)
    .sort((a, b) => b.date.localeCompare(a.date)) // Sort descending by date

  return files.length > 0 ? files[0] : null
}

/**
 * Upload the latest database backup to S3
 */
const uploadDatabaseBackup = async () => {
  console.log(`\n[${new Date().toISOString()}] Starting database backup...`)

  if (!DATABASE_BACKUP_FOLDER) {
    console.log('[DB BACKUP] DATABASE_BACKUP_FOLDER_URI not configured, skipping')
    return { status: FILE_STATUS.SKIPPED, reason: 'Not configured' }
  }

  const latestFile = getLatestBackupFile()

  if (!latestFile) {
    console.log('[DB BACKUP] No backup files found')
    return { status: FILE_STATUS.SKIPPED, reason: 'No files found' }
  }

  // S3 key will be: database/2026-02-25.admin_axis.sql.gz
  const s3Key = `database/${latestFile.name}`

  // Check if already uploaded
  const existsInS3 = await fileExistsInS3(s3Key)
  if (existsInS3) {
    console.log(`[DB BACKUP] Already in S3: ${s3Key}`)
    return { status: FILE_STATUS.SKIPPED, file: latestFile.name, reason: 'Already in S3' }
  }

  // Upload to S3
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

module.exports = { uploadDatabaseBackup, getLatestBackupFile }
