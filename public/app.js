// ─── Helpers ────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const notesInput   = $('notesInput');
const summarizeBtn = $('summarizeBtn');

const imageInput = $('imageInput');
const imageUploadBtn = $('imageUploadBtn');
const imagePreviewContainer = $('imagePreviewContainer');
const imagePreview = $('imagePreview');
const removeImageBtn = $('removeImageBtn');
const summarizeImageBtn = $('summarizeImageBtn');

const emptyState   = $('emptyState');
const loadingState = $('loadingState');
const results      = $('results');
const historyKey   = 'notewise_history_v1';

let currentResult = null;
let currentInput  = '';

// ─── Storage ─────────────────────────────────────────────────────────────────
function getHistory() {
  try { return JSON.parse(localStorage.getItem(historyKey)) || []; } catch { return []; }
}
function setHistory(items) {
  localStorage.setItem(historyKey, JSON.stringify(items));
  updateHistoryCount();
}

// ─── UI helpers ──────────────────────────────────────────────────────────────
function updateHistoryCount() {
  const count = getHistory().length;
  $('historyCount').textContent = count;
  $('historyMeta').textContent  = `${count} saved summar${count === 1 ? 'y' : 'ies'}`;
}

function showToast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// FEATURE 4 — Word & Character Counter
function updateCounts() {
  const text  = notesInput.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  $('wordCount').textContent = `${words.toLocaleString()} word${words === 1 ? '' : 's'}`;
  $('charCount').textContent = `${text.length.toLocaleString()} / 50,000`;
}

function setLoading(isLoading) {
  summarizeBtn.disabled = isLoading;
  emptyState.classList.toggle('hidden',   isLoading || Boolean(currentResult));
  loadingState.classList.toggle('hidden', !isLoading);
  results.classList.toggle('hidden',      isLoading || !currentResult);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c])
  );
}

// ─── Render result ───────────────────────────────────────────────────────────
function renderResult(result) {
  currentResult = result;
  emptyState.classList.add('hidden');
  loadingState.classList.add('hidden');
  results.classList.remove('hidden');

  $('summaryText').textContent = result.summary;

  $('keyPoints').innerHTML = result.keyPoints.length
    ? result.keyPoints.map(x => `<li>${escapeHtml(x)}</li>`).join('')
    : '<li>No key points were identified.</li>';

  $('actionItems').innerHTML = result.actionItems.length
    ? `<div class="action-row header"><span>Task</span><span>Owner</span><span>Deadline</span></div>`
      + result.actionItems.map(x =>
          `<div class="action-row"><span>${escapeHtml(x.task)}</span><span>${escapeHtml(x.owner)}</span><span>${escapeHtml(x.deadline)}</span></div>`
        ).join('')
    : '<div class="action-row"><span>No action items identified.</span><span>—</span><span>—</span></div>';

  $('topics').innerHTML = result.importantTopics.length
    ? result.importantTopics.map(x => `<span class="tag">${escapeHtml(x)}</span>`).join('')
    : '<span class="tag">General notes</span>';
}

// FEATURE 5 — Copy All Results (full text)
function resultText() {
  if (!currentResult) return '';
  let out = `NOTEWISE AI SUMMARY\n\nSUMMARY\n${currentResult.summary}\n\nKEY POINTS\n`;
  currentResult.keyPoints.forEach((x, i) => { out += `${i + 1}. ${x}\n`; });
  out += '\nACTION ITEMS\n';
  currentResult.actionItems.forEach(x => {
    out += `- ${x.task} | Owner: ${x.owner} | Deadline: ${x.deadline}\n`;
  });
  out += '\nIMPORTANT TOPICS\n' + currentResult.importantTopics.join(', ');
  return out;
}

// FEATURE 1 — Save note with title
function saveCurrent() {
  const history = getHistory();
  let title = $('noteTitle').value.trim();
  if (!title) { title = currentInput.split(/\s+/).slice(0, 4).join(' ') || 'Untitled Note'; }
  const item = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    title,
    fullNote: currentInput,
    preview:  currentInput.replace(/\s+/g, ' ').trim().slice(0, 180),
    result:   currentResult
  };
  setHistory([item, ...history].slice(0, 30));
}

