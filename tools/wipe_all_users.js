const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function wipeDatabase(dbPath) {
  if (!fs.existsSync(dbPath)) {
    console.log(`Database ${dbPath} not found, skipping.`);
    return;
  }
  console.log(`[WIPE] Cleaning all users and user-related records from ${dbPath}...`);
  const db = new Database(dbPath);
  db.pragma('foreign_keys = OFF');

  // 1. Remove foreign key on community_posts if present
  const postTable = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'community_posts'").get();
  if (postTable && postTable.sql.includes('REFERENCES users')) {
    console.log('[WIPE] Migrating community_posts to unbind from users foreign key...');
    db.exec(`
      CREATE TABLE community_posts_new (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL,
        topic TEXT,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        source_type TEXT DEFAULT 'member',
        author_label TEXT,
        is_official INTEGER DEFAULT 0,
        telegram_channel_id TEXT,
        telegram_message_id INTEGER,
        media_group_id TEXT,
        original_content TEXT,
        original_language TEXT,
        translated INTEGER DEFAULT 0,
        admin_corrected INTEGER DEFAULT 0,
        source_modified_after_admin_edit INTEGER DEFAULT 0,
        status TEXT DEFAULT 'published',
        telegram_author_id TEXT,
        telegram_author_name TEXT
      );
      INSERT INTO community_posts_new SELECT * FROM community_posts;
      DROP TABLE community_posts;
      ALTER TABLE community_posts_new RENAME TO community_posts;
      CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);
    `);
  }

  // 2. Wipe user tables and user-dependent tables
  const userRelatedTables = [
    'questionnaire_answers',
    'taxonomies',
    'taxonomy_notes',
    'travel_plans',
    'call_bookings',
    'intro_requests',
    'event_registrations',
    'event_invitations',
    'listing_inquiries',
    'quarterly_pulses',
    'chapter_lead_messages',
    'profile_reports',
    'saved_listings',
    'community_comments',
    'user_sessions',
    'in_app_notifications',
    'conversations',
    'direct_messages',
    'user_blocks',
    'notification_preferences',
    'email_delivery_queue',
    'member_connections',
    'contact_unlocks',
    'invitation_tokens',
    'phone_verifications',
    'users'
  ];

  for (const tbl of userRelatedTables) {
    try {
      const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(tbl);
      if (exists) {
        const res = db.prepare(`DELETE FROM ${tbl}`).run();
        console.log(`[WIPE] Cleared ${tbl}: ${res.changes} rows deleted.`);
      }
    } catch (err) {
      console.warn(`[WIPE] Could not clear table ${tbl}:`, err.message);
    }
  }

  // 3. Reset event registration counts
  try {
    db.exec(`UPDATE events SET registration_count = 0, registered_count = 0;`);
    console.log('[WIPE] Reset events registration counts to 0.');
  } catch (err) {
    console.warn('[WIPE] Could not reset event counts:', err.message);
  }

  db.pragma('foreign_keys = ON');

  // Verify counts
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const postCount = db.prepare('SELECT COUNT(*) as count FROM community_posts').get().count;
  const mediaCount = db.prepare('SELECT COUNT(*) as count FROM community_post_media').get().count;
  const eventCount = db.prepare('SELECT COUNT(*) as count FROM events').get().count;
  console.log(`[WIPE RESULT for ${dbPath}]:`);
  console.log(`  Users: ${userCount} (Target: 0)`);
  console.log(`  Community Posts: ${postCount} (Preserved)`);
  console.log(`  Community Media: ${mediaCount} (Preserved)`);
  console.log(`  Events: ${eventCount} (Preserved)`);

  db.close();
}

wipeDatabase(path.join(__dirname, '..', 'ozara.db'));
wipeDatabase(path.join(__dirname, '..', 'sila.db'));
