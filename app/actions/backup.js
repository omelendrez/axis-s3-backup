const path = require('node:path')
const fs = require('node:fs')
require('dotenv').config()

const { api } = require('../services/api-service')
const { uploadToS3, fileExistsInS3 } = require('../services/s3-service')
const { FILE_STATUS, BATCH_SIZE } = require('../utils/constants')

const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 2000
const MAX_CYCLES = 100

const withRetry = async (fn, label) => {
  let lastError
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < MAX_RETRIES) {
        console.log(`[RETRY] ${label} (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`)
        await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * attempt))
      }
    }
  }
  throw lastError
}

/**
 * Get pending documents from backend API
 */
const getPendingDocuments = async () => {
  const response = await api.get(`s3-document?status=0&limit=${BATCH_SIZE}`)
  return response.data
}

/**
 * Update document status in backend
 */
const updateDocumentStatus = async (file, status) => {
  await api.put('s3-document', { file, status })
}

/**
 * Process a single file upload
 */
const processFile = async (doc) => {
  const file = doc.file
  const localPath = path.join(process.env.DOCUMENTS_FOLDER_URI, file)

  // Check if local file exists
  if (!fs.existsSync(localPath)) {
    console.log(`[SKIP] File not found: ${file}`)
    return { status: FILE_STATUS.SKIPPED, file, reason: 'File not found locally' }
  }

  // Check if already in S3 (idempotency)
  const existsInS3 = await fileExistsInS3(file)
  if (existsInS3) {
    console.log(`[SKIP] Already in S3: ${file}`)
    await updateDocumentStatus(file, 1)
    return { status: FILE_STATUS.SKIPPED, file, reason: 'Already in S3' }
  }

  // Upload to S3
  await uploadToS3(localPath, file)
  console.log(`[OK] Uploaded: ${file}`)

  // Update status in database
  await updateDocumentStatus(file, 1)

  return { status: FILE_STATUS.OK, file }
}

/**
 * Main backup orchestration
 */
const start = async () => {
  console.log(`\n[${new Date().toISOString()}] Starting backup cycle...`)

  let success = 0
  let skipped = 0
  let errors = 0

  try {
    let cycles = 0
    while (cycles < MAX_CYCLES) {
      cycles++
      const docs = await getPendingDocuments()

      if (docs.length === 0) break

      console.log(`Found ${docs.length} pending documents`)

      for (const doc of docs) {
        try {
          const result = await withRetry(() => processFile(doc), doc.file)
          if (result.status === FILE_STATUS.OK) success++
          else if (result.status === FILE_STATUS.SKIPPED) skipped++
        } catch (error) {
          errors++
          console.log(`[ERROR] ${doc.file}: ${error.name} - ${error.message}`)
          if (error.Code) console.log(`  AWS Code: ${error.Code}`)
          if (error.$metadata) console.log(`  HTTP Status: ${error.$metadata.httpStatusCode}`)
        }
      }
    }

    if (cycles >= MAX_CYCLES) {
      console.log(`[WARN] Reached max cycle limit (${MAX_CYCLES}), stopping backup cycle`)
    }

    if (success === 0 && skipped === 0 && errors === 0) {
      console.log('No pending documents to backup')
      return
    }

    console.log(`Cycle complete: ${success} uploaded, ${skipped} skipped, ${errors} errors`)
  } catch (error) {
    console.log(`[ERROR] Backup cycle failed: ${error.message}`)
  }
}

module.exports = { start }
