/**
 * ÖZARA Database Online Snapshot Backup Tool
 * Performs online backup using better-sqlite3 WAL mode snapshot API.
 * Keeps existing database active with zero locking/downtime.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

const defaultDbName = fs.existsSync(path.join(__dirname, '..', 'ozara.db')) ? 'ozara.db' : 'sila.db';
const dbPath = process.env.DATABASE_PATH || path.join(process.env.DATABASE_DIR || path.join(__dirname, '..'), defaultDbName);
const backupDir = process.env.BACKUP_DIR || path.join(path.dirname(dbPath), 'backups');

async function runBackup() {
  console.log(`[BACKUP] Source database: ${dbPath}`);
  console.log(`[BACKUP] Destination directory: ${backupDir}`);

  if (!fs.existsSync(dbPath)) {
    console.error(`[BACKUP ERROR] Database file not found at: ${dbPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `ozara-backup-${timestamp}.db`;
  const targetPath = path.join(backupDir, backupFileName);

  const db = new Database(dbPath, { readonly: true });
  try {
    await db.backup(targetPath);
    const stats = fs.statSync(targetPath);
    console.log(`[BACKUP SUCCESS] Created snapshot: ${backupFileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    // Prune backups older than retention days
    const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10);
    const now = Date.now();
    const files = fs.readdirSync(backupDir);
    let prunedCount = 0;

    for (const file of files) {
      if (file.startsWith('ozara-backup-') && file.endsWith('.db')) {
        const filePath = path.join(backupDir, file);
        const fStats = fs.statSync(filePath);
        if (now - fStats.mtimeMs > retentionDays * 24 * 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
          prunedCount++;
          console.log(`[BACKUP PRUNE] Removed expired snapshot: ${file}`);
        }
      }
    }
    console.log(`[BACKUP] Retention check complete. Pruned: ${prunedCount} snapshot(s).`);
  } catch (err) {
    console.error(`[BACKUP ERROR] Snapshot failed:`, err);
    process.exit(1);
  } finally {
    db.close();
  }
}

runBackup();
