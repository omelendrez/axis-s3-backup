const parsedBatchSize = parseInt(process.env.BATCH_SIZE, 10)
if (process.env.BATCH_SIZE && isNaN(parsedBatchSize)) {
  console.warn(`[WARN] Invalid BATCH_SIZE "${process.env.BATCH_SIZE}", using default 20`)
}

const parsedBackupFrequency = parseInt(process.env.BACKUP_FREQUENCY, 10)
if (process.env.BACKUP_FREQUENCY && isNaN(parsedBackupFrequency)) {
  console.warn(`[WARN] Invalid BACKUP_FREQUENCY "${process.env.BACKUP_FREQUENCY}", using default 1 hour`)
}

module.exports = {
  FILE_STATUS: {
    OK: 'ok',
    ERROR: 'error',
    SKIPPED: 'skipped'
  },
  BATCH_SIZE: isNaN(parsedBatchSize) ? 20 : parsedBatchSize,
  BACKUP_FREQUENCY: isNaN(parsedBackupFrequency) ? 1000 * 60 * 60 : parsedBackupFrequency
}
