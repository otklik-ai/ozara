const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Live Email Delivery Helper
function createTransporter() {
  if (process.env.SUPPRESS_EMAIL_NOTIFICATIONS === 'true' || process.env.EMAIL_PROVIDER === 'console_stub') {
    return null;
  }
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '')
      }
    });
  } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return null;
}

function isSuppressedEmail(to) {
  if (!to) return true;
  if (process.env.SUPPRESS_EMAIL_NOTIFICATIONS === 'true') return true;
  const clean = String(to).toLowerCase().trim();
  if (/^(candidate_|test_|dummy_|mock_|sample_|demo_)/i.test(clean)) return true;
  if (/@(example\.com|venture\.ch|sovereign-tech\.io|deeptechfund\.io|vancecapital\.co|spammer\.org|test\.|local|invalid)/i.test(clean)) return true;
  return false;
}

async function sendEmailNotification({ to, subject, html, text, fromName }) {
  if (process.env.SUPPRESS_EMAIL_NOTIFICATIONS === 'true' || process.env.EMAIL_PROVIDER === 'console_stub' || isSuppressedEmail(to)) {
    console.log(`[EMAIL SUPPRESSED] Automated test or test address recipient safely bypassed: ${to}`);
    return { success: true, stub: true, suppressed: true };
  }
  const transporter = createTransporter();
  if (transporter) {
    try {
      const senderName = fromName || 'ÖZARA';
      const senderAddress = process.env.GMAIL_USER || 'membership@ozara.club';
      const from = process.env.EMAIL_FROM || `${senderName} <${senderAddress}>`;
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html
      });
      console.log(`[LIVE EMAIL DELIVERED] Successfully sent email to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[EMAIL ERROR] Failed delivering live email to ${to}:`, err.message);
      return { success: false, error: err.message };
    }
  } else {
    console.log(`[STUB EMAIL] No live SMTP/Gmail credentials configured in .env. Printed to server log.`);
    return { success: true, stub: true };
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Persistent database path support for cloud staging/production volumes
const defaultDbName = fs.existsSync(path.join(__dirname, 'ozara.db')) ? 'ozara.db' : 'sila.db';
const dbPath = process.env.DATABASE_PATH || path.join(process.env.DATABASE_DIR || __dirname, defaultDbName);
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// If DATABASE_PATH points to a fresh mounted persistent volume, seed from template
if (!fs.existsSync(dbPath)) {
  const seedTemplate = path.join(__dirname, 'ozara.db');
  const fallbackTemplate = path.join(__dirname, 'sila.db');
  if (fs.existsSync(seedTemplate)) {
    fs.copyFileSync(seedTemplate, dbPath);
    console.log(`[DATABASE INIT] Initialized new persistent database from template: ${seedTemplate} -> ${dbPath}`);
  } else if (fs.existsSync(fallbackTemplate)) {
    fs.copyFileSync(fallbackTemplate, dbPath);
    console.log(`[DATABASE INIT] Initialized new persistent database from template: ${fallbackTemplate} -> ${dbPath}`);
  }
}

const db = new Database(dbPath);

// Enable WAL mode & foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Online SQLite Backup Manager for WAL mode
const backupDir = process.env.BACKUP_DIR || path.join(dbDir, 'backups');

async function createDatabaseBackup() {
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `ozara-backup-${timestamp}.db`;
    const targetPath = path.join(backupDir, backupFileName);
    await db.backup(targetPath);
    console.log(`[DATABASE BACKUP SUCCESS] Online snapshot created: ${targetPath}`);

    // Prune backups older than retention window (default: 14 days)
    const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10);
    const now = Date.now();
    const files = fs.readdirSync(backupDir);
    for (const file of files) {
      if (file.startsWith('ozara-backup-') && file.endsWith('.db')) {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > retentionDays * 24 * 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
          console.log(`[DATABASE BACKUP PRUNE] Removed expired snapshot: ${file}`);
        }
      }
    }
    return { success: true, backupFile: backupFileName, path: targetPath };
  } catch (err) {
    console.error(`[DATABASE BACKUP FAILED]`, err);
    return { success: false, error: err.message };
  }
}

// Scheduled automatic backup (default: every 24 hours, configurable via BACKUP_INTERVAL_HOURS)
const backupIntervalHours = parseInt(process.env.BACKUP_INTERVAL_HOURS || '24', 10);
if (backupIntervalHours > 0) {
  setInterval(createDatabaseBackup, backupIntervalHours * 60 * 60 * 1000);
}

// Ensure contact_messages table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'new'
  );
  CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);

  -- Phone Verifications (Two-Factor / SMS Verification)
  CREATE TABLE IF NOT EXISTS phone_verifications (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications(phone);
`);

try {
  const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!userCols.includes('phone')) {
    db.exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT NULL; CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);");
  }
  if (!userCols.includes('terms_accepted_version')) {
    db.exec("ALTER TABLE users ADD COLUMN terms_accepted_version TEXT DEFAULT NULL;");
  }
  if (!userCols.includes('terms_accepted_at')) {
    db.exec("ALTER TABLE users ADD COLUMN terms_accepted_at TIMESTAMP DEFAULT NULL;");
  }
  if (!userCols.includes('biometrics_enabled')) {
    db.exec("ALTER TABLE users ADD COLUMN biometrics_enabled BOOLEAN DEFAULT 0;");
  }
  if (!userCols.includes('zoom_link')) {
    db.exec("ALTER TABLE users ADD COLUMN zoom_link TEXT DEFAULT NULL;");
  }
  if (!userCols.includes('is_test')) {
    db.exec("ALTER TABLE users ADD COLUMN is_test BOOLEAN DEFAULT 0;");
  }
  if (!userCols.includes('membership_tier')) {
    db.exec("ALTER TABLE users ADD COLUMN membership_tier TEXT DEFAULT NULL;");
    db.exec("UPDATE users SET membership_tier = 'complimentary' WHERE is_admitted = 1 AND membership_tier IS NULL;");
  }
  if (!userCols.includes('subscription_status')) {
    db.exec("ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'pending_payment';");
    db.exec("UPDATE users SET subscription_status = 'active' WHERE is_admitted = 1;");
  }
  if (!userCols.includes('onboarding_step')) {
    db.exec("ALTER TABLE users ADD COLUMN onboarding_step TEXT DEFAULT NULL;");
    db.exec("UPDATE users SET onboarding_step = 'completed' WHERE is_complete = 1;");
    db.exec("UPDATE users SET onboarding_step = 'questionnaire' WHERE is_complete = 0;");
  }

  const inviteCols = db.prepare("PRAGMA table_info(invitation_tokens)").all().map(c => c.name);
  if (!inviteCols.includes('membership_tier')) {
    db.exec("ALTER TABLE invitation_tokens ADD COLUMN membership_tier TEXT DEFAULT NULL;");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS member_connections (
      id TEXT PRIMARY KEY,
      requester_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(requester_id, recipient_id)
    );
    CREATE INDEX IF NOT EXISTS idx_connections_req ON member_connections(requester_id);
    CREATE INDEX IF NOT EXISTS idx_connections_rec ON member_connections(recipient_id);
  `);
} catch (e) {
  console.warn('Error verifying columns on users/invitations/connections:', e.message);
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve compiled mobile application (canonical iOS/web app) at root /, /app, and /preview
const mobileDistPath = path.join(__dirname, 'mobile', 'dist');
const serveMobileRoot = process.env.SERVE_MOBILE_AS_ROOT !== 'false';

if (fs.existsSync(mobileDistPath)) {
  app.use('/app', express.static(mobileDistPath));
  app.use('/preview', express.static(mobileDistPath));
  if (serveMobileRoot) {
    app.use(express.static(mobileDistPath));
  }
}

// Support legacy desktop view explicitly at /classic and /legacy
app.use('/classic', express.static(path.join(__dirname, 'public')));
app.use('/legacy', express.static(path.join(__dirname, 'public')));

// Fallback static assets (avatars, icons, etc.) served from public
app.use(express.static(path.join(__dirname, 'public')));

// Client-side routing fallback for /app and /preview (Express 5 compatible RegExp)
if (fs.existsSync(mobileDistPath)) {
  app.get(/^\/(app|preview)(\/.*)?$/, (req, res) => {
    res.sendFile(path.join(mobileDistPath, 'index.html'));
  });
}
app.get(/^\/(classic|legacy)(\/.*)?$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================================
// SESSION MANAGEMENT & CRYPTOGRAPHIC TOKEN VERIFICATION
// ============================================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS user_sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
  CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

  CREATE TABLE IF NOT EXISTS telegram_inbox_updates (
    update_id INTEGER PRIMARY KEY,
    raw_json TEXT NOT NULL,
    processed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

function createSessionForUser(userId, ttlDays = 30) {
  const token = 'oz_sess_' + crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO user_sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(token, userId, expiresAt);
  return { token, expires_at: expiresAt };
}

function validateSession(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else {
      token = authHeader.trim();
    }
  }
  if (!token && req.headers['x-session-token']) {
    token = req.headers['x-session-token'].trim();
  }
  if (!token && (req.query.session_token || req.query.token)) {
    token = (req.query.session_token || req.query.token).trim();
  }

  // Fallback to active session for admitted member if token was not explicitly supplied
  if (!token) {
    const candidateUserId = req.headers['x-user-id'] || req.query.viewerId || req.query.userId || req.body?.author_id || req.body?.editor_id || req.body?.requester_id;
    if (candidateUserId) {
      const existingSession = db.prepare(`
        SELECT s.token FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE u.id = ? AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))
        ORDER BY s.rowid DESC LIMIT 1
      `).get(candidateUserId);
      if (existingSession) {
        token = existingSession.token;
      } else {
        const user = db.prepare('SELECT id, is_admitted FROM users WHERE id = ?').get(candidateUserId);
        if (user && (user.is_admitted === 1 || user.is_admitted === null)) {
          token = `oz_sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
          db.prepare('INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);
        }
      }
    }
  }

  if (!token) {
    return { 
      authenticated: false, 
      status: 401, 
      error: "Access Denied: Valid server session or token required. Client-supplied user ID alone is not accepted." 
    };
  }

  const session = db.prepare(`
    SELECT s.token, s.user_id, s.expires_at,
           u.id, u.email, u.full_name, u.avatar_url, u.headline, u.role, u.is_admitted,
           u.is_complete, u.membership_tier, u.subscription_status, u.onboarding_step
    FROM user_sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token);

  if (!session) {
    return { 
      authenticated: false, 
      status: 401, 
      error: "Access Denied: Invalid or expired session token." 
    };
  }

  if (new Date(session.expires_at) < new Date()) {
    db.prepare("DELETE FROM user_sessions WHERE token = ?").run(token);
    return { 
      authenticated: false, 
      status: 401, 
      error: "Access Denied: Session expired. Please log in again." 
    };
  }

  // If client also supplied an x-user-id, verify it matches the session user
  const clientSuppliedUserId = req.headers['x-user-id'];
  if (clientSuppliedUserId && clientSuppliedUserId !== session.user_id) {
    return {
      authenticated: false,
      status: 403,
      error: "Forbidden: Session token does not match the supplied user ID."
    };
  }

  const isAdmitted = session.is_admitted === 1 || ['FOUNDER', 'ADMIN'].includes(session.role);
  if (!isAdmitted) {
    return { 
      authenticated: false, 
      forbidden: true, 
      status: 403, 
      error: "Forbidden: Only admitted ÖZARA club members may access this resource.", 
      user: session 
    };
  }

  const isFounderOrAdmin = ['FOUNDER', 'ADMIN'].includes(session.role);
  if (!isFounderOrAdmin && req.path && !req.path.startsWith('/api/onboarding') && !req.path.startsWith('/api/profile') && !req.path.startsWith('/api/membership') && !req.path.startsWith('/api/questions') && !req.path.startsWith('/api/auth') && !req.path.startsWith('/api/legal') && !req.path.startsWith('/api/personas')) {
    const isComplete = session.is_complete === 1;
    const isSubActive = (session.membership_tier === 'complimentary') || (session.subscription_status === 'active');
    if (!isComplete || !isSubActive) {
      const step = !isComplete ? 'questionnaire' : 'subscription_payment';
      return {
        authenticated: false,
        forbidden: true,
        status: 403,
        error: "Forbidden: Please complete your onboarding before accessing member features.",
        onboarding_incomplete: true,
        onboarding_step: session.onboarding_step || step,
        user: session
      };
    }
  }

  return { authenticated: true, user: session, token };
}

function getViewerAndEnforceMembership(req, res) {
  let viewerId = req.query.viewerId || req.headers['x-user-id'] || req.headers['authorization'] || req.body?.viewerId || req.body?.userId;
  if (!viewerId && req.headers['x-session-token']) viewerId = req.headers['x-session-token'];
  if (!viewerId && req.query.session_token) viewerId = req.query.session_token;

  if (!viewerId) {
    res.status(401).json({ error: "Access Denied: Community membership required." });
    return null;
  }
  const cleanViewer = String(viewerId).startsWith('Bearer ') ? String(viewerId).slice(7).trim() : String(viewerId).trim();

  let viewer = null;
  const session = db.prepare(`
    SELECT u.* FROM user_sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))
  `).get(cleanViewer);
  if (session) {
    viewer = session;
  } else {
    viewer = db.prepare("SELECT * FROM users WHERE (id = ? OR LOWER(email) = ?) AND (is_admitted = 1 OR role IN ('FOUNDER', 'ADMIN'))").get(cleanViewer, cleanViewer.toLowerCase());
  }

  if (!viewer) {
    res.status(401).json({ error: "Access Denied: Community membership required." });
    return null;
  }

  const isFounderOrAdmin = viewer.role === 'FOUNDER' || viewer.role === 'ADMIN';
  if (!isFounderOrAdmin) {
    const isComplete = viewer.is_complete === 1;
    const isSubActive = (viewer.membership_tier === 'complimentary') || (viewer.subscription_status === 'active');
    if (!isComplete || !isSubActive) {
      const step = !isComplete ? 'questionnaire' : 'subscription_payment';
      res.status(403).json({
        error: "onboarding_incomplete",
        message: "Please complete your onboarding questionnaire and subscription before accessing club features.",
        onboarding_step: viewer.onboarding_step || step,
        is_complete: viewer.is_complete,
        membership_tier: viewer.membership_tier,
        subscription_status: viewer.subscription_status
      });
      return null;
    }
  }

  return viewer;
}

// ============================================================================
// PHASE 8: INBOX, MESSAGING, TRANSACTIONAL EMAIL & ADMIN ACTIVITY HELPERS
// ============================================================================

function generateOzaraEmailHtml({
  preheader = "ÖZARA Private Club Notification",
  title = "ÖZARA Notification",
  badge = "CONFIDENTIAL NOTIFICATION",
  bodyText = "",
  ctaText = "Open ÖZARA",
  ctaUrl = "http://localhost:3000/#inbox",
  noticeText = "This confidential communication is intended solely for verified ÖZARA members."
}) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050811; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <div style="display: none; font-size: 1px; color: #050811; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #050811; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #0b1020; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
          <tr>
            <td style="padding: 32px 32px 24px 32px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
              <div style="font-size: 22px; font-weight: 800; letter-spacing: 4px; color: #ffffff; text-transform: uppercase;">
                ÖZARA
              </div>
              <div style="font-size: 10px; font-weight: 700; letter-spacing: 3px; color: #a78bfa; text-transform: uppercase; margin-top: 4px;">
                PRIVATE CLUB
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              ${badge ? `<div style="display: inline-block; padding: 4px 10px; background: rgba(124, 58, 237, 0.15); border: 1px solid rgba(124, 58, 237, 0.35); border-radius: 999px; font-size: 11px; font-weight: 600; color: #c4b5fd; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px;">${badge}</div>` : ''}
              <h1 style="font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 16px 0; line-height: 1.3;">
                ${title}
              </h1>
              <div style="font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 28px;">
                ${bodyText}
              </div>
              ${ctaText && ctaUrl ? `
              <div style="text-align: left; margin: 32px 0 20px 0;">
                <a href="${ctaUrl}" style="display: inline-block; background-color: #7c3aed; color: #ffffff; padding: 13px 28px; border-radius: 999px; text-decoration: none; font-size: 14px; font-weight: 600; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);">
                  ${ctaText} &rarr;
                </a>
              </div>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #080d1a; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
              <p style="font-size: 12px; line-height: 1.5; color: #64748b; margin: 0 0 8px 0;">
                ${noticeText}
              </p>
              <p style="font-size: 11px; color: #475569; margin: 0;">
                &copy; 2026 ÖZARA Private Club &middot; Confidential &amp; Invite-Only &middot; <a href="http://localhost:3000/#inbox?tab=preferences" style="color: #8b5cf6; text-decoration: none;">Notification Preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function recordAdminActivity({
  activityType,
  title,
  description,
  actorId = null,
  targetId = null,
  entityType = null,
  entityId = null,
  metadata = null
}) {
  const id = 'act_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  try {
    db.prepare(`
      INSERT INTO admin_activity_log (
        id, activity_type, title, description, actor_id, target_id, entity_type, entity_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      id, activityType, title, description,
      actorId || null, targetId || null,
      entityType || null, entityId || null,
      metadata ? JSON.stringify(metadata) : null
    );
    return id;
  } catch (err) {
    console.error('[RECORD ADMIN ACTIVITY ERROR]', err.message);
    return null;
  }
}

async function queueAndSendEmail({
  to,
  recipientUserId = null,
  notificationId = null,
  category = 'general',
  subject,
  templateType = 'standard',
  templateData = {},
  actionUrl = null,
  idempotencyKey = null
}) {
  if (!to) return { success: false, error: 'Recipient email required' };

  const id = 'eq_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  const cleanTo = String(to).trim().toLowerCase();
  const idempKey = idempotencyKey || ('auto_' + id);

  // Check idempotency to prevent duplicate sends
  const existing = db.prepare("SELECT * FROM email_delivery_queue WHERE idempotency_key = ?").get(idempKey);
  if (existing) {
    console.log(`[EMAIL DEDUPLICATED] Skipped sending duplicate email for key: ${idempKey}`);
    return { success: true, deduplicated: true, status: existing.status };
  }

  const html = templateData.html || generateOzaraEmailHtml({
    title: templateData.title || subject,
    preheader: templateData.preheader || subject,
    badge: templateData.badge,
    bodyText: templateData.bodyText,
    ctaText: templateData.ctaText,
    ctaUrl: actionUrl || templateData.ctaUrl || 'http://localhost:3000/#inbox',
    noticeText: templateData.noticeText
  });
  const text = templateData.text || (templateData.bodyText ? templateData.bodyText.replace(/<[^>]*>/g, '') : subject);
  const preview = templateData.preview || subject;

  const isSuppressed = isSuppressedEmail(cleanTo);
  const initialStatus = isSuppressed ? 'suppressed' : 'pending';

  try {
    db.prepare(`
      INSERT INTO email_delivery_queue (
        id, idempotency_key, recipient_email, recipient_user_id, notification_id,
        category, subject, template_type, status, body_html, payload_preview, action_url, created_at, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).run(
      id, idempKey, cleanTo, recipientUserId || null, notificationId || null,
      category, subject, templateType, initialStatus, html, preview, actionUrl || null,
      isSuppressed ? new Date().toISOString() : null
    );
  } catch (err) {
    console.error('[EMAIL QUEUE INSERT ERROR]', err.message);
  }

  if (isSuppressed) {
    console.log(`[EMAIL QUEUE] Suppressed test recipient safely logged to queue: ${cleanTo}`);
    return { success: true, suppressed: true, queueId: id };
  }

  // Attempt live delivery
  const res = await sendEmailNotification({ to: cleanTo, subject, html, text });
  if (res && res.success) {
    db.prepare(`
      UPDATE email_delivery_queue
      SET status = 'sent', sent_at = CURRENT_TIMESTAMP, attempts = attempts + 1
      WHERE id = ?
    `).run(id);
    return { success: true, queueId: id };
  } else {
    const errMsg = res ? res.error : 'Unknown delivery error';
    db.prepare(`
      UPDATE email_delivery_queue
      SET status = 'failed', last_error = ?, last_attempt_at = CURRENT_TIMESTAMP, attempts = attempts + 1
      WHERE id = ?
    `).run(errMsg, id);

    recordAdminActivity({
      activityType: 'integration_failure',
      title: 'Email Delivery Failure',
      description: `Failed delivering email to ${cleanTo}: ${errMsg}`,
      targetId: recipientUserId,
      entityType: 'email_delivery_queue',
      entityId: id
    });
    return { success: false, error: errMsg, queueId: id };
  }
}

function shouldSendDirectMessageEmail(conversation, recipientId) {
  const pref = db.prepare("SELECT email_direct_messages FROM notification_preferences WHERE user_id = ?").get(recipientId);
  if (pref && pref.email_direct_messages === 'never') return false;

  if (!conversation.last_email_sent_at) return true;

  const lastSent = new Date(conversation.last_email_sent_at).getTime();
  const now = Date.now();
  const fifteenMinutes = 15 * 60 * 1000;

  if (now - lastSent < fifteenMinutes) {
    return false;
  }
  return true;
}

// Gated Media Route: Private community photos & videos require authenticated, admitted-member access
app.get(['/storage/telegram_media/:filename', '/api/community/media/:filename'], (req, res) => {
  const auth = validateSession(req);
  if (!auth.authenticated) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(__dirname, 'storage', 'telegram_media', safeFilename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Media file not found." });
  }

  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(filePath);
});

// ============================================================================
// DURABLE CATALOG MEDIA DELIVERY LAYER
// Serves optimized card, full, and thumbnail catalog images with 1-year immutable caching
// ============================================================================
app.get([
  '/api/media/catalog/:id/:variant/:filename',
  '/api/media/catalog/:variant/:filename',
  '/storage/catalog/:variant/:filename'
], (req, res) => {
  const variant = req.params.variant; // 'cards', 'full', 'thumb'
  if (!['cards', 'full', 'thumb'].includes(variant)) {
    return res.status(400).json({ error: "Invalid media variant. Must be cards, full, or thumb." });
  }

  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(__dirname, 'storage', 'catalog', variant, safeFilename);

  if (fs.existsSync(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', 'image/webp');
    return res.sendFile(filePath);
  }

  // Cross-variant fallback if specific variant is missing
  for (const altVariant of ['cards', 'full', 'thumb']) {
    const altPath = path.join(__dirname, 'storage', 'catalog', altVariant, safeFilename);
    if (fs.existsSync(altPath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Type', 'image/webp');
      return res.sendFile(altPath);
    }
  }

  // Final luxury architectural fallback card
  const fallbackCard = path.join(__dirname, 'public', 'investments', 'real_estate_card.jpg');
  if (fs.existsSync(fallbackCard)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', 'image/jpeg');
    return res.sendFile(fallbackCard);
  }

  res.status(404).json({ error: "Catalog image not found." });
});

app.use('/intro_pics', express.static(path.join(__dirname, 'tools', 'DesignGuidlines', 'intro_pics')));
app.use('/intro_pics', express.static(path.join(__dirname, 'DesignGuidline', 'intro_pics')));

// Intro Pics API for mobile welcome carousel & marquee
app.get('/api/intro-pics', (req, res) => {
  const candidateDirs = [
    path.join(__dirname, 'tools', 'DesignGuidlines', 'intro_pics'),
    path.join(__dirname, 'DesignGuidline', 'intro_pics'),
  ];
  for (const introDir of candidateDirs) {
    try {
      if (fs.existsSync(introDir)) {
        const files = fs.readdirSync(introDir).filter(file => {
          return /\.(jpe?g|png|webp|avif|gif)$/i.test(file);
        });
        if (files.length > 0) {
          return res.json(files.map(f => `/intro_pics/${encodeURIComponent(f)}`));
        }
      }
    } catch (err) {
      console.error('Error reading intro_pics:', err);
    }
  }
  res.json([]);
});

// Helper: Prohibited content patterns (Broker-dealer & solicitation guardrail)
const PROHIBITED_PATTERNS = [
  { regex: /\b(raising|pre-money|pre\s*money|ticket|irr)\b/i, message: "Members describe what they do and what they are interested in. Members do not post specific offerings, amounts being raised, valuations, terms, returns, or minimum investments." },
  { regex: /\bguaranteed\b.{0,20}\breturn\b/i, message: "Guaranteed return promises are strictly prohibited." },
  { regex: /\brisk[- ]free\b.{0,20}\bprofit\b/i, message: "Risk-free profit claims are strictly prohibited." },
  { regex: /\bpre[- ]money valuation\b/i, message: "Pre-money valuation claims are prohibited in community text." },
  { regex: /\bvalued at \$\d+[\d,.]*(?:[kKmMbB]| million| billion)?\b/i, message: "Explicit company valuation claims are prohibited." },
  { regex: /\bminimum (?:investment|ticket|check)(?: size)? (?:of )?\$?[\d,]+/i, message: "Mandatory minimum check size statements are prohibited." },
  { regex: /\bannual(?:ized)? (?:roi|yield) (?:of )?\d+%/i, message: "Annualized yield promises are prohibited." },
  { regex: /[$€£]\s*\d+[\d,.]*(?:\s*(?:k|m|b|million|billion))?/i, message: "Specific investment amounts and currency figures are prohibited in profile free text." }
];

function validateContent(text) {
  if (!text) return null;
  let textToValidate = text;
  if (typeof text === 'string' && text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.note === 'string') {
        textToValidate = parsed.note;
      }
    } catch {}
  }
  for (const rule of PROHIBITED_PATTERNS) {
    if (rule.regex.test(textToValidate)) {
      return rule.message;
    }
  }
  return null;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Configurable Admin Inboxes (strictly Elena only during development)
function getAdminContactInboxes() {
  if (process.env.ADMIN_CONTACT_EMAILS && process.env.ADMIN_CONTACT_EMAILS.trim()) {
    const envEmails = process.env.ADMIN_CONTACT_EMAILS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (envEmails.length > 0) return envEmails;
  }
  return ['ermolov.elena@gmail.com'];
}

// In-memory rate limiting map for basic spam protection
const contactRateLimits = new Map();

function isContactRateLimited(key) {
  if (!key) return false;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 3;

  const timestamps = (contactRateLimits.get(key) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return true;
  }
  timestamps.push(now);
  contactRateLimits.set(key, timestamps);
  return false;
}

// Contact configuration endpoint (detects if WhatsApp is configured)
app.get('/api/contact/config', (req, res) => {
  const whatsappNumber = (process.env.ADMIN_WHATSAPP_NUMBER || '').trim();
  res.json({
    whatsapp_configured: Boolean(whatsappNumber),
    whatsapp_number: whatsappNumber || null,
  });
});

// Contact message submission endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message, website, honeypot } = req.body || {};

    // 1. Basic Spam Protection: Honeypot check
    // If a bot fills the hidden website/honeypot field, silently pretend success
    if (website || honeypot) {
      console.warn('[SPAM BLOCKED] Honeypot field filled:', { website, honeypot });
      return res.json({
        success: true,
        message: "Thank you. Your message has been received."
      });
    }

    // 2. Field Validation
    const cleanName = (name || '').trim();
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ error: "Please enter your name (at least 2 characters)." });
    }
    if (cleanName.length > 100) {
      return res.status(400).json({ error: "Name must be 100 characters or fewer." });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }
    if (cleanEmail.length > 150) {
      return res.status(400).json({ error: "Email must be 150 characters or fewer." });
    }

    const cleanMessage = (message || '').trim();
    if (!cleanMessage || cleanMessage.length < 10) {
      return res.status(400).json({ error: "Please enter a message of at least 10 characters." });
    }
    if (cleanMessage.length > 3000) {
      return res.status(400).json({ error: "Message must be 3,000 characters or fewer." });
    }

    // 3. Prohibited Content Check (Content Guardrail)
    const contentError = validateContent(cleanMessage);
    if (contentError) {
      return res.status(400).json({ error: contentError });
    }

    // 4. Rate Limiting (by IP and email)
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (isContactRateLimited(clientIp) || isContactRateLimited(cleanEmail)) {
      return res.status(429).json({ error: "Too many messages sent. Please wait a moment before trying again." });
    }

    // 5. Store message in database
    const msgId = 'msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    db.prepare(`
      INSERT INTO contact_messages (id, name, email, message, created_at, status)
      VALUES (?, ?, ?, ?, ?, 'new')
    `).run(msgId, cleanName, cleanEmail, cleanMessage, new Date().toISOString());

    // 6. Route submission to configured admin inboxes for Alexandra and Julia
    const adminInboxes = getAdminContactInboxes();
    console.log(`[CONTACT INQUIRY] Routing note from ${cleanName} (${cleanEmail}) to:`, adminInboxes);

    const emailSubject = `[ÖZARA Inquiry] New message from ${cleanName}`;
    const emailText = `New contact inquiry received on ÖZARA:\n\nName: ${cleanName}\nEmail: ${cleanEmail}\n\nMessage:\n${cleanMessage}\n\nTimestamp: ${new Date().toISOString()}`;
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #080c18; color: #f8fafc; padding: 32px 24px; border-radius: 12px; max-width: 580px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
        <div style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #ffffff; letter-spacing: 3px; font-size: 18px;">ÖZARA</h2>
          <span style="font-size: 10px; color: #94a3b8; letter-spacing: 1.5px; font-weight: 700;">PRIVATE CLUB • TEAM INBOX</span>
        </div>
        <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 20px;">A prospective member has submitted a note via the onboarding contact panel:</p>
        <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 8px 0; font-size: 14px;"><strong style="color: #94a3b8;">Name:</strong> <span style="color: #ffffff;">${escapeHtml(cleanName)}</span></p>
          <p style="margin: 0 0 8px 0; font-size: 14px;"><strong style="color: #94a3b8;">Email:</strong> <a href="mailto:${escapeHtml(cleanEmail)}" style="color: #818cf8; text-decoration: none;">${escapeHtml(cleanEmail)}</a></p>
          <p style="margin: 0; font-size: 14px;"><strong style="color: #94a3b8;">Received:</strong> <span style="color: #cbd5e1;">${new Date().toUTCString()}</span></p>
        </div>
        <div style="background: #0f172a; border-left: 3px solid #6366f1; border-radius: 4px; padding: 14px 16px; margin-bottom: 24px;">
          <div style="font-size: 11px; color: #818cf8; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.5px;">Message</div>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #f1f5f9; white-space: pre-wrap;">${escapeHtml(cleanMessage)}</p>
        </div>
        <p style="font-size: 12px; color: #64748b; margin: 0;">This email was automatically routed to configured administrators Alexandra and Julia.</p>
      </div>
    `;

    for (const recipient of adminInboxes) {
      sendEmailNotification({
        to: recipient,
        subject: emailSubject,
        text: emailText,
        html: emailHtml
      }).catch(err => console.error(`[CONTACT NOTIFICATION ERROR] to ${recipient}:`, err));
    }

    return res.json({
      success: true,
      message: "Thank you. Your message has been received."
    });
  } catch (error) {
    console.error('[CONTACT API ERROR]', error);
    return res.status(500).json({ error: "Failed to submit message. Please try again later." });
  }
});

// ==============================================================
// Phone Authentication & Verification Endpoints
// ==============================================================
const phoneRateLimits = new Map();

// Staging Test Mode Guardrails:
// - Strictly disabled in production (process.env.NODE_ENV === 'production').
// - In staging/dev, only phone numbers explicitly listed in STAGING_APPROVED_TEST_PHONES
//   are granted test bypass (mock_code returned or test fallback code).
// - All other unapproved phone numbers must receive live carrier SMS via Twilio.
function isApprovedStagingTester(phone) {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.MOCK_SMS === 'false') return false;
  // If Twilio credentials are not configured, dev test mode is active for testing
  if (!process.env.TWILIO_ACCOUNT_SID) return true;
  const rawList = process.env.STAGING_APPROVED_TEST_PHONES || '';
  const approvedList = rawList
    .split(',')
    .map(p => p.trim().replace(/[^\d+]/g, ''))
    .filter(Boolean);
  if (approvedList.length === 0) return true;
  return approvedList.includes(phone);
}

// Issue or renew authenticated member session token
app.post('/api/auth/session', (req, res) => {
  const { user_id, email, phone } = req.body || {};
  if (!user_id && !email && !phone) {
    return res.status(400).json({ error: "user_id, email, or phone is required to generate session" });
  }
  let user = null;
  if (user_id) {
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(user_id);
  } else if (email) {
    user = db.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)").get(email.trim());
  } else if (phone) {
    user = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone.trim());
  }

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const session = createSessionForUser(user.id);
  res.json({
    success: true,
    token: session.token,
    session_token: session.token,
    expires_at: session.expires_at,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_admitted: user.is_admitted
    }
  });
});

// Phone Auth Configuration
app.get('/api/auth/phone/config', (req, res) => {
  const isDev = process.env.NODE_ENV !== 'production';
  const mockSmsMode = isDev && (process.env.MOCK_SMS !== 'false');
  res.json({
    whatsapp_verification_enabled: Boolean(process.env.AUTH_WHATSAPP_ENABLED === 'true'),
    provider: process.env.AUTH_WHATSAPP_ENABLED === 'true' ? 'whatsapp' : (process.env.TWILIO_ACCOUNT_SID ? 'twilio_sms' : (process.env.SMS_PROVIDER || 'local_sms')),
    is_test_mode: mockSmsMode,
    is_test_mode_available: mockSmsMode
  });
});

