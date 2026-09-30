const $ = (id) => document.getElementById(id);
const notesInput = $('notesInput');
const summarizeBtn = $('summarizeBtn');
const emptyState = $('emptyState');
const loadingState = $('loadingState');
const results = $('results');
const historyKey = 'notewise_history_v1';
let currentResult = null;
let currentInput = '';

function getHistory(){try{return JSON.parse(localStorage.getItem(historyKey)) || []}catch{return []}}
function setHistory(items){localStorage.setItem(historyKey, JSON.stringify(items)); updateHistoryCount();}
function updateHistoryCount(){const count=getHistory().length;$('historyCount').textContent=count;$('historyMeta').textContent=`${count} saved summar${count===1?'y':'ies'}`}
function showToast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.remove('show'),2200)}
function updateCounts(){const text=notesInput.value;const words=text.trim()?text.trim().split(/\s+/).length:0;$('wordCount').textContent=`${words.toLocaleString()} word${words===1?'':'s'}`;$('charCount').textContent=`${text.length.toLocaleString()} / 50,000`}
function setLoading(isLoading){summarizeBtn.disabled=isLoading;emptyState.classList.toggle('hidden',isLoading||Boolean(currentResult));loadingState.classList.toggle('hidden',!isLoading);results.classList.toggle('hidden',isLoading||!currentResult)}
function renderResult(result){currentResult=result;emptyState.classList.add('hidden');loadingState.classList.add('hidden');results.classList.remove('hidden');$('summaryText').textContent=result.summary;
 $('keyPoints').innerHTML=result.keyPoints.length?result.keyPoints.map(x=>`<li>${escapeHtml(x)}</li>`).join(''):'<li>No key points were identified.</li>';
 $('actionItems').innerHTML=result.actionItems.length?`<div class="action-row header"><span>Task</span><span>Owner</span><span>Deadline</span></div>`+result.actionItems.map(x=>`<div class="action-row"><span>${escapeHtml(x.task)}</span><span>${escapeHtml(x.owner)}</span><span>${escapeHtml(x.deadline)}</span></div>`).join(''):'<div class="action-row"><span>No action items identified.</span><span>—</span><span>—</span></div>';
 $('topics').innerHTML=result.importantTopics.length?result.importantTopics.map(x=>`<span class="tag">${escapeHtml(x)}</span>`).join(''):'<span class="tag">General notes</span>';
}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
function resultText(){if(!currentResult)return '';let out=`NOTEWISE AI SUMMARY\n\nSUMMARY\n${currentResult.summary}\n\nKEY POINTS\n`;currentResult.keyPoints.forEach((x,i)=>out+=`${i+1}. ${x}\n`);out+='\nACTION ITEMS\n';currentResult.actionItems.forEach(x=>out+=`- ${x.task} | Owner: ${x.owner} | Deadline: ${x.deadline}\n`);out+='\nIMPORTANT TOPICS\n'+currentResult.importantTopics.join(', ');return out}
function saveCurrent(){const history=getHistory();const item={id:Date.now(),createdAt:new Date().toISOString(),preview:currentInput.replace(/\s+/g,' ').trim().slice(0,180),result:currentResult};setHistory([item,...history].slice(0,30));}
async function summarize(){
  const notes=notesInput.value.trim();
  if(!notes){showToast('Paste your notes first.');notesInput.focus();return}
  if(notes.length<40){showToast('Add a little more detail first.');return}
  currentInput=notes;
  currentResult=null;
  
  // Reset empty state in case it was an error before
  $('emptyState').innerHTML = `<div class="empty-icon">✦</div><h2>Your AI summary will appear here</h2><p>Submit your notes to generate a concise summary, key points, and action items.</p><div class="mini-flow"><span>Paste</span><i>→</i><span>AI analyzes</span><i>→</i><span>Review</span></div>`;
  
  setLoading(true);
  
  try{
    const response=await fetch('/api/summarize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({notes})});
    
    let data;
    try {
      data = await response.json();
    } catch(err) {
      if (response.status === 429) {
        throw new Error('The AI service has temporarily reached its usage limit. Please try again later.');
      }
      throw new Error('The server returned an unexpected error. Please try again later.');
    }
    
    if(!response.ok) throw new Error(data.error||'Unable to summarize.');
    
    renderResult(data.result);
    saveCurrent();
    showToast('Summary generated and saved.');
    $('resultCard').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){
    setLoading(false);
    $('emptyState').innerHTML = `<div class="empty-icon" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.1);">⚠</div><h2 style="color: #ef4444;">Analysis Failed</h2><p>${escapeHtml(error.message)}</p>`;
    showToast(error.message);
  }
}
function showView(view){const summarizer=view==='summarizer';$('summarizerView').classList.toggle('hidden',!summarizer);$('historyView').classList.toggle('hidden',summarizer);$('pageTitle').textContent=summarizer?'Summarizer':'History';document.querySelectorAll('.nav-item').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view));if(!summarizer)renderHistory();$('sidebar').classList.remove('open')}
function renderHistory(){const list=$('historyList'),empty=$('historyEmpty'),history=getHistory();updateHistoryCount();if(!history.length){list.innerHTML='';empty.classList.remove('hidden');return}empty.classList.add('hidden');list.innerHTML=history.map(item=>{const date=new Date(item.createdAt);return `<article class="history-item"><div><h3>${escapeHtml(item.result.summary.slice(0,90))}${item.result.summary.length>90?'…':''}</h3><p>${escapeHtml(item.preview)}${item.preview.length>=180?'…':''}</p><div class="history-meta">${date.toLocaleString()} · ${item.result.keyPoints.length} key points · ${item.result.actionItems.length} action items</div></div><div class="history-actions"><button class="ghost-btn" data-open="${item.id}">Open</button><button class="ghost-btn danger" data-delete="${item.id}">Delete</button></div></article>`}).join('')}
notesInput.addEventListener('input',updateCounts);summarizeBtn.addEventListener('click',summarize);$('clearBtn').addEventListener('click',()=>{notesInput.value='';updateCounts();notesInput.focus();showToast('Notes cleared.');});$('newBtn').addEventListener('click',()=>{currentResult=null;notesInput.value='';updateCounts();setLoading(false);notesInput.focus();});$('copyBtn').addEventListener('click',async()=>{await navigator.clipboard.writeText(resultText());showToast('Results copied.');});$('downloadBtn').addEventListener('click',()=>{const blob=new Blob([resultText()],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`notewise-summary-${new Date().toISOString().slice(0,10)}.txt`;a.click();URL.revokeObjectURL(a.href);showToast('Download started.');});document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));$('clearHistoryBtn').addEventListener('click',()=>{if(getHistory().length&&!confirm('Clear all saved summaries from this browser?'))return;setHistory([]);renderHistory();showToast('History cleared.');});$('goSummarizerBtn').addEventListener('click',()=>showView('summarizer'));$('historyList').addEventListener('click',(e)=>{const open=e.target.closest('[data-open]');const del=e.target.closest('[data-delete]');const history=getHistory();if(del){setHistory(history.filter(x=>String(x.id)!==del.dataset.delete));renderHistory();showToast('Summary deleted.');}if(open){const item=history.find(x=>String(x.id)===open.dataset.open);if(item){notesInput.value=item.preview;currentInput=item.preview;renderResult(item.result);showView('summarizer');}}});$('mobileMenu').addEventListener('click',()=>$('sidebar').classList.toggle('open'));document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();summarize()}});
$('todayLabel').textContent=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date());updateCounts();updateHistoryCount();
fetch('/api/health').then(r=>r.json()).then(data=>{if(data.aiConfigured){$('statusDot').classList.add('ok');$('statusText').textContent='AI service ready'}else $('statusText').textContent='AI key not configured'}).catch(()=>{$('statusText').textContent='Service unavailable'});

const themeToggle = $('themeToggle');
const iconMoon = themeToggle.querySelector('.icon-moon');
const iconSun = themeToggle.querySelector('.icon-sun');

if (document.documentElement.getAttribute('data-theme') === 'light') {
  iconMoon.classList.add('hidden');
  iconSun.classList.remove('hidden');
}

themeToggle.addEventListener('click', () => {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
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
