/**
 * DataDetective — AI Chart Forensics
 * Powered by Gemma 4 running locally via Ollama
 */

// ============================================
// Configuration
// ============================================
const CONFIG = {
  OLLAMA_BASE: 'http://localhost:11434',
  MAX_IMAGE_DIMENSION: 1536,
};

const SYSTEM_PROMPT = `You are DataDetective, an expert data visualization forensics analyst. Your job is to carefully examine chart and graph images to:

1. Identify the chart type and what data it presents
2. Extract approximate data values shown
3. Detect any misleading visualization techniques
4. Rate the chart's integrity on a 0-100 scale
5. Provide constructive improvement suggestions

Common misleading techniques to look for:
- Truncated or non-zero Y-axis baselines
- Cherry-picked date ranges or data subsets
- Misleading aspect ratios (overly wide/narrow)
- 3D effects that distort proportions
- Dual Y-axes with manipulated scales
- Missing labels, units, or source attribution
- Inconsistent intervals on axes
- Area/volume representations that exaggerate differences
- Pie charts with percentages not summing to 100%
- Manipulated color choices to bias perception
- Missing error bars or confidence intervals
- Extrapolation presented as data

Be fair and balanced. Good charts should score high. Only flag real issues.

ANALYSIS PROCEDURE — work through these steps IN PLAIN TEXT before producing any JSON. Thinking out loud first dramatically improves accuracy:
Step 1 — Axis baseline: State the value axis minimum. For a bar/column chart, does it start at zero? If NOT, the visual heights exaggerate the real differences — this is a HIGH-severity "Truncated Y-axis" issue and trustScore should be 45 or below.
Step 2 — Pie/donut totals: Add up every slice percentage and write the sum. If it is not ~100%, that is a HIGH-severity issue and trustScore should be 40 or below.
Step 3 — Time window: If a trend shows only a short or hand-picked range, note a "Cherry-picked range" issue.
Step 4 — Context: Check captions/language for hype, and whether units and a data source are labeled.
Step 5 — Score: A chart that passes every check (zero baseline, full context, neutral language, labeled units and source) earns 85-100. Subtract for each real issue found above.

After your step-by-step reasoning, output the final answer as a single JSON object inside a \`\`\`json code fence, in exactly this format:
{
  "chartType": "string - type of chart (bar, line, pie, scatter, area, histogram, infographic, etc.)",
  "title": "string - chart title if visible, or brief inferred topic",
  "description": "string - 2-3 sentence description of what the chart shows and the key message",
  "trustScore": 0-100,
  "redFlags": [
    {
      "issue": "string - concise name of the problem",
      "severity": "high|medium|low",
      "explanation": "string - clear explanation of why this is misleading and how it affects interpretation"
    }
  ],
  "positives": ["string - things the chart does well (clear labels, proper scale, good color choice, etc.)"],
  "dataExtracted": [
    {"label": "string - data point label", "value": "string - approximate value with units"}
  ],
  "suggestions": ["string - specific actionable improvement suggestions"],
  "verdict": "string - 2-3 sentence final assessment of the chart's overall honesty and effectiveness"
}`;

const USER_PROMPT = 'Analyze this chart image. Reason step by step through the analysis procedure (axis baseline, pie totals, time window, context, score), then provide the final JSON object inside a ```json code fence as specified in your instructions.';

// ============================================
// State
// ============================================
let state = {
  ollamaConnected: false,
  selectedModel: '',
  imageBase64: '',
  imageMimeType: '',
  isAnalyzing: false,
};

// ============================================
// DOM
// ============================================
const $ = (id) => document.getElementById(id);
let els = {};

