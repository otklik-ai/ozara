// ÖZARA Application State
let personas = [];
let currentUserId = 'usr_elena';
let activeTab = 'community'; // Community is now the default first page
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
  await refreshInboxSummary();
  setInterval(refreshInboxSummary, 30000);
  initWebNotifications();
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
      await refreshInboxSummary();
      await fetchWebNotifications();
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

  // Update community composer user profile
  const compAvatar = document.getElementById('composerUserAvatar');
  if (compAvatar) compAvatar.src = user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
  const compName = document.getElementById('composerUserName');
  if (compName) compName.textContent = user.full_name;
  const compRole = document.getElementById('composerUserRole');
  if (compRole) compRole.textContent = user.headline || (user.role === 'FOUNDER' ? 'Founder & Managing Partner' : 'ÖZARA Member');
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

  // URL hash support on initial load
  const initialHash = (window.location.hash || '').replace('#', '').trim();
  if (initialHash && ['community', 'network', 'networking', 'events', 'investments', 'team', 'admin'].includes(initialHash)) {
    const target = (initialHash === 'network') ? 'networking' : initialHash;
    switchTab(target);
  } else {
    updateHeroVisibility(activeTab);
  }

  window.addEventListener('hashchange', () => {
    const hash = (window.location.hash || '').replace('#', '').trim();
    if (hash && ['community', 'network', 'networking', 'events', 'investments', 'team', 'admin'].includes(hash)) {
      const target = (hash === 'network') ? 'networking' : hash;
      if (target !== activeTab) {
        switchTab(target);
      }
    }
  });

  window.addEventListener('resize', () => {
    updateHeroVisibility(activeTab);
  });

  setupInvestmentDropdownClicks();
}

function updateHeroVisibility(tab) {
  const heroEl = document.querySelector('.hero-section');
  if (heroEl) {
    const isMobile = window.innerWidth <= 1024;
    heroEl.style.display = (!isMobile && tab === 'community') ? 'block' : 'none';
  }
}

function switchTab(tab) {
  activeTab = tab;
  try {
    if (window.location.hash !== `#${tab}`) {
      history.replaceState(null, '', `#${tab}`);
    }
  } catch (e) {}

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tab);
  });
  document.querySelectorAll('.view-panel').forEach(p => {
    p.classList.toggle('active', p.id === `view-${tab}`);
  });

  updateHeroVisibility(tab);
  loadCurrentView();
}

async function loadCurrentView() {
  if (activeTab === 'community') await loadCommunityFeed();
  else if (activeTab === 'events') await loadEvents();
  else if (activeTab === 'networking') await loadNetworking();
  else if (activeTab === 'investments') await loadInvestments();
  else if (activeTab === 'team') {
    // Leadership & Team view
  }
  else if (activeTab === 'admin') await loadAdminConsole();
}

// -------------------------------------------------------------
// 0. COMMUNITY FEED & PEER EXCHANGE (MUTUAL WALL)
// -------------------------------------------------------------
let communityPostsCache = [];
let currentEditingPostId = null;
let carouselIndicesByPost = {};
let expandedCommentsByPost = {};
let composerAttachments = []; // Array of { media_type, url, filename, caption, size }

// Attachment helper functions
async function handleComposerFilesSelected(event, mediaType) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const count = files.length;
  showToast(`Uploading ${count > 1 ? `${count} items` : 'file'}…`, 'info');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const base64Data = await readFileAsDataURL(file);
      const res = await fetch('/api/community/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId
        },
        body: JSON.stringify({
          filename: file.name,
          media_type: mediaType,
          data: base64Data
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload file');

      composerAttachments.push({
        media_type: mediaType,
        url: data.url,
        filename: file.name,
        caption: file.name,
        size: data.size
      });
    } catch (err) {
      showToast(`Error uploading ${file.name}: ${err.message}`, 'warning');
    }
  }

  event.target.value = '';
  renderComposerAttachments();
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

function toggleComposerLinkInput() {
  const row = document.getElementById('composerLinkInputRow');
  if (!row) return;
  const isHidden = row.style.display === 'none';
  row.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) {
    const input = document.getElementById('composerLinkUrl');
    if (input) input.focus();
  }
}

function confirmAddLinkAttachment() {
  const urlInput = document.getElementById('composerLinkUrl');
  const titleInput = document.getElementById('composerLinkTitle');
  if (!urlInput) return;
  let url = urlInput.value.trim();
  if (!url) {
    showToast('Please enter a valid URL', 'warning');
    return;
  }
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  const caption = (titleInput && titleInput.value.trim()) || url;

  composerAttachments.push({
    media_type: 'link',
    url,
    caption,
    filename: caption
  });

  urlInput.value = '';
  if (titleInput) titleInput.value = '';
  document.getElementById('composerLinkInputRow').style.display = 'none';
  renderComposerAttachments();
}

function cancelAddLinkAttachment() {
  const urlInput = document.getElementById('composerLinkUrl');
  const titleInput = document.getElementById('composerLinkTitle');
  if (urlInput) urlInput.value = '';
  if (titleInput) titleInput.value = '';
  const row = document.getElementById('composerLinkInputRow');
  if (row) row.style.display = 'none';
}

function removeComposerAttachment(index) {
  composerAttachments.splice(index, 1);
  renderComposerAttachments();
}

function renderComposerAttachments() {
  const previewEl = document.getElementById('composerAttachmentsPreview');
  if (!previewEl) return;
  if (composerAttachments.length === 0) {
    previewEl.style.display = 'none';
    previewEl.innerHTML = '';
    return;
  }

  previewEl.style.display = 'flex';
  previewEl.innerHTML = composerAttachments.map((att, idx) => {
    if (att.media_type === 'photo') {
      return `
        <div class="composer-attachment-chip photo-chip">
          <img src="${att.url}" alt="Attached photo" class="composer-chip-thumb" />
          <button type="button" class="composer-chip-remove" onclick="removeComposerAttachment(${idx})" title="Remove">✕</button>
        </div>
      `;
    } else if (att.media_type === 'video') {
      return `
        <div class="composer-attachment-chip video-chip">
          <span class="chip-icon">🎥</span>
          <span class="chip-label">${escapeHtml(att.filename || 'Video')}</span>
          <button type="button" class="composer-chip-remove" onclick="removeComposerAttachment(${idx})" title="Remove">✕</button>
        </div>
      `;
    } else if (att.media_type === 'file') {
      return `
        <div class="composer-attachment-chip file-chip">
          <span class="chip-icon">📄</span>
          <span class="chip-label">${escapeHtml(att.filename || 'Document')}</span>
          <button type="button" class="composer-chip-remove" onclick="removeComposerAttachment(${idx})" title="Remove">✕</button>
        </div>
      `;
    } else {
      return `
        <div class="composer-attachment-chip link-chip">
          <span class="chip-icon">🔗</span>
          <span class="chip-label">${escapeHtml(att.caption || att.url)}</span>
          <button type="button" class="composer-chip-remove" onclick="removeComposerAttachment(${idx})" title="Remove">✕</button>
        </div>
      `;
    }
  }).join('');
}

function formatCommunityTime(dateString) {
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 0) return 'Just now';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recent';
  }
}

async function loadCommunityFeed() {
  const container = document.getElementById('communityFeedContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/community/posts', {
      headers: { 'x-user-id': currentUserId }
    });
    if (!res.ok) throw new Error('Failed to load community feed');
    communityPostsCache = await res.json();
    renderCommunityFeed();
  } catch (err) {
    console.error('Error loading community feed:', err);
    container.innerHTML = `
      <div class="community-empty-box">
        <p class="community-empty-desc">Could not load community feed. Please try refreshing.</p>
        <button class="btn btn-sm btn-secondary-pill" onclick="loadCommunityFeed()">Retry</button>
      </div>
    `;
  }
}

function renderCommunityFeed() {
  const container = document.getElementById('communityFeedContainer');
  if (!container) return;

  if (!communityPostsCache || communityPostsCache.length === 0) {
    container.innerHTML = `
      <div class="community-empty-box">
        <span class="community-empty-icon">💬</span>
        <h4 class="community-empty-title">Mutual Community Wall</h4>
        <p class="community-empty-desc">Share insights, ask questions, or request warm introductions from fellow members.</p>
      </div>
    `;
    return;
  }

  const currentUser = getCurrentUser();
  const isAdmin = currentUser && (currentUser.role === 'FOUNDER' || currentUser.role === 'ADMIN');

  let html = '';
  communityPostsCache.forEach(post => {
    const isOfficial = post.source_type === 'telegram' || post.is_official;
    const isAuthor = post.author_id === currentUserId;
    const author = post.author || {};
    const attachments = post.media_attachments || [];
    const curIdx = carouselIndicesByPost[post.id] || 0;
    const comments = post.comments || [];
    const isExpanded = !!expandedCommentsByPost[post.id];

    // Filter attachments by type
    const photoAttachments = attachments.filter(a => a.media_type === 'photo' || !a.media_type);
    const videoAttachments = attachments.filter(a => a.media_type === 'video');
    const fileAttachments = attachments.filter(a => a.media_type === 'file');
    const linkAttachments = attachments.filter(a => a.media_type === 'link');

    // Photo Carousel HTML
    let mediaCarouselHtml = '';
    if (photoAttachments.length > 0) {
      const activePhoto = photoAttachments[curIdx] || photoAttachments[0];
      const hasMultiple = photoAttachments.length > 1;
      mediaCarouselHtml = `
        <div class="community-carousel-wrap">
          <div class="community-carousel-viewport"
               ontouchstart="handleCarouselTouchStart(event)"
               ontouchend="handleCarouselTouchEnd(event, '${post.id}')">
            <img src="${activePhoto.url}" alt="Post photo" class="community-carousel-img">
            ${hasMultiple ? `
              <button type="button" class="carousel-arrow carousel-arrow-left" onclick="handleCommunityPhotoPrev('${post.id}')" title="Previous photo">‹</button>
              <button type="button" class="carousel-arrow carousel-arrow-right" onclick="handleCommunityPhotoNext('${post.id}')" title="Next photo">›</button>
              <div class="carousel-counter-badge">
                <span>📷 ${curIdx + 1} / ${photoAttachments.length}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    // Video Player HTML
    let videoMediaHtml = '';
    if (videoAttachments.length > 0) {
      videoMediaHtml = `
        <div class="community-post-video-wrap">
          ${videoAttachments.map(v => `
            <video src="${v.url}" controls playsinline preload="metadata" class="community-post-video"></video>
          `).join('')}
        </div>
      `;
    }

    // File Downloads HTML
    let filesMediaHtml = '';
    if (fileAttachments.length > 0) {
      filesMediaHtml = `
        <div class="community-post-files-wrap">
          ${fileAttachments.map(f => {
            const fileName = f.caption || f.url.split('/').pop();
            return `
              <a href="${f.url}" download="${escapeHtml(fileName)}" class="community-file-pill" title="Download ${escapeHtml(fileName)}">
                <span class="file-icon">📄</span>
                <span class="file-name">${escapeHtml(fileName)}</span>
                <span class="file-dl-badge">Download ⤓</span>
              </a>
            `;
          }).join('')}
        </div>
      `;
    }

    // Web Links HTML
    let linksMediaHtml = '';
    if (linkAttachments.length > 0) {
      linksMediaHtml = `
        <div class="community-post-links-wrap">
          ${linkAttachments.map(l => {
            const linkTitle = l.caption || l.url;
            return `
              <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="community-link-card">
                <span class="link-icon">🔗</span>
                <span class="link-text">${escapeHtml(linkTitle)}</span>
                <span class="link-arrow">↗</span>
              </a>
            `;
          }).join('')}
        </div>
      `;
    }

    // Comments list HTML
    let commentsListHtml = '';
    if (comments.length > 0) {
      comments.forEach(c => {
        const isCommentAuthor = c.author_id === currentUserId;
        const cAuthor = c.author || {};
        commentsListHtml += `
          <div class="community-comment-item">
            <img src="${cAuthor.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}"
                 alt="${escapeHtml(cAuthor.full_name || 'Member')}"
                 class="comment-author-avatar"
                 onclick="openProfileDrawer('${c.author_id}')">
            <div class="comment-bubble">
              <div class="comment-bubble-header">
                <span class="comment-author-name" onclick="openProfileDrawer('${c.author_id}')">
                  ${escapeHtml(cAuthor.full_name || 'ÖZARA Member')}
                </span>
                <span class="comment-timestamp">${formatCommunityTime(c.created_at)}</span>
                ${(isCommentAuthor || isAdmin) ? `
                  <button class="comment-delete-btn" onclick="handleDeleteCommunityComment('${post.id}', '${c.id}')" title="Delete comment">✕</button>
                ` : ''}
              </div>
              <p class="comment-bubble-text">${escapeHtml(c.content)}</p>
            </div>
          </div>
        `;
      });
    } else {
      commentsListHtml = `
        <p class="no-comments-text">No comments yet. Start the conversation!</p>
      `;
    }

    html += `
      <article class="community-post-card ${isOfficial ? 'official-post-card' : ''}" id="postCard_${post.id}">
        <!-- Post Header -->
        <div class="post-card-header">
          <div class="post-author-group" onclick="${(!isOfficial && post.author_id) ? `openProfileDrawer('${post.author_id}')` : ''}">
            <img src="${author.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'}"
                 alt="${escapeHtml(author.full_name || 'Member')}"
                 class="post-author-avatar ${isOfficial ? 'official-avatar' : ''}">
            <div class="post-author-info">
              <div class="post-author-row">
                <span class="post-author-name">${escapeHtml(author.full_name || 'ÖZARA Member')}</span>
                ${isOfficial ? `<span class="badge-from-ozara">From ÖZARA</span>` : ''}
                <span class="post-time-dot">·</span>
                <span class="post-timestamp">${formatCommunityTime(post.created_at)}</span>
              </div>
              <span class="post-author-headline">${escapeHtml(author.headline || '')}</span>
            </div>
          </div>

          <div class="post-actions-group">
            ${(!isAuthor && !isOfficial && post.author_id) ? `
              <button class="btn btn-xs btn-ghost-pill" onclick="openProfileDrawer('${post.author_id}')" title="View Member Profile">
                View Profile
              </button>
            ` : ''}
            ${(isAuthor && !isOfficial) ? `
              <button class="post-action-icon-btn" onclick="openEditPostModal('${post.id}')" title="Edit Post">
                ✏️
              </button>
            ` : ''}
            ${((isAuthor || isAdmin) && !isOfficial) ? `
              <button class="post-action-icon-btn delete-icon" onclick="handleDeleteCommunityPost('${post.id}')" title="Delete Post">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Post Body Content -->
        <div class="post-body-content">
          ${escapeHtml(post.content).replace(/\\n/g, '<br>')}
        </div>

        <!-- Attached Media Content (Photos, Videos, Files, Links) -->
        ${mediaCarouselHtml}
        ${videoMediaHtml}
        ${filesMediaHtml}
        ${linksMediaHtml}

        <!-- Post Footer -->
        <div class="post-card-footer">
          <button class="btn-toggle-comments ${isExpanded ? 'active' : ''}" onclick="toggleCommunityComments('${post.id}')">
            <span>💬 ${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}</span>
            <span class="toggle-arrow">${isExpanded ? '▲' : '▼'}</span>
          </button>
        </div>

        <!-- Inline Comments Section -->
        <div class="post-comments-container ${isExpanded ? 'expanded' : ''}" id="commentsContainer_${post.id}">
          <div class="comments-list-stream">
            ${commentsListHtml}
          </div>

          <!-- New Comment Input -->
          <div class="comment-compose-row">
            <input type="text"
                   id="commentInput_${post.id}"
                   class="comment-compose-input"
                   placeholder="Write a comment or warm reply…"
                   onkeydown="if(event.key === 'Enter') handleAddCommunityComment('${post.id}')">
            <button class="btn btn-sm btn-white-pill" onclick="handleAddCommunityComment('${post.id}')">
              Reply
            </button>
          </div>
        </div>
      </article>
    `;
  });

  container.innerHTML = html;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function handleCreateCommunityPost() {
  const textEl = document.getElementById('communityComposerText');
  const btn = document.getElementById('btnSubmitCommunityPost');
  if (!textEl) return;
  const content = textEl.value.trim();
  if (!content && composerAttachments.length === 0) {
    showToast('Please enter text or attach media before publishing.', 'warning');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    const res = await fetch('/api/community/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUserId
      },
      body: JSON.stringify({
        content: content || 'Shared an attachment',
        attachments: composerAttachments
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Could not publish post.');
    }

    textEl.value = '';
    composerAttachments = [];
    renderComposerAttachments();

    // Prepend post to cache & re-render
    communityPostsCache.unshift(data);
    renderCommunityFeed();
    showToast('Post published to Community Wall.', 'success');
  } catch (err) {
    showToast(err.message, 'warning');
  } finally {
    if (btn) btn.disabled = false;
  }
}

let touchCarouselStartX = 0;
let touchCarouselStartY = 0;

function handleCarouselTouchStart(e) {
  if (e.touches && e.touches[0]) {
    touchCarouselStartX = e.touches[0].clientX;
    touchCarouselStartY = e.touches[0].clientY;
  }
}

function handleCarouselTouchEnd(e, postId) {
  if (!e.changedTouches || !e.changedTouches[0]) return;
  const deltaX = e.changedTouches[0].clientX - touchCarouselStartX;
  const deltaY = e.changedTouches[0].clientY - touchCarouselStartY;
  if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY)) {
    if (deltaX < 0) {
      handleCommunityPhotoNext(postId);
    } else {
      handleCommunityPhotoPrev(postId);
    }
  }
}

function updateCommunityCarouselDom(postId, attachments, idx) {
  const card = document.getElementById(`postCard_${postId}`);
  if (!card) {
    renderCommunityFeed();
    return;
  }
  const img = card.querySelector('.community-carousel-img');
  const badge = card.querySelector('.carousel-counter-badge span');
  const photo = attachments[idx];
  if (img && photo) {
    img.style.opacity = '0.7';
    img.src = photo.url;
    img.onload = () => { img.style.opacity = '1'; };
  }
  if (badge) {
    badge.textContent = `📷 ${idx + 1} / ${attachments.length}`;
  }
}

function handleCommunityPhotoPrev(postId) {
  const post = communityPostsCache.find(p => p.id === postId);
  if (!post || !post.media_attachments || post.media_attachments.length <= 1) return;
  const cur = carouselIndicesByPost[postId] || 0;
  const newIdx = (cur - 1 + post.media_attachments.length) % post.media_attachments.length;
  carouselIndicesByPost[postId] = newIdx;
  updateCommunityCarouselDom(postId, post.media_attachments, newIdx);
}

function handleCommunityPhotoNext(postId) {
  const post = communityPostsCache.find(p => p.id === postId);
  if (!post || !post.media_attachments || post.media_attachments.length <= 1) return;
  const cur = carouselIndicesByPost[postId] || 0;
  const newIdx = (cur + 1) % post.media_attachments.length;
  carouselIndicesByPost[postId] = newIdx;
  updateCommunityCarouselDom(postId, post.media_attachments, newIdx);
}

function toggleCommunityComments(postId) {
  expandedCommentsByPost[postId] = !expandedCommentsByPost[postId];
  renderCommunityFeed();
}

async function handleAddCommunityComment(postId) {
  const inputEl = document.getElementById(`commentInput_\${postId}`);
  if (!inputEl) return;
  const content = inputEl.value.trim();
  if (!content) return;

  try {
    inputEl.disabled = true;
    const res = await fetch(`/api/community/posts/\${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUserId
      },
      body: JSON.stringify({
        author_id: currentUserId,
        content
      })
    });
    const newComment = await res.json();
    if (!res.ok) throw new Error(newComment.error || 'Failed to submit comment');

    const post = communityPostsCache.find(p => p.id === postId);
    if (post) {
      if (!post.comments) post.comments = [];
      post.comments.push(newComment);
      post.comments_count = post.comments.length;
      expandedCommentsByPost[postId] = true;
    }
    inputEl.value = '';
    renderCommunityFeed();
    showToast('Comment posted.', 'success');
  } catch (err) {
    showToast(err.message, 'warning');
  } finally {
    if (inputEl) inputEl.disabled = false;
  }
}

