# Axis S3 Backup - Context Documentation

## Overview
**axis-s3-backup** is a scheduled Node.js background service that syncs files from `axis-documents` local storage to an AWS S3 bucket, and uploads compressed MySQL database dumps. It runs as a standalone process alongside the other Axis services and is designed for fault-tolerance and graceful shutdown.

---

## Technology Stack

### Core Runtime
- **Node.js** (>=14.21.3 <=20.9.0; VPS runtime: v16.20.2)
- **npm**

### Dependencies
- **@aws-sdk/client-s3** - AWS SDK v3 for S3 operations (`PutObjectCommand`, `HeadObjectCommand`)
- **axios 1.6.2** - HTTP client for axis-backend API calls
- **dotenv 16.3.1** - Environment variable configuration

### Development Tools
- **ESLint 8.54.0** - Code linting with standard configuration
- **nodemon 3.0.2** - File watching for development

---

## Main Purpose and Functionality

The service runs on a configurable schedule (default: every hour) and performs two tasks per cycle:

1. **Document file backup** — queries `axis-backend` for pending documents (status=0), uploads each file to S3, then marks it as synced (status=1)
2. **Database backup** — finds the most recent `.sql.gz` file in `DATABASE_BACKUP_FOLDER_URI` and uploads it to S3 under the `database/` prefix (skipped if already uploaded)

---

## Project Structure

```
axis-s3-backup/
├── app/
│   ├── index.js                    # Entry point: schedule loop, graceful shutdown
│   ├── actions/
│   │   ├── backup.js               # Document backup orchestration and retry logic
│   │   └── database-backup.js      # Database dump upload logic
│   ├── services/
│   │   ├── api-service.js          # Axios client for axis-backend
│   │   └── s3-service.js           # S3 upload and existence check
│   └── utils/
│       └── constants.js            # FILE_STATUS, BATCH_SIZE, BACKUP_FREQUENCY
├── .env                            # Local environment variables
├── .env.example                    # Configuration template
├── package.json
└── README.md
```

---

## Execution Flow

### Startup
1. Service starts, logs frequency and batch size
2. Runs one full cycle immediately (document backup + database backup)
3. Enters the schedule loop: sleep → cycle → repeat

### Per-Cycle: Document Backup (`backup.js`)
```
Query axis-backend /api/s3-document?status=0&limit=BATCH_SIZE
For each pending document:
  → Check file exists locally (skip if missing)
  → Check file exists in S3 (idempotency; mark synced if found)
  → Upload to S3 (stream, not buffer)
  → Update status to 1 via axis-backend PUT /api/s3-document
  → Retry up to 3 times on failure (2s / 4s linear backoff)
Repeat until no more pending docs or MAX_CYCLES (100) reached
```

### Per-Cycle: Database Backup (`database-backup.js`)
```
Read DATABASE_BACKUP_FOLDER_URI (optional — skip if not configured)
Find most recent *.sql.gz file (filename prefix: YYYY-MM-DD)
Check if database/{filename} exists in S3 (skip if already uploaded)
Upload to S3 under database/ prefix
```

---

## Reliability Features

| Feature | Detail |
|---------|--------|
| **Retry logic** | Each file upload retried up to 3 times; linear backoff: 2 s, 4 s |
| **Idempotency** | `HeadObjectCommand` checks S3 before uploading; safe to re-run |
| **Cycle guard** | Inner loop capped at `MAX_CYCLES = 100` iterations |
| **Graceful shutdown** | SIGTERM / SIGINT sets `shuttingDown = true`; service completes current cycle then exits cleanly |
| **Streaming uploads** | `fs.createReadStream()` + `ContentLength` — files never fully loaded into memory |

---

## API Integration

### axis-backend endpoints used
```
GET  /api/s3-document?status=0&limit={BATCH_SIZE}  # Fetch pending documents
PUT  /api/s3-document                              # Update document status to synced
```

No authentication token is required — the service communicates over localhost.

---

## Content Types

Files are uploaded to S3 with the correct `ContentType` based on extension:

| Extension | Content Type |
|-----------|-------------|
| `.pdf` | `application/pdf` |
| `.jpg` / `.jpeg` | `image/jpeg` |
| `.png` | `image/png` |
| `.csv` | `text/csv` |
| `.gz` | `application/gzip` |
| `.sql` | `application/sql` |
| other | `application/octet-stream` |

---

## Environment Configuration

```env
# axis-backend API
API_URL="http://127.0.0.1:3000/api/"

# Path to axis-documents uploads root
DOCUMENTS_FOLDER_URI="/path/to/axis-documents"

# Optional: path to folder containing compressed MySQL dumps
# Files must be named: YYYY-MM-DD.database_name.sql.gz
DATABASE_BACKUP_FOLDER_URI="/path/to/database/backups"

# AWS S3
AWS_S3_BUCKET_NAME="axis-documents-bucket"
AWS_S3_BUCKET_REGION="us-east-1"
AWS_S3_BUCKET_ACCESS_KEY="<access-key>"
AWS_S3_BUCKET_SECRET_ACCESS_KEY="<secret-key>"

# Tuning
BATCH_SIZE=20            # Documents per cycle (default: 20)
BACKUP_FREQUENCY=3600000 # Cycle interval in ms (default: 1 hour)
```

---

## Scripts

```bash
npm start        # Start the service (production)
npm run dev      # Development with file watching (nodemon)
npm run lint     # Code quality check
npm run lint:fix # Auto-fix linting issues
```

---

## Logging

All output goes to stdout. Log prefixes:

| Prefix | Meaning |
|--------|---------|
| `[OK]` | File successfully uploaded |
| `[SKIP]` | File skipped (not found locally or already in S3) |
| `[RETRY]` | Retrying a failed upload |
| `[ERROR]` | Upload failed after all retries |
| `[WARN]` | Cycle guard limit reached |
| `[DB BACKUP]` | Database backup messages |
| `[DB BACKUP ERROR]` | Database backup failure |

---

## Node Version
- Required: >=14.21.3 <=20.9.0 (declared in `package.json` engines)
- Runtime on VPS: v16.20.2