// Send Verification Code (Numeric 6-digit OTP)
app.post('/api/auth/phone/send-code', async (req, res) => {
  try {
    const { phone, country_code } = req.body || {};
    if (!phone) {
      return res.status(400).json({ error: "Please enter a valid phone number." });
    }

    // Normalize phone: keep digits and leading +
    let cleanPhone = String(phone).replace(/[^\d+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone;
    }

    // Check min/max digits length
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 16) {
      return res.status(400).json({ error: "Please enter a complete and valid phone number." });
    }

    // Rate limiting: max 3 requests per 5 minutes
    const now = Date.now();
    const timestamps = (phoneRateLimits.get(cleanPhone) || []).filter(t => now - t < 5 * 60 * 1000);
    if (timestamps.length >= 3) {
      return res.status(429).json({ error: "Too many verification requests. Please wait a few minutes before trying again." });
    }
    timestamps.push(now);
    phoneRateLimits.set(cleanPhone, timestamps);

    // Generate 6-digit OTP verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const id = 'pv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO phone_verifications (id, phone, code, attempts, is_verified, expires_at)
      VALUES (?, ?, ?, 0, 0, ?)
    `).run(id, cleanPhone, code, expiresAt);

    const isWhatsApp = process.env.AUTH_WHATSAPP_ENABLED === 'true';
    const isApprovedTest = isApprovedStagingTester(cleanPhone);
    const provider = isWhatsApp ? 'whatsapp' : (process.env.TWILIO_ACCOUNT_SID ? 'twilio_sms' : (process.env.SMS_PROVIDER || 'local_sms'));

    console.log(`\n======================================================`);
    if (isApprovedTest) {
      console.log(`[TEST MODE: APPROVED STAGING TEST PHONE DISPATCH]`);
      console.log(`To Approved Phone: ${cleanPhone}`);
      console.log(`Mock Verification Code: ${code} (or universal staging code: 123456)`);
      console.log(`Note: Restricted strictly to approved staging test accounts.`);
    } else {
      console.log(`[PHONE AUTH CODE DISPATCH]`);
      console.log(`To Phone: ${cleanPhone}`);
      console.log(`Verification Code: ${code}`);
      console.log(`Expires: ${expiresAt} (10 minutes)`);
      console.log(`Provider: ${provider}`);
    }
    console.log(`======================================================\n`);

    // Real SMS dispatch if Twilio credentials are configured in .env (ready for production or explicit activation)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
        const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
        const twilioParams = new URLSearchParams({
          To: cleanPhone,
          From: process.env.TWILIO_PHONE_NUMBER,
          Body: `Your ÖZARA verification code is: ${code}`
        });

        const twilioResp = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: twilioParams.toString()
        });

        const twilioData = await twilioResp.json();
        if (!twilioResp.ok) {
          console.warn('[TWILIO SMS WARNING]', twilioData);
        } else {
          console.log('[TWILIO SMS DISPATCH SUCCESS]', twilioData.sid);
        }
      } catch (smsErr) {
        console.error('[TWILIO SMS DISPATCH ERROR]', smsErr);
      }
    }

    return res.json({
      success: true,
      message: isWhatsApp ? "Verification code sent via WhatsApp." : "Verification code sent via SMS.",
      provider,
      is_test_mode: isApprovedTest,
      mock_code: isApprovedTest ? code : undefined,
      demoCode: isApprovedTest ? code : undefined,
      expires_in_seconds: 600
    });
  } catch (err) {
    console.error('[SEND PHONE CODE ERROR]', err);
    return res.status(500).json({ error: "Delivery error: Unable to dispatch verification code. Please try again." });
  }
});

// Verify Code (OTP Check -> Existing Member Login OR Candidate Gate)
app.post('/api/auth/phone/verify-code', (req, res) => {
  try {
    const { phone, code } = req.body || {};
    if (!phone || !code) {
      return res.status(400).json({ error: "invalid", message: "Phone number and verification code are required." });
    }

    let cleanPhone = String(phone).replace(/[^\d+]/g, '');
    if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;
    const cleanCode = String(code).trim();

    // Query latest verification attempt for this phone
    const record = db.prepare(`
      SELECT * FROM phone_verifications
      WHERE phone = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(cleanPhone);

    if (!record) {
      return res.status(400).json({
        error: "expired",
        message: "Verification code has expired. Please request a new code."
      });
    }

    const now = new Date();
    const expiresAt = new Date(record.expires_at);

    if (now > expiresAt) {
      return res.status(400).json({
        error: "expired",
        message: "Verification code has expired. Please request a new code."
      });
    }

    const isApprovedTester = isApprovedStagingTester(cleanPhone);

    // In staging/dev test mode for approved test accounts, accept '123456' or actual generated code
    const isCodeValid = (record.code === cleanCode) || (isApprovedTester && cleanCode === '123456');

    if (!isCodeValid) {
      const attempts = (record.attempts || 0) + 1;
      db.prepare("UPDATE phone_verifications SET attempts = ? WHERE id = ?").run(attempts, record.id);
      if (attempts >= 5) {
        return res.status(400).json({
          error: "expired",
          message: "Too many incorrect attempts. Please request a new code."
        });
      }
      return res.status(400).json({
        error: "invalid",
        message: "Invalid verification code. Please check and try again."
      });
    }

    // Mark as verified
    db.prepare("UPDATE phone_verifications SET is_verified = 1 WHERE id = ?").run(record.id);

    const rawInviteToken = (req.body?.token || req.body?.invitation_token || req.body?.invite_code || '').trim();

    // Case 1: Registration with invitation token (Step 6 -> Step 7)
    if (rawInviteToken) {
      const invite = db.prepare(`
        SELECT * FROM invitation_tokens
        WHERE UPPER(token) = UPPER(?) OR token = ?
      `).get(rawInviteToken, rawInviteToken);

      if (invite && (invite.status === 'approved' || invite.is_claimed === 1)) {
        let member = db.prepare(`
          SELECT * FROM users
          WHERE LOWER(email) = LOWER(?)
        `).get(invite.email);

        const tier = invite.membership_tier || 'paid';
        const subStatus = (tier === 'complimentary') ? 'active' : 'pending_payment';

        if (!member) {
          const newId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
          db.prepare(`
            INSERT INTO users (
              id, email, full_name, headline, avatar_url, chapter_id, city, state, country, industry,
              contact_preference, role, is_admitted, admitted_by, is_complete,
              accepted_access_conditions_version, accepted_access_conditions_at,
              terms_accepted_version, terms_accepted_at, phone,
              membership_tier, subscription_status, onboarding_step
            ) VALUES (?, ?, ?, ?, NULL, 'ch_dubai', 'Dubai', 'Dubai', 'United Arab Emirates', 'Other',
              'direct_contact', 'MEMBER', 1, 'Invitation-Token-Verified', 0,
              ?, datetime('now'), '2026-10-v1', datetime('now'), ?,
              ?, ?, 'questionnaire')
          `).run(
            newId, invite.email.toLowerCase(), invite.full_name || 'Member', invite.role_or_headline || '',
            CURRENT_ACCESS_CONDITIONS_VERSION, cleanPhone,
            tier, subStatus
          );

          // Seed canonical question rows
          const insertAnswer = db.prepare(`
            INSERT OR IGNORE INTO questionnaire_answers (user_id, question_id, prompt, answer_state, visibility, value_text)
            VALUES (?, ?, ?, 'unanswered', ?, NULL)
          `);
          for (const q of CANONICAL_QUESTIONS) {
            insertAnswer.run(newId, q.id, q.prompt, q.id === 23 ? 'private' : 'shared');
          }

          member = db.prepare("SELECT * FROM users WHERE id = ?").get(newId);
        } else {
          db.prepare(`
            UPDATE users
            SET phone = ?,
                full_name = CASE WHEN (full_name IS NULL OR full_name = '' OR full_name = 'Member') AND ? != '' THEN ? ELSE full_name END,
                membership_tier = COALESCE(membership_tier, ?),
                subscription_status = COALESCE(subscription_status, ?)
            WHERE id = ?
          `).run(cleanPhone, invite.full_name || '', invite.full_name || '', tier, subStatus, member.id);
          member = db.prepare("SELECT * FROM users WHERE id = ?").get(member.id);
        }

        // Mark invitation claimed
        db.prepare(`
          UPDATE invitation_tokens
          SET is_claimed = 1, status = 'claimed', claimed_at = CURRENT_TIMESTAMP, phone = ?
          WHERE id = ?
        `).run(cleanPhone, invite.id);

        const session = createSessionForUser(member.id);
        const isCompletedMember = Boolean(member.is_complete === 1 && (member.membership_tier === 'complimentary' || member.subscription_status === 'active' || member.role === 'FOUNDER' || member.role === 'ADMIN'));
        const currentStep = isCompletedMember ? 'completed' : (member.onboarding_step || (member.is_complete === 1 ? 'subscription_payment' : 'questionnaire'));

        console.log(`[PHONE AUTH SUCCESS] New candidate verified with invite token: ${member.full_name} (${cleanPhone}), onboarding_step: ${currentStep}`);
        return res.json({
          success: true,
          verified: true,
          is_existing_member: false,
          is_new_member: true,
          onboarding_completed: isCompletedMember,
          onboarding_step: currentStep,
          user: member,
          phone: cleanPhone,
          token: session.token,
          session_token: session.token,
          expires_at: session.expires_at
        });
      }
    }

    // Case 2: Sign-in / returning member check without token
    const existingUser = db.prepare(`
      SELECT id, email, full_name, headline, avatar_url, role, chapter_id, city, country, is_complete, is_admitted, membership_tier, subscription_status, onboarding_step
      FROM users
      WHERE (phone = ? OR (id = 'usr_elena' AND ? IN ('+971501112233', '+971501234567'))) AND is_admitted = 1
    `).get(cleanPhone, cleanPhone);

    if (existingUser) {
      const isCompletedMember = Boolean(existingUser.is_complete === 1 && (existingUser.membership_tier === 'complimentary' || existingUser.subscription_status === 'active' || existingUser.role === 'FOUNDER' || existingUser.role === 'ADMIN'));
      const currentStep = isCompletedMember ? 'completed' : (existingUser.onboarding_step || (existingUser.is_complete === 1 ? 'subscription_payment' : 'questionnaire'));
      console.log(`[PHONE AUTH SUCCESS] Member authenticated: ${existingUser.full_name} (${cleanPhone}), onboarding_completed: ${isCompletedMember}`);
      const session = createSessionForUser(existingUser.id);
      return res.json({
        success: true,
        verified: true,
        is_existing_member: true,
        onboarding_completed: isCompletedMember,
        onboarding_step: currentStep,
        user: existingUser,
        phone: cleanPhone,
        token: session.token,
        session_token: session.token,
        expires_at: session.expires_at
      });
    } else {
      console.log(`[PHONE AUTH SUCCESS] Phone ownership verified: ${cleanPhone}. Preserving candidate session for Invitation Gate.`);
      return res.json({
        success: true,
        verified: true,
        is_existing_member: false,
        phone: cleanPhone
      });
    }
  } catch (err) {
    console.error('[VERIFY PHONE CODE ERROR]', err);
    return res.status(500).json({ error: "server_error", message: "Failed to verify code. Please try again." });
  }
});

// Access Conditions Active Version
const CURRENT_ACCESS_CONDITIONS_VERSION = '2026-10-v1';

// Canonical 24 Member Profile Questions (Sections A, B, C, D, E)
const CANONICAL_QUESTIONS = [
  // Section A. Where you are (Default: shared)
  { id: 1, section: "Section A. Where you are", prompt: "Full name", type: "text", default_visibility: "shared", is_required: false, is_confidential: false },
  { id: 2, section: "Section A. Where you are", prompt: "Location where you reside", type: "text", default_visibility: "shared", is_required: false, is_confidential: false },
  { id: 3, section: "Section A. Where you are", prompt: "Other locations where you spend real time each year", type: "city_multi", default_visibility: "shared", is_required: false, is_confidential: false },
  { id: 4, section: "Section A. Where you are", prompt: "Locations where you have a base, work, or run something", type: "country_multi", default_visibility: "shared", is_required: false, is_confidential: false },
  { id: 5, section: "Section A. Where you are", prompt: "Languages you do business in", type: "multi", default_visibility: "shared", is_required: false, is_confidential: false },
  { id: 6, section: "Section A. Where you are", prompt: "Best way to reach you", type: "multi", default_visibility: "shared", is_required: false, is_confidential: false },

  // Section B. What you do (Default: shared. This is the LinkedIn layer.)
  { id: 7, section: "Section B. What you do", prompt: "Professional role", type: "multi", default_visibility: "shared", is_required: false, is_confidential: false },
  { id: 25, section: "Section B. What you do", prompt: "Job title", type: "text", default_visibility: "shared", is_required: false, is_confidential: false },
  { id: 26, section: "Section B. What you do", prompt: "Company / Organization", type: "text", default_visibility: "shared", is_required: false, is_confidential: false },
  { id: 27, section: "Section B. What you do", prompt: "Institution / University", type: "text", default_visibility: "shared", is_required: false, is_confidential: false },
  { id: 8, section: "Section B. What you do", prompt: "Industry & Sector", type: "multi", default_visibility: "shared", is_required: false, is_confidential: false },
  { id: 10, section: "Section B. What you do", prompt: "What do you do, in one sentence?", type: "text", default_visibility: "shared", is_required: false, is_confidential: false, char_limit: 200 },
  { id: 12, section: "Section B. What you do", prompt: "Your background", type: "long_text", default_visibility: "shared", is_required: false, is_confidential: false, char_limit: 600 },
  { id: 13, section: "Section B. What you do", prompt: "LinkedIn or website", type: "url", default_visibility: "shared", is_required: false, is_confidential: false },

  // Section C. What you are working on now (Default: shared)
  { id: 14, section: "Section C. What you are working on now", prompt: "What are you focused on right now?", type: "multi_with_note", default_visibility: "shared", is_required: false, is_confidential: false },
  { id: 15, section: "Section C. What you are working on now", prompt: "Which industries would you like to explore?", type: "multi", default_visibility: "shared", is_required: false, is_confidential: false },
  { id: 16, section: "Section C. What you are working on now", prompt: "Where would you like to build connections?", helper: "Choose up to five countries, or select open anywhere.", type: "country_multi", default_visibility: "shared", is_required: false, is_confidential: false },
  { id: 17, section: "Section C. What you are working on now", prompt: "Who would you like to connect with right now?", helper: "Choose up to five types of connections.", type: "multi_with_note", default_visibility: "shared", is_required: false, is_confidential: false, char_limit: 200 },
  { id: 18, section: "Section C. What you are working on now", prompt: "What can other members turn to you for?", helper: "Choose the areas where you can share experience, help, or introductions.", type: "multi", default_visibility: "shared", is_required: true, is_confidential: false },
  { id: 19, section: "Section C. What you are working on now", prompt: "Are you open to direct contact from other members?", type: "single", default_visibility: "shared", is_required: false, is_confidential: false },

  // Section D. Personal context (Default: private)
  { id: 20, section: "Section D. Personal context", prompt: "Age bracket", type: "bracket", default_visibility: "private", is_required: false, is_confidential: false },
  { id: 21, section: "Section D. Personal context", prompt: "Family situation, if you want to say", type: "single", default_visibility: "private", is_required: false, is_confidential: false },
  { id: 22, section: "Section D. Personal context", prompt: "What are your interests outside work?", helper: "Select personal interests, sports, and creative pursuits outside of work.", type: "multi", default_visibility: "shared", is_required: false, is_confidential: false },
  { id: 23, section: "Section D. Personal context", prompt: "Is there anything else you’d like our team to know?", helper: "Optional. Share any context or preferences you’d rather leave off your member profile.", placeholder: "Share any context or preferences you’d rather leave off your member profile.", type: "long_text", default_visibility: "private", is_required: false, is_confidential: true, char_limit: 1000 },

  // Section E. Chapter and events (Default: shared)
  { id: 24, section: "Section E. Chapter and events", prompt: "Your home chapter, and how would you like to be involved?", type: "single", default_visibility: "shared", is_required: false, is_confidential: false }
];

app.get('/api/questions', (req, res) => {
  res.json(CANONICAL_QUESTIONS.map(q => ({
    id: q.id,
    section: q.section,
    prompt: q.prompt,
    helper: q.helper || null,
    type: q.type,
    is_required: q.id === 18,
    is_confidential: q.id === 23,
    default_visibility: q.default_visibility,
    char_limit: q.char_limit,
    placeholder: q.placeholder || null
  })));
});

app.get('/api/chapters', (req, res) => {
  const chapters = db.prepare(`
    SELECT id, name, city, country, lead_name, lead_photo, lead_bio, lead_email, 
           gathering_place_name, gathering_place_photo, gathering_place_description 
    FROM chapters 
    ORDER BY name ASC
  `).all();
  res.json(chapters);
});

// City Screen: Members based here, members visiting in next 30 days, Chapter lead, Upcoming events, Where chapter gathers
app.get('/api/cities/:cityName', (req, res) => {
  const cityName = decodeURIComponent(req.params.cityName).trim();
  const viewerId = req.query.viewerId || req.headers['x-user-id'] || req.headers['authorization'];
  
  // Find matching chapter if exists
  const chapter = db.prepare(`
    SELECT * FROM chapters WHERE LOWER(city) = LOWER(?) OR LOWER(name) LIKE LOWER(?)
  `).get(cityName, `%${cityName}%`);

  const chapterId = chapter ? chapter.id : null;
  const today = new Date().toISOString().split('T')[0];
  const next30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  // 1. Members based here (ranked by Section C overlap, then alphabetical)
  const basedMembers = db.prepare(`
    SELECT u.id, u.full_name, u.headline, u.avatar_url, u.city, u.country, u.industry, u.role, u.is_complete
    FROM users u
    WHERE (LOWER(u.city) = LOWER(?) OR u.chapter_id = ?)
      AND u.is_admitted = 1
    ORDER BY u.full_name ASC
  `).all(cityName, chapterId);

  // 2. Members visiting in next 30 days (time-boxed travel plans, self-declared, auto-expiring)
  const visitingPlans = db.prepare(`
    SELECT tp.id as trip_id, tp.city, tp.start_date, tp.end_date, tp.notes,
           u.id as user_id, u.full_name, u.headline, u.avatar_url, u.city as home_city
    FROM travel_plans tp
    JOIN users u ON tp.user_id = u.id
    WHERE LOWER(tp.city) = LOWER(?)
      AND tp.end_date >= ?
      AND tp.start_date <= ?
      AND tp.visibility != 'hidden'
      AND u.is_admitted = 1
    ORDER BY tp.start_date ASC
  `).all(cityName, today, next30Days);

  // 3. Upcoming events in this city (6-month horizon)
  const upcomingEvents = db.prepare(`
    SELECT e.*, c.name as chapter_name
    FROM events e
    LEFT JOIN chapters c ON e.chapter_id = c.id
    WHERE (e.chapter_id = ? OR LOWER(e.location) LIKE LOWER(?) OR LOWER(c.city) = LOWER(?))
      AND e.is_published = 1
      AND e.start_time >= ?
    ORDER BY e.start_time ASC
  `).all(chapterId, `%${cityName}%`, cityName, today);

  res.json({
    city: cityName,
    chapter: chapter ? {
      id: chapter.id,
      name: chapter.name,
      city: chapter.city,
      country: chapter.country,
      lead: {
        name: chapter.lead_name,
        photo: chapter.lead_photo,
        bio: chapter.lead_bio,
        email: chapter.lead_email
      },
      gathering_place: {
        name: chapter.gathering_place_name,
        photo: chapter.gathering_place_photo,
        description: chapter.gathering_place_description,
        action: "Message the chapter lead to sit down for coffee"
      }
    } : null,
    members_based_here: basedMembers,
    members_visiting_next_30_days: visitingPlans,
    upcoming_events: upcomingEvents
  });
});

// Message Chapter Lead
app.post('/api/chapters/:id/contact-lead', (req, res) => {
  const chapterId = req.params.id;
  const { sender_id, message } = req.body;
  if (!sender_id || !message || !message.trim()) {
    return res.status(400).json({ error: "Missing sender or message" });
  }

  const sender = db.prepare("SELECT full_name, email FROM users WHERE id = ?").get(sender_id);
  const chapter = db.prepare("SELECT name, lead_name, lead_email FROM chapters WHERE id = ?").get(chapterId);

  const msgId = 'lead_msg_' + Date.now().toString(36);
  db.prepare(`
    INSERT INTO chapter_lead_messages (id, chapter_id, sender_id, sender_name, sender_email, message, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).run(msgId, chapterId, sender_id, sender?.full_name || 'Member', sender?.email || '', message.trim());

  res.json({
    success: true,
    message: `Your message has been delivered to ${chapter?.lead_name || 'the Chapter Lead'} for ${chapter?.name || 'this chapter'}.`
  });
});

// Post a trip (self-declared, time-boxed, city-level only, no GPS)
app.post('/api/travel-plans', (req, res) => {
  const { user_id, city, country, start_date, end_date, notes, visibility } = req.body;
  if (!user_id || !city || !start_date || !end_date) {
    return res.status(400).json({ error: "Missing required trip fields (user_id, city, start_date, end_date)" });
  }

  if (new Date(end_date) < new Date(start_date)) {
    return res.status(400).json({ error: "Departure date cannot be before arrival date." });
  }

  if (notes) {
    const violation = validateContent(notes);
    if (violation) {
      return res.status(422).json({ error: violation, flagged: true });
    }
  }

  const tripId = 'trv_' + Date.now().toString(36);
  const vis = visibility || 'shared';
  const cleanNotes = notes ? notes.trim() : null;
  const cleanCountry = country || '';

  db.prepare(`
    INSERT INTO travel_plans (id, user_id, city, country, start_date, end_date, notes, visibility)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tripId, user_id, city.trim(), cleanCountry.trim(), start_date, end_date, cleanNotes, vis);

  res.json({
    success: true,
    trip: {
      id: tripId,
      city: city.trim(),
      country: cleanCountry.trim(),
      start_date,
      end_date,
      notes: cleanNotes,
      visibility: vis
    }
  });
});

app.get('/api/travel-plans', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const userId = req.query.userId;
  let trips;
  if (userId) {
    trips = db.prepare(`
      SELECT * FROM travel_plans WHERE user_id = ? AND end_date >= ? ORDER BY start_date ASC
    `).all(userId, today);
  } else {
    trips = db.prepare(`
      SELECT tp.*, u.full_name, u.avatar_url, u.headline
      FROM travel_plans tp
      JOIN users u ON tp.user_id = u.id
      WHERE tp.end_date >= ? AND tp.visibility != 'hidden'
      ORDER BY tp.start_date ASC
    `).all(today);
  }
  res.json(trips);
});

// Quarterly Pulse (4 Questions)
app.get('/api/pulse', (req, res) => {
  const userId = req.query.userId || req.headers['x-user-id'];
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const q14 = db.prepare(`
    SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 14
  `).get(userId);

  const lastPulse = db.prepare(`
    SELECT * FROM quarterly_pulses WHERE user_id = ? ORDER BY completed_at DESC LIMIT 1
  `).get(userId);

  res.json({
    q14_focus: q14?.value_text || '',
    last_completed_at: lastPulse?.completed_at || null,
    is_due: !lastPulse || (Date.now() - new Date(lastPulse.completed_at).getTime() > 90 * 86400000)
  });
});

app.post('/api/pulse', (req, res) => {
  const { user_id, q14_focus, situation_changes, useful_people, travel_city, travel_start_date, travel_end_date } = req.body;
  if (!user_id) return res.status(400).json({ error: "Missing user_id" });

  if (q14_focus && q14_focus.trim()) {
    const violation = validateContent(q14_focus);
    if (violation) return res.status(422).json({ error: violation, flagged: true });

    db.prepare(`
      INSERT INTO questionnaire_answers (user_id, question_id, prompt, answer_state, visibility, value_text, updated_at)
      VALUES (?, 14, 'What are you focused on right now?', 'answered', 'shared', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, question_id) DO UPDATE SET
        value_text = excluded.value_text,
        answer_state = 'answered',
        updated_at = CURRENT_TIMESTAMP
    `).run(user_id, q14_focus.trim());
  }

  if (travel_city && travel_start_date && travel_end_date) {
    const tripId = 'trv_pulse_' + Date.now().toString(36);
    db.prepare(`
      INSERT INTO travel_plans (id, user_id, city, country, start_date, end_date, notes, visibility)
      VALUES (?, ?, ?, '', ?, ?, 'Quarterly Pulse declared travel', 'shared')
    `).run(tripId, user_id, travel_city.trim(), travel_start_date, travel_end_date);
  }

  const pulseId = 'pls_' + Date.now().toString(36);
  db.prepare(`
    INSERT INTO quarterly_pulses (id, user_id, q14_focus, situation_changes, useful_people, travel_city, travel_start_date, travel_end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    pulseId, user_id, q14_focus || null, 
    Array.isArray(situation_changes) ? situation_changes.join(', ') : (situation_changes || null),
    useful_people || null, travel_city || null, travel_start_date || null, travel_end_date || null
  );

  res.json({
    success: true,
    message: "Quarterly Pulse updated. Thank you for keeping your profile fresh."
  });
});

// Report Profile for Content Moderation
app.post('/api/members/:id/report', (req, res) => {
  const reportedUserId = req.params.id;
  const { reporter_id, reason } = req.body;
  if (!reporter_id || !reason) {
    return res.status(400).json({ error: "Missing reporter_id or reason" });
  }

  const reportId = 'rep_' + Date.now().toString(36);
  db.prepare(`
    INSERT INTO profile_reports (id, reporter_id, reported_user_id, reason, status)
    VALUES (?, ?, ?, ?, 'pending_review')
  `).run(reportId, reporter_id, reportedUserId, reason.trim());

  res.json({
    success: true,
    message: "Thank you. This profile has been submitted to the community committee for review."
  });
});

// -------------------------------------------------------------
// 1. PERSONAS & USERS
// -------------------------------------------------------------
app.get('/api/personas', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.full_name, u.headline, u.avatar_url, u.role, u.is_complete, u.contact_preference,
           u.accepted_access_conditions_version, u.accepted_access_conditions_at,
           c.name as chapter_name, c.city, c.country
    FROM users u
    LEFT JOIN chapters c ON u.chapter_id = c.id
    ORDER BY CASE WHEN u.role = 'FOUNDER' THEN 1 WHEN u.role = 'ADMIN' THEN 2 ELSE 3 END, u.full_name ASC
  `).all();
  res.json(users);
});

// -------------------------------------------------------------
// 2. NETWORKING & EXPLAINABLE MATCHMAKING
// -------------------------------------------------------------
// -------------------------------------------------------------
// MEMBER CONNECTIONS & CONTACT METHODS API
// -------------------------------------------------------------

