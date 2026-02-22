require('dotenv').config()
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3')
const fs = require('node:fs')
const path = require('node:path')

const s3Client = new S3Client({
  region: process.env.AWS_S3_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.AWS_S3_BUCKET_ACCESS_KEY,
    secretAccessKey: process.env.AWS_S3_BUCKET_SECRET_ACCESS_KEY
  }
})

const bucketName = process.env.AWS_S3_BUCKET_NAME

/**
 * Check if file exists in S3
 */
const fileExistsInS3 = async (key) => {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: bucketName,
      Key: key
    }))
    return true
  } catch (error) {
    if (error.name === 'NotFound') return false
    throw error
  }
}

/**
 * Upload file to S3
 */
const uploadToS3 = async (localPath, s3Key) => {
  const fileContent = fs.readFileSync(localPath)
  const contentType = getContentType(s3Key)

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    Body: fileContent,
    ContentType: contentType
  })

  await s3Client.send(command)
  return { success: true, key: s3Key }
}

/**
 * Get content type based on file extension
 */
const getContentType = (filename) => {
  const ext = path.extname(filename).toLowerCase()
  const types = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.csv': 'text/csv'
  }
  return types[ext] || 'application/octet-stream'
}

module.exports = { uploadToS3, fileExistsInS3 }
