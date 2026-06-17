// State Management
let allUpdates = [];
let selectedUpdate = null;
let currentFilterType = 'all';
let searchQuery = '';

// SVG Progress circle config
const RING_RADIUS = 14;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ~87.96

// Elements
const btnRefresh = document.getElementById('btn-refresh');
const syncStatus = document.getElementById('sync-status');
const statusIndicator = syncStatus.querySelector('.status-indicator');
const statusText = syncStatus.querySelector('.status-text');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const filterChips = document.querySelectorAll('.filter-chip');
const statsDisplay = document.getElementById('count-value');
const notesGrid = document.getElementById('notes-grid');
const loadingSkeleton = document.getElementById('loading-skeleton');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('empty-state');
const btnRetry = document.getElementById('btn-retry');
const btnClearFilters = document.getElementById('btn-clear-filters');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const btnModalClose = document.getElementById('btn-modal-close');
const btnModalCancel = document.getElementById('btn-modal-cancel');
const btnModalTweet = document.getElementById('btn-modal-tweet');
const tweetTextarea = document.getElementById('tweet-textarea');
const modalPreviewText = document.getElementById('modal-preview-text');
const charProgressCircle = document.getElementById('char-progress');
const charCountDisplay = document.getElementById('char-count');
const charWarningMsg = document.getElementById('char-warning');
const hashtagPills = document.querySelectorAll('.tag-pill');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initProgressRing();
    fetchReleaseNotes(false);
    setupEventListeners();
});

// Initialize SVG Progress Circle
function initProgressRing() {
    charProgressCircle.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
    charProgressCircle.style.strokeDashoffset = RING_CIRCUMFERENCE;
}

// Event Listeners Setup
function setupEventListeners() {
    // Refresh buttons
    btnRefresh.addEventListener('click', () => fetchReleaseNotes(true));
    btnRetry.addEventListener('click', () => fetchReleaseNotes(true));
    
    // Search
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        searchClear.style.display = searchQuery ? 'flex' : 'none';
        renderUpdates();
    });
    
    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        searchClear.style.display = 'none';
        searchInput.focus();
        renderUpdates();
    });
    
    // Filters
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilterType = chip.getAttribute('data-type');
            renderUpdates();
        });
    });
    
    btnClearFilters.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        searchClear.style.display = 'none';
        
        filterChips.forEach(c => c.classList.remove('active'));
        document.querySelector('.filter-chip[data-type="all"]').classList.add('active');
        currentFilterType = 'all';
        
        renderUpdates();
    });
    
    // Modal Close
    btnModalClose.addEventListener('click', hideTweetModal);
    btnModalCancel.addEventListener('click', hideTweetModal);
    
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            hideTweetModal();
        }
    });
    
    // Tweet textarea character counter
    tweetTextarea.addEventListener('input', updateTweetComposerStatus);
    
    // Quick add hashtag pills
    hashtagPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const hashtag = pill.getAttribute('data-hashtag');
            const currentText = tweetTextarea.value;
            
            // Append with space if needed
            if (currentText.trim() === '') {
                tweetTextarea.value = hashtag;
            } else if (currentText.endsWith(' ') || currentText.endsWith('\n')) {
                tweetTextarea.value += hashtag;
            } else {
                tweetTextarea.value += ' ' + hashtag;
            }
            
            tweetTextarea.focus();
            updateTweetComposerStatus();
        });
    });
    
    // Share on Twitter Button click
    btnModalTweet.addEventListener('click', executeTweetShare);
}