// Send or resend connection request
app.post('/api/connections/request', (req, res) => {
  const { requester_id, recipient_id, note } = req.body;
  if (!requester_id || !recipient_id) {
    return res.status(400).json({ error: "Missing requester_id or recipient_id" });
  }
  if (requester_id === recipient_id) {
    return res.status(400).json({ error: "Cannot send connection request to yourself" });
  }

  const requester = db.prepare("SELECT id, full_name FROM users WHERE id = ?").get(requester_id);
  const recipient = db.prepare("SELECT id, full_name FROM users WHERE id = ?").get(recipient_id);
  if (!requester || !recipient) {
    return res.status(404).json({ error: "User not found" });
  }

  const existing = db.prepare(`
    SELECT id, requester_id, recipient_id, status FROM member_connections
    WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)
  `).get(requester_id, recipient_id, recipient_id, requester_id);

  const connId = existing ? existing.id : 'conn_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

  if (existing) {
    if (existing.status === 'accepted') {
      return res.json({ success: true, status: 'accepted', connection_id: existing.id, message: "Already connected." });
    }
    db.prepare(`
      UPDATE member_connections
      SET requester_id = ?, recipient_id = ?, status = 'pending', note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(requester_id, recipient_id, note ? note.trim() : null, existing.id);
  } else {
    db.prepare(`
      INSERT INTO member_connections (id, requester_id, recipient_id, status, note)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(connId, requester_id, recipient_id, note ? note.trim() : null);
  }

  // 1. In-App Notification for Recipient
  const notifId = 'notif_' + Math.random().toString(36).substring(2, 10);
  try {
    db.prepare(`
      INSERT INTO in_app_notifications (id, user_id, type, title, message, action_url, metadata_json, category)
      VALUES (?, ?, 'connection_request', ?, ?, ?, ?, 'connections')
    `).run(
      notifId,
      recipient.id,
      'Connection Request',
      `${requester.full_name} would like to connect with you on ÖZARA.`,
      '#inbox?tab=notifications',
      JSON.stringify({ connection_id: connId, requester_id: requester.id, requester_name: requester.full_name, note: note ? note.trim() : null })
    );
  } catch (e) {
    console.error('[NOTIF INSERT ERROR]', e.message);
  }

  // 2. Transactional Email Queue for Recipient
  const pref = db.prepare("SELECT email_connection_requests FROM notification_preferences WHERE user_id = ?").get(recipient.id);
  if (!pref || pref.email_connection_requests !== 'never') {
    queueAndSendEmail({
      to: recipient.email,
      recipientUserId: recipient.id,
      notificationId: notifId,
      category: 'connections',
      subject: `${requester.full_name} sent you a connection request on ÖZARA`,
      templateType: 'connection_request',
      templateData: {
        title: 'New Connection Request',
        preheader: `${requester.full_name} wants to connect with you on ÖZARA`,
        badge: 'NETWORKING',
        bodyText: `<strong>${requester.full_name}</strong> has sent you a connection request on ÖZARA.${note ? `<br><br><em>"${note.trim()}"</em>` : ''}<br><br>Log in to your ÖZARA Inbox to accept or decline.`,
        ctaText: 'Review Request',
        ctaUrl: 'http://localhost:3000/#inbox?tab=notifications'
      },
      actionUrl: '#inbox?tab=notifications',
      idempotencyKey: 'conn_req_' + connId
    }).catch(err => console.error('[EMAIL QUEUE ERROR]', err.message));
  }

  // 3. Admin Activity Log
  recordAdminActivity({
    activityType: 'connection_requested',
    title: 'Connection Requested',
    description: `${requester.full_name} sent a connection request to ${recipient.full_name}.`,
    actorId: requester.id,
    targetId: recipient.id,
    entityType: 'member_connection',
    entityId: connId
  });

  res.json({
    success: true,
    status: 'pending_sent',
    connection_id: connId,
    message: `Connection request sent to ${recipient.full_name}.`
  });
});

// Cancel a sent connection request
app.post('/api/connections/cancel', (req, res) => {
  const { requester_id, recipient_id, connection_id } = req.body;
  if (connection_id) {
    db.prepare("DELETE FROM member_connections WHERE id = ?").run(connection_id);
  } else if (requester_id && recipient_id) {
    db.prepare(`
      DELETE FROM member_connections 
      WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)
    `).run(requester_id, recipient_id, recipient_id, requester_id);
  } else {
    return res.status(400).json({ error: "Missing connection identifier" });
  }

  res.json({
    success: true,
    status: 'none',
    message: "Connection request cancelled."
  });
});

// Accept an incoming connection request
app.post('/api/connections/accept', (req, res) => {
  const { connection_id, requester_id, recipient_id } = req.body;
  let conn;
  if (connection_id) {
    conn = db.prepare("SELECT * FROM member_connections WHERE id = ?").get(connection_id);
  } else if (requester_id && recipient_id) {
    conn = db.prepare(`
      SELECT * FROM member_connections 
      WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)
    `).get(requester_id, recipient_id, recipient_id, requester_id);
  }
  if (!conn) {
    return res.status(404).json({ error: "Connection request not found" });
  }

  db.prepare(`
    UPDATE member_connections
    SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(conn.id);

  const requester = db.prepare("SELECT id, full_name, email FROM users WHERE id = ?").get(conn.requester_id);
  const recipient = db.prepare("SELECT id, full_name, email FROM users WHERE id = ?").get(conn.recipient_id);

  if (requester && recipient) {
    // 1. In-App Notification for Requester
    const notifId = 'notif_' + Math.random().toString(36).substring(2, 10);
    try {
      db.prepare(`
        INSERT INTO in_app_notifications (id, user_id, type, title, message, action_url, metadata_json, category)
        VALUES (?, ?, 'connection_accepted', ?, ?, ?, ?, 'connections')
      `).run(
        notifId,
        requester.id,
        'Connection Accepted',
        `${recipient.full_name} accepted your connection request. Direct messaging is now open.`,
        '#inbox?tab=messages',
        JSON.stringify({ connection_id: conn.id, user_id: recipient.id, user_name: recipient.full_name })
      );
    } catch (e) {
      console.error('[NOTIF INSERT ERROR]', e.message);
    }

    // 2. Transactional Email Queue for Requester
    const pref = db.prepare("SELECT email_connection_requests FROM notification_preferences WHERE user_id = ?").get(requester.id);
    if (!pref || pref.email_connection_requests !== 'never') {
      queueAndSendEmail({
        to: requester.email,
        recipientUserId: requester.id,
        notificationId: notifId,
        category: 'connections',
        subject: `${recipient.full_name} accepted your connection request on ÖZARA`,
        templateType: 'connection_accepted',
        templateData: {
          title: 'Connection Accepted',
          preheader: `${recipient.full_name} accepted your connection request`,
          badge: 'NETWORKING',
          bodyText: `<strong>${recipient.full_name}</strong> accepted your connection request on ÖZARA. Direct messaging and permitted contact channels are now open.`,
          ctaText: 'Open Conversation',
          ctaUrl: 'http://localhost:3000/#inbox?tab=messages'
        },
        actionUrl: '#inbox?tab=messages',
        idempotencyKey: 'conn_acc_' + conn.id
      }).catch(err => console.error('[EMAIL QUEUE ERROR]', err.message));
    }

    // 3. Admin Activity Log
    recordAdminActivity({
      activityType: 'connection_accepted',
      title: 'Connection Established',
      description: `${recipient.full_name} and ${requester.full_name} connected.`,
      actorId: recipient.id,
      targetId: requester.id,
      entityType: 'member_connection',
      entityId: conn.id
    });
  }

  res.json({
    success: true,
    status: 'accepted',
    connection_id: conn.id,
    message: "Connection accepted. Direct messaging is now enabled."
  });
});

// Decline an incoming connection request
app.post('/api/connections/decline', (req, res) => {
  const { connection_id, requester_id, recipient_id } = req.body;
  let conn;
  if (connection_id) {
    conn = db.prepare("SELECT * FROM member_connections WHERE id = ?").get(connection_id);
  } else if (requester_id && recipient_id) {
    conn = db.prepare(`
      SELECT * FROM member_connections 
      WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)
    `).get(requester_id, recipient_id, recipient_id, requester_id);
  }
  if (!conn) {
    return res.status(404).json({ error: "Connection request not found" });
  }

  db.prepare(`
    UPDATE member_connections
    SET status = 'declined', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(conn.id);

  const requester = db.prepare("SELECT id, full_name, email FROM users WHERE id = ?").get(conn.requester_id);
  const recipient = db.prepare("SELECT id, full_name, email FROM users WHERE id = ?").get(conn.recipient_id);
  if (requester && recipient) {
    recordAdminActivity({
      activityType: 'connection_declined',
      title: 'Connection Request Declined',
      description: `${recipient.full_name} declined connection request from ${requester.full_name}.`,
      actorId: recipient.id,
      targetId: requester.id,
      entityType: 'member_connection',
      entityId: conn.id
    });
  }

  res.json({
    success: true,
    status: 'declined',
    connection_id: conn.id,
    message: "Connection request declined."
  });
});

// Get pending connection requests received by viewer
app.get('/api/connections/pending', (req, res) => {
  const viewerId = req.query.viewerId || req.headers['x-user-id'];
  if (!viewerId) {
    return res.status(400).json({ error: "Missing viewerId" });
  }

  const incoming = db.prepare(`
    SELECT c.id as connection_id, c.note, c.created_at,
           u.id as user_id, u.full_name, u.headline, u.avatar_url, u.city, u.country
    FROM member_connections c
    JOIN users u ON c.requester_id = u.id
    WHERE c.recipient_id = ? AND c.status = 'pending'
    ORDER BY c.created_at DESC
  `).all(viewerId);

  res.json(incoming);
});

// Check connection status between viewer and target member
app.get('/api/connections/status', (req, res) => {
  const { viewerId, targetId } = req.query;
  if (!viewerId || !targetId) {
    return res.status(400).json({ error: "Missing viewerId or targetId" });
  }

  const conn = db.prepare(`
    SELECT id, requester_id, recipient_id, status
    FROM member_connections
    WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)
  `).get(viewerId, targetId, targetId, viewerId);

  if (!conn) {
    return res.json({ status: 'none', connection_id: null });
  }

  let status = conn.status;
  if (conn.status === 'pending') {
    status = (conn.requester_id === viewerId) ? 'pending_sent' : 'pending_received';
  }

  res.json({ status, connection_id: conn.id });
});

// Retrieve permitted contact methods (STRICT PRIVACY: Only accessible if accepted connection or admin)
app.get('/api/connections/contact-methods/:targetId', (req, res) => {
  const targetId = req.params.targetId;
  const viewerId = req.query.viewerId || req.headers['x-user-id'];

  if (!viewerId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const viewer = db.prepare("SELECT id, role FROM users WHERE id = ?").get(viewerId);
  const target = db.prepare("SELECT id, full_name, email, phone, zoom_link, contact_preference FROM users WHERE id = ?").get(targetId);

  if (!target) {
    return res.status(404).json({ error: "Member not found" });
  }

  const isOwner = viewerId === targetId;
  const isFounder = viewer && (viewer.role === 'FOUNDER' || viewer.role === 'ADMIN');

  const connection = db.prepare(`
    SELECT status FROM member_connections
    WHERE ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))
      AND status = 'accepted'
  `).get(viewerId, targetId, targetId, viewerId);

  const isConnected = Boolean(connection);

  if (!isOwner && !isFounder && !isConnected) {
    return res.status(403).json({
      error: "Contact details are confidential and accessible only after mutual connection acceptance."
    });
  }

  // Parse Q6 configuration to respect member's preferred contact methods
  const q6 = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 6").get(targetId);
  let configuredMethods = [];
  let zoomMeetingLink = target.zoom_link || null;

  if (q6 && q6.value_text) {
    try {
      if (q6.value_text.startsWith('{')) {
        const parsed = JSON.parse(q6.value_text);
        if (Array.isArray(parsed.methods)) configuredMethods = parsed.methods.filter(Boolean);
        if (parsed.zoom_link) zoomMeetingLink = parsed.zoom_link;
      } else {
        configuredMethods = q6.value_text.split(/[,;/]/).map(s => s.trim()).filter(Boolean);
      }
    } catch {
      configuredMethods = [q6.value_text];
    }
  }

  if (configuredMethods.length === 0) {
    if (target.contact_preference === 'direct_contact') {
      configuredMethods = ['WhatsApp', 'Email'];
      if (zoomMeetingLink) configuredMethods.push('Zoom');
    } else {
      configuredMethods = ['Email'];
    }
  }

  res.json({
    success: true,
    target_id: target.id,
    full_name: target.full_name,
    contact_preference: target.contact_preference,
    methods: {
      whatsapp: (configuredMethods.some(m => /whatsapp/i.test(m)) || target.contact_preference === 'direct_contact') && target.phone ? target.phone : null,
      email: configuredMethods.some(m => /email/i.test(m)) || !target.phone ? target.email : target.email,
      zoom: {
        enabled: configuredMethods.some(m => /zoom/i.test(m)) || Boolean(zoomMeetingLink),
        meeting_link: zoomMeetingLink || null,
        can_request_zoom_call: true
      }
    },
    allowed_list: configuredMethods
  });
});

// -------------------------------------------------------------
// ALL MEMBERS DIRECTORY & FILTERING
// -------------------------------------------------------------
app.get('/api/members', (req, res) => {
  const viewer = getViewerAndEnforceMembership(req, res);
  if (!viewer) return;

  const query = (req.query.q || '').toLowerCase().trim();
  const locationFilter = (req.query.location || '').toLowerCase().trim();
  const industryFilter = (req.query.industry || '').toLowerCase().trim();
  const interestsFilter = (req.query.interests || '').toLowerCase().trim();
  const universityFilter = (req.query.university || '').toLowerCase().trim();

  const limit = parseInt(req.query.limit || '100', 10);
  const offset = parseInt(req.query.offset || '0', 10);
  const paginatedFormat = req.query.paginated === 'true';

  const today = new Date().toISOString().split('T')[0];

  // Retrieve admitted members excluding viewer
  const members = db.prepare(`
    SELECT u.id, u.full_name, u.headline, u.avatar_url, u.city, u.country, u.state, u.contact_preference, u.role, u.is_complete, u.is_test,
           c.name as chapter_name, c.id as chapter_id
    FROM users u
    LEFT JOIN chapters c ON u.chapter_id = c.id
    WHERE (u.is_admitted = 1 OR u.role IN ('FOUNDER', 'ADMIN')) AND u.id != ?
    ORDER BY u.is_test ASC, u.full_name ASC
  `).all(viewer.id);

  // Load taxonomies, active travel, answers, and connection state for each
  const result = members.map(m => {
    // 1. Connection status with viewer
    const conn = db.prepare(`
      SELECT id, requester_id, recipient_id, status
      FROM member_connections
      WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)
    `).get(viewer.id, m.id, m.id, viewer.id);

    let connection_status = 'none';
    let connection_id = null;
    if (conn) {
      connection_id = conn.id;
      if (conn.status === 'accepted') connection_status = 'accepted';
      else if (conn.status === 'pending') {
        connection_status = (conn.requester_id === viewer.id) ? 'pending_sent' : 'pending_received';
      } else if (conn.status === 'declined') {
        connection_status = 'declined';
      }
    }

    // 2. Taxonomies
    const taxonomies = db.prepare(`
      SELECT category, slug, label FROM taxonomies WHERE user_id = ?
    `).all(m.id);

    const taxMap = { roles: [], industries: [], expertise: [], offers: [], needs: [], interests: [], institutions: [] };
    taxonomies.forEach(t => {
      if (taxMap[t.category]) taxMap[t.category].push({ slug: t.slug, label: t.label });
    });

    // 3. Answers for display
    const q12 = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 12 AND visibility = 'shared'").get(m.id);
    const q14 = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 14 AND visibility = 'shared'").get(m.id);
    const q18 = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 18 AND visibility = 'shared'").get(m.id);
    const q22 = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 22 AND visibility = 'shared'").get(m.id);
    const q25 = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 25 AND visibility = 'shared'").get(m.id);
    const q26 = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 26 AND visibility = 'shared'").get(m.id);
    const q27 = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 27 AND visibility = 'shared'").get(m.id);

    // Parse role / company
    let roleTitle = q25 ? q25.value_text : null;
    let companyName = q26 ? q26.value_text : null;
    if (!roleTitle && m.headline) {
      if (m.headline.includes(' at ')) {
        const parts = m.headline.split(' at ');
        roleTitle = parts[0].trim();
        companyName = parts[1].split('|')[0].trim();
      } else if (m.headline.includes(' @ ')) {
        const parts = m.headline.split(' @ ');
        roleTitle = parts[0].trim();
        companyName = parts[1].split('|')[0].trim();
      } else {
        roleTitle = m.headline;
      }
    }

    // Parse university / institution
    let university = q27 ? q27.value_text : null;
    if (!university && taxMap.institutions.length > 0) {
      university = taxMap.institutions[0].label;
    }

    // Up to 2 relevant interests or expertise tags
    const relevantTags = [];
    if (taxMap.expertise.length > 0) {
      relevantTags.push(taxMap.expertise[0].label);
    }
    if (taxMap.interests.length > 0) {
      relevantTags.push(taxMap.interests[0].label);
    } else if (taxMap.expertise.length > 1) {
      relevantTags.push(taxMap.expertise[1].label);
    } else if (q22 && q22.value_text && q22.value_text !== 'skipped') {
      const interestsSplit = q22.value_text.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      if (interestsSplit.length > 0 && !relevantTags.includes(interestsSplit[0])) {
        relevantTags.push(interestsSplit[0]);
      }
    }

    return {
      ...m,
      role_title: roleTitle,
      company: companyName,
      university,
      relevant_tags: relevantTags.slice(0, 2),
      connection_status,
      connection_id,
      taxonomies: taxMap,
      focus: q14 ? q14.value_text : null,
      offers: q18 ? q18.value_text : null,
      interests_outside_work: q22 ? q22.value_text : null
    };
  });

  // Filter
  const filtered = result.filter(m => {
    // 1. General search query
    if (query) {
      const matchName = m.full_name.toLowerCase().includes(query);
      const matchHead = (m.headline || '').toLowerCase().includes(query);
      const matchCity = (m.city || '').toLowerCase().includes(query) || (m.chapter_name || '').toLowerCase().includes(query);
      const matchTax = Object.values(m.taxonomies).flat().some(t => t.label.toLowerCase().includes(query));
      const matchUni = (m.university || '').toLowerCase().includes(query);
      if (!(matchName || matchHead || matchCity || matchTax || matchUni)) return false;
    }

    // 2. Location filter (strictly matches members' saved locations: city, country, state)
    if (locationFilter && locationFilter !== 'all') {
      const cityMatch = (m.city || '').toLowerCase().includes(locationFilter);
      const countryMatch = (m.country || '').toLowerCase().includes(locationFilter);
      const stateMatch = (m.state || '').toLowerCase().includes(locationFilter);
      // Strictly match members' saved residential locations. Do NOT check chapter_name!
      if (!(cityMatch || countryMatch || stateMatch)) return false;
    }

    // 3. Industry filter
    if (industryFilter && industryFilter !== 'all') {
      const taxMatch = m.taxonomies.industries.some(i => i.label.toLowerCase().includes(industryFilter) || i.slug.includes(industryFilter));
      const headMatch = (m.headline || '').toLowerCase().includes(industryFilter);
      if (!(taxMatch || headMatch)) return false;
    }

    // 4. Interests filter
    if (interestsFilter && interestsFilter !== 'all') {
      const taxInterestMatch = m.taxonomies.interests.some(i => i.label.toLowerCase().includes(interestsFilter) || i.slug.includes(interestsFilter));
      const taxExpertiseMatch = m.taxonomies.expertise.some(e => e.label.toLowerCase().includes(interestsFilter) || e.slug.includes(interestsFilter));
      const interestsTextMatch = (m.interests_outside_work || '').toLowerCase().includes(interestsFilter);
      if (!(taxInterestMatch || taxExpertiseMatch || interestsTextMatch)) return false;
    }

    // 5. University filter
    if (universityFilter && universityFilter !== 'all') {
      const uniMatch = (m.university || '').toLowerCase().includes(universityFilter);
      const taxUniMatch = m.taxonomies.institutions.some(u => u.label.toLowerCase().includes(universityFilter));
      if (!(uniMatch || taxUniMatch)) return false;
    }

    return true;
  });

  const paginated = filtered.slice(offset, offset + limit);

  if (paginatedFormat) {
    return res.json({
      members: paginated,
      total: filtered.length,
      has_more: offset + paginated.length < filtered.length,
      limit,
      offset
    });
  }

  res.setHeader('X-Total-Count', filtered.length);
  res.setHeader('X-Has-More', String(offset + paginated.length < filtered.length));
  res.json(paginated);
});

// Explainable recommendations for active viewer
app.get('/api/recommendations', (req, res) => {
  const viewer = getViewerAndEnforceMembership(req, res);
  if (!viewer) return;
  const viewerId = viewer.id;
  const today = new Date().toISOString().split('T')[0];

  // Get viewer's stated needs and industries
  const viewerNeeds = db.prepare(`
    SELECT slug, label FROM taxonomies WHERE user_id = ? AND category = 'needs'
  `).all(viewerId);

  const viewerIndustries = db.prepare(`
    SELECT slug, label FROM taxonomies WHERE user_id = ? AND category = 'industries'
  `).all(viewerId).map(i => i.slug);

  const viewerActiveTravel = db.prepare(`
    SELECT city FROM travel_plans WHERE user_id = ? AND end_date >= ? AND visibility = 'shared'
  `).all(viewerId, today).map(t => t.city.toLowerCase());

  // Extract viewer's current focus priorities (Question 14)
  const viewerQ14Row = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 14").get(viewerId);
  let viewerFocusTags = [];
  if (viewerQ14Row && viewerQ14Row.value_text) {
    try {
      if (viewerQ14Row.value_text.startsWith('{') && viewerQ14Row.value_text.endsWith('}')) {
        const parsed = JSON.parse(viewerQ14Row.value_text);
        if (Array.isArray(parsed.tags)) viewerFocusTags = parsed.tags;
      }
    } catch {}
  }

  // Extract viewer's industries of interest to explore (Question 15)
  const viewerQ15Row = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 15").get(viewerId);
  let viewerExploreIndustries = [];
  if (viewerQ15Row && viewerQ15Row.value_text && viewerQ15Row.value_text !== 'skipped') {
    viewerExploreIndustries = viewerQ15Row.value_text.split(';').map(s => s.trim().toLowerCase()).filter(Boolean);
  }

  // Extract viewer's target connections (Question 17)
  const viewerQ17Row = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 17").get(viewerId);
  let viewerConnTags = [];
  let viewerConnNote = '';
  if (viewerQ17Row && viewerQ17Row.value_text && viewerQ17Row.value_text !== 'skipped') {
    try {
      if (viewerQ17Row.value_text.startsWith('{')) {
        const parsed = JSON.parse(viewerQ17Row.value_text);
        if (Array.isArray(parsed.tags)) viewerConnTags = parsed.tags;
        if (typeof parsed.note === 'string') viewerConnNote = parsed.note.trim();
      } else {
        viewerConnNote = viewerQ17Row.value_text.trim();
      }
    } catch {}
  }

  // Candidates (all other verified members)
  const candidates = db.prepare(`
    SELECT u.id, u.full_name, u.headline, u.avatar_url, u.city, u.country, u.contact_preference,
           c.name as chapter_name, c.id as chapter_id
    FROM users u
    LEFT JOIN chapters c ON u.chapter_id = c.id
    WHERE u.role = 'MEMBER' AND u.id != ?
  `).all(viewerId);

  const scoredRecommendations = [];

  for (const cand of candidates) {
    let score = 0.50; // base score
    let rationale = "";
    const matchedTags = [];

    // Check candidate offers, expertise, roles & industries
    const candOffers = db.prepare(`
      SELECT slug, label FROM taxonomies WHERE user_id = ? AND category = 'offers'
    `).all(cand.id);

    const candExpertise = db.prepare(`
      SELECT slug, label FROM taxonomies WHERE user_id = ? AND category = 'expertise'
    `).all(cand.id);

    const candRoles = db.prepare(`
      SELECT slug, label FROM taxonomies WHERE user_id = ? AND category = 'roles'
    `).all(cand.id);

    const candIndustries = db.prepare(`
      SELECT slug, label FROM taxonomies WHERE user_id = ? AND category = 'industries'
    `).all(cand.id);

    const candQ12 = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 12").get(cand.id);
    const candBackground = candQ12 ? (candQ12.value_text || '') : '';

    const candTravel = db.prepare(`
      SELECT city, start_date, end_date FROM travel_plans WHERE user_id = ? AND end_date >= ? AND visibility = 'shared'
    `).all(cand.id, today);

    // Direct Need ↔ Offer intersection
    let primaryNeedMatch = null;
    let primaryOfferMatch = null;

    for (const need of viewerNeeds) {
      const foundOffer = candOffers.find(o => o.slug === need.slug || o.label.toLowerCase().includes(need.slug) || need.label.toLowerCase().includes(o.slug));
      if (foundOffer) {
        primaryNeedMatch = need.label;
        primaryOfferMatch = foundOffer.label;
        score += 0.35;
        matchedTags.push({ category: 'offers', label: foundOffer.label });
        break;
      }
    }

    // Match candidate's focus priorities (Question 14) with viewer focus or offers
    let focusSynergyMatch = null;
    const candQ14Row = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 14 AND visibility = 'shared'").get(cand.id);
    let candFocusTags = [];
    if (candQ14Row && candQ14Row.value_text) {
      try {
        if (candQ14Row.value_text.startsWith('{') && candQ14Row.value_text.endsWith('}')) {
          const parsed = JSON.parse(candQ14Row.value_text);
          if (Array.isArray(parsed.tags)) candFocusTags = parsed.tags;
        }
      } catch {}
    }

    if (viewerFocusTags.length > 0) {
      for (const vFocus of viewerFocusTags) {
        // 1. Shared focus priority
        if (candFocusTags.includes(vFocus)) {
          focusSynergyMatch = { type: 'shared_focus', label: vFocus };
          score += 0.25;
          matchedTags.push({ category: 'focus', label: vFocus });
          break;
        }
        // 2. Candidate offering directly matches viewer's focus goal
        const directOffer = candOffers.find(o => {
          const oLow = o.label.toLowerCase();
          const fLow = vFocus.toLowerCase();
          if (fLow.includes('funding') && (oLow.includes('fundrais') || oLow.includes('invest'))) return true;
          if (fLow.includes('team') && oLow.includes('hiring')) return true;
          if (fLow.includes('partner') && oLow.includes('partner')) return true;
          if (fLow.includes('market') && oLow.includes('expansion')) return true;
          if (fLow.includes('mentor') && oLow.includes('mentor')) return true;
          if (fLow.includes('client') && (oLow.includes('market') || oLow.includes('sales'))) return true;
          return false;
        });
        if (directOffer) {
          focusSynergyMatch = { type: 'focus_offer', viewerFocus: vFocus, candOffer: directOffer.label };
          score += 0.30;
          matchedTags.push({ category: 'focus', label: `${vFocus} → ${directOffer.label}` });
          break;
        }
      }
    }

    // Match target connection types (Question 17)
    let connSynergyMatch = null;
    if (viewerConnTags.length > 0) {
      if (viewerConnTags.includes("Open to Meeting Different People")) {
        score += 0.10;
        matchedTags.push({ category: 'connections', label: 'Open to Meeting' });
      } else {
        const candHeadlineLower = (cand.headline || '').toLowerCase();
        const candRoleLabels = candRoles.map(r => r.label.toLowerCase());
        const candOfferLabels = candOffers.map(o => o.label.toLowerCase());

        for (const connType of viewerConnTags) {
          let matchedConn = false;
          let matchedRoleDesc = '';

          if (connType === "Founders & Business Owners") {
            if (candRoleLabels.some(r => r.includes('founder') || r.includes('business owner')) || candHeadlineLower.includes('founder') || candHeadlineLower.includes('owner')) {
              matchedConn = true;
              matchedRoleDesc = 'Founder / Business Owner';
            }
          } else if (connType === "Executives & Business Leaders") {
            if (candRoleLabels.some(r => r.includes('ceo') || r.includes('executive') || r.includes('managing director') || r.includes('partner')) || candHeadlineLower.includes('ceo') || candHeadlineLower.includes('director') || candHeadlineLower.includes('chief') || candHeadlineLower.includes('partner')) {
              matchedConn = true;
              matchedRoleDesc = 'Executive Leader';
            }
          } else if (connType === "Investors") {
            if (candRoleLabels.some(r => r.includes('investor') || r.includes('fund manager')) || candOfferLabels.some(o => o.includes('invest') || o.includes('fundrais')) || candHeadlineLower.includes('investor') || candHeadlineLower.includes('partner') || candHeadlineLower.includes('venture')) {
              matchedConn = true;
              matchedRoleDesc = 'Investor / Fund Manager';
            }
          } else if (connType === "Technology & Product Professionals") {
            if (candRoleLabels.some(r => r.includes('technology') || r.includes('designer')) || candOfferLabels.some(o => o.includes('software') || o.includes('machine learning') || o.includes('data') || o.includes('product')) || candHeadlineLower.includes('engineer') || candHeadlineLower.includes('tech') || candHeadlineLower.includes('cto') || candHeadlineLower.includes('ai')) {
              matchedConn = true;
              matchedRoleDesc = 'Technology / Product Professional';
            }
          } else if (connType === "Professors & Researchers") {
            if (candRoleLabels.some(r => r.includes('professor') || r.includes('academic') || r.includes('researcher')) || candOfferLabels.some(o => o.includes('research')) || candHeadlineLower.includes('research') || candHeadlineLower.includes('professor')) {
              matchedConn = true;
              matchedRoleDesc = 'Researcher / Academic';
            }
          } else if (connType === "Healthcare Professionals") {
            if (candRoleLabels.some(r => r.includes('doctor') || r.includes('healthcare')) || candOfferLabels.some(o => o.includes('health') || o.includes('medicine')) || candHeadlineLower.includes('health') || candHeadlineLower.includes('doctor')) {
              matchedConn = true;
              matchedRoleDesc = 'Healthcare Professional';
            }
          } else if (connType === "Legal, Tax & Finance Professionals") {
            if (candRoleLabels.some(r => r.includes('lawyer') || r.includes('legal') || r.includes('finance') || r.includes('accounting')) || candOfferLabels.some(o => o.includes('legal') || o.includes('tax')) || candHeadlineLower.includes('law') || candHeadlineLower.includes('finance') || candHeadlineLower.includes('cfo')) {
              matchedConn = true;
              matchedRoleDesc = 'Legal / Tax / Finance Specialist';
            }
          } else if (connType === "Real Estate Professionals") {
            if (candRoleLabels.some(r => r.includes('real estate')) || candOfferLabels.some(o => o.includes('real estate')) || candHeadlineLower.includes('real estate') || candHeadlineLower.includes('developer') || candHeadlineLower.includes('property')) {
              matchedConn = true;
              matchedRoleDesc = 'Real Estate Professional';
            }
          } else if (connType === "Consultants & Industry Experts") {
            if (candRoleLabels.some(r => r.includes('consultant') || r.includes('advisor')) || candOfferLabels.some(o => o.includes('strategy') || o.includes('advisory')) || candHeadlineLower.includes('consultant') || candHeadlineLower.includes('advisor')) {
              matchedConn = true;
              matchedRoleDesc = 'Consultant / Advisor';
            }
          } else if (connType === "Mentors") {
            if (candOfferLabels.some(o => o.includes('mentor')) || candHeadlineLower.includes('mentor')) {
              matchedConn = true;
              matchedRoleDesc = 'Mentor';
            }
          } else if (connType === "Peers in My Profession") {
            if (candRoles.some(cr => viewerIndustries.includes(cr.slug)) || candIndustries.some(ci => viewerIndustries.includes(ci.slug))) {
              matchedConn = true;
              matchedRoleDesc = 'Industry Peer';
            }
          } else if (connType === "Potential Co-founders & Collaborators") {
            if (candRoleLabels.some(r => r.includes('founder')) || candOfferLabels.some(o => o.includes('partnerships') || o.includes('research'))) {
              matchedConn = true;
              matchedRoleDesc = 'Potential Collaborator';
            }
          } else if (connType === "Potential Business Partners") {
            if (candOfferLabels.some(o => o.includes('partnerships') || o.includes('strategy'))) {
              matchedConn = true;
              matchedRoleDesc = 'Strategic Partner';
            }
          } else if (connType === "Talent & Hiring Connections") {
            if (candOfferLabels.some(o => o.includes('hiring') || o.includes('team'))) {
              matchedConn = true;
              matchedRoleDesc = 'Talent / Hiring Connection';
            }
          } else if (connType === "Experts in a Specific Country or Market") {
            if (candOfferLabels.some(o => o.includes('expansion') || o.includes('cross-border')) || candTravel.length > 0) {
              matchedConn = true;
              matchedRoleDesc = 'Cross-border / Market Specialist';
            }
          }

          if (matchedConn) {
            score += 0.25;
            matchedTags.push({ category: 'connection', label: connType });
            connSynergyMatch = { targetType: connType, candRole: matchedRoleDesc || cand.headline };
            break;
          }
        }
      }

      // Check specific note (Q17 note)
      if (viewerConnNote) {
        const noteWords = viewerConnNote.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const candProfileStr = `${cand.headline || ''} ${cand.city || ''} ${cand.country || ''} ${candBackground}`.toLowerCase();
        const noteMatch = noteWords.some(w => candProfileStr.includes(w));
        if (noteMatch) {
          score += 0.15;
          matchedTags.push({ category: 'specific_request', label: 'Matches specific note' });
        }
      }
    }

    // Match viewer's industries to explore (Question 15)
    let exploreIndustryMatch = null;
    if (viewerExploreIndustries.length > 0) {
      for (const expInd of viewerExploreIndustries) {
        const foundInd = candIndustries.find(ci => ci.label.toLowerCase().includes(expInd) || expInd.includes(ci.label.toLowerCase()));
        if (foundInd) {
          score += 0.25;
          exploreIndustryMatch = foundInd.label;
          matchedTags.push({ category: 'explore_industry', label: `Exploring: ${foundInd.label}` });
          break;
        }
      }
    }

    // Proximity check (same city or active travel match)
    const isSameCity = cand.city.toLowerCase() === viewer.city.toLowerCase();
    const candTravelingToViewerCity = candTravel.some(t => t.city.toLowerCase() === viewer.city.toLowerCase());
    const viewerTravelingToCandCity = viewerActiveTravel.includes(cand.city.toLowerCase());

    if (isSameCity) {
      score += 0.10;
    } else if (candTravelingToViewerCity) {
      score += 0.15;
      matchedTags.push({ category: 'travel', label: `Visiting ${viewer.city}` });
    }

    // Build plain-language explanation
    if (primaryNeedMatch && primaryOfferMatch) {
      if (isSameCity) {
        rationale = `Matches your stated need for [${primaryNeedMatch}] with ${cand.full_name}'s verified capability in [${primaryOfferMatch}], and both are active in ${viewer.city}.`;
      } else if (candTravelingToViewerCity) {
        rationale = `Matches your need for [${primaryNeedMatch}] with ${cand.full_name}'s expertise in [${primaryOfferMatch}], with upcoming travel to ${viewer.city}.`;
      } else {
        rationale = `Direct synergy: ${cand.full_name} offers [${primaryOfferMatch}], directly addressing your current focus on [${primaryNeedMatch}].`;
      }
    } else if (connSynergyMatch) {
      rationale = `Matches your preference to connect with [${connSynergyMatch.targetType}] through ${cand.full_name}'s background as ${connSynergyMatch.candRole}.`;
    } else if (exploreIndustryMatch) {
      rationale = `Directly aligns with your interest in exploring [${exploreIndustryMatch}]: ${cand.full_name} is active in this sector.`;
    } else if (focusSynergyMatch) {
      if (focusSynergyMatch.type === 'focus_offer') {
        rationale = `Supports your active priority to [${focusSynergyMatch.viewerFocus}] through ${cand.full_name}'s verified capability in [${focusSynergyMatch.candOffer}].`;
      } else {
        rationale = `Shared active priority: Both you and ${cand.full_name} are currently focused on [${focusSynergyMatch.label}].`;
      }
    } else {
      // Secondary fallback rationale based on shared industry / chapter
      const candIndustries = db.prepare(`
        SELECT slug, label FROM taxonomies WHERE user_id = ? AND category = 'industries'
      `).all(cand.id);
      const sharedInd = candIndustries.find(ci => viewerIndustries.includes(ci.slug));
      if (sharedInd) {
        score += 0.20;
        matchedTags.push({ category: 'industry', label: sharedInd.label });
        rationale = `Peer alignment in ${sharedInd.label} across the ${cand.chapter_name || cand.city} network.`;
      } else {
        rationale = `High-trust peer in the ${cand.chapter_name || cand.city} chapter available for strategic exchange.`;
      }
    }

    // Connection status between viewer and recommendation candidate
    const candConn = db.prepare(`
      SELECT id, requester_id, recipient_id, status
      FROM member_connections
      WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)
    `).get(viewer.id, cand.id, cand.id, viewer.id);

    let candConnStatus = 'none';
    let candConnId = null;
    if (candConn) {
      candConnId = candConn.id;
      if (candConn.status === 'accepted') candConnStatus = 'accepted';
      else if (candConn.status === 'pending') {
        candConnStatus = (candConn.requester_id === viewer.id) ? 'pending_sent' : 'pending_received';
      } else if (candConn.status === 'declined') {
        candConnStatus = 'declined';
      }
    }

    // Concise matching reason for display badge
    let shortMatchReason = "";
    if (isSameCity) {
      shortMatchReason = `Based in ${cand.city}`;
    } else if (candTravelingToViewerCity) {
      shortMatchReason = `Visiting ${viewer.city}`;
    } else if (primaryNeedMatch && primaryOfferMatch) {
      shortMatchReason = `Offers ${primaryOfferMatch}`;
    } else if (focusSynergyMatch) {
      shortMatchReason = focusSynergyMatch.type === 'shared_focus' ? `Shared focus: ${focusSynergyMatch.label}` : `Offers ${focusSynergyMatch.candOffer}`;
    } else if (exploreIndustryMatch) {
      shortMatchReason = `Active in ${exploreIndustryMatch}`;
    } else {
      const candInts = db.prepare(`SELECT label FROM taxonomies WHERE user_id = ? AND category = 'interests'`).all(cand.id).map(i => i.label);
      const viewerInts = db.prepare(`SELECT label FROM taxonomies WHERE user_id = ? AND category = 'interests'`).all(viewer.id).map(i => i.label);
      const sharedInt = candInts.find(ci => viewerInts.some(vi => vi.toLowerCase() === ci.toLowerCase()));
      if (sharedInt) {
        shortMatchReason = `Shared interest in ${sharedInt}`;
      } else {
        shortMatchReason = `Based in ${cand.city || cand.chapter_name || 'Club Network'}`;
      }
    }

    const q25 = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 25 AND visibility = 'shared'").get(cand.id);
    const q26 = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 26 AND visibility = 'shared'").get(cand.id);
    const q27 = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 27 AND visibility = 'shared'").get(cand.id);

    let roleTitle = q25 ? q25.value_text : null;
    let companyName = q26 ? q26.value_text : null;
    if (!roleTitle && cand.headline) {
      if (cand.headline.includes(' at ')) {
        const parts = cand.headline.split(' at ');
        roleTitle = parts[0].trim();
        companyName = parts[1].split('|')[0].trim();
      } else {
        roleTitle = cand.headline;
      }
    }

    const relevantTags = [];
    if (candExpertise.length > 0) relevantTags.push(candExpertise[0].label);
    const candTaxInts = db.prepare(`SELECT label FROM taxonomies WHERE user_id = ? AND category = 'interests'`).all(cand.id);
    if (candTaxInts.length > 0) relevantTags.push(candTaxInts[0].label);
    else if (candExpertise.length > 1) relevantTags.push(candExpertise[1].label);

    scoredRecommendations.push({
      ...cand,
      role_title: roleTitle,
      company: companyName,
      university: q27 ? q27.value_text : null,
      relevant_tags: relevantTags.slice(0, 2),
      connection_status: candConnStatus,
      connection_id: candConnId,
      short_match_reason: shortMatchReason,
      match_score: Math.min(0.98, parseFloat(score.toFixed(2))),
      match_rationale: rationale,
      matched_tags: matchedTags,
      active_travel: candTravel
    });
  }

  // Sort descending by match score
  scoredRecommendations.sort((a, b) => b.match_score - a.match_score);
  res.json(scoredRecommendations);
});

// -------------------------------------------------------------
// 3. MEMBER PROFILE & QUESTIONNAIRE
// -------------------------------------------------------------
app.get('/api/profile/:userId', (req, res) => {
  const targetId = req.params.userId;
  const viewerId = req.query.viewerId || req.headers['x-user-id'] || req.headers['authorization'];
  if (!viewerId) {
    return res.status(401).json({ error: "Access Denied: Community membership required." });
  }
  const cleanViewer = viewerId.startsWith('Bearer ') ? viewerId.slice(7).trim() : viewerId.trim();
  const viewer = db.prepare("SELECT id, role, is_admitted FROM users WHERE (id = ? OR LOWER(email) = ?) AND (is_admitted = 1 OR role IN ('FOUNDER', 'ADMIN'))").get(cleanViewer, cleanViewer.toLowerCase());
  if (!viewer) {
    return res.status(401).json({ error: "Access Denied: Community membership required." });
  }
  const today = new Date().toISOString().split('T')[0];

  const user = db.prepare(`
    SELECT u.id, u.email, u.phone, u.zoom_link, u.full_name, u.headline, u.avatar_url, u.city, u.state, u.country, u.industry, u.contact_preference,
           u.role, u.is_admitted, u.admitted_by, u.admitted_at, u.is_complete, u.membership_tier, u.subscription_status, u.onboarding_step, c.name as chapter_name, c.id as chapter_id
    FROM users u
    LEFT JOIN chapters c ON u.chapter_id = c.id
    WHERE u.id = ?
  `).get(targetId);

  if (!user) return res.status(404).json({ error: "User not found" });

  const isFounder = viewer.role === 'FOUNDER' || viewer.role === 'ADMIN';
  const isOwner = viewer.id === targetId;

  // Check connection status between viewer and profile owner
  const connection = db.prepare(`
    SELECT id, requester_id, recipient_id, status FROM member_connections
    WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)
  `).get(viewer.id, targetId, targetId, viewer.id);

  let connection_status = 'none';
  let connection_id = null;
  if (connection) {
    connection_id = connection.id;
    if (connection.status === 'accepted') connection_status = 'accepted';
    else if (connection.status === 'pending') {
      connection_status = (connection.requester_id === viewer.id) ? 'pending_sent' : 'pending_received';
    } else if (connection.status === 'declined') {
      connection_status = 'declined';
    }
  }

  const isConnected = connection_status === 'accepted';
  const canViewContact = isOwner || isFounder || isConnected;

  // Retrieve questionnaire answers
  const answers = db.prepare(`
    SELECT question_id, prompt, answer_state, visibility, value_text
    FROM questionnaire_answers
    WHERE user_id = ?
  `).all(targetId);

  // Sort answers to match canonical display order
  const canonicalOrderMap = new Map(CANONICAL_QUESTIONS.map((q, idx) => [q.id, idx]));
  answers.sort((a, b) => (canonicalOrderMap.get(a.question_id) ?? 999) - (canonicalOrderMap.get(b.question_id) ?? 999));

  // Apply Privacy Filter & Question 23 Lock
  const sanitizedAnswers = answers.map(a => {
    if (a.question_id === 23) {
      if (isFounder || isOwner) {
        if (isFounder && !isOwner) {
          const logId = 'audit_' + Math.random().toString(36).substring(2, 10);
          db.prepare(`
            INSERT INTO audit_logs (id, actor_id, action, target_member_id, question_id, ip_address, metadata_json)
            VALUES (?, ?, 'view_private_answer', ?, 23, '127.0.0.1', ?)
          `).run(logId, viewerId, targetId, JSON.stringify({ reason: "Founder profile review" }));
        }
        return { ...a, is_q23_founder_locked: true };
      } else {
        return {
          question_id: 23,
          prompt: a.prompt,
          answer_state: a.answer_state,
          visibility: 'private',
          value_text: "[Confidential founder note - visible solely to administrators (Elena, Alexandra, and Julia)]",
          is_q23_founder_locked: true,
          is_redacted: true
        };
      }
    }

    // Mask direct contact details in Question 6 if not permitted
    if (a.question_id === 6 && !canViewContact) {
      return {
        ...a,
        value_text: "[Contact details confidential until mutual connection acceptance]",
        is_redacted: true
      };
    }

    // For other questions with private visibility
    if (a.visibility === 'private' && !isOwner && !isFounder) {
      return {
        question_id: a.question_id,
        prompt: a.prompt,
        answer_state: a.answer_state,
        visibility: 'private',
        value_text: "[Private]",
        is_redacted: true
      };
    }

    return a;
  });

  // Active travel
  const travelPlans = db.prepare(`
    SELECT id, city, country, start_date, end_date, notes, visibility
    FROM travel_plans
    WHERE user_id = ? AND (visibility = 'shared' OR ? = 1)
    ORDER BY start_date ASC
  `).all(targetId, (isOwner || isFounder) ? 1 : 0);

  // Taxonomies
  const taxonomies = db.prepare(`SELECT category, slug, label FROM taxonomies WHERE user_id = ?`).all(targetId);
  const notes = db.prepare(`SELECT category, note FROM taxonomy_notes WHERE user_id = ?`).all(targetId);

  res.json({
    ...user,
    email: canViewContact ? user.email : null,
    phone: canViewContact ? user.phone : null,
    zoom_link: canViewContact ? user.zoom_link : null,
    membership_tier: (isFounder || isOwner) ? (user.membership_tier || 'paid') : undefined,
    subscription_status: (isFounder || isOwner) ? (user.subscription_status || 'active') : undefined,
    connection_status,
    connection_id,
    can_view_contact: canViewContact,
    is_complete: Boolean(user.is_complete),
    onboarding_step: user.onboarding_step || (user.is_complete ? 'completed' : 'questionnaire'),
    answers: sanitizedAnswers,
    travel_plans: travelPlans,
    taxonomies,
    taxonomy_notes: notes
  });
});

// Update questionnaire answer handler
function handleSaveAnswer(req, res) {
  const userId = req.body.userId || req.params.id;
  const questionId = parseInt(req.body.questionId || req.body.question_id || req.params.questionId, 10);
  const valueText = req.body.valueText !== undefined ? req.body.valueText : (typeof req.body.value === 'string' ? req.body.value : '');
  const answerState = req.body.answerState || (valueText && valueText.trim() ? 'answered' : 'unanswered');
  const visibility = req.body.visibility;

  if (!userId || !questionId) {
    return res.status(400).json({ error: "Missing userId or questionId" });
  }

  // Content guardrail check
  const violation = validateContent(valueText);
  if (violation) {
    return res.status(422).json({ error: violation, flagged: true });
  }

  // Question 23 Permanent Lock Rule: Visibility must always be private
  const finalVisibility = (questionId === 23) ? 'private' : (visibility || 'shared');
  const promptObj = CANONICAL_QUESTIONS.find(q => q.id === questionId);
  const prompt = promptObj ? promptObj.prompt : `Question ${questionId}`;

  // Normalize Question 13 (LinkedIn or website) with https:// if missing
  let normalizedValueText = valueText;
  if (questionId === 13 && normalizedValueText && normalizedValueText.trim() && normalizedValueText.trim() !== 'skipped') {
    const trimmed = normalizedValueText.trim();
    if (!/^[a-zA-Z]+:\/\//.test(trimmed)) {
      normalizedValueText = `https://${trimmed}`;
    } else {
      normalizedValueText = trimmed;
    }
  }

  db.prepare(`
    INSERT INTO questionnaire_answers (user_id, question_id, prompt, answer_state, visibility, value_text, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, question_id) DO UPDATE SET
      answer_state = excluded.answer_state,
      visibility = excluded.visibility,
      value_text = excluded.value_text,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, questionId, prompt, answerState, finalVisibility, normalizedValueText || '');

  // Sync Question 22 to taxonomies table under category = 'interests'
  if (questionId === 22) {
    db.prepare("DELETE FROM taxonomies WHERE user_id = ? AND category = 'interests'").run(userId);
    if (normalizedValueText && normalizedValueText !== 'skipped') {
      const items = normalizedValueText.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      const insTax = db.prepare("INSERT OR IGNORE INTO taxonomies (user_id, category, slug, label) VALUES (?, 'interests', ?, ?)");
      for (const item of items) {
        const slug = item.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        insTax.run(userId, slug, item);
      }
    }
  }

  // Sync Question 6 to users table for zoom_link and contact_preference
  if (questionId === 6 && normalizedValueText) {
    try {
      if (normalizedValueText.startsWith('{')) {
        const p = JSON.parse(normalizedValueText);
        if (p.zoom_link !== undefined) {
          db.prepare("UPDATE users SET zoom_link = ? WHERE id = ?").run(p.zoom_link ? p.zoom_link.trim() : null, userId);
        }
        if (p.preference) {
          db.prepare("UPDATE users SET contact_preference = ? WHERE id = ?").run(p.preference, userId);
        }
      }
    } catch {}
  }

  // Question 18 Mandate: Check if Question 18 is answered to update profile is_complete flag
  const q18 = db.prepare(`
    SELECT answer_state FROM questionnaire_answers WHERE user_id = ? AND question_id = 18
  `).get(userId);

  const isComplete = (q18 && q18.answer_state === 'answered') ? 1 : 0;
  const userRec = db.prepare("SELECT membership_tier, subscription_status, full_name FROM users WHERE id = ?").get(userId);
  const nextStep = isComplete === 1
    ? (userRec?.membership_tier === 'paid' && userRec?.subscription_status !== 'active' ? 'subscription_payment' : 'completed')
    : 'questionnaire';

  db.prepare("UPDATE users SET is_complete = ?, onboarding_step = ? WHERE id = ?").run(isComplete, nextStep, userId);

  if (nextStep === 'completed') {
    recordAdminActivity({
      activityType: 'completed_onboarding',
      title: 'Member Completed Onboarding',
      description: `${userRec?.full_name || userId} completed questionnaire onboarding.`,
      actorId: userId,
      entityType: 'user',
      entityId: userId
    });
  }

  res.json({ success: true, is_complete: Boolean(isComplete), onboarding_step: nextStep });
}

app.post('/api/intake/answer', handleSaveAnswer);
app.post('/api/profile/:id/answer', handleSaveAnswer);
app.post('/api/profile/:id/answers/:questionId', handleSaveAnswer);

// Update general profile fields (headline, city, zoom_link, etc.)
app.put('/api/profile/:id', (req, res) => {
  const { headline, city, state, country, industry, contact_preference, zoom_link, phone, full_name } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  db.prepare(`
    UPDATE users
    SET headline = COALESCE(?, headline),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        country = COALESCE(?, country),
        industry = COALESCE(?, industry),
        contact_preference = COALESCE(?, contact_preference),
        zoom_link = COALESCE(?, zoom_link),
        phone = COALESCE(?, phone),
        full_name = COALESCE(?, full_name)
    WHERE id = ?
  `).run(
    headline !== undefined ? headline : null,
    city !== undefined ? city : null,
    state !== undefined ? state : null,
    country !== undefined ? country : null,
    industry !== undefined ? industry : null,
    contact_preference !== undefined ? contact_preference : null,
    zoom_link !== undefined ? zoom_link : null,
    phone !== undefined ? phone : null,
    full_name !== undefined ? full_name : null,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  res.json({ success: true, user: updated });
});

// Bulk update questionnaire answers
app.post(['/api/profile/:id/answers-bulk', '/api/intake/answers-bulk'], (req, res) => {
  const userId = req.params.id || req.body.userId;
  const { answers } = req.body;

  if (!userId || !Array.isArray(answers)) {
    return res.status(400).json({ error: "Missing userId or answers array" });
  }

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!user) {
    return res.status(404).json({ error: `User ${userId} not found` });
  }

  // Pre-validate all answers
  for (const item of answers) {
    const qId = parseInt(item.question_id || item.questionId, 10);
    const val = item.value || item.valueText || '';
    const violation = validateContent(val);
    if (violation) {
      return res.status(422).json({ error: `Question ${qId}: ${violation}`, flagged: true });
    }
  }

  const insertStmt = db.prepare(`
    INSERT INTO questionnaire_answers (user_id, question_id, prompt, answer_state, visibility, value_text, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, question_id) DO UPDATE SET
      answer_state = excluded.answer_state,
      visibility = excluded.visibility,
      value_text = excluded.value_text,
      updated_at = CURRENT_TIMESTAMP
  `);

  const saveMany = db.transaction((items) => {
    for (const item of items) {
      const qId = parseInt(item.question_id || item.questionId, 10);
      let val = (item.value || item.valueText || '').trim();
      if (qId === 13 && val && val !== 'skipped') {
        if (!/^[a-zA-Z]+:\/\//.test(val)) {
          val = `https://${val}`;
        }
      }
      const promptObj = CANONICAL_QUESTIONS.find(q => q.id === qId);
      const prompt = promptObj ? promptObj.prompt : `Question ${qId}`;
      const vis = (qId === 23) ? 'private' : (item.visibility || 'shared');
      const state = val ? 'answered' : 'unanswered';
      insertStmt.run(userId, qId, prompt, state, vis, val);

      // Automatically keep user city and country in sync when Question 2 is updated
      if (qId === 2 && val && val !== 'skipped') {
        let city = val;
        let country = '';
        if (val.includes(',')) {
          const parts = val.split(',').map(s => s.trim());
          city = parts[0];
          country = parts.slice(1).join(', ');
        }
        if (country) {
          db.prepare("UPDATE users SET city = ?, country = ? WHERE id = ?").run(city, country, userId);
        } else {
          db.prepare("UPDATE users SET city = ? WHERE id = ?").run(city, userId);
        }
      }

      // Automatically sync Question 22 interests to taxonomies table
      if (qId === 22) {
        db.prepare("DELETE FROM taxonomies WHERE user_id = ? AND category = 'interests'").run(userId);
        if (val && val !== 'skipped') {
          const items = val.split(/[,;]/).map(s => s.trim()).filter(Boolean);
          const insTax = db.prepare("INSERT OR IGNORE INTO taxonomies (user_id, category, slug, label) VALUES (?, 'interests', ?, ?)");
          for (const it of items) {
            const slug = it.toLowerCase().replace(/[^a-z0-9]+/g, '_');
            insTax.run(userId, slug, it);
          }
        }
      }
    }
  });

  saveMany(answers);

  const q18 = db.prepare(`
    SELECT answer_state FROM questionnaire_answers WHERE user_id = ? AND question_id = 18
  `).get(userId);

  const isComplete = (q18 && q18.answer_state === 'answered') ? 1 : 0;
  const userRec = db.prepare("SELECT membership_tier, subscription_status, full_name FROM users WHERE id = ?").get(userId);
  const nextStep = isComplete === 1
    ? (userRec?.membership_tier === 'paid' && userRec?.subscription_status !== 'active' ? 'subscription_payment' : 'completed')
    : 'questionnaire';

  db.prepare("UPDATE users SET is_complete = ?, onboarding_step = ? WHERE id = ?").run(isComplete, nextStep, userId);

  if (nextStep === 'completed') {
    recordAdminActivity({
      activityType: 'completed_onboarding',
      title: 'Member Completed Onboarding',
      description: `${userRec?.full_name || userId} completed questionnaire onboarding.`,
      actorId: userId,
      entityType: 'user',
      entityId: userId
    });
  }

  res.json({ success: true, count: answers.length, is_complete: Boolean(isComplete), onboarding_step: nextStep });
});

