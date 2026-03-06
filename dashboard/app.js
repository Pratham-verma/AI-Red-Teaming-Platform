/**
 * LUMINA-RED Dashboard - Real-time Adversarial AI Unit Monitor
 * All user content rendered via textContent to prevent XSS
 */

const TITLE_TEXT = 'LUMINA-RED: ADVERSARIAL AI UNIT';
const WS_URL = 'ws://127.0.0.1:8765';
const DEMO_LOG_URL = '../attack_logs.json';

// State
let logs = [];
let fileMode = false;
let ws = null;
let filePollInterval = null;

// DOM refs
const titleEl = document.getElementById('title');
const activityBody = document.getElementById('activityBody');
const heatmap = document.getElementById('heatmap');
const dataSourceToggle = document.getElementById('dataSource');
const connectionStatus = document.getElementById('connectionStatus');
const logCountEl = document.getElementById('logCount');

// --- Typing effect: slow start, fast burst ---
function typeTitle() {
  let i = 0;
  const baseDelay = 120;
  const fastDelay = 35;

  function type() {
    if (i < TITLE_TEXT.length) {
      const char = TITLE_TEXT[i];
      const span = document.createElement('span');
      span.textContent = char;
      titleEl.appendChild(span);
      i++;
      const delay = i < 8 ? baseDelay : (i < 14 ? baseDelay * 0.6 : fastDelay);
      setTimeout(type, delay);
    } else {
      const cursor = document.createElement('span');
      cursor.className = 'cursor';
      cursor.setAttribute('aria-hidden', 'true');
      titleEl.appendChild(cursor);
    }
  }
  type();
}

// --- XSS-safe cell creation ---
function createCell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function createStatusCell(status) {
  const td = document.createElement('td');
  const span = document.createElement('span');
  span.textContent = status;
  span.className = status === 'VULNERABLE' ? 'status-vulnerable' : 'status-blocked';
  td.appendChild(span);
  return td;
}

function addActivityRow(log) {
  const tr = document.createElement('tr');
  tr.appendChild(createCell(log.attack_id || ''));
  tr.appendChild(createCell(log.module || ''));
  tr.appendChild(createStatusCell(log.status || ''));
  activityBody.insertBefore(tr, activityBody.firstChild);
}

// --- Heatmap update ---
function updateHeatmap() {
  const byModule = {};
  logs.forEach((log) => {
    const m = log.module || 'unknown';
    if (!byModule[m]) byModule[m] = { total: 0, vulnerable: 0 };
    byModule[m].total++;
    if (log.status === 'VULNERABLE') byModule[m].vulnerable++;
  });

  heatmap.querySelectorAll('.heatmap-bar').forEach((bar) => {
    const mod = bar.dataset.module;
    const data = byModule[mod] || { total: 0, vulnerable: 0 };
    const pct = data.total ? Math.round((data.vulnerable / data.total) * 100) : 0;
    const fill = bar.querySelector('.heatmap-fill');
    const value = bar.querySelector('.heatmap-value');
    if (fill) fill.style.width = pct + '%';
    if (value) value.textContent = pct + '%';
  });
}

// --- Process new log ---
function processLog(log) {
  if (!log || typeof log !== 'object') return;
  logs.unshift(log);
  addActivityRow(log);
  updateHeatmap();
  logCountEl.textContent = logs.length + ' attacks logged';
}

// --- WebSocket ---
function connectWs() {
  if (fileMode) return;
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    connectionStatus.textContent = 'Live';
    connectionStatus.classList.add('connected');
    connectionStatus.classList.remove('file');
  };
  ws.onmessage = (ev) => {
    try {
      const log = JSON.parse(ev.data);
      processLog(log);
    } catch (_) {}
  };
  ws.onclose = () => {
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.classList.remove('connected');
    setTimeout(connectWs, 3000);
  };
  ws.onerror = () => {};
}

// --- File mode: fetch attack_logs.json ---
async function loadFileLogs() {
  try {
    const res = await fetch(DEMO_LOG_URL);
    const text = await res.text();
    const lines = text.trim().split('\n').filter(Boolean);
    logs = [];
    activityBody.innerHTML = '';
    lines.forEach((line) => {
      try {
        const log = JSON.parse(line);
        processLog(log);
      } catch (_) {}
    });
  } catch (err) {
    connectionStatus.textContent = 'File: not found';
  }
}

function startFilePolling() {
  if (filePollInterval) clearInterval(filePollInterval);
  loadFileLogs();
  filePollInterval = setInterval(loadFileLogs, 2000);
}

function stopFilePolling() {
  if (filePollInterval) {
    clearInterval(filePollInterval);
    filePollInterval = null;
  }
}

// --- Data source toggle ---
dataSourceToggle.addEventListener('change', () => {
  fileMode = dataSourceToggle.checked;
  if (fileMode) {
    if (ws) {
      ws.close();
      ws = null;
    }
    stopFilePolling();
    startFilePolling();
    connectionStatus.textContent = 'File';
    connectionStatus.classList.add('file');
    connectionStatus.classList.remove('connected');
  } else {
    stopFilePolling();
    logs = [];
    activityBody.innerHTML = '';
    updateHeatmap();
    logCountEl.textContent = '0 attacks logged';
    connectWs();
  }
});

