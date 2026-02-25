require('dotenv').config()

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

;(async () => {
  // Run immediately on start
  await start()
  await uploadDatabaseBackup()

  // Then run on schedule
  while (true) {
    await sleep(BACKUP_FREQUENCY)
    await start()
    await uploadDatabaseBackup()
  }
})()