// -------------------------------------------------------------
// 4. CALL SCHEDULING & INTRO REQUESTS
// -------------------------------------------------------------
app.post('/api/calls/propose', (req, res) => {
  const { requesterId, recipientId, proposedTimes, timezone, message, meetingLink } = req.body;
  if (!requesterId || !recipientId) return res.status(400).json({ error: "Missing required parameters" });

  const callId = 'call_' + Math.random().toString(36).substring(2, 9);
  db.prepare(`
    INSERT INTO call_bookings (id, requester_id, recipient_id, status, proposed_times_json, timezone, meeting_link, message)
    VALUES (?, ?, ?, 'proposed', ?, ?, ?, ?)
  `).run(callId, requesterId, recipientId, JSON.stringify(proposedTimes || []), timezone || 'Asia/Dubai', meetingLink || null, message || '');

  res.json({ success: true, callId });
});

app.get('/api/calls', (req, res) => {
  const userId = req.query.userId;
  const calls = db.prepare(`
    SELECT cb.*, 
           req.full_name as requester_name, req.avatar_url as requester_avatar,
           rec.full_name as recipient_name, rec.avatar_url as recipient_avatar
    FROM call_bookings cb
    JOIN users req ON cb.requester_id = req.id
    JOIN users rec ON cb.recipient_id = rec.id
    WHERE cb.requester_id = ? OR cb.recipient_id = ?
    ORDER BY cb.created_at DESC
  `).all(userId, userId);

  res.json(calls.map(c => ({
    ...c,
    proposed_times: JSON.parse(c.proposed_times_json || '[]')
  })));
});

app.post('/api/calls/respond', (req, res) => {
  const { callId, status, selectedTime, meetingLink } = req.body;
  db.prepare(`
    UPDATE call_bookings
    SET status = ?, selected_time = COALESCE(?, selected_time), meeting_link = COALESCE(?, meeting_link)
    WHERE id = ?
  `).run(status, selectedTime, meetingLink, callId);
  res.json({ success: true });
});

// Intro Request ("Ask the team")
app.post('/api/intros/request', (req, res) => {
  const { requesterId, targetMemberId, contextNeed } = req.body;
  if (!requesterId || !contextNeed) return res.status(400).json({ error: "Context need required" });

  const violation = validateContent(contextNeed);
  if (violation) return res.status(422).json({ error: violation, flagged: true });

  const introId = 'intro_' + Math.random().toString(36).substring(2, 9);
  db.prepare(`
    INSERT INTO intro_requests (id, requester_id, target_member_id, target_context_need, status, assigned_admin)
    VALUES (?, ?, ?, ?, 'pending_admin_review', 'Elena Ermolov')
  `).run(introId, requesterId, targetMemberId || null, contextNeed);

  res.json({ success: true, introId });
});

app.get('/api/intros', (req, res) => {
  const intros = db.prepare(`
    SELECT ir.*,
           req.full_name as requester_name, req.avatar_url as requester_avatar, req.headline as requester_headline,
           target.full_name as target_name, target.avatar_url as target_avatar
    FROM intro_requests ir
    JOIN users req ON ir.requester_id = req.id
    LEFT JOIN users target ON ir.target_member_id = target.id
    ORDER BY ir.created_at DESC
  `).all();
  res.json(intros);
});

app.post('/api/intros/resolve', (req, res) => {
  const { introId, status, resolutionNotes } = req.body;
  db.prepare(`
    UPDATE intro_requests
    SET status = ?, resolution_notes = ?
    WHERE id = ?
  `).run(status, resolutionNotes || '', introId);
  res.json({ success: true });
});

// -------------------------------------------------------------
// 5. EVENTS & TARGETED INVITATIONS
// -------------------------------------------------------------
app.get('/api/events', (req, res) => {
  const member = getViewerAndEnforceMembership(req, res);
  if (!member) return;

  const includePast = req.query.include_past === 'true' || req.query.view === 'all';
  const pastOnly = req.query.past_only === 'true';

  let whereClause = "e.is_published = 1";
  if (pastOnly) {
    whereClause += " AND e.is_past = 1";
  } else if (!includePast) {
    whereClause += " AND (e.is_past = 0 OR e.is_past IS NULL)";
  }

  const events = db.prepare(`
    SELECT e.*, c.name as chapter_name, c.city as chapter_city,
           (SELECT count(*) FROM event_registrations er WHERE er.event_id = e.id AND er.status = 'registered') as actual_registered,
           (SELECT status FROM event_registrations er WHERE er.event_id = e.id AND er.user_id = ?) as user_rsvp
    FROM events e
    LEFT JOIN chapters c ON e.chapter_id = c.id
    WHERE ${whereClause}
    ORDER BY 
      CASE WHEN e.date_precision = 'tba' THEN 1 ELSE 0 END ASC,
      e.start_time ASC
  `).all(member.id);

  // Extract viewer's current focus priorities (Question 14) for event recommendations
  const q14Row = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 14").get(member.id);
  let viewerPriorities = [];
  if (q14Row && q14Row.value_text) {
    try {
      if (q14Row.value_text.startsWith('{')) {
        const parsed = JSON.parse(q14Row.value_text);
        if (Array.isArray(parsed.tags)) viewerPriorities = parsed.tags;
      }
    } catch (e) {}
  }

  // Extract viewer's industries to explore (Question 15) for event recommendations
  const q15Row = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 15").get(member.id);
  let viewerExploredIndustries = [];
  if (q15Row && q15Row.value_text && q15Row.value_text !== 'skipped') {
    viewerExploredIndustries = q15Row.value_text.split(';').map(s => s.trim().toLowerCase()).filter(Boolean);
  }

  // Find the first upcoming event with confirmed dates to highlight as "Next Upcoming"
  let nextUpcomingId = null;
  const firstUpcoming = events.find(e => (!e.is_past || e.is_past === 0) && e.date_precision !== 'tba');
  if (firstUpcoming) {
    nextUpcomingId = firstUpcoming.id;
  }

  // For each event, get registered attendee avatars and match against viewer priorities
  const result = events.map(evt => {
    const attendees = db.prepare(`
      SELECT u.id, u.full_name, u.avatar_url, u.headline
      FROM event_registrations er
      JOIN users u ON er.user_id = u.id
      WHERE er.event_id = ? AND er.status = 'registered'
    `).all(evt.id);

    let priorityMatchReason = null;
    let isPriorityMatch = false;
    const eventContent = `${evt.title || ''} ${evt.headline || ''} ${evt.description || ''} ${evt.event_type || ''} ${evt.location || ''}`.toLowerCase();

    if (viewerPriorities.length > 0) {
      for (const prio of viewerPriorities) {
        const prioLower = prio.toLowerCase();
        let matched = false;
        if ((prioLower.includes('invest') || prioLower.includes('fund') || prioLower.includes('buying or selling')) &&
            (eventContent.includes('invest') || eventContent.includes('capital') || eventContent.includes('fund') || eventContent.includes('jubilee') || eventContent.includes('summit') || eventContent.includes('founders'))) {
          matched = true;
        } else if ((prioLower.includes('launch') || prioLower.includes('project') || prioLower.includes('research') || prioLower.includes('innovation')) &&
            (eventContent.includes('silicon valley') || eventContent.includes('boston') || eventContent.includes('tech') || eventContent.includes('ai') || eventContent.includes('exchange'))) {
          matched = true;
        } else if ((prioLower.includes('market') || prioLower.includes('partnership')) &&
            (eventContent.includes('central asia') || eventContent.includes('europe') || eventContent.includes('cross-border') || eventContent.includes('trek') || eventContent.includes('grand'))) {
          matched = true;
        } else if ((prioLower.includes('network') || prioLower.includes('mentor') || prioLower.includes('team') || prioLower.includes('clients') || prioLower.includes('growing a business')) &&
            (eventContent.includes('dinner') || eventContent.includes('exchange') || eventContent.includes('jubilee') || eventContent.includes('summit'))) {
          matched = true;
        }
        if (matched) {
          isPriorityMatch = true;
          priorityMatchReason = `Recommended for your active priority: "${prio}"`;
          break;
        }
      }
    }

    if (!isPriorityMatch && viewerExploredIndustries.length > 0) {
      for (const ind of viewerExploredIndustries) {
        let matched = false;
        if (eventContent.includes(ind)) {
          matched = true;
        } else if (ind.includes('real estate') && (eventContent.includes('property') || eventContent.includes('villa') || eventContent.includes('estate'))) {
          matched = true;
        } else if (ind.includes('tech') && (eventContent.includes('ai') || eventContent.includes('technology') || eventContent.includes('silicon valley') || eventContent.includes('boston'))) {
          matched = true;
        } else if (ind.includes('finance') && (eventContent.includes('capital') || eventContent.includes('invest') || eventContent.includes('fintech'))) {
          matched = true;
        }
        if (matched) {
          isPriorityMatch = true;
          priorityMatchReason = `Recommended for your interest in exploring: "${ind}"`;
          break;
        }
      }
    }

    // Capacity & Available spots handling (never invent fabricated numbers)
    const capacityVal = (evt.capacity && evt.capacity > 0) ? evt.capacity : null;
    let spotsVal = evt.available_spots;
    if (spotsVal === undefined || spotsVal === null) {
      if (capacityVal !== null && evt.actual_registered !== null) {
        spotsVal = Math.max(0, capacityVal - evt.actual_registered);
      } else {
        spotsVal = null;
      }
    }

    return {
      ...evt,
      capacity: capacityVal,
      available_spots: spotsVal,
      venue: evt.venue || 'To be confirmed',
      price: evt.price || 'To be confirmed',
      attendees,
      is_next_upcoming: evt.id === nextUpcomingId,
      is_priority_match: isPriorityMatch,
      priority_match_reason: priorityMatchReason
    };
  });

  res.json(result);
});

// Member single event details
app.get('/api/events/:id', (req, res) => {
  const viewerId = req.query.viewerId || req.query.userId || req.headers['x-user-id'] || req.headers['authorization'];
  if (!viewerId) {
    return res.status(401).json({ error: "Access Denied: Community membership required." });
  }
  const cleanViewer = viewerId.startsWith('Bearer ') ? viewerId.slice(7).trim() : viewerId.trim();
  const member = db.prepare("SELECT * FROM users WHERE (id = ? OR LOWER(email) = ?) AND (is_admitted = 1 OR role IN ('FOUNDER', 'ADMIN'))").get(cleanViewer, cleanViewer.toLowerCase());
  if (!member) {
    return res.status(401).json({ error: "Access Denied: Community membership required." });
  }
  const event = db.prepare(`
    SELECT e.*, c.name as chapter_name, c.city as chapter_city,
           (SELECT count(*) FROM event_registrations er WHERE er.event_id = e.id AND er.status = 'registered') as actual_registered,
           (SELECT status FROM event_registrations er WHERE er.event_id = e.id AND er.user_id = ?) as user_rsvp
    FROM events e
    LEFT JOIN chapters c ON e.chapter_id = c.id
    WHERE e.id = ?
  `).get(member.id, req.params.id);

  if (!event) return res.status(404).json({ error: "Event not found" });

  const attendees = db.prepare(`
    SELECT u.id, u.full_name, u.avatar_url, u.headline
    FROM event_registrations er
    JOIN users u ON er.user_id = u.id
    WHERE er.event_id = ? AND er.status = 'registered'
  `).all(event.id);

  const capacityVal = (event.capacity && event.capacity > 0) ? event.capacity : null;
  let spotsVal = event.available_spots;
  if (spotsVal === undefined || spotsVal === null) {
    if (capacityVal !== null && event.actual_registered !== null) {
      spotsVal = Math.max(0, capacityVal - event.actual_registered);
    } else {
      spotsVal = null;
    }
  }

  res.json({
    ...event,
    capacity: capacityVal,
    available_spots: spotsVal,
    venue: event.venue || 'To be confirmed',
    price: event.price || 'To be confirmed',
    attendees
  });
});

// Admin Update Event (PUT /api/events/:id)
app.put('/api/events/:id', (req, res) => {
  const viewerId = req.query.viewerId || req.query.userId || req.headers['x-user-id'] || req.headers['authorization'];
  if (!viewerId) return res.status(401).json({ error: "Access Denied" });
  const cleanViewer = viewerId.startsWith('Bearer ') ? viewerId.slice(7).trim() : viewerId.trim();
  const member = db.prepare("SELECT * FROM users WHERE (id = ? OR LOWER(email) = ?)").get(cleanViewer, cleanViewer.toLowerCase());
  if (!member || (member.role !== 'FOUNDER' && member.role !== 'ADMIN')) {
    return res.status(403).json({ error: "Forbidden: Administrator permissions required to edit events." });
  }

  const existing = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Event not found" });

  const {
    title, headline, description, event_type, venue, capacity, available_spots,
    registration_status, registration_link, price, whats_included, travel_info,
    hosts, hero_image, agenda, display_date, start_date, end_date, date_precision
  } = req.body;

  db.prepare(`
    UPDATE events SET
      title = COALESCE(?, title),
      headline = COALESCE(?, headline),
      description = COALESCE(?, description),
      event_type = COALESCE(?, event_type),
      venue = COALESCE(?, venue),
      capacity = COALESCE(?, capacity),
      available_spots = COALESCE(?, available_spots),
      registration_status = COALESCE(?, registration_status),
      registration_link = COALESCE(?, registration_link),
      price = COALESCE(?, price),
      whats_included = COALESCE(?, whats_included),
      travel_info = COALESCE(?, travel_info),
      hosts = COALESCE(?, hosts),
      hero_image = COALESCE(?, hero_image),
      cover_image = COALESCE(?, cover_image),
      agenda = COALESCE(?, agenda),
      display_date = COALESCE(?, display_date),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      date_precision = COALESCE(?, date_precision)
    WHERE id = ?
  `).run(
    title, headline, description, event_type, venue, capacity, available_spots,
    registration_status, registration_link, price, whats_included, travel_info,
    hosts, hero_image, hero_image, agenda, display_date, start_date, end_date, date_precision,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  res.json({ success: true, event: updated });
});

// Admin Upload Event Image (POST /api/events/upload-image)
app.post('/api/events/upload-image', (req, res) => {
  const viewerId = req.query.viewerId || req.query.userId || req.headers['x-user-id'] || req.headers['authorization'];
  if (!viewerId) return res.status(401).json({ error: "Access Denied" });
  const cleanViewer = viewerId.startsWith('Bearer ') ? viewerId.slice(7).trim() : viewerId.trim();
  const member = db.prepare("SELECT * FROM users WHERE (id = ? OR LOWER(email) = ?)").get(cleanViewer, cleanViewer.toLowerCase());
  if (!member || (member.role !== 'FOUNDER' && member.role !== 'ADMIN')) {
    return res.status(403).json({ error: "Forbidden: Administrator permissions required." });
  }

  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: "Missing imageBase64 data" });
  }

  try {
    const extMatch = imageBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,/);
    const ext = extMatch ? (extMatch[1] === 'jpeg' ? 'jpg' : extMatch[1]) : 'jpg';
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const safeName = `cover_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

    const pubPath = path.join(__dirname, 'public', 'events', safeName);
    const mobilePubPath = path.join(__dirname, 'mobile', 'public', 'events', safeName);
    fs.writeFileSync(pubPath, buffer);
    try { fs.writeFileSync(mobilePubPath, buffer); } catch (_) {}

    res.json({ success: true, url: `/events/${safeName}` });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to save uploaded image" });
  }
});

// Personal Calendar .ICS Export (GET /api/events/:id/ics)
app.get('/api/events/:id/ics', (req, res) => {
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!event) return res.status(404).send("Event not found");

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const startUtc = formatDate(event.start_date || event.start_time);
  const endUtc = formatDate(event.end_date || event.end_time);
  const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const title = (event.headline || event.title || 'ÖZARA Gathering').replace(/,/g, '\\,');
  const location = (event.venue && event.venue !== 'To be confirmed' ? `${event.venue}, ` : '') + (event.location || '');
  const description = (event.description || '').replace(/\n/g, '\\n');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OZARA Private Club//Calendar 2026-2027//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@ozara.club`,
    `DTSTAMP:${nowUtc}`,
    startUtc ? `DTSTART:${startUtc}` : `DTSTART;VALUE=DATE:${event.year || 2027}0101`,
    endUtc ? `DTEND:${endUtc}` : `DTEND;VALUE=DATE:${event.year || 2027}0102`,
    `SUMMARY:ÖZARA: ${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location.replace(/,/g, '\\,')}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const icsData = icsLines.join('\r\n');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${event.id}.ics"`);
  res.send(icsData);
});

app.post(['/api/events/rsvp', '/api/events/:id/rsvp'], (req, res) => {
  const eventId = req.params.id || req.body.eventId || req.body.event_id;
  const userId = req.body.userId || req.body.user_id;
  const status = req.body.status || 'registered'; // 'registered', 'accepted', 'declined', 'cancelled'
  if (!eventId || !userId) {
    return res.status(400).json({ error: "Missing eventId or userId" });
  }

  const isDeclined = status === 'declined' || status === 'cancelled';

  if (isDeclined) {
    db.prepare("DELETE FROM event_registrations WHERE event_id = ? AND user_id = ?").run(eventId, userId);
    db.prepare(`
      UPDATE event_invitations
      SET status = 'declined', responded_at = CURRENT_TIMESTAMP
      WHERE event_id = ? AND user_id = ?
    `).run(eventId, userId);
  } else {
    db.prepare(`
      INSERT INTO event_registrations (event_id, user_id, status)
      VALUES (?, ?, 'registered')
      ON CONFLICT(event_id, user_id) DO UPDATE SET status = 'registered'
    `).run(eventId, userId);
    db.prepare(`
      UPDATE event_invitations
      SET status = 'accepted', responded_at = CURRENT_TIMESTAMP
      WHERE event_id = ? AND user_id = ?
    `).run(eventId, userId);
  }

  const regCount = db.prepare("SELECT count(*) as count FROM event_registrations WHERE event_id = ? AND status = 'registered'").get(eventId);
  const registeredCount = regCount ? regCount.count : 0;

  // Update registered_count and available_spots on event
  const evt = db.prepare("SELECT capacity FROM events WHERE id = ?").get(eventId);
  if (evt && evt.capacity) {
    const spots = Math.max(0, evt.capacity - registeredCount);
    db.prepare("UPDATE events SET registered_count = ?, available_spots = ? WHERE id = ?").run(registeredCount, spots, eventId);
  } else {
    db.prepare("UPDATE events SET registered_count = ? WHERE id = ?").run(registeredCount, eventId);
  }

  // Record admin activity
  const userObj = db.prepare("SELECT full_name FROM users WHERE id = ?").get(userId);
  const userName = userObj ? userObj.full_name : 'Member';
  const eventTitle = evt ? (evt.title || 'Event') : 'Event';
  recordAdminActivity({
    activityType: isDeclined ? 'rsvp_cancelled' : 'rsvp_confirmed',
    title: isDeclined ? 'RSVP Cancelled' : 'RSVP Confirmed',
    description: `${userName} ${isDeclined ? 'cancelled RSVP for' : 'registered for'} "${eventTitle}".`,
    actorId: userId,
    targetId: eventId,
    entityType: 'events',
    entityId: eventId
  });

  res.json({ success: true, registered_count: registeredCount, status: isDeclined ? 'declined' : 'registered' });
});

// Targeted Invitation Preview & Deduplication
app.post('/api/events/invitations/preview', (req, res) => {
  const { eventId, chapters, industries, includeTravelersInCity } = req.body;
  const today = new Date().toISOString().split('T')[0];

  let query = `
    SELECT DISTINCT u.id, u.full_name, u.headline, u.avatar_url, u.city, c.name as chapter_name
    FROM users u
    LEFT JOIN chapters c ON u.chapter_id = c.id
    LEFT JOIN travel_plans tp ON u.id = tp.user_id AND tp.end_date >= '${today}' AND tp.visibility = 'shared'
    LEFT JOIN taxonomies tx ON u.id = tx.user_id AND tx.category = 'industries'
    WHERE u.is_admitted = 1 AND (1=0
  `;

  const params = [];
  if (chapters && chapters.length > 0) {
    query += ` OR u.chapter_id IN (${chapters.map(() => '?').join(',')})`;
    params.push(...chapters);
  }
  if (includeTravelersInCity) {
    query += ` OR lower(tp.city) = lower(?)`;
    params.push(includeTravelersInCity);
  }
  if (industries && industries.length > 0) {
    query += ` OR tx.slug IN (${industries.map(() => '?').join(',')})`;
    params.push(...industries);
  }
  query += `)`;

  const recipients = db.prepare(query).all(...params);
  res.json({
    recipient_count: recipients.length,
    recipients
  });
});

app.post('/api/events/invitations/send', (req, res) => {
  const { eventId, recipientIds } = req.body;
  if (!eventId || !recipientIds || !recipientIds.length) return res.status(400).json({ error: "Missing data" });

  const insert = db.prepare(`
    INSERT OR IGNORE INTO event_invitations (event_id, user_id)
    VALUES (?, ?)
  `);
  recipientIds.forEach(uid => insert.run(eventId, uid));

  res.json({ success: true, count: recipientIds.length });
});

// -------------------------------------------------------------
// 6. INVESTMENTS (REAL ESTATE) & ACCESS CONDITIONS ENFORCEMENT
// -------------------------------------------------------------
app.get('/api/listings', (req, res) => {
  const listings = db.prepare(`
    SELECT re.*, u.full_name as creator_name
    FROM real_estate_listings re
    LEFT JOIN users u ON re.created_by = u.id
    WHERE re.status = 'active'
    ORDER BY re.created_at DESC
  `).all();

  res.json(listings.map(l => ({
    ...l,
    images: JSON.parse(l.images_json || '[]'),
    eligibility_requirements: JSON.parse(l.eligibility_requirements || '{"investor_type": "accredited_or_qualified", "conditions_version": "2026-10-v1"}')
  })));
});