// ============================================
// Init
// ============================================
function init() {
  els = {
    statusDot: $('status-dot'),
    statusText: $('status-text'),
    modelSelect: $('model-select'),
    uploadZone: $('upload-zone'),
    uploadContent: $('upload-content'),
    previewContainer: $('preview-container'),
    previewImage: $('preview-image'),
    fileInput: $('file-input'),
    analyzeBtn: $('analyze-btn'),
    clearBtn: $('clear-btn'),
    samplesSection: $('samples-section'),
    loadingSection: $('loading-section'),
    errorSection: $('error-section'),
    errorMessage: $('error-message'),
    retryBtn: $('retry-btn'),
    resultsSection: $('results-section'),
    gaugeFill: $('gauge-fill'),
    gaugeNumber: $('gauge-number'),
    verdictText: $('verdict-text'),
    trustScoreCard: $('trust-score-card'),
    chartTypeBadge: $('chart-type-badge'),
    chartDescription: $('chart-description'),
    positivesList: $('positives-list'),
    redFlagsList: $('red-flags-list'),
    dataTableBody: $('data-table-body'),
    suggestionsList: $('suggestions-list'),
    thinkingToggle: $('thinking-toggle'),
    thinkingContent: $('thinking-content'),
    analyzeAnotherBtn: $('analyze-another-btn'),
  };

  els.modelSelect.addEventListener('change', (e) => { state.selectedModel = e.target.value; });
  els.uploadZone.addEventListener('click', handleUploadClick);
  els.uploadZone.addEventListener('dragover', handleDragOver);
  els.uploadZone.addEventListener('dragleave', handleDragLeave);
  els.uploadZone.addEventListener('drop', handleDrop);
  els.fileInput.addEventListener('change', handleFileSelect);
  els.analyzeBtn.addEventListener('click', handleAnalyze);
  els.clearBtn.addEventListener('click', handleClear);
  els.retryBtn.addEventListener('click', handleAnalyze);
  els.thinkingToggle.addEventListener('click', toggleThinking);
  els.analyzeAnotherBtn.addEventListener('click', handleClear);
  $('theme-toggle').addEventListener('click', cycleTheme);

  document.querySelectorAll('.sample-btn').forEach(btn => {
    btn.addEventListener('click', () => loadSampleChart(btn.dataset.sample));
  });

  initTheme();
  checkOllamaStatus();
}

