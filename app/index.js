require('dotenv').config()

const REQUIRED_ENV_VARS = [
  'API_URL',
  'DOCUMENTS_FOLDER_URI',
  'AWS_S3_BUCKET_NAME',
  'AWS_S3_BUCKET_REGION',
  'AWS_S3_BUCKET_ACCESS_KEY',
  'AWS_S3_BUCKET_SECRET_ACCESS_KEY'
]

const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v])
if (missingVars.length > 0) {
  console.error(`[ERROR] Missing required environment variables: ${missingVars.join(', ')}`)
  process.exit(1)
}

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason)
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error.message)
  process.exit(1)
})

const { start } = require('./actions/backup')
const { uploadDatabaseBackup } = require('./actions/database-backup')
const { BACKUP_FREQUENCY } = require('./utils/constants')

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

console.log('axis-s3-backup service started')
console.log(`Backup frequency: ${BACKUP_FREQUENCY / 1000 / 60} minutes`)
console.log(`Batch size: ${process.env.BATCH_SIZE || 20}`)
if (process.env.DATABASE_BACKUP_FOLDER_URI) {
  console.log(`Database backup folder: ${process.env.DATABASE_BACKUP_FOLDER_URI}`)
}

let shuttingDown = false

const handleShutdown = (signal) => {
  console.log(`\nReceived ${signal}, shutting down after current cycle...`)
  shuttingDown = true
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'))
process.on('SIGINT', () => handleShutdown('SIGINT'))

;(async () => {
  try {
    // Run immediately on start
    await start()
    await uploadDatabaseBackup()

    // Then run on schedule
    while (!shuttingDown) {
      await sleep(BACKUP_FREQUENCY)
      if (shuttingDown) break
      await start()
      await uploadDatabaseBackup()
    }

    console.log('axis-s3-backup service stopped')
  } catch (error) {
    console.error(`[STARTUP ERROR] ${error.message}`)
    process.exit(1)
  }
})()