// ─── Summarize ───────────────────────────────────────────────────────────────
async function summarize() {
  const notes = notesInput.value.trim();
  if (!notes) { showToast('Paste your notes first.'); notesInput.focus(); return; }
  if (notes.length < 40) { showToast('Add a little more detail first.'); return; }

  currentInput  = notes;
  currentResult = null;

  $('emptyState').innerHTML = `<div class="empty-icon">✦</div><h2>Your AI summary will appear here</h2><p>Submit your notes to generate a concise summary, key points, and action items.</p><div class="mini-flow"><span>Paste</span><i>→</i><span>AI analyzes</span><i>→</i><span>Review</span></div>`;

  setLoading(true);

  try {
    const response = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });

    let data;
    try {
      data = await response.json();
    } catch (err) {
      if (response.status === 429) {
        throw new Error('The AI service has temporarily reached its usage limit. Please try again later.');
      }
      throw new Error('The server returned an unexpected error. Please try again later.');
    }

    if (!response.ok) throw new Error(data.error || 'Unable to summarize.');

    renderResult(data.result);
    saveCurrent();
    showToast('Summary generated and saved.');
    $('resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (error) {
    setLoading(false);
    $('emptyState').innerHTML = `<div class="empty-icon" style="color:#ef4444;border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.1);">⚠</div><h2 style="color:#ef4444;">Analysis Failed</h2><p>${escapeHtml(error.message)}</p>`;
    showToast(error.message);
  }
}

// ─── View switching ──────────────────────────────────────────────────────────
function showView(view) {
  const isSummarizer = view === 'summarizer';
  $('summarizerView').classList.toggle('hidden', !isSummarizer);
  $('historyView').classList.toggle('hidden', isSummarizer);
  $('pageTitle').textContent = isSummarizer ? 'Summarizer' : 'History';
  document.querySelectorAll('.nav-item').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.view === view)
  );
  if (!isSummarizer) renderHistory();
  $('sidebar').classList.remove('open');
}

// FEATURE 2 — Search History + FEATURE 3 — Edit button in each item
function renderHistory() {
  const list  = $('historyList');
  const empty = $('historyEmpty');
  let history = getHistory();
  updateHistoryCount();

  // Filter by search term (title and full note content)
  const searchEl   = $('historySearch');
  const searchTerm = searchEl ? searchEl.value.toLowerCase().trim() : '';
  if (searchTerm) {
    history = history.filter(item => {
      const titleMatch   = item.title    && item.title.toLowerCase().includes(searchTerm);
      const contentMatch = item.fullNote && item.fullNote.toLowerCase().includes(searchTerm);
      const previewMatch = item.preview  && item.preview.toLowerCase().includes(searchTerm);
      return titleMatch || contentMatch || previewMatch;
    });
  }

  if (!history.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  // FEATURE 3 — each item gets Open | Edit | Delete
  list.innerHTML = history.map(item => {
    const date = new Date(item.createdAt);
    const displayTitle = item.title
      ? escapeHtml(item.title)
      : escapeHtml(item.result.summary.slice(0, 90)) + (item.result.summary.length > 90 ? '…' : '');
    return `
      <article class="history-item">
        <div>
          <h3>${displayTitle}</h3>
          <p>${escapeHtml(item.preview)}${item.preview.length >= 180 ? '…' : ''}</p>
          <div class="history-meta">${date.toLocaleString()} · ${item.result.keyPoints.length} key points · ${item.result.actionItems.length} action items</div>
        </div>
        <div class="history-actions">
          <button class="ghost-btn" data-open="${item.id}">Open</button>
          <button class="ghost-btn" data-edit="${item.id}">Edit</button>
          <button class="ghost-btn danger" data-delete="${item.id}">Delete</button>
        </div>
      </article>`;
  }).join('');
}

// ─── Event listeners ─────────────────────────────────────────────────────────

// FEATURE 4 — live counter
notesInput.addEventListener('input', updateCounts);

// Summarize
summarizeBtn.addEventListener('click', summarize);

// PHOTO SUMMARIZER
imageUploadBtn.addEventListener('click', () => {
  imageInput.click();
});

imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];

  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    showToast('Image must be smaller than 10 MB.');
    imageInput.value = '';
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    imagePreview.src = e.target.result;
    imagePreviewContainer.classList.remove('hidden');
    summarizeImageBtn.classList.remove('hidden');
  };

  reader.readAsDataURL(file);
});

removeImageBtn.addEventListener('click', () => {
  imageInput.value = '';
  imagePreview.src = '';
  imagePreviewContainer.classList.add('hidden');
  summarizeImageBtn.classList.add('hidden');
});

summarizeImageBtn.addEventListener('click', async () => {
  const file = imageInput.files[0];

  if (!file) {
    showToast('Please upload a photo first.');
    return;
  }

  summarizeImageBtn.disabled = true;
  summarizeImageBtn.textContent = '✦ Processing Photo...';

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const response = await fetch('/api/summarize-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageData: base64,
        mimeType: file.type
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Unable to summarize the photo.');
    }

    currentInput = '[Photo of notes]';
    renderResult(data.result);

    showToast('Photo summarized successfully.');

  } catch (error) {
    console.error('Photo summarization error:', error);
    showToast(error.message || 'Unable to summarize the photo.');
  } finally {
    summarizeImageBtn.disabled = false;
    summarizeImageBtn.textContent = '✦ Summarize Photo with AI';
  }
});