async function handleDeleteCommunityComment(postId, commentId) {
  if (!confirm('Are you sure you want to delete this comment?')) return;
  try {
    const res = await fetch(`/api/community/comments/\${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
      headers: { 'x-user-id': currentUserId }
    });
    if (!res.ok) throw new Error('Could not delete comment.');

    const post = communityPostsCache.find(p => p.id === postId);
    if (post && post.comments) {
      post.comments = post.comments.filter(c => c.id !== commentId);
      post.comments_count = post.comments.length;
    }
    renderCommunityFeed();
    showToast('Comment deleted.', 'info');
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function openEditPostModal(postId) {
  const post = communityPostsCache.find(p => p.id === postId);
  if (!post) return;
  currentEditingPostId = postId;
  const textEl = document.getElementById('editPostText');
  if (textEl) textEl.value = post.content || '';
  openModal('editPostModal');
}

function handleEditPostBackdropClick(event) {
  if (event.target && event.target.id === 'editPostModal') {
    closeModal('editPostModal');
  }
}

async function handleSaveEditPost() {
  if (!currentEditingPostId) return;
  const textEl = document.getElementById('editPostText');
  const btn = document.getElementById('btnSaveEditPost');
  if (!textEl) return;
  const content = textEl.value.trim();
  if (!content) {
    showToast('Content cannot be empty.', 'warning');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    const res = await fetch(`/api/community/posts/${encodeURIComponent(currentEditingPostId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUserId
      },
      body: JSON.stringify({
        content
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update post.');

    const post = communityPostsCache.find(p => p.id === currentEditingPostId);
    if (post) {
      post.content = data.content || content;
      post.updated_at = data.updated_at || new Date().toISOString();
    }
    closeModal('editPostModal');
    renderCommunityFeed();
    showToast('Post updated successfully.', 'success');
  } catch (err) {
    showToast(err.message, 'warning');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleDeleteCommunityPost(postId) {
  if (!confirm('Are you sure you want to delete this post?')) return;
  try {
    const res = await fetch(`/api/community/posts/\${encodeURIComponent(postId)}`, {
      method: 'DELETE',
      headers: { 'x-user-id': currentUserId }
    });
    if (!res.ok) throw new Error('Could not delete post.');

    communityPostsCache = communityPostsCache.filter(p => p.id !== postId);
    renderCommunityFeed();
    showToast('Post deleted.', 'info');
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

// -------------------------------------------------------------
// 1. CHRONOLOGICAL EVENT CALENDAR (STRUCTURED DATA & DEDICATED DATE BLOCKS)
// -------------------------------------------------------------
let calendarMode = 'upcoming'; // 'upcoming' | 'archive'
let calendarEventsCache = [];
let calendarFilter = { year: 'all', type: 'all', dest: 'all', status: 'all' };
let currentModalEvent = null;

function setCalendarMode(mode) {
  calendarMode = mode;
  document.getElementById('btnModeUpcoming').classList.toggle('active', mode === 'upcoming');
  document.getElementById('btnModeArchive').classList.toggle('active', mode === 'archive');
  renderCalendar();
}

function filterEvents(key, val, el) {
  calendarFilter[key] = val;
  if (el && el.parentElement) {
    el.parentElement.querySelectorAll('.filter-tag-btn').forEach(btn => btn.classList.remove('active'));
    el.classList.add('active');
  }
  renderCalendar();
  if (typeof syncFilterClearButtons === 'function') syncFilterClearButtons();
}

function renderDateBlockHtml(e) {
  if (e.date_precision === 'tba') {
    return `
      <div class="date-block-left tba">
        <span class="db-year">2027</span>
        <span class="db-tba">DATES</span>
        <span class="db-tba-sub">TO BE</span>
        <span class="db-tba-sub">ANNOUNCED</span>
      </div>
    `;
  }
  if (e.date_precision === 'month_only') {
    const monthShort = (e.month_name || 'MONTH').slice(0, 3).toUpperCase();
    return `
      <div class="date-block-left month-only">
        <span class="db-month-large">${monthShort}</span>
        <span class="db-year">${e.year || 2027}</span>
        <span class="db-month-badge">CONFIRMED</span>
      </div>
    `;
  }
  let daysStr = '';
  let monthStr = '';
  if (e.start_date && e.end_date) {
    const s = new Date(e.start_date).getUTCDate();
    const end = new Date(e.end_date).getUTCDate();
    daysStr = s === end ? `${s}` : `${s}–${end}`;
    const mNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    monthStr = mNames[new Date(e.start_date).getUTCMonth()];
  } else if (e.display_date) {
    const p = e.display_date.split(' ');
    daysStr = p[0] || '';
    monthStr = (p[1] || 'DATE').slice(0, 3).toUpperCase();
  }
  return `
    <div class="date-block-left">
      <span class="db-days">${daysStr}</span>
      <span class="db-month">${monthStr}</span>
      <span class="db-year">${e.year || 2026}</span>
    </div>
  `;
}

function renderStatusBadgeHtml(status) {
  switch (status) {
    case 'open':
      return '<span class="status-pill open"><span class="s-dot dot-emerald"></span>Registration Open</span>';
    case 'full':
      return '<span class="status-pill full"><span class="s-dot dot-purple"></span>Capacity Full</span>';
    case 'closed':
      return '<span class="status-pill closed"><span class="s-dot dot-slate"></span>Registration Closed</span>';
    default:
      return '<span class="status-pill coming-soon"><span class="s-dot dot-amber"></span>Coming Soon</span>';
  }
}

function renderCalendarEventCard(e) {
  const isRegistered = e.user_rsvp === 'registered';
  const displayTitle = e.headline || e.title;
  const venueText = (e.venue && e.venue !== 'To be confirmed') ? e.venue : 'To be confirmed';
  const capacityText = (e.capacity && e.capacity > 0) ? `${e.capacity} seats` : 'To be confirmed';
  const spotsText = (e.available_spots !== null && e.available_spots !== undefined) ? `${e.available_spots} spots` : 'To be confirmed';

  const attendeesHtml = e.attendees && e.attendees.length > 0 
    ? e.attendees.map(a => `
        <img src="${a.avatar_url || ''}" 
             class="clickable-avatar"
             onclick="openProfileDrawer('${a.id}')"
             title="${a.full_name} (${a.headline || ''})" 
             alt="${a.full_name}">
      `).join('')
    : '<span style="color:var(--text-dim); font-size:0.76rem;">Be the first</span>';

  return `
    <div class="chrono-event-card ${e.date_precision === 'tba' ? 'tba-card' : ''}" id="card-${e.id}">
      ${renderDateBlockHtml(e)}

      <div class="chrono-card-content">
        <div class="chrono-card-top">
          <div class="type-and-status">
            <span class="event-type-tag">${(e.event_type || 'SUMMIT').toUpperCase()}</span>
            ${renderStatusBadgeHtml(e.registration_status)}
            ${isRegistered ? '<span class="rsvp-active-pill">✓ Confirmed Attendee</span>' : ''}
          </div>
        </div>

        <h3 class="chrono-title" onclick="openEventDetailModal('${e.id}')">${displayTitle}</h3>

        <div class="chrono-meta-row">
          <span>📍 ${e.location}</span>
          <span>•</span>
          <span style="font-style:italic; color:var(--text-dim);">Venue: ${venueText}</span>
        </div>

        <p class="chrono-desc">${e.description}</p>

        <div class="chrono-metrics-row">
          <span>👥 Capacity: ${capacityText}</span>
          <span>•</span>
          <span>🎟️ Available: ${spotsText}</span>
        </div>

        <div class="chrono-card-bottom">
          <div class="attendees-stack-row">
            <span class="attendee-count-label">Confirmed Members:</span>
            <div class="attendee-stack">${attendeesHtml}</div>
          </div>

          <div class="chrono-actions-row">
            <button class="btn btn-outline btn-sm" onclick="openEventDetailModal('${e.id}')">
              View Details & Agenda
            </button>
            ${e.registration_status === 'open' ? (
              isRegistered ? `
                <button class="btn btn-outline btn-sm" onclick="rsvpEvent('${e.id}', 'cancelled')">
                  Cancel Registration
                </button>
              ` : `
                <button class="btn btn-white-pill btn-sm" onclick="rsvpEvent('${e.id}', 'registered')">
                  Register / Reserve
                </button>
              `
            ) : ''}
            <button class="btn btn-secondary-pill btn-sm" onclick="downloadEventIcs('${e.id}')" title="Download .ICS">
              📅 .ICS
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSpotlightCard(e) {
  const isRegistered = e.user_rsvp === 'registered';
  const displayTitle = e.headline || e.title;
  const daysStr = e.display_date ? e.display_date.split(' ')[0] : '13–15';
  const monthStr = e.month_name ? e.month_name.toUpperCase() : 'NOVEMBER';

  return `
    <div class="spotlight-card">
      <div class="spotlight-header">
        <span class="spotlight-badge">★ NEXT UPCOMING EVENT</span>
        ${renderStatusBadgeHtml(e.registration_status)}
      </div>

      <div class="spotlight-body">
        <div class="spotlight-date">
          <span class="sp-days">${daysStr}</span>
          <span class="sp-month">${monthStr}</span>
          <span class="sp-year">${e.year || 2026}</span>
        </div>

        <div class="spotlight-info">
          <h3 class="spotlight-title" onclick="openEventDetailModal('${e.id}')">${displayTitle}</h3>
          <div class="spotlight-meta">
            <span>📍 ${e.location}</span>
            <span>•</span>
            <span style="color:var(--accent-cyan); font-weight:700;">${e.event_type || 'Summit'}</span>
          </div>
          <p class="spotlight-desc">${e.description}</p>
          <div class="spotlight-actions">
            <button class="btn btn-white-pill" onclick="openEventDetailModal('${e.id}')">
              View Details & Agenda →
            </button>
            ${e.registration_status === 'open' ? (
              isRegistered ? `
                <button class="btn btn-outline" onclick="rsvpEvent('${e.id}', 'cancelled')">
                  Confirmed ✓ (Cancel)
                </button>
              ` : `
                <button class="btn btn-secondary-pill" onclick="rsvpEvent('${e.id}', 'registered')">
                  Register Now
                </button>
              `
            ) : ''}
            <button class="btn btn-secondary-pill" onclick="downloadEventIcs('${e.id}')" title="Add to Calendar">
              📅 Add to Calendar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCalendar() {
  const container = document.getElementById('eventsList');
  const spotlightContainer = document.getElementById('spotlightEventWrap');

  // Filter based on active controls
  const filtered = calendarEventsCache.filter(e => {
    const isPast = e.is_past === 1 || e.is_past === true;
    if (calendarMode === 'archive' && !isPast) return false;
    if (calendarMode === 'upcoming' && isPast) return false;

    if (calendarFilter.year !== 'all') {
      const yr = parseInt(calendarFilter.year, 10);
      if (e.year !== yr) return false;
    }

    if (calendarFilter.type !== 'all') {
      const t = (e.event_type || '').toLowerCase();
      if (!t.includes(calendarFilter.type.toLowerCase())) return false;
    }

    if (calendarFilter.dest !== 'all') {
      const d = (calendarFilter.dest || '').toLowerCase();
      const content = `${e.city || ''} ${e.location || ''} ${e.title || ''}`.toLowerCase();
      if (!content.includes(d)) return false;
    }

    if (calendarFilter.status !== 'all') {
      if ((e.registration_status || '').toLowerCase() !== calendarFilter.status.toLowerCase()) return false;
    }

    return true;
  });

  // Spotlight Next Event
  if (calendarMode === 'upcoming') {
    const nextEvent = calendarEventsCache.find(e => e.is_next_upcoming === true) || filtered.find(e => e.date_precision !== 'tba');
    if (nextEvent) {
      spotlightContainer.style.display = 'block';
      spotlightContainer.innerHTML = renderSpotlightCard(nextEvent);
    } else {
      spotlightContainer.style.display = 'none';
      spotlightContainer.innerHTML = '';
    }
  } else {
    spotlightContainer.style.display = 'none';
    spotlightContainer.innerHTML = '';
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-calendar-card">
        <h3>No events match your current filter</h3>
        <p>Try resetting the filter criteria to see all community gatherings.</p>
        <button class="btn btn-outline" onclick="resetCalendarFilters()">Reset Filters</button>
      </div>
    `;
    return;
  }

  const datedEvents = filtered.filter(e => e.date_precision !== 'tba');
  const tbaEvents = filtered.filter(e => e.date_precision === 'tba');

  // Group by Year and Month
  const yearMap = new Map();
  datedEvents.forEach(e => {
    const y = e.year || 2027;
    const m = e.month_name || 'Confirmed';
    if (!yearMap.has(y)) yearMap.set(y, new Map());
    const mMap = yearMap.get(y);
    if (!mMap.has(m)) mMap.set(m, []);
    mMap.get(m).push(e);
  });

  let html = '';
  const sortedYears = Array.from(yearMap.keys()).sort((a, b) => a - b);
  sortedYears.forEach(year => {
    html += `
      <div class="chrono-year-group">
        <div class="chrono-year-banner">
          <span class="chrono-year-num">${year}</span>
          <div class="chrono-year-line"></div>
        </div>
    `;

    const mMap = yearMap.get(year);
    mMap.forEach((eventsInMonth, monthName) => {
      html += `
        <div class="chrono-month-group">
          <div class="chrono-month-heading">${monthName.toUpperCase()} ${year}</div>
          <div class="chrono-cards-stack">
            ${eventsInMonth.map(renderCalendarEventCard).join('')}
          </div>
        </div>
      `;
    });

    html += `</div>`;
  });

  // Dates to Be Announced Section
  if (tbaEvents.length > 0) {
    html += `
      <div class="chrono-tba-section">
        <div class="chrono-tba-header">
          <span class="tba-icon">⏰</span>
          <h4>DATES TO BE ANNOUNCED</h4>
        </div>
        <p class="tba-desc">High-level club expeditions in planning. Exact dates will be announced as venues finalize.</p>
        <div class="chrono-cards-stack">
          ${tbaEvents.map(renderCalendarEventCard).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function resetCalendarFilters() {
  calendarFilter = { year: 'all', type: 'all', dest: 'all', status: 'all' };
  document.querySelectorAll('.filter-tag-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.val === 'all'));
  const t = document.getElementById('filterEventType'); if (t) t.value = 'all';
  const d = document.getElementById('filterEventDest'); if (d) d.value = 'all';
  const s = document.getElementById('filterEventStatus'); if (s) s.value = 'all';
  renderCalendar();
}

async function loadEvents() {
  const container = document.getElementById('eventsList');
  container.innerHTML = '<div class="loading-state">Loading chronological calendar...</div>';

  try {
    const res = await fetch(`/api/events?userId=${currentUserId}&include_past=true`);
    calendarEventsCache = await res.json();
    renderCalendar();
  } catch (err) {
    console.error("Error loading events:", err);
    container.innerHTML = '<div class="loading-state">Error loading events.</div>';
  }
}

function openEventDetailModal(eventId) {
  const e = calendarEventsCache.find(x => x.id === eventId);
  if (!e) return;
  currentModalEvent = e;

  const hero = document.getElementById('modalEventHero');
  if (hero) {
    hero.style.backgroundImage = `url('${e.hero_image || 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=1200'}')`;
  }

  document.getElementById('modalHeroBadges').innerHTML = `
    <span class="event-type-tag">${(e.event_type || 'SUMMIT').toUpperCase()}</span>
    ${renderStatusBadgeHtml(e.registration_status)}
  `;

  document.getElementById('modalEventTitle').textContent = e.headline || e.title;
  document.getElementById('modalEventDate').textContent = e.display_date || e.start_date || 'Dates to be announced';
  document.getElementById('modalEventLocation').textContent = e.location;
  document.getElementById('modalEventVenue').textContent = `Venue: ${(e.venue && e.venue !== 'To be confirmed') ? e.venue : 'To be confirmed'}`;
  document.getElementById('modalEventCapacity').textContent = (e.capacity && e.capacity > 0) 
    ? `${e.capacity} Seats · ${e.available_spots ?? 'TBD'} spots available`
    : 'Capacity to be confirmed';

  document.getElementById('modalEventDesc').textContent = e.description;

  const agendaSec = document.getElementById('modalAgendaSection');
  if (e.agenda) {
    agendaSec.style.display = 'block';
    document.getElementById('modalEventAgenda').textContent = e.agenda;
  } else {
    agendaSec.style.display = 'none';
  }

  const travelSec = document.getElementById('modalTravelSection');
  if (e.travel_info) {
    travelSec.style.display = 'block';
    document.getElementById('modalEventTravel').textContent = e.travel_info;
  } else {
    travelSec.style.display = 'none';
  }

  document.getElementById('modalEventPrice').textContent = `Pricing: ${e.price || 'To be confirmed'}`;
  document.getElementById('modalEventInclusions').textContent = e.whats_included || 'Private executive sessions, networking receptions, curated dinners, and masterclasses.';

  const rsvpBtn = document.getElementById('modalRsvpBtn');
  if (e.registration_status === 'open') {
    rsvpBtn.style.display = 'inline-block';
    rsvpBtn.textContent = e.user_rsvp === 'registered' ? 'Cancel Registration' : 'Confirm Registration & Reserve Seat';
  } else {
    rsvpBtn.style.display = 'none';
  }

  openModal('eventDetailModal');
}

function downloadModalIcs() {
  if (currentModalEvent) downloadEventIcs(currentModalEvent.id);
}

function downloadEventIcs(eventId) {
  window.open(`/api/events/${eventId}/ics`, '_blank');
}

function openModalGoogleCalendar() {
  if (!currentModalEvent) return;
  const e = currentModalEvent;
  const title = encodeURIComponent(`ÖZARA: ${e.headline || e.title}`);
  const details = encodeURIComponent(e.description || '');
  const location = encodeURIComponent((e.venue && e.venue !== 'To be confirmed' ? `${e.venue}, ` : '') + (e.location || ''));
  let datesParam = '';
  if (e.start_date && e.end_date) {
    datesParam = `&dates=${e.start_date.replace(/-/g, '')}/${e.end_date.replace(/-/g, '')}`;
  }
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}${datesParam}`;
  window.open(url, '_blank');
}

async function rsvpFromModal() {
  if (!currentModalEvent) return;
  const nextStatus = currentModalEvent.user_rsvp === 'registered' ? 'cancelled' : 'registered';
  await rsvpEvent(currentModalEvent.id, nextStatus);
  closeModal('eventDetailModal');
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
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-sm btn-outline" onclick="openProfileDrawer('${m.id}')">
                View Profile & Answers
              </button>
              <button class="btn btn-sm btn-ghost-pill" onclick="startDirectMessage('${m.id}', '${m.full_name}')" title="Confidential direct message">
                ✉ Message
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
// 3. INVESTMENTS (CURATED REAL ESTATE & TECH) (THIRD VIEW)
// -------------------------------------------------------------

let invTopTab = 'real_estate';       // 'real_estate' | 'private_tech'
let invViewMode = 'landing';         // 'landing' | 'results'
let invSelectedCategory = 'All Properties';
let invCategories = [];
let invFilterOptions = null;
let invListings = [];
let invCardPhotoIndices = {};        // listingId -> photo index
let activePropDetail = null;
let activePropModalPhotoIndex = 0;
let invTouchStartX = 0;

const INV_STATE_KEY = 'ozara_investments_state_v1';

function saveInvestmentState() {
  try {
    const countryEl = document.getElementById('invFilterCountry');
    const cityEl = document.getElementById('invFilterCity');
    const budgetEl = document.getElementById('invFilterBudget');
    const bedroomsEl = document.getElementById('invFilterBedrooms');
    const typeEl = document.getElementById('invFilterType');
    const featEl = document.getElementById('invFilterFeatures');
    const sortEl = document.getElementById('invFilterSort');

    const state = {
      topTab: invTopTab,
      viewMode: invViewMode,
      category: invSelectedCategory,
      country: countryEl ? countryEl.value : 'all',
      city: cityEl ? cityEl.value : 'all',
      budget: budgetEl ? budgetEl.value : 'any',
      bedrooms: bedroomsEl ? bedroomsEl.value : 'any',
      type: typeEl ? typeEl.value : 'all',
      features: featEl ? featEl.value : '',
      sort: sortEl ? sortEl.value : 'newest',
      scrollY: window.scrollY || 0
    };
    sessionStorage.setItem(INV_STATE_KEY, JSON.stringify(state));
  } catch (e) {}
}

function restoreInvestmentState() {
  try {
    const raw = sessionStorage.getItem(INV_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function switchInvestmentTopTab(tab) {
  invTopTab = tab;
  const reBtn = document.getElementById('tabRealEstateBtn');
  const techBtn = document.getElementById('tabPrivateTechBtn');
  const reSec = document.getElementById('investmentsRealEstateSection');
  const techSec = document.getElementById('investmentsPrivateTechSection');

  if (reBtn && techBtn && reSec && techSec) {
    if (tab === 'real_estate') {
      reBtn.classList.add('active');
      techBtn.classList.remove('active');
      reSec.style.display = 'block';
      techSec.style.display = 'none';
    } else {
      reBtn.classList.remove('active');
      techBtn.classList.add('active');
      reSec.style.display = 'none';
      techSec.style.display = 'block';
    }
  }
  saveInvestmentState();
}

let invTotalProperties = 239;

const CANONICAL_REAL_ESTATE_TYPES = [
  { name: 'Residential', icon_url: '/investments/icons/residential.png' },
  { name: 'Commercial', icon_url: '/investments/icons/commercial.png' },
  { name: 'Parking', icon_url: '/investments/icons/parking.png' },
  { name: 'Land', icon_url: '/investments/icons/land.png' },
  { name: 'Countryside', icon_url: '/investments/icons/countryside.png' },
  { name: 'Private Islands', icon_url: '/investments/icons/private_islands.png' },
  { name: 'Pools', icon_url: '/investments/icons/pools.png' }
];

function openRealEstateBrowsing(categoryName) {
  openCategoryResults(categoryName || 'All Properties');
}

function openPrivateTechModal() {
  openModal('privateTechModal');
}

async function loadInvestments() {
  const savedState = restoreInvestmentState();

  try {
    const res = await fetch('/api/investments/categories');
    const data = await res.json();
    invCategories = data.categories || [];
    invTotalProperties = data.total_properties || data.total_count || 239;

    const countBadge = document.getElementById('reTotalCountBadge');
    if (countBadge) countBadge.textContent = `${invTotalProperties} Properties`;

    setupInvestmentDropdownClicks();
    fetch('/api/investments/catalog?limit=1')
      .then(r => r.json())
      .then(d => {
        if (d && d.filter_options) populateFilterDropdownOptions(d.filter_options);
      })
      .catch(() => {});

    if (savedState && savedState.viewMode === 'results') {
      const catExists = savedState.category === 'All Properties' || 
                        savedState.category === 'All Listings' ||
                        CANONICAL_REAL_ESTATE_TYPES.some(c => c.name.toLowerCase() === (savedState.category || '').toLowerCase()) ||
                        invCategories.some(c => c.name.toLowerCase() === (savedState.category || '').toLowerCase());
      if (catExists) {
        invSelectedCategory = savedState.category;
      } else {
        invSelectedCategory = 'All Properties';
        const alertEl = document.getElementById('categoryRemovedAlert');
        if (alertEl) alertEl.style.display = 'flex';
      }

      await openCategoryResults(invSelectedCategory, true, savedState);
      if (savedState.scrollY) {
        window.scrollTo({ top: savedState.scrollY, behavior: 'instant' });
      }
    } else {
      backToInvestmentsLanding(false);
    }
  } catch (err) {
    console.error('Error loading investments categories:', err);
  }
}

function renderLandingCategoryTiles(totalCount) {
  // Maintained for backward compatibility with automated test suites
  const container = document.getElementById('landingCategoryTiles');
  if (!container) return;
  const total = totalCount || invTotalProperties || 239;

  let html = `
    <div class="landing-cat-tile" onclick="openCategoryResults('All Properties')">
      <div class="landing-cat-top">
        <div>
          <div class="landing-cat-name">All Properties</div>
          <div class="landing-cat-count">${total} properties available</div>
        </div>
      </div>
      <div class="landing-cat-icon-wrap">
        <img src="/investments/icons/fallback.png" alt="All Properties" class="landing-cat-icon">
      </div>
    </div>
  `;

  html += invCategories.map(cat => {
    return `
      <div class="landing-cat-tile" onclick="openCategoryResults('${cat.name}')">
        <div class="landing-cat-top">
          <div>
            <div class="landing-cat-name">${cat.name}</div>
            <div class="landing-cat-count">${cat.count} ${cat.count === 1 ? 'property' : 'properties'}</div>
          </div>
        </div>
        <div class="landing-cat-icon-wrap">
          <img src="${cat.icon_url}" alt="${cat.name}" class="landing-cat-icon" onerror="this.src='/investments/icons/fallback.png'">
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

async function openCategoryResults(categoryName, isRestoring = false, savedState = null) {
  invViewMode = 'results';
  invSelectedCategory = categoryName || 'All Properties';

  const landingView = document.getElementById('investmentsLandingView');
  const resultsView = document.getElementById('investmentsResultsView');
  if (landingView) landingView.style.display = 'none';
  if (resultsView) resultsView.style.display = 'block';

  const breadcrumb = document.getElementById('activeCategoryBreadcrumb');
  if (breadcrumb) {
    breadcrumb.textContent = (invSelectedCategory === 'All Properties' || invSelectedCategory === 'all') ? 'All Listings' : invSelectedCategory;
  }

  renderCompactCategoryStrip();

  // Synchronize Property Type Dropdown matching Attachment 5
  const typeSelect = document.getElementById('invFilterType');
  if (typeSelect) {
    let opts = '<option value="all">All Listings</option>';
    CANONICAL_REAL_ESTATE_TYPES.forEach(t => {
      opts += `<option value="${t.name}">${t.name}</option>`;
    });

    // Also include any extra dynamic categories from server that aren't in canonical list
    invCategories.forEach(c => {
      if (!CANONICAL_REAL_ESTATE_TYPES.some(t => t.name.toLowerCase() === c.name.toLowerCase())) {
        opts += `<option value="${c.name}">${c.name}</option>`;
      }
    });

    typeSelect.innerHTML = opts;

    if (invSelectedCategory !== 'All Properties' && invSelectedCategory !== 'All Listings' && invSelectedCategory !== 'all') {
      typeSelect.value = invSelectedCategory;
    } else {
      typeSelect.value = 'all';
    }
  }

  // Restore filter values if restoring
  if (isRestoring && savedState) {
    if (savedState.country && document.getElementById('invFilterCountry')) document.getElementById('invFilterCountry').value = savedState.country;
    if (savedState.budget && document.getElementById('invFilterBudget')) document.getElementById('invFilterBudget').value = savedState.budget;
    if (savedState.bedrooms && document.getElementById('invFilterBedrooms')) document.getElementById('invFilterBedrooms').value = savedState.bedrooms;
    if (savedState.sort && document.getElementById('invFilterSort')) document.getElementById('invFilterSort').value = savedState.sort;
  }

  await fetchAndRenderCatalogListings();
  saveInvestmentState();
}

function backToInvestmentsLanding(shouldSave = true) {
  invViewMode = 'landing';
  const landingView = document.getElementById('investmentsLandingView');
  const resultsView = document.getElementById('investmentsResultsView');
  if (landingView) landingView.style.display = 'block';
  if (resultsView) resultsView.style.display = 'none';
  if (shouldSave) saveInvestmentState();
}

function renderCompactCategoryStrip() {
  const container = document.getElementById('resultsCategoryStrip');
  if (!container) return;

  const isAll = (invSelectedCategory === 'All Properties' || invSelectedCategory === 'All Listings' || invSelectedCategory === 'all');
  const total = invTotalProperties || 239;

  // Build the complete list of 8 category tiles from the reference attachments
  let tiles = [
    {
      name: 'All Properties',
      countStr: `${total} properties available`,
      icon_url: '/investments/icons/fallback.png',
      isAct: isAll
    }
  ];

  CANONICAL_REAL_ESTATE_TYPES.forEach(t => {
    const found = invCategories.find(c => c.name.toLowerCase() === t.name.toLowerCase());
    const cnt = found ? found.count : 0;
    const isAct = (invSelectedCategory.toLowerCase() === t.name.toLowerCase());
    tiles.push({
      name: t.name,
      countStr: `${cnt} ${cnt === 1 ? 'property' : 'properties'}`,
      icon_url: t.icon_url,
      isAct: isAct
    });
  });

  // Include any extra categories from DB
  invCategories.forEach(c => {
    if (!CANONICAL_REAL_ESTATE_TYPES.some(t => t.name.toLowerCase() === c.name.toLowerCase())) {
      const isAct = (invSelectedCategory.toLowerCase() === c.name.toLowerCase());
      tiles.push({
        name: c.name,
        countStr: `${c.count} ${c.count === 1 ? 'property' : 'properties'}`,
        icon_url: c.icon_url,
        isAct: isAct
      });
    }
  });

  let html = tiles.map(tile => {
    return `
      <div class="compact-cat-tile ${tile.isAct ? 'active' : ''}" onclick="selectResultsCategory('${tile.name}')">
        <div class="compact-cat-info">
          <div class="compact-cat-title-row">
            <span class="compact-cat-name">${tile.name}</span>
            ${tile.isAct ? '<span class="compact-cat-check">✓</span>' : ''}
          </div>
          <span class="compact-cat-count">${tile.countStr}</span>
        </div>
        <div class="compact-cat-icon-wrap">
          <img src="${tile.icon_url}" alt="${tile.name}" class="compact-cat-icon" onerror="this.src='/investments/icons/fallback.png'">
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function selectResultsCategory(categoryName) {
  if (invSelectedCategory === categoryName && categoryName !== 'All Properties' && categoryName !== 'all') {
    invSelectedCategory = 'All Properties';
  } else {
    invSelectedCategory = categoryName;
  }

  const typeSelect = document.getElementById('invFilterType');
  if (typeSelect) {
    if (invSelectedCategory === 'All Properties' || invSelectedCategory === 'All Listings' || invSelectedCategory === 'all') {
      typeSelect.value = 'all';
    } else {
      typeSelect.value = invSelectedCategory;
    }
  }

  const breadcrumb = document.getElementById('activeCategoryBreadcrumb');
  if (breadcrumb) {
    breadcrumb.textContent = (invSelectedCategory === 'All Properties' || invSelectedCategory === 'all') ? 'All Listings' : invSelectedCategory;
  }

  renderCompactCategoryStrip();
  fetchAndRenderCatalogListings();
  saveInvestmentState();
}

function handleInvTypeDropdownChange(val) {
  if (val === 'all' || val === 'All Listings' || val === 'All Properties') {
    invSelectedCategory = 'All Properties';
  } else {
    invSelectedCategory = val;
  }

  const breadcrumb = document.getElementById('activeCategoryBreadcrumb');
  if (breadcrumb) {
    breadcrumb.textContent = (invSelectedCategory === 'All Properties') ? 'All Listings' : invSelectedCategory;
  }

  renderCompactCategoryStrip();
  fetchAndRenderCatalogListings();
  saveInvestmentState();
}

window.openRealEstateBrowsing = openRealEstateBrowsing;
window.openPrivateTechModal = openPrivateTechModal;
window.backToInvestmentsLanding = backToInvestmentsLanding;
window.selectResultsCategory = selectResultsCategory;
window.handleInvTypeDropdownChange = handleInvTypeDropdownChange;

function handleInvCountryChange(countryVal) {
  updateCityOptions(countryVal, invFilterOptions);
  handleInvFilterChange();
}

function updateCityOptions(countryVal, opts = invFilterOptions) {
  const citySelect = document.getElementById('invFilterCity');
  if (!citySelect) return;
  const curVal = citySelect.value;

  let cityList = [];
  if (opts && opts.cities_by_country) {
    if (countryVal && countryVal !== 'all' && opts.cities_by_country[countryVal]) {
      cityList = opts.cities_by_country[countryVal];
    } else {
      const set = new Set();
      Object.values(opts.cities_by_country).forEach(arr => {
        if (Array.isArray(arr)) arr.forEach(c => set.add(c));
      });
      cityList = Array.from(set).sort();
    }
  }

  if (cityList.length > 0) {
    const isFiltered = curVal && curVal !== 'all';
    let optsHtml = `<option value="all">${isFiltered ? '✕ Clear City' : 'City'}</option>`;
    cityList.forEach(c => {
      optsHtml += `<option value="${c}">${c}</option>`;
    });
    citySelect.innerHTML = optsHtml;
    citySelect.value = (curVal && cityList.includes(curVal)) ? curVal : 'all';
  }
}

function syncFilterClearButtons() {
  const configs = [
    { selId: 'invFilterCountry', wrapId: 'wrapInvFilterCountry', defaultVal: 'all', label: 'Country' },
    { selId: 'invFilterCity', wrapId: 'wrapInvFilterCity', defaultVal: 'all', label: 'City' },
    { selId: 'invFilterBudget', wrapId: 'wrapInvFilterBudget', defaultVal: 'any', label: 'Budget' },
    { selId: 'invFilterBedrooms', wrapId: 'wrapInvFilterBedrooms', defaultVal: 'any', label: 'Bedrooms' },
    { selId: 'invFilterFeatures', wrapId: 'wrapInvFilterFeatures', defaultVal: '', label: 'Features' },
    { selId: 'invFilterSort', wrapId: 'wrapInvFilterSort', defaultVal: 'newest', label: 'Sort' },
  ];

  configs.forEach(cfg => {
    const sel = document.getElementById(cfg.selId);
    const wrap = document.getElementById(cfg.wrapId);
    if (!sel || !wrap) return;
    const isFiltered = sel.value && sel.value !== cfg.defaultVal;
    if (isFiltered) {
      wrap.classList.add('has-value');
    } else {
      wrap.classList.remove('has-value');
    }

    if (sel.options && sel.options.length > 0) {
      const firstOpt = sel.options[0];
      if (firstOpt.value === cfg.defaultVal) {
        if (isFiltered) {
          firstOpt.textContent = `✕ Clear ${cfg.label}`;
        } else {
          firstOpt.textContent = cfg.label === 'Sort' ? 'Best Match' : cfg.label;
        }
      }
    }
  });

  const eventConfigs = [
    { selId: 'filterEventType', wrapId: 'wrapEventFilterType', defaultVal: 'all', label: 'Type' },
    { selId: 'filterEventDest', wrapId: 'wrapEventFilterDest', defaultVal: 'all', label: 'Destination' },
    { selId: 'filterEventStatus', wrapId: 'wrapEventFilterStatus', defaultVal: 'all', label: 'Status' },
  ];
  eventConfigs.forEach(cfg => {
    const sel = document.getElementById(cfg.selId);
    const wrap = document.getElementById(cfg.wrapId);
    if (!sel || !wrap) return;
    const isFiltered = sel.value && sel.value !== cfg.defaultVal;
    if (isFiltered) {
      wrap.classList.add('has-value');
    } else {
      wrap.classList.remove('has-value');
    }
    if (sel.options && sel.options.length > 0) {
      const firstOpt = sel.options[0];
      if (firstOpt.value === cfg.defaultVal) {
        if (isFiltered) {
          firstOpt.textContent = `✕ Clear ${cfg.label}`;
        } else {
          firstOpt.textContent = `All ${cfg.label}s`;
        }
      }
    }
  });
}

function clearSpecificFilter(filterType, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  if (filterType === 'country') {
    const el = document.getElementById('invFilterCountry');
    if (el) el.value = 'all';
    updateCityOptions('all', invFilterOptions);
    const cityEl = document.getElementById('invFilterCity');
    if (cityEl) cityEl.value = 'all';
    handleInvFilterChange();
  } else if (filterType === 'city') {
    const el = document.getElementById('invFilterCity');
    if (el) el.value = 'all';
    handleInvFilterChange();
  } else if (filterType === 'budget') {
    const el = document.getElementById('invFilterBudget');
    if (el) el.value = 'any';
    handleInvFilterChange();
  } else if (filterType === 'bedrooms') {
    const el = document.getElementById('invFilterBedrooms');
    if (el) el.value = 'any';
    handleInvFilterChange();
  } else if (filterType === 'features') {
    const el = document.getElementById('invFilterFeatures');
    if (el) el.value = '';
    handleInvFilterChange();
  } else if (filterType === 'sort') {
    const el = document.getElementById('invFilterSort');
    if (el) el.value = 'newest';
    handleInvFilterChange();
  } else if (filterType === 'event_type') {
    const el = document.getElementById('filterEventType');
    if (el) el.value = 'all';
    filterEvents('type', 'all');
  } else if (filterType === 'event_dest') {
    const el = document.getElementById('filterEventDest');
    if (el) el.value = 'all';
    filterEvents('dest', 'all');
  } else if (filterType === 'event_status') {
    const el = document.getElementById('filterEventStatus');
    if (el) el.value = 'all';
    filterEvents('status', 'all');
  }

  syncFilterClearButtons();
}

function handleInvFilterChange() {
  syncFilterClearButtons();
  fetchAndRenderCatalogListings();
  saveInvestmentState();
}

function setupInvestmentDropdownClicks() {
  document.querySelectorAll('.inv-dropdown-wrap, .inv-sort-wrap').forEach(wrap => {
    if (wrap.dataset.clicksBound) return;
    wrap.dataset.clicksBound = 'true';
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('.inv-dd-clear')) return;
      const sel = wrap.querySelector('select');
      if (sel && e.target !== sel) {
        if (typeof sel.showPicker === 'function') {
          try { sel.showPicker(); } catch (err) { sel.focus(); }
        } else {
          sel.focus();
        }
      }
    });
  });
}

function clearAllInvestmentFilters() {
  const countryEl = document.getElementById('invFilterCountry');
  const cityEl = document.getElementById('invFilterCity');
  const budgetEl = document.getElementById('invFilterBudget');
  const bedroomsEl = document.getElementById('invFilterBedrooms');
  const featEl = document.getElementById('invFilterFeatures');
  const sortEl = document.getElementById('invFilterSort');

  if (countryEl) countryEl.value = 'all';
  if (cityEl) {
    updateCityOptions('all', invFilterOptions);
    cityEl.value = 'all';
  }
  if (budgetEl) budgetEl.value = 'any';
  if (bedroomsEl) bedroomsEl.value = 'any';
  if (featEl) featEl.value = '';
  if (sortEl) sortEl.value = 'newest';

  invSelectedCategory = 'All Properties';
  const breadcrumb = document.getElementById('activeCategoryBreadcrumb');
  if (breadcrumb) breadcrumb.textContent = 'All Properties';

  renderCompactCategoryStrip();
  fetchAndRenderCatalogListings();
  saveInvestmentState();
  syncFilterClearButtons();
}

window.handleInvCountryChange = handleInvCountryChange;
window.handleInvFilterChange = handleInvFilterChange;
window.clearAllInvestmentFilters = clearAllInvestmentFilters;
window.clearSpecificFilter = clearSpecificFilter;
window.syncFilterClearButtons = syncFilterClearButtons;
window.updateCityOptions = updateCityOptions;
window.setupInvestmentDropdownClicks = setupInvestmentDropdownClicks;

async function fetchAndRenderCatalogListings() {
  const grid = document.getElementById('listingsGrid');
  if (grid) grid.innerHTML = '<div class="loading-state">Fetching verified property portfolios...</div>';

  const country = document.getElementById('invFilterCountry')?.value || 'all';
  const city = document.getElementById('invFilterCity')?.value || 'all';
  const budget = document.getElementById('invFilterBudget')?.value || 'any';
  const bedrooms = document.getElementById('invFilterBedrooms')?.value || 'any';
  const features = document.getElementById('invFilterFeatures')?.value || '';
  const sort = document.getElementById('invFilterSort')?.value || 'newest';

  let budgetMin = 0;
  let budgetMax = 0;
  if (budget && budget !== 'any') {
    const parts = budget.split('-');
    budgetMin = parseFloat(parts[0]) || 0;
    budgetMax = parseFloat(parts[1]) || 0;
  }

  const effectiveType = (invSelectedCategory !== 'All Properties' && invSelectedCategory !== 'all') ? invSelectedCategory : (document.getElementById('invFilterType')?.value || 'all');

  const params = new URLSearchParams();
  if (effectiveType && effectiveType !== 'all') params.append('type', effectiveType);
  if (country !== 'all') params.append('country', country);
  if (city !== 'all') params.append('city', city);
  if (bedrooms !== 'any') params.append('bedrooms', bedrooms);
  if (features) params.append('features', features);
  if (budgetMin > 0) params.append('budgetMin', budgetMin);
  if (budgetMax > 0) params.append('budgetMax', budgetMax);
  if (sort) params.append('sort', sort);
  if (currentUserId) params.append('viewerId', currentUserId);
  params.append('limit', '60');

  try {
    const res = await fetch(`/api/investments/catalog?${params.toString()}`);
    const data = await res.json();
    invListings = data.listings || [];
    invFilterOptions = data.filter_options || null;

    // Populate dropdowns once if available
    populateFilterDropdownOptions(data.filter_options);

    // Update Result count
    const countEl = document.getElementById('investmentsResultsCount');
    if (countEl) {
      countEl.textContent = `${data.total} properties found`;
    }

    if (!invListings.length) {
      grid.innerHTML = '<div class="empty-state">No matching properties found. Try clearing your filters.</div>';
      return;
    }

    grid.innerHTML = invListings.map(item => {
      const images = item.images && item.images.length > 0 ? item.images : ['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800'];
      const curIndex = invCardPhotoIndices[item.id] || 0;
      const displayImg = images[curIndex] || images[0];
      const hasMultiple = images.length > 1;

      // Format specs
      const specParts = [];
      if (item.bedrooms_range) specParts.push(`${item.bedrooms_range} bedrooms`);
      else if (item.beds !== null && item.beds !== undefined) specParts.push(`${item.beds} bed`);
      if (item.completion_status) specParts.push(item.completion_status);
      if (item.features && item.features.length) specParts.push(item.features[0]);

      const specsLine = specParts.join(' · ') || 'Verified ÖZARA Portfolio';

      return `
        <div class="prop-card" onclick="openPropertyDetailModal('${item.id}')">
          <!-- 4:3 Image Container with Carousel Navigation -->
          <div class="prop-card-img-wrap" 
               id="imgWrap_${item.id}"
               ontouchstart="handleCardTouchStart(event)" 
               ontouchend="handleCardTouchEnd(event, '${item.id}')">
            <img src="${displayImg}" 
                 id="cardImg_${item.id}" 
                 alt="${item.title}" 
                 class="prop-card-img" 
                 loading="lazy">

            ${hasMultiple ? `
              <button class="prop-carousel-btn prop-carousel-prev" 
                      title="Previous photo" 
                      onclick="navigateCardPhoto('${item.id}', -1, event)">‹</button>
              <button class="prop-carousel-btn prop-carousel-next" 
                      title="Next photo" 
                      onclick="navigateCardPhoto('${item.id}', 1, event)">›</button>
            ` : ''}

            <div class="prop-photo-counter" id="photoCount_${item.id}">
              📷 ${curIndex + 1} / ${images.length}
            </div>

            <button class="prop-card-save-btn ${item.is_saved ? 'saved' : ''}" 
                    title="${item.is_saved ? 'Saved' : 'Save property'}" 
                    onclick="toggleSaveInvestmentListing('${item.id}', event)">
              ${item.is_saved ? '★' : '☆'}
            </button>
          </div>

          <!-- Card Body -->
          <div class="prop-card-body">
            <div class="prop-card-location" title="${item.location}">
              📍 ${item.location || item.city || item.country}
            </div>
            <h3 class="prop-card-title" title="${item.title}">${item.title}</h3>
            <div class="prop-card-price">${item.price_display}</div>
            <div class="prop-card-specs" title="${specsLine}">${specsLine}</div>

            <div class="prop-card-actions">
              <span class="badge badge-outline" style="font-size: 0.7rem;">${item.property_type}</span>
              <button class="btn btn-sm btn-white-pill" onclick="event.stopPropagation(); openPropertyDetailModal('${item.id}')">
                Details →
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Error fetching catalog listings:', err);
    if (grid) grid.innerHTML = '<div class="loading-state">Error loading properties.</div>';
  }
}

function populateFilterDropdownOptions(opts) {
  if (!opts) return;
  invFilterOptions = opts;

  const countryEl = document.getElementById('invFilterCountry');
  if (countryEl && opts.countries && opts.countries.length) {
    const curVal = countryEl.value;
    const isFiltered = curVal && curVal !== 'all';
    let html = `<option value="all">${isFiltered ? '✕ Clear Country' : 'Country'}</option>`;
    const uniqueCountries = Array.from(new Set(opts.countries.filter(Boolean))).sort();
    uniqueCountries.forEach(c => {
      html += `<option value="${c}">${c}</option>`;
    });
    countryEl.innerHTML = html;
    countryEl.value = (curVal && uniqueCountries.includes(curVal)) ? curVal : 'all';
  }

  updateCityOptions(countryEl ? countryEl.value : 'all', opts);
  setupInvestmentDropdownClicks();
  syncFilterClearButtons();
}

function navigateCardPhoto(listingId, delta, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const listing = invListings.find(l => l.id === listingId);
  if (!listing || !listing.images || listing.images.length <= 1) return;

  const total = listing.images.length;
  const current = invCardPhotoIndices[listingId] || 0;
  const next = (current + delta + total) % total;
  invCardPhotoIndices[listingId] = next;

  const imgEl = document.getElementById(`cardImg_${listingId}`);
  const counterEl = document.getElementById(`photoCount_${listingId}`);
  if (imgEl) imgEl.src = listing.images[next];
  if (counterEl) counterEl.textContent = `📷 ${next + 1} / ${total}`;
}

function handleCardTouchStart(e) {
  if (e.touches && e.touches[0]) {
    invTouchStartX = e.touches[0].clientX;
  }
}

function handleCardTouchEnd(e, listingId) {
  if (!e.changedTouches || !e.changedTouches[0]) return;
  const touchEndX = e.changedTouches[0].clientX;
  const diff = touchEndX - invTouchStartX;

  if (Math.abs(diff) > 40) {
    // Left swipe = next, Right swipe = prev
    if (diff < 0) {
      navigateCardPhoto(listingId, 1, e);
    } else {
      navigateCardPhoto(listingId, -1, e);
    }
  }
}

async function toggleSaveInvestmentListing(listingId, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  if (!currentUserId) {
    showToast("Please select a profile to save properties.", "error");
    return;
  }

  const item = invListings.find(l => l.id === listingId);
  if (item) {
    item.is_saved = !item.is_saved;
    const btn = event.currentTarget;
    if (btn) {
      btn.classList.toggle('saved', item.is_saved);
      btn.textContent = item.is_saved ? '★' : '☆';
    }
  }

  try {
    await fetch(`/api/investments/saved/${listingId}?viewerId=${currentUserId}`, { method: 'POST' });
    showToast(item && item.is_saved ? "Property saved to your watchlist" : "Property removed from watchlist", "success");
  } catch (err) {
    console.error('Error toggling saved listing:', err);
  }
}

async function openPropertyDetailModal(listingId) {
  const listing = invListings.find(l => l.id === listingId);
  if (!listing) return;

  activePropDetail = listing;
  activePropModalPhotoIndex = 0;

  // Header
  document.getElementById('propModalTypeTag').textContent = listing.property_type || 'Residential';
  document.getElementById('propModalTitle').textContent = listing.title;
  document.getElementById('propModalLocation').textContent = `📍 ${listing.location || listing.city || listing.country}`;

  // Gallery
  updatePropModalGallery();

  // Specs highlights
  document.getElementById('propModalPrice').textContent = listing.price_display;
  document.getElementById('propModalBeds').textContent = listing.bedrooms_range || (listing.beds !== null ? `${listing.beds} beds` : '-');
  document.getElementById('propModalArea').textContent = listing.area_range || (listing.sqft ? `${listing.sqft} sqft` : '-');
  document.getElementById('propModalHandover').textContent = listing.completion_status || listing.handover || 'Available';

  // Description
  document.getElementById('propModalDescription').textContent = listing.description_full || listing.description || 'Verified private catalog property.';

  // Features
  const featBlock = document.getElementById('propModalFeaturesBlock');
  const featList = document.getElementById('propModalFeaturesList');
  if (listing.features && listing.features.length) {
    featBlock.style.display = 'block';
    featList.innerHTML = listing.features.map(f => `<span class="prop-feature-pill">${f}</span>`).join('');
  } else {
    featBlock.style.display = 'none';
  }

  // Payment terms
  const payBlock = document.getElementById('propModalPaymentBlock');
  const payText = document.getElementById('propModalPaymentTerms');
  if (listing.payment_terms && listing.payment_terms.installment_plan) {
    payBlock.style.display = 'block';
    payText.textContent = listing.payment_terms.installment_plan;
  } else {
    payBlock.style.display = 'none';
  }

  // Units block
  const unitsBlock = document.getElementById('propModalUnitsBlock');
  if (listing.has_units) {
    unitsBlock.style.display = 'block';
    loadPropertyUnits(listing.id);
  } else {
    unitsBlock.style.display = 'none';
  }

  openModal('propertyDetailModal');
}

function updatePropModalGallery() {
  if (!activePropDetail) return;
  const images = activePropDetail.images && activePropDetail.images.length ? activePropDetail.images : ['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800'];
  const curImg = images[activePropModalPhotoIndex] || images[0];

  const mainPhoto = document.getElementById('propModalMainPhoto');
  if (mainPhoto) mainPhoto.src = curImg;

  const countBadge = document.getElementById('propModalPhotoCount');
  if (countBadge) countBadge.textContent = `${activePropModalPhotoIndex + 1} / ${images.length}`;

  const thumbsContainer = document.getElementById('propModalThumbnails');
  if (thumbsContainer) {
    thumbsContainer.innerHTML = images.map((img, idx) => `
      <img src="${img}" 
           alt="Thumb ${idx + 1}" 
           class="prop-thumb-item ${idx === activePropModalPhotoIndex ? 'active' : ''}" 
           onclick="selectPropModalPhoto(${idx})">
    `).join('');
  }
}

function prevPropModalPhoto() {
  if (!activePropDetail || !activePropDetail.images) return;
  const total = activePropDetail.images.length;
  activePropModalPhotoIndex = (activePropModalPhotoIndex - 1 + total) % total;
  updatePropModalGallery();
}

function nextPropModalPhoto() {
  if (!activePropDetail || !activePropDetail.images) return;
  const total = activePropDetail.images.length;
  activePropModalPhotoIndex = (activePropModalPhotoIndex + 1) % total;
  updatePropModalGallery();
}

function selectPropModalPhoto(idx) {
  activePropModalPhotoIndex = idx;
  updatePropModalGallery();
}

async function loadPropertyUnits(listingId) {
  const listEl = document.getElementById('propModalUnitsList');
  const countEl = document.getElementById('propModalUnitsCount');
  if (!listEl) return;
  listEl.innerHTML = '<div class="loading-state">Loading development units...</div>';

  try {
    const res = await fetch(`/api/investments/catalog/${listingId}/units`);
    const units = await res.json();
    if (countEl) countEl.textContent = units.length;

    if (!units.length) {
      listEl.innerHTML = '<div class="muted-text">No separate units published for this project.</div>';
      return;
    }

    listEl.innerHTML = units.map(u => `
      <div class="prop-unit-card">
        <div class="unit-card-title">${u.title}</div>
        <div class="unit-card-price">${u.price_display}</div>
        <div class="unit-card-specs">${u.area_range || ''} · ${u.bedrooms_range ? `${u.bedrooms_range} bed` : ''}</div>
      </div>
    `).join('');
  } catch (err) {
    listEl.innerHTML = '<div class="muted-text">Could not load units.</div>';
  }
}

function triggerInquiryFromDetail() {
  if (!activePropDetail) return;
  closeModal('propertyDetailModal');
  openReInquiryModal(activePropDetail.id, activePropDetail.title);
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
    const isFounder = (viewer && (viewer.role === 'FOUNDER' || viewer.role === 'ADMIN'));

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
    const editorTabBtn = document.getElementById('drawerTabEditorBtn');
    if (editorTabBtn) {
      editorTabBtn.style.display = (isSelf || isFounder) ? 'inline-block' : 'none';
    }
    const adminTabBtn = document.getElementById('drawerTabAdminBtn');
    if (adminTabBtn) {
      adminTabBtn.style.display = isFounder ? 'inline-block' : 'none';
    }

    if (!isSelf) {
      const isDirect = data.contact_preference === 'direct_contact';
      actionContainer.innerHTML = `
        <button class="btn btn-sm btn-ghost-pill" onclick="startDirectMessage('${data.id}', '${data.full_name}')" style="margin-right: 0.5rem;" title="Confidential direct message">
          ✉ Message
        </button>
        ${isDirect ? `
          <button class="btn btn-sm btn-white-pill" onclick="openCallModal('${data.id}', '${data.full_name}')">
            Schedule Call
          </button>
        ` : `
          <button class="btn btn-sm btn-outline" onclick="openAskIntroModal('${data.id}')">
            Ask Team for Intro
          </button>
        `}
      `;
    } else {
      actionContainer.innerHTML = `
        ${isFounder ? `
          <button class="btn btn-sm btn-outline" onclick="switchDrawerTab('admin')" style="margin-right: 0.4rem;">
            ⚙ Admin Dashboard
          </button>
        ` : ''}
        <button class="btn btn-sm btn-white-pill" onclick="switchDrawerTab('editor')">
          ✎ Edit Profile
        </button>
      `;
    }

    // Populate Tab 1: Polished Networking Profile Overview
    renderNetworkingProfile(data, isSelf, isFounder);

    // Populate Tab 2: Questionnaire Editor (Grouped by Canonical Sections)
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
              <span class="q-num">Q${a.question_id}</span>
              <div>
                <span class="q-prompt">${a.prompt}</span>
                ${isQ18 ? `<div class="q18-required-badge" style="margin-top: 0.35rem;">★ Mandatory Completion Question</div>` : ''}
              </div>
            </div>

            <div class="q-controls">
              ${isQ23 ? `
                <div class="q23-lock-shield">
                  🔒 Private
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

    // Populate Tab 3: Travel Plans & Chapter Gathering
    const trvContainer = document.getElementById('drawerTravelContainer');
    trvContainer.innerHTML = data.travel_plans.map(tp => `
      <div class="rationale-box" style="margin-bottom: 0.85rem;">
        <span class="rationale-label">✈ ${tp.city}, ${tp.country}</span>
        <p class="rationale-text">${tp.start_date} to ${tp.end_date} — ${tp.notes || 'No notes specified'}</p>
      </div>
    `).join('') || '<p class="muted-text">No active travel scheduled.</p>';

    // Switch to profile overview tab by default (or editor if focusing specific question)
    if (focusQuestionId) {
      switchDrawerTab('editor');
      setTimeout(() => {
        const targetCard = document.getElementById(`drawer-q${focusQuestionId}-card`);
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetCard.style.outline = '2px solid var(--gold-primary)';
          setTimeout(() => { targetCard.style.outline = ''; }, 2500);
        }
      }, 350);
    } else {
      switchDrawerTab('overview');
    }

  } catch (err) {
    console.error("Error opening profile drawer:", err);
  }
}

// -------------------------------------------------------------
// POLISHED PROFESSIONAL NETWORKING PROFILE RENDERER (WEB DESKTOP)
// -------------------------------------------------------------
function renderNetworkingProfile(data, isSelf, isFounder) {
  const container = document.getElementById('drawerNetworkingProfileContainer');
  if (!container) return;

  const getAns = (qId) => {
    const a = data.answers.find(ans => ans.question_id === qId);
    if (!a) return '';
    if (!isSelf && !isFounder && (a.visibility === 'private' || a.is_redacted)) return '';
    const txt = a.value_text || '';
    if (txt === 'skipped' || txt === '[Private]' || txt.startsWith('[Confidential')) return '';
    return txt;
  };

  const q10 = getAns(10);
  const q12 = getAns(12);
  const q13 = getAns(13);
  const q25 = getAns(25);
  const q26 = getAns(26);
  const q27 = getAns(27);
  const q7 = getAns(7);
  const q8 = getAns(8);
  const q14Raw = getAns(14);
  const q15Raw = getAns(15);
  const q16Raw = getAns(16);
  const q17Raw = getAns(17);
  const q18Raw = getAns(18);
  const q22Raw = getAns(22);
  const q24Raw = getAns(24);
  const q2 = getAns(2);
  const q3 = getAns(3);
  const q4 = getAns(4);
  const q5 = getAns(5);
  const q6 = getAns(6);
  const q19 = getAns(19);

  // Q14 composite
  let q14Tags = [], q14Note = '';
  if (q14Raw) {
    try {
      if (q14Raw.startsWith('{') && q14Raw.endsWith('}')) {
        const p = JSON.parse(q14Raw);
        if (Array.isArray(p.tags)) q14Tags = p.tags;
        if (p.note) q14Note = p.note;
      } else { q14Note = q14Raw; }
    } catch(e) { q14Note = q14Raw; }
  }

  const q15List = q15Raw ? q15Raw.split(';').map(s => s.trim()).filter(Boolean) : [];
  const q16List = q16Raw ? q16Raw.split(';').map(s => s.trim()).filter(Boolean) : [];

  // Q17 composite
  let q17Tags = [], q17Note = '';
  if (q17Raw) {
    try {
      if (q17Raw.startsWith('{') && q17Raw.endsWith('}')) {
        const p = JSON.parse(q17Raw);
        if (Array.isArray(p.tags)) q17Tags = p.tags;
        if (p.note) q17Note = p.note;
      } else { q17Note = q17Raw; }
    } catch(e) { q17Note = q17Raw; }
  }

  // Q18 offers
  let q18Offers = [], q18Note = '';
  if (q18Raw) {
    try {
      if (q18Raw.startsWith('{') && q18Raw.endsWith('}')) {
        const p = JSON.parse(q18Raw);
        if (Array.isArray(p.tags)) q18Offers = p.tags;
        if (p.note) q18Note = p.note;
      } else { q18Offers = q18Raw.split(';').map(s => s.trim()).filter(Boolean); }
    } catch(e) { q18Offers = q18Raw.split(';').map(s => s.trim()).filter(Boolean); }
  }
  const taxOffers = data.taxonomies?.filter(t => t.category === 'offers').map(t => t.label) || [];
  const allOffers = Array.from(new Set([...q18Offers, ...taxOffers]));

  const q22List = q22Raw ? q22Raw.split(/[,;]/).map(s => s.trim()).filter(Boolean) : [];
  const q7Roles = q7 ? q7.split(';').map(s => s.trim()).filter(Boolean) : (data.taxonomies?.filter(t => t.category === 'roles').map(t => t.label) || []);
  const q8Industries = q8 ? q8.split(';').map(s => s.trim()).filter(Boolean) : (data.taxonomies?.filter(t => t.category === 'industries').map(t => t.label) || []);
  const expertise = data.taxonomies?.filter(t => t.category === 'expertise').map(t => t.label) || [];

  let q24Chap = '', q24Inv = '';
  if (q24Raw) {
    if (q24Raw.includes('—')) {
      const parts = q24Raw.split('—').map(s => s.trim());
      q24Chap = parts[0]; q24Inv = parts[1];
    } else if (q24Raw.includes(',')) {
      const parts = q24Raw.split(',').map(s => s.trim());
      q24Chap = parts[0]; q24Inv = parts[1];
    } else { q24Chap = q24Raw; }
  }
  const displayChapter = q24Chap || data.chapter_name || data.city;
  const currentRoleAndOrg = [q25, q26].filter(Boolean).join(' at ') || data.headline;
  const locationStr = q2 || [data.city, data.country].filter(Boolean).join(', ');
  const q3List = q3 ? q3.split(';').map(s => s.trim()).filter(Boolean) : [];
  const q4List = q4 ? q4.split(';').map(s => s.trim()).filter(Boolean) : [];
  const q5List = q5 ? q5.split(';').map(s => s.trim()).filter(Boolean) : [];
  const q6List = q6 ? q6.split(';').map(s => s.trim()).filter(Boolean) : [];

  let html = '';

  // 1. Profile Header Box
  html += `
    <div class="net-profile-header-card">
      <div class="net-header-top">
        <div class="net-avatar-wrap">
          <img src="${data.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'}" alt="${data.full_name}" class="net-avatar-img">
          ${data.is_complete ? `<span class="net-verified-icon" title="Verified Member">✓</span>` : ''}
        </div>
        <div class="net-header-details">
          <div class="net-name-row">
            <h2 class="net-member-name">${data.full_name}</h2>
            <span class="badge ${data.is_complete ? 'badge-success' : 'badge-warning'}">
              ${data.is_complete ? 'Verified Member' : 'Incomplete'}
            </span>
          </div>
          <div class="net-title-org">${currentRoleAndOrg}</div>
          <div class="net-location-row">
            <span class="net-loc-item">📍 ${locationStr}</span>
            ${displayChapter ? `<span class="net-loc-item net-chapter-tag">🏛 ${displayChapter} Chapter</span>` : ''}
          </div>
          ${q13 ? `
            <a href="${q13.startsWith('http') ? q13 : `https://${q13}`}" target="_blank" rel="noopener noreferrer" class="net-link-pill">
              🔗 ${q13.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            </a>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  // 2. About Me
  if (q10 || q12) {
    html += `
      <div class="net-section-card">
        <h4 class="net-card-title">👤 About Me</h4>
        ${q10 ? `<div class="net-sentence-hook">"${q10}"</div>` : ''}
        ${q12 ? `<p class="net-body-narrative">${q12}</p>` : ''}
      </div>
    `;
  } else if (isSelf) {
    html += `
      <div class="net-prompt-card" onclick="switchDrawerTab('editor')">
        <span>+ Add your one-sentence introduction and professional background</span>
      </div>
    `;
  }

  // 3. Professional Background
  if (q25 || q26 || q7Roles.length || q8Industries.length || q27 || expertise.length) {
    html += `
      <div class="net-section-card">
        <h4 class="net-card-title">💼 Professional Background</h4>
        ${(q25 || q26) ? `<div class="net-meta-line"><strong>Role:</strong> ${[q25, q26].filter(Boolean).join(' at ')}</div>` : ''}
        ${q27 ? `<div class="net-meta-line"><strong>Institution:</strong> ${q27}</div>` : ''}
        ${q7Roles.length ? `
          <div class="net-meta-block">
            <span class="net-sublabel">Functions:</span>
            <div class="net-pills-wrap">
              ${q7Roles.map(r => `<span class="net-pill">${r}</span>`).join('')}
            </div>
          </div>
        ` : ''}
        ${q8Industries.length ? `
          <div class="net-meta-block">
            <span class="net-sublabel">Industries & Sectors:</span>
            <div class="net-pills-wrap">
              ${q8Industries.map(ind => `<span class="net-pill net-pill-cyan">${ind}</span>`).join('')}
            </div>
          </div>
        ` : ''}
        ${expertise.length ? `
          <div class="net-meta-block">
            <span class="net-sublabel">Core Expertise:</span>
            <div class="net-pills-wrap">
              ${expertise.map(exp => `<span class="net-pill">${exp}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // 4. Current Focus
  if (q14Tags.length || q14Note || q15List.length) {
    html += `
      <div class="net-section-card">
        <h4 class="net-card-title">🎯 Current Focus</h4>
        ${q14Tags.length ? `
          <div class="net-pills-wrap" style="margin-bottom: 0.5rem;">
            ${q14Tags.map(t => `<span class="net-pill net-pill-cyan">🏁 ${t}</span>`).join('')}
          </div>
        ` : ''}
        ${q14Note ? `<div class="net-focus-note"><strong>Strategic Milestone:</strong> ${q14Note}</div>` : ''}
        ${q15List.length ? `
          <div class="net-meta-block" style="margin-top: 0.6rem;">
            <span class="net-sublabel">Industries Exploring:</span>
            <div class="net-pills-wrap">
              ${q15List.map(ind => `<span class="net-pill net-pill-violet">🔭 ${ind}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // 5. Let's Connect (High Prominence)
  if (q17Tags.length || q17Note || q16List.length) {
    html += `
      <div class="net-section-card net-card-highlight-cyan">
        <h4 class="net-card-title" style="color: var(--cyan-light, #38bdf8);">🤝 Let's Connect</h4>
        <p class="net-connect-sub">Who this member is interested in meeting right now:</p>
        ${q17Tags.length ? `
          <div class="net-pills-wrap" style="margin-bottom: 0.5rem;">
            ${q17Tags.map(t => `<span class="net-pill net-pill-cyan-elevated">👤 ${t}</span>`).join('')}
          </div>
        ` : ''}
        ${q17Note ? `<div class="net-connect-note"><strong>Anyone Specific:</strong> ${q17Note}</div>` : ''}
        ${q16List.length ? `
          <div class="net-meta-block" style="margin-top: 0.6rem;">
            <span class="net-sublabel">Target Geographies:</span>
            <div class="net-pills-wrap">
              ${q16List.map(c => `<span class="net-pill">🌐 ${c}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  } else if (isSelf) {
    html += `
      <div class="net-prompt-card net-prompt-cyan" onclick="switchDrawerTab('editor')">
        <span>+ Tell members who you want to meet right now (Let's Connect)</span>
      </div>
    `;
  }

  // 6. What I Can Offer (High Prominence)
  if (allOffers.length || q18Note) {
    html += `
      <div class="net-section-card net-card-highlight-emerald">
        <h4 class="net-card-title" style="color: var(--emerald-light, #10b981);">💎 What I Can Offer</h4>
        <p class="net-connect-sub">Foundational contributions this member shares with peers in the club:</p>
        ${allOffers.length ? `
          <div class="net-pills-wrap" style="margin-bottom: 0.5rem;">
            ${allOffers.map(o => `<span class="net-pill net-pill-emerald-elevated">✨ ${o}</span>`).join('')}
          </div>
        ` : ''}
        ${q18Note ? `<div class="net-offer-note"><strong>Contribution Details:</strong> ${q18Note}</div>` : ''}
      </div>
    `;
  } else if (isSelf) {
    html += `
      <div class="net-prompt-card net-prompt-emerald" onclick="switchDrawerTab('editor')">
        <span>★ Complete Question 18: What can you offer other members? (Required)</span>
      </div>
    `;
  }

  // 7. Locations & Community
  if (locationStr || q3List.length || q4List.length || q5List.length || displayChapter || (data.travel_plans && data.travel_plans.length)) {
    html += `
      <div class="net-section-card">
        <h4 class="net-card-title">🗺️ Locations & Community</h4>
        <div class="net-meta-line"><strong>Primary Base:</strong> ${locationStr}</div>
        ${displayChapter ? `<div class="net-meta-line"><strong>Home Chapter:</strong> ${displayChapter} ${q24Inv ? `(${q24Inv})` : ''}</div>` : ''}
        ${q3List.length ? `
          <div class="net-meta-block">
            <span class="net-sublabel">Other Regular Cities:</span>
            <div class="net-pills-wrap">
              ${q3List.map(c => `<span class="net-pill">📍 ${c}</span>`).join('')}
            </div>
          </div>
        ` : ''}
        ${q4List.length ? `
          <div class="net-meta-block">
            <span class="net-sublabel">Active Bases:</span>
            <div class="net-pills-wrap">
              ${q4List.map(b => `<span class="net-pill">🏢 ${b}</span>`).join('')}
            </div>
          </div>
        ` : ''}
        ${q5List.length ? `
          <div class="net-meta-block">
            <span class="net-sublabel">Languages:</span>
            <div class="net-pills-wrap">
              ${q5List.map(l => `<span class="net-pill">🗣️ ${l}</span>`).join('')}
            </div>
          </div>
        ` : ''}
        ${(data.travel_plans && data.travel_plans.length) ? `
          <div class="net-meta-block" style="margin-top: 0.6rem;">
            <span class="net-sublabel">Upcoming Active Travel:</span>
            ${data.travel_plans.map(t => `
              <div class="net-travel-item">
                <span>✈ <strong>${t.city}, ${t.country}</strong> (${t.start_date} → ${t.end_date})</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  // 8. Beyond Work
  if (q22List.length) {
    html += `
      <div class="net-section-card">
        <h4 class="net-card-title">✨ Beyond Work</h4>
        <p class="net-connect-sub">Interests, hobbies, sports & creative pursuits outside work:</p>
        <div class="net-pills-wrap">
          ${q22List.map(int => `<span class="net-pill net-pill-violet">❤️ ${int}</span>`).join('')}
        </div>
      </div>
    `;
  } else if (isSelf) {
    html += `
      <div class="net-prompt-card" onclick="switchDrawerTab('editor')">
        <span>+ Add your personal interests outside work (sports, outdoors, arts)</span>
      </div>
    `;
  }

  // 9. Contact & Connections
  html += `
    <div class="net-section-card">
      <h4 class="net-card-title">💬 Contact & Connections</h4>
      <div class="net-meta-line">
        <strong>Contact Preference:</strong>
        ${data.contact_preference === 'direct_contact' ? 'Open to direct member contact' : (data.contact_preference === 'through_team' ? 'Through Chapter Leadership / Team' : 'Unavailable')}
      </div>
      ${q6List.length ? `<div class="net-meta-line"><strong>Best Way to Reach:</strong> ${q6List.join(', ')}</div>` : ''}
      ${q19 ? `<div class="net-meta-line"><strong>Direct Outreach:</strong> ${q19}</div>` : ''}
      <p class="net-privacy-notice">🔒 Member contact details are strictly confidential. Peer contact requests respect each member's declared preferences.</p>
    </div>
  `;

  container.innerHTML = html;
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
  if (tabName === 'admin') {
    initAdminDashboard();
  }
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

// -------------------------------------------------------------
// SECTION 10: INBOX, MESSAGING & TRANSACTIONAL NOTIFICATIONS
// -------------------------------------------------------------
let activeInboxTab = 'messages';
let activeConversationId = null;
let activeChatPartner = null;
let currentNotifCategory = 'all';
let currentActivityCategory = 'all';
let cachedConversations = [];

async function refreshInboxSummary() {
  try {
    const res = await fetch(`/api/inbox/summary?userId=${encodeURIComponent(currentUserId)}`);
    if (!res.ok) return;
    const summary = await res.json();

    // Top navbar badge
    const navBadge = document.getElementById('inboxUnreadBadge');
    if (navBadge) {
      if (summary.total_unread > 0) {
        navBadge.textContent = summary.total_unread > 99 ? '99+' : summary.total_unread;
        navBadge.style.display = 'flex';
      } else {
        navBadge.style.display = 'none';
      }
    }

    // Modal internal tab badges
    const msgBadge = document.getElementById('tabBadgeMessages');
    if (msgBadge) {
      if (summary.unread_messages > 0) {
        msgBadge.textContent = summary.unread_messages;
        msgBadge.style.display = 'inline-block';
      } else {
        msgBadge.style.display = 'none';
      }
    }

    const notifBadge = document.getElementById('tabBadgeNotifications');
    if (notifBadge) {
      if (summary.unread_notifications > 0) {
        notifBadge.textContent = summary.unread_notifications;
        notifBadge.style.display = 'inline-block';
      } else {
        notifBadge.style.display = 'none';
      }
    }

    // Admin Activity tab visibility and badge
    const adminTabBtn = document.getElementById('inboxTabBtnAdminActivity');
    const adminBadge = document.getElementById('tabBadgeAdminActivity');
    if (adminTabBtn) {
      if (summary.is_admin) {
        adminTabBtn.style.display = 'inline-flex';
        if (adminBadge && summary.unread_admin_activity > 0) {
          adminBadge.textContent = summary.unread_admin_activity;
          adminBadge.style.display = 'inline-block';
        } else if (adminBadge) {
          adminBadge.style.display = 'none';
        }
      } else {
        adminTabBtn.style.display = 'none';
      }
    }

    // Admin preference row visibility
    const prefAdminRow = document.getElementById('prefAdminRow');
    if (prefAdminRow) {
      prefAdminRow.style.display = summary.is_admin ? 'flex' : 'none';
    }
  } catch (err) {
    console.warn('Error refreshing inbox summary:', err);
  }
}

async function openInboxModal(initialTab = 'messages') {
  await refreshInboxSummary();
  switchInboxTab(initialTab);
  openModal('inboxModal');
}

function switchInboxTab(tabName) {
  activeInboxTab = tabName;

  document.querySelectorAll('.inbox-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.inbox-view-panel').forEach(p => p.classList.remove('active'));

  if (tabName === 'messages') {
    const btn = document.getElementById('inboxTabBtnMessages');
    if (btn) btn.classList.add('active');
    const view = document.getElementById('inboxViewMessages');
    if (view) view.classList.add('active');
    loadConversations();
  } else if (tabName === 'notifications') {
    const btn = document.getElementById('inboxTabBtnNotifications');
    if (btn) btn.classList.add('active');
    const view = document.getElementById('inboxViewNotifications');
    if (view) view.classList.add('active');
    loadNotifications();
  } else if (tabName === 'admin_activity') {
    const btn = document.getElementById('inboxTabBtnAdminActivity');
    if (btn) btn.classList.add('active');
    const view = document.getElementById('inboxViewAdminActivity');
    if (view) view.classList.add('active');
    loadAdminActivity();
  }
}

// --- CONVERSATIONS & DIRECT MESSAGING ---
async function loadConversations() {
  const container = document.getElementById('conversationsListContainer');
  if (!container) return;

  try {
    const res = await fetch(`/api/inbox/conversations?userId=${encodeURIComponent(currentUserId)}`);
    if (!res.ok) throw new Error('Failed to load conversations');
    const data = await res.json();
    cachedConversations = data.conversations || [];

    renderConversationsList(cachedConversations);

    // If an active conversation was previously selected, re-select it
    if (activeConversationId) {
      selectConversation(activeConversationId);
    } else if (cachedConversations.length > 0) {
      selectConversation(cachedConversations[0].id);
    } else {
      showChatEmptyState();
    }
  } catch (err) {
    container.innerHTML = `<div class="inbox-loading-state">Could not load conversations.</div>`;
  }
}

function renderConversationsList(convos) {
  const container = document.getElementById('conversationsListContainer');
  if (!container) return;

  if (convos.length === 0) {
    container.innerHTML = `
      <div class="inbox-loading-state" style="padding: 2rem 1rem;">
        No active conversations.<br>
        <span style="font-size: 0.78rem; color: var(--text-dim); margin-top: 0.35rem; display: block;">
          Connect with members in the Network tab to start private messaging.
        </span>
      </div>
    `;
    return;
  }

  container.innerHTML = convos.map(c => {
    const p = c.other_participant || {};
    const isActive = c.id === activeConversationId;
    const timeStr = c.last_message_at ? formatTimeAgo(c.last_message_at) : '';
    const avatarUrl = p.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200';

    return `
      <div class="convo-item ${isActive ? 'active' : ''}" onclick="selectConversation('${c.id}')" data-convoid="${c.id}">
        <img src="${avatarUrl}" class="convo-avatar" alt="${escapeHtml(p.full_name || 'Member')}">
        <div class="convo-info">
          <div class="convo-name-row">
            <span class="convo-name">${escapeHtml(p.full_name || 'Member')}</span>
            <span class="convo-time">${timeStr}</span>
          </div>
          <div class="convo-snippet-row">
            <span class="convo-snippet">${escapeHtml(c.last_message_snippet || 'No messages yet')}</span>
            ${c.unread_count > 0 ? `<span class="convo-unread-pill">${c.unread_count}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterConversations() {
  const query = (document.getElementById('convosSearchInput')?.value || '').toLowerCase().trim();
  if (!query) {
    renderConversationsList(cachedConversations);
    return;
  }
  const filtered = cachedConversations.filter(c => {
    const name = (c.other_participant?.full_name || '').toLowerCase();
    const snippet = (c.last_message_snippet || '').toLowerCase();
    return name.includes(query) || snippet.includes(query);
  });
  renderConversationsList(filtered);
}

async function selectConversation(convoId) {
  activeConversationId = convoId;

  // Highlight in sidebar
  document.querySelectorAll('.convo-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-convoid') === convoId);
  });

  const chatTopBar = document.getElementById('chatTopBar');
  const chatInputArea = document.getElementById('chatInputArea');
  const messagesArea = document.getElementById('chatMessagesArea');

  try {
    const res = await fetch(`/api/inbox/conversations/${convoId}?userId=${encodeURIComponent(currentUserId)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to open conversation');
    }
    const data = await res.json();
    const partner = data.other_participant;
    activeChatPartner = partner;

    // Update Top Bar
    if (chatTopBar) {
      chatTopBar.style.display = 'flex';
      const avatarEl = document.getElementById('chatPartnerAvatar');
      const nameEl = document.getElementById('chatPartnerName');
      const headlineEl = document.getElementById('chatPartnerHeadline');
      const mutualBadge = document.getElementById('chatMutualBadge');

      if (avatarEl) avatarEl.src = partner.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200';
      if (nameEl) nameEl.textContent = partner.full_name || 'Member';
      if (headlineEl) headlineEl.textContent = partner.headline || `${partner.city || ''} ${partner.chapter_name ? '· ' + partner.chapter_name + ' Chapter' : ''}`;
      if (mutualBadge) {
        mutualBadge.textContent = (partner.role === 'FOUNDER' || partner.role === 'ADMIN') ? 'Club Leadership' : 'Mutual Connection';
      }
    }

    if (chatInputArea) {
      chatInputArea.style.display = 'block';
    }

    // Render Messages
    const msgs = data.messages || [];
    if (msgs.length === 0) {
      messagesArea.innerHTML = `
        <div class="chat-empty-state">
          <div class="chat-empty-icon">✉️</div>
          <h4>Start the conversation</h4>
          <p>Send a confidential message to ${escapeHtml(partner.full_name)}. Private 1:1 communications are strictly restricted to verified mutual connections.</p>
        </div>
      `;
    } else {
      messagesArea.innerHTML = msgs.map(m => {
        const isSent = m.sender_id === currentUserId;
        const timeStr = formatMessageTime(m.created_at);
        return `
          <div class="chat-bubble-row ${isSent ? 'sent' : 'received'}">
            <div class="chat-bubble ${isSent ? 'sent' : 'received'}">
              ${escapeHtml(m.content)}
            </div>
            <span class="chat-timestamp">${timeStr}</span>
          </div>
        `;
      }).join('');
    }

    // Auto scroll to bottom
    messagesArea.scrollTop = messagesArea.scrollHeight;

    // Refresh summary badges because unread messages in this conversation are now marked read
    refreshInboxSummary();
  } catch (err) {
    if (messagesArea) {
      messagesArea.innerHTML = `
        <div class="chat-empty-state">
          <div class="chat-empty-icon">🔒</div>
          <h4>Conversation Restricted</h4>
          <p>${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  }
}

function showChatEmptyState() {
  const chatTopBar = document.getElementById('chatTopBar');
  const chatInputArea = document.getElementById('chatInputArea');
  const messagesArea = document.getElementById('chatMessagesArea');
  if (chatTopBar) chatTopBar.style.display = 'none';
  if (chatInputArea) chatInputArea.style.display = 'none';
  if (messagesArea) {
    messagesArea.innerHTML = `
      <div class="chat-empty-state">
        <div class="chat-empty-icon">💬</div>
        <h4>Direct Member Messaging</h4>
        <p>Select a conversation from the left to start messaging. Direct messaging is exclusively available between mutually accepted connections and club leadership.</p>
      </div>
    `;
  }
}

async function startDirectMessage(recipientId, recipientName) {
  if (recipientId === currentUserId) {
    showToast("You cannot message yourself.", "warning");
    return;
  }

  try {
    const res = await fetch('/api/inbox/conversations/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
      body: JSON.stringify({ userId: currentUserId, recipientId })
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 403) {
        showToast(`Cannot message: ${data.error}`, "warning");
      } else {
        showToast(data.error || "Could not open conversation", "error");
      }
      return;
    }

    // Open Inbox modal and select the conversation
    openModal('inboxModal');
    switchInboxTab('messages');
    await loadConversations();
    if (data.conversation?.id) {
      selectConversation(data.conversation.id);
    }
  } catch (err) {
    showToast("Error opening conversation", "error");
  }
}

async function handleSendDirectMessage(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('chatMessageInput');
  if (!input || !activeConversationId) return;

  const content = input.value.trim();
  if (!content) return;

  try {
    const res = await fetch('/api/inbox/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
      body: JSON.stringify({
        userId: currentUserId,
        conversationId: activeConversationId,
        content
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Could not send message", "error");
      return;
    }

    input.value = '';

    // Append to messages area immediately
    const messagesArea = document.getElementById('chatMessagesArea');
    if (messagesArea) {
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble-row sent';
      bubble.innerHTML = `
        <div class="chat-bubble sent">${escapeHtml(content)}</div>
        <span class="chat-timestamp">Just now</span>
      `;
      // If was empty state, clear it
      if (messagesArea.querySelector('.chat-empty-state')) {
        messagesArea.innerHTML = '';
      }
      messagesArea.appendChild(bubble);
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }

    // Refresh conversation snippet in sidebar
    loadConversations();
  } catch (err) {
    showToast("Error sending message", "error");
  }
}

function handleChatInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendDirectMessage(e);
  }
}

function viewChatPartnerProfile() {
  if (activeChatPartner?.id) {
    closeModal('inboxModal');
    openProfileDrawer(activeChatPartner.id);
  }
}

function openReportModalForChatPartner() {
  if (!activeChatPartner?.id) return;
  openModal('inboxReportModal');
}

async function submitPeerReport() {
  if (!activeChatPartner?.id) return;

  const reason = document.getElementById('reportReasonSelect')?.value || 'other';
  const details = document.getElementById('reportDetailsInput')?.value || '';
  const block = document.getElementById('reportBlockCheckbox')?.checked || false;

  try {
    const res = await fetch('/api/inbox/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
      body: JSON.stringify({
        userId: currentUserId,
        targetUserId: activeChatPartner.id,
        reason,
        details,
        blockUser: block
      })
    });
    const data = await res.json();
    if (res.ok) {
      closeModal('inboxReportModal');
      document.getElementById('reportDetailsInput').value = '';
      showToast(block ? "Report submitted and member blocked." : "Confidential report submitted to leadership.", "success");
      loadConversations();
    } else {
      showToast(data.error || "Could not submit report", "error");
    }
  } catch (err) {
    showToast("Error submitting report", "error");
  }
}

// --- NOTIFICATIONS VIEW ---
async function loadNotifications() {
  const container = document.getElementById('inboxNotificationsList');
  if (!container) return;

  try {
    let url = `/api/inbox/notifications?userId=${encodeURIComponent(currentUserId)}`;
    if (currentNotifCategory !== 'all') {
      url += `&category=${encodeURIComponent(currentNotifCategory)}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load notifications');
    const data = await res.json();
    const notifs = data.notifications || [];

    if (notifs.length === 0) {
      container.innerHTML = `
        <div class="inbox-loading-state">
          No notifications in this category.
        </div>
      `;
      return;
    }

    container.innerHTML = notifs.map(n => {
      const isUnread = !n.is_read;
      const timeStr = formatTimeAgo(n.created_at);
      const meta = n.metadata || {};

      let icon = '🔔';
      if (n.category === 'connection') icon = '👥';
      else if (n.category === 'event') icon = '📅';
      else if (n.category === 'community') icon = '💬';
      else if (n.category === 'direct_message') icon = '✉️';
      else if (n.category === 'system') icon = '🏛️';

      let actionsHtml = '';
      if (n.type === 'connection_request' && !n.is_read) {
        actionsHtml = `
          <div class="notif-actions-row">
            <button class="btn btn-xs btn-white-pill" onclick="handleAcceptConnection('${meta.connection_id || ''}', '${meta.requester_id || ''}', '${n.id}', event)">Accept Connection</button>
            <button class="btn btn-xs btn-ghost-pill" onclick="handleDeclineConnection('${meta.connection_id || ''}', '${meta.requester_id || ''}', '${n.id}', event)">Decline</button>
          </div>
        `;
      }

      return `
        <div class="notif-item ${isUnread ? 'unread' : ''}" onclick="handleNotificationClick('${n.id}', '${escapeHtml(n.action_url || '')}', '${n.type}', '${escapeHtml(JSON.stringify(meta))}')">
          <div class="notif-icon-circle">${icon}</div>
          <div class="notif-content">
            <div class="notif-title-row">
              <span class="notif-title">${escapeHtml(n.title)}</span>
              <span class="notif-time">${timeStr}</span>
            </div>
            <div class="notif-body">${escapeHtml(n.message)}</div>
            ${actionsHtml}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="inbox-loading-state">Could not load notifications.</div>`;
  }
}

function filterNotifications(category) {
  currentNotifCategory = category;
  document.querySelectorAll('.notif-filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-category') === category);
  });
  loadNotifications();
}

async function handleNotificationClick(notifId, actionUrl, notifType, metadataStr) {
  // Mark as read
  try {
    await fetch(`/api/inbox/notifications/${notifId}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
      body: JSON.stringify({ userId: currentUserId })
    });
    refreshInboxSummary();
  } catch (e) {}

  let meta = {};
  try { meta = JSON.parse(metadataStr); } catch (e) {}

  if (notifType === 'direct_message' && meta.conversation_id) {
    switchInboxTab('messages');
    selectConversation(meta.conversation_id);
    return;
  }

  if (actionUrl && actionUrl.startsWith('#event-')) {
    const eventId = actionUrl.replace('#event-', '');
    closeModal('inboxModal');
    openEventDetailModal(eventId);
    return;
  }

  if (actionUrl && actionUrl.startsWith('#profile-')) {
    const userId = actionUrl.replace('#profile-', '');
    closeModal('inboxModal');
    openProfileDrawer(userId);
    return;
  }

  if (actionUrl && actionUrl.startsWith('#community')) {
    closeModal('inboxModal');
    switchTab('community');
    return;
  }

  loadNotifications();
}

async function handleAcceptConnection(connectionId, requesterId, notifId, e) {
  if (e) e.stopPropagation();
  try {
    const res = await fetch('/api/connections/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
      body: JSON.stringify({ connectionId, recipientId: currentUserId })
    });
    const data = await res.json();
    if (res.ok) {
      showToast("Connection accepted! You can now exchange direct messages.", "success");
      await fetch(`/api/inbox/notifications/${notifId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
        body: JSON.stringify({ userId: currentUserId })
      });
      loadNotifications();
      refreshInboxSummary();
    } else {
      showToast(data.error || "Could not accept connection", "error");
    }
  } catch (err) {
    showToast("Error accepting connection", "error");
  }
}

async function handleDeclineConnection(connectionId, requesterId, notifId, e) {
  if (e) e.stopPropagation();
  try {
    const res = await fetch('/api/connections/decline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
      body: JSON.stringify({ connectionId, recipientId: currentUserId })
    });
    if (res.ok) {
      showToast("Connection request declined.", "info");
      await fetch(`/api/inbox/notifications/${notifId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
        body: JSON.stringify({ userId: currentUserId })
      });
      loadNotifications();
      refreshInboxSummary();
    }
  } catch (err) {
    showToast("Error declining connection", "error");
  }
}

async function handleMarkAllNotificationsRead() {
  try {
    await fetch('/api/inbox/notifications/read-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
      body: JSON.stringify({ userId: currentUserId })
    });
    showToast("All notifications marked as read.", "info");
    loadNotifications();
    refreshInboxSummary();
  } catch (err) {
    showToast("Error updating notifications", "error");
  }
}

// --- ADMIN ACTIVITY FEED ---
async function loadAdminActivity() {
  const container = document.getElementById('inboxAdminActivityList');
  if (!container) return;

  try {
    let url = `/api/admin/activity?userId=${encodeURIComponent(currentUserId)}`;
    if (currentActivityCategory !== 'all') {
      url += `&category=${encodeURIComponent(currentActivityCategory)}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load admin activity');
    const data = await res.json();
    const items = data.activity || [];

    if (items.length === 0) {
      container.innerHTML = `
        <div class="inbox-loading-state">
          No operational activity recorded in this category.
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(act => {
      const timeStr = formatTimeAgo(act.created_at);
      const catClass = `activity-badge-${act.category || 'system'}`;
      let metaStr = '';
      if (act.metadata) {
        try {
          const keys = Object.keys(act.metadata).slice(0, 4);
          metaStr = keys.map(k => `${k}: ${act.metadata[k]}`).join(' · ');
        } catch (e) {}
      }

      return `
        <div class="activity-item">
          <span class="activity-badge ${catClass}">${act.category}</span>
          <div class="activity-content">
            <div class="activity-summary-row">
              <span class="activity-summary">
                <strong>${escapeHtml(act.actor_name || 'System')}</strong>: ${escapeHtml(act.action_type || '')}
                ${act.target_name ? ` → <strong>${escapeHtml(act.target_name)}</strong>` : ''}
              </span>
              <span class="activity-time">${timeStr}</span>
            </div>
            ${metaStr ? `<div class="activity-meta">${escapeHtml(metaStr)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="inbox-loading-state">Could not load activity feed.</div>`;
  }
}

function filterAdminActivity(cat) {
  currentActivityCategory = cat;
  document.querySelectorAll('.activity-filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-acategory') === cat);
  });
  loadAdminActivity();
}

// --- PREFERENCES MODAL ---
async function openInboxPreferencesModal() {
  try {
    const res = await fetch(`/api/inbox/preferences?userId=${encodeURIComponent(currentUserId)}`);
    if (res.ok) {
      const data = await res.json();
      const prefs = data.preferences || {};
      const c = document.getElementById('prefEmailConnections');
      if (c) c.value = prefs.email_connection_requests || 'immediate';
      const ev = document.getElementById('prefEmailEvents');
      if (ev) ev.value = prefs.email_event_invitations || 'immediate';
      const com = document.getElementById('prefEmailCommunity');
      if (com) com.value = prefs.email_community_posts || 'daily_digest';
      const a = document.getElementById('prefEmailAnnouncements');
      if (a) a.value = prefs.email_announcements || 'immediate';
      const act = document.getElementById('prefEmailAdminActivity');
      if (act) act.value = prefs.email_admin_activity || 'daily_digest';
    }
  } catch (e) {}
  openModal('inboxPreferencesModal');
}

async function saveInboxPreferences() {
  try {
    const payload = {
      email_connection_requests: document.getElementById('prefEmailConnections')?.value || 'immediate',
      email_event_invitations: document.getElementById('prefEmailEvents')?.value || 'immediate',
      email_community_posts: document.getElementById('prefEmailCommunity')?.value || 'daily_digest',
      email_announcements: document.getElementById('prefEmailAnnouncements')?.value || 'immediate',
      email_admin_activity: document.getElementById('prefEmailAdminActivity')?.value || 'daily_digest'
    };

    const res = await fetch('/api/inbox/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
      body: JSON.stringify({ userId: currentUserId, preferences: payload })
    });
    if (res.ok) {
      closeModal('inboxPreferencesModal');
      showToast("Notification preferences updated.", "success");
    } else {
      showToast("Could not update preferences.", "error");
    }
  } catch (err) {
    showToast("Error updating preferences", "error");
  }
}

// --- SANDBOX TEST MAILBOX MODAL ---
function openTestMailboxModal() {
  loadSandboxMailbox();
  openModal('inboxTestMailboxModal');
}

async function loadSandboxMailbox() {
  const container = document.getElementById('sandboxMailboxList');
  if (!container) return;

  try {
    const res = await fetch('/api/inbox/test-mailbox');
    if (!res.ok) throw new Error('Failed to fetch test mailbox');
    const data = await res.json();
    const emails = data.emails || [];

    if (emails.length === 0) {
      container.innerHTML = `
        <div class="inbox-loading-state">
          Sandbox queue is currently empty. Trigger a member message, event RSVP, or inquiry to populate the queue.
        </div>
      `;
      return;
    }

    container.innerHTML = emails.map(e => {
      const timeStr = formatTimeAgo(e.created_at);
      return `
        <div class="sandbox-email-card" id="sandboxEmailCard_${e.id}">
          <div class="sandbox-email-header">
            <span class="sandbox-email-to">To: <strong>${escapeHtml(e.recipient_email)}</strong></span>
            <span class="sandbox-email-status ${e.delivery_status}">${e.delivery_status}</span>
          </div>
          <div class="sandbox-email-subj">${escapeHtml(e.subject)}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.4rem;">
            <span style="font-size: 0.72rem; color: var(--text-dim);">${timeStr} · Template: ${e.template_type}</span>
            <button class="btn btn-xs btn-ghost-pill" onclick="toggleSandboxEmailPreview(${e.id})">Toggle HTML Preview</button>
          </div>
          <div id="sandboxPreviewBox_${e.id}" class="sandbox-preview-box" style="display: none;">
            <iframe srcdoc="${escapeHtml(e.body_html || '')}" style="width: 100%; height: 220px; border: none; background: #fff;"></iframe>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="inbox-loading-state">Could not load sandbox mailbox.</div>`;
  }
}

function toggleSandboxEmailPreview(emailId) {
  const box = document.getElementById(`sandboxPreviewBox_${emailId}`);
  if (box) {
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
  }
}

// Utilities for formatting
function formatTimeAgo(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMessageTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// =========================================================================
// EXECUTIVE ADMIN DASHBOARD & NOTIFICATIONS CONTROLLER
// (Julia Shchukina, Alexandra Hill, Elena Ermolov)
// =========================================================================

let adminEventsCache = [];
let adminAllMembersCache = [];
let adminSelectedInviteEventId = '';
let adminSelectedUserIds = new Set();
let adminExcludedUserIds = new Set();
let adminRecipientPreviewDebounceTimer = null;

function switchAdminSubTab(subTab) {
  document.querySelectorAll('.admin-subnav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-atab') === subTab);
  });
  document.querySelectorAll('.admin-subpane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `admin-subpane-${subTab}`);
  });

  if (subTab === 'events') {
    loadAdminEvents();
  } else if (subTab === 'invitations') {
    initAdminInvitationsPane();
  } else if (subTab === 'membership') {
    loadAdminMembershipInvitations();
  } else if (subTab === 'audit') {
    loadAdminAuditLogs();
  }
}

async function initAdminDashboard() {
  const viewer = getCurrentUser();
  if (!viewer || (viewer.role !== 'FOUNDER' && viewer.role !== 'ADMIN')) {
    showToast('Admin access restricted to verified administrators.', 'error');
    switchDrawerTab('overview');
    return;
  }
  switchAdminSubTab('events');
}

// -------------------------------------------------------------------------
// 1. EVENT MANAGEMENT
// -------------------------------------------------------------------------

async function loadAdminEvents() {
  const container = document.getElementById('adminEventsList');
  if (!container) return;
  container.innerHTML = '<div class="inbox-loading-state">Loading club events...</div>';

  try {
    const res = await fetch(`/api/admin/events?viewerId=${encodeURIComponent(currentUserId)}`);
    if (!res.ok) throw new Error('Unauthorized or failed to load events');
    const data = await res.json();
    adminEventsCache = Array.isArray(data) ? data : (data.events || []);

    if (adminEventsCache.length === 0) {
      container.innerHTML = '<p class="muted-text" style="grid-column: 1/-1; padding: 2rem; text-align: center;">No club events found. Click "+ Create Event" to schedule your first gathering.</p>';
      return;
    }

    container.innerHTML = adminEventsCache.map(evt => {
      const isPublished = (evt.is_published === 1);
      const isCancelled = (evt.status === 'cancelled');
      const registered = evt.registered_count || 0;
      const capacity = evt.capacity || 30;
      const spotsLeft = Math.max(0, capacity - registered);

      return `
        <div class="admin-event-card">
          <div class="admin-event-card-header">
            <div>
              <span class="badge ${isPublished ? 'badge-cyan' : 'badge-outline'}" style="margin-bottom: 0.35rem; display: inline-block;">
                ${evt.event_type || 'Summit'} · ${isCancelled ? 'CANCELLED' : isPublished ? 'PUBLISHED' : 'DRAFT'}
              </span>
              <h4 class="admin-event-card-title">${escapeHtml(evt.title)}</h4>
            </div>
          </div>

          <p style="font-size: 0.82rem; color: #cbd5e1; line-height: 1.4;">
            ${escapeHtml(evt.headline || evt.description?.slice(0, 110) || '')}
          </p>

          <div class="admin-event-card-meta">
            <div>📅 <strong>${escapeHtml(evt.display_date || evt.start_date || 'TBA')}</strong> (${escapeHtml(evt.timezone || 'UTC')})</div>
            <div>📍 ${escapeHtml(evt.location || 'To be confirmed')} · ${escapeHtml(evt.venue || '')}</div>
            <div>👥 <strong>${registered} / ${capacity}</strong> registered (${spotsLeft} spots available)</div>
            <div>🔒 Visibility: <strong>${evt.visibility === 'selected_invitees' ? 'Selected Invitees Only' : 'All Admitted Members'}</strong></div>
            ${evt.rsvp_deadline ? `<div>⏰ RSVP Deadline: <strong>${evt.rsvp_deadline}</strong></div>` : ''}
          </div>

          <div class="admin-event-card-actions">
            <button class="btn btn-xs btn-white-pill" onclick="openAdminEditEventModal('${evt.id}')">
              ✏️ Edit
            </button>
            <button class="btn btn-xs btn-ghost-pill" onclick="openAdminAttendeesModal('${evt.id}')">
              👥 Attendees (${registered})
            </button>
            <button class="btn btn-xs btn-ghost-pill" onclick="adminPrepareInviteForEvent('${evt.id}')">
              ✉️ Send Invites
            </button>
            ${!isCancelled ? `
              <button class="btn btn-xs ${isPublished ? 'btn-ghost-pill' : 'btn-outline'}" onclick="toggleAdminPublishEvent('${evt.id}', ${isPublished ? 1 : 0})">
                ${isPublished ? 'Unpublish' : 'Publish'}
              </button>
              <button class="btn btn-xs btn-danger-pill" onclick="cancelAdminEvent('${evt.id}')">
                Cancel
              </button>
            ` : '<span class="badge badge-outline">Event Cancelled</span>'}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<p class="muted-text" style="color: #ef4444; padding: 1.5rem;">Error loading events: ${err.message}</p>`;
  }
}

function openAdminCreateEventModal() {
  document.getElementById('adminEditEventId').value = '';
  document.getElementById('adminEventModalTitle').textContent = 'Create Club Event';
  document.getElementById('adminEvtTitle').value = '';
  document.getElementById('adminEvtType').value = 'Summit';
  document.getElementById('adminEvtHeadline').value = '';
  document.getElementById('adminEvtDesc').value = '';
  document.getElementById('adminEvtLocation').value = 'To be confirmed';
  document.getElementById('adminEvtVenue').value = 'To be confirmed';
  document.getElementById('adminEvtMeetingLink').value = '';
  document.getElementById('adminEvtTimezone').value = 'UTC';
  document.getElementById('adminEvtStartDate').value = '';
  document.getElementById('adminEvtEndDate').value = '';
  document.getElementById('adminEvtDisplayDate').value = '';
  document.getElementById('adminEvtCapacity').value = '30';
  document.getElementById('adminEvtRsvpDeadline').value = '';
  document.getElementById('adminEvtVisibility').value = 'all_members';
  document.getElementById('adminEvtCoverImage').value = '/assets/events/london_gathering.jpg';
  document.getElementById('adminEvtPublishNow').checked = true;

  openModal('adminEventModal');
}

function openAdminEditEventModal(eventId) {
  const evt = adminEventsCache.find(e => e.id === eventId);
  if (!evt) return;

  document.getElementById('adminEditEventId').value = evt.id;
  document.getElementById('adminEventModalTitle').textContent = `Edit Event: ${evt.title}`;
  document.getElementById('adminEvtTitle').value = evt.title || '';
  document.getElementById('adminEvtType').value = evt.event_type || 'Summit';
  document.getElementById('adminEvtHeadline').value = evt.headline || '';
  document.getElementById('adminEvtDesc').value = evt.description || '';
  document.getElementById('adminEvtLocation').value = evt.location || '';
  document.getElementById('adminEvtVenue').value = evt.venue || '';
  document.getElementById('adminEvtMeetingLink').value = evt.meeting_link || '';
  document.getElementById('adminEvtTimezone').value = evt.timezone || 'UTC';
  document.getElementById('adminEvtStartDate').value = evt.start_date || '';
  document.getElementById('adminEvtEndDate').value = evt.end_date || '';
  document.getElementById('adminEvtDisplayDate').value = evt.display_date || '';
  document.getElementById('adminEvtCapacity').value = evt.capacity || '30';
  document.getElementById('adminEvtRsvpDeadline').value = evt.rsvp_deadline || '';
  document.getElementById('adminEvtVisibility').value = evt.visibility || 'all_members';
  document.getElementById('adminEvtCoverImage').value = evt.hero_image || evt.cover_image || '/assets/events/london_gathering.jpg';
  document.getElementById('adminEvtPublishNow').checked = (evt.is_published === 1);

  openModal('adminEventModal');
}

async function handleSaveAdminEvent(e) {
  e.preventDefault();
  const editId = document.getElementById('adminEditEventId').value;
  const isEdit = !!editId;

  const payload = {
    title: document.getElementById('adminEvtTitle').value.trim(),
    event_type: document.getElementById('adminEvtType').value,
    headline: document.getElementById('adminEvtHeadline').value.trim(),
    description: document.getElementById('adminEvtDesc').value.trim(),
    location: document.getElementById('adminEvtLocation').value.trim(),
    venue: document.getElementById('adminEvtVenue').value.trim(),
    meeting_link: document.getElementById('adminEvtMeetingLink').value.trim() || null,
    timezone: document.getElementById('adminEvtTimezone').value,
    start_date: document.getElementById('adminEvtStartDate').value.trim() || null,
    end_date: document.getElementById('adminEvtEndDate').value.trim() || null,
    display_date: document.getElementById('adminEvtDisplayDate').value.trim() || 'Upcoming',
    capacity: parseInt(document.getElementById('adminEvtCapacity').value, 10) || 30,
    rsvp_deadline: document.getElementById('adminEvtRsvpDeadline').value.trim() || null,
    visibility: document.getElementById('adminEvtVisibility').value,
    hero_image: document.getElementById('adminEvtCoverImage').value.trim() || '/assets/events/london_gathering.jpg',
    is_published: document.getElementById('adminEvtPublishNow').checked ? 1 : 0
  };

  const btn = document.getElementById('adminSaveEventBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const url = isEdit ? `/api/admin/events/${encodeURIComponent(editId)}?viewerId=${encodeURIComponent(currentUserId)}` : `/api/admin/events?viewerId=${encodeURIComponent(currentUserId)}`;
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to save event');
    }

    closeModal('adminEventModal');
    showToast(isEdit ? 'Event updated successfully.' : 'Event created successfully.', 'success');
    loadAdminEvents();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Event';
  }
}

async function toggleAdminPublishEvent(eventId, currentPublished) {
  try {
    if (currentPublished === 1) {
      await fetch(`/api/admin/events/${encodeURIComponent(eventId)}?viewerId=${encodeURIComponent(currentUserId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: 0 })
      });
      showToast('Event unpublished (saved as draft).', 'success');
    } else {
      await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/publish?viewerId=${encodeURIComponent(currentUserId)}`, {
        method: 'POST'
      });
      showToast('Event published to member calendar.', 'success');
    }
    loadAdminEvents();
  } catch (err) {
    showToast('Failed to toggle event publication.', 'error');
  }
}

async function cancelAdminEvent(eventId) {
  if (!confirm('Are you sure you want to cancel this event? Registered attendees will be notified.')) return;
  try {
    const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/cancel?viewerId=${encodeURIComponent(currentUserId)}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Cancellation failed');
    showToast('Event cancelled.', 'success');
    loadAdminEvents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openAdminAttendeesModal(eventId) {
  const modal = document.getElementById('adminAttendeesModal');
  const title = document.getElementById('adminAttendeesEventTitle');
  const subtitle = document.getElementById('adminAttendeesEventSubtitle');
  const statsRow = document.getElementById('adminAttendeesStatsRow');
  const tbody = document.getElementById('adminAttendeesTableBody');

  tbody.innerHTML = '<tr><td colspan="5" class="muted-text" style="text-align: center; padding: 1.5rem;">Loading attendees...</td></tr>';
  statsRow.innerHTML = '';
  openModal('adminAttendeesModal');

  try {
    const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}?viewerId=${encodeURIComponent(currentUserId)}`);
    if (!res.ok) throw new Error('Failed to load attendee roster');
    const data = await res.json();
    const evt = data.event;
    const attendees = data.attendees || [];
    const stats = data.stats || {};

    title.textContent = `Attendees: ${evt.title}`;
    subtitle.textContent = `${evt.display_date || evt.start_date || ''} · Capacity: ${evt.capacity || 30}`;

    statsRow.innerHTML = `
      <span class="badge badge-cyan">✓ ${stats.registered || 0} Registered</span>
      <span class="badge badge-outline">✉️ ${stats.invited || 0} Total Invited</span>
      <span class="badge badge-warning">⏳ ${stats.waitlisted || 0} Waitlisted</span>
      <span class="badge badge-outline">✕ ${stats.declined || 0} Declined</span>
    `;

    if (attendees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted-text" style="text-align: center; padding: 2rem;">No registered members yet.</td></tr>';
      return;
    }

    tbody.innerHTML = attendees.map(a => `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <img src="${a.avatar_url || '/avatars/default.jpg'}" style="width: 26px; height: 26px; border-radius: 50%;">
            <strong>${escapeHtml(a.full_name)}</strong>
          </div>
        </td>
        <td>${escapeHtml(a.headline || a.role_title || 'Club Member')}</td>
        <td>
          <span class="badge ${a.rsvp_status === 'registered' || a.rsvp_status === 'accepted' ? 'badge-success' : a.rsvp_status === 'declined' ? 'badge-danger' : 'badge-warning'}">
            ${(a.rsvp_status || 'registered').toUpperCase()}
          </span>
        </td>
        <td class="muted-text">${a.responded_at ? a.responded_at.split('T')[0] : (a.registered_at ? a.registered_at.split('T')[0] : '—')}</td>
        <td>${escapeHtml(a.contact_email || a.email || 'Via Chapter')}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color: #ef4444; padding: 1.5rem;">Error: ${err.message}</td></tr>`;
  }
}

// -------------------------------------------------------------------------
// 2. TARGETED INVITATIONS & BROADCASTS
// -------------------------------------------------------------------------

async function initAdminInvitationsPane() {
  const select = document.getElementById('adminInviteEventSelect');
  if (!select) return;

  if (adminEventsCache.length === 0) {
    const res = await fetch(`/api/admin/events?viewerId=${encodeURIComponent(currentUserId)}`);
    const data = await res.json();
    adminEventsCache = Array.isArray(data) ? data : (data.events || []);
  }

  select.innerHTML = adminEventsCache.map(e => `
    <option value="${e.id}" ${e.id === adminSelectedInviteEventId ? 'selected' : ''}>
      ${escapeHtml(e.title)} (${e.display_date || e.start_date || 'Upcoming'})
    </option>
  `).join('') || '<option value="">No events available</option>';

  if (!adminSelectedInviteEventId && adminEventsCache.length > 0) {
    adminSelectedInviteEventId = adminEventsCache[0].id;
  }

  if (adminAllMembersCache.length === 0) {
    try {
      const memRes = await fetch('/api/members?limit=300');
      const memData = await memRes.json();
      adminAllMembersCache = memData.members || [];
      renderAdminIndividualMembersCheckboxes();
    } catch {
      // ignore
    }
  }

  refreshAdminRecipientPreview();
}

function adminPrepareInviteForEvent(eventId) {
  adminSelectedInviteEventId = eventId;
  switchAdminSubTab('invitations');
}

function handleAdminRecipientOptChange() {
  const opt = document.querySelector('input[name="adminRecipientOpt"]:checked')?.value || 'all_admitted';
  const indivPanel = document.getElementById('adminIndividualSelectPanel');
  const filtersPanel = document.getElementById('adminFiltersSelectPanel');

  if (indivPanel) indivPanel.style.display = (opt === 'individual') ? 'block' : 'none';
  if (filtersPanel) filtersPanel.style.display = (opt === 'filters') ? 'block' : 'none';

  refreshAdminRecipientPreview();
}

function renderAdminIndividualMembersCheckboxes(filteredList = null) {
  const list = filteredList || adminAllMembersCache;
  const container = document.getElementById('adminMemberCheckboxes');
  if (!container) return;

  container.innerHTML = list.map(m => {
    const isChecked = adminSelectedUserIds.has(m.id);
    return `
      <label class="member-checkbox-item">
        <input type="checkbox" value="${m.id}" ${isChecked ? 'checked' : ''} onchange="toggleAdminSelectedUser('${m.id}')">
        <span><strong>${escapeHtml(m.full_name)}</strong> — ${escapeHtml(m.city || '')} (${escapeHtml(m.headline || 'Member')})</span>
      </label>
    `;
  }).join('');
}

function filterAdminIndividualMembers() {
  const q = document.getElementById('adminMemberSearchInput')?.value.toLowerCase().trim() || '';
  if (!q) {
    renderAdminIndividualMembersCheckboxes();
    return;
  }
  const filtered = adminAllMembersCache.filter(m =>
    (m.full_name && m.full_name.toLowerCase().includes(q)) ||
    (m.city && m.city.toLowerCase().includes(q)) ||
    (m.headline && m.headline.toLowerCase().includes(q))
  );
  renderAdminIndividualMembersCheckboxes(filtered);
}

function toggleAdminSelectedUser(userId) {
  if (adminSelectedUserIds.has(userId)) {
    adminSelectedUserIds.delete(userId);
  } else {
    adminSelectedUserIds.add(userId);
  }
  refreshAdminRecipientPreview();
}

function filterAdminExclusions() {
  const input = document.getElementById('adminExclusionsInput');
  const val = input?.value.toLowerCase().trim() || '';
  if (!val) return;

  const matched = adminAllMembersCache.find(m => m.full_name && m.full_name.toLowerCase().includes(val));
  if (matched && !adminExcludedUserIds.has(matched.id)) {
    adminExcludedUserIds.add(matched.id);
    input.value = '';
    renderAdminExclusionBadges();
    refreshAdminRecipientPreview();
  }
}

function removeAdminExclusion(userId) {
  adminExcludedUserIds.delete(userId);
  renderAdminExclusionBadges();
  refreshAdminRecipientPreview();
}

function renderAdminExclusionBadges() {
  const container = document.getElementById('adminExclusionBadges');
  if (!container) return;
  const excludedArr = Array.from(adminExcludedUserIds).map(id => {
    const mem = adminAllMembersCache.find(m => m.id === id);
    return mem ? { id, name: mem.full_name } : { id, name: id };
  });

  container.innerHTML = excludedArr.map(ex => `
    <span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 4px; margin: 2px;">
      Excluding: ${escapeHtml(ex.name)}
      <button onclick="removeAdminExclusion('${ex.id}')" style="background:none;border:none;color:#fff;cursor:pointer;font-size:11px;">✕</button>
    </span>
  `).join('');
}

function updateAdminMessagePreview() {
  const evtSelect = document.getElementById('adminInviteEventSelect');
  const evtId = evtSelect?.value;
  const evt = adminEventsCache.find(e => e.id === evtId);
  const note = document.getElementById('adminInviteCustomNote')?.value.trim();

  const titleEl = document.getElementById('adminPreviewEventTitle');
  const textEl = document.getElementById('adminPreviewEventText');

  if (titleEl) titleEl.textContent = evt ? `Invitation: ${evt.title}` : 'Club Invitation';
  if (textEl) {
    textEl.innerHTML = `
      ${note ? `<div style="font-style: italic; margin-bottom: 6px;">"${escapeHtml(note)}"</div>` : ''}
      <div>You are cordially invited to attend <strong>${escapeHtml(evt?.title || 'this event')}</strong> taking place in ${escapeHtml(evt?.location || 'our chapter')} on ${escapeHtml(evt?.display_date || evt?.start_date || 'the scheduled date')}. Please submit your RSVP below.</div>
    `;
  }
}

function refreshAdminRecipientPreview() {
  if (adminRecipientPreviewDebounceTimer) clearTimeout(adminRecipientPreviewDebounceTimer);
  adminRecipientPreviewDebounceTimer = setTimeout(doRefreshAdminRecipientPreview, 250);
}

async function doRefreshAdminRecipientPreview() {
  const evtSelect = document.getElementById('adminInviteEventSelect');
  const eventId = evtSelect?.value;
  const option = document.querySelector('input[name="adminRecipientOpt"]:checked')?.value || 'all_admitted';

  const payload = {
    eventId,
    selectionOption: option,
    selectedUserIds: Array.from(adminSelectedUserIds),
    filters: {
      location: document.getElementById('adminFilterLocation')?.value.trim() || undefined,
      industry: document.getElementById('adminFilterIndustry')?.value.trim() || undefined,
      interests: document.getElementById('adminFilterInterests')?.value.trim() || undefined,
      expertise: document.getElementById('adminFilterExpertise')?.value.trim() || undefined,
    },
    excludedUserIds: Array.from(adminExcludedUserIds),
  };

  const badge = document.getElementById('adminRecipientCountBadge');
  const namesList = document.getElementById('adminRecipientNamesList');

  try {
    const res = await fetch(`/api/admin/events/invitations/recipients?viewerId=${encodeURIComponent(currentUserId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Preview failed');
    const data = await res.json();

    if (badge) badge.textContent = `${data.count} Members Matched (${data.deduplicated_count} New)`;

    if (namesList) {
      if (data.recipients.length === 0) {
        namesList.innerHTML = '<em class="muted-text">No members match the selected criteria.</em>';
      } else {
        namesList.innerHTML = data.recipients.slice(0, 40).map(r => `
          <span class="admin-recipient-tag ${r.already_invited ? 'already-invited' : ''}" title="${r.already_invited ? 'Already invited to this event' : 'Will receive invitation'}">
            ${escapeHtml(r.full_name)} (${escapeHtml(r.city || 'Club')})${r.already_invited ? ' · Invited' : ''}
          </span>
        `).join('') + (data.recipients.length > 40 ? `<span class="badge badge-outline">+${data.recipients.length - 40} more</span>` : '');
      }
    }

    updateAdminMessagePreview();
  } catch (err) {
    if (badge) badge.textContent = 'Error calculating';
  }
}

async function confirmAndSendAdminInvitations() {
  const evtSelect = document.getElementById('adminInviteEventSelect');
  const eventId = evtSelect?.value;
  if (!eventId) {
    showToast('Please select a target event first.', 'error');
    return;
  }

  const option = document.querySelector('input[name="adminRecipientOpt"]:checked')?.value || 'all_admitted';
  const customNote = document.getElementById('adminInviteCustomNote')?.value.trim();

  const channels = ['in_app'];
  if (document.getElementById('adminChannelEmail')?.checked) channels.push('email');
  if (document.getElementById('adminChannelWhatsApp')?.checked) channels.push('whatsapp');

  const previewPayload = {
    eventId,
    selectionOption: option,
    selectedUserIds: Array.from(adminSelectedUserIds),
    filters: {
      location: document.getElementById('adminFilterLocation')?.value.trim() || undefined,
      industry: document.getElementById('adminFilterIndustry')?.value.trim() || undefined,
      interests: document.getElementById('adminFilterInterests')?.value.trim() || undefined,
      expertise: document.getElementById('adminFilterExpertise')?.value.trim() || undefined,
    },
    excludedUserIds: Array.from(adminExcludedUserIds),
  };

  const previewRes = await fetch(`/api/admin/events/invitations/recipients?viewerId=${encodeURIComponent(currentUserId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(previewPayload)
  });
  const previewData = await previewRes.json();
  const recipientIds = (previewData.recipients || []).map(r => r.id);

  if (recipientIds.length === 0) {
    showToast('No recipients matched to send invitations.', 'error');
    return;
  }

  const confirmed = confirm(
    `Confirm dispatching invitations to ${recipientIds.length} members via [${channels.join(', ')}]?\nDuplicate sends are automatically suppressed.`
  );
  if (!confirmed) return;

  const sendBtn = document.getElementById('adminSendInviteBtn');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Dispatching Invitations...';

  try {
    const sendRes = await fetch(`/api/admin/events/invitations/send?viewerId=${encodeURIComponent(currentUserId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        recipientIds,
        deliveryChannels: channels,
        customMessage: customNote
      })
    });

    if (!sendRes.ok) {
      const err = await sendRes.json();
      throw new Error(err.error || 'Failed to dispatch invitations');
    }

    const sendData = await sendRes.json();
    showToast(`Successfully dispatched ${sendData.sent_count} invitations!`, 'success');
    refreshAdminRecipientPreview();
    loadAdminEvents();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = '✉️ Confirm & Send Invitations';
  }
}

// -------------------------------------------------------------------------
// 3. MEMBERSHIP INVITATIONS GOVERNANCE
// -------------------------------------------------------------------------

async function loadAdminMembershipInvitations() {
  const tbody = document.getElementById('adminInvitationsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="muted-text" style="text-align: center; padding: 1.5rem;">Loading membership invitations...</td></tr>';

  try {
    const res = await fetch(`/api/admin/invitations?viewerId=${encodeURIComponent(currentUserId)}`);
    if (!res.ok) throw new Error('Failed to load invitations');
    const data = await res.json();
    const tokens = Array.isArray(data) ? data : (data.invitations || []);

    if (tokens.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted-text" style="text-align: center; padding: 2rem;">No invitations generated yet. Click "+ Generate Invitation" above.</td></tr>';
      return;
    }

    tbody.innerHTML = tokens.map(t => {
      const isClaimed = (t.status === 'claimed' || t.is_claimed);
      const isRevoked = (t.status === 'revoked');
      const isApproved = (t.status === 'approved');

      return `
        <tr>
          <td>
            <strong>${escapeHtml(t.email)}</strong>
            ${t.full_name ? `<br><small class="muted-text">${escapeHtml(t.full_name)}</small>` : ''}
          </td>
          <td><code style="color: #38bdf8; font-weight: 700;">${escapeHtml(t.token)}</code></td>
          <td>
            <span class="badge ${isClaimed ? 'badge-success' : isRevoked ? 'badge-danger' : isApproved ? 'badge-cyan' : 'badge-warning'}">
              ${(t.status || 'PENDING').toUpperCase()}
            </span>
          </td>
          <td class="muted-text">${t.created_at ? t.created_at.split('T')[0] : '—'}</td>
          <td class="muted-text">${t.expires_at ? t.expires_at.split('T')[0] : 'No expiry'}</td>
          <td>
            ${isClaimed ? (t.claimed_by_user_name || t.claimed_by_user_email || t.claimed_by_user_id || 'Claimed') : '—'}
          </td>
          <td>
            ${!isClaimed && !isRevoked ? `
              <button class="btn btn-xs btn-danger-pill" onclick="revokeAdminInvitation('${t.id}', '${t.token}')">
                Revoke
              </button>
            ` : '—'}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color: #ef4444; padding: 1.5rem;">Error: ${err.message}</td></tr>`;
  }
}

function toggleAdminCreateInviteCard() {
  const card = document.getElementById('adminCreateInviteCard');
  if (card) {
    card.style.display = (card.style.display === 'none' ? 'block' : 'none');
  }
}

async function submitAdminCreateInvite() {
  const email = document.getElementById('adminNewInviteEmail')?.value.trim();
  const name = document.getElementById('adminNewInviteName')?.value.trim();
  const days = parseInt(document.getElementById('adminNewInviteDays')?.value, 10) || 14;

  if (!email) {
    showToast('Please enter an applicant email address.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/admin/invitations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        fullName: name,
        expiresInDays: days,
        createdBy: currentUserId
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to issue invitation token');
    }

    const data = await res.json();
    showToast(`Token issued: ${data.token} (Expires: ${data.expiresAt.split('T')[0]})`, 'success');
    document.getElementById('adminNewInviteEmail').value = '';
    document.getElementById('adminNewInviteName').value = '';
    toggleAdminCreateInviteCard();
    loadAdminMembershipInvitations();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function revokeAdminInvitation(id, token) {
  if (!confirm(`Are you sure you want to revoke invitation token "${token}"?`)) return;

  try {
    const res = await fetch('/api/admin/invitations/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, token, revokedBy: currentUserId })
    });

    if (!res.ok) throw new Error('Revocation failed');
    showToast(`Token ${token} has been revoked.`, 'success');
    loadAdminMembershipInvitations();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// -------------------------------------------------------------------------
// 4. IMMUTABLE AUDIT LOGS
// -------------------------------------------------------------------------

async function loadAdminAuditLogs() {
  const feed = document.getElementById('adminAuditLogFeed');
  if (!feed) return;
  feed.innerHTML = '<div class="inbox-loading-state">Loading immutable audit log trail...</div>';

  try {
    const res = await fetch(`/api/admin/audit-logs?viewerId=${encodeURIComponent(currentUserId)}`);
    if (!res.ok) throw new Error('Unauthorized to view audit trail');
    const data = await res.json();
    const logs = Array.isArray(data) ? data : (data.logs || []);

    if (logs.length === 0) {
      feed.innerHTML = '<p class="muted-text" style="padding: 2rem; text-align: center;">No audit logs recorded yet.</p>';
      return;
    }

    feed.innerHTML = logs.map(l => {
      const timeStr = l.created_at ? l.created_at.replace('T', ' ').slice(0, 19) : '';
      return `
        <div class="audit-feed-item">
          <div>
            <div class="audit-feed-action">${escapeHtml(l.action)} · <span class="muted-text">${escapeHtml(l.entity_type || 'system')}</span></div>
            <div class="audit-feed-meta">
              Target ID: <code>${escapeHtml(l.entity_id || '—')}</code> · ${timeStr}
            </div>
            ${l.details ? `<div style="font-size: 0.78rem; color: #94a3b8; margin-top: 4px;">${escapeHtml(typeof l.details === 'string' ? l.details : JSON.stringify(l.details))}</div>` : ''}
          </div>
          <span class="audit-actor-tag">Actor: ${escapeHtml(l.actor_id || 'admin')}</span>
        </div>
      `;
    }).join('');
  } catch (err) {
    feed.innerHTML = `<p class="muted-text" style="color: #ef4444; padding: 1.5rem;">Error: ${err.message}</p>`;
  }
}

// -------------------------------------------------------------------------
// 5. IN-APP NOTIFICATIONS & EVENT INVITATIONS DROPDOWN
// -------------------------------------------------------------------------

let webNotificationsCache = [];

async function initWebNotifications() {
  fetchWebNotifications();
  setInterval(fetchWebNotifications, 25000);
}

async function fetchWebNotifications() {
  if (!currentUserId) return;
  try {
    const res = await fetch(`/api/notifications?viewerId=${encodeURIComponent(currentUserId)}`);
    if (!res.ok) return;
    const data = await res.json();
    webNotificationsCache = data.notifications || [];
    const unread = data.unread_count || 0;

    const badge = document.getElementById('webNotifBadge');
    if (badge) {
      if (unread > 0) {
        badge.style.display = 'flex';
        badge.textContent = unread > 9 ? '9+' : unread;
      } else {
        badge.style.display = 'none';
      }
    }
  } catch {
    // ignore
  }
}

function toggleWebNotificationsDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('webNotifDropdown');
  if (!dropdown) return;

  const isOpen = (dropdown.style.display === 'block');
  if (isOpen) {
    dropdown.style.display = 'none';
  } else {
    dropdown.style.display = 'block';
    renderWebNotificationsList();
  }
}

document.addEventListener('click', (e) => {
  const container = document.getElementById('notifBellContainer');
  const dropdown = document.getElementById('webNotifDropdown');
  if (dropdown && dropdown.style.display === 'block' && container && !container.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});

function renderWebNotificationsList() {
  const listEl = document.getElementById('webNotifList');
  if (!listEl) return;

  if (webNotificationsCache.length === 0) {
    listEl.innerHTML = '<p class="muted-text" style="padding: 1.5rem; text-align: center;">No notifications</p>';
    return;
  }

  listEl.innerHTML = webNotificationsCache.map(n => {
    const isUnread = (n.is_read === 0);
    const isInvite = (n.type === 'event_invitation');
    const timeStr = formatTimeAgo(n.created_at);

    return `
      <div class="notif-item-card ${isUnread ? 'unread' : ''}">
        <div class="notif-item-title">${escapeHtml(n.title)}</div>
        <div class="notif-item-msg">${escapeHtml(n.body || n.message || '')}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: var(--text-dim);">
          <span>${timeStr}</span>
          ${isUnread ? `<button class="btn btn-xs btn-ghost-pill" onclick="markWebNotificationRead('${n.id}')">Mark read</button>` : ''}
        </div>
        ${isInvite && (n.entity_id || n.event_id) ? `
          <div class="notif-rsvp-actions">
            <button class="btn btn-xs btn-white-pill" onclick="respondWebNotificationRsvp('${n.entity_id || n.event_id}', 'registered', '${n.id}')">
              ✓ Accept RSVP
            </button>
            <button class="btn btn-xs btn-outline" onclick="respondWebNotificationRsvp('${n.entity_id || n.event_id}', 'none', '${n.id}')">
              ✕ Decline
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

async function markWebNotificationRead(notifId) {
  try {
    await fetch(`/api/notifications/${encodeURIComponent(notifId)}/read?viewerId=${encodeURIComponent(currentUserId)}`, {
      method: 'POST'
    });
    fetchWebNotifications();
  } catch {
    // ignore
  }
}

async function markAllWebNotificationsRead(e) {
  if (e) e.stopPropagation();
  try {
    await fetch(`/api/notifications/read-all?viewerId=${encodeURIComponent(currentUserId)}`, {
      method: 'POST'
    });
    fetchWebNotifications();
    showToast('All notifications marked as read.', 'success');
  } catch {
    // ignore
  }
}

async function respondWebNotificationRsvp(eventId, rsvpStatus, notifId) {
  try {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUserId,
        status: rsvpStatus
      })
    });

    if (!res.ok) throw new Error('RSVP submission failed');
    await markWebNotificationRead(notifId);
    showToast(rsvpStatus === 'registered' ? 'RSVP Accepted! See you there.' : 'Invitation declined.', 'success');
    if (typeof loadEvents === 'function') loadEvents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}


