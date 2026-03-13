# axis-s3-backup

Scheduled service that syncs files from `axis-documents` local storage to AWS S3.

---

## Overview

`axis-s3-backup` runs as a background process, querying `axis-backend` for pending documents and uploading them to an S3 bucket. It is designed to be fault-tolerant: transient S3 or API failures are retried (up to 3 attempts with linear backoff), and the service shuts down gracefully on SIGTERM/SIGINT.

---

## Prerequisites

- Node.js v16.20.2 or higher
- AWS S3 bucket with appropriate IAM permissions
- `axis-backend` and `axis-documents` running and accessible

---

## Setup

```bash
git clone https://github.com/omelendrez/axis-s3-backup.git
cd axis-s3-backup
npm ci
```

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Required variables:

```env
API_URL="http://127.0.0.1:3000/api/"       # axis-backend base URL
DOCUMENTS_FOLDER_URI="/path/to/axis-documents/uploads"

AWS_S3_BUCKET_NAME="your-bucket-name"
AWS_S3_BUCKET_REGION="us-east-1"
AWS_S3_BUCKET_ACCESS_KEY="<access-key>"
AWS_S3_BUCKET_SECRET_ACCESS_KEY="<secret-key>"

BATCH_SIZE=20                               # Files processed per cycle (default: 20)
BACKUP_FREQUENCY=3600000                    # Interval in ms (default: 1 hour)
```

---

## Running

```bash
npm start    # Start the backup service
```

The service logs each cycle: files uploaded, skipped (already in S3), and errors.

---

## Behavior

- **Cycle**: queries `/api/s3-document?status=0`, processes up to `BATCH_SIZE` pending documents, sleeps for `BACKUP_FREQUENCY` ms, repeats
- **Idempotency**: checks if file already exists in S3 before uploading; skips if found
- **Retry logic**: each file upload retried up to 3 times (2 s / 4 s linear backoff) on transient failures
- **Cycle guard**: inner processing loop capped at 100 iterations to prevent runaway loops if the API persistently returns the same documents
- **Graceful shutdown**: handles SIGTERM and SIGINT; completes the current cycle before exiting
- **Streaming uploads**: files are streamed to S3 (`createReadStream` + `ContentLength`) rather than read entirely into memory

---

## Scripts

```bash
npm start    # Run the service
```