// Clear notes
$('clearBtn').addEventListener('click', () => {
  if (notesInput.value.trim() && !confirm('Are you sure you want to clear your notes? This cannot be undone.')) return;
  notesInput.value    = '';
  $('noteTitle').value = '';
  updateCounts();
  notesInput.focus();
  showToast('Notes cleared.');
});

// New summary
$('newBtn').addEventListener('click', () => {
  currentResult        = null;
  notesInput.value     = '';
  $('noteTitle').value = '';
  updateCounts();
  setLoading(false);
  notesInput.focus();
});

// FEATURE 5 — Copy All Results
$('copyBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText(resultText());
  showToast('All results copied to clipboard.');
});

// Download
$('downloadBtn').addEventListener('click', () => {
  const blob = new Blob([resultText()], { type: 'text/plain' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `notewise-summary-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Download started.');
});

// Nav items
document.querySelectorAll('.nav-item').forEach(btn =>
  btn.addEventListener('click', () => showView(btn.dataset.view))
);

// Clear all history
$('clearHistoryBtn').addEventListener('click', () => {
  if (getHistory().length && !confirm('Clear all saved summaries from this browser?')) return;
  setHistory([]);
  renderHistory();
  showToast('History cleared.');
});

// Go to summarizer from empty history state
$('goSummarizerBtn').addEventListener('click', () => showView('summarizer'));

// FEATURE 2 — Search field: wire up input event once on page load
$('historySearch').addEventListener('input', renderHistory);

// FEATURE 3 — History list delegation: Open, Edit, Delete
$('historyList').addEventListener('click', (e) => {
  const openBtn   = e.target.closest('[data-open]');
  const editBtn   = e.target.closest('[data-edit]');
  const deleteBtn = e.target.closest('[data-delete]');
  const history   = getHistory();

  if (deleteBtn) {
    setHistory(history.filter(x => String(x.id) !== deleteBtn.dataset.delete));
    renderHistory();
    showToast('Summary deleted.');
  }

  if (openBtn) {
    const item = history.find(x => String(x.id) === openBtn.dataset.open);
    if (item) {
      notesInput.value     = item.fullNote || item.preview;
      $('noteTitle').value = item.title || '';
      currentInput         = item.fullNote || item.preview;
      renderResult(item.result);
      updateCounts();
      showView('summarizer');
    }
  }

  // FEATURE 3 — Edit: load title + original note back into Summarizer (no result, ready to re-summarize)
  if (editBtn) {
    const item = history.find(x => String(x.id) === editBtn.dataset.edit);
    if (item) {
      notesInput.value     = item.fullNote || item.preview;
      $('noteTitle').value = item.title || '';
      currentInput         = item.fullNote || item.preview;
      currentResult        = null;
      setLoading(false);
      updateCounts();
      showView('summarizer');
      notesInput.focus();
      showToast('Note loaded for editing. Make changes and summarize again.');
    }
  }
});

// Mobile sidebar toggle
$('mobileMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'));

// Keyboard shortcut Ctrl/Cmd+Enter
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); summarize(); }
});

// ─── Theme toggle ─────────────────────────────────────────────────────────────
const themeToggle = $('themeToggle');
const iconMoon    = themeToggle.querySelector('.icon-moon');
const iconSun     = themeToggle.querySelector('.icon-sun');

if (document.documentElement.getAttribute('data-theme') === 'light') {
  iconMoon.classList.add('hidden');
  iconSun.classList.remove('hidden');
}

themeToggle.addEventListener('click', () => {
  const isLight  = document.documentElement.getAttribute('data-theme') === 'light';
  const newTheme = isLight ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('notewise_theme', newTheme);
  if (newTheme === 'light') {
    iconMoon.classList.add('hidden');
    iconSun.classList.remove('hidden');
  } else {
    iconSun.classList.add('hidden');
    iconMoon.classList.remove('hidden');
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
$('todayLabel').textContent = new Intl.DateTimeFormat('en-US', {
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
}).format(new Date());

updateCounts();
updateHistoryCount();

fetch('/api/health')
  .then(r => r.json())
  .then(data => {
    if (data.aiConfigured) {
      $('statusDot').classList.add('ok');
      $('statusText').textContent = 'AI service ready';
    } else {
      $('statusText').textContent = 'AI key not configured';
    }
  })
  .catch(() => { $('statusText').textContent = 'Service unavailable'; });