// ============================================
// Ollama Connection
// ============================================
async function checkOllamaStatus() {
  els.statusDot.className = 'status-dot';
  els.statusText.textContent = 'Checking Ollama...';

  try {
    const resp = await fetch(`${CONFIG.OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) throw new Error('Bad response');
    const data = await resp.json();

    const gemmaModels = (data.models || []).filter(m =>
      m.name.toLowerCase().includes('gemma4') || m.name.toLowerCase().includes('gemma-4')
    );

    if (gemmaModels.length > 0) {
      state.ollamaConnected = true;
      els.statusDot.className = 'status-dot connected';
      els.statusText.textContent = `Connected — ${gemmaModels.length} Gemma 4 model${gemmaModels.length > 1 ? 's' : ''} available`;

      els.modelSelect.innerHTML = '';
      gemmaModels.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name;
        const sizeGB = m.size ? `(${(m.size / 1e9).toFixed(1)}GB)` : '';
        opt.textContent = `${m.name} ${sizeGB}`;
        els.modelSelect.appendChild(opt);
      });
      state.selectedModel = gemmaModels[0].name;
    } else {
      state.ollamaConnected = true;
      els.statusDot.className = 'status-dot disconnected';
      els.statusText.textContent = 'Ollama running but no Gemma 4 models found. Run: ollama pull gemma4:26b';
      els.modelSelect.innerHTML = '<option value="">No gemma4 models</option>';
    }
  } catch (err) {
    state.ollamaConnected = false;
    els.statusDot.className = 'status-dot disconnected';
    els.statusText.textContent = 'Ollama not detected — install from ollama.com then run: ollama serve';
    els.modelSelect.innerHTML = '<option value="">Ollama offline</option>';
  }
}

// ============================================
// Image Upload
// ============================================
function handleUploadClick(e) {
  if (e.target.closest('.preview-actions') || e.target.closest('button')) return;
  if (!els.previewContainer.classList.contains('hidden')) return;
  els.fileInput.click();
}

function handleDragOver(e) {
  e.preventDefault();
  els.uploadZone.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.preventDefault();
  els.uploadZone.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  els.uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) processImageFile(file);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processImageFile(file);
}

async function processImageFile(file) {
  state.imageMimeType = file.type;
  const base64 = await resizeAndEncode(file);
  state.imageBase64 = base64;
  els.previewImage.src = `data:${file.type};base64,${base64}`;
  els.uploadContent.classList.add('hidden');
  els.previewContainer.classList.remove('hidden');
  els.samplesSection.classList.add('hidden');
}

function resizeAndEncode(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > CONFIG.MAX_IMAGE_DIMENSION || height > CONFIG.MAX_IMAGE_DIMENSION) {
          const ratio = Math.min(CONFIG.MAX_IMAGE_DIMENSION / width, CONFIG.MAX_IMAGE_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(file.type || 'image/png', 0.9).split(',')[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ============================================
// Sample Charts
// ============================================
function loadSampleChart(type) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');

  if (type === 'truncated') drawTruncatedChart(ctx, canvas);
  else if (type === 'cherry-picked') drawCherryPickedChart(ctx, canvas);
  else if (type === 'misleading-pie') drawMisleadingPie(ctx, canvas);

  state.imageMimeType = 'image/png';
  const dataUrl = canvas.toDataURL('image/png');
  state.imageBase64 = dataUrl.split(',')[1];
  els.previewImage.src = dataUrl;
  els.uploadContent.classList.add('hidden');
  els.previewContainer.classList.remove('hidden');
  els.samplesSection.classList.add('hidden');
}

function drawTruncatedChart(ctx, c) {
  const w = c.width, h = c.height;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
  ctx.fillText('Company Revenue Growth (Q1-Q4)', w/2, 35);

  const vals = [97,98,100,102], labels = ['Q1','Q2','Q3','Q4'];
  const yMin = 95, yMax = 104, cL = 80, cR = w-40, cT = 60, cB = h-60;
  const cW = cR-cL, cH = cB-cT;

  ctx.fillStyle = '#666'; ctx.font = '12px Arial'; ctx.textAlign = 'right';
  for (let v = yMin; v <= yMax; v++) {
    const y = cB - ((v-yMin)/(yMax-yMin))*cH;
    ctx.fillText(`$${v}M`, cL-10, y+4);
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cL,y); ctx.lineTo(cR,y); ctx.stroke();
  }

  const bW = cW/(vals.length*2), cols = ['#4f46e5','#6366f1','#818cf8','#a5b4fc'];
  vals.forEach((v,i) => {
    const bH = ((v-yMin)/(yMax-yMin))*cH, x = cL+(i*2+0.5)*bW, y = cB-bH;
    ctx.fillStyle = cols[i]; ctx.fillRect(x,y,bW,bH);
    ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
    ctx.fillText(`$${v}M`, x+bW/2, y-8);
    ctx.fillStyle = '#666'; ctx.font = '13px Arial';
    ctx.fillText(labels[i], x+bW/2, cB+25);
  });

  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cL,cT); ctx.lineTo(cL,cB); ctx.lineTo(cR,cB); ctx.stroke();
  ctx.fillStyle = '#16a34a'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
  ctx.fillText('📈 Revenue SURGES from Q1 to Q4!', w/2, h-15);
}

function drawCherryPickedChart(ctx, c) {
  const w = c.width, h = c.height;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
  ctx.fillText('Stock Price Performance', w/2, 35);

  const months = ['Jun','Jul','Aug','Sep','Oct'], vals = [42,48,55,61,67];
  const cL = 70, cR = w-40, cT = 60, cB = h-70, cW = cR-cL, cH = cB-cT;
  const yMin = 35, yMax = 75;

  ctx.fillStyle = '#666'; ctx.font = '11px Arial'; ctx.textAlign = 'right';
  for (let v = yMin; v <= yMax; v += 5) {
    const y = cB-((v-yMin)/(yMax-yMin))*cH;
    ctx.fillText(`$${v}`, cL-10, y+4);
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cL,y); ctx.lineTo(cR,y); ctx.stroke();
  }

  ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 3; ctx.beginPath();
  vals.forEach((v,i) => {
    const x = cL+(i/(vals.length-1))*cW, y = cB-((v-yMin)/(yMax-yMin))*cH;
    i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }); ctx.stroke();

  ctx.fillStyle = 'rgba(22,163,74,0.1)'; ctx.beginPath();
  vals.forEach((v,i) => {
    const x = cL+(i/(vals.length-1))*cW, y = cB-((v-yMin)/(yMax-yMin))*cH;
    i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.lineTo(cR,cB); ctx.lineTo(cL,cB); ctx.closePath(); ctx.fill();

  vals.forEach((v,i) => {
    const x = cL+(i/(vals.length-1))*cW, y = cB-((v-yMin)/(yMax-yMin))*cH;
    ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#666'; ctx.font = '11px Arial'; ctx.textAlign = 'center';
    ctx.fillText(months[i], x, cB+20);
  });

  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cL,cT); ctx.lineTo(cL,cB); ctx.lineTo(cR,cB); ctx.stroke();
  ctx.fillStyle = '#16a34a'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
  ctx.fillText('📈 +59.5% returns in 5 months! Invest now!', w/2, h-15);
  ctx.fillStyle = '#aaa'; ctx.font = '9px Arial';
  ctx.fillText('*Period shown: Jun-Oct 2025', w/2, h-2);
}

function drawMisleadingPie(ctx, c) {
  const w = c.width, h = c.height;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
  ctx.fillText('Market Share Distribution', w/2, 35);

  const slices = [
    {label:'Our Product',value:45,dv:'45%',color:'#4f46e5'},
    {label:'Competitor A',value:25,dv:'25%',color:'#94a3b8'},
    {label:'Competitor B',value:20,dv:'20%',color:'#cbd5e1'},
    {label:'Others',value:18,dv:'18%',color:'#e2e8f0'},
  ];
  const cx = w/2, cy = h/2+10, rx = 140, ry = 100;
  const total = slices.reduce((s,sl) => s+sl.value, 0);

  let sa = -0.5;
  slices.forEach(sl => {
    const sw = (sl.value/total)*Math.PI*2;
    ctx.fillStyle = sl.color; ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.ellipse(cx,cy+20,rx,ry,0,sa,sa+sw); ctx.lineTo(cx,cy+20); ctx.fill();
    sa += sw;
  }); ctx.globalAlpha = 1;

  sa = -0.5;
  slices.forEach(sl => {
    const sw = (sl.value/total)*Math.PI*2;
    let ox = 0, oy = 0;
    if (sl.label === 'Our Product') { const ma = sa+sw/2; ox = Math.cos(ma)*15; oy = Math.sin(ma)*10; }
    ctx.fillStyle = sl.color;
    ctx.beginPath(); ctx.ellipse(cx+ox,cy+oy,rx,ry,0,sa,sa+sw); ctx.lineTo(cx+ox,cy+oy); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    const ma = sa+sw/2, lr = 80;
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
    ctx.fillText(sl.dv, cx+ox+Math.cos(ma)*lr, cy+oy+Math.sin(ma)*(lr*0.7));
    sa += sw;
  });

  slices.forEach((sl,i) => {
    const x = 50+i*140;
    ctx.fillStyle = sl.color; ctx.fillRect(x,h-65,12,12);
    ctx.fillStyle = '#555'; ctx.font = '11px Arial'; ctx.textAlign = 'left';
    ctx.fillText(`${sl.label} (${sl.dv})`, x+18, h-55);
  });
  ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
  ctx.fillText('Our Product clearly dominates the market!', w/2, h-10);
}

// ============================================
// Clear / Reset
// ============================================
function handleClear() {
  state.imageBase64 = '';
  state.imageMimeType = '';
  state.isAnalyzing = false;
  els.previewContainer.classList.add('hidden');
  els.uploadContent.classList.remove('hidden');
  els.loadingSection.classList.add('hidden');
  els.errorSection.classList.add('hidden');
  els.resultsSection.classList.add('hidden');
  els.samplesSection.classList.remove('hidden');
  els.fileInput.value = '';
  document.querySelectorAll('.loading-step').forEach(s => s.classList.remove('active','done'));
  $('step-read').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// Analysis
// ============================================
async function handleAnalyze() {
  if (state.isAnalyzing) return;

  if (!state.ollamaConnected || !state.selectedModel) {
    showError('Ollama is not connected or no Gemma 4 model is available. Run: ollama pull gemma4:26b');
    return;
  }
  if (!state.imageBase64) return;

  state.isAnalyzing = true;
  showLoading();

  try {
    const result = await callOllamaAPI();
    showResults(result);
  } catch (error) {
    showError(error.message);
  } finally {
    state.isAnalyzing = false;
  }
}

function showLoading() {
  els.loadingSection.classList.remove('hidden');
  els.errorSection.classList.add('hidden');
  els.resultsSection.classList.add('hidden');
  els.loadingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const steps = ['step-read','step-analyze','step-detect','step-report'];
  steps.forEach((id,i) => {
    setTimeout(() => {
      if (i > 0) { $(steps[i-1]).classList.remove('active'); $(steps[i-1]).classList.add('done'); }
      $(id).classList.add('active');
    }, i * 2500);
  });
}

function showError(message) {
  els.loadingSection.classList.add('hidden');
  els.errorSection.classList.remove('hidden');
  els.errorMessage.textContent = message || 'Something went wrong. Please try again.';
  els.errorSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ============================================
// Ollama API
// ============================================
async function callOllamaAPI() {
  const url = `${CONFIG.OLLAMA_BASE}/api/chat`;

  const requestBody = {
    model: state.selectedModel,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT, images: [state.imageBase64] }
    ],
    stream: false,
    // NOTE: we intentionally do NOT set format:'json'. Letting Gemma 4 reason in
    // plain text first (then emit JSON in a fenced block) markedly improves
    // detection of subtle issues like truncated axes and bad pie totals.
    options: {
      temperature: 0.3,
      num_predict: 4096,
    }
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    throw new Error('Cannot connect to Ollama. Make sure it\'s running: ollama serve');
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Ollama error (${response.status}): ${errText || 'Unknown error'}`);
  }

  const data = await response.json();
  const rawContent = (data?.message?.content || '').trim();

  // The model reasons in plain text, then emits the answer in a ```json fence.
  // Capture the reasoning (everything before the fence) for the transparency panel,
  // then extract and parse the JSON.
  let jsonStr = rawContent;
  let reasoning = '';
  const fenceMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
    reasoning = rawContent.slice(0, fenceMatch.index).trim();
  } else {
    // Fallback: grab the last {...} block if the model skipped the fence
    const objMatch = rawContent.match(/\{[\s\S]*\}/);
    if (objMatch) {
      jsonStr = objMatch[0];
      reasoning = rawContent.slice(0, objMatch.index).trim();
    }
  }

  let analysis;
  try {
    analysis = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse JSON:', rawContent);
    throw new Error('Gemma 4 returned an unexpected response format. Please try again.');
  }
  analysis._reasoning = reasoning;
  return analysis;
}

