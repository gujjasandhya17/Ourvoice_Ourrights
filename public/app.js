// Minimal frontend logic for the demo
const districtSelect = document.getElementById('district');
const detectBtn = document.getElementById('detectBtn');
const refreshBtn = document.getElementById('refreshBtn');
const jobsValue = document.getElementById('jobsValue');
const pdValue = document.getElementById('pdValue');
const wagesValue = document.getElementById('wagesValue');
const jobsChange = document.getElementById('jobsChange');
const explainBtn = document.getElementById('speakBtn');
const explainText = document.getElementById('explainText');
let chart;
let currentLang = 'en';
let availableVoices = [];

function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  availableVoices = window.speechSynthesis.getVoices() || [];
}

if ('speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    loadVoices();
  };
}

// Apply translations from window.I18N
function applyLang(lang) {
  if (!window.I18N) return;
  const dict = window.I18N[lang] || window.I18N['en'];
  document.getElementById('t_title').textContent = dict.title;
  document.getElementById('t_tag').textContent = dict.tag;
  document.getElementById('t_districtLabel').textContent = dict.districtLabel;
  document.getElementById('detectBtn').textContent = dict.detectBtn;
  document.getElementById('refreshBtn').textContent = dict.refreshBtn;
  document.getElementById('t_jobsTitle').textContent = dict.jobsTitle;
  document.getElementById('t_pdTitle').textContent = dict.pdTitle;
  document.getElementById('t_wagesTitle').textContent = dict.wagesTitle;
  document.getElementById('speakBtn').textContent = dict.explainBtn;
  explainText.textContent = dict.explainText;
  const dl = document.getElementById('downloadPdfBtn');
  if (dl && dict.downloadReport) dl.textContent = '⬇️ ' + dict.downloadReport;
  currentLang = lang;
}

document.getElementById('langEn').addEventListener('click', () => applyLang('en'));
document.getElementById('langHi').addEventListener('click', () => applyLang('hi'));

async function loadDistricts() {
  try {
    const res = await fetch('/api/districts?state=Uttar%20Pradesh');
    const data = await res.json();
    // data is expected to be array of {id, district}
    districtSelect.innerHTML = '';
    data.forEach(d => {
      const id = d.id !== undefined ? d.id : d.value || d[0] || d; // fallback
      const name = d.district || d.d || d;
      const opt = document.createElement('option'); opt.value = id; opt.textContent = name; districtSelect.appendChild(opt);
    });
    if (districtSelect.options.length>0) {
      districtSelect.selectedIndex = 0;
      loadDataForSelected();
    }
  } catch (err) { console.error(err); }
}

async function loadDataForSelected() {
  const districtId = districtSelect.value;
  if (!districtId) return;
  try {
    const res = await fetch(`/api/performance/${encodeURIComponent(districtId)}`);
    const json = await res.json();
    const rows = json.rows || [];
    const summary = json.summary || null;
    if (!rows || rows.length===0) {
      jobsValue.textContent = '—'; pdValue.textContent='—'; wagesValue.textContent='—';
      jobsChange.textContent = '';
      renderChart([], []);
      return;
    }
    // Use summary if provided
    if (summary) {
      jobsValue.textContent = new Intl.NumberFormat('en-IN').format(summary.lastJobs || 0);
      pdValue.textContent = new Intl.NumberFormat('en-IN').format(rows[rows.length-1].person_days || 0);
      wagesValue.textContent = '₹ ' + new Intl.NumberFormat('en-IN').format(Math.round(rows[rows.length-1].wages_paid || 0));
      if (summary.changePercent !== null && summary.changePercent !== undefined) {
        const p = summary.changePercent;
        jobsChange.textContent = (p>0? '↑ ' : (p<0? '↓ ' : '')) + Math.abs(p) + '% vs prev';
        jobsChange.style.color = p>0 ? '#2dbe60' : (p<0 ? '#d9534f' : '#666');
      } else {
        jobsChange.textContent = '';
      }
    }

    const labels = rows.map(r => r.month);
    const values = rows.map(r => r.jobs_generated);
    renderChart(labels, values);
    explainText.textContent = `${district}: latest month jobs ${jobsValue.textContent}. Compare with previous months using the chart above.`;
  } catch (err) { console.error(err); }
}