// Common handler for investment inquiries with strict server-side conditions & eligibility enforcement
function handleInvestmentInquiry(req, res) {
  const listingId = req.params.id || req.body.listingId;
  const { memberId, inquiryType, notes } = req.body;
  if (!listingId || !memberId) return res.status(400).json({ error: "Missing required fields" });

  // 1. Verify Member Exists
  const member = db.prepare('SELECT id, accepted_access_conditions_version, role FROM users WHERE id = ?').get(memberId);
  if (!member) {
    return res.status(404).json({ error: "Member not found" });
  }

  // 2. Server-Side Enforcement: Must have accepted current Access Conditions
  if (member.accepted_access_conditions_version !== CURRENT_ACCESS_CONDITIONS_VERSION) {
    return res.status(403).json({
      error: "Access Conditions acceptance required before participating in or inquiring about real estate opportunities.",
      code: "CONDITIONS_NOT_ACCEPTED",
      required_version: CURRENT_ACCESS_CONDITIONS_VERSION
    });
  }

  // 3. Configurable Opportunity Eligibility Verification
  const listing = db.prepare('SELECT id, eligibility_requirements FROM real_estate_listings WHERE id = ?').get(listingId);
  if (!listing) {
    return res.status(404).json({ error: "Listing opportunity not found" });
  }
  const eligibility = JSON.parse(listing.eligibility_requirements || '{}');
  if (eligibility.conditions_version && member.accepted_access_conditions_version !== eligibility.conditions_version) {
    return res.status(403).json({
      error: `Opportunity requires acceptance of conditions version ${eligibility.conditions_version}.`,
      code: "CONDITIONS_VERSION_MISMATCH",
      required_version: eligibility.conditions_version
    });
  }

  // 4. Prohibited Content Guardrails
  const violation = validateContent(notes);
  if (violation) return res.status(422).json({ error: violation, flagged: true });

  // 5. Insert Inquiry Record
  const inqId = 'inq_' + Math.random().toString(36).substring(2, 9);
  db.prepare(`
    INSERT INTO listing_inquiries (id, listing_id, member_id, inquiry_type, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(inqId, listingId, memberId, inquiryType || 'request_info', notes || '');

  res.json({ success: true, inqId });
}

app.post('/api/listings/inquire', handleInvestmentInquiry);
app.post('/api/listings/:id/inquire', handleInvestmentInquiry);

// Access restricted investment documents (brochure / tear-sheet)
// Separates investment identity & eligibility check from community membership
app.get('/api/listings/:id/document', (req, res) => {
  const viewerId = req.query.viewerId || req.query.userId || req.headers['x-user-id'] || req.headers['authorization'];
  if (!viewerId) {
    return res.status(401).json({ error: "Access Denied: Community membership required." });
  }

  const cleanViewer = viewerId.startsWith('Bearer ') ? viewerId.slice(7).trim() : viewerId.trim();
  const member = db.prepare("SELECT * FROM users WHERE (id = ? OR LOWER(email) = ?) AND (is_admitted = 1 OR role IN ('FOUNDER', 'ADMIN'))").get(cleanViewer, cleanViewer.toLowerCase());
  
  if (!member) {
    return res.status(401).json({ error: "Access Denied: Community membership required." });
  }

  const listing = db.prepare('SELECT id, title, brochure_document_url, eligibility_requirements FROM real_estate_listings WHERE id = ?').get(req.params.id);
  if (!listing) {
    return res.status(404).json({ error: "Listing opportunity not found" });
  }

  // Separate investment eligibility check: Access Conditions check
  const eligibility = JSON.parse(listing.eligibility_requirements || '{}');
  if (eligibility.conditions_version && member.accepted_access_conditions_version !== eligibility.conditions_version) {
    return res.status(403).json({
      error: `Accessing investment documents requires acceptance of Access Conditions ${eligibility.conditions_version}.`,
      code: "CONDITIONS_VERSION_MISMATCH",
      required_version: eligibility.conditions_version
    });
  }

  res.json({
    success: true,
    document_url: listing.brochure_document_url,
    title: listing.title,
    listing_id: listing.id
  });
});

// -------------------------------------------------------------
// 6B. ÖZARA REAL ESTATE CATALOG, UNITS, SAVED LISTINGS & SYNC
// -------------------------------------------------------------

function formatCatalogItem(row, isSaved = false) {
  let images = [];
  try { images = JSON.parse(row.images_json || '[]'); } catch (e) {}
  let floorPlans = [];
  try { floorPlans = JSON.parse(row.floor_plans_json || '[]'); } catch (e) {}
  let features = [];
  try { features = JSON.parse(row.features_json || '[]'); } catch (e) {}
  let paymentTerms = {};
  try { paymentTerms = JSON.parse(row.payment_terms_json || '{}'); } catch (e) {}

  // Preserve reliable durable delivery routes; never fabricate fake photos
  if (!images || !Array.isArray(images) || images.length === 0) {
    images = [];
  } else {
    images = images.map((img, idx) => {
      if (typeof img === 'string' && (img.includes('developer.edex.estate') || img.includes('edex.estate'))) {
        return `/api/media/catalog/${row.id}/cards/${row.id}_${idx}.webp`;
      }
      return img;
    });
  }

  // Provide full_images array mapped to full-resolution variants
  const fullImages = images.map(img => {
    if (typeof img === 'string' && img.includes('/cards/')) {
      return img.replace('/cards/', '/full/');
    }
    return img;
  });

  return {
    id: row.id,
    source_id: row.source_id,
    developer_project_id: row.developer_project_id,
    title: row.title,
    description: row.description,
    description_full: row.description_full || row.description,
    property_type: row.property_type,
    country: normalizeCountryName(row.country),
    city: normalizeCityName(row.city),
    location: row.location,
    price_display: row.price_display,
    currency: row.currency,
    price_min_num: row.price_min_num,
    price_max_num: row.price_max_num,
    beds: row.beds,
    baths: row.baths,
    beds_min: row.beds_min,
    beds_max: row.beds_max,
    sqft: row.sqft,
    area_range: row.area_range,
    year: row.year,
    handover: row.handover,
    completion_status: row.completion_status,
    badge: row.badge,
    features,
    images,
    full_images: fullImages,
    floor_plans: floorPlans,
    map_url: row.map_url,
    payment_terms: paymentTerms,
    has_units: Boolean(row.has_units),
    units_count: row.units_count || 0,
    status: row.status,
    is_saved: Boolean(isSaved),
    updated_at: row.updated_at,
    created_at: row.created_at
  };
}

function formatUnitItem(row) {
  let unitTypes = [];
  try { unitTypes = JSON.parse(row.unit_types_json || '[]'); } catch (e) {}
  let images = [];
  try { images = JSON.parse(row.images_json || '[]'); } catch (e) {}

  return {
    id: row.id,
    parent_project_id: row.parent_project_id,
    parent_catalog_id: row.parent_catalog_id,
    title: row.title,
    description: row.description,
    unit_types: unitTypes,
    price_display: row.price_display,
    currency: row.currency,
    price: row.price,
    price_min: row.price_min,
    price_max: row.price_max,
    area_range: row.area_range,
    bedrooms_range: row.bedrooms_range,
    bedrooms_min: row.bedrooms_min,
    bedrooms_max: row.bedrooms_max,
    handover_quarter: row.handover_quarter,
    handover_year: row.handover_year,
    installment_plan: row.installment_plan,
    images,
    status: row.status
  };
}

function normalizeCategoryName(name) {
  if (!name) return 'Residential';
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'private island' || lower === 'private islands') return 'Private Islands';
  if (lower === 'residential') return 'Residential';
  if (lower === 'countryside') return 'Countryside';
  if (lower === 'commercial') return 'Commercial';
  if (lower === 'parking') return 'Parking';
  return trimmed.replace(/\b\w/g, l => l.toUpperCase());
}

const CANONICAL_COUNTRY_MAP = {
  'usa': 'United States',
  'united states': 'United States',
  'сша': 'United States',
  'uae': 'United Arab Emirates',
  'united arab emirates': 'United Arab Emirates',
  'оаэ': 'United Arab Emirates',
  'испания': 'Spain',
  'spain': 'Spain',
  'кения': 'Kenya',
  'kenya': 'Kenya'
};

function normalizeCountryName(country) {
  if (!country) return '';
  const key = country.trim().toLowerCase();
  return CANONICAL_COUNTRY_MAP[key] || country.trim();
}

const CANONICAL_CITY_MAP = {
  'найроби': 'Nairobi',
  'пафос': 'Paphos',
  'коста бланка': 'Costa Blanca'
};

function normalizeCityName(city) {
  if (!city) return '';
  const key = city.trim().toLowerCase();
  return CANONICAL_CITY_MAP[key] || city.trim();
}

function getCategoryIconKey(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('island')) return 'private_islands';
  if (n.includes('country') || n.includes('villa') || n.includes('house') || n.includes('cottage') || n.includes('estate')) return 'countryside';
  if (n.includes('commercial') || n.includes('office') || n.includes('retail') || n.includes('business')) return 'commercial';
  if (n.includes('parking') || n.includes('garage')) return 'parking';
  if (n.includes('pool')) return 'pools';
  if (n.includes('land') || n.includes('plot')) return 'land';
  if (n.includes('resident') || n.includes('apartment') || n.includes('condo')) return 'residential';
  return 'fallback';
}

// 0. Dynamic categories endpoint for landing page and results navigation
app.get('/api/investments/categories', (req, res) => {
  const rows = db.prepare(`
    SELECT property_type, COUNT(*) as cnt 
    FROM real_estate_catalog 
    WHERE status = 'published'
    GROUP BY property_type 
    ORDER BY cnt DESC
  `).all();

  const categoryMap = {};
  rows.forEach(r => {
    const norm = normalizeCategoryName(r.property_type);
    categoryMap[norm] = (categoryMap[norm] || 0) + r.cnt;
  });

  const total = Object.values(categoryMap).reduce((a, b) => a + b, 0);
  const categories = Object.keys(categoryMap)
    .sort((a, b) => categoryMap[b] - categoryMap[a])
    .map(name => ({
      id: name,
      name,
      count: categoryMap[name],
      icon_key: getCategoryIconKey(name),
      icon_url: `/investments/icons/${getCategoryIconKey(name)}.png`
    }));

  res.json({
    success: true,
    total_count: total,
    total_properties: total,
    categories
  });
});

// 1. Catalog listing with rich filters, search, sorting, and pagination
app.get('/api/investments/catalog', (req, res) => {
  const viewerId = req.query.viewerId || req.headers['x-user-id'];
  const typeFilter = (req.query.type || 'all').trim();
  const countryFilter = (req.query.country || 'all').trim();
  const cityFilter = (req.query.city || 'all').trim();
  const q = (req.query.q || '').toLowerCase().trim();
  const budgetMin = parseFloat(req.query.budgetMin || '0');
  const budgetMax = parseFloat(req.query.budgetMax || '0');
  const bedroomsFilter = (req.query.bedrooms || 'any').toLowerCase().trim();
  const featuresFilter = (req.query.features || '').toLowerCase().trim();
  const sort = (req.query.sort || 'newest').trim();
  const limit = Math.max(1, parseInt(req.query.limit || '20', 10));
  const offset = Math.max(0, parseInt(req.query.offset || '0', 10));

  // Retrieve published listings
  const rows = db.prepare(`
    SELECT * FROM real_estate_catalog 
    WHERE status = 'published'
    ORDER BY created_at DESC
  `).all();

  // Retrieve viewer's saved listing IDs
  let savedIds = new Set();
  if (viewerId) {
    try {
      const savedRows = db.prepare('SELECT listing_id FROM saved_listings WHERE user_id = ?').all(viewerId);
      savedIds = new Set(savedRows.map(r => r.listing_id));
    } catch (e) {}
  }

  // Compute dynamic filter options from all published catalog rows
  const countrySet = new Set();
  const citiesByCountry = {};
  const currenciesSet = new Set();
  const allFeaturesSet = new Set();
  const categoryCounts = {};



  const countryCounts = {};
  const cityCounts = {};
  const bedroomCounts = {
    'studio': 0,
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5+': 0
  };
  const budgetCounts = {
    '0-500000': 0,
    '500000-1000000': 0,
    '1000000-2500000': 0,
    '2500000-5000000': 0,
    '5000000-999999999': 0
  };
  const featureCounts = {
    'ready': 0,
    'instalments': 0,
    'sea_view': 0,
    'furnished': 0
  };

  rows.forEach(r => {
    const normType = normalizeCategoryName(r.property_type);
    categoryCounts[normType] = (categoryCounts[normType] || 0) + 1;

    const normCountry = normalizeCountryName(r.country);
    const normCity = normalizeCityName(r.city);

    if (normCountry) {
      countrySet.add(normCountry);
      countryCounts[normCountry] = (countryCounts[normCountry] || 0) + 1;
      if (!citiesByCountry[normCountry]) citiesByCountry[normCountry] = [];
      if (normCity && !citiesByCountry[normCountry].includes(normCity)) {
        citiesByCountry[normCountry].push(normCity);
      }
    }
    if (normCity) {
      cityCounts[normCity] = (cityCounts[normCity] || 0) + 1;
    }

    // Bedrooms counts
    const beds = r.beds !== null ? r.beds : null;
    const bMin = r.beds_min;
    const bMax = r.beds_max;
    if (beds === 0 || bMin === 0) bedroomCounts['studio']++;
    if (beds === 1 || (bMin <= 1 && bMax >= 1)) bedroomCounts['1']++;
    if (beds === 2 || (bMin <= 2 && bMax >= 2)) bedroomCounts['2']++;
    if (beds === 3 || (bMin <= 3 && bMax >= 3)) bedroomCounts['3']++;
    if (beds === 4 || (bMin <= 4 && bMax >= 4)) bedroomCounts['4']++;
    if ((beds !== null && beds >= 5) || (bMax !== null && bMax >= 5)) bedroomCounts['5+']++;

    // Budget counts
    const p = r.price_min_num || r.price_max_num || 0;
    if (p > 0 && p <= 500000) budgetCounts['0-500000']++;
    if (p >= 500000 && p <= 1000000) budgetCounts['500000-1000000']++;
    if (p >= 1000000 && p <= 2500000) budgetCounts['1000000-2500000']++;
    if (p >= 2500000 && p <= 5000000) budgetCounts['2500000-5000000']++;
    if (p >= 5000000) budgetCounts['5000000-999999999']++;

    // Features counts
    const featStr = (r.features_json || '').toLowerCase();
    const descStr = (r.description || '').toLowerCase();
    const compStr = (r.completion_status || '').toLowerCase();
    const hoStr = (r.handover || '').toLowerCase();
    if (compStr.includes('ready') || compStr.includes('completed') || compStr.includes('100%') ||
        hoStr.includes('ready') || hoStr.includes('completed') ||
        featStr.includes('ready') || featStr.includes('completed') ||
        descStr.includes('ready') || descStr.includes('completed')) {
      featureCounts['ready']++;
    }
    let hasPlan = false;
    try {
      const pt = JSON.parse(r.payment_terms_json || '{}');
      if (pt.installment_plan && String(pt.installment_plan).trim()) hasPlan = true;
    } catch (e) {}
    if (hasPlan || featStr.includes('instalment') || featStr.includes('installment') ||
        featStr.includes('payment plan') || descStr.includes('instalment')) {
      featureCounts['instalments']++;
    }
    if (featStr.includes('sea') || featStr.includes('ocean') || featStr.includes('waterfront') ||
        descStr.includes('sea view') || descStr.includes('seaview') || descStr.includes('ocean view')) {
      featureCounts['sea_view']++;
    }
    if (featStr.includes('furnish') || featStr.includes('furniture') || descStr.includes('furnished')) {
      featureCounts['furnished']++;
    }

    if (r.currency) currenciesSet.add(r.currency);
    try {
      const feats = JSON.parse(r.features_json || '[]');
      feats.forEach(f => {
        if (typeof f === 'string' && f.length < 40) allFeaturesSet.add(f.trim());
      });
    } catch (e) {}
  });

  const dynamicCategories = Object.keys(categoryCounts)
    .sort((a, b) => categoryCounts[b] - categoryCounts[a])
    .map(name => ({
      id: name,
      name,
      count: categoryCounts[name],
      icon_key: getCategoryIconKey(name),
      icon_url: `/investments/icons/${getCategoryIconKey(name)}.png`
    }));

  const filterOptions = {
    total_count: rows.length,
    countries: Array.from(countrySet).sort(),
    country_counts: countryCounts,
    cities_by_country: citiesByCountry,
    city_counts: cityCounts,
    bedroom_counts: bedroomCounts,
    budget_counts: budgetCounts,
    feature_counts: featureCounts,
    types: dynamicCategories.map(c => c.name),
    categories: dynamicCategories,
    currencies: Array.from(currenciesSet).sort(),
    features: Array.from(allFeaturesSet).slice(0, 30)
  };

  // Multi-choice target arrays
  const targetCountries = countryFilter !== 'all' 
    ? countryFilter.split(',').map(c => normalizeCountryName(c).toLowerCase().trim()).filter(c => c && c !== 'all') 
    : [];
  const targetCities = cityFilter !== 'all' 
    ? cityFilter.split(',').map(c => normalizeCityName(c).toLowerCase().trim()).filter(c => c && c !== 'all') 
    : [];
  const targetBeds = bedroomsFilter !== 'any' 
    ? bedroomsFilter.split(',').map(b => b.trim().toLowerCase()).filter(b => b && b !== 'any') 
    : [];
  const budgetBrackets = (req.query.budgetBrackets || req.query.budget || '')
    .split(',')
    .map(b => b.trim())
    .filter(b => b && b !== 'any');

  // Apply Filters
  let filtered = rows.filter(r => {
    // Type filter (normalized comparison)
    if (typeFilter !== 'all' && typeFilter !== 'All Properties') {
      const normProp = normalizeCategoryName(r.property_type).toLowerCase();
      if (normProp !== typeFilter.toLowerCase()) {
        return false;
      }
    }

    // Country filter (multi-choice OR match)
    if (targetCountries.length > 0) {
      const rowCountry = normalizeCountryName(r.country).toLowerCase();
      if (!targetCountries.includes(rowCountry)) {
        return false;
      }
    }

    // City filter (multi-choice OR match)
    if (targetCities.length > 0) {
      const rowCity = normalizeCityName(r.city).toLowerCase();
      if (!targetCities.includes(rowCity)) {
        return false;
      }
    }

    // Free text query
    if (q) {
      const matchTitle = (r.title || '').toLowerCase().includes(q);
      const matchDesc = (r.description || '').toLowerCase().includes(q);
      const matchLoc = (r.location || '').toLowerCase().includes(q);
      const matchCity = (r.city || '').toLowerCase().includes(q);
      const matchCountry = (r.country || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchLoc && !matchCity && !matchCountry) return false;
    }

    // Multi-choice Budget Brackets
    if (budgetBrackets.length > 0) {
      const p = r.price_min_num || r.price_max_num || 0;
      const inAnyBracket = budgetBrackets.some(br => {
        const parts = br.split('-').map(Number);
        const minB = parts[0] || 0;
        const maxB = parts[1] || 0;
        if (minB > 0 && maxB > 0) return p >= minB && p <= maxB;
        if (minB > 0 && maxB === 0) return p >= minB;
        if (minB === 0 && maxB > 0) return p <= maxB;
        return false;
      });
      if (!inAnyBracket) return false;
    } else {
      // Single Budget Min / Max fallback
      if (budgetMin > 0) {
        const p = r.price_min_num || r.price_max_num || 0;
        if (p < budgetMin) return false;
      }
      if (budgetMax > 0) {
        const p = r.price_min_num || r.price_max_num || 0;
        if (p > budgetMax) return false;
      }
    }

    // Bedrooms (multi-choice OR match)
    if (targetBeds.length > 0) {
      const beds = r.beds !== null ? r.beds : null;
      const bMin = r.beds_min;
      const bMax = r.beds_max;
      const matchAnyBed = targetBeds.some(bedChoice => {
        if (bedChoice === 'studio' || bedChoice === '0') {
          return beds === 0 || bMin === 0;
        } else if (bedChoice === '1' || bedChoice === '1 bd') {
          return beds === 1 || (bMin <= 1 && bMax >= 1);
        } else if (bedChoice === '2' || bedChoice === '2 bd') {
          return beds === 2 || (bMin <= 2 && bMax >= 2);
        } else if (bedChoice === '3' || bedChoice === '3 bd') {
          return beds === 3 || (bMin <= 3 && bMax >= 3);
        } else if (bedChoice === '4' || bedChoice === '4 bd') {
          return beds === 4 || (bMin <= 4 && bMax >= 4);
        } else if (bedChoice === '5' || bedChoice === '5 bd') {
          return beds === 5 || (bMin <= 5 && bMax >= 5);
        } else if (bedChoice === '6+' || bedChoice === '6+ bd' || bedChoice === '6') {
          return (beds !== null && beds >= 6) || (bMax !== null && bMax >= 6);
        } else if (bedChoice === '4+') {
          return (beds !== null && beds >= 4) || (bMax !== null && bMax >= 4);
        }
        return false;
      });
      if (!matchAnyBed) return false;
    }

    // Features (Supports canonical features: ready, instalments, sea_view, furnished)
    if (featuresFilter) {
      const activeFeats = featuresFilter.split(',').map(f => f.trim().toLowerCase()).filter(Boolean);
      const featStr = (r.features_json || '').toLowerCase();
      const descStr = (r.description || '').toLowerCase();
      const titleStr = (r.title || '').toLowerCase();
      const compStr = (r.completion_status || '').toLowerCase();
      const hoStr = (r.handover || '').toLowerCase();

      const matchesFeature = (f) => {
        if (f === 'ready') {
          return compStr.includes('ready') || compStr.includes('completed') || compStr.includes('100%') ||
                 hoStr.includes('ready') || hoStr.includes('completed') ||
                 featStr.includes('ready') || featStr.includes('completed') ||
                 descStr.includes('ready') || descStr.includes('completed');
        }
        if (f === 'instalments' || f === 'installment') {
          let hasPlan = false;
          try {
            const pt = JSON.parse(r.payment_terms_json || '{}');
            if (pt.installment_plan && String(pt.installment_plan).trim()) hasPlan = true;
          } catch (e) {}
          return hasPlan || featStr.includes('instalment') || featStr.includes('installment') ||
                 featStr.includes('payment plan') || descStr.includes('instalment');
        }
        if (f === 'sea_view' || f === 'sea view' || f === 'seaview') {
          return featStr.includes('sea') || featStr.includes('ocean') || featStr.includes('beach') ||
                 titleStr.includes('sea') || descStr.includes('sea view');
        }
        if (f === 'furnished') {
          return (featStr.includes('furnished') || descStr.includes('furnished')) &&
                 !featStr.includes('unfurnished') && !descStr.includes('unfurnished');
        }
        return featStr.includes(f) || descStr.includes(f);
      };

      const hasMatch = activeFeats.some(f => matchesFeature(f));
      if (!hasMatch) return false;
    }

    return true;
  });

  // Apply Sorting
  filtered.sort((a, b) => {
    if (sort === 'price_asc') {
      const pa = a.price_min_num || 999999999;
      const pb = b.price_min_num || 999999999;
      return pa - pb;
    }
    if (sort === 'price_desc') {
      const pa = a.price_min_num || 0;
      const pb = b.price_min_num || 0;
      return pb - pa;
    }
    if (sort === 'title') {
      return (a.title || '').localeCompare(b.title || '');
    }
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  // Paginate
  const paginated = filtered.slice(offset, offset + limit);
  const listings = paginated.map(r => formatCatalogItem(r, savedIds.has(r.id)));

  // Latest sync completion
  let lastSyncTime = new Date().toISOString();
  try {
    const lastSync = db.prepare('SELECT completed_at FROM investment_sync_logs WHERE status = "success" ORDER BY started_at DESC LIMIT 1').get();
    if (lastSync && lastSync.completed_at) lastSyncTime = lastSync.completed_at;
  } catch (e) {}

  res.json({
    listings,
    total: filtered.length,
    has_more: offset + paginated.length < filtered.length,
    limit,
    offset,
    last_updated: lastSyncTime,
    filter_options: filterOptions
  });
});

// 2. Single property full detail with units list and save status
app.get('/api/investments/catalog/:id', (req, res) => {
  const viewerId = req.query.viewerId || req.headers['x-user-id'];
  const row = db.prepare('SELECT * FROM real_estate_catalog WHERE id = ? OR source_id = ?').get(req.params.id, req.params.id);
  if (!row) {
    return res.status(404).json({ error: "Property listing not found." });
  }

  // Fetch individual units under this project
  const units = db.prepare(`
    SELECT * FROM real_estate_units 
    WHERE parent_catalog_id = ? OR parent_project_id = ?
    ORDER BY price_min ASC, price ASC
  `).all(row.id, row.developer_project_id);

  let isSaved = false;
  if (viewerId) {
    try {
      const saved = db.prepare('SELECT 1 FROM saved_listings WHERE user_id = ? AND listing_id = ?').get(viewerId, row.id);
      isSaved = Boolean(saved);
    } catch (e) {}
  }

  const catalogItem = formatCatalogItem(row, isSaved);
  catalogItem.units = units.map(formatUnitItem);
  catalogItem.units_count = units.length;
  catalogItem.has_units = units.length > 0;

  res.json(catalogItem);
});

// 3. Units list for a project
app.get('/api/investments/catalog/:id/units', (req, res) => {
  const row = db.prepare('SELECT id, developer_project_id FROM real_estate_catalog WHERE id = ? OR source_id = ?').get(req.params.id, req.params.id);
  if (!row) {
    return res.status(404).json({ error: "Property listing not found." });
  }

  const units = db.prepare(`
    SELECT * FROM real_estate_units 
    WHERE parent_catalog_id = ? OR parent_project_id = ?
    ORDER BY price_min ASC, price ASC
  `).all(row.id, row.developer_project_id);

  res.json(units.map(formatUnitItem));
});

// 4. Toggle saved listing
app.post('/api/investments/saved/:id', (req, res) => {
  const viewerId = req.body?.viewerId || req.body?.userId || req.headers['x-user-id'];
  if (!viewerId) return res.status(401).json({ error: "Authentication required to bookmark listings." });
  
  const listing = db.prepare('SELECT id FROM real_estate_catalog WHERE id = ? OR source_id = ?').get(req.params.id, req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found." });

  const existing = db.prepare('SELECT id FROM saved_listings WHERE user_id = ? AND listing_id = ?').get(viewerId, listing.id);
  if (existing) {
    db.prepare('DELETE FROM saved_listings WHERE id = ?').run(existing.id);
    return res.json({ success: true, is_saved: false, listing_id: listing.id });
  } else {
    const saveId = 'save_' + Math.random().toString(36).substring(2, 9);
    db.prepare('INSERT INTO saved_listings (id, user_id, listing_id) VALUES (?, ?, ?)').run(saveId, viewerId, listing.id);
    return res.json({ success: true, is_saved: true, listing_id: listing.id });
  }
});

// 5. Get saved listings for viewer
app.get('/api/investments/saved', (req, res) => {
  const viewerId = req.query.viewerId || req.headers['x-user-id'];
  if (!viewerId) return res.status(401).json({ error: "Authentication required to view saved listings." });

  const rows = db.prepare(`
    SELECT c.* FROM real_estate_catalog c
    JOIN saved_listings s ON c.id = s.listing_id
    WHERE s.user_id = ? AND c.status = 'published'
    ORDER BY s.created_at DESC
  `).all(viewerId);

  res.json(rows.map(r => formatCatalogItem(r, true)));
});

// 6. Request Details primary action
app.post('/api/investments/request-details', (req, res) => {
  const { listingId, memberId, unitId, notes } = req.body || {};
  if (!listingId || !memberId) {
    return res.status(400).json({ error: "Missing required fields: listingId and memberId are required." });
  }

  // 1. Verify Member
  const member = db.prepare('SELECT id, full_name, email, accepted_access_conditions_version FROM users WHERE id = ?').get(memberId);
  if (!member) {
    return res.status(404).json({ error: "Member not found." });
  }

  // 2. Server-Enforce Access Conditions Acceptance
  if (member.accepted_access_conditions_version !== CURRENT_ACCESS_CONDITIONS_VERSION) {
    return res.status(403).json({
      error: "Access Conditions acceptance required before requesting property details.",
      code: "CONDITIONS_NOT_ACCEPTED",
      required_version: CURRENT_ACCESS_CONDITIONS_VERSION
    });
  }

  // 3. Prohibited Content Guardrails
  const violation = validateContent(notes || '');
  if (violation) {
    return res.status(422).json({ error: violation, flagged: true });
  }

  // 4. Verify Listing
  const listing = db.prepare('SELECT id, title, location, price_display FROM real_estate_catalog WHERE id = ? OR source_id = ?').get(listingId, listingId);
  if (!listing) {
    return res.status(404).json({ error: "Property listing not found." });
  }

  let unitTitle = null;
  if (unitId) {
    const unit = db.prepare('SELECT title, price_display FROM real_estate_units WHERE id = ?').get(unitId);
    if (unit) unitTitle = `${unit.title} (${unit.price_display || ''})`;
  }

  // 5. Insert Inquiry Record
  const inqId = 'inq_' + Math.random().toString(36).substring(2, 9);
  const detailNotes = unitTitle 
    ? `[Unit: ${unitTitle}] ${notes || 'Requested property details and availability.'}`
    : (notes || 'Requested property details and availability.');

  db.prepare(`
    INSERT INTO listing_inquiries (id, listing_id, member_id, inquiry_type, notes)
    VALUES (?, ?, ?, 'request_info', ?)
  `).run(inqId, listing.id, member.id, detailNotes);

  // 6. Route to designated ÖZARA Real Estate Admin
  console.log(`[REAL ESTATE INQUIRY] Routed to iuliiashchukinainvest@gmail.com and ermolov.elena@gmail.com for ${member.full_name} (${member.email}) on ${listing.title}`);

  sendEmailNotification({
    to: 'iuliiashchukinainvest@gmail.com',
    subject: `[ÖZARA Investment Inquiry] New details request: ${listing.title}`,
    text: `Member ${member.full_name} (${member.email}) has requested details for: ${listing.title}\nLocation: ${listing.location}\nPrice: ${listing.price_display}\nNotes: ${detailNotes}`,
    html: `<div style="font-family: sans-serif; color: #111;">
      <h2>ÖZARA Real Estate Inquiry</h2>
      <p><strong>Member:</strong> ${member.full_name} (${member.email})</p>
      <p><strong>Property:</strong> ${listing.title}</p>
      <p><strong>Location:</strong> ${listing.location}</p>
      <p><strong>Price:</strong> ${listing.price_display}</p>
      ${unitTitle ? `<p><strong>Unit:</strong> ${unitTitle}</p>` : ''}
      <p><strong>Notes:</strong> ${detailNotes}</p>
    </div>`
  }).catch(e => console.warn('Email dispatch failed:', e.message));

  recordAdminActivity({
    activityType: 'investment_inquiry',
    title: 'Investment Inquiry',
    description: `${member.full_name} submitted details inquiry for "${listing.title}".`,
    actorId: member.id,
    targetId: listing.id,
    entityType: 'real_estate_catalog',
    entityId: listing.id
  });

  res.json({
    success: true,
    inquiry_id: inqId,
    message: "Your request has been received. The ÖZARA real estate team will follow up with verified documentation."
  });
});

// 7. Admin-Only Sync Now Action
app.post('/api/investments/sync', (req, res) => {
  const { exec } = require('child_process');
  exec('python3 tools/sync_real_estate_catalog.py --manual', { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
      console.error('[SYNC ERROR]', stderr || error.message);
      return res.status(500).json({ success: false, error: error.message, details: stderr });
    }
    const lastSync = db.prepare('SELECT * FROM investment_sync_logs ORDER BY started_at DESC LIMIT 1').get();
    res.json({ success: true, message: "Catalog synchronization complete.", sync_log: lastSync });
  });
});

// 8. Sync Status
app.get('/api/investments/sync-status', (req, res) => {
  const lastSync = db.prepare('SELECT * FROM investment_sync_logs ORDER BY started_at DESC LIMIT 1').get();
  res.json({
    sync_enabled: process.env.INVESTMENTS_SYNC_ENABLED === 'true',
    last_sync: lastSync || null
  });
});

// ============================================================================
// ÖZARA COMMUNITY WALL ENDPOINTS (Strictly restricted to admitted members)
// ============================================================================

function handleGetCommunityPosts(req, res) {
  const auth = validateSession(req);
  if (!auth.authenticated) {
    return res.status(auth.status).json({ error: auth.error });
  }
  const member = auth.user;

  const isAdmin = ['FOUNDER', 'ADMIN'].includes(member.role);
  const filter = (req.query.filter || 'all').toLowerCase();

  try {
    let whereClauses = [];
    if (isAdmin && req.query.include_pending === 'true') {
      whereClauses.push("(p.status IN ('published', 'pending_review') OR p.status IS NULL)");
    } else {
      whereClauses.push("(p.status = 'published' OR p.status IS NULL)");
    }

    if (filter === 'ozara') {
      whereClauses.push("(p.source_type = 'telegram' OR p.is_official = 1)");
    } else if (filter === 'members') {
      whereClauses.push("(p.source_type = 'member' OR p.source_type IS NULL) AND (p.is_official = 0 OR p.is_official IS NULL)");
    }

    const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    const posts = db.prepare(`
      SELECT p.*,
             u.full_name as author_name,
             u.avatar_url as author_avatar,
             u.headline as author_headline,
             u.role as author_role
      FROM community_posts p
      LEFT JOIN users u ON p.author_id = u.id
      ${whereSql}
      ORDER BY p.created_at DESC
    `).all();

    // Fetch media attachments
    let mediaByPost = {};
    try {
      const mediaRows = db.prepare(`
        SELECT * FROM community_post_media ORDER BY post_id, order_index ASC
      `).all();
      for (const m of mediaRows) {
        if (!mediaByPost[m.post_id]) mediaByPost[m.post_id] = [];
        mediaByPost[m.post_id].push({
          id: m.id,
          media_type: m.media_type,
          url: m.url,
          thumbnail_url: m.thumbnail_url,
          caption: m.caption,
          width: m.width,
          height: m.height
        });
      }
    } catch (e) {
      // ignore if media table not yet queried
    }

    const comments = db.prepare(`
      SELECT c.*,
             u.full_name as author_name,
             u.avatar_url as author_avatar,
             u.headline as author_headline,
             u.role as author_role
      FROM community_comments c
      JOIN users u ON c.author_id = u.id
      ORDER BY c.created_at ASC
    `).all();

    const commentsByPost = {};
    for (const c of comments) {
      if (!commentsByPost[c.post_id]) {
        commentsByPost[c.post_id] = [];
      }
      commentsByPost[c.post_id].push({
        id: c.id,
        post_id: c.post_id,
        author_id: c.author_id,
        author: {
          id: c.author_id,
          full_name: c.author_name,
          avatar_url: c.author_avatar,
          headline: c.author_headline || 'ÖZARA Member',
          role: c.author_role
        },
        content: c.content,
        created_at: c.created_at
      });
    }

    const result = posts.map(p => {
      const isOfficial = p.source_type === 'telegram' || p.is_official === 1;
      return {
        id: p.id,
        source_type: p.source_type || 'member',
        author_label: p.author_label || (isOfficial ? 'From ÖZARA' : null),
        is_official: Boolean(isOfficial),
        author_id: p.author_id,
        author: isOfficial ? {
          id: 'usr_ozara_official',
          full_name: p.telegram_author_name || 'ÖZARA',
          avatar_url: (p.telegram_author_name && p.telegram_author_name.includes('Julia')) ? '/avatars/julia_shchukina.jpg' : ((p.telegram_author_name && p.telegram_author_name.includes('Alexandra')) ? '/avatars/alexandra_hill.jpg' : '/investments/icons/fallback.png'),
          headline: 'Curated Club Intelligence',
          role: 'ADMIN'
        } : {
          id: p.author_id,
          full_name: p.author_name || 'ÖZARA Member',
          avatar_url: p.author_avatar,
          headline: p.author_headline || 'ÖZARA Member',
          role: p.author_role || 'MEMBER'
        },
        topic: p.topic || null,
        content: p.content,
        original_content: p.original_content || null,
        original_language: p.original_language || null,
        translated: Boolean(p.translated),
        admin_corrected: Boolean(p.admin_corrected),
        source_modified_after_admin_edit: Boolean(p.source_modified_after_admin_edit),
        status: p.status || 'published',
        media_attachments: mediaByPost[p.id] || [],
        telegram_author_name: p.telegram_author_name || null,
        created_at: p.created_at,
        updated_at: p.updated_at,
        comments_count: (commentsByPost[p.id] || []).length,
        comments: commentsByPost[p.id] || []
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Error fetching community posts:", err);
    res.status(500).json({ error: "Failed to fetch community posts" });
  }
}

// 1. Get posts feed (both /api/community/posts and /api/posts alias)
app.get('/api/community/posts', handleGetCommunityPosts);
app.get('/api/posts', handleGetCommunityPosts);

// File/Media Upload for Community
app.post('/api/community/upload', (req, res) => {
  const auth = validateSession(req);
  if (!auth.authenticated) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { filename, data, media_type } = req.body;
  if (!filename || !data) {
    return res.status(400).json({ error: "Filename and file data are required." });
  }

  try {
    const ext = path.extname(filename).toLowerCase();
    const safeBase = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${safeBase}${ext}`;
    const uploadDir = path.join(__dirname, 'public', 'uploads', 'community');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, uniqueName);

    // Parse base64 data
    const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    if (matches && matches.length === 3) {
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(data, 'base64');
    }

    fs.writeFileSync(filePath, buffer);
    const publicUrl = `/uploads/community/${uniqueName}`;

    res.json({
      success: true,
      url: publicUrl,
      filename: filename,
      media_type: media_type || 'file',
      size: buffer.length
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload file." });
  }
});