// --- Build report data ---
function buildReportData() {
  const byModule = {};
  let vulnerable = 0;
  let blocked = 0;
  logs.forEach((log) => {
    const m = log.module || 'unknown';
    if (!byModule[m]) byModule[m] = { total: 0, vulnerable: 0 };
    byModule[m].total++;
    if (log.status === 'VULNERABLE') {
      byModule[m].vulnerable++;
      vulnerable++;
    } else {
      blocked++;
    }
  });
  const total = logs.length;
  const riskPct = total ? Math.round((vulnerable / total) * 100) : 0;
  return { byModule, vulnerable, blocked, total, riskPct };
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Generate HTML Report ---
document.getElementById('reportHtml').addEventListener('click', () => {
  const { byModule, vulnerable, blocked, total, riskPct } = buildReportData();
  const ts = new Date().toISOString();

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Lumina-Red Security Report</title>`;
  html += `<style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:1rem;color:#1a1a1a;}h1,h2{color:#00a86b;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #e0e0e0;padding:0.5rem;}th{background:#f5f5f5;}.vuln{color:#dc3545;}.blocked{color:#28a745;}</style></head><body>`;
  html += `<h1>Lumina-Red Security Audit Report</h1>`;
  html += `<p><strong>Generated:</strong> ${escapeHtml(ts)}</p>`;
  html += `<h2>Summary</h2><table><tr><th>Metric</th><th>Value</th></tr>`;
  html += `<tr><td>Total Attacks</td><td>${total}</td></tr>`;
  html += `<tr><td>Vulnerable</td><td class="vuln">${vulnerable}</td></tr>`;
  html += `<tr><td>Blocked</td><td class="blocked">${blocked}</td></tr>`;
  html += `<tr><td>Risk Score</td><td>${riskPct}%</td></tr></table>`;
  html += `<h2>Module Breakdown</h2>`;
  Object.entries(byModule).forEach(([mod, data]) => {
    const pct = data.total ? Math.round((data.vulnerable / data.total) * 100) : 0;
    html += `<h3>${escapeHtml(mod)}</h3><ul><li>Total: ${data.total}</li><li>Vulnerable: ${data.vulnerable} (${pct}%)</li></ul>`;
  });
  html += `<h2>Attack Log (Sample)</h2><table><tr><th>Attack ID</th><th>Module</th><th>Status</th></tr>`;
  logs.slice(0, 50).forEach((log) => {
    html += `<tr><td>${escapeHtml(log.attack_id)}</td><td>${escapeHtml(log.module)}</td><td class="${log.status === 'VULNERABLE' ? 'vuln' : 'blocked'}">${escapeHtml(log.status)}</td></tr>`;
  });
  html += `</table></body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lumina-red-report-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
});

// --- Generate DOC Report (Word-compatible HTML) ---
document.getElementById('reportDoc').addEventListener('click', () => {
  const { byModule, vulnerable, blocked, total, riskPct } = buildReportData();
  const ts = new Date().toISOString();

  let html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="UTF-8"><title>Lumina-Red Security Report</title>`;
  html += `<style>body{font-family:Calibri,sans-serif;font-size:11pt;max-width:800px;margin:2rem;color:#000;}h1{font-size:18pt;color:#00a86b;}h2{font-size:14pt;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ccc;padding:6px;}th{background:#f0f0f0;}.vuln{color:#c00;}.blocked{color:#080;}</style></head><body>`;
  html += `<h1>Lumina-Red Security Audit Report</h1>`;
  html += `<p><strong>Generated:</strong> ${escapeHtml(ts)}</p>`;
  html += `<h2>Summary</h2><table><tr><th>Metric</th><th>Value</th></tr>`;
  html += `<tr><td>Total Attacks</td><td>${total}</td></tr>`;
  html += `<tr><td>Vulnerable</td><td class="vuln">${vulnerable}</td></tr>`;
  html += `<tr><td>Blocked</td><td class="blocked">${blocked}</td></tr>`;
  html += `<tr><td>Risk Score</td><td>${riskPct}%</td></tr></table>`;
  html += `<h2>Module Breakdown</h2>`;
  Object.entries(byModule).forEach(([mod, data]) => {
    const pct = data.total ? Math.round((data.vulnerable / data.total) * 100) : 0;
    html += `<h3>${escapeHtml(mod)}</h3><ul><li>Total: ${data.total}</li><li>Vulnerable: ${data.vulnerable} (${pct}%)</li></ul>`;
  });
  html += `<h2>Attack Log (Sample)</h2><table><tr><th>Attack ID</th><th>Module</th><th>Status</th></tr>`;
  logs.slice(0, 50).forEach((log) => {
    html += `<tr><td>${escapeHtml(log.attack_id)}</td><td>${escapeHtml(log.module)}</td><td class="${log.status === 'VULNERABLE' ? 'vuln' : 'blocked'}">${escapeHtml(log.status)}</td></tr>`;
  });
  html += `</table></body></html>`;

  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lumina-red-report-${Date.now()}.doc`;
  a.click();
  URL.revokeObjectURL(url);
});

// --- Init ---
typeTitle();
if (dataSourceToggle.checked) {
  fileMode = true;
  connectionStatus.textContent = 'File';
  connectionStatus.classList.add('file');
  startFilePolling();
} else {
  connectWs();
}
