require('dotenv').config()

const { start } = require('./actions/backup')
const { BACKUP_FREQUENCY } = require('./utils/constants')

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

console.log('axis-s3-backup service started')
console.log(`Backup frequency: ${BACKUP_FREQUENCY / 1000 / 60} minutes`)
console.log(`Batch size: ${process.env.BATCH_SIZE || 20}`)

;(async () => {
  // Run immediately on start
  await start()

  // Then run on schedule
  while (true) {
    await sleep(BACKUP_FREQUENCY)
    await start()
  }
})()
