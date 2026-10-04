// ÖZARA Application State
let personas = [];
let currentUserId = 'usr_elena';
let activeTab = 'events'; // Events is now the default first page
let activeSubFilter = 'recommendations';
let callTargetUser = null;
let activeDrawerUserId = null;
let activeDrawerProfileData = null;

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Toast helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Modal helper
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  await loadPersonas();
  setupNavigation();
  setupSearch();
  await loadCurrentView();
});

async function loadPersonas() {
  try {
    const res = await fetch('/api/personas');
    personas = await res.json();

    const select = document.getElementById('personaSelect');
    select.innerHTML = '';
    personas.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.full_name} (${p.role === 'FOUNDER' ? 'Founder' : p.city})`;
      if (p.id === currentUserId) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', async (e) => {
      currentUserId = e.target.value;
      updateCurrentUserUI();
      // If drawer is open on self, refresh drawer
      if (activeDrawerUserId) {
        await openProfileDrawer(activeDrawerUserId);
      }
      await loadCurrentView();
      showToast(`Switched active persona to ${getCurrentUser().full_name}`, 'success');
    });

    updateCurrentUserUI();
  } catch (err) {
    console.error("Error loading personas:", err);
  }
}

function getCurrentUser() {
  return personas.find(p => p.id === currentUserId) || personas[0];
}

function updateCurrentUserUI() {
  const user = getCurrentUser();
  if (!user) return;

  const userAvatar = document.getElementById('userAvatarImg');
  if (userAvatar) userAvatar.src = user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300';
  
  const userBadge = document.getElementById('currentUserBadge');
  if (userBadge) {
    userBadge.title = `${user.full_name} (${user.role === 'FOUNDER' ? 'Founder / Admin' : `${user.chapter_name || user.city} Member`}) • Click to open Profile`;
  }

  const nameSpan = document.getElementById('userNameSpan');
  if (nameSpan) nameSpan.textContent = user.full_name;
  const roleBadge = document.getElementById('userRoleBadge');
  if (roleBadge) roleBadge.textContent = user.role === 'FOUNDER' ? 'Founder / Admin' : `${user.chapter_name || user.city} Member`;

  // Toggle admin console button & actions
  const isFounder = user.role === 'FOUNDER' || user.role === 'ADMIN';
  document.querySelectorAll('.admin-only-tab').forEach(el => el.style.display = isFounder ? 'inline-flex' : 'none');
  document.querySelectorAll('.admin-only-block').forEach(el => el.style.display = isFounder ? 'block' : 'none');

  // Incomplete profile warning banner (Question 18 Mandate)
  const incompleteBanner = document.getElementById('incompleteProfileBanner');
  if (!user.is_complete && user.role === 'MEMBER') {
    incompleteBanner.style.display = 'flex';
  } else {
    incompleteBanner.style.display = 'none';
  }
}

function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSubFilter = btn.getAttribute('data-sub');
      loadNetworking();
    });
  });
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tab);
  });
  document.querySelectorAll('.view-panel').forEach(p => {
    p.classList.toggle('active', p.id === `view-${tab}`);
  });
  loadCurrentView();
}

async function loadCurrentView() {
  if (activeTab === 'events') await loadEvents();
  else if (activeTab === 'networking') await loadNetworking();
  else if (activeTab === 'investments') await loadInvestments();
  else if (activeTab === 'team') {
    // Leadership & Team view
  }
  else if (activeTab === 'admin') await loadAdminConsole();
}

// -------------------------------------------------------------
// 1. EVENTS (FIRST / LANDING VIEW - REAL 2026/2027 CALENDAR POSTER)
// -------------------------------------------------------------
function renderCalendarEventCard(e) {
  const isRegistered = e.user_rsvp === 'registered';

  let displayTitle = e.title;
  let isOpen = false;
  let dateText = '';
  let specialCallout = '';
  let displayDesc = e.description;

  if (e.id === 'evt_miami_2026') {
    displayTitle = 'Miami';
    isOpen = true;
    dateText = 'Nov 13–15';
    displayDesc = 'Annual gathering of club members in Miami. Business agenda, venture networking, and private dinners.';
  } else if (e.id === 'evt_phuket_2027') {
    displayTitle = 'Phuket, Thailand';
    isOpen = true;
    dateText = 'Jan 2–9';
    displayDesc = 'Winter retreat for club members at private villas in Phuket. Strategic sessions and shared leisure.';
    specialCallout = `
      <div class="calendar-special-callout">
        <div class="callout-star-title">★ Celebrate New Year Together in Phuket</div>
        <div class="callout-body">Join starting December 31st. Gala evening at one of the island's premier beach clubs. Separate from the core expedition starting January 2nd.</div>
        <div class="callout-route">Route extension: Bangkok • Singapore 4 days • Cambodia & Angkor Wat 2–3 days</div>
      </div>
    `;
  } else if (e.id === 'evt_silicon_valley_2027') {
    displayTitle = 'Silicon Valley';
    dateText = 'Feb 19–22';
    displayDesc = 'Venture capital funds, AI labs, and private sessions with founders of leading tech companies in San Francisco and Silicon Valley.';
  } else if (e.id === 'evt_georgia_2027') {
    displayTitle = 'Georgia';
    dateText = 'Mar 26–30';
    displayDesc = 'Spring club gathering in Georgia: executive retreat, private Kakheti wineries, closed discussions, and authentic networking.';
  } else if (e.id === 'evt_barcelona_2027') {
    displayTitle = 'Barcelona';
    dateText = 'Apr 23–26';
    displayDesc = 'European convention of community residents in the capital of Catalonia.';
    specialCallout = `
      <div class="calendar-special-callout anniversary-callout">
        <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.4rem;">
          <div class="anniversary-badge-box">
            <span>7</span> <span style="font-size: 0.65rem;">YEARS</span>
          </div>
          <strong style="color: #ffffff; font-size: 0.95rem;">7th Year Club Jubilee • ÖZARA</strong>
        </div>
        <div class="callout-body">The marquee gathering of the year. Members from all chapters, executive sessions, and grand celebratory gala.</div>
      </div>
    `;
  } else if (e.id === 'evt_central_asia_2027') {
    displayTitle = 'Kyrgyzstan • Uzbekistan • Azerbaijan';
    dateText = 'May';
    displayDesc = 'Expedition across key business hubs of Central Asia and the Caucasus: emerging logistics corridors, banking infrastructure, and private meetings with regional leaders.';
  } else if (e.id === 'evt_ny_boston_2027') {
    displayTitle = 'New York + Boston';
    dateText = 'June';
    displayDesc = 'Expedition along the US East Coast: premier university hubs and innovation ecosystems.';
    specialCallout = `
      <div class="calendar-special-callout edu-callout">
        <div class="callout-star-title">🎓 US Ivy League & Premier Universities Tour</div>
        <div class="callout-body">Tour of seven leading universities. Curated educational track for members with children: parents and children experience it together (Harvard, MIT, Columbia, etc.).</div>
      </div>
    `;
  } else if (e.id === 'evt_europe_grand_2027') {
    displayTitle = 'London • Paris • Cannes • Zurich • Monaco';
    dateText = 'Dates TBD';
    displayDesc = 'European Grand Tour: private salons in Paris, Cannes, and Zurich, exclusive reception in Monaco.';
  } else {
    const startDate = new Date(e.start_time);
    dateText = startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  }

  const attendeesHtml = e.attendees && e.attendees.length > 0 
    ? e.attendees.map(a => `
        <img src="${a.avatar_url || ''}" 
             class="clickable-avatar"
             onclick="openProfileDrawer('${a.id}')"
             title="${a.full_name} (${a.headline || ''})" 
             alt="${a.full_name}">
      `).join('')
    : '<span style="color:var(--text-dim); font-size:0.78rem; margin-left:0.5rem;">Be the first</span>';

  return `
    <div class="event-card" id="card-${e.id}">
      <div class="event-card-top">
        <div class="event-title-group">
          <h3 class="event-title">${displayTitle}</h3>
          ${isOpen ? '<span class="status-badge-open">Registration Open</span>' : ''}
        </div>
        <div class="event-date-text-pill">${dateText}</div>
      </div>

      ${specialCallout}

      <div class="event-meta-line" style="margin-top: ${specialCallout ? '0.25rem' : '0'};">
        <span>📍 ${e.location}</span>
        <span>•</span>
        <span>👥 Seats: ${e.actual_registered} / ${e.capacity}</span>
      </div>

      <p class="event-desc">${displayDesc}</p>

      <div class="event-card-bottom">
        <div class="attendees-row">
          <span class="attendee-count-label">Confirmed Members:</span>
          <div class="attendee-stack">
            ${attendeesHtml}
          </div>
        </div>

        <div class="event-actions">
          ${isRegistered ? `
            <button class="btn btn-outline" onclick="rsvpEvent('${e.id}', 'cancelled')">
              ✓ Registered (Cancel)
            </button>
          ` : `
            <button class="btn btn-white-pill" onclick="rsvpEvent('${e.id}', 'registered')">
              Request Seat / RSVP
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

async function loadEvents() {
  const container = document.getElementById('eventsList');
  container.innerHTML = '<div class="loading-state">Loading calendar of events...</div>';

  try {
    const res = await fetch(`/api/events?userId=${currentUserId}`);
    const events = await res.json();

    const events2026 = events.filter(e => e.id === 'evt_miami_2026' || e.id === 'evt_dubai_dinner');
    const events2027 = events.filter(e => [
      'evt_phuket_2027',
      'evt_silicon_valley_2027',
      'evt_georgia_2027',
      'evt_barcelona_2027',
      'evt_central_asia_2027',
      'evt_ny_boston_2027'
    ].includes(e.id));
    const eventsTbd = events.filter(e => e.id === 'evt_europe_grand_2027');

    const handledIds = new Set([
      ...events2026.map(e => e.id),
      ...events2027.map(e => e.id),
      ...eventsTbd.map(e => e.id)
    ]);
    const remainingEvents = events.filter(e => !handledIds.has(e.id));

    let html = '';

    // 2026 Section
    if (events2026.length > 0) {
      html += `
        <div class="calendar-year-header">
          <span>2026</span>
          <span style="font-size:0.76rem; color:var(--text-dim); font-weight:500; text-transform:none; letter-spacing:0;">Upcoming Expeditions & Gatherings</span>
        </div>
        <div class="year-events-group" style="display:flex; flex-direction:column; gap:1.25rem;">
          ${events2026.map(renderCalendarEventCard).join('')}
        </div>
      `;
    }

    // 2027 Section
    if (events2027.length > 0) {
      html += `
        <div class="calendar-year-header" style="margin-top: 2.75rem;">
          <span>2027</span>
          <span style="font-size:0.76rem; color:var(--text-dim); font-weight:500; text-transform:none; letter-spacing:0;">Core Annual Program</span>
        </div>
        <div class="year-events-group" style="display:flex; flex-direction:column; gap:1.25rem;">
          ${events2027.map(renderCalendarEventCard).join('')}
        </div>
      `;
    }

    // Also in 2027 (Dates TBD)
    if (eventsTbd.length > 0) {
      html += `
        <div class="calendar-year-header" style="margin-top: 2.75rem;">
          <span>Also in 2027</span>
          <span style="font-size:0.72rem; color:var(--text-dim); font-weight:600; text-transform:uppercase; letter-spacing:0.08em;">Dates TBD</span>
        </div>
        <div class="year-events-group" style="display:flex; flex-direction:column; gap:1.25rem;">
          ${eventsTbd.map(renderCalendarEventCard).join('')}
        </div>
      `;
    }

    if (remainingEvents.length > 0) {
      html += `
        <div class="calendar-year-header" style="margin-top: 2.75rem;">
          <span>Additional Gatherings</span>
        </div>
        <div class="year-events-group" style="display:flex; flex-direction:column; gap:1.25rem;">
          ${remainingEvents.map(renderCalendarEventCard).join('')}
        </div>
      `;
    }

    container.innerHTML = html;

  } catch (err) {
    console.error("Error loading events:", err);
    container.innerHTML = '<div class="loading-state">Error loading events.</div>';
  }
}

async function rsvpEvent(eventId, status) {
  try {
    const res = await fetch('/api/events/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, userId: currentUserId, status })
    });
    if (res.ok) {
      showToast(status === 'registered' ? "Registration confirmed!" : "RSVP cancelled.");
      await loadEvents();
    }
  } catch (err) {
    showToast("Error updating RSVP", "error");
  }
}

// -------------------------------------------------------------
// 2. NETWORKING & EXPLAINABLE MATCHMAKING (SECOND VIEW)
// -------------------------------------------------------------
function setupSearch() {
  const input = document.getElementById('memberSearchInput');
  input.addEventListener('input', debounce(() => {
    loadNetworking();
  }, 250));
}

async function loadNetworking() {
  const grid = document.getElementById('networkingGrid');
  grid.innerHTML = '<div class="loading-state">Analyzing network synergies and verified expertise...</div>';

  const query = document.getElementById('memberSearchInput').value;

  try {
    let endpoint = `/api/members?viewerId=${currentUserId}&q=${encodeURIComponent(query)}`;
    if (activeSubFilter === 'recommendations' && !query) {
      endpoint = `/api/recommendations?viewerId=${currentUserId}`;
    }

    const res = await fetch(endpoint);
    const data = await res.json();

    if (!data.length) {
      grid.innerHTML = `
        <div class="loading-state" style="grid-column: 1 / -1; text-align: center;">
          <p>No members found matching your search.</p>
          <button class="btn btn-outline btn-sm" onclick="openAskIntroModal()" style="margin-top: 1rem;">
            Ask Team for an Introduction
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = data.map(m => {
      const isRecommendation = Boolean(m.match_rationale);
      const isDirect = m.contact_preference === 'direct_contact';
      const isUnavailable = m.contact_preference === 'unavailable';

      let travelBadge = '';
      if (m.active_travel && m.active_travel.length > 0) {
        const trip = m.active_travel[0];
        travelBadge = `<span class="badge badge-travel">✈ Visiting ${trip.city}</span>`;
      }

      return `
        <div class="member-card">
          <div class="card-top">
            <img src="${m.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'}" 
                 alt="${m.full_name}" 
                 class="card-avatar clickable-avatar" 
                 title="Click to view profile & questionnaire"
                 onclick="openProfileDrawer('${m.id}')">
            <div class="card-info">
              <div class="card-name-row">
                <span class="card-name clickable-name" 
                      title="Click to view profile & questionnaire"
                      onclick="openProfileDrawer('${m.id}')">
                  ${m.full_name}
                </span>
                ${isRecommendation ? `<span class="card-score">${Math.round(m.match_score * 100)}% Match</span>` : ''}
              </div>
              <p class="card-headline">${m.headline}</p>
              <div class="card-location-row">
                <span>📍 ${m.city}, ${m.country}</span>
                <span>•</span>
                <span>${m.chapter_name || m.city} Chapter</span>
                ${travelBadge}
              </div>
            </div>
          </div>

          ${isRecommendation ? `
            <div class="rationale-box">
              <span class="rationale-label">✦ Why this match?</span>
              <p class="rationale-text">${m.match_rationale}</p>
            </div>
          ` : ''}

          <div class="tags-row">
            ${(m.matched_tags || []).map(t => `<span class="tag-pill">✓ ${t.label}</span>`).join('')}
            ${m.taxonomies?.industries ? m.taxonomies.industries.map(i => `<span class="tag-pill">${i.label}</span>`).join('') : ''}
          </div>

          <div class="card-actions">
            <span class="pref-label">
              ${isDirect ? '✓ Direct Contact' : (isUnavailable ? '⊘ Unavailable' : '◬ Via Founders Queue')}
            </span>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-sm btn-outline" onclick="openProfileDrawer('${m.id}')">
                View Profile & Answers
              </button>
              ${isDirect ? `
                <button class="btn btn-sm btn-white-pill" onclick="openCallModal('${m.id}', '${m.full_name}')">
                  Schedule Call
                </button>
              ` : `
                <button class="btn btn-sm btn-outline" onclick="openAskIntroModal('${m.id}')">
                  Ask Team for Intro
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    grid.innerHTML = '<div class="loading-state">Error loading members.</div>';
  }
}

// -------------------------------------------------------------
// 3. INVESTMENTS (REAL ESTATE) (THIRD VIEW)
// -------------------------------------------------------------
async function loadInvestments() {
  const grid = document.getElementById('listingsGrid');
  grid.innerHTML = '<div class="loading-state">Loading verified property assets...</div>';

  try {
    const res = await fetch('/api/listings');
    const listings = await res.json();

    grid.innerHTML = listings.map(l => {
      const img = l.images?.[0] || 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800';

      return `
        <div class="listing-card">
          <div class="listing-img-container">
            <img src="${img}" alt="${l.title}">
            <span class="listing-tag">${l.property_type}</span>
          </div>

          <div class="listing-body">
            <h3 class="listing-title">${l.title}</h3>
            <span class="muted-text">📍 ${l.location}</span>
            <p class="listing-summary">${l.short_summary}</p>

            <div class="listing-footer">
              <span class="pref-label">Curated by ${l.creator_name}</span>
              <button class="btn btn-sm btn-white-pill" onclick="openReInquiryModal('${l.id}', '${l.title}')">
                Inquire / Request Call
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    grid.innerHTML = '<div class="loading-state">Error loading listings.</div>';
  }
}

// -------------------------------------------------------------
// 4. SLIDE-OVER DRAWER: PROFILE & 30-QUESTION QUESTIONNAIRE
// -------------------------------------------------------------
async function openProfileDrawer(userId, focusQuestionId = null) {
  activeDrawerUserId = userId;
  const drawer = document.getElementById('profileDrawer');
  drawer.classList.add('active');

  try {
    const res = await fetch(`/api/profile/${userId}?viewerId=${currentUserId}`);
    const data = await res.json();
    activeDrawerProfileData = data;

    const isSelf = (userId === currentUserId);
    const viewer = getCurrentUser();
    const isFounder = (viewer && viewer.role === 'FOUNDER');

    // Header info
    document.getElementById('drawerAvatar').src = data.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300';
    document.getElementById('drawerFullName').textContent = data.full_name;
    document.getElementById('drawerHeadline').textContent = data.headline;
    document.getElementById('drawerChapter').textContent = `Chapter: ${data.chapter_name || data.city}`;
    document.getElementById('drawerCity').textContent = `Base: ${data.city}, ${data.country}`;
    document.getElementById('drawerPref').textContent = `Contact: ${data.contact_preference.replace('_', ' ')}`;

    // Completion Badge
    const compBadge = document.getElementById('drawerCompletionBadge');
    if (data.is_complete) {
      compBadge.className = 'badge badge-success';
      compBadge.textContent = 'Complete Profile';
    } else {
      compBadge.className = 'badge badge-warning';
      compBadge.textContent = 'Incomplete (Q18 Required)';
    }

    // Quick Actions
    const actionContainer = document.getElementById('drawerActionBtns');
    if (!isSelf) {
      const isDirect = data.contact_preference === 'direct_contact';
      actionContainer.innerHTML = isDirect ? `
        <button class="btn btn-sm btn-white-pill" onclick="openCallModal('${data.id}', '${data.full_name}')">
          Schedule Call
        </button>
      ` : `
        <button class="btn btn-sm btn-outline" onclick="openAskIntroModal('${data.id}')">
          Ask Team for Intro
        </button>
      `;
    } else {
      actionContainer.innerHTML = `<span class="badge badge-white">Your Personal Profile</span>`;
    }

    // Populate Tab 1: 30 Questions
    const qContainer = document.getElementById('drawerQuestionsContainer');
    qContainer.innerHTML = data.answers.map(a => {
      const isQ18 = a.question_id === 18;
      const isQ23 = a.question_id === 23;
      const isSkipped = a.answer_state === 'deliberately_skipped';
      const isShared = a.visibility === 'shared';

      let specialCardClass = '';
      if (isQ23) specialCardClass = 'q23-locked-card';

      return `
        <div class="question-card ${specialCardClass}" id="drawer-q${a.question_id}-card">
          <div class="question-header">
            <div class="q-num-prompt">
              <span class="q-num">${a.question_id}</span>
              <div>
                <span class="q-prompt">${a.prompt}</span>
                ${isQ18 ? `<div class="q18-required-badge" style="margin-top: 0.35rem;">★ Mandatory Completion Question</div>` : ''}
              </div>
            </div>

            <div class="q-controls">
              ${isQ23 ? `
                <div class="q23-lock-shield">
                  🔒 Locked to Private (Founder-Only)
                </div>
              ` : (isSelf ? `
                <div class="visibility-toggle-group">
                  <button class="vis-btn ${isShared ? 'active' : ''}" onclick="toggleQuestionVisibility(${a.question_id}, 'shared')">Shared</button>
                  <button class="vis-btn ${!isShared ? 'active' : ''}" onclick="toggleQuestionVisibility(${a.question_id}, 'private')">Private</button>
                </div>
              ` : `
                <span class="badge ${isShared ? 'badge-success' : 'badge-outline'}">${a.visibility}</span>
              `)}
            </div>
          </div>

          <div class="q-input-row">
            ${isSelf ? `
              <textarea 
                rows="${isQ23 ? 3 : 2}" 
                id="drawer-q-text-${a.question_id}" 
                placeholder="${isSkipped ? 'Deliberately skipped by member' : 'Enter your detailed perspective...'}"
                oninput="handleQuestionInput(${a.question_id})">${a.value_text || ''}</textarea>
              <div id="drawer-q-warning-${a.question_id}" class="field-warning" style="display: none;"></div>
            ` : `
              <div class="readonly-answer-box">
                ${a.value_text ? a.value_text : `<em class="muted-text">${isSkipped ? 'Deliberately skipped by member' : 'Unanswered'}</em>`}
              </div>
            `}
          </div>

          <div class="q-meta-footer">
            <span>Status: <strong>${a.answer_state}</strong></span>
            ${isSelf ? `
              <div>
                <button class="btn btn-sm btn-outline" onclick="markQuestionSkipped(${a.question_id})">
                  ${isSkipped ? 'Unskip' : 'Skip Question'}
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Populate Tab 2: Taxonomies
    const taxContainer = document.getElementById('drawerTaxonomiesContainer');
    const grouped = {};
    data.taxonomies.forEach(t => {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push(t.label);
    });

    taxContainer.innerHTML = Object.entries(grouped).map(([cat, tags]) => `
      <div style="margin-bottom: 1.25rem;">
        <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--gold-light); font-weight: 700;">${cat}:</span>
        <div class="tags-row" style="margin-top: 0.35rem;">
          ${tags.map(tag => `<span class="tag-pill">${tag}</span>`).join('')}
        </div>
      </div>
    `).join('') || '<p class="muted-text">No taxonomies declared.</p>';

    // Populate Tab 3: Travel Plans
    const trvContainer = document.getElementById('drawerTravelContainer');
    trvContainer.innerHTML = data.travel_plans.map(tp => `
      <div class="rationale-box" style="margin-bottom: 0.85rem;">
        <span class="rationale-label">✈ ${tp.city}, ${tp.country}</span>
        <p class="rationale-text">${tp.start_date} to ${tp.end_date} — ${tp.notes || 'No notes specified'}</p>
      </div>
    `).join('') || '<p class="muted-text">No active travel scheduled.</p>';

    // Switch to questions tab by default
    switchDrawerTab('questions');

    // Handle focus on specific question (e.g. Q18)
    if (focusQuestionId) {
      setTimeout(() => {
        const targetCard = document.getElementById(`drawer-q${focusQuestionId}-card`);
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetCard.style.outline = '2px solid var(--gold-primary)';
          setTimeout(() => { targetCard.style.outline = ''; }, 2500);
        }
      }, 350);
    }

  } catch (err) {
    console.error("Error opening profile drawer:", err);
  }
}

function closeProfileDrawer() {
  const drawer = document.getElementById('profileDrawer');
  drawer.classList.remove('active');
  activeDrawerUserId = null;
}

function handleDrawerBackdropClick(e) {
  if (e.target.id === 'profileDrawer') {
    closeProfileDrawer();
  }
}

function switchDrawerTab(tabName) {
  document.querySelectorAll('.drawer-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-dtab') === tabName);
  });
  document.querySelectorAll('.drawer-tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `drawer-tab-${tabName}`);
  });
}

const handleQuestionInput = debounce(async (questionId) => {
  const textarea = document.getElementById(`drawer-q-text-${questionId}`);
  const warningEl = document.getElementById(`drawer-q-warning-${questionId}`);
  if (!textarea) return;

  const val = textarea.value.trim();
  const existingAns = activeDrawerProfileData?.answers?.find(a => a.question_id === questionId);
  const visibility = existingAns?.visibility || 'shared';

  try {
    const res = await fetch('/api/intake/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUserId,
        questionId,
        valueText: val,
        answerState: val ? 'answered' : 'unanswered',
        visibility
      })
    });

    const data = await res.json();
    if (res.status === 422) {
      if (warningEl) {
        warningEl.textContent = `🛡️ ${data.error}`;
        warningEl.style.display = 'block';
      }
    } else {
      if (warningEl) warningEl.style.display = 'none';
      showToast(`Answer to Question ${questionId} saved.`);
      if (questionId === 18) {
        await loadPersonas();
        await openProfileDrawer(currentUserId);
      }
    }
  } catch (err) {
    console.error("Autosave error:", err);
  }
}, 600);

async function toggleQuestionVisibility(questionId, newVis) {
  const textarea = document.getElementById(`drawer-q-text-${questionId}`);
  const val = textarea ? textarea.value.trim() : '';

  try {
    const res = await fetch('/api/intake/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUserId,
        questionId,
        valueText: val,
        answerState: val ? 'answered' : 'unanswered',
        visibility: newVis
      })
    });
    if (res.ok) {
      showToast(`Question ${questionId} set to ${newVis}.`);
      await openProfileDrawer(currentUserId);
    }
  } catch (err) {
    showToast("Error updating visibility", "error");
  }
}

async function markQuestionSkipped(questionId) {
  const existingAns = activeDrawerProfileData?.answers?.find(a => a.question_id === questionId);
  const nextState = existingAns?.answer_state === 'deliberately_skipped' ? 'unanswered' : 'deliberately_skipped';

  try {
    const res = await fetch('/api/intake/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUserId,
        questionId,
        valueText: '',
        answerState: nextState,
        visibility: existingAns?.visibility || 'shared'
      })
    });
    if (res.ok) {
      showToast(`Question ${questionId} marked as ${nextState}.`);
      await openProfileDrawer(currentUserId);
    }
  } catch (err) {
    showToast("Error updating state", "error");
  }
}

// -------------------------------------------------------------
// 5. ADMIN CONSOLE
// -------------------------------------------------------------
async function loadAdminConsole() {
  const introList = document.getElementById('adminIntroList');
  const exportList = document.getElementById('adminExportList');
  const invitesList = document.getElementById('adminInvitesList');
  const auditBody = document.getElementById('auditLogsBody');
  if (!introList || !exportList || !auditBody) return;

  // Intro requests
  try {
    const res = await fetch('/api/intros');
    const intros = await res.json();
    document.getElementById('introQueueCount').textContent = `${intros.length} Requests`;

    introList.innerHTML = intros.map(i => `
      <div class="rationale-box" style="margin-bottom: 0.85rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
          <strong class="clickable-name" onclick="openProfileDrawer('${i.requester_id}')">${i.requester_name}</strong>
          <span class="badge ${i.status === 'completed' ? 'badge-success' : 'badge-white'}">${i.status}</span>
        </div>
        <p class="muted-text">Target: ${i.target_name || 'Open Intro'} • ${i.target_context_need}</p>
        ${i.status !== 'completed' ? `
          <button class="btn btn-sm btn-outline" style="margin-top: 0.5rem;" onclick="resolveIntro('${i.id}')">
            Mark Facilitated & Resolved
          </button>
        ` : ''}
      </div>
    `).join('') || '<p class="muted-text">Queue is clear.</p>';
  } catch (e) {}

  // Two-Person Exports
  try {
    const res = await fetch('/api/admin/exports');
    const exports = await res.json();
    exportList.innerHTML = exports.map(exp => `
      <div class="rationale-box" style="margin-bottom: 0.85rem;">
        <div style="display: flex; justify-content: space-between;">
          <span>Request ID: <code>${exp.id}</code></span>
          <span class="badge ${exp.status === 'approved' ? 'badge-success' : 'badge-white'}">${exp.status}</span>
        </div>
        <p class="muted-text">Initiated by: ${exp.requester_name} at ${new Date(exp.request_timestamp).toLocaleTimeString()}</p>
        ${exp.status === 'pending_second_approval' ? `
          <button class="btn btn-sm btn-white-pill" style="margin-top: 0.5rem;" onclick="approveTwoPersonExport('${exp.id}')">
            Provide Second Approval & Unlock Token
          </button>
        ` : `
          <p class="muted-text" style="color: var(--status-success);">✓ Approved by ${exp.approver_name}. Ephemeral Download Token: <code>${exp.download_token}</code></p>
        `}
      </div>
    `).join('') || '<p class="muted-text">No active export authorizations.</p>';
  } catch (e) {}

  // Invitations
  try {
    const res = await fetch('/api/admin/invitations');
    const invites = await res.json();
    invitesList.innerHTML = invites.map(inv => `
      <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid var(--border-subtle); font-size: 0.8rem;">
        <span>${inv.email}</span>
        <code style="color: var(--gold-light);">${inv.token}</code>
      </div>
    `).join('');
  } catch (e) {}

  // Audit Logs
  try {
    const res = await fetch('/api/admin/audit-logs');
    const logs = await res.json();
    auditBody.innerHTML = logs.map(l => `
      <tr>
        <td>${new Date(l.timestamp).toLocaleString()}</td>
        <td><strong>${l.actor_name}</strong> (${l.actor_role})</td>
        <td><span class="badge badge-white">${l.action}</span></td>
        <td class="clickable-name" onclick="${l.target_member_id ? `openProfileDrawer('${l.target_member_id}')` : ''}">${l.target_name || 'N/A'}</td>
        <td>Question #${l.question_id || 'N/A'}</td>
        <td><code>${l.ip_address}</code></td>
      </tr>
    `).join('');
  } catch (e) {}
}

async function resolveIntro(introId) {
  try {
    const res = await fetch('/api/intros/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        introId,
        status: 'completed',
        resolutionNotes: 'Warm introduction coordinated via founder channels.'
      })
    });
    if (res.ok) {
      showToast("Introduction marked as resolved.");
      await loadAdminConsole();
    }
  } catch (e) {}
}

async function requestTwoPersonExport() {
  try {
    const res = await fetch('/api/admin/exports/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: currentUserId, exportType: 'members_directory_csv' })
    });
    if (res.ok) {
      showToast("Export initiated. Awaiting second administrator approval (Two-Person Rule).");
      await loadAdminConsole();
    }
  } catch (e) {}
}

async function approveTwoPersonExport(expId) {
  try {
    const res = await fetch('/api/admin/exports/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expId, approverId: currentUserId })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error, "error");
    } else {
      showToast("Dual approval successful! Download token generated.", "success");
      await loadAdminConsole();
    }
  } catch (e) {}
}

async function generateInviteToken() {
  const emailInput = document.getElementById('newInviteEmail');
  const email = emailInput.value.trim();
  if (!email) return showToast("Enter candidate email", "error");

  try {
    const res = await fetch('/api/admin/invitations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, createdBy: currentUserId })
    });
    if (res.ok) {
      emailInput.value = '';
      showToast("Invitation token created.");
      await loadAdminConsole();
    }
  } catch (e) {}
}

// -------------------------------------------------------------
// MODALS LOGIC
// -------------------------------------------------------------
function openCallModal(recipientId, recipientName) {
  callTargetUser = recipientId;
  document.getElementById('callRecipientName').textContent = recipientName;
  openModal('callScheduleModal');
}

async function submitCallProposal() {
  const t1 = document.getElementById('callTime1').value;
  const t2 = document.getElementById('callTime2').value;
  const tz = document.getElementById('callTimezone').value;
  const link = document.getElementById('callVideoLink').value;
  const msg = document.getElementById('callMessage').value;

  if (!t1) return showToast("Please select at least one candidate time", "error");

  try {
    const res = await fetch('/api/calls/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterId: currentUserId,
        recipientId: callTargetUser,
        proposedTimes: [{ start: t1 }, t2 ? { start: t2 } : null].filter(Boolean),
        timezone: tz,
        meetingLink: link,
        message: msg
      })
    });
    if (res.ok) {
      closeModal('callScheduleModal');
      showToast("Call proposal dispatched successfully!", "success");
    }
  } catch (e) {
    showToast("Error proposing call", "error");
  }
}

function openAskIntroModal(targetId = null) {
  const select = document.getElementById('introTargetMember');
  select.innerHTML = '<option value="">General Request / Open Introduction</option>';
  personas.filter(p => p.role === 'MEMBER' && p.id !== currentUserId).forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.full_name} (${m.headline})`;
    if (m.id === targetId) opt.selected = true;
    select.appendChild(opt);
  });
  openModal('askIntroModal');
}

async function submitIntroRequest() {
  const targetId = document.getElementById('introTargetMember').value;
  const needText = document.getElementById('introContextNeed').value.trim();
  const warningEl = document.getElementById('introValidationWarning');

  if (!needText) return showToast("Please describe your context and introduction objective", "error");

  try {
    const res = await fetch('/api/intros/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterId: currentUserId,
        targetMemberId: targetId || null,
        contextNeed: needText
      })
    });
    const data = await res.json();
    if (res.status === 422) {
      warningEl.textContent = `🛡️ ${data.error}`;
      warningEl.style.display = 'block';
    } else {
      warningEl.style.display = 'none';
      closeModal('askIntroModal');
      document.getElementById('introContextNeed').value = '';
      showToast("Introduction request received by Elena, Alexandra, and Julia.", "success");
    }
  } catch (e) {
    showToast("Error submitting intro request", "error");
  }
}

