# axis-s3-backup — Changelog

All notable changes to this service are documented here.
Format: newest entry at the top.

---

## 2026-04-11 — Code Quality Audit

### Reliability
- **`app/index.js`** — added startup validation: service exits with a clear error message if any required env var (`API_URL`, `DOCUMENTS_FOLDER_URI`, `AWS_S3_BUCKET_NAME`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) is missing
- **`app/index.js`** — added `unhandledRejection` and `uncaughtException` process handlers; wrapped IIFE in `try/catch` with `process.exit(1)` on startup error
- **`app/services/s3-service.js`** — `uploadToS3`: file read stream is now explicitly destroyed on upload failure, preventing file descriptor leaks
- **`app/actions/database-backup.js`** — wrapped `fs.readdirSync` call in `try/catch`; a missing or unreadable backup folder logs a warning and returns `null` instead of crashing

### Code Quality
- **`app/utils/constants.js`** — `parseInt` calls for `BATCH_SIZE` and `BACKUP_FREQUENCY` now pass explicit radix 10; invalid values emit a `[WARN]` log and fall back to defaults instead of silently producing `NaN`
- **`app/services/api-service.js`** — removed redundant `dotenv.config()` call; added `timeout: 10000` to `axios.create` so hung API requests eventually fail
- **`app/services/s3-service.js`** — removed redundant `dotenv.config()` call
- **`app/actions/backup.js`** — removed redundant `dotenv.config()` call
- **`app/actions/database-backup.js`** — removed redundant `dotenv.config()` call

---

## 2026-03-24 — Reliability & Housekeeping

- **`package.json`** — `engines.node` tightened to `16.20.2` to match `.nvmrc` and VPS runtime

---

## 2026-03-13 — Security & Reliability Hardening

### Graceful Shutdown
- **`app/index.js`** — added `SIGTERM` and `SIGINT` handlers; replaced `while(true)` with `while(!shuttingDown)`; added post-sleep check to avoid starting a new cycle after a signal

### Retry Logic
- **`app/actions/backup.js`** — added `withRetry(fn, label)` helper (3 attempts, 2s/4s linear backoff); `processFile` calls wrapped with retry for transient S3/API failures

### Cycle Guard
- **`app/actions/backup.js`** — inner `while(true)` replaced with `while(cycles < MAX_CYCLES)` (MAX_CYCLES = 100) to prevent infinite loops on persistent API errors

### Memory Efficiency
- **`app/services/s3-service.js`** — `uploadToS3`: replaced `fs.readFileSync()` (full file in memory) with `fs.createReadStream()` + `ContentLength` from `fs.statSync().size`
