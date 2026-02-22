module.exports = {
  FILE_STATUS: {
    OK: 'ok',
    ERROR: 'error',
    SKIPPED: 'skipped'
  },
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE) || 20,
  BACKUP_FREQUENCY: parseInt(process.env.BACKUP_FREQUENCY) || 1000 * 60 * 60
}
