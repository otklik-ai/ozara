const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Live Email Delivery Helper
function createTransporter() {
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

async function sendEmailNotification({ to, subject, html, text }) {
  const transporter = createTransporter();
  if (transporter) {
    try {
      const from = process.env.EMAIL_FROM || (process.env.GMAIL_USER ? `ÖZARA Club <${process.env.GMAIL_USER}>` : 'ÖZARA Club <membership@ozara.club>');
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
const dbFileName = fs.existsSync(path.join(__dirname, 'ozara.db')) ? 'ozara.db' : 'sila.db';
const dbPath = path.join(__dirname, dbFileName);
const db = new Database(dbPath);

// Enable WAL mode & foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
} catch (e) {
  console.warn('Error verifying phone column on users:', e.message);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
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

// Helper: Prohibited content patterns
const PROHIBITED_PATTERNS = [
  { regex: /\bguaranteed\b.{0,20}\breturn\b/i, message: "Guaranteed return promises are strictly prohibited." },
  { regex: /\brisk[- ]free\b.{0,20}\bprofit\b/i, message: "Risk-free profit claims are strictly prohibited." },
  { regex: /\bpre[- ]money valuation\b/i, message: "Pre-money valuation claims are prohibited in community text." },
  { regex: /\bvalued at \$\d+[\d,.]*(?:[kKmMbB]| million| billion)?\b/i, message: "Explicit company valuation claims are prohibited." },
  { regex: /\bminimum (?:investment|ticket|check)(?: size)? (?:of )?\$?[\d,]+/i, message: "Mandatory minimum check size statements are prohibited." },
  { regex: /\bannual(?:ized)? (?:roi|yield) (?:of )?\d+%/i, message: "Annualized yield promises are prohibited." }
];

function validateContent(text) {
  if (!text) return null;
  for (const rule of PROHIBITED_PATTERNS) {
    if (rule.regex.test(text)) {
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

// Configurable Admin Inboxes for Alexandra and Julia
function getAdminContactInboxes() {
  // 1. Explicit admin contact emails environment variable
  if (process.env.ADMIN_CONTACT_EMAILS && process.env.ADMIN_CONTACT_EMAILS.trim()) {
    const envEmails = process.env.ADMIN_CONTACT_EMAILS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (envEmails.length > 0) return envEmails;
  }

  // 2. Query configured admin / founder records from DB for Alexandra and Julia
  try {
    const adminRows = db.prepare(`
      SELECT email FROM users 
      WHERE (id IN ('usr_alexandra', 'usr_julia') 
         OR LOWER(full_name) LIKE '%alexandra%' 
         OR LOWER(full_name) LIKE '%julia%')
        AND email IS NOT NULL
    `).all();
    if (adminRows && adminRows.length > 0) {
      const dbEmails = Array.from(new Set(adminRows.map(r => r.email.toLowerCase())));
      if (dbEmails.length > 0) return dbEmails;
    }
  } catch (err) {
    console.error('[CONTACT INBOX] Error fetching admin inboxes from database:', err.message);
  }

  // 3. Fallback to FOUNDER_EMAILS env variable
  if (process.env.FOUNDER_EMAILS && process.env.FOUNDER_EMAILS.trim()) {
    const founderEmails = process.env.FOUNDER_EMAILS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (founderEmails.length > 0) return founderEmails;
  }

  // 4. Default canonical configured addresses for Alexandra and Julia
  return ['agniyahill@gmail.com', 'iuliiashchukinainvest@gmail.com'];
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

// Phone Auth Configuration
app.get('/api/auth/phone/config', (req, res) => {
  res.json({
    whatsapp_verification_enabled: Boolean(process.env.AUTH_WHATSAPP_ENABLED === 'true'),
    provider: process.env.AUTH_WHATSAPP_ENABLED === 'true' ? 'whatsapp' : (process.env.SMS_PROVIDER || 'local_sms')
  });
});

// Send Verification Code (Numeric 6-digit OTP)
app.post('/api/auth/phone/send-code', (req, res) => {
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
    const provider = isWhatsApp ? 'whatsapp' : (process.env.SMS_PROVIDER || 'sms');

    console.log(`\n======================================================`);
    console.log(`[PHONE AUTH CODE DISPATCH]`);
    console.log(`To Phone: ${cleanPhone}`);
    console.log(`Verification Code: ${code}`);
    console.log(`Expires: ${expiresAt} (10 minutes)`);
    console.log(`Provider: ${provider}`);
    console.log(`======================================================\n`);

    return res.json({
      success: true,
      message: isWhatsApp ? "Verification code sent via WhatsApp." : "Verification code sent via SMS.",
      provider,
      expires_in_seconds: 600,
      demoCode: process.env.NODE_ENV !== 'production' ? code : undefined
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

    if (record.code !== cleanCode) {
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

    // Look up if an approved member in users table already has this phone
    const existingUser = db.prepare(`
      SELECT id, email, full_name, headline, avatar_url, role, chapter_id, city, country, is_complete, is_admitted
      FROM users
      WHERE phone = ? AND is_admitted = 1
    `).get(cleanPhone);

    if (existingUser) {
      console.log(`[PHONE AUTH SUCCESS] Existing approved member logged in: ${existingUser.full_name} (${cleanPhone})`);
      return res.json({
        success: true,
        verified: true,
        is_existing_member: true,
        user: existingUser,
        phone: cleanPhone
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

// Canonical 30 Member Profile Questions
const CANONICAL_QUESTIONS = [
  { id: 1, prompt: "What is your primary professional focus today?" },
  { id: 2, prompt: "Which industries do you have deep operational experience in?" },
  { id: 3, prompt: "What are the core capabilities or expertise you can offer to peers?" },
  { id: 4, prompt: "What specific introductions, partnerships, or resources are you currently seeking?" },
  { id: 5, prompt: "What geographies or regional markets do you know best?" },
  { id: 6, prompt: "What major company, institution, or project are you most known for?" },
  { id: 7, prompt: "What is your current team size and corporate scale?" },
  { id: 8, prompt: "What are your preferred collaboration formats (advisory, co-investing, peer exchange)?" },
  { id: 9, prompt: "What is one counter-intuitive business insight you strongly believe?" },
  { id: 10, prompt: "Which key business books, thinkers, or frameworks shape your operating style?" },
  { id: 11, prompt: "What is your preferred method and time for high-value conversations?" },
  { id: 12, prompt: "What active side ventures, boards, or philanthropic initiatives do you support?" },
  { id: 13, prompt: "What personal hobbies, sports, or passions do you pursue outside work?" },
  { id: 14, prompt: "What universities, alumni networks, or executive programs are you affiliated with?" },
  { id: 15, prompt: "Which international cities do you visit most regularly throughout the year?" },
  { id: 16, prompt: "What is the biggest operational hurdle you solved in the past 24 months?" },
  { id: 17, prompt: "What technology or market trend do you believe is currently under-hyped?" },
  { id: 18, prompt: "What core priority or strategic milestone are you tackling over the next 12 months?" },
  { id: 19, prompt: "How do you prefer to evaluate new peer connections before committing time?" },
  { id: 20, prompt: "What is a trusted service provider category you often recommend to peers?" },
  { id: 21, prompt: "What was your most impactful cross-border transaction or expansion experience?" },
  { id: 22, prompt: "What is your philosophy on building and preserving long-term relationship capital?" },
  { id: 23, prompt: "Confidential founder notes: What personal inflection point or confidential challenge are you navigating?" },
  { id: 24, prompt: "What type of community events or gatherings do you find most valuable?" },
  { id: 25, prompt: "Are you open to speaking on panels, hosting salons, or mentoring rising founders?" },
  { id: 26, prompt: "What are your criteria for joining an advisory board or angel syndicate?" },
  { id: 27, prompt: "Which languages do you conduct business in fluently?" },
  { id: 28, prompt: "What media, podcasts, or publications do you read consistently?" },
  { id: 29, prompt: "What is your preferred communication channel for urgent peer requests?" },
  { id: 30, prompt: "What would make your ÖZARA membership exceptionally worthwhile this year?" }
];

app.get('/api/questions', (req, res) => {
  res.json(CANONICAL_QUESTIONS.map(q => ({
    id: q.id,
    prompt: q.prompt,
    is_required: q.id === 18,
    is_confidential: q.id === 23,
    default_visibility: q.id === 23 ? 'private' : 'shared'
  })));
});

app.get('/api/chapters', (req, res) => {
  const chapters = db.prepare('SELECT id, name, city, country FROM chapters ORDER BY name ASC').all();
  res.json(chapters);
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
app.get('/api/members', (req, res) => {
  const viewerId = req.query.viewerId || 'usr_elena';
  const query = (req.query.q || '').toLowerCase().trim();
  const today = new Date().toISOString().split('T')[0];

  // Retrieve all verified members
  const members = db.prepare(`
    SELECT u.id, u.full_name, u.headline, u.avatar_url, u.city, u.country, u.contact_preference, u.role, u.is_complete,
           c.name as chapter_name, c.id as chapter_id
    FROM users u
    LEFT JOIN chapters c ON u.chapter_id = c.id
    WHERE u.role = 'MEMBER'
  `).all();

  // Load taxonomies, active travel, and shared answers for each
  const result = members.map(m => {
    const taxonomies = db.prepare(`
      SELECT category, slug, label FROM taxonomies WHERE user_id = ?
    `).all(m.id);

    const activeTravel = db.prepare(`
      SELECT id, city, country, start_date, end_date, notes
      FROM travel_plans
      WHERE user_id = ? AND end_date >= ? AND visibility = 'shared'
      ORDER BY start_date ASC
    `).all(m.id, today);

    // Group taxonomies
    const taxMap = { roles: [], industries: [], expertise: [], offers: [], needs: [], interests: [], institutions: [] };
    taxonomies.forEach(t => {
      if (taxMap[t.category]) taxMap[t.category].push({ slug: t.slug, label: t.label });
    });

    return {
      ...m,
      taxonomies: taxMap,
      active_travel: activeTravel
    };
  });

  // Filter if query present
  const filtered = result.filter(m => {
    if (!query) return true;
    const matchName = m.full_name.toLowerCase().includes(query);
    const matchHead = m.headline.toLowerCase().includes(query);
    const matchCity = m.city.toLowerCase().includes(query) || (m.chapter_name && m.chapter_name.toLowerCase().includes(query));
    const matchTravel = m.active_travel.some(t => t.city.toLowerCase().includes(query));
    const matchTax = Object.values(m.taxonomies).flat().some(t => t.label.toLowerCase().includes(query));
    return matchName || matchHead || matchCity || matchTravel || matchTax;
  });

  res.json(filtered);
});

// Explainable recommendations for active viewer
app.get('/api/recommendations', (req, res) => {
  const viewerId = req.query.viewerId || 'usr_elena';
  const today = new Date().toISOString().split('T')[0];

  const viewer = db.prepare(`
    SELECT u.id, u.full_name, u.city, u.chapter_id, c.name as chapter_name
    FROM users u
    LEFT JOIN chapters c ON u.chapter_id = c.id
    WHERE u.id = ?
  `).get(viewerId);

  if (!viewer) return res.status(404).json({ error: "Viewer not found" });

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

    // Check candidate offers & expertise against viewer needs
    const candOffers = db.prepare(`
      SELECT slug, label FROM taxonomies WHERE user_id = ? AND category = 'offers'
    `).all(cand.id);

    const candExpertise = db.prepare(`
      SELECT slug, label FROM taxonomies WHERE user_id = ? AND category = 'expertise'
    `).all(cand.id);

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

    scoredRecommendations.push({
      ...cand,
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
// 3. MEMBER PROFILE & 30-QUESTION INTAKE
// -------------------------------------------------------------
app.get('/api/profile/:userId', (req, res) => {
  const targetId = req.params.userId;
  const viewerId = req.query.viewerId || targetId;
  const today = new Date().toISOString().split('T')[0];

  const user = db.prepare(`
    SELECT u.id, u.email, u.full_name, u.headline, u.avatar_url, u.city, u.state, u.country, u.industry, u.contact_preference,
           u.role, u.is_admitted, u.admitted_by, u.admitted_at, u.is_complete, c.name as chapter_name, c.id as chapter_id
    FROM users u
    LEFT JOIN chapters c ON u.chapter_id = c.id
    WHERE u.id = ?
  `).get(targetId);

  if (!user) return res.status(404).json({ error: "User not found" });

  const viewer = db.prepare("SELECT id, role FROM users WHERE id = ?").get(viewerId);
  const isFounder = viewer && (viewer.role === 'FOUNDER' || viewer.role === 'ADMIN');
  const isOwner = viewerId === targetId;

  // Retrieve questionnaire answers
  const answers = db.prepare(`
    SELECT question_id, prompt, answer_state, visibility, value_text
    FROM questionnaire_answers
    WHERE user_id = ?
    ORDER BY question_id ASC
  `).all(targetId);

  // Apply Privacy Filter & Question 23 Lock
  const sanitizedAnswers = answers.map(a => {
    if (a.question_id === 23) {
      // Permanent Lock: Visible solely to administrators (Elena, Alexandra, and Julia) or self
      if (isFounder || isOwner) {
        // If founder viewing another person's Q23, log immutable audit record
        if (isFounder && !isOwner) {
          const logId = 'audit_' + Math.random().toString(36).substring(2, 10);
          db.prepare(`
            INSERT INTO audit_logs (id, actor_id, action, target_member_id, question_id, ip_address, metadata_json)
            VALUES (?, ?, 'view_private_answer', ?, 23, '127.0.0.1', ?)
          `).run(logId, viewerId, targetId, JSON.stringify({ reason: "Founder profile review" }));
        }
        return { ...a, is_q23_founder_locked: true };
      } else {
        // Redacted for regular members
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
    is_complete: Boolean(user.is_complete),
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

  db.prepare(`
    INSERT INTO questionnaire_answers (user_id, question_id, prompt, answer_state, visibility, value_text, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, question_id) DO UPDATE SET
      answer_state = excluded.answer_state,
      visibility = excluded.visibility,
      value_text = excluded.value_text,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, questionId, prompt, answerState, finalVisibility, valueText || '');

  // Question 18 Mandate: Check if Question 18 is answered to update profile is_complete flag
  const q18 = db.prepare(`
    SELECT answer_state FROM questionnaire_answers WHERE user_id = ? AND question_id = 18
  `).get(userId);

  const isComplete = (q18 && q18.answer_state === 'answered') ? 1 : 0;
  db.prepare("UPDATE users SET is_complete = ? WHERE id = ?").run(isComplete, userId);

  res.json({ success: true, is_complete: Boolean(isComplete) });
}

app.post('/api/intake/answer', handleSaveAnswer);
app.post('/api/profile/:id/answer', handleSaveAnswer);
app.post('/api/profile/:id/answers/:questionId', handleSaveAnswer);

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
      const val = (item.value || item.valueText || '').trim();
      const promptObj = CANONICAL_QUESTIONS.find(q => q.id === qId);
      const prompt = promptObj ? promptObj.prompt : `Question ${qId}`;
      const vis = (qId === 23) ? 'private' : (item.visibility || 'shared');
      const state = val ? 'answered' : 'unanswered';
      insertStmt.run(userId, qId, prompt, state, vis, val);
    }
  });

  saveMany(answers);

  const q18 = db.prepare(`
    SELECT answer_state FROM questionnaire_answers WHERE user_id = ? AND question_id = 18
  `).get(userId);

  const isComplete = (q18 && q18.answer_state === 'answered') ? 1 : 0;
  db.prepare("UPDATE users SET is_complete = ? WHERE id = ?").run(isComplete, userId);

  res.json({ success: true, count: answers.length, is_complete: Boolean(isComplete) });
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
  const userId = req.query.userId;
  const events = db.prepare(`
    SELECT e.*, c.name as chapter_name, c.city as chapter_city,
           (SELECT count(*) FROM event_registrations er WHERE er.event_id = e.id AND er.status = 'registered') as actual_registered,
           (SELECT status FROM event_registrations er WHERE er.event_id = e.id AND er.user_id = ?) as user_rsvp
    FROM events e
    LEFT JOIN chapters c ON e.chapter_id = c.id
    WHERE e.is_published = 1
    ORDER BY e.start_time ASC
  `).all(userId || '');

  // For each event, get registered attendee avatars
  const result = events.map(evt => {
    const attendees = db.prepare(`
      SELECT u.id, u.full_name, u.avatar_url, u.headline
      FROM event_registrations er
      JOIN users u ON er.user_id = u.id
      WHERE er.event_id = ? AND er.status = 'registered'
    `).all(evt.id);
    return { ...evt, attendees };
  });

  res.json(result);
});

app.post('/api/events/rsvp', (req, res) => {
  const { eventId, userId, status } = req.body;
  if (status === 'cancelled') {
    db.prepare("DELETE FROM event_registrations WHERE event_id = ? AND user_id = ?").run(eventId, userId);
  } else {
    db.prepare(`
      INSERT INTO event_registrations (event_id, user_id, status)
      VALUES (?, ?, ?)
      ON CONFLICT(event_id, user_id) DO UPDATE SET status = excluded.status
    `).run(eventId, userId, status);
  }
  res.json({ success: true });
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

// Member Registration endpoint with token claim and conditions tracking
app.post('/api/register', (req, res) => {
  const { full_name, email, headline, avatar_url, country, state, city, industry, chapter_id, accepted_conditions_version, token } = req.body;
  if (!full_name || !email) {
    return res.status(400).json({ error: "Full name and email are required." });
  }
  const cleanEmail = email.trim().toLowerCase();

  // If token is provided, validate and claim it
  if (token) {
    const invite = db.prepare("SELECT * FROM invitation_tokens WHERE UPPER(token) = UPPER(?) OR token = ?").get(token.trim(), token.trim());
    if (invite) {
      if (invite.email.toLowerCase() !== cleanEmail) {
        return res.status(400).json({ error: `Invitation token is bound to ${invite.email}, not ${cleanEmail}.` });
      }
      db.prepare(`
        UPDATE invitation_tokens
        SET is_claimed = 1, status = 'claimed', claimed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(invite.id);
    }
  }

  const defaultAvatar = '/avatars/elena_ermolov.jpg';
  const finalAvatar = (avatar_url && avatar_url.trim()) ? avatar_url.trim() : defaultAvatar;
  const finalCountry = country || 'United Arab Emirates';
  const finalState = state || 'Dubai';
  const finalCity = city || 'Dubai';
  const finalIndustry = industry || 'Financial Services & FinTech';

  // If user with this email already exists, update their details
  const existingUser = db.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(cleanEmail);
  if (existingUser) {
    db.prepare(`
      UPDATE users 
      SET full_name = ?, headline = ?, avatar_url = ?, country = ?, state = ?, city = ?, industry = ?, chapter_id = ?
      WHERE id = ?
    `).run(full_name, headline || existingUser.headline, finalAvatar, finalCountry, finalState, finalCity, finalIndustry, chapter_id || existingUser.chapter_id, existingUser.id);
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(existingUser.id);
    return res.json({ success: true, user: updated });
  }

  const newId = 'usr_' + Date.now().toString(36);
  const now = new Date().toISOString();
  const conditionsVersion = accepted_conditions_version || CURRENT_ACCESS_CONDITIONS_VERSION;
  try {
    db.prepare(`
      INSERT INTO users (id, email, full_name, headline, avatar_url, chapter_id, city, state, country, industry, contact_preference, role, is_admitted, admitted_by, is_complete, accepted_access_conditions_version, accepted_access_conditions_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'direct_contact', 'MEMBER', 1, 'Invitation-Token-Verified', 0, ?, ?)
    `).run(newId, cleanEmail, full_name, headline || 'New Member', finalAvatar, chapter_id || 'ch_dubai', finalCity, finalState, finalCountry, finalIndustry, conditionsVersion, now);

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
    res.json({ success: true, user: created });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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
    return res.status(400).json({ success: false, message: "Token is required." });
  }

  const cleanToken = token.trim();
  const invite = db.prepare(`
    SELECT * FROM invitation_tokens
    WHERE UPPER(token) = UPPER(?) OR token = ?
  `).get(cleanToken, cleanToken);

  if (!invite) {
    return res.status(404).json({ success: false, message: "Invalid invitation code. Please check the code or request access." });
  }

  if (invite.status === 'pending_admin_approval') {
    return res.status(403).json({ success: false, message: "This access request is currently awaiting leadership approval by Elena Ermolov." });
  }

  if (invite.status === 'revoked') {
    return res.status(403).json({ success: false, message: "This invitation token has been revoked." });
  }

  if (invite.is_claimed === 1 || invite.status === 'claimed') {
    return res.status(400).json({ success: false, message: "This invitation token has already been claimed." });
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return res.status(400).json({ success: false, message: "This invitation token has expired." });
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

// Request access (Uninvited prospective members)
app.post('/api/invitations/request-access', (req, res) => {
  const { email, fullName, role, notes } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ success: false, message: "Business email is required." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = (fullName || '').trim();
  const cleanRole = (role || '').trim();
  const cleanNotes = (notes || '').trim();

  // Check if already registered
  const existingUser = db.prepare("SELECT id, full_name FROM users WHERE LOWER(email) = ?").get(cleanEmail);
  if (existingUser) {
    return res.status(400).json({ success: false, message: "An account with this email address already exists. Please sign in." });
  }

  // Check if an invitation/request already exists for this 1:1 email
  const existingInvite = db.prepare("SELECT * FROM invitation_tokens WHERE LOWER(email) = ?").get(cleanEmail);
  let id;
  if (existingInvite) {
    if (existingInvite.status === 'approved' && !existingInvite.is_claimed) {
      return res.json({
        success: true,
        status: 'approved',
        token: existingInvite.token,
        email: existingInvite.email,
        message: "You already have an approved invitation token: " + existingInvite.token
      });
    }
    if (existingInvite.is_claimed === 1 || existingInvite.status === 'claimed') {
      return res.status(400).json({ success: false, message: "This email has already completed registration." });
    }
    // If pending, update metadata and resend emails
    id = existingInvite.id;
    db.prepare(`
      UPDATE invitation_tokens
      SET full_name = COALESCE(NULLIF(?, ''), full_name),
          role_or_headline = COALESCE(NULLIF(?, ''), role_or_headline),
          notes = COALESCE(NULLIF(?, ''), notes)
      WHERE id = ?
    `).run(cleanName, cleanRole, cleanNotes, id);
  } else {
    id = 'req_acc_' + Math.random().toString(36).substring(2, 9);
    const tempToken = 'PENDING-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO invitation_tokens (id, email, token, full_name, role_or_headline, notes, status, created_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending_admin_approval', 'self_applicant', ?)
    `).run(id, cleanEmail, tempToken, cleanName, cleanRole, cleanNotes, expiresAt);
  }

  console.log(`\n======================================================`);
  console.log(`[EMAIL DISPATCH TO ADMINS]`);
  console.log(`To: ermolov.elena@gmail.com, agniyahill@gmail.com, iuliiashchukinainvest@gmail.com`);
  console.log(`Subject: [ÖZARA Access Request] New application from ${cleanName || 'Candidate'} (${cleanEmail})`);
  console.log(`Role: ${cleanRole || 'Not specified'}`);
  console.log(`Notes: ${cleanNotes || 'None'}`);
  console.log(`Action: Review and approve in Admin Console or via /api/admin/invitations/approve`);
  console.log(`======================================================\n`);

  const magicApprovalUrl = `http://localhost:3000/api/admin/invitations/magic-approve?requestId=${id}&adminEmail=ermolov.elena@gmail.com`;

  // 1. Send Admin Notification to Elena Ermolov
  sendEmailNotification({
    to: 'ermolov.elena@gmail.com',
    subject: `[ÖZARA Access Request] New application from ${cleanName || 'Candidate'} (${cleanEmail})`,
    text: `New membership application received for ÖZARA.\n\nApplicant: ${cleanName}\nEmail: ${cleanEmail}\nRole: ${cleanRole}\nNotes: ${cleanNotes}\n\nTo approve this applicant and issue their 1:1 invitation token, click:\n${magicApprovalUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #0b1020; color: #ffffff; padding: 28px; border-radius: 12px; max-width: 520px;">
        <h2 style="color: #ffffff; letter-spacing: 3px; margin-top: 0;">ÖZARA MEMBERSHIP COMMITTEE</h2>
        <p style="color: #94a3b8; font-size: 14px;">A new applicant has requested access to the private network.</p>
        <div style="background: #111827; padding: 18px; border-radius: 8px; margin: 18px 0; border: 1px solid #1e293b;">
          <p style="margin: 6px 0; font-size: 14px;"><strong>Applicant:</strong> ${cleanName || 'Not specified'}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Business Email:</strong> <span style="color: #38bdf8;">${cleanEmail}</span></p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Role / Headline:</strong> ${cleanRole || 'Not specified'}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Notes:</strong> ${cleanNotes || 'None'}</p>
        </div>
        <div style="margin-top: 24px;">
          <a href="${magicApprovalUrl}" style="display: inline-block; background: #10b981; color: #ffffff; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 28px; font-size: 14px;">
            ✓ Approve Request & Issue Token
          </a>
        </div>
        <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Direct link: ${magicApprovalUrl}</p>
      </div>
    `
  }).catch(() => {});

  // 2. Send Applicant Confirmation to cleanEmail
  sendEmailNotification({
    to: cleanEmail,
    subject: `[ÖZARA] Access Request Received`,
    text: `Dear ${cleanName || 'Applicant'},\n\nWe have received your application for membership in ÖZARA.\n\nYour application has been routed to our membership committee (Elena Ermolov). Once approved, you will receive an invitation token with instructions to complete your registration.\n\nYou can return to the app at http://localhost:8081 at any time to enter your token once received.\n\nWarm regards,\nÖZARA Membership Committee`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #0b1020; color: #ffffff; padding: 28px; border-radius: 12px; max-width: 520px;">
        <h2 style="color: #ffffff; letter-spacing: 3px; margin-top: 0;">ÖZARA PRIVATE CLUB</h2>
        <p style="color: #38bdf8; font-weight: bold; font-size: 15px;">Application Received</p>
        <p style="color: #94a3b8; font-size: 14px;">Dear ${cleanName || 'Applicant'},</p>
        <p style="color: #e2e8f0; font-size: 14px; line-height: 1.6;">
          Your request for access to ÖZARA has been successfully submitted and routed to our membership committee (Elena Ermolov).
        </p>
        <div style="background: #111827; padding: 18px; border-radius: 8px; margin: 18px 0; border: 1px solid #1e293b;">
          <p style="margin: 6px 0; font-size: 13px; color: #94a3b8;"><strong>Submitted Email:</strong> <span style="color: #ffffff;">${cleanEmail}</span></p>
          <p style="margin: 6px 0; font-size: 13px; color: #94a3b8;"><strong>Status:</strong> <span style="color: #fbbf24;">Pending Committee Review</span></p>
        </div>
        <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
          Once your application is approved, you will receive your unique 1:1 invitation token by email to complete your registration.
        </p>
        <p style="color: #64748b; font-size: 12px; margin-top: 24px;">ÖZARA • Private Network for Vetted Founders & Leaders</p>
      </div>
    `
  }).catch(() => {});

  res.json({
    success: true,
    status: 'pending',
    id,
    email: cleanEmail,
    adminNotificationRecipient: 'ermolov.elena@gmail.com',
    message: "Access request successfully submitted to ÖZARA leadership (ermolov.elena@gmail.com). You will receive your invitation token once reviewed."
  });
});

// Admin approval of access request -> generates official token & notifies applicant
// Core Access Approval Execution Logic
function executeAccessApproval({ requestId, email, approvedBy }) {
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
    'agniyahill@gmail.com',
    'iuliiashchukinainvest@gmail.com',
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

  // If already approved, return current token
  if (record.status === 'approved' && record.token && !record.token.startsWith('PENDING-')) {
    return {
      success: true,
      alreadyApproved: true,
      record,
      token: record.token,
      approverEmail: record.approved_by || cleanApprover
    };
  }

  // Generate elegant official ÖZARA token (e.g. OZARA-4819-2041)
  const officialToken = 'OZARA-' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000);
  const approverEmail = adminUser ? adminUser.email : cleanApprover;
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    UPDATE invitation_tokens
    SET token = ?, status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP, expires_at = ?
    WHERE id = ?
  `).run(officialToken, approverEmail, expiresAt, record.id);

  // Log to immutable audit log
  const logId = 'audit_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_member_id, question_id, ip_address, metadata_json)
    VALUES (?, ?, 'approve_access_request', ?, NULL, '127.0.0.1', ?)
  `).run(logId, adminUser ? adminUser.id : approverEmail, record.id, JSON.stringify({ 
    applicant_email: record.email, 
    token: officialToken,
    approved_by: approverEmail 
  }));

  console.log(`\n======================================================`);
  console.log(`[EMAIL DISPATCH TO APPLICANT]`);
  console.log(`To: ${record.email}`);
  console.log(`From: ermolov.elena@gmail.com (ÖZARA Membership Committee)`);
  console.log(`Subject: Your ÖZARA Membership Invitation Token: ${officialToken}`);
  console.log(`Body: Dear ${record.full_name || 'Member'}, your request for ÖZARA membership has been approved by Elena Ermolov.`);
  console.log(`Your invitation token is: ${officialToken}`);
  console.log(`Open the ÖZARA mobile app and insert this token to complete your registration.`);
  console.log(`======================================================\n`);

  sendEmailNotification({
    to: record.email,
    subject: `Your ÖZARA Membership Invitation Token: ${officialToken}`,
    text: `Dear ${record.full_name || 'Member'},\n\nYour request for ÖZARA membership has been approved by Elena Ermolov.\n\nYour unique 1:1 invitation token is: ${officialToken}\n\nOpen the ÖZARA app and insert this token to complete your registration.`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #0b1020; color: #ffffff; padding: 28px; border-radius: 12px; max-width: 520px;">
        <h2 style="color: #ffffff; letter-spacing: 3px; margin-top: 0;">ÖZARA PRIVATE CLUB</h2>
        <p style="color: #10b981; font-weight: bold; font-size: 16px;">You've been invited!</p>
        <p style="color: #94a3b8; font-size: 14px;">Dear ${record.full_name || 'Member'}, your request for ÖZARA membership has been approved by Elena Ermolov.</p>
        <div style="background: #111827; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1.5px solid #7c3aed; text-align: center;">
          <p style="color: #a78bfa; font-size: 11px; margin: 0 0 8px 0; letter-spacing: 2px; font-weight: bold;">YOUR 1:1 INVITATION TOKEN</p>
          <p style="font-size: 26px; font-weight: 900; margin: 0; color: #ffffff; letter-spacing: 4px;">${officialToken}</p>
        </div>
        <p style="color: #94a3b8; font-size: 13px;">Open the ÖZARA mobile app at http://localhost:8081 and insert this code to activate your profile.</p>
      </div>
    `
  }).catch(() => {});

  return {
    success: true,
    status: 'approved',
    email: record.email,
    record,
    token: officialToken,
    approverEmail,
    emailDispatched: true
  };
}

// Admin approval of access request -> generates official token & notifies applicant
app.post('/api/admin/invitations/approve', (req, res) => {
  const { requestId, email, approvedBy } = req.body;
  const result = executeAccessApproval({ requestId, email, approvedBy });
  if (!result.success) {
    return res.status(result.status || 400).json(result);
  }
  return res.json(result);
});

// One-Click Magic Approval Link (from Elena's notification email or browser tab)
app.get('/api/admin/invitations/magic-approve', (req, res) => {
  const { requestId, adminEmail } = req.query;
  const approver = adminEmail || 'ermolov.elena@gmail.com';
  const result = executeAccessApproval({ requestId, approvedBy: approver });

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
          <a href="http://localhost:8081" style="color: #a78bfa; text-decoration: none; font-size: 14px;">← Return to App</a>
        </div>
      </body>
      </html>
    `);
  }

  const record = result.record;
  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>ÖZARA — Membership Approved</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="background: #060913; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box;">
      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; max-width: 520px; width: 100%; padding: 40px 32px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
        
        <div style="width: 64px; height: 64px; border-radius: 32px; background: rgba(16, 185, 129, 0.12); border: 1.5px solid #10b981; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
          <span style="font-size: 32px; color: #10b981; line-height: 1;">✓</span>
        </div>

        <div style="font-size: 11px; letter-spacing: 3px; color: #8b5cf6; font-weight: 800; text-transform: uppercase; margin-bottom: 8px;">
          ÖZARA MEMBERSHIP COMMITTEE
        </div>

        <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 12px 0; color: #ffffff;">
          ${result.alreadyApproved ? 'Access Already Approved' : 'Applicant Approved'}
        </h1>

        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 24px 0; line-height: 1.5;">
          Elena Ermolov has approved private network access for this applicant.
        </p>
        
        <div style="background: #111827; border-radius: 12px; padding: 18px 20px; text-align: left; margin-bottom: 24px; border: 1px solid #1e293b;">
          <div style="margin-bottom: 8px; font-size: 14px; color: #94a3b8;">
            Candidate: <strong style="color: #ffffff;">${record.full_name || 'Member'}</strong>
          </div>
          <div style="margin-bottom: 8px; font-size: 14px; color: #94a3b8;">
            Email: <strong style="color: #38bdf8;">${record.email}</strong>
          </div>
          <div style="font-size: 14px; color: #94a3b8;">
            Role: <span style="color: #e2e8f0;">${record.role_or_headline || 'Not specified'}</span>
          </div>
        </div>

        <div style="background: #17112c; border: 1.5px solid #7c3aed; border-radius: 14px; padding: 22px 16px; margin-bottom: 24px;">
          <div style="font-size: 11px; letter-spacing: 2.5px; color: #c4b5fd; font-weight: 700; margin-bottom: 8px; text-transform: uppercase;">
            BOUND 1:1 INVITATION TOKEN
          </div>
          <div style="font-size: 28px; font-weight: 900; letter-spacing: 3px; color: #ffffff;">
            ${result.token}
          </div>
        </div>

        <p style="color: #10b981; font-size: 13px; font-weight: 600; line-height: 1.5; margin: 0 0 28px 0;">
          ✓ Applicant's app screen has automatically updated in real-time.
        </p>

        <a href="http://localhost:8081" style="display: inline-block; background: #7c3aed; color: #ffffff; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 28px; font-size: 14px; letter-spacing: 0.5px; box-shadow: 0 10px 15px -3px rgba(124, 58, 237, 0.4);">
          Open ÖZARA App →
        </a>
      </div>
    </body>
    </html>
  `);
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

// List all access requests for Admin/Founder console
app.get('/api/admin/access-requests', (req, res) => {
  const requests = db.prepare(`
    SELECT * FROM invitation_tokens
    ORDER BY created_at DESC
  `).all();
  res.json(requests);
});

// Invitation tokens listing
app.get('/api/admin/invitations', (req, res) => {
  const invites = db.prepare(`
    SELECT it.*, u.full_name as creator_name
    FROM invitation_tokens it
    LEFT JOIN users u ON it.created_by = u.id
    ORDER BY it.created_at DESC
  `).all();
  res.json(invites);
});

app.post('/api/admin/invitations/create', (req, res) => {
  const { email, createdBy, fullName, role } = req.body;
  const token = 'OZARA-' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000);
  const id = 'inv_' + Math.random().toString(36).substring(2, 8);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO invitation_tokens (id, email, token, created_by, expires_at, full_name, role_or_headline, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')
  `).run(id, email.trim().toLowerCase(), token, createdBy || 'admin', expiresAt, fullName || null, role || null);

  res.json({ success: true, token, id, email: email.trim().toLowerCase() });
});

// Serve frontend for SPA routing (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[OK] ÖZARA platform running at http://localhost:${PORT}`);
});