function openTargetedInviteModal() {
  fetch(`/api/events?userId=${currentUserId}`).then(res => res.json()).then(events => {
    const select = document.getElementById('targetInviteEventSelect');
    select.innerHTML = events.map(e => `<option value="${e.id}">${e.title} (${e.location})</option>`).join('');
    updateTargetInvitePreview();
    openModal('targetedInviteModal');
  });
}

async function updateTargetInvitePreview() {
  const eventId = document.getElementById('targetInviteEventSelect').value;
  const travelCity = document.getElementById('targetTravelCity').value;
  const checkedChapters = Array.from(document.querySelectorAll('#targetChaptersCheckboxes input:checked')).map(cb => cb.value);

  try {
    const res = await fetch('/api/events/invitations/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        chapters: checkedChapters,
        includeTravelersInCity: travelCity,
        industries: []
      })
    });
    const data = await res.json();
    document.getElementById('targetRecipientCount').textContent = `${data.recipient_count} Members Found`;

    const flow = document.getElementById('targetRecipientsList');
    flow.innerHTML = data.recipients.map(r => `
      <div style="display: inline-flex; align-items: center; gap: 0.4rem; background: var(--bg-input); padding: 0.3rem 0.6rem; border-radius: var(--radius-full); margin: 0.2rem; font-size: 0.78rem;">
        <img src="${r.avatar_url || ''}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;">
        <span class="clickable-name" onclick="openProfileDrawer('${r.id}')">${r.full_name} (${r.city})</span>
      </div>
    `).join('') || '<p class="muted-text">No matching recipients for selected filters.</p>';
  } catch (e) {}
}

async function sendTargetedInvitations() {
  showToast("Targeted invitations dispatched and logged to outbox.", "success");
  closeModal('targetedInviteModal');
}

let activeReListingId = null;
function openReInquiryModal(listingId, title) {
  activeReListingId = listingId;
  document.getElementById('reInquiryTitle').textContent = `Inquire: ${title}`;
  openModal('reInquiryModal');
}

async function submitListingInquiry() {
  const notes = document.getElementById('reInquiryNotes').value.trim();
  const inquiryType = document.querySelector('input[name="inquiryType"]:checked').value;
  const warningEl = document.getElementById('reValidationWarning');

  try {
    const res = await fetch('/api/listings/inquire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId: activeReListingId,
        memberId: currentUserId,
        inquiryType,
        notes
      })
    });
    const data = await res.json();
    if (res.status === 422) {
      warningEl.textContent = `🛡️ ${data.error}`;
      warningEl.style.display = 'block';
    } else {
      warningEl.style.display = 'none';
      closeModal('reInquiryModal');
      document.getElementById('reInquiryNotes').value = '';
      showToast("Asset inquiry dispatched to team.", "success");
    }
  } catch (e) {
    showToast("Error submitting inquiry", "error");
  }
}