// Fetch Notes from Flask Backend
async function fetchReleaseNotes(forceRefresh = false) {
    showLoadingState();
    
    try {
        const url = `/api/notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'error') {
            throw new Error(data.message);
        }
        
        // Parse raw feed entries into individual updates
        allUpdates = [];
        data.notes.forEach(entry => {
            const parsed = parseFeedEntry(entry);
            allUpdates.push(...parsed);
        });
        
        // Sort updates: newest first
        allUpdates.sort((a, b) => new Date(b.updated) - new Date(a.updated));
        
        // Update Sync Status
        updateSyncIndicator(data.last_fetched, data.source);
        
        // Render Notes Grid
        renderUpdates();
        
    } catch (err) {
        console.error('Error fetching release notes:', err);
        showErrorState(err.message || 'Could not connect to the release notes server.');
    }
}

// Parsing raw RSS entry content to split it into discrete updates
function parseFeedEntry(entry) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(entry.content, 'text/html');
    const updates = [];
    const children = Array.from(doc.body.children);
    
    // If the feed entry has no HTML tags or no heading tags
    if (children.length === 0 || !doc.querySelector('h3, h2, h4')) {
        const textContent = doc.body.textContent.trim().replace(/\s+/g, ' ');
        if (textContent) {
            updates.push({
                id: `${entry.id}_0`,
                date: entry.title,
                updated: entry.updated,
                type: 'Update',
                htmlContent: entry.content,
                textContent: textContent,
                link: entry.link
            });
        }
        return updates;
    }
    
    let currentUpdate = null;
    
    children.forEach((child) => {
        const tagName = child.tagName;
        if (tagName === 'H3' || tagName === 'H2' || tagName === 'H4') {
            // Push previous update group if it exists
            if (currentUpdate) {
                updates.push(currentUpdate);
            }
            
            currentUpdate = {
                type: normalizeUpdateType(child.textContent),
                date: entry.title,
                updated: entry.updated,
                id: entry.id,
                link: entry.link,
                elements: []
            };
        } else {
            // Add paragraphs/lists/etc. to current update block
            if (!currentUpdate) {
                // If feed content lacks an initial header
                currentUpdate = {
                    type: 'Update',
                    date: entry.title,
                    updated: entry.updated,
                    id: entry.id,
                    link: entry.link,
                    elements: []
                };
            }
            currentUpdate.elements.push(child.cloneNode(true));
        }
    });
    
    if (currentUpdate) {
        updates.push(currentUpdate);
    }
    
    // Construct final objects
    return updates.map((up, index) => {
        const container = document.createElement('div');
        up.elements.forEach(el => container.appendChild(el));
        
        const textContent = container.textContent.trim().replace(/\s+/g, ' ');
        
        return {
            id: `${up.id}_${index}`,
            date: up.date,
            updated: up.updated,
            type: up.type,
            htmlContent: container.innerHTML,
            textContent: textContent,
            link: up.link
        };
    });
}

// Normalize categories into singular standardized tags
function normalizeUpdateType(typeStr) {
    const clean = typeStr.trim().toLowerCase();
    if (clean.includes('feature')) return 'Feature';
    if (clean.includes('announcement')) return 'Announcement';
    if (clean.includes('issue')) return 'Issue';
    if (clean.includes('deprecat')) return 'Deprecated';
    if (clean.includes('change')) return 'Changed';
    return typeStr.trim();
}

// Render Updates Grid
function renderUpdates() {
    // Clear grid
    notesGrid.innerHTML = '';
    
    // Filter
    const filtered = allUpdates.filter(up => {
        // Filter by Type Chip
        if (currentFilterType !== 'all') {
            if (up.type !== currentFilterType) return false;
        }
        
        // Filter by Search Query
        if (searchQuery) {
            const inContent = up.textContent.toLowerCase().includes(searchQuery);
            const inType = up.type.toLowerCase().includes(searchQuery);
            const inDate = up.date.toLowerCase().includes(searchQuery);
            if (!inContent && !inType && !inDate) return false;
        }
        
        return true;
    });
    
    // Update Stats Display
    statsDisplay.textContent = filtered.length;
    
    // Hide UI overlays
    loadingSkeleton.style.display = 'none';
    errorState.style.display = 'none';
    
    // Check Empty State
    if (filtered.length === 0) {
        notesGrid.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }
    
    emptyState.style.display = 'none';
    notesGrid.style.display = 'grid';
    
    // Append cards
    filtered.forEach((update, idx) => {
        const card = createCardElement(update, idx);
        notesGrid.appendChild(card);
    });
}

// Create individual card elements
function createCardElement(update, index) {
    const card = document.createElement('article');
    
    // Add classes
    card.classList.add('note-card');
    card.classList.add(`card-${update.type.toLowerCase()}`);
    
    // Set animations offset
    card.style.animationDelay = `${Math.min(index * 0.05, 0.4)}s`;
    
    card.innerHTML = `
        <div class="card-meta">
            <div class="meta-left">
                <span class="type-badge">${update.type}</span>
                <span class="card-date">${update.date}</span>
            </div>
            <button class="btn-card-tweet" aria-label="Tweet about this update">
                <svg viewBox="0 0 24 24" width="14" height="14">
                    <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span>Tweet</span>
            </button>
        </div>
        <div class="card-content">
            ${update.htmlContent}
        </div>
    `;
    
    // Share Button Event Listener
    const btnTweet = card.querySelector('.btn-card-tweet');
    btnTweet.addEventListener('click', (e) => {
        e.stopPropagation();
        openTweetComposer(update);
    });
    
    return card;
}

// Open Tweet Composer Dialog
function openTweetComposer(update) {
    selectedUpdate = update;
    
    // Display the original update description for reference
    modalPreviewText.textContent = update.textContent;
    
    // Generate prefilled draft template
    const draftText = generatePrefilledTweet(update);
    
    tweetTextarea.value = draftText;
    tweetModal.style.display = 'flex';
    
    // Force focus
    setTimeout(() => {
        tweetTextarea.focus();
        tweetTextarea.setSelectionRange(tweetTextarea.value.length, tweetTextarea.value.length);
    }, 100);
    
    updateTweetComposerStatus();
}

// Generate pre-formatted tweet body
function generatePrefilledTweet(update) {
    const dateStr = update.date;
    const typeStr = update.type;
    const cleanContent = update.textContent;
    const linkStr = update.link || 'https://cloud.google.com/bigquery/docs/release-notes';
    
    // Basic tweet structure: 📢 BigQuery Release Note: [type]: [content] ... #BigQuery #GCP [link]
    const header = `📢 BigQuery Release [${dateStr}]\n[${typeStr}]: `;
    const tags = `\n\n#BigQuery #GoogleCloud`;
    
    // Calculate remaining character count for actual description
    // Twitter links are shortened to 23 chars, but let's count literal links for safety or 23 chars
    const linkCharCount = 23;
    const reservedChars = header.length + tags.length + linkCharCount + 2; // +2 for spacing
    const maxDescLength = 280 - reservedChars;
    
    let description = cleanContent;
    if (description.length > maxDescLength) {
        description = description.substring(0, maxDescLength - 3) + '...';
    }
    
    return `${header}${description}${tags}\n${linkStr}`;
}

// Update Tweet Composer Char Count Progress Circular Ring
function updateTweetComposerStatus() {
    const text = tweetTextarea.value;
    const count = text.length;
    
    // Twitter counts URL as 23 characters regardless of length
    // Let's do a basic character count check or a regex URL check
    // For standard vanilla implementation, literal length is perfectly fine and safe for users
    const limit = 280;
    const remaining = limit - count;
    
    // Update counter text
    charCountDisplay.textContent = Math.abs(remaining);
    
    // Update circle progress
    const pct = Math.min((count / limit) * 100, 100);
    const strokeOffset = RING_CIRCUMFERENCE - (pct / 100) * RING_CIRCUMFERENCE;
    charProgressCircle.style.strokeDashoffset = strokeOffset;
    
    // Styling states based on characters remaining
    if (remaining < 0) {
        // Over limit
        charProgressCircle.style.stroke = 'var(--accent-rose)';
        charCountDisplay.classList.add('danger');
        charCountDisplay.classList.remove('warning');
        charWarningMsg.style.display = 'inline-block';
        btnModalTweet.disabled = true;
    } else if (remaining <= 20) {
        // Warning near limit
        charProgressCircle.style.stroke = 'var(--accent-amber)';
        charCountDisplay.classList.add('warning');
        charCountDisplay.classList.remove('danger');
        charWarningMsg.style.display = 'none';
        btnModalTweet.disabled = false;
    } else {
        // Normal
        charProgressCircle.style.stroke = '#1d9bf0'; // Twitter Blue
        charCountDisplay.classList.remove('warning', 'danger');
        charWarningMsg.style.display = 'none';
        btnModalTweet.disabled = count === 0;
    }
}

// Open Twitter intent window
function executeTweetShare() {
    const tweetText = tweetTextarea.value;
    if (tweetText.length > 280) return;
    
    const encodedText = encodeURIComponent(tweetText);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    hideTweetModal();
}

function hideTweetModal() {
    tweetModal.style.display = 'none';
    selectedUpdate = null;
}

// UI State Toggles
function showLoadingState() {
    btnRefresh.classList.add('loading');
    btnRefresh.disabled = true;
    statusIndicator.className = 'status-indicator syncing';
    statusText.textContent = 'Syncing...';
    
    loadingSkeleton.style.display = 'block';
    notesGrid.style.display = 'none';
    errorState.style.display = 'none';
    emptyState.style.display = 'none';
}

function showErrorState(msg) {
    btnRefresh.classList.remove('loading');
    btnRefresh.disabled = false;
    statusIndicator.className = 'status-indicator';
    statusIndicator.style.backgroundColor = 'var(--accent-rose)';
    statusIndicator.style.boxShadow = '0 0 8px var(--accent-rose)';
    statusText.textContent = 'Sync failed';
    
    loadingSkeleton.style.display = 'none';
    notesGrid.style.display = 'none';
    emptyState.style.display = 'none';
    
    errorMessage.textContent = msg;
    errorState.style.display = 'flex';
}

function updateSyncIndicator(timestamp, source) {
    btnRefresh.classList.remove('loading');
    btnRefresh.disabled = false;
    statusIndicator.className = 'status-indicator';
    statusIndicator.style.backgroundColor = 'var(--accent-emerald)';
    statusIndicator.style.boxShadow = '0 0 8px var(--accent-emerald)';
    
    const date = new Date(timestamp * 1000);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const isCached = source === 'cache' || source === 'cache_fallback';
    
    statusText.textContent = `Synced at ${timeStr} ${isCached ? '(Cached)' : ''}`;
}