// ============================================
// Results Rendering
// ============================================
function showResults(analysis) {
  els.loadingSection.classList.add('hidden');
  els.resultsSection.classList.remove('hidden');
  renderTrustScore(analysis.trustScore, analysis.verdict);
  renderChartInfo(analysis.chartType, analysis.description);
  renderPositives(analysis.positives);
  renderRedFlags(analysis.redFlags);
  renderDataTable(analysis.dataExtracted);
  renderSuggestions(analysis.suggestions);
  renderReasoning(analysis._reasoning);
  setTimeout(() => els.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
}

function renderTrustScore(score, verdict) {
  const n = Math.max(0, Math.min(100, Math.round(score)));
  let cc = 'score-bad';
  if (n >= 80) cc = 'score-great';
  else if (n >= 65) cc = 'score-good';
  else if (n >= 50) cc = 'score-fair';
  else if (n >= 35) cc = 'score-poor';

  els.trustScoreCard.className = `glass-card trust-score-card ${cc}`;
  const circ = 2 * Math.PI * 52;
  const off = circ - (n/100) * circ;
  const col = getComputedStyle(els.trustScoreCard).getPropertyValue('--score-color').trim();
  els.gaugeFill.style.stroke = col;
  setTimeout(() => { els.gaugeFill.style.strokeDashoffset = off; }, 100);
  animateNumber(els.gaugeNumber, 0, n, 1200);
  els.verdictText.textContent = verdict || '';
}

function animateNumber(el, from, to, dur) {
  const start = performance.now();
  (function upd(t) {
    const p = Math.min((t-start)/dur, 1);
    el.textContent = Math.round(from + (to-from) * (1-Math.pow(1-p,3)));
    if (p < 1) requestAnimationFrame(upd);
  })(start);
}

function renderChartInfo(type, desc) {
  els.chartTypeBadge.textContent = type || 'Unknown';
  els.chartDescription.textContent = desc || '';
}

function renderPositives(list) {
  if (!list?.length) {
    els.positivesList.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">No specific positives noted.</p>';
    return;
  }
  els.positivesList.innerHTML = list.map(p =>
    `<div class="positive-item"><span class="positive-icon">✓</span><span>${esc(p)}</span></div>`
  ).join('');
}

function renderRedFlags(flags) {
  if (!flags?.length) {
    els.redFlagsList.innerHTML = '<div class="no-flags">✅ No red flags detected — this chart appears honest!</div>';
    return;
  }
  els.redFlagsList.innerHTML = flags.map(f =>
    `<div class="red-flag-item severity-${f.severity||'medium'}">
      <span class="red-flag-severity">${f.severity||'medium'}</span>
      <div class="red-flag-content"><h4>${esc(f.issue)}</h4><p>${esc(f.explanation)}</p></div>
    </div>`
  ).join('');
}

function renderDataTable(data) {
  if (!data?.length) {
    els.dataTableBody.innerHTML = '<tr><td colspan="2" style="color:var(--text-muted);text-align:center">No data extracted</td></tr>';
    return;
  }
  els.dataTableBody.innerHTML = data.map(d =>
    `<tr><td>${esc(d.label)}</td><td>${esc(String(d.value))}</td></tr>`
  ).join('');
}

function renderSuggestions(list) {
  if (!list?.length) {
    els.suggestionsList.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">No specific suggestions.</p>';
    return;
  }
  els.suggestionsList.innerHTML = list.map(s =>
    `<div class="suggestion-item"><span class="suggestion-icon">💡</span><span>${esc(s)}</span></div>`
  ).join('');
}

function renderReasoning(text) {
  const card = $('thinking-card');
  if (!text) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  els.thinkingContent.textContent = text;
}

function toggleThinking() {
  const c = els.thinkingContent, t = els.thinkingToggle;
  if (c.classList.contains('visible')) {
    c.classList.remove('visible'); t.classList.remove('expanded');
    t.querySelector('span:last-child').textContent = 'Show AI thinking process';
  } else {
    c.classList.add('visible'); t.classList.add('expanded');
    t.querySelector('span:last-child').textContent = 'Hide AI thinking process';
  }
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ============================================
// Theme
// ============================================
const THEMES = ['system', 'light', 'dark'];
const THEME_ICONS = { system: '💻', light: '☀️', dark: '🌙' };

function initTheme() {
  const saved = localStorage.getItem('datadetective_theme') || 'system';
  applyTheme(saved);
}

function cycleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'system';
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  applyTheme(next);
  localStorage.setItem('datadetective_theme', next);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = $('theme-icon');
  if (icon) icon.textContent = THEME_ICONS[theme] || '💻';
  const btn = $('theme-toggle');
  if (btn) btn.title = `Theme: ${theme} (click to change)`;
}

// ============================================
// Start
// ============================================
document.addEventListener('DOMContentLoaded', init);