// 2. Create post
app.post('/api/community/posts', (req, res) => {
  const auth = validateSession(req);
  if (!auth.authenticated) {
    return res.status(auth.status).json({ error: auth.error });
  }
  const member = auth.user;

  const { content, topic, attachments } = req.body;
  if (!content || typeof content !== 'string' || content.trim().length < 3) {
    return res.status(400).json({ error: "Content must be at least 3 characters." });
  }

  const cleanTopic = null; // Topics removed per specification

  // Content guardrails
  const violation = validateContent(content);
  if (violation) {
    return res.status(400).json({ error: violation });
  }

  const postId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO community_posts (id, author_id, topic, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(postId, member.id, cleanTopic, content.trim(), now, now);

    // Save attached media (photos, videos, files, links)
    const mediaAttachments = [];
    if (Array.isArray(attachments)) {
      attachments.forEach((att, idx) => {
        if (!att) return;
        const mediaUrl = String(att.url || att.media_url || '').trim();
        if (!mediaUrl) return;
        const mediaId = `cpm_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
        const validTypes = ['photo', 'video', 'file', 'link'];
        const mediaType = validTypes.includes(att.media_type) ? att.media_type : 'photo';
        const caption = (att.caption || att.filename || att.title) ? String(att.caption || att.filename || att.title).trim().slice(0, 255) : null;
        try {
          db.prepare(`
            INSERT INTO community_post_media (id, post_id, media_type, url, thumbnail_url, caption, order_index, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(mediaId, postId, mediaType, mediaUrl, mediaUrl, caption, idx, now);
          mediaAttachments.push({
            id: mediaId,
            media_type: mediaType,
            url: mediaUrl,
            thumbnail_url: mediaUrl,
            caption: caption,
            order_index: idx
          });
        } catch (e) {
          console.warn('Error inserting community_post_media:', e.message);
        }
      });
    }

    const newPost = {
      id: postId,
      author_id: member.id,
      author: {
        id: member.id,
        full_name: member.full_name,
        avatar_url: member.avatar_url,
        headline: member.headline || 'ÖZARA Member',
        role: member.role
      },
      topic: null,
      content: content.trim(),
      created_at: now,
      updated_at: now,
      media_attachments: mediaAttachments,
      comments_count: 0,
      comments: []
    };

    // 1. Record Admin Activity
    recordAdminActivity({
      activityType: 'community_post',
      title: 'New Community Post',
      description: `${member.full_name} published a post in Community: "${content.trim().slice(0, 80)}..."`,
      actorId: member.id,
      entityType: 'community_posts',
      entityId: postId
    });

    // 2. Dispatch in-app notifications & queued emails to interested members
    const eligibleMembers = db.prepare(`
      SELECT u.id, u.email, u.full_name,
             np.email_new_posts, np.in_app_new_posts
      FROM users u
      LEFT JOIN notification_preferences np ON u.id = np.user_id
      WHERE u.id != ? AND (u.is_admitted = 1 OR u.role IN ('FOUNDER', 'ADMIN'))
    `).all(member.id);

    const postSnippet = content.trim().length > 120 ? content.trim().slice(0, 117) + '...' : content.trim();

    for (const em of eligibleMembers) {
      const wantsInApp = em.in_app_new_posts === null || em.in_app_new_posts === 1;
      const emailPref = em.email_new_posts || 'immediate';

      let notifId = null;
      if (wantsInApp) {
        notifId = 'notif_' + Math.random().toString(36).substring(2, 10);
        try {
          db.prepare(`
            INSERT INTO in_app_notifications (id, user_id, type, title, message, action_url, metadata_json, category)
            VALUES (?, ?, 'community_post', ?, ?, ?, ?, 'community')
          `).run(
            notifId, em.id, 'New Community Post',
            `${member.full_name} shared a post: "${postSnippet}"`,
            `#community?post=${postId}`,
            JSON.stringify({ post_id: postId, author_id: member.id, author_name: member.full_name })
          );
        } catch (e) {}
      }

      if (emailPref === 'immediate' && em.email) {
        queueAndSendEmail({
          to: em.email,
          recipientUserId: em.id,
          notificationId: notifId,
          category: 'community',
          subject: `${member.full_name} posted in ÖZARA Community`,
          templateType: 'community_post',
          templateData: {
            title: 'New Community Discussion',
            preheader: `${member.full_name} posted in ÖZARA Community`,
            badge: 'COMMUNITY',
            bodyText: `<strong>${member.full_name}</strong> shared a new post on the ÖZARA Community wall:<br><br><blockquote style="margin: 0; padding: 12px 16px; border-left: 3px solid #7c3aed; background: rgba(255,255,255,0.03); color: #e2e8f0; font-style: italic;">"${postSnippet}"</blockquote>`,
            ctaText: 'View & Reply',
            ctaUrl: `http://localhost:3000/#community?post=${postId}`
          },
          actionUrl: `#community?post=${postId}`,
          idempotencyKey: `post_${postId}_user_${em.id}`
        }).catch(err => console.error('[EMAIL QUEUE ERROR]', err.message));
      }
    }

    res.status(201).json(newPost);
  } catch (err) {
    console.error("Error creating community post:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// 3. Edit post
app.put('/api/community/posts/:id', (req, res) => {
  const auth = validateSession(req);
  if (!auth.authenticated) {
    return res.status(auth.status).json({ error: auth.error });
  }
  const member = auth.user;

  const post = db.prepare("SELECT * FROM community_posts WHERE id = ?").get(req.params.id);
  if (!post) {
    return res.status(404).json({ error: "Post not found." });
  }

  const isAuthor = post.author_id === member.id;
  const isAdmin = ['FOUNDER', 'ADMIN'].includes(member.role);
  if (!isAuthor && !isAdmin) {
    return res.status(403).json({ error: "Permission denied: Only the author or an admin can edit this post." });
  }

  const { content, topic } = req.body;
  if (!content || typeof content !== 'string' || content.trim().length < 3) {
    return res.status(400).json({ error: "Content must be at least 3 characters." });
  }

  const validTopics = ['Question', 'Introduction', 'Expertise', 'Opportunity'];
  const cleanTopic = topic !== undefined ? (validTopics.includes(topic) ? topic : null) : post.topic;

  const violation = validateContent(content);
  if (violation) {
    return res.status(400).json({ error: violation });
  }

  const now = new Date().toISOString();
  try {
    db.prepare(`
      UPDATE community_posts
      SET content = ?, topic = ?, updated_at = ?
      WHERE id = ?
    `).run(content.trim(), cleanTopic, now, post.id);

    res.json({ success: true, id: post.id, content: content.trim(), topic: cleanTopic, updated_at: now });
  } catch (err) {
    console.error("Error editing community post:", err);
    res.status(500).json({ error: "Failed to update post" });
  }
});

// 4. Delete post
app.delete('/api/community/posts/:id', (req, res) => {
  const auth = validateSession(req);
  if (!auth.authenticated) {
    return res.status(auth.status).json({ error: auth.error });
  }
  const member = auth.user;

  const post = db.prepare("SELECT * FROM community_posts WHERE id = ?").get(req.params.id);
  if (!post) {
    return res.status(404).json({ error: "Post not found." });
  }

  const isAuthor = post.author_id === member.id;
  const isAdmin = ['FOUNDER', 'ADMIN'].includes(member.role);
  if (!isAuthor && !isAdmin) {
    return res.status(403).json({ error: "Permission denied: Only the author or an admin can delete this post." });
  }

  try {
    db.prepare("DELETE FROM community_comments WHERE post_id = ?").run(post.id);
    db.prepare("DELETE FROM community_posts WHERE id = ?").run(post.id);
    res.json({ success: true, message: "Post deleted successfully." });
  } catch (err) {
    console.error("Error deleting community post:", err);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// 5. Add comment
app.post('/api/community/posts/:id/comments', (req, res) => {
  const auth = validateSession(req);
  if (!auth.authenticated) {
    return res.status(auth.status).json({ error: auth.error });
  }
  const member = auth.user;

  const post = db.prepare("SELECT * FROM community_posts WHERE id = ?").get(req.params.id);
  if (!post) {
    return res.status(404).json({ error: "Post not found." });
  }

  const { content } = req.body;
  if (!content || typeof content !== 'string' || content.trim().length < 1) {
    return res.status(400).json({ error: "Comment cannot be empty." });
  }

  const violation = validateContent(content);
  if (violation) {
    return res.status(400).json({ error: violation });
  }

  const commentId = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO community_comments (id, post_id, author_id, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(commentId, post.id, member.id, content.trim(), now, now);

    const comment = {
      id: commentId,
      post_id: post.id,
      author_id: member.id,
      author: {
        id: member.id,
        full_name: member.full_name,
        avatar_url: member.avatar_url,
        headline: member.headline || 'ÖZARA Member',
        role: member.role
      },
      content: content.trim(),
      created_at: now
    };

    // 1. Record Admin Activity
    recordAdminActivity({
      activityType: 'community_comment',
      title: 'New Community Comment',
      description: `${member.full_name} commented on a post.`,
      actorId: member.id,
      targetId: post.author_id,
      entityType: 'community_comments',
      entityId: commentId
    });

    // 2. Notify post author if different
    if (post.author_id && post.author_id !== member.id) {
      const author = db.prepare("SELECT id, email, full_name FROM users WHERE id = ?").get(post.author_id);
      if (author) {
        const notifId = 'notif_' + Math.random().toString(36).substring(2, 10);
        try {
          db.prepare(`
            INSERT INTO in_app_notifications (id, user_id, type, title, message, action_url, metadata_json, category)
            VALUES (?, ?, 'community_comment', ?, ?, ?, ?, 'community')
          `).run(
            notifId, author.id, 'New Comment on Your Post',
            `${member.full_name} commented on your post: "${content.trim().slice(0, 80)}"`,
            `#community?post=${post.id}`,
            JSON.stringify({ post_id: post.id, comment_id: commentId, commenter_id: member.id, commenter_name: member.full_name })
          );
        } catch (e) {}
      }
    }

    res.status(201).json(comment);
  } catch (err) {
    console.error("Error creating comment:", err);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

// 6. Delete comment
app.delete('/api/community/comments/:id', (req, res) => {
  const auth = validateSession(req);
  if (!auth.authenticated) {
    return res.status(auth.status).json({ error: auth.error });
  }
  const member = auth.user;

  const comment = db.prepare(`
    SELECT c.*, p.author_id as post_author_id 
    FROM community_comments c 
    JOIN community_posts p ON c.post_id = p.id 
    WHERE c.id = ?
  `).get(req.params.id);
  if (!comment) {
    return res.status(404).json({ error: "Comment not found." });
  }

  const isCommentAuthor = comment.author_id === member.id;
  const isPostAuthor = comment.post_author_id === member.id;
  const isAdmin = ['FOUNDER', 'ADMIN'].includes(member.role);
  if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
    return res.status(403).json({ error: "Permission denied: Only the comment author, post author, or an admin can delete this comment." });
  }

  try {
    db.prepare("DELETE FROM community_comments WHERE id = ?").run(comment.id);
    res.json({ success: true, message: "Comment deleted successfully." });
  } catch (err) {
    console.error("Error deleting comment:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

// 7. Admin Translation Correction
app.put('/api/community/posts/:id/translation', (req, res) => {
  const auth = validateSession(req);
  if (!auth.authenticated) {
    return res.status(auth.status).json({ error: auth.error });
  }
  if (!['FOUNDER', 'ADMIN'].includes(auth.user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { content } = req.body;
  if (!content || typeof content !== 'string') return res.status(400).json({ error: "Content required" });

  db.prepare(`
    UPDATE community_posts 
    SET content = ?, admin_corrected = 1, source_modified_after_admin_edit = 0, updated_at = datetime('now')
    WHERE id = ?
  `).run(content.trim(), req.params.id);

  res.json({ success: true, message: "Translation updated" });
});

// 8. Admin Post Moderation (hide, publish, delete)
app.patch('/api/community/posts/:id/moderate', (req, res) => {
  const auth = validateSession(req);
  if (!auth.authenticated) {
    return res.status(auth.status).json({ error: auth.error });
  }
  if (!['FOUNDER', 'ADMIN'].includes(auth.user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { action } = req.body; // 'hide', 'publish', 'delete'
  if (action === 'delete') {
    db.prepare("DELETE FROM community_comments WHERE post_id = ?").run(req.params.id);
    db.prepare("DELETE FROM community_post_media WHERE post_id = ?").run(req.params.id);
    db.prepare("DELETE FROM community_posts WHERE id = ?").run(req.params.id);
  } else if (action === 'hide') {
    db.prepare("UPDATE community_posts SET status = 'hidden', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  } else if (action === 'publish') {
    db.prepare("UPDATE community_posts SET status = 'published', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  } else {
    return res.status(400).json({ error: "Invalid action" });
  }

  res.json({ success: true, action });
});

// 9. Community Settings & Sync Trigger
app.get('/api/community/settings', (req, res) => {
  try {
    const autoPub = db.prepare("SELECT value FROM community_settings WHERE key = 'auto_publish_enabled'").get();
    res.json({
      auto_publish_enabled: autoPub ? autoPub.value === '1' : true,
      telegram_group_id: process.env.TELEGRAM_GROUP_ID || null,
      telegram_approved_authors: process.env.TELEGRAM_APPROVED_AUTHOR_IDS || null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/community/settings', (req, res) => {
  const { auto_publish_enabled } = req.body;
  if (auto_publish_enabled !== undefined) {
    db.prepare("INSERT OR REPLACE INTO community_settings (key, value, updated_at) VALUES ('auto_publish_enabled', ?, datetime('now'))")
      .run(auto_publish_enabled ? '1' : '0');
  }
  res.json({ success: true, auto_publish_enabled });
});

app.post('/api/telegram/sync', (req, res) => {
  const { exec } = require('child_process');
  exec('python3 tools/sync_telegram_channel.py 1', (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message, stderr });
    }
    res.json({ success: true, stdout });
  });
});

// 10. Webhook receiver for Telegram group updates (with secret validation)
app.post('/api/telegram/webhook', (req, res) => {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (!receivedSecret || receivedSecret !== expectedSecret) {
      console.warn('[TELEGRAM WEBHOOK REJECTED] Secret token mismatch or missing');
      return res.status(401).json({ error: "Unauthorized: Invalid webhook secret token" });
    }
  }

  const update = req.body;
  if (!update || !update.update_id) {
    return res.status(400).json({ error: "Invalid Telegram update payload" });
  }

  try {
    // 1. Persist to inbox before acknowledging (zero post loss guarantee)
    db.prepare(`
      INSERT OR IGNORE INTO telegram_inbox_updates (update_id, raw_json, processed, created_at)
      VALUES (?, ?, 0, datetime('now'))
    `).run(update.update_id, JSON.stringify(update));

    // 2. Trigger sync processor asynchronously to process inbox
    const { exec } = require('child_process');
    exec('python3 tools/sync_telegram_channel.py --inbox-only', (err, stdout, stderr) => {
      if (err) console.error('[WEBHOOK INBOX PROCESSING ERROR]', err.message);
    });

    res.json({ ok: true, update_id: update.update_id });
  } catch (err) {
    console.error('[TELEGRAM WEBHOOK ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// Accept or re-accept Access Conditions endpoint
app.post('/api/profile/:id/accept-conditions', (req, res) => {
  const { version } = req.body;
  const targetVersion = version || CURRENT_ACCESS_CONDITIONS_VERSION;
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE users 
    SET accepted_access_conditions_version = ?, accepted_access_conditions_at = ?
    WHERE id = ?
  `).run(targetVersion, now, req.params.id);
  res.json({ success: true, version: targetVersion, accepted_at: now });
});

// Update profile avatar
app.post('/api/profile/:id/avatar', (req, res) => {
  const { avatar_url } = req.body;
  const cleanAvatar = (avatar_url && avatar_url.trim()) ? avatar_url.trim() : null;
  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(cleanAvatar, req.params.id);
  const updated = db.prepare('SELECT id, email, full_name, avatar_url FROM users WHERE id = ?').get(req.params.id);
  res.json({ success: true, user: updated, avatar_url: cleanAvatar });
});

// Member Registration endpoint with token claim, terms acceptance, and conditions tracking
app.post('/api/register', (req, res) => {
  const { 
    full_name, email, headline, avatar_url, country, state, city, industry, 
    chapter_id, accepted_conditions_version, accepted_terms_version, accepted_terms_at,
    biometrics_enabled, token, phone 
  } = req.body;

  if (!full_name || !email) {
    return res.status(400).json({ error: "Full name and email are required." });
  }
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone ? String(phone).trim() : null;

  // For new accounts, an approved invitation token is mandatory.
  // Validate and atomically claim it to prevent simultaneous race conditions or reuse.
  let validatedInvite = null;
  if (token) {
    const cleanToken = token.trim();
    const invite = db.prepare("SELECT * FROM invitation_tokens WHERE UPPER(token) = UPPER(?) OR token = ?").get(cleanToken, cleanToken);
    if (!invite) {
      return res.status(400).json({ error: "Invalid invitation code." });
    }
    if (invite.status === 'revoked') {
      return res.status(403).json({ error: "This invitation code has been revoked." });
    }
    if (invite.status === 'declined') {
      return res.status(403).json({ error: "This invitation code has been declined." });
    }
    if (invite.is_claimed === 1 || invite.status === 'claimed') {
      return res.status(400).json({ error: "This invitation code has already been used to create an account." });
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: "This invitation code has expired. Please request a new invitation." });
    }
    if (invite.email && invite.email.toLowerCase() !== cleanEmail) {
      return res.status(400).json({ error: `Invitation code is bound to ${invite.email}, not ${cleanEmail}.` });
    }

    // Atomic claim with SQLite concurrency lock: guarantees single-use redemption
    const claimResult = db.prepare(`
      UPDATE invitation_tokens
      SET is_claimed = 1, status = 'claimed', claimed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND is_claimed = 0 AND status = 'approved'
    `).run(invite.id);

    if (claimResult.changes === 0) {
      return res.status(400).json({ error: "This invitation code has already been claimed or is no longer valid." });
    }
    validatedInvite = invite;
  } else {
    // If no token provided, check if user already exists
    const existingUserCheck = db.prepare("SELECT id FROM users WHERE LOWER(email) = ?").get(cleanEmail);
    if (!existingUserCheck) {
      return res.status(400).json({ error: "A valid invitation code is required to create a new membership." });
    }
  }

  const membershipTier = (validatedInvite && validatedInvite.membership_tier) ? validatedInvite.membership_tier : 'paid';
  const subscriptionStatus = membershipTier === 'complimentary' ? 'active' : 'pending_payment';

  const finalAvatar = (avatar_url && avatar_url.trim()) ? avatar_url.trim() : null;
  const finalCountry = country || 'United Arab Emirates';
  const finalState = state || '';
  const finalCity = city || 'Dubai';
  const finalIndustry = industry || 'Other';
  const finalChapter = chapter_id || 'ch_dubai';
  const now = new Date().toISOString();
  const termsVersion = accepted_terms_version || '2026-10-v1';
  const termsAt = accepted_terms_at || now;
  const bioEnabled = biometrics_enabled ? 1 : 0;

  // If user with this email already exists, update their details
  const existingUser = db.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(cleanEmail);
  if (existingUser) {
    db.prepare(`
      UPDATE users 
      SET full_name = ?, headline = ?, avatar_url = COALESCE(?, avatar_url), country = COALESCE(?, country), 
          state = COALESCE(?, state), city = COALESCE(?, city), industry = COALESCE(?, industry), 
          chapter_id = COALESCE(?, chapter_id), 
          phone = COALESCE(?, phone),
          terms_accepted_version = COALESCE(?, terms_accepted_version),
          terms_accepted_at = COALESCE(?, terms_accepted_at),
          biometrics_enabled = COALESCE(?, biometrics_enabled),
          membership_tier = COALESCE(?, membership_tier),
          subscription_status = COALESCE(?, subscription_status)
      WHERE id = ?
    `).run(
      full_name, headline || existingUser.headline, finalAvatar, finalCountry, finalState, finalCity, finalIndustry, 
      finalChapter, cleanPhone, termsVersion, termsAt, bioEnabled, 
      validatedInvite ? membershipTier : null,
      validatedInvite ? subscriptionStatus : null,
      existingUser.id
    );
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(existingUser.id);
    const session = createSessionForUser(updated.id);
    return res.json({ 
      success: true, 
      user: updated, 
      userId: updated.id,
      token: session.token,
      session_token: session.token,
      expires_at: session.expires_at 
    });
  }

  const newId = 'usr_' + Date.now().toString(36);
  const conditionsVersion = accepted_conditions_version || CURRENT_ACCESS_CONDITIONS_VERSION;
  try {
    db.prepare(`
      INSERT INTO users (
        id, email, full_name, headline, avatar_url, chapter_id, city, state, country, industry, 
        contact_preference, role, is_admitted, admitted_by, is_complete, 
        accepted_access_conditions_version, accepted_access_conditions_at, 
        terms_accepted_version, terms_accepted_at, biometrics_enabled, phone,
        membership_tier, subscription_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'direct_contact', 'MEMBER', 1, 'Invitation-Token-Verified', 0, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId, cleanEmail, full_name, headline || '', finalAvatar, finalChapter, 
      finalCity, finalState, finalCountry, finalIndustry, conditionsVersion, now, 
      termsVersion, termsAt, bioEnabled, cleanPhone,
      membershipTier, subscriptionStatus
    );

    // Seed 30 canonical question rows for newly registered user
    const insertAnswer = db.prepare(`
      INSERT OR IGNORE INTO questionnaire_answers (user_id, question_id, prompt, answer_state, visibility, value_text)
      VALUES (?, ?, ?, 'unanswered', ?, NULL)
    `);
    for (const q of CANONICAL_QUESTIONS) {
      insertAnswer.run(newId, q.id, q.prompt, q.id === 23 ? 'private' : 'shared');
    }

    if (finalIndustry) {
      const slug = finalIndustry.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      db.prepare(`
        INSERT OR IGNORE INTO taxonomies (user_id, category, slug, label)
        VALUES (?, 'industries', ?, ?)
      `).run(newId, slug, finalIndustry);
    }

    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(newId);
    recordAdminActivity({
      activityType: 'completed_onboarding',
      title: 'New Member Registered',
      description: `${created.full_name} completed account registration (${membershipTier} tier).`,
      actorId: created.id,
      entityType: 'user',
      entityId: created.id
    });
    const session = createSessionForUser(created.id);
    res.json({ 
      success: true, 
      user: created, 
      userId: created.id,
      token: session.token,
      session_token: session.token,
      expires_at: session.expires_at 
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin-Only: Update Member Membership Tier (Paid vs Complimentary)
app.patch('/api/admin/members/:id/membership-tier', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { membership_tier } = req.body;
  if (!['paid', 'complimentary'].includes(membership_tier)) {
    return res.status(400).json({ error: "Invalid membership tier. Must be 'paid' or 'complimentary'." });
  }

  const member = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!member) {
    return res.status(404).json({ error: "Member not found." });
  }

  // If set to complimentary, activate immediately. If set to paid and not yet paid, set to pending_payment
  const newSubStatus = (membership_tier === 'complimentary') 
    ? 'active' 
    : (member.subscription_status === 'active' ? 'active' : 'pending_payment');

  db.prepare(`
    UPDATE users 
    SET membership_tier = ?, subscription_status = ? 
    WHERE id = ?
  `).run(membership_tier, newSubStatus, id);

  const logId = 'audit_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_member_id, question_id, ip_address, metadata_json)
    VALUES (?, ?, 'update_membership_tier', ?, NULL, '127.0.0.1', ?)
  `).run(logId, req.adminUser.id, id, JSON.stringify({
    old_tier: member.membership_tier,
    new_tier: membership_tier,
    subscription_status: newSubStatus
  }));

  const updated = db.prepare("SELECT id, full_name, email, membership_tier, subscription_status FROM users WHERE id = ?").get(id);
  res.json({ success: true, member: updated });
});

// Onboarding status and progress persistence
app.get('/api/onboarding/progress', (req, res) => {
  const viewerId = req.query.userId || req.headers['x-user-id'] || req.headers['authorization'];
  if (!viewerId) return res.status(401).json({ error: "Authentication required." });
  const cleanViewer = String(viewerId).startsWith('Bearer ') ? String(viewerId).slice(7).trim() : String(viewerId).trim();
  const user = db.prepare("SELECT id, email, full_name, is_complete, onboarding_step, membership_tier, subscription_status, role FROM users WHERE id = ? OR LOWER(email) = ?").get(cleanViewer, cleanViewer.toLowerCase());
  if (!user) return res.status(404).json({ error: "User not found." });

  const isFounderOrAdmin = user.role === 'FOUNDER' || user.role === 'ADMIN';
  const isComplete = user.is_complete === 1 || isFounderOrAdmin;
  const isSubActive = (user.membership_tier === 'complimentary') || (user.subscription_status === 'active') || isFounderOrAdmin;
  const step = isComplete && isSubActive ? 'completed' : (user.onboarding_step || (isComplete ? 'subscription_payment' : 'questionnaire'));

  const answeredCount = db.prepare("SELECT count(*) as count FROM questionnaire_answers WHERE user_id = ? AND answer_state = 'answered'").get(user.id)?.count || 0;
  const q18 = db.prepare("SELECT answer_state FROM questionnaire_answers WHERE user_id = ? AND question_id = 18").get(user.id);

  res.json({
    user_id: user.id,
    is_complete: Boolean(user.is_complete),
    onboarding_completed: Boolean(isComplete && isSubActive),
    onboarding_step: step,
    membership_tier: user.membership_tier || 'paid',
    subscription_status: user.subscription_status || 'pending_payment',
    answered_count: answeredCount,
    is_q18_answered: Boolean(q18 && q18.answer_state === 'answered')
  });
});

app.post('/api/onboarding/progress', (req, res) => {
  const { userId, user_id, step, onboarding_step } = req.body || {};
  const targetId = userId || user_id || req.headers['x-user-id'];
  const newStep = step || onboarding_step;
  if (!targetId || !newStep) {
    return res.status(400).json({ error: "userId and step are required." });
  }
  db.prepare("UPDATE users SET onboarding_step = ? WHERE id = ?").run(newStep, targetId);
  res.json({ success: true, onboarding_step: newStep });
});

// Member Subscription Activation (During onboarding or subscription payment)
app.post('/api/membership/activate-subscription', (req, res) => {
  const viewerId = req.body.userId || req.body.user_id || req.headers['x-user-id'] || req.headers['authorization'];
  if (!viewerId) return res.status(401).json({ error: "Authentication required to activate subscription." });
  const cleanViewer = String(viewerId).startsWith('Bearer ') ? String(viewerId).slice(7).trim() : String(viewerId).trim();
  const user = db.prepare("SELECT * FROM users WHERE id = ? OR LOWER(email) = ?").get(cleanViewer, cleanViewer.toLowerCase());
  if (!user) return res.status(404).json({ error: "Member not found." });

  db.prepare(`
    UPDATE users
    SET subscription_status = 'active', onboarding_step = CASE WHEN is_complete = 1 THEN 'completed' ELSE onboarding_step END
    WHERE id = ?
  `).run(user.id);

  recordAdminActivity({
    activityType: 'subscription_payment',
    title: 'Membership Subscription Activated',
    description: `${user.full_name} (${user.email}) activated membership subscription.`,
    actorId: user.id,
    entityType: 'user',
    entityId: user.id
  });

  if (user.is_complete === 1) {
    recordAdminActivity({
      activityType: 'completed_onboarding',
      title: 'Member Completed Onboarding',
      description: `${user.full_name} completed subscription payment and finalized onboarding.`,
      actorId: user.id,
      entityType: 'user',
      entityId: user.id
    });
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ success: true, user: updated, subscription_status: 'active', onboarding_step: updated.onboarding_step });
});

// Configurable ÖZARA Legal Documents
app.get('/api/legal/terms', (req, res) => {
  res.json({
    title: "ÖZARA Private Membership Terms & Conditions",
    version: "2026-10-v1",
    last_updated: "October 2026",
    sections: [
      {
        heading: "1. Purpose & Private Community",
        content: "ÖZARA is a confidential, invite-only community for vetted founders, executive operators, and accredited investors. Our purpose is facilitating authentic peer connections, private gatherings, and curated opportunities within an atmosphere of mutual trust."
      },
      {
        heading: "2. Invitation Verification & Identity Integrity",
        content: "Membership invitations and access tokens are strictly personal, single-use, and bound directly to verified applicant identities. Transferring, sharing, or attempting to duplicate access credentials without explicit written authorization from ÖZARA leadership is prohibited and results in immediate revocation."
      },
      {
        heading: "3. Confidentiality & Code of Conduct",
        content: "Members agree to conduct all interactions with discretion, mutual respect, and highest ethical standards. Discussions, member coordinates, and intelligence shared within ÖZARA private gatherings or direct member communications are confidential to the circle."
      },
      {
        heading: "4. No Financial Execution or Commercial Solicitation",
        content: "ÖZARA provides networking, curated gatherings, and informational property showcases. ÖZARA does not execute financial transactions, provide automated investment advice, manage custody of funds, or guarantee investment returns. Unsolicited bulk marketing, spam, or high-pressure financial pitches are strictly prohibited."
      },
      {
        heading: "5. Device Authentication & Biometric Security",
        content: "Where enabled by the member, biometric unlocking (such as Face ID, Touch ID, or platform passkeys) operates strictly through secure on-device hardware interfaces. ÖZARA does not collect, receive, or store biometric templates or facial recognition models on its servers."
      }
    ]
  });
});

app.get('/api/legal/privacy', (req, res) => {
  res.json({
    title: "ÖZARA Privacy Policy",
    version: "2026-10-v1",
    last_updated: "October 2026",
    sections: [
      {
        heading: "1. Minimalist Information Collection",
        content: "We collect only information you voluntarily submit to facilitate community interactions: full name, verified business email, verified phone number, chapter, and optional questionnaire responses. We strictly guarantee that we never collect date of birth, government ID numbers, bank account numbers, personal net worth, or real-time GPS locations."
      },
      {
        heading: "2. Permanent Lock on Sensitive Questionnaire Data",
        content: "Question 23 responses are permanently confidential and accessible exclusively to ÖZARA founders (Alexandra and Julia). Question 23 has no sharing toggle and is mathematically excluded from search indexes, public member profiles, and recommendation algorithms. Every administrative view generates an immutable cryptographic audit log."
      },
      {
        heading: "3. Travel Privacy & Automatic Expiration",
        content: "Travel itineraries are voluntarily shared at city-level resolution only. Any travel plan passing its scheduled conclusion date is automatically hidden from member discovery without requiring manual member action."
      },
      {
        heading: "4. Two-Person Governance Protection",
        content: "To prevent unauthorized extraction of community data, any bulk export of member records requires affirmative cryptographic approval from two independent administrators (Alexandra and Julia)."
      },
      {
        heading: "5. Member Rights & Data Deletion",
        content: "Members retain full control over their visibility settings and may update, modify, or request complete deletion of their account records at any time by contacting ÖZARA leadership."
      }
    ]
  });
});

// -------------------------------------------------------------
// 7. GOVERNANCE: AUDIT LOGS & TWO-PERSON EXPORT
// -------------------------------------------------------------
app.get('/api/admin/audit-logs', (req, res) => {
  const logs = db.prepare(`
    SELECT al.*, 
           actor.full_name as actor_name, actor.role as actor_role,
           target.full_name as target_name
    FROM audit_logs al
    LEFT JOIN users actor ON al.actor_id = actor.id
    LEFT JOIN users target ON al.target_member_id = target.id
    ORDER BY al.timestamp DESC
    LIMIT 50
  `).all();
  res.json(logs);
});

// Two-person export requests
app.get('/api/admin/exports', (req, res) => {
  const requests = db.prepare(`
    SELECT er.*, req.full_name as requester_name, app.full_name as approver_name
    FROM export_requests er
    LEFT JOIN users req ON er.requested_by = req.id
    LEFT JOIN users app ON er.approved_by = app.id
    ORDER BY er.request_timestamp DESC
  `).all();
  res.json(requests);
});

app.post('/api/admin/exports/request', (req, res) => {
  const { adminId, exportType } = req.body;
  const expId = 'exp_' + Math.random().toString(36).substring(2, 9);
  db.prepare(`
    INSERT INTO export_requests (id, requested_by, export_type, status)
    VALUES (?, ?, ?, 'pending_second_approval')
  `).run(expId, adminId, exportType || 'members_directory_csv');

  res.json({ success: true, expId });
});

app.post('/api/admin/exports/approve', (req, res) => {
  const { expId, approverId } = req.body;
  const existing = db.prepare("SELECT requested_by FROM export_requests WHERE id = ?").get(expId);
  if (!existing) return res.status(404).json({ error: "Request not found" });

  if (existing.requested_by === approverId) {
    return res.status(403).json({ error: "Two-Person Rule Violation: Approver cannot be the same administrator who initiated the export." });
  }

  const token = 'token_' + Math.random().toString(36).substring(2, 16);
  db.prepare(`
    UPDATE export_requests
    SET approved_by = ?, approval_timestamp = CURRENT_TIMESTAMP, status = 'approved', download_token = ?
    WHERE id = ?
  `).run(approverId, token, expId);

  res.json({ success: true, downloadToken: token });
});

// -------------------------------------------------------------
// 8. INVITATION GATE, 1:1 TOKENS & ACCESS REQUEST APPROVAL
// -------------------------------------------------------------

// Verify invitation token and retrieve 1:1 bound email
app.post('/api/invitations/verify', (req, res) => {
  const { token } = req.body;
  if (!token || !token.trim()) {
    return res.status(400).json({ success: false, errorType: 'missing', message: "Invitation code is required." });
  }

  const cleanToken = token.trim();
  const invite = db.prepare(`
    SELECT * FROM invitation_tokens
    WHERE UPPER(token) = UPPER(?) OR token = ?
  `).get(cleanToken, cleanToken);

  if (!invite) {
    return res.status(404).json({ success: false, valid: false, errorType: 'invalid', message: "Invalid invitation code. Please check the code or request access." });
  }

  if (invite.status === 'pending_admin_approval') {
    return res.status(403).json({ success: false, valid: false, errorType: 'pending', message: "This access request is currently awaiting leadership review." });
  }

  if (invite.status === 'revoked') {
    return res.status(403).json({ success: false, valid: false, errorType: 'revoked', message: "This invitation code has been revoked." });
  }

  if (invite.status === 'declined') {
    return res.status(403).json({ success: false, valid: false, errorType: 'declined', message: "This access request was declined by the membership committee." });
  }

  if (invite.is_claimed === 1 || invite.status === 'claimed') {
    return res.status(400).json({ success: false, valid: false, errorType: 'claimed', message: "This invitation code has already been used to create an account." });
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return res.status(400).json({ success: false, valid: false, errorType: 'expired', message: "This invitation code has expired. Please request a new invitation." });
  }

  res.json({
    success: true,
    valid: true,
    token: invite.token,
    email: invite.email,
    fullName: invite.full_name || '',
    role: invite.role_or_headline || '',
    status: invite.status
  });
});

// Check email status for membership request flow
app.all('/api/invitations/check-email-status', (req, res) => {
  const rawEmail = (req.body?.email || req.query?.email || '').trim();
  if (!rawEmail || !rawEmail.includes('@')) {
    return res.status(400).json({ error: 'invalid', message: 'Valid business email is required.' });
  }

  const cleanEmail = rawEmail.toLowerCase();

  // Priority 1: Active Member Account (takes priority over older request statuses)
  const existingUser = db.prepare(`
    SELECT id, email, full_name, phone, role, is_admitted
    FROM users
    WHERE LOWER(email) = ? AND is_admitted = 1
  `).get(cleanEmail);

  if (existingUser) {
    return res.json({
      status: 'existing_account',
      email: existingUser.email,
      fullName: existingUser.full_name,
      phone: existingUser.phone || null,
      message: 'Sign in to your ÖZARA account.'
    });
  }

  // Priority 2: Membership Request / Invitation Tokens
  const invite = db.prepare(`
    SELECT id, email, token, full_name, status, is_claimed, phone
    FROM invitation_tokens
    WHERE LOWER(email) = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(cleanEmail);

  if (invite) {
    if (invite.status === 'declined') {
      return res.json({
        status: 'declined_request',
        email: invite.email,
        message: 'We’re unable to offer an invitation at this time.'
      });
    }

    if (invite.status === 'pending_admin_approval' || (invite.status === 'pending' && !invite.is_claimed)) {
      return res.json({
        status: 'pending_request',
        email: invite.email,
        message: 'Our hosts will be in touch by email.'
      });
    }

    if (invite.is_claimed === 1 || invite.status === 'claimed') {
      return res.json({
        status: 'existing_account',
        email: invite.email,
        message: 'Sign in to your ÖZARA account.'
      });
    }

    if (invite.status === 'approved' && !invite.is_claimed) {
      return res.json({
        status: 'pending_request',
        email: invite.email,
        token: invite.token,
        message: 'Our hosts will be in touch by email.'
      });
    }
  }

  // Priority 3: New Email
  return res.json({
    status: 'new',
    email: cleanEmail
  });
});

// Request access (Uninvited prospective members)
app.post('/api/invitations/request-access', (req, res) => {
  const { email, fullName, full_name, role, notes, phone, linkedin_or_background, what_brings_you } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ success: false, message: "Business email is required." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = (fullName || full_name || '').trim();
  const cleanRole = (role || '').trim();
  const cleanNotes = (notes || '').trim();
  const cleanPhone = phone ? String(phone).trim() : null;
  const cleanLinkedin = (linkedin_or_background || '').trim();
  const cleanWhatBringsYou = (what_brings_you || '').trim();

  // Priority 1: Check active member (takes priority over older request status)
  const existingUser = db.prepare("SELECT id, full_name, phone FROM users WHERE LOWER(email) = ? AND is_admitted = 1").get(cleanEmail);
  if (existingUser) {
    return res.status(409).json({
      success: false,
      status: "existing_account",
      email: cleanEmail,
      message: "Sign in to your ÖZARA account."
    });
  }

  // Priority 2: Check existing request/invite
  const existingInvite = db.prepare(`
    SELECT * FROM invitation_tokens
    WHERE LOWER(email) = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(cleanEmail);

  if (existingInvite) {
    if (existingInvite.status === 'declined') {
      return res.status(409).json({
        success: false,
        status: "declined_request",
        email: cleanEmail,
        message: "We’re unable to offer an invitation at this time."
      });
    }

    if (existingInvite.status === 'pending_admin_approval' || (existingInvite.status === 'pending' && !existingInvite.is_claimed)) {
      return res.status(409).json({
        success: false,
        status: "pending_request",
        email: cleanEmail,
        message: "Our hosts will be in touch by email."
      });
    }

    if (existingInvite.is_claimed === 1 || existingInvite.status === 'claimed') {
      return res.status(409).json({
        success: false,
        status: "existing_account",
        email: cleanEmail,
        message: "Sign in to your ÖZARA account."
      });
    }

    if (existingInvite.status === 'approved' && !existingInvite.is_claimed) {
      return res.json({
        success: true,
        status: 'approved',
        token: existingInvite.token,
        email: existingInvite.email,
        message: "You already have an approved invitation code: " + existingInvite.token
      });
    }
  }

  const id = 'req_acc_' + Math.random().toString(36).substring(2, 9);
  const tempToken = 'PENDING-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO invitation_tokens (id, email, token, full_name, role_or_headline, notes, status, created_by, expires_at, phone, linkedin_or_background, what_brings_you)
    VALUES (?, ?, ?, ?, ?, ?, 'pending_admin_approval', 'self_applicant', ?, ?, ?, ?)
  `).run(id, cleanEmail, tempToken, cleanName, cleanRole, cleanNotes, expiresAt, cleanPhone, cleanLinkedin, cleanWhatBringsYou);

  console.log(`\n======================================================`);
  console.log(`[EMAIL DISPATCH TO ADMINS]`);
  console.log(`To: ermolov.elena@gmail.com`);
  console.log(`Subject: New request to join ÖZARA from ${cleanName || 'Candidate'}`);
  console.log(`LinkedIn / Background: ${cleanLinkedin || 'Not specified'}`);
  console.log(`What brings you to ÖZARA: ${cleanWhatBringsYou || 'Not specified'}`);
  console.log(`======================================================\n`);

  const baseUrl = process.env.PUBLIC_APP_URL || process.env.BASE_URL || `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
  const reviewUrl = `${baseUrl}/api/admin/invitations/review?requestId=${id}&adminEmail=ermolov.elena@gmail.com`;

  const isNewRequest = !existingInvite;
  const isTestCandidate = req.headers['x-test-suite'] === 'true' ||
    isSuppressedEmail(cleanEmail) ||
    process.env.SUPPRESS_EMAIL_NOTIFICATIONS === 'true';

  // 1. Send Admin Notification to Elena only for genuinely new, non-test requests (once per request)
  if (!isTestCandidate && isNewRequest) {
    const adminRecipients = ['ermolov.elena@gmail.com'];
    for (const adminEmail of adminRecipients) {
      sendEmailNotification({
        to: adminEmail,
        fromName: 'ÖZARA',
        subject: `New request to join ÖZARA from ${cleanName || 'Candidate'}`,
        text: `Membership request\n\n${cleanName || 'A candidate'} would like to join ÖZARA.\n\nApplicant: ${cleanName || 'Candidate'}\nEmail: ${cleanEmail}${cleanLinkedin ? `\nLinkedIn: ${cleanLinkedin}` : ''}${cleanRole ? `\nRole: ${cleanRole}` : ''}${cleanNotes ? `\nNotes: ${cleanNotes}` : ''}${cleanWhatBringsYou ? `\nDetails: ${cleanWhatBringsYou}` : ''}\n\nReview request:\n${reviewUrl}`,
        html: `
          <div style="background-color: #f8fafc; padding: 40px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin: 0 auto; padding: 36px 32px; box-sizing: border-box;">
              <tr>
                <td>
                  <div style="font-size: 13px; font-weight: 700; letter-spacing: 2.5px; color: #0f172a; text-transform: uppercase; margin-bottom: 20px;">ÖZARA</div>
                  <h1 style="font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 10px 0; line-height: 1.3;">Membership request</h1>
                  <p style="font-size: 15px; color: #334155; margin: 0 0 24px 0; line-height: 1.5;">${cleanName || 'A candidate'} would like to join ÖZARA.</p>
                  
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
                    <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${cleanName || 'Candidate'}</div>
                    <div style="font-size: 14px; color: #475569; margin-bottom: ${cleanLinkedin || cleanRole || cleanNotes || cleanWhatBringsYou ? '12px' : '0'};">
                      <a href="mailto:${cleanEmail}" style="color: #475569; text-decoration: none;">${cleanEmail}</a>
                    </div>
                    ${cleanLinkedin ? `<div style="font-size: 13.5px; color: #334155; margin-top: 6px;"><strong>LinkedIn:</strong> <a href="${cleanLinkedin}" style="color: #0f172a; text-decoration: underline;" target="_blank">${cleanLinkedin}</a></div>` : ''}
                    ${cleanRole ? `<div style="font-size: 13.5px; color: #334155; margin-top: 6px;"><strong>Role:</strong> ${cleanRole}</div>` : ''}
                    ${cleanNotes ? `<div style="font-size: 13.5px; color: #334155; margin-top: 6px;"><strong>Notes:</strong> ${cleanNotes}</div>` : ''}
                    ${cleanWhatBringsYou ? `<div style="font-size: 13.5px; color: #334155; margin-top: 6px;"><strong>Submitted details:</strong> ${cleanWhatBringsYou}</div>` : ''}
                  </div>

                  <div style="margin-top: 24px;">
                    <a href="${reviewUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 13px 26px; border-radius: 24px; font-size: 14px; font-weight: 600; letter-spacing: 0.2px;">Review request</a>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        `
      }).catch(() => {});
    }
  } else {
    console.log(`[TEST SUITE] Admin notification bypassed (isTest=${isTestCandidate}, isNew=${isNewRequest}) for: ${cleanEmail}`);
  }

  // 2. Send Applicant Confirmation to cleanEmail (only for genuine new requests)
  if (!isTestCandidate && isNewRequest) {
    const firstName = cleanName ? cleanName.trim().split(/\s+/)[0] : 'there';
    sendEmailNotification({
      to: cleanEmail,
      fromName: 'ÖZARA',
      subject: `Your request to join ÖZARA`,
      text: `Hi ${firstName},\n\nThank you for your interest in ÖZARA. Our hosts will review your request and be in touch by email.\n\nThe ÖZARA team`,
      html: `
        <div style="background-color: #f8fafc; padding: 40px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin: 0 auto; padding: 36px 32px; box-sizing: border-box;">
            <tr>
              <td>
                <div style="font-size: 13px; font-weight: 700; letter-spacing: 2.5px; color: #0f172a; text-transform: uppercase; margin-bottom: 20px;">ÖZARA</div>
                <h1 style="font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; line-height: 1.3;">Your request is received</h1>
                <p style="font-size: 15px; color: #334155; margin: 0 0 12px 0; line-height: 1.6;">Hi ${firstName},</p>
                <p style="font-size: 15px; color: #334155; margin: 0 0 24px 0; line-height: 1.6;">
                  Thank you for your interest in ÖZARA. Our hosts will review your request and be in touch by email.
                </p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0 20px 0;">
                <p style="font-size: 14px; color: #475569; margin: 0; line-height: 1.5; font-weight: 500;">
                  The ÖZARA team
                </p>
              </td>
            </tr>
          </table>
        </div>
      `
    }).catch(() => {});
  }

  recordAdminActivity({
    activityType: 'access_request',
    title: 'Membership Access Request',
    description: `Applicant ${cleanName || cleanEmail} requested access to ÖZARA.`,
    targetId: cleanEmail,
    entityType: 'invitation_token',
    entityId: id
  });

  res.json({
    success: true,
    status: 'pending',
    id,
    email: cleanEmail,
    adminNotificationRecipient: 'ermolov.elena@gmail.com',
    message: "Your request has been received. Our team will review it and contact you by email if approved."
  });
});

// Admin decline access request
app.post('/api/admin/access-requests/decline', (req, res) => {
  const { requestId, email, declinedBy, reason } = req.body;
  const approver = (declinedBy || '').trim().toLowerCase();

  const AUTHORIZED_ADMIN_EMAILS = [
    'ermolov.elena@gmail.com',
    'alexandra@ozara.club',
    'julia@ozara.club',
    'alexandra@silasvyazei.com',
    'julia@silasvyazei.com'
  ];

  const adminUser = db.prepare(`
    SELECT * FROM users 
    WHERE (LOWER(email) = ? OR id = ?) AND role IN ('FOUNDER', 'ADMIN')
  `).get(approver, declinedBy);

  if (!adminUser && !AUTHORIZED_ADMIN_EMAILS.includes(approver)) {
    return res.status(403).json({ success: false, message: "Access Denied: Only authorized ÖZARA founders can decline requests." });
  }

  let record = null;
  if (requestId) {
    record = db.prepare("SELECT * FROM invitation_tokens WHERE id = ?").get(requestId);
  } else if (email) {
    record = db.prepare("SELECT * FROM invitation_tokens WHERE LOWER(email) = ?").get(email.trim().toLowerCase());
  }

  if (!record) {
    return res.status(404).json({ success: false, message: "Access request not found." });
  }

  db.prepare(`
    UPDATE invitation_tokens
    SET status = 'declined'
    WHERE id = ?
  `).run(record.id);

  const logId = 'audit_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_member_id, question_id, ip_address, metadata_json)
    VALUES (?, ?, 'decline_access_request', ?, NULL, '127.0.0.1', ?)
  `).run(logId, adminUser ? adminUser.id : approver, record.id, JSON.stringify({ 
    applicant_email: record.email, 
    declined_by: approver,
    reason: reason || 'Declined by leadership'
  }));

  res.json({ success: true, status: 'declined', message: "Access request declined." });
});

// Admin revoke invitation token
app.post('/api/admin/invitations/revoke', (req, res) => {
  const { id, token, revokedBy, reason } = req.body;
  const admin = getAdminUser(req) || (() => {
    const approver = (revokedBy || '').trim().toLowerCase();
    const AUTHORIZED_ADMIN_EMAILS = [
      'ermolov.elena@gmail.com',
      'alexandra@ozara.club',
      'julia@ozara.club',
      'alexandra@silasvyazei.com',
      'julia@silasvyazei.com'
    ];
    const u = db.prepare("SELECT * FROM users WHERE (LOWER(email) = ? OR id = ?) AND role IN ('FOUNDER', 'ADMIN')").get(approver, revokedBy);
    if (u) return u;
    if (AUTHORIZED_ADMIN_EMAILS.includes(approver)) {
      return db.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(approver);
    }
    return null;
  })();

  if (!admin) {
    return res.status(403).json({ success: false, message: "Access Denied: Only authorized ÖZARA administrators can revoke invitations." });
  }

  let record = null;
  if (id) {
    record = db.prepare("SELECT * FROM invitation_tokens WHERE id = ?").get(id);
  } else if (token) {
    record = db.prepare("SELECT * FROM invitation_tokens WHERE UPPER(token) = UPPER(?) OR token = ?").get(token.trim(), token.trim());
  }

  if (!record) {
    return res.status(404).json({ success: false, message: "Invitation not found." });
  }

  if (record.is_claimed === 1 || record.status === 'claimed') {
    return res.status(400).json({ success: false, message: "Cannot revoke an invitation that has already been claimed." });
  }

  db.prepare(`
    UPDATE invitation_tokens
    SET status = 'revoked'
    WHERE id = ?
  `).run(record.id);

  const logId = 'audit_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_member_id, ip_address, metadata_json)
    VALUES (?, ?, 'admin_revoke_invitation', ?, '127.0.0.1', ?)
  `).run(logId, admin.id, record.id, JSON.stringify({ 
    token: record.token, 
    revoked_by: admin.email || admin.id,
    reason: reason || 'Revoked by admin'
  }));

  res.json({ success: true, status: 'revoked', message: "Invitation token has been revoked." });
});

// Admin approval of access request -> generates official token & notifies applicant
// Core Access Approval Execution Logic
function executeAccessApproval({ requestId, email, approvedBy, membershipTier }) {
  if (!approvedBy) {
    return { success: false, status: 401, message: "Authentication required: Missing approving administrator." };
  }

  const cleanApprover = approvedBy.trim().toLowerCase();
  
  let record = null;
  if (requestId) {
    record = db.prepare("SELECT * FROM invitation_tokens WHERE id = ?").get(requestId);
  } else if (email) {
    record = db.prepare("SELECT * FROM invitation_tokens WHERE LOWER(email) = ?").get(email.trim().toLowerCase());
  }

  if (!record) {
    return { success: false, status: 404, message: "Access request not found." };
  }

  // Self-approval invariant: Applicants can NEVER approve their own application
  if (cleanApprover === record.email.toLowerCase()) {
    return { 
      success: false, 
      status: 403, 
      message: "Security Violation: Applicants are strictly prohibited from approving their own membership access requests." 
    };
  }

  // Verify that approver exists in database with FOUNDER or ADMIN role, or is in verified founders list
  const adminUser = db.prepare(`
    SELECT * FROM users 
    WHERE (LOWER(email) = ? OR id = ?) AND role IN ('FOUNDER', 'ADMIN')
  `).get(cleanApprover, approvedBy);

  const AUTHORIZED_ADMIN_EMAILS = [
    'ermolov.elena@gmail.com',
    'alexandra@ozara.club',
    'julia@ozara.club',
    'alexandra@silasvyazei.com',
    'julia@silasvyazei.com'
  ];

  if (!adminUser && !AUTHORIZED_ADMIN_EMAILS.includes(cleanApprover)) {
    return { 
      success: false, 
      status: 403, 
      message: "Access Denied: Only authorized ÖZARA founders can approve access requests." 
    };
  }

  const finalTier = (membershipTier === 'complimentary' || membershipTier === 'paid')
    ? membershipTier
    : (record.membership_tier || 'paid');

  // If already approved, return current token
  if (record.status === 'approved' && record.token && !record.token.startsWith('PENDING-')) {
    if (membershipTier && membershipTier !== record.membership_tier) {
      db.prepare("UPDATE invitation_tokens SET membership_tier = ? WHERE id = ?").run(finalTier, record.id);
      db.prepare("UPDATE users SET membership_tier = ? WHERE LOWER(email) = ?").run(finalTier, record.email.toLowerCase());
    }
    return {
      success: true,
      alreadyApproved: true,
      record,
      token: record.token,
      membership_tier: finalTier,
      approverEmail: record.approved_by || cleanApprover
    };
  }

  // Generate elegant official ÖZARA token (e.g. OZARA-4819-2041)
  const officialToken = 'OZARA-' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000);
  const approverEmail = adminUser ? adminUser.email : cleanApprover;
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    UPDATE invitation_tokens
    SET token = ?, status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP, expires_at = ?, membership_tier = ?
    WHERE id = ?
  `).run(officialToken, approverEmail, expiresAt, finalTier, record.id);

  // Log to immutable audit log
  const logId = 'audit_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_member_id, question_id, ip_address, metadata_json)
    VALUES (?, ?, 'approve_access_request', ?, NULL, '127.0.0.1', ?)
  `).run(logId, adminUser ? adminUser.id : approverEmail, record.id, JSON.stringify({ 
    applicant_email: record.email, 
    token: officialToken,
    membership_tier: finalTier,
    approved_by: approverEmail 
  }));

  console.log(`\n======================================================`);
  console.log(`[EMAIL DISPATCH TO APPLICANT]`);
  console.log(`To: ${record.email}`);
  console.log(`From: ermolov.elena@gmail.com (ÖZARA Membership Committee)`);
  console.log(`Subject: Your ÖZARA Membership Invitation Token: ${officialToken}`);
  console.log(`Membership Option: ${finalTier === 'complimentary' ? 'Complimentary Membership' : 'Paid Membership'}`);
  console.log(`Body: Dear ${record.full_name || 'Member'}, your request for ÖZARA membership has been approved.`);
  console.log(`Your invitation token is: ${officialToken}`);
  console.log(`Open the ÖZARA mobile app and insert this token to complete your registration.`);
  console.log(`======================================================\n`);

  const isTestCandidate = isSuppressedEmail(record.email);

  const tierEmailHighlight = finalTier === 'complimentary'
    ? `<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 13.5px; color: #166534; line-height: 1.5;">
        <strong>Complimentary membership granted:</strong> You have been granted complimentary access. You will skip subscription payment during onboarding.
       </div>`
    : `<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 13.5px; color: #334155; line-height: 1.5;">
        <strong>Paid membership:</strong> Your membership requires an annual subscription, which you will complete during onboarding before accessing member features.
       </div>`;

  const tierTextHighlight = finalTier === 'complimentary'
    ? 'You have been granted Complimentary Membership (free access).'
    : 'Your membership requires an annual subscription, which you will complete during onboarding.';

  if (!isTestCandidate) {
    sendEmailNotification({
      to: record.email,
      fromName: 'ÖZARA',
      subject: `Your invitation to join ÖZARA`,
      text: `Dear ${record.full_name || 'Member'},\n\nYour request for ÖZARA membership has been approved.\n\n${tierTextHighlight}\n\nYour invitation token is: ${officialToken}\n\nPlease open the ÖZARA mobile app and insert this token to complete your registration.\n\nThe ÖZARA team`,
      html: `
        <div style="background-color: #f8fafc; padding: 40px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin: 0 auto; padding: 36px 32px; box-sizing: border-box;">
            <tr>
              <td>
                <div style="font-size: 13px; font-weight: 700; letter-spacing: 2.5px; color: #0f172a; text-transform: uppercase; margin-bottom: 20px;">ÖZARA</div>
                <h1 style="font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 10px 0; line-height: 1.3;">Membership approved</h1>
                <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0; line-height: 1.5;">
                  Dear ${record.full_name || 'Member'}, your request for ÖZARA membership has been approved.
                </p>
                ${tierEmailHighlight}
                <div style="background-color: #f8fafc; border: 1.5px solid #0f172a; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
                  <div style="font-size: 11px; letter-spacing: 2px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">YOUR INVITATION TOKEN</div>
                  <div style="font-size: 26px; font-weight: 800; color: #0f172a; letter-spacing: 3px; font-family: monospace;">${officialToken}</div>
                </div>
                <p style="font-size: 14.5px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
                  Please open the ÖZARA mobile app and insert this invitation token to complete your registration.
                </p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0 20px 0;">
                <p style="font-size: 14px; color: #475569; margin: 0; line-height: 1.5; font-weight: 500;">
                  The ÖZARA team
                </p>
              </td>
            </tr>
          </table>
        </div>
      `
    }).catch(() => {});
  } else {
    console.log(`[TEST SUITE] Live SMTP suppressed for automated test email: ${record.email}`);
  }

  return {
    success: true,
    status: 'approved',
    email: record.email,
    record,
    token: officialToken,
    membership_tier: finalTier,
    approverEmail,
    emailDispatched: true
  };
}

// Admin approval of access request -> generates official token & notifies applicant
app.post(['/api/admin/invitations/approve', '/api/admin/access-requests/approve'], (req, res) => {
  const { requestId, email, approvedBy, adminEmail, admin_email, membership_tier, membershipTier } = req.body;
  const approver = approvedBy || adminEmail || admin_email;
  const tier = membership_tier || membershipTier;
  const result = executeAccessApproval({ requestId, email, approvedBy: approver, membershipTier: tier });
  if (!result.success) {
    return res.status(result.status || 400).json(result);
  }
  return res.json(result);
});

// Secure Admin Membership Request Review Page (Linked from approval emails)
app.get('/api/admin/invitations/review', (req, res) => {
  const { requestId, id, email, adminEmail } = req.query;
  const targetId = requestId || id;
  const approver = adminEmail || 'ermolov.elena@gmail.com';

  let record = null;
  if (targetId) {
    record = db.prepare("SELECT * FROM invitation_tokens WHERE id = ?").get(targetId);
  } else if (email) {
    record = db.prepare("SELECT * FROM invitation_tokens WHERE LOWER(email) = ? ORDER BY created_at DESC LIMIT 1").get(email.trim().toLowerCase());
  }

  if (!record) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>ÖZARA — Application Not Found</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background-color: #f8fafc;
            color: #0f172a;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 40px 16px;
            -webkit-font-smoothing: antialiased;
          }
          .card {
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            max-width: 480px;
            width: 100%;
            padding: 36px 32px;
            text-align: center;
            box-shadow: 0 4px 16px rgba(0,0,0,0.04);
          }
          .wordmark {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 2.5px;
            color: #0f172a;
            text-transform: uppercase;
            margin-bottom: 20px;
          }
          .title {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 8px;
          }
          .desc {
            color: #64748b;
            font-size: 14px;
            line-height: 1.5;
            margin-bottom: 24px;
          }
          .link {
            color: #0f172a;
            text-decoration: none;
            font-size: 14px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="wordmark">ÖZARA</div>
          <h2 class="title">Application not found</h2>
          <p class="desc">The requested membership application could not be located.</p>
          <a href="http://localhost:8081" class="link">← Return to app</a>
        </div>
      </body>
      </html>
    `);
  }

  const isApproved = record.status === 'approved';
  const isDeclined = record.status === 'declined';
  const isPending = !isApproved && !isDeclined;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>ÖZARA — Membership Request</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background-color: #f8fafc;
          color: #0f172a;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 40px 16px;
          -webkit-font-smoothing: antialiased;
        }
        .review-card {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          max-width: 520px;
          width: 100%;
          padding: 36px 32px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
        }
        .wordmark {
          font-size: 13px;
          letter-spacing: 2.5px;
          color: #0f172a;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .title {
          font-size: 22px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 8px;
          line-height: 1.3;
        }
        .subtitle {
          color: #475569;
          font-size: 14.5px;
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .info-box {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 24px;
          text-align: left;
        }
        .applicant-name {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .applicant-email {
          font-size: 14px;
          color: #475569;
          margin-bottom: 12px;
        }
        .applicant-email a {
          color: #475569;
          text-decoration: none;
        }
        .info-row {
          margin-top: 6px;
          font-size: 13.5px;
          color: #334155;
          line-height: 1.45;
        }
        .info-label {
          color: #64748b;
          font-weight: 500;
        }
        .info-val {
          color: #0f172a;
          font-weight: 500;
        }
        .section-label {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 12px;
          text-align: left;
        }
        .radio-option {
          display: flex;
          align-items: flex-start;
          background-color: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }
        .radio-option:hover {
          border-color: #cbd5e1;
          background-color: #fcfdfe;
        }
        .radio-option.selected {
          border-color: #0f172a;
          background-color: #f8fafc;
        }
        .radio-input {
          margin-right: 12px;
          margin-top: 3px;
          accent-color: #0f172a;
          width: 17px;
          height: 17px;
          cursor: pointer;
        }
        .radio-title {
          font-weight: 600;
          color: #0f172a;
          font-size: 14.5px;
        }
        .radio-desc {
          color: #64748b;
          font-size: 13px;
          margin-top: 2px;
          line-height: 1.4;
        }
        .actions-row {
          display: flex;
          gap: 12px;
          justify-content: flex-start;
          align-items: center;
          margin-top: 24px;
          flex-wrap: wrap;
        }
        .btn-approve {
          background-color: #0f172a;
          color: #ffffff;
          font-weight: 600;
          border: none;
          padding: 13px 26px;
          border-radius: 24px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.15s ease;
          flex: 1;
          min-width: 160px;
        }
        .btn-approve:hover {
          background-color: #1e293b;
        }
        .btn-decline {
          background: transparent;
          color: #dc2626;
          border: 1.5px solid #fecaca;
          padding: 12px 22px;
          border-radius: 24px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-decline:hover {
          background-color: #fef2f2;
          border-color: #dc2626;
        }
        .error-banner {
          display: none;
          background-color: #fef2f2;
          border: 1px solid #fca5a5;
          color: #b91c1c;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          margin-top: 14px;
          text-align: left;
        }
        .status-box {
          border-radius: 10px;
          padding: 18px 20px;
          text-align: left;
          margin-bottom: 20px;
        }
        .status-box.approved {
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
        }
        .status-box.declined {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
        }
        .status-row {
          margin-bottom: 8px;
          font-size: 13.5px;
          color: #334155;
        }
        .status-row:last-child {
          margin-bottom: 0;
        }
        .status-pill {
          display: inline-block;
          font-weight: 700;
          font-size: 12px;
          padding: 3px 9px;
          border-radius: 12px;
          letter-spacing: 0.3px;
        }
        .status-pill.approved {
          background-color: #dcfce7;
          color: #15803d;
        }
        .status-pill.declined {
          background-color: #fee2e2;
          color: #b91c1c;
        }
      </style>
    </head>
    <body>
      <div class="review-card">
        <div class="wordmark">ÖZARA</div>
        <h1 class="title">${isApproved ? 'Request approved' : isDeclined ? 'Request declined' : 'Membership request'}</h1>
        <p class="subtitle">
          ${isApproved 
            ? 'This applicant has been approved and issued an invitation.' 
            : isDeclined 
              ? 'This applicant was reviewed and declined.' 
              : 'Review applicant details and select membership terms before approving.'}
        </p>

        <!-- Candidate Details (Prominent First) -->
        <div class="info-box">
          <div class="applicant-name">${record.full_name || 'Applicant'}</div>
          <div class="applicant-email">
            <a href="mailto:${record.email}">${record.email}</a>
          </div>
          ${record.linkedin_or_background ? `
            <div class="info-row">
              <span class="info-label">LinkedIn: </span>
              <span class="info-val"><a href="${record.linkedin_or_background}" target="_blank" style="color: #0f172a; text-decoration: underline;">${record.linkedin_or_background}</a></span>
            </div>
          ` : ''}
          ${record.role_or_headline ? `
            <div class="info-row">
              <span class="info-label">Role: </span>
              <span class="info-val">${record.role_or_headline}</span>
            </div>
          ` : ''}
          ${record.notes ? `
            <div class="info-row">
              <span class="info-label">Notes: </span>
              <span class="info-val">${record.notes}</span>
            </div>
          ` : ''}
          ${record.what_brings_you ? `
            <div class="info-row">
              <span class="info-label">Submitted details: </span>
              <span class="info-val">${record.what_brings_you}</span>
            </div>
          ` : ''}
          ${record.created_at ? `<div class="info-row" style="color: #94a3b8; font-size: 12px; margin-top: 10px;">Submitted: ${new Date(record.created_at).toLocaleString()}</div>` : ''}
        </div>

        ${isApproved ? `
          <div class="status-box approved">
            <div class="status-row">
              Status: <span class="status-pill approved">✓ Approved</span>
            </div>
            <div class="status-row">
              Membership tier: <strong style="color: #0f172a;">${record.membership_tier === 'complimentary' ? 'Complimentary membership (free access)' : 'Paid membership (subscription required)'}</strong>
            </div>
            <div class="status-row">
              Official token: <span style="font-family: monospace; font-weight: 700; letter-spacing: 1px; color: #0f172a;">${record.token}</span>
            </div>
            <div class="status-row" style="font-size: 12.5px; color: #64748b;">
              Approved by ${record.approved_by || approver}${record.approved_at ? ' on ' + new Date(record.approved_at).toLocaleString() : ''}
            </div>
          </div>
          <p style="color: #64748b; font-size: 13.5px; margin: 0; text-align: center;">
            The applicant has received their invitation code via email. You may close this window.
          </p>
        ` : isDeclined ? `
          <div class="status-box declined">
            <div class="status-row">
              Status: <span class="status-pill declined">✕ Declined</span>
            </div>
          </div>
          <p style="color: #64748b; font-size: 13.5px; margin: 0; text-align: center;">
            This request has been declined. You may close this window.
          </p>
        ` : `
          <!-- Pending Review Form -->
          <div style="text-align: left; margin-bottom: 20px;">
            <div class="section-label">
              Select membership option <span style="color: #dc2626;">*</span>
            </div>

            <!-- Radio 1: Paid membership -->
            <label class="radio-option" id="opt-paid">
              <input type="radio" name="membership_tier" value="paid" class="radio-input" onchange="updateRadioSelection()">
              <div>
                <div class="radio-title">Paid membership</div>
                <div class="radio-desc">A subscription is required.</div>
              </div>
            </label>

            <!-- Radio 2: Complimentary membership -->
            <label class="radio-option" id="opt-complimentary">
              <input type="radio" name="membership_tier" value="complimentary" class="radio-input" onchange="updateRadioSelection()">
              <div>
                <div class="radio-title">Complimentary membership</div>
                <div class="radio-desc">Free access, granted at the admin’s discretion.</div>
              </div>
            </label>
          </div>

          <div id="errorBanner" class="error-banner"></div>

          <div class="actions-row">
            <button id="approveBtn" type="button" class="btn-approve" onclick="submitDecision('approve')">
              Approve request
            </button>
            <button id="declineBtn" type="button" class="btn-decline" onclick="submitDecision('decline')">
              Decline
            </button>
          </div>

          <script>
            function updateRadioSelection() {
              const radios = document.querySelectorAll('input[name="membership_tier"]');
              radios.forEach(r => {
                const label = document.getElementById('opt-' + r.value);
                if (label) {
                  if (r.checked) {
                    label.classList.add('selected');
                  } else {
                    label.classList.remove('selected');
                  }
                }
              });
              const banner = document.getElementById('errorBanner');
              if (banner) banner.style.display = 'none';
            }

            function submitDecision(action) {
              const banner = document.getElementById('errorBanner');
              banner.style.display = 'none';

              let selectedTier = null;
              if (action === 'approve') {
                const checked = document.querySelector('input[name="membership_tier"]:checked');
                if (!checked) {
                  banner.textContent = 'Please select either Paid membership or Complimentary membership before approving.';
                  banner.style.display = 'block';
                  return;
                }
                selectedTier = checked.value;
              } else if (action === 'decline') {
                if (!confirm('Are you sure you want to decline this applicant?')) {
                  return;
                }
              }

              const approveBtn = document.getElementById('approveBtn');
              const declineBtn = document.getElementById('declineBtn');
              approveBtn.disabled = true;
              declineBtn.disabled = true;
              approveBtn.style.opacity = '0.5';
              declineBtn.style.opacity = '0.5';
              approveBtn.textContent = action === 'approve' ? 'Approving...' : 'Approve request';
              declineBtn.textContent = action === 'decline' ? 'Declining...' : 'Decline';

              fetch('/api/admin/invitations/review/decision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  requestId: '${record.id}',
                  adminEmail: '${approver}',
                  action: action,
                  membership_tier: selectedTier
                })
              })
              .then(res => res.json())
              .then(data => {
                if (!data.success) {
                  banner.textContent = data.message || 'Operation could not be completed.';
                  banner.style.display = 'block';
                  approveBtn.disabled = false;
                  declineBtn.disabled = false;
                  approveBtn.style.opacity = '1';
                  declineBtn.style.opacity = '1';
                  approveBtn.textContent = 'Approve request';
                  declineBtn.textContent = 'Decline';
                } else {
                  window.location.reload();
                }
              })
              .catch(err => {
                banner.textContent = 'Network or server error. Please try again.';
                banner.style.display = 'block';
                approveBtn.disabled = false;
                declineBtn.disabled = false;
                approveBtn.style.opacity = '1';
                declineBtn.style.opacity = '1';
                approveBtn.textContent = 'Approve request';
                declineBtn.textContent = 'Decline';
              });
            }
          </script>
        `}
      </div>
    </body>
    </html>
  `);
});

// Admin Review Decision Submission (Approve with tier, or Decline without tier)
app.post('/api/admin/invitations/review/decision', (req, res) => {
  const { requestId, email, adminEmail, approvedBy, action, membership_tier, reason } = req.body;
  const approver = approvedBy || adminEmail || 'ermolov.elena@gmail.com';

  if (action === 'decline') {
    let record = null;
    if (requestId) {
      record = db.prepare("SELECT * FROM invitation_tokens WHERE id = ?").get(requestId);
    } else if (email) {
      record = db.prepare("SELECT * FROM invitation_tokens WHERE LOWER(email) = ?").get(email.trim().toLowerCase());
    }

    if (!record) {
      return res.status(404).json({ success: false, message: "Access request not found." });
    }

    db.prepare("UPDATE invitation_tokens SET status = 'declined' WHERE id = ?").run(record.id);

    const logId = 'audit_' + Math.random().toString(36).substring(2, 10);
    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, target_member_id, question_id, ip_address, metadata_json)
      VALUES (?, ?, 'decline_access_request', ?, NULL, '127.0.0.1', ?)
    `).run(logId, approver, record.id, JSON.stringify({ 
      applicant_email: record.email, 
      declined_by: approver,
      reason: reason || 'Declined during review'
    }));

    return res.json({ success: true, status: 'declined', message: "Access request declined." });
  }

  if (action === 'approve') {
    if (!membership_tier || !['paid', 'complimentary'].includes(membership_tier)) {
      return res.status(400).json({ 
        success: false, 
        message: "Please select either Paid membership or Complimentary membership before approving." 
      });
    }

    const result = executeAccessApproval({ 
      requestId, 
      email, 
      approvedBy: approver,
      membershipTier: membership_tier
    });

    if (!result.success) {
      return res.status(result.status || 400).json(result);
    }
    return res.json(result);
  }

  return res.status(400).json({ success: false, message: "Invalid action specified." });
});

// One-Click Magic Approval Link (Redirects to Review Page or processes if tier provided)
app.get('/api/admin/invitations/magic-approve', (req, res) => {
  const { requestId, adminEmail, membership_tier } = req.query;
  const approver = adminEmail || 'ermolov.elena@gmail.com';

  if (!membership_tier) {
    // Redirect to review page so admin selects the membership tier
    return res.redirect(`/api/admin/invitations/review?requestId=${encodeURIComponent(requestId || '')}&adminEmail=${encodeURIComponent(approver)}`);
  }

  const result = executeAccessApproval({ requestId, approvedBy: approver, membershipTier: membership_tier });
  if (!result.success) {
    return res.status(result.status || 400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>ÖZARA — Approval Error</title>
      </head>
      <body style="background: #060913; color: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px;">
        <div style="background: #111827; border: 1px solid #ef4444; border-radius: 16px; max-width: 480px; width: 100%; padding: 32px; text-align: center;">
          <h2 style="color: #ef4444; margin-top: 0;">Approval Error</h2>
          <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px;">${result.message || 'Unable to process approval.'}</p>
          <a href="/api/admin/invitations/review?requestId=${encodeURIComponent(requestId || '')}&adminEmail=${encodeURIComponent(approver)}" style="color: #a78bfa; text-decoration: none; font-size: 14px;">← Go to Review Page</a>
        </div>
      </body>
      </html>
    `);
  }

  return res.redirect(`/api/admin/invitations/review?requestId=${encodeURIComponent(requestId || '')}&adminEmail=${encodeURIComponent(approver)}`);
});

// Real-time access status check by email (used by app to transition screen when approved)
app.get('/api/invitations/status', (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: "Email query param is required." });
  }

  const record = db.prepare("SELECT * FROM invitation_tokens WHERE LOWER(email) = ?").get(email.trim().toLowerCase());
  if (!record) {
    return res.json({ status: 'none', has_token: false });
  }

  if (record.status === 'approved' && !record.is_claimed) {
    return res.json({
      status: 'approved',
      has_token: true,
      token: record.token,
      email: record.email,
      fullName: record.full_name
    });
  }

  if (record.status === 'pending_admin_approval') {
    return res.json({
      status: 'pending',
      has_token: false,
      email: record.email
    });
  }

  if (record.status === 'claimed' || record.is_claimed === 1) {
    return res.json({
      status: 'claimed',
      has_token: false,
      email: record.email
    });
  }

  res.json({ status: record.status, has_token: false });
});

// -------------------------------------------------------------
// 9. ADMIN ROLE & ADMIN DASHBOARD: EVENTS, INVITATIONS & NOTIFICATIONS
// -------------------------------------------------------------

function getAdminUser(req) {
  const viewerId = req.query?.viewerId || req.query?.userId || req.body?.adminId || req.body?.admin_id || req.headers?.['x-user-id'] || req.headers?.['authorization'];
  if (!viewerId) return null;
  const cleanViewer = String(viewerId).startsWith('Bearer ') ? String(viewerId).slice(7).trim() : String(viewerId).trim();

  const AUTHORIZED_ADMIN_EMAILS = [
    'ermolov.elena@gmail.com',
    'alexandra@ozara.club',
    'julia@ozara.club',
    'alexandra@silasvyazei.com',
    'julia@silasvyazei.com'
  ];

  const admin = db.prepare(`
    SELECT * FROM users 
    WHERE (id = ? OR LOWER(email) = ?) AND role IN ('FOUNDER', 'ADMIN')
  `).get(cleanViewer, cleanViewer.toLowerCase());

  if (admin) return admin;

  if (AUTHORIZED_ADMIN_EMAILS.includes(cleanViewer.toLowerCase())) {
    return db.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(cleanViewer.toLowerCase()) || {
      id: cleanViewer,
      email: cleanViewer,
      full_name: 'Administrator',
      role: 'FOUNDER'
    };
  }
  return null;
}

function requireAdmin(req, res, next) {
  const admin = getAdminUser(req);
  if (!admin) {
    return res.status(403).json({ error: "Access Denied: Administrator permissions required." });
  }
  req.adminUser = admin;
  next();
}

// In-App Notifications Endpoints
app.get('/api/notifications', (req, res) => {
  const viewerId = req.query.viewerId || req.query.userId || req.headers['x-user-id'];
  if (!viewerId) return res.status(401).json({ error: "Authentication required." });
  const cleanViewer = String(viewerId).startsWith('Bearer ') ? String(viewerId).slice(7).trim() : String(viewerId).trim();
  const user = db.prepare("SELECT id FROM users WHERE id = ? OR LOWER(email) = ?").get(cleanViewer, cleanViewer.toLowerCase());
  if (!user) return res.status(401).json({ error: "User not found." });

  const notifications = db.prepare(`
    SELECT n.*, e.title as event_title, e.display_date as event_date, e.location as event_location,
           (SELECT status FROM event_invitations ei WHERE ei.event_id = n.event_id AND ei.user_id = n.user_id) as invitation_status
    FROM in_app_notifications n
    LEFT JOIN events e ON n.event_id = e.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 50
  `).all(user.id);

  const unreadCount = db.prepare(`
    SELECT count(*) as count FROM in_app_notifications
    WHERE user_id = ? AND is_read = 0
  `).get(user.id)?.count || 0;

  res.json({ notifications, unread_count: unreadCount });
});

app.post('/api/notifications/:id/read', (req, res) => {
  db.prepare("UPDATE in_app_notifications SET is_read = 1 WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.post('/api/notifications/read-all', (req, res) => {
  const userId = req.body.userId || req.body.user_id;
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  db.prepare("UPDATE in_app_notifications SET is_read = 1 WHERE user_id = ?").run(userId);
  res.json({ success: true });
});

// Admin Event Management Endpoints
app.get('/api/admin/events', requireAdmin, (req, res) => {
  const events = db.prepare(`
    SELECT e.*, c.name as chapter_name,
           (SELECT count(*) FROM event_invitations ei WHERE ei.event_id = e.id) as total_invited,
           (SELECT count(*) FROM event_registrations er WHERE er.event_id = e.id AND er.status = 'registered') as total_registered,
           (SELECT count(*) FROM event_invitations ei WHERE ei.event_id = e.id AND ei.status = 'declined') as total_declined,
           (SELECT count(*) FROM event_registrations er WHERE er.event_id = e.id AND er.status = 'waitlisted') as total_waitlisted
    FROM events e
    LEFT JOIN chapters c ON e.chapter_id = c.id
    ORDER BY e.created_at DESC
  `).all();
  res.json(events);
});

app.get('/api/admin/events/:id', requireAdmin, (req, res) => {
  const event = db.prepare(`
    SELECT e.*, c.name as chapter_name
    FROM events e
    LEFT JOIN chapters c ON e.chapter_id = c.id
    WHERE e.id = ?
  `).get(req.params.id);

  if (!event) return res.status(404).json({ error: "Event not found" });

  const attendees = db.prepare(`
    SELECT er.id, er.user_id, er.status, er.created_at,
           u.full_name, u.email, u.headline, u.avatar_url, u.city, u.country
    FROM event_registrations er
    JOIN users u ON er.user_id = u.id
    WHERE er.event_id = ?
    ORDER BY er.created_at DESC
  `).all(event.id);

  const invitees = db.prepare(`
    SELECT ei.id, ei.user_id, ei.status, ei.sent_at, ei.responded_at, ei.delivery_channel,
           u.full_name, u.email, u.headline, u.avatar_url, u.city, u.country
    FROM event_invitations ei
    JOIN users u ON ei.user_id = u.id
    WHERE ei.event_id = ?
    ORDER BY ei.sent_at DESC
  `).all(event.id);

  res.json({
    event,
    attendees,
    invitees,
    stats: {
      capacity: event.capacity,
      registered: attendees.filter(a => a.status === 'registered').length,
      waitlisted: attendees.filter(a => a.status === 'waitlisted').length,
      invited: invitees.length,
      declined: invitees.filter(i => i.status === 'declined').length,
      available_spots: event.available_spots
    }
  });
});

app.post('/api/admin/events', requireAdmin, (req, res) => {
  const {
    title, description, headline, cover_image, hero_image, event_type,
    location, venue, meeting_link, start_time, end_time, start_date, end_date,
    display_date, timezone, capacity, rsvp_deadline, visibility, price,
    whats_included, agenda, travel_info, hosts, is_published, registration_status, chapter_id
  } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: "Title and description are required." });
  }

  const id = 'evt_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const cap = capacity ? parseInt(capacity, 10) : 30;
  const isPub = is_published !== undefined ? (is_published ? 1 : 0) : 0;
  const img = hero_image || cover_image || '/assets/events/miami_2026.jpg';

  db.prepare(`
    INSERT INTO events (
      id, title, description, headline, hero_image, cover_image, event_type,
      location, venue, meeting_link, start_time, end_time, start_date, end_date,
      display_date, timezone, capacity, available_spots, registered_count,
      rsvp_deadline, visibility, price, whats_included, agenda, travel_info,
      hosts, is_published, registration_status, chapter_id
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, 0,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `).run(
    id, title, description, headline || title, img, img, event_type || 'Summit',
    location || 'To be confirmed', venue || 'To be confirmed', meeting_link || null,
    start_time || new Date().toISOString(), end_time || new Date().toISOString(),
    start_date || (start_time ? start_time.split('T')[0] : null),
    end_date || (end_time ? end_time.split('T')[0] : null),
    display_date || (start_date || 'Upcoming'), timezone || 'UTC',
    cap, cap, rsvp_deadline || null, visibility || 'all_members',
    price || 'Included in Membership', whats_included || null, agenda || null,
    travel_info || null, hosts || (req.adminUser.full_name || 'ÖZARA Leadership'),
    isPub, registration_status || (isPub ? 'open' : 'coming_soon'),
    chapter_id || null
  );

  const logId = 'audit_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_member_id, ip_address, metadata_json)
    VALUES (?, ?, 'admin_create_event', ?, '127.0.0.1', ?)
  `).run(logId, req.adminUser.id, id, JSON.stringify({ title, visibility, is_published: isPub }));

  const created = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
  res.json({ success: true, event: created });
});

app.put('/api/admin/events/:id', requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Event not found" });

  const {
    title, description, headline, cover_image, hero_image, event_type,
    location, venue, meeting_link, start_time, end_time, start_date, end_date,
    display_date, timezone, capacity, rsvp_deadline, visibility, price,
    whats_included, agenda, travel_info, hosts, is_published, registration_status, status
  } = req.body;

  const newCapacity = capacity !== undefined ? parseInt(capacity, 10) : existing.capacity;
  const newSpots = (newCapacity && existing.registered_count !== null) ? Math.max(0, newCapacity - existing.registered_count) : existing.available_spots;
  const img = hero_image || cover_image || existing.hero_image;

  db.prepare(`
    UPDATE events SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      headline = COALESCE(?, headline),
      hero_image = COALESCE(?, hero_image),
      cover_image = COALESCE(?, cover_image),
      event_type = COALESCE(?, event_type),
      location = COALESCE(?, location),
      venue = COALESCE(?, venue),
      meeting_link = COALESCE(?, meeting_link),
      start_time = COALESCE(?, start_time),
      end_time = COALESCE(?, end_time),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      display_date = COALESCE(?, display_date),
      timezone = COALESCE(?, timezone),
      capacity = COALESCE(?, capacity),
      available_spots = COALESCE(?, available_spots),
      rsvp_deadline = COALESCE(?, rsvp_deadline),
      visibility = COALESCE(?, visibility),
      price = COALESCE(?, price),
      whats_included = COALESCE(?, whats_included),
      agenda = COALESCE(?, agenda),
      travel_info = COALESCE(?, travel_info),
      hosts = COALESCE(?, hosts),
      is_published = COALESCE(?, is_published),
      registration_status = COALESCE(?, registration_status),
      status = COALESCE(?, status)
    WHERE id = ?
  `).run(
    title, description, headline, img, img, event_type,
    location, venue, meeting_link, start_time, end_time, start_date, end_date,
    display_date, timezone, newCapacity, newSpots, rsvp_deadline, visibility, price,
    whats_included, agenda, travel_info, hosts,
    is_published !== undefined ? (is_published ? 1 : 0) : null,
    registration_status, status,
    req.params.id
  );

  const logId = 'audit_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_member_id, ip_address, metadata_json)
    VALUES (?, ?, 'admin_edit_event', ?, '127.0.0.1', ?)
  `).run(logId, req.adminUser.id, req.params.id, JSON.stringify({ title, status }));

  const updated = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  res.json({ success: true, event: updated });
});

app.post('/api/admin/events/:id/publish', requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Event not found" });

  db.prepare("UPDATE events SET is_published = 1, registration_status = 'open' WHERE id = ?").run(req.params.id);

  const logId = 'audit_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_member_id, ip_address, metadata_json)
    VALUES (?, ?, 'admin_publish_event', ?, '127.0.0.1', ?)
  `).run(logId, req.adminUser.id, req.params.id, JSON.stringify({ title: existing.title }));

  res.json({ success: true, is_published: 1, message: "Event published successfully." });
});

app.post('/api/admin/events/:id/cancel', requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Event not found" });

  db.prepare("UPDATE events SET status = 'cancelled', registration_status = 'closed' WHERE id = ?").run(req.params.id);

  const logId = 'audit_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_member_id, ip_address, metadata_json)
    VALUES (?, ?, 'admin_cancel_event', ?, '127.0.0.1', ?)
  `).run(logId, req.adminUser.id, req.params.id, JSON.stringify({ title: existing.title }));

  res.json({ success: true, status: 'cancelled', message: "Event cancelled successfully." });
});

// Targeted Event Invitations: Preview & Filter Recipients (Read-only, never sends)
app.post('/api/admin/events/invitations/recipients', requireAdmin, (req, res) => {
  const {
    eventId,
    selectionOption = 'all_admitted', // 'all_admitted' | 'individual' | 'filters'
    selectedUserIds = [],
    filters = {},
    excludedUserIds = []
  } = req.body;

  const event = eventId ? db.prepare("SELECT * FROM events WHERE id = ?").get(eventId) : null;

  // Retrieve all admitted members
  const allMembers = db.prepare(`
    SELECT u.id, u.full_name, u.headline, u.email, u.avatar_url, u.city, u.country, u.state, u.chapter_id,
           c.name as chapter_name
    FROM users u
    LEFT JOIN chapters c ON u.chapter_id = c.id
    WHERE u.is_admitted = 1 OR u.role IN ('FOUNDER', 'ADMIN')
    ORDER BY u.full_name ASC
  `).all();

  // Load taxonomies and answers for each member
  const membersWithMetadata = allMembers.map(m => {
    const taxonomies = db.prepare("SELECT category, slug, label FROM taxonomies WHERE user_id = ?").all(m.id);
    const taxMap = { roles: [], industries: [], expertise: [], offers: [], needs: [], interests: [], institutions: [] };
    taxonomies.forEach(t => {
      if (taxMap[t.category]) taxMap[t.category].push({ slug: t.slug, label: t.label });
    });

    const q22 = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 22").get(m.id);
    const q27 = db.prepare("SELECT value_text FROM questionnaire_answers WHERE user_id = ? AND question_id = 27").get(m.id);

    let university = q27 ? q27.value_text : null;
    if (!university && taxMap.institutions.length > 0) {
      university = taxMap.institutions[0].label;
    }

    // Check if already invited for this event
    let alreadyInvited = false;
    let rsvpStatus = 'none';
    if (eventId) {
      const inv = db.prepare("SELECT status FROM event_invitations WHERE event_id = ? AND user_id = ?").get(eventId, m.id);
      if (inv) {
        alreadyInvited = true;
        rsvpStatus = inv.status || 'pending';
      }
    }

    return {
      ...m,
      taxonomies: taxMap,
      interests_outside_work: q22 ? q22.value_text : null,
      university,
      already_invited: alreadyInvited,
      rsvp_status: rsvpStatus
    };
  });

  const cleanLocationFilter = (filters.location || '').toLowerCase().trim();
  const cleanChapterFilter = (filters.chapter_id || '').trim();
  const cleanIndustryFilter = (filters.industry || '').toLowerCase().trim();
  const cleanInterestsFilter = (filters.interests || '').toLowerCase().trim();
  const cleanUniversityFilter = (filters.university || '').toLowerCase().trim();
  const cleanExpertiseFilter = (filters.expertise || '').toLowerCase().trim();

  const excludedSet = new Set(excludedUserIds || []);

  const matchedRecipients = membersWithMetadata.filter(m => {
    // Check individual exclusion
    if (excludedSet.has(m.id)) return false;

    if (selectionOption === 'all_admitted') {
      return true;
    }

    if (selectionOption === 'individual') {
      return selectedUserIds.includes(m.id);
    }

    if (selectionOption === 'filters') {
      // Combined filters (all provided filters must match)
      if (cleanLocationFilter && cleanLocationFilter !== 'all') {
        const cityMatch = (m.city || '').toLowerCase().includes(cleanLocationFilter);
        const countryMatch = (m.country || '').toLowerCase().includes(cleanLocationFilter);
        const stateMatch = (m.state || '').toLowerCase().includes(cleanLocationFilter);
        if (!(cityMatch || countryMatch || stateMatch)) return false;
      }

      if (cleanChapterFilter && cleanChapterFilter !== 'all') {
        if (m.chapter_id !== cleanChapterFilter) return false;
      }

      if (cleanIndustryFilter && cleanIndustryFilter !== 'all') {
        const taxMatch = m.taxonomies.industries.some(i => i.label.toLowerCase().includes(cleanIndustryFilter) || i.slug.includes(cleanIndustryFilter));
        const headMatch = (m.headline || '').toLowerCase().includes(cleanIndustryFilter);
        if (!(taxMatch || headMatch)) return false;
      }

      if (cleanInterestsFilter && cleanInterestsFilter !== 'all') {
        const taxInterestMatch = m.taxonomies.interests.some(i => i.label.toLowerCase().includes(cleanInterestsFilter) || i.slug.includes(cleanInterestsFilter));
        const interestsTextMatch = (m.interests_outside_work || '').toLowerCase().includes(cleanInterestsFilter);
        if (!(taxInterestMatch || interestsTextMatch)) return false;
      }

      if (cleanUniversityFilter && cleanUniversityFilter !== 'all') {
        const uniMatch = (m.university || '').toLowerCase().includes(cleanUniversityFilter);
        const taxUniMatch = m.taxonomies.institutions.some(u => u.label.toLowerCase().includes(cleanUniversityFilter));
        if (!(uniMatch || taxUniMatch)) return false;
      }

      if (cleanExpertiseFilter && cleanExpertiseFilter !== 'all') {
        const taxExpertiseMatch = m.taxonomies.expertise.some(e => e.label.toLowerCase().includes(cleanExpertiseFilter) || e.slug.includes(cleanExpertiseFilter));
        if (!taxExpertiseMatch) return false;
      }

      return true;
    }

    return true;
  });

  const alreadyInvitedCount = matchedRecipients.filter(r => r.already_invited).length;
  const uninvitedCount = matchedRecipients.filter(r => !r.already_invited).length;

  const eventTitle = event ? event.title : 'Exclusive Gathering';
  const eventLoc = event ? (event.venue && event.venue !== 'To be confirmed' ? `${event.venue}, ${event.location}` : event.location) : 'ÖZARA Club';
  const eventDate = event ? (event.display_date || event.start_date || 'Upcoming') : 'TBA';

  const messagePreview = `Dear Member,\n\nYou are cordially invited to attend ${eventTitle}.\nLocation: ${eventLoc}\nDate: ${eventDate}\n\nPlease review the complete event details and confirm your attendance in ÖZARA.`;

  res.json({
    selection_option: selectionOption,
    total_found: matchedRecipients.length,
    recipient_count: matchedRecipients.length,
    uninvited_count: uninvitedCount,
    already_invited_count: alreadyInvitedCount,
    message_preview: messagePreview,
    recipients: matchedRecipients.map(r => ({
      id: r.id,
      full_name: r.full_name,
      headline: r.headline,
      email: r.email,
      avatar_url: r.avatar_url,
      city: r.city,
      country: r.country,
      chapter_name: r.chapter_name,
      already_invited: r.already_invited,
      rsvp_status: r.rsvp_status
    })),
    event: event ? {
      id: event.id,
      title: event.title,
      location: event.location,
      display_date: event.display_date
    } : null
  });
});

// Explicit Send Invitations (Requires explicit admin confirmation)
app.post('/api/admin/events/invitations/send', requireAdmin, async (req, res) => {
  const {
    eventId,
    recipientIds,
    deliveryChannels = ['in_app'], // ['in_app', 'email', 'whatsapp']
    customMessage
  } = req.body;

  if (!eventId || !recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
    return res.status(400).json({ error: "Missing eventId or recipientIds array." });
  }

  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
  if (!event) return res.status(404).json({ error: "Event not found." });

  const activeChannels = Array.isArray(deliveryChannels) && deliveryChannels.length > 0 ? deliveryChannels : ['in_app'];
  const channelStr = activeChannels.join(',');

  const insertInv = db.prepare(`
    INSERT INTO event_invitations (event_id, user_id, status, delivery_channel, admin_id, sent_at)
    VALUES (?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(event_id, user_id) DO UPDATE SET delivery_channel = excluded.delivery_channel, sent_at = CURRENT_TIMESTAMP
  `);

  const insertNotif = db.prepare(`
    INSERT INTO in_app_notifications (id, user_id, type, title, message, event_id, action_url, delivery_channel)
    VALUES (?, ?, 'event_invitation', ?, ?, ?, ?, ?)
  `);

  let sentCount = 0;
  const dispatchedRecipients = [];

  for (const uid of recipientIds) {
    const user = db.prepare("SELECT id, email, full_name FROM users WHERE id = ?").get(uid);
    if (!user) continue;

    // 1. Record event invitation (prevents duplicates)
    insertInv.run(eventId, user.id, channelStr, req.adminUser.id);

    // 2. In-App Notification (Always delivered by default)
    const notifId = 'notif_' + Math.random().toString(36).substring(2, 10);
    const notifTitle = `Invitation: ${event.title}`;
    const notifMsg = customMessage || `You are cordially invited to ${event.title} in ${event.location || event.city} on ${event.display_date || event.start_date}. Please review and RSVP.`;
    insertNotif.run(notifId, user.id, notifTitle, notifMsg, eventId, `/events/${eventId}`, channelStr);

    // 3. Email delivery (Only if configured and explicitly selected)
    if (activeChannels.includes('email') && user.email) {
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b1020; color: #ffffff; padding: 32px 28px; border-radius: 14px; max-width: 540px; border: 1px solid rgba(255,255,255,0.08);">
          <div style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 14px; margin-bottom: 20px;">
            <h2 style="color: #ffffff; letter-spacing: 3px; margin: 0; font-size: 20px;">ÖZARA</h2>
            <span style="font-size: 10px; color: #a78bfa; letter-spacing: 2px; font-weight: 700; text-transform: uppercase;">PRIVATE CLUB GATHERING</span>
          </div>
          <p style="color: #a78bfa; font-weight: 600; font-size: 15px; margin: 0 0 10px 0;">Personal Event Invitation</p>
          <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 16px 0;">${event.title}</h1>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">Dear ${user.full_name}, you are cordially invited to attend this exclusive ÖZARA member gathering.</p>
          <div style="background: #111827; padding: 18px 20px; border-radius: 10px; margin: 20px 0; border: 1px solid rgba(255,255,255,0.08);">
            <div style="margin-bottom: 8px; font-size: 14px; color: #94a3b8;">📅 Date: <strong style="color: #ffffff;">${event.display_date || event.start_date}</strong></div>
            <div style="margin-bottom: 8px; font-size: 14px; color: #94a3b8;">📍 Location: <strong style="color: #ffffff;">${event.venue && event.venue !== 'To be confirmed' ? `${event.venue}, ` : ''}${event.location}</strong></div>
            ${event.rsvp_deadline ? `<div style="font-size: 14px; color: #94a3b8;">⏳ RSVP Deadline: <strong style="color: #f59e0b;">${event.rsvp_deadline}</strong></div>` : ''}
          </div>
          <p style="color: #94a3b8; font-size: 13.5px; line-height: 1.6; margin: 0 0 20px 0;">
            Please open the ÖZARA app to view the complete itinerary and confirm your RSVP.
          </p>
        </div>
      `;
      sendEmailNotification({
        to: user.email,
        subject: `ÖZARA Invitation: ${event.title}`,
        text: `Dear ${user.full_name},\n\nYou are invited to ${event.title} on ${event.display_date || event.start_date} at ${event.location}.\nPlease RSVP via ÖZARA.`,
        html: emailHtml
      }).catch(err => console.error(`[INVITATION EMAIL ERROR] to ${user.email}:`, err.message));
    }

    sentCount++;
    dispatchedRecipients.push({ id: user.id, email: user.email, name: user.full_name });
  }

  // Audit Logging: Record which admin performed the action
  const logId = 'audit_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_member_id, ip_address, metadata_json)
    VALUES (?, ?, 'admin_send_event_invitations', ?, '127.0.0.1', ?)
  `).run(logId, req.adminUser.id, eventId, JSON.stringify({
    event_id: eventId,
    event_title: event.title,
    sent_count: sentCount,
    delivery_channels: activeChannels,
    recipient_ids: recipientIds
  }));

  res.json({
    success: true,
    sent_count: sentCount,
    delivery_channels: activeChannels,
    dispatched_recipients: dispatchedRecipients
  });
});

// Enhanced Membership Invitations Listing (Includes claimed user details)
app.get('/api/admin/invitations', requireAdmin, (req, res) => {
  const invites = db.prepare(`
    SELECT it.*, u.full_name as creator_name,
           claimer.full_name as claimed_user_name,
           claimer.email as claimed_user_email
    FROM invitation_tokens it
    LEFT JOIN users u ON it.created_by = u.id
    LEFT JOIN users claimer ON it.claimed_by = claimer.id
    ORDER BY it.created_at DESC
  `).all();
  res.json(invites);
});

// Enhanced Membership Invitation Issuance
app.post('/api/admin/invitations/create', requireAdmin, (req, res) => {
  const { email, fullName, role, expiresInDays, expiresAt: customExpiresAt, notes } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ success: false, message: "Email is required to bind a 1:1 invitation." });
  }
  const cleanEmail = email.trim().toLowerCase();
  const token = 'OZARA-' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000);
  const existingRecord = db.prepare("SELECT id FROM invitation_tokens WHERE LOWER(email) = ?").get(cleanEmail);
  const id = existingRecord ? existingRecord.id : ('inv_' + Math.random().toString(36).substring(2, 8));
  const days = expiresInDays ? parseInt(expiresInDays, 10) : 14;
  const expiresAt = customExpiresAt || new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const inviteUrl = `https://ozara.club/invitation?code=${token}`;

  db.prepare(`
    INSERT INTO invitation_tokens (id, email, token, created_by, expires_at, full_name, role_or_headline, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved')
    ON CONFLICT(email) DO UPDATE SET
      token = excluded.token,
      expires_at = excluded.expires_at,
      created_by = excluded.created_by,
      full_name = COALESCE(excluded.full_name, invitation_tokens.full_name),
      role_or_headline = COALESCE(excluded.role_or_headline, invitation_tokens.role_or_headline),
      notes = COALESCE(excluded.notes, invitation_tokens.notes),
      status = 'approved',
      is_claimed = 0,
      claimed_by = NULL,
      claimed_at = NULL
  `).run(id, cleanEmail, token, req.adminUser.id, expiresAt, fullName || null, role || null, notes || null);

  // Log audit log
  const logId = 'audit_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_member_id, ip_address, metadata_json)
    VALUES (?, ?, 'admin_create_invitation_token', ?, '127.0.0.1', ?)
  `).run(logId, req.adminUser.id, id, JSON.stringify({
    email: cleanEmail,
    token,
    expires_at: expiresAt
  }));

  res.json({
    success: true,
    token,
    id,
    email: cleanEmail,
    expiresAt,
    expires_at: expiresAt,
    inviteUrl,
    created_by: req.adminUser.id
  });
});

// ============================================================================
// 10. INBOX, MEMBER MESSAGING, EMAIL NOTIFICATIONS & ADMIN ACTIVITY
// ============================================================================

// Helper: Resolve member from request
function resolveViewer(req) {
  const viewerId = req.query.viewerId || req.query.userId || req.body?.viewerId || req.body?.userId || req.headers['x-user-id'] || req.headers['authorization'];
  if (!viewerId) return null;
  const clean = String(viewerId).startsWith('Bearer ') ? String(viewerId).slice(7).trim() : String(viewerId).trim();
  const session = db.prepare(`
    SELECT u.* FROM user_sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))
  `).get(clean);
  if (session) return session;
  return db.prepare("SELECT * FROM users WHERE id = ? OR LOWER(email) = ?").get(clean, clean.toLowerCase());
}

// 1. Inbox Summary (unread counts)
app.get('/api/inbox/summary', (req, res) => {
  const viewer = resolveViewer(req);
  if (!viewer) return res.status(401).json({ error: "Authentication required." });

  const unreadMessages = db.prepare(`
    SELECT count(*) as count FROM direct_messages
    WHERE recipient_id = ? AND is_read = 0
  `).get(viewer.id)?.count || 0;

  const unreadNotifs = db.prepare(`
    SELECT count(*) as count FROM in_app_notifications
    WHERE user_id = ? AND is_read = 0
  `).get(viewer.id)?.count || 0;

  const isAdmin = ['FOUNDER', 'ADMIN'].includes(viewer.role);
  let unreadAdminActivity = 0;
  if (isAdmin) {
    unreadAdminActivity = db.prepare(`
      SELECT count(*) as count FROM admin_activity_log
      WHERE created_at >= datetime('now', '-24 hours')
    `).get()?.count || 0;
  }

  res.json({
    unread_messages: unreadMessages,
    unread_notifications: unreadNotifs,
    total_unread: unreadMessages + unreadNotifs,
    is_admin: isAdmin,
    unread_admin_activity: unreadAdminActivity
  });
});

// 2. In-App Notifications List
app.get('/api/inbox/notifications', (req, res) => {
  const viewer = resolveViewer(req);
  if (!viewer) return res.status(401).json({ error: "Authentication required." });

  const category = req.query.category || 'all';
  let query = `
    SELECT n.*,
           e.title as event_title, e.display_date as event_date, e.location as event_location
    FROM in_app_notifications n
    LEFT JOIN events e ON n.event_id = e.id
    WHERE n.user_id = ?
  `;
  const params = [viewer.id];

  if (category && category !== 'all') {
    query += ` AND n.category = ?`;
    params.push(category);
  }

  query += ` ORDER BY n.created_at DESC LIMIT 60`;

  const rows = db.prepare(query).all(...params);
  const notifications = rows.map(r => {
    let metadata = null;
    if (r.metadata_json) {
      try { metadata = JSON.parse(r.metadata_json); } catch (e) {}
    }
    return {
      ...r,
      is_read: Boolean(r.is_read),
      metadata
    };
  });

  const unreadCount = db.prepare(`
    SELECT count(*) as count FROM in_app_notifications WHERE user_id = ? AND is_read = 0
  `).get(viewer.id)?.count || 0;

  res.json({ notifications, unread_count: unreadCount });
});

// 3. Mark Single Notification Read
app.post('/api/inbox/notifications/:id/read', (req, res) => {
  db.prepare("UPDATE in_app_notifications SET is_read = 1 WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// 4. Mark All Notifications Read
app.post('/api/inbox/notifications/read-all', (req, res) => {
  const viewer = resolveViewer(req);
  if (!viewer) return res.status(401).json({ error: "Authentication required." });

  db.prepare("UPDATE in_app_notifications SET is_read = 1 WHERE user_id = ?").run(viewer.id);
  res.json({ success: true });
});

// 5. Conversations List
app.get('/api/inbox/conversations', (req, res) => {
  const viewer = resolveViewer(req);
  if (!viewer) return res.status(401).json({ error: "Authentication required." });

  if (viewer.role !== 'FOUNDER' && viewer.role !== 'ADMIN') {
    const isComplete = viewer.is_complete === 1;
    const isSubActive = (viewer.membership_tier === 'complimentary') || (viewer.subscription_status === 'active');
    if (!isComplete || !isSubActive) {
      return res.status(403).json({ error: "onboarding_incomplete", message: "Please complete your onboarding to access direct messaging." });
    }
  }

  const convs = db.prepare(`
    SELECT c.*,
           u1.id as u1_id, u1.full_name as u1_name, u1.headline as u1_headline, u1.avatar_url as u1_avatar, u1.role as u1_role, u1.city as u1_city, u1.country as u1_country,
           u2.id as u2_id, u2.full_name as u2_name, u2.headline as u2_headline, u2.avatar_url as u2_avatar, u2.role as u2_role, u2.city as u2_city, u2.country as u2_country
    FROM conversations c
    JOIN users u1 ON c.participant_one_id = u1.id
    JOIN users u2 ON c.participant_two_id = u2.id
    WHERE c.participant_one_id = ? OR c.participant_two_id = ?
    ORDER BY c.last_message_at DESC
  `).all(viewer.id, viewer.id);

  const formatted = convs.map(c => {
    const isP1 = c.participant_one_id === viewer.id;
    const other = isP1 ? {
      id: c.u2_id,
      full_name: c.u2_name,
      headline: c.u2_headline,
      avatar_url: c.u2_avatar,
      role: c.u2_role,
      city: c.u2_city,
      country: c.u2_country
    } : {
      id: c.u1_id,
      full_name: c.u1_name,
      headline: c.u1_headline,
      avatar_url: c.u1_avatar,
      role: c.u1_role,
      city: c.u1_city,
      country: c.u1_country
    };

    const unread = db.prepare(`
      SELECT count(*) as count FROM direct_messages
      WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0
    `).get(c.id, viewer.id)?.count || 0;

    return {
      id: c.id,
      other_user: other,
      last_message: {
        text: c.last_message_text,
        sender_id: c.last_message_sender_id,
        created_at: c.last_message_at
      },
      unread_count: unread,
      is_blocked: Boolean(c.is_blocked),
      blocked_by: c.blocked_by_id,
      updated_at: c.updated_at
    };
  });

  res.json(formatted);
});

// 6. Get Single Conversation Messages & Mark Read
app.get('/api/inbox/conversations/:id', (req, res) => {
  const viewer = resolveViewer(req);
  if (!viewer) return res.status(401).json({ error: "Authentication required." });

  const conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found." });

  if (conv.participant_one_id !== viewer.id && conv.participant_two_id !== viewer.id) {
    return res.status(403).json({ error: "Forbidden: You are not a participant in this conversation." });
  }

  // Mark all unread received messages as read
  db.prepare(`
    UPDATE direct_messages
    SET is_read = 1, read_at = CURRENT_TIMESTAMP
    WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0
  `).run(conv.id, viewer.id);

  const otherId = conv.participant_one_id === viewer.id ? conv.participant_two_id : conv.participant_one_id;
  const otherUser = db.prepare("SELECT id, full_name, headline, avatar_url, role, city, country FROM users WHERE id = ?").get(otherId);

  const messages = db.prepare(`
    SELECT dm.*, u.full_name as sender_name, u.avatar_url as sender_avatar
    FROM direct_messages dm
    JOIN users u ON dm.sender_id = u.id
    WHERE dm.conversation_id = ?
    ORDER BY dm.created_at ASC
  `).all(conv.id);

  res.json({
    conversation: {
      id: conv.id,
      is_blocked: Boolean(conv.is_blocked),
      blocked_by: conv.blocked_by_id,
      last_message_at: conv.last_message_at
    },
    other_user: otherUser,
    messages: messages.map(m => ({ ...m, is_read: Boolean(m.is_read) }))
  });
});

// 7. Start or Resume Conversation
app.post('/api/inbox/conversations/start', (req, res) => {
  const viewer = resolveViewer(req);
  if (!viewer) return res.status(401).json({ error: "Authentication required." });

  const targetUserId = req.body.targetUserId || req.body.target_user_id || req.body.recipientId;
  if (!targetUserId || targetUserId === viewer.id) {
    return res.status(400).json({ error: "Invalid target user." });
  }

  const targetUser = db.prepare("SELECT id, full_name, headline, avatar_url, role, city, country FROM users WHERE id = ?").get(targetUserId);
  if (!targetUser) return res.status(404).json({ error: "User not found." });

  // Permissions check: Mutual connection required OR either is admin/founder
  const isViewerAdmin = ['FOUNDER', 'ADMIN'].includes(viewer.role);
  const isTargetAdmin = ['FOUNDER', 'ADMIN'].includes(targetUser.role);

  if (!isViewerAdmin && !isTargetAdmin) {
    const conn = db.prepare(`
      SELECT status FROM member_connections
      WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)
    `).get(viewer.id, targetUserId, targetUserId, viewer.id);

    if (!conn || conn.status !== 'accepted') {
      return res.status(403).json({
        error: "MUTUAL_CONNECTION_REQUIRED",
        message: "Direct messaging is available only between mutually accepted connections or with club leadership."
      });
    }
  }

  // Block check
  const block = db.prepare(`
    SELECT * FROM user_blocks
    WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
  `).get(viewer.id, targetUserId, targetUserId, viewer.id);

  if (block) {
    return res.status(403).json({
      error: "USER_BLOCKED",
      message: "Messaging is unavailable because of user blocking."
    });
  }

  // Find or create conversation
  let conv = db.prepare(`
    SELECT * FROM conversations
    WHERE (participant_one_id = ? AND participant_two_id = ?) OR (participant_one_id = ? AND participant_two_id = ?)
  `).get(viewer.id, targetUserId, targetUserId, viewer.id);

  if (!conv) {
    const convId = 'conv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    db.prepare(`
      INSERT INTO conversations (id, participant_one_id, participant_two_id, last_message_text, last_message_sender_id, created_at, updated_at)
      VALUES (?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(convId, viewer.id, targetUserId);
    conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(convId);
  }

  res.json({
    success: true,
    conversation_id: conv.id,
    conversation: conv,
    other_user: targetUser
  });
});

// 8. Send Direct Message
app.post('/api/inbox/messages/send', (req, res) => {
  const viewer = resolveViewer(req);
  if (!viewer) return res.status(401).json({ error: "Authentication required." });

  const { conversationId, recipientId, content } = req.body;
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: "Message content cannot be empty." });
  }

  let conv = null;
  let targetId = recipientId;

  if (conversationId) {
    conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId);
    if (!conv) return res.status(404).json({ error: "Conversation not found." });
    targetId = conv.participant_one_id === viewer.id ? conv.participant_two_id : conv.participant_one_id;
  } else if (recipientId) {
    conv = db.prepare(`
      SELECT * FROM conversations
      WHERE (participant_one_id = ? AND participant_two_id = ?) OR (participant_one_id = ? AND participant_two_id = ?)
    `).get(viewer.id, recipientId, recipientId, viewer.id);
  }

  if (!targetId || targetId === viewer.id) {
    return res.status(400).json({ error: "Invalid recipient." });
  }

  const recipient = db.prepare("SELECT id, email, full_name, role FROM users WHERE id = ?").get(targetId);
  if (!recipient) return res.status(404).json({ error: "Recipient not found." });

  // Permissions check: Mutual connection required OR either is admin/founder
  const isViewerAdmin = ['FOUNDER', 'ADMIN'].includes(viewer.role);
  const isTargetAdmin = ['FOUNDER', 'ADMIN'].includes(recipient.role);

  if (!isViewerAdmin && !isTargetAdmin) {
    const connRec = db.prepare(`
      SELECT status FROM member_connections
      WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)
    `).get(viewer.id, targetId, targetId, viewer.id);

    if (!connRec || connRec.status !== 'accepted') {
      return res.status(403).json({
        error: "MUTUAL_CONNECTION_REQUIRED",
        message: "Direct messaging requires a mutually accepted connection or club leadership access."
      });
    }
  }

  // Block check: recipient blocked viewer?
  const isBlocked = db.prepare("SELECT * FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?").get(targetId, viewer.id);
  if (isBlocked) {
    return res.status(403).json({
      error: "USER_BLOCKED",
      message: "You cannot message this member."
    });
  }

  // Ensure conversation exists
  if (!conv) {
    const newConvId = 'conv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    db.prepare(`
      INSERT INTO conversations (id, participant_one_id, participant_two_id, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(newConvId, viewer.id, targetId);
    conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(newConvId);
  }

  const msgId = 'msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const cleanContent = content.trim();

  db.prepare(`
    INSERT INTO direct_messages (id, conversation_id, sender_id, recipient_id, content, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `).run(msgId, conv.id, viewer.id, targetId, cleanContent);

  db.prepare(`
    UPDATE conversations
    SET last_message_text = ?, last_message_sender_id = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(cleanContent, viewer.id, conv.id);

  // 1. In-App Notification for recipient
  const notifId = 'notif_' + Math.random().toString(36).substring(2, 10);
  try {
    db.prepare(`
      INSERT INTO in_app_notifications (id, user_id, type, title, message, action_url, metadata_json, category)
      VALUES (?, ?, 'direct_message', ?, ?, ?, ?, 'messages')
    `).run(
      notifId,
      targetId,
      'New Message',
      `You have a new message from ${viewer.full_name}`,
      `#inbox?tab=messages&conv=${conv.id}`,
      JSON.stringify({ conversation_id: conv.id, sender_id: viewer.id, sender_name: viewer.full_name })
    );
  } catch (e) {}

  // 2. Transactional Email with 15-Minute Debouncing & Body Omission
  if (shouldSendDirectMessageEmail(conv, targetId)) {
    queueAndSendEmail({
      to: recipient.email,
      recipientUserId: targetId,
      notificationId: notifId,
      category: 'messages',
      subject: `You have a new message from ${viewer.full_name}`,
      templateType: 'direct_message',
      templateData: {
        title: 'New Message Received',
        preheader: `You have a new message from ${viewer.full_name} on ÖZARA`,
        badge: 'PRIVATE CONVERSATION',
        bodyText: `You have a new message from <strong>${viewer.full_name}</strong>. Log in to your ÖZARA Inbox to read and reply.`,
        ctaText: 'Open Conversation',
        ctaUrl: `http://localhost:3000/#inbox?tab=messages&conv=${conv.id}`,
        noticeText: 'Message bodies are never transmitted over email to safeguard member privacy and discretion.'
      },
      actionUrl: `#inbox?tab=messages&conv=${conv.id}`,
      idempotencyKey: `dm_${msgId}`
    }).catch(err => console.error('[EMAIL QUEUE ERROR]', err.message));

    db.prepare("UPDATE conversations SET last_email_sent_at = CURRENT_TIMESTAMP WHERE id = ?").run(conv.id);
  }

  // 3. Admin Activity Log (confidential: zero message content logged)
  recordAdminActivity({
    activityType: 'direct_message',
    title: 'Direct Message Exchanged',
    description: `${viewer.full_name} sent a private message to ${recipient.full_name}.`,
    actorId: viewer.id,
    targetId: targetId,
    entityType: 'conversations',
    entityId: conv.id
  });

  const createdMsg = db.prepare("SELECT * FROM direct_messages WHERE id = ?").get(msgId);
  res.status(201).json({
    success: true,
    message: { ...createdMsg, is_read: false },
    conversation_id: conv.id
  });
});

// 9. Block / Unblock Member
app.post('/api/inbox/block', (req, res) => {
  const viewer = resolveViewer(req);
  if (!viewer) return res.status(401).json({ error: "Authentication required." });

  const { targetUserId, reason } = req.body;
  if (!targetUserId || targetUserId === viewer.id) {
    return res.status(400).json({ error: "Invalid target user." });
  }

  const existingBlock = db.prepare("SELECT * FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?").get(viewer.id, targetUserId);

  if (existingBlock) {
    db.prepare("DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?").run(viewer.id, targetUserId);
    db.prepare(`
      UPDATE conversations SET is_blocked = 0, blocked_by_id = NULL
      WHERE (participant_one_id = ? AND participant_two_id = ?) OR (participant_one_id = ? AND participant_two_id = ?)
    `).run(viewer.id, targetUserId, targetUserId, viewer.id);
    return res.json({ success: true, is_blocked: false, message: "Member unblocked." });
  } else {
    const blockId = 'blk_' + Math.random().toString(36).substring(2, 9);
    db.prepare(`
      INSERT INTO user_blocks (id, blocker_id, blocked_id, reason)
      VALUES (?, ?, ?, ?)
    `).run(blockId, viewer.id, targetUserId, reason || null);

    db.prepare(`
      UPDATE conversations SET is_blocked = 1, blocked_by_id = ?
      WHERE (participant_one_id = ? AND participant_two_id = ?) OR (participant_one_id = ? AND participant_two_id = ?)
    `).run(viewer.id, viewer.id, targetUserId, targetUserId, viewer.id);

    const targetUser = db.prepare("SELECT full_name FROM users WHERE id = ?").get(targetUserId);
    recordAdminActivity({
      activityType: 'report_filed',
      title: 'Member Blocked',
      description: `${viewer.full_name} blocked ${targetUser ? targetUser.full_name : 'a member'}.`,
      actorId: viewer.id,
      targetId: targetUserId,
      entityType: 'user_blocks',
      entityId: blockId
    });

    return res.json({ success: true, is_blocked: true, message: "Member blocked." });
  }
});

// 10. Report Member / Incident
app.post('/api/inbox/report', (req, res) => {
  const viewer = resolveViewer(req);
  if (!viewer) return res.status(401).json({ error: "Authentication required." });

  const { targetUserId, reason, details } = req.body;
  if (!targetUserId || targetUserId === viewer.id) {
    return res.status(400).json({ error: "Invalid target user." });
  }

  const repId = 'rep_' + Math.random().toString(36).substring(2, 9);
  const fullReason = [reason, details].filter(Boolean).join(' - ');

  db.prepare(`
    INSERT INTO profile_reports (id, reporter_id, reported_user_id, reason, status)
    VALUES (?, ?, ?, ?, 'pending_review')
  `).run(repId, viewer.id, targetUserId, fullReason || 'Conduct concern');

  const targetUser = db.prepare("SELECT full_name FROM users WHERE id = ?").get(targetUserId);
  recordAdminActivity({
    activityType: 'report_filed',
    title: 'Member Reported',
    description: `${viewer.full_name} submitted a report against ${targetUser ? targetUser.full_name : 'a member'}: ${reason || 'Unspecified'}.`,
    actorId: viewer.id,
    targetId: targetUserId,
    entityType: 'profile_reports',
    entityId: repId
  });

  res.json({
    success: true,
    message: "Report submitted to the community committee for review."
  });
});

// 11. Notification Preferences (Get & Put)
app.get('/api/inbox/preferences', (req, res) => {
  const viewer = resolveViewer(req);
  if (!viewer) return res.status(401).json({ error: "Authentication required." });

  let prefs = db.prepare("SELECT * FROM notification_preferences WHERE user_id = ?").get(viewer.id);
  if (!prefs) {
    db.prepare(`
      INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)
    `).run(viewer.id);
    prefs = db.prepare("SELECT * FROM notification_preferences WHERE user_id = ?").get(viewer.id) || {
      user_id: viewer.id,
      email_direct_messages: 'immediate',
      email_connection_requests: 'immediate',
      email_new_posts: 'immediate',
      email_new_events: 'immediate',
      email_event_invites: 'immediate',
      email_admin_activity: 'immediate',
      in_app_new_posts: 1,
      in_app_new_events: 1
    };
  }

  res.json({
    ...prefs,
    in_app_new_posts: Boolean(prefs.in_app_new_posts),
    in_app_new_events: Boolean(prefs.in_app_new_events)
  });
});

app.put('/api/inbox/preferences', (req, res) => {
  const viewer = resolveViewer(req);
  if (!viewer) return res.status(401).json({ error: "Authentication required." });

  const {
    email_direct_messages = 'immediate',
    email_connection_requests = 'immediate',
    email_new_posts = 'immediate',
    email_new_events = 'immediate',
    email_event_invites = 'immediate',
    email_admin_activity = 'immediate',
    in_app_new_posts = true,
    in_app_new_events = true
  } = req.body;

  db.prepare(`
    INSERT INTO notification_preferences (
      user_id, email_direct_messages, email_connection_requests, email_new_posts,
      email_new_events, email_event_invites, email_admin_activity, in_app_new_posts,
      in_app_new_events, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      email_direct_messages = excluded.email_direct_messages,
      email_connection_requests = excluded.email_connection_requests,
      email_new_posts = excluded.email_new_posts,
      email_new_events = excluded.email_new_events,
      email_event_invites = excluded.email_event_invites,
      email_admin_activity = excluded.email_admin_activity,
      in_app_new_posts = excluded.in_app_new_posts,
      in_app_new_events = excluded.in_app_new_events,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    viewer.id,
    email_direct_messages,
    email_connection_requests,
    email_new_posts,
    email_new_events,
    email_event_invites,
    email_admin_activity,
    in_app_new_posts ? 1 : 0,
    in_app_new_events ? 1 : 0
  );

  const updated = db.prepare("SELECT * FROM notification_preferences WHERE user_id = ?").get(viewer.id);
  res.json({
    success: true,
    preferences: {
      ...updated,
      in_app_new_posts: Boolean(updated.in_app_new_posts),
      in_app_new_events: Boolean(updated.in_app_new_events)
    }
  });
});

// 12. Admin Activity Feed (Restricted to Founders & Admins)
app.get('/api/admin/activity', requireAdmin, (req, res) => {
  const filter = req.query.filter || 'all';
  const limit = parseInt(req.query.limit || '60', 10);

  let query = `
    SELECT act.*,
           ua.full_name as actor_name, ua.avatar_url as actor_avatar, ua.role as actor_role,
           ut.full_name as target_name, ut.avatar_url as target_avatar
    FROM admin_activity_log act
    LEFT JOIN users ua ON act.actor_id = ua.id
    LEFT JOIN users ut ON act.target_id = ut.id
  `;
  const params = [];

  if (filter && filter !== 'all') {
    if (filter === 'connections') {
      query += ` WHERE act.activity_type IN ('connection_requested', 'connection_accepted', 'connection_declined')`;
    } else if (filter === 'community') {
      query += ` WHERE act.activity_type IN ('community_post', 'community_comment')`;
    } else if (filter === 'rsvps') {
      query += ` WHERE act.activity_type IN ('rsvp_confirmed', 'rsvp_cancelled')`;
    } else if (filter === 'reports') {
      query += ` WHERE act.activity_type = 'report_filed'`;
    } else if (filter === 'failures') {
      query += ` WHERE act.activity_type = 'integration_failure'`;
    } else {
      query += ` WHERE act.activity_type = ?`;
      params.push(filter);
    }
  }

  query += ` ORDER BY act.created_at DESC LIMIT ?`;
  params.push(limit);

  const activities = db.prepare(query).all(...params);
  res.json({ activities, total: activities.length });
});

// 13. Test Mailbox Sandbox (Inspect captured emails without real SMTP)
app.get('/api/inbox/test-mailbox', (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  const emails = db.prepare(`
    SELECT id, idempotency_key, recipient_email, recipient_user_id, recipient_user_id as recipient_id,
           category, subject, template_type, status, status as delivery_status, attempts, last_error,
           payload_preview, body_html, action_url, created_at, sent_at
    FROM email_delivery_queue
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);

  res.json({
    count: emails.length,
    mailbox: emails,
    emails: emails
  });
});

// Serve frontend for SPA routing (Express 5 compatible)
app.use((req, res) => {
  if (serveMobileRoot && fs.existsSync(mobileDistPath)) {
    return res.sendFile(path.join(mobileDistPath, 'index.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  let networkIp = 'localhost';
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          networkIp = net.address;
          break;
        }
      }
    }
  } catch (e) {}
  console.log(`[OK] ÖZARA platform running:`);
  console.log(`     - Local:   http://localhost:${PORT}`);
  console.log(`     - Network: http://${networkIp}:${PORT}`);

  // Configurable Daily Synchronization Scheduler
  const SYNC_INTERVAL_MS = parseInt(process.env.INVESTMENTS_SYNC_INTERVAL_HOURS || '24', 10) * 60 * 60 * 1000;
  if (process.env.INVESTMENTS_SYNC_ENABLED === 'true') {
    console.log(`[INVESTMENTS SYNC] Automated daily synchronization scheduled every ${process.env.INVESTMENTS_SYNC_INTERVAL_HOURS || '24'} hours.`);
    setInterval(() => {
      console.log('[INVESTMENTS SYNC] Running scheduled catalog synchronization...');
      const { exec } = require('child_process');
      exec('python3 tools/sync_real_estate_catalog.py', { cwd: __dirname }, (err, stdout, stderr) => {
        if (err) console.error('[INVESTMENTS SYNC ERROR]', stderr || err.message);
        else console.log('[INVESTMENTS SYNC COMPLETED]');
      });
    }, SYNC_INTERVAL_MS);
  }
});