function renderChart(labels, values) {
  const ctx = document.getElementById('trendChart').getContext('2d');
  if (chart) chart.destroy();
  // Draw a line that changes color between points: green for increase, red for decrease, blue default
  const numericValues = values.map(v => (v === null || v === undefined) ? null : Number(v));
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Jobs generated',
        data: numericValues,
        fill: false,
        borderColor: '#1f78d1',
        backgroundColor: 'rgba(31,120,209,0.12)',
        tension: 0.3,
        borderWidth: 3,
        pointRadius: 4,
        // color each segment based on whether next point is higher or lower
        segment: {
          borderColor: ctx => {
            const p0 = ctx.p0 && ctx.p0.parsed && ctx.p0.parsed.y;
            const p1 = ctx.p1 && ctx.p1.parsed && ctx.p1.parsed.y;
            if (p0 == null || p1 == null) return '#1f78d1';
            return p1 > p0 ? '#2dbe60' : (p1 < p0 ? '#d9534f' : '#1f78d1');
          }
        },
        // color points to reflect change vs previous
        pointBackgroundColor: ctx => {
          const i = ctx.dataIndex;
          const cur = numericValues[i];
          const prev = numericValues[i-1];
          if (prev == null || cur == null) return '#1f78d1';
          return cur > prev ? '#2dbe60' : (cur < prev ? '#d9534f' : '#1f78d1');
        }
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { ticks: { autoSkip: true, maxTicksLimit: 10 } },
        y: { beginAtZero: true }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// Geolocation + detect district
detectBtn.addEventListener('click', async () => {
  if (!navigator.geolocation) return alert('Geolocation not supported');
  detectBtn.disabled = true; detectBtn.textContent = 'Detecting...';
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude; const lon = pos.coords.longitude;
    try {
      const res = await fetch(`/api/detect?lat=${lat}&lon=${lon}`);
      const json = await res.json();
      const district = json.district;
      if (district) {
        // Try to find a close match in select options
        let foundIndex = -1;
        for (let i=0;i<districtSelect.options.length;i++){
          const optText = districtSelect.options[i].textContent || districtSelect.options[i].value;
          if (optText.toLowerCase().includes(district.toLowerCase()) || district.toLowerCase().includes(optText.toLowerCase())) { foundIndex = i; break; }
        }
        if (foundIndex >= 0) {
          districtSelect.selectedIndex = foundIndex;
          loadDataForSelected();
        } else {
          alert('Detected district: ' + district + ' — it is not in our list for the selected state.');
        }
      } else {
        alert('Could not determine district from location');
      }
    } catch (err) { console.error(err); alert('Detection failed'); }
    detectBtn.disabled = false; detectBtn.textContent = 'Detect my District';
  }, (err) => { alert('Failed to get location: ' + err.message); detectBtn.disabled=false; detectBtn.textContent='Detect my District'; });
});

refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true; refreshBtn.textContent = 'Refreshing...';
  try {
    await fetch('/api/fetch-now', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ state: 'Uttar Pradesh' }) });
    await loadDataForSelected();
  } catch (err) { console.error(err); alert('Refresh failed'); }
  refreshBtn.disabled = false; refreshBtn.textContent = 'Refresh Data';
});

explainBtn.addEventListener('click', () => {
  const text = explainText.textContent;
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    // prefer a matching voice if available
    const preferLang = currentLang === 'hi' ? 'hi' : 'en';
    u.lang = currentLang === 'hi' ? 'hi-IN' : 'en-IN';
    try {
      if (availableVoices && availableVoices.length > 0) {
        // try to find voice with matching lang or name
        let voice = availableVoices.find(v => (v.lang || '').toLowerCase().startsWith(preferLang));
        if (!voice) {
          voice = availableVoices.find(v => (v.name || '').toLowerCase().includes(preferLang));
        }
        if (voice) {
          u.voice = voice;
        } else if (currentLang === 'hi') {
          // no Hindi voice available — inform user and fall back to default
          // keep u.lang as hi-IN to allow engines that can synthesize Hindi even without explicit voice
          alert('Hindi voice not available on this device/browser. Playing in default voice.');
        }
      }
    } catch (e) {
      console.warn('voice selection failed', e);
    }
    window.speechSynthesis.speak(u);
  } else {
    alert(text);
  }
});

// PDF download
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
downloadPdfBtn.addEventListener('click', async () => {
  const districtOpt = districtSelect.options[districtSelect.selectedIndex];
  if (!districtOpt) return alert('Select a district first');
  const districtName = districtOpt.textContent;
  const districtId = districtOpt.value;
  try {
    const res = await fetch(`/api/performance/${encodeURIComponent(districtId)}`);
    const json = await res.json();
    const rows = json.rows || [];
    const summary = json.summary || {};
    // Generate simple PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${districtName} — MGNREGA report`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Latest month: ${summary.lastMonth || 'N/A'}`, 14, 30);
    doc.text(`Jobs (latest): ${summary.lastJobs || 0}`, 14, 38);
    doc.text(`Change vs prev month: ${summary.changePercent != null ? summary.changePercent + '%' : 'N/A'}`, 14, 46);
    // small table (month, jobs)
    let y = 60;
    doc.text('Month - Jobs', 14, y);
    y += 6;
    rows.slice(-12).reverse().forEach(r => {
      doc.text(`${r.month} - ${r.jobs_generated}`, 14, y);
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    doc.save(`${districtName.replace(/\s+/g,'_')}_mgnrega_report.pdf`);
  } catch (err) { console.error(err); alert('Failed to generate PDF'); }
});

districtSelect.addEventListener('change', loadDataForSelected);

// bootstrap
loadDistricts();
// apply default language when i18n is loaded
if (window.I18N) applyLang('en');
