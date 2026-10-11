/**
 * Smart Streetlight IoT Telemetry Dashboard
 * Integrates with ThingSpeak Channels & Wokwi Simulation
 * Course: 25EE256 - Sensor & Instrumentation
 */

// Global State
const STATE = {
  channelId: localStorage.getItem('thingspeak_channel_id') || 'DEMO_CHANNEL',
  readKey: localStorage.getItem('thingspeak_read_key') || '',
  refreshInterval: parseInt(localStorage.getItem('thingspeak_refresh_interval') || '15', 10),
  isSimMode: false,
  timerSecondsRemaining: 15,
  timerIntervalId: null,
  pollIntervalId: null,
  motionCount: 0,
  lastMotionTimestamp: null,
  activeHoldTimer: 0,
  
  // Current Live Sensor Telemetry
  current: {
    ldrRaw: 780,
    motion: 0,
    pwm: 0,
    powerWatts: 0.0,
    isDark: false,
    timestamp: new Date().toISOString()
  },
  
  // Historical feeds
  feeds: []
};

// Thresholds
const LUX_THRESHOLD = 500; // From Wokwi sketch
const PWM_OFF = 0;
const PWM_DIM = 50;
const PWM_FULL = 255;

// Chart Instances
let lightChart = null;
let pwmChart = null;

// DOM Elements Cache
const elements = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheDOMElements();
  initCharts();
  initEventListeners();
  loadSavedConfig();
  
  // If demo or default, generate initial mock telemetry
  if (STATE.channelId === 'DEMO_CHANNEL' || !STATE.channelId) {
    generateMockFeeds();
  }

  startAutoPolling();
  updateUI(STATE.current);
});

/**
 * Cache all necessary DOM references
 */
function cacheDOMElements() {
  elements.connStatusPill = document.getElementById('connStatusPill');
  elements.connStatusText = document.getElementById('connStatusText');
  elements.refreshTimer = document.getElementById('refreshTimer');
  elements.btnToggleSimMode = document.getElementById('btnToggleSimMode');
  elements.simModeText = document.getElementById('simModeText');
  elements.simControlDrawer = document.getElementById('simControlDrawer');
  
  // Top Banner
  elements.topAmbientState = document.getElementById('topAmbientState');
  elements.topLdrSub = document.getElementById('topLdrSub');
  elements.topMotionState = document.getElementById('topMotionState');
  elements.topMotionSub = document.getElementById('topMotionSub');
  elements.topLampState = document.getElementById('topLampState');
  elements.topPwmSub = document.getElementById('topPwmSub');
  elements.topSavingsPercent = document.getElementById('topSavingsPercent');
  
  // Digital Twin
  elements.skyBackdrop = document.getElementById('skyBackdrop');
  elements.lightCone = document.getElementById('lightCone');
  elements.svgLedBulb = document.getElementById('svgLedBulb');
  elements.pedestrianAvatar = document.getElementById('pedestrianAvatar');
  elements.lampModeBadge = document.getElementById('lampModeBadge');
  elements.hudLdrVal = document.getElementById('hudLdrVal');
  elements.hudPirVal = document.getElementById('hudPirVal');
  elements.hudPwmVal = document.getElementById('hudPwmVal');
  elements.hudLumens = document.getElementById('hudLumens');

  // Gauge & Radar
  elements.ldrProgress = document.getElementById('ldrProgress');
  elements.ldrProgressVal = document.getElementById('ldrProgressVal');
  elements.ldrRawText = document.getElementById('ldrRawText');
  elements.ldrLuxText = document.getElementById('ldrLuxText');
  elements.ldrConditionChip = document.getElementById('ldrConditionChip');
  elements.ldrAssessmentText = document.getElementById('ldrAssessmentText');
  
  elements.pirStatusChip = document.getElementById('pirStatusChip');
  elements.radarBlip = document.getElementById('radarBlip');
  elements.motionTriggerCount = document.getElementById('motionTriggerCount');
  elements.lastMotionTime = document.getElementById('lastMotionTime');
  elements.activeHoldTime = document.getElementById('activeHoldTime');
  
  // Power Analytics
  elements.currentPowerWatts = document.getElementById('currentPowerWatts');
  elements.powerBarFill = document.getElementById('powerBarFill');
  elements.kpiKwhSaved = document.getElementById('kpiKwhSaved');
  elements.kpiCo2Saved = document.getElementById('kpiCo2Saved');

  // Table
  elements.feedsTableBody = document.getElementById('feedsTableBody');
  elements.feedCountBadge = document.getElementById('feedCountBadge');

  // Modal
  elements.configModal = document.getElementById('configModal');
  elements.btnOpenConfig = document.getElementById('btnOpenConfig');
  elements.btnCloseConfig = document.getElementById('btnCloseConfig');
  elements.btnSaveConfig = document.getElementById('btnSaveConfig');
  elements.btnUseDemoData = document.getElementById('btnUseDemoData');
  elements.inputChannelId = document.getElementById('inputChannelId');
  elements.inputReadKey = document.getElementById('inputReadKey');
  elements.selectInterval = document.getElementById('selectInterval');
  
  // Controls
  elements.sliderLdr = document.getElementById('sliderLdr');
  elements.sliderLdrVal = document.getElementById('sliderLdrVal');
  elements.btnPirOff = document.getElementById('btnPirOff');
  elements.btnPirOn = document.getElementById('btnPirOn');
  elements.btnRefreshFeeds = document.getElementById('btnRefreshFeeds');
  elements.btnExportCsv = document.getElementById('btnExportCsv');
  elements.toastContainer = document.getElementById('toastContainer');
}

/**
 * Initialize Chart.js Graphs
 */
function initCharts() {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    plugins: {
      legend: {
        labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } }
      },
      tooltip: {
        backgroundColor: '#111827',
        titleColor: '#f8fafc',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 8 }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
      }
    }
  };

  // 1. Light Chart
  const ctxLight = document.getElementById('lightChart').getContext('2d');
  lightChart = new Chart(ctxLight, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'LDR Raw ADC',
          data: [],
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6
        },
        {
          label: 'Dark Threshold (500)',
          data: [],
          borderColor: 'rgba(239, 68, 68, 0.6)',
          borderDash: [5, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      ...chartOptions,
      scales: {
        ...chartOptions.scales,
        y: { ...chartOptions.scales.y, min: 0, max: 1024, title: { display: true, text: 'ADC (0-1023)', color: '#64748b' } }
      }
    }
  });

  // 2. PWM & Motion Chart
  const ctxPwm = document.getElementById('pwmChart').getContext('2d');
  pwmChart = new Chart(ctxPwm, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Streetlight PWM Brightness',
          data: [],
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          fill: true,
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 3,
          yAxisID: 'y'
        },
        {
          label: 'Motion Detected (0/1)',
          data: [],
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.3)',
          borderWidth: 1.5,
          stepped: true,
          pointRadius: 2,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      ...chartOptions,
      scales: {
        ...chartOptions.scales,
        y: {
          ...chartOptions.scales.y,
          min: 0,
          max: 260,
          position: 'left',
          title: { display: true, text: 'PWM Output (0-255)', color: '#8b5cf6' }
        },
        y1: {
          min: 0,
          max: 1.2,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { stepSize: 1, color: '#06b6d4' },
          title: { display: true, text: 'Motion', color: '#06b6d4' }
        }
      }
    }
  });
}

/**
 * Event Listeners Registration
 */
function initEventListeners() {
  // Modal toggles
  elements.btnOpenConfig.addEventListener('click', () => {
    elements.inputChannelId.value = STATE.channelId === 'DEMO_CHANNEL' ? '' : STATE.channelId;
    elements.inputReadKey.value = STATE.readKey;
    elements.selectInterval.value = STATE.refreshInterval;
    elements.configModal.classList.add('open');
  });

  elements.btnCloseConfig.addEventListener('click', () => {
    elements.configModal.classList.remove('open');
  });

  elements.configModal.addEventListener('click', (e) => {
    if (e.target === elements.configModal) elements.configModal.classList.remove('open');
  });

  elements.btnSaveConfig.addEventListener('click', saveConfig);
  elements.btnUseDemoData.addEventListener('click', () => {
    elements.inputChannelId.value = 'DEMO_CHANNEL';
    elements.inputReadKey.value = '';
    saveConfig();
  });

  // Simulation mode toggle
  elements.btnToggleSimMode.addEventListener('click', toggleSimMode);

  // Manual interactive sliders
  elements.sliderLdr.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    const desc = val < LUX_THRESHOLD ? 'Night / Dark' : 'Day / Bright';
    elements.sliderLdrVal.textContent = `${val} (${desc})`;
    if (STATE.isSimMode) {
      triggerSimulationUpdate(val, STATE.current.motion);
    }
  });

  elements.btnPirOff.addEventListener('click', () => {
    elements.btnPirOff.classList.add('active');
    elements.btnPirOn.classList.remove('active');
    if (STATE.isSimMode) {
      triggerSimulationUpdate(STATE.current.ldrRaw, 0);
    }
  });

  elements.btnPirOn.addEventListener('click', () => {
    elements.btnPirOn.classList.add('active');
    elements.btnPirOff.classList.remove('active');
    if (STATE.isSimMode) {
      triggerSimulationUpdate(STATE.current.ldrRaw, 1);
    }
  });

  // Action buttons
  elements.btnRefreshFeeds.addEventListener('click', () => {
    showToast('Refreshing ThingSpeak feeds...', 'info');
    fetchThingSpeakData();
  });

  elements.btnExportCsv.addEventListener('click', exportFeedsCsv);
}

/**
 * Load saved configuration from localStorage
 */
function loadSavedConfig() {
  if (STATE.channelId && STATE.channelId !== 'DEMO_CHANNEL') {
    elements.connStatusText.textContent = `ThingSpeak Channel #${STATE.channelId}`;
  } else {
    elements.connStatusText.textContent = `Demo Simulation Feed`;
  }
}

/**
 * Save user ThingSpeak credentials
 */
function saveConfig() {
  const newChannelId = elements.inputChannelId.value.trim() || 'DEMO_CHANNEL';
  const newReadKey = elements.inputReadKey.value.trim();
  const newInterval = parseInt(elements.selectInterval.value, 10);

  STATE.channelId = newChannelId;
  STATE.readKey = newReadKey;
  STATE.refreshInterval = newInterval;

  localStorage.setItem('thingspeak_channel_id', newChannelId);
  localStorage.setItem('thingspeak_read_key', newReadKey);
  localStorage.setItem('thingspeak_refresh_interval', newInterval.toString());

  elements.configModal.classList.remove('open');
  showToast(`Settings Saved: Connecting to Channel ${newChannelId}`, 'success');

  if (newChannelId === 'DEMO_CHANNEL') {
    elements.connStatusText.textContent = 'Demo Simulation Feed';
    generateMockFeeds();
  } else {
    elements.connStatusText.textContent = `ThingSpeak Channel #${newChannelId}`;
    fetchThingSpeakData();
  }

  restartPollingTimer();
}

/**
 * Toggle Simulation Mode
 */
function toggleSimMode() {
  STATE.isSimMode = !STATE.isSimMode;
  if (STATE.isSimMode) {
    elements.btnToggleSimMode.classList.add('active');
    elements.simModeText.textContent = 'Simulation: ON';
    elements.connStatusPill.querySelector('.status-dot').className = 'status-dot sim-active';
    elements.connStatusText.textContent = 'Interactive Simulator Mode Active';
    showToast('Interactive Simulator Mode Enabled! Move sliders to test.', 'info');
  } else {
    elements.btnToggleSimMode.classList.remove('active');
    elements.simModeText.textContent = 'Simulation: OFF';
    elements.connStatusPill.querySelector('.status-dot').className = 'status-dot pulsing';
    loadSavedConfig();
    showToast('Resumed Live ThingSpeak Channel Polling', 'info');
  }
}

/**
 * Start Auto Polling Timer
 */
function startAutoPolling() {
  STATE.timerSecondsRemaining = STATE.refreshInterval;
  
  if (STATE.timerIntervalId) clearInterval(STATE.timerIntervalId);
  if (STATE.pollIntervalId) clearInterval(STATE.pollIntervalId);

  // Countdown timer in UI
  STATE.timerIntervalId = setInterval(() => {
    if (!STATE.isSimMode) {
      STATE.timerSecondsRemaining--;
      if (STATE.timerSecondsRemaining < 0) {
        STATE.timerSecondsRemaining = STATE.refreshInterval;
        fetchThingSpeakData();
      }
      elements.refreshTimer.textContent = `${STATE.timerSecondsRemaining}s`;
    }
  }, 1000);

  // Initial fetch
  fetchThingSpeakData();
}

function restartPollingTimer() {
  STATE.timerSecondsRemaining = STATE.refreshInterval;
  elements.refreshTimer.textContent = `${STATE.timerSecondsRemaining}s`;
}

/**
 * Fetch Live Feeds from ThingSpeak REST API
 */
async function fetchThingSpeakData() {
  if (STATE.isSimMode) return;

  if (STATE.channelId === 'DEMO_CHANNEL' || !STATE.channelId) {
    simulateThingSpeakTick();
    return;
  }

  const url = `https://api.thingspeak.com/channels/${STATE.channelId}/feeds.json?results=25${STATE.readKey ? `&api_key=${STATE.readKey}` : ''}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} (${response.statusText})`);
    }

    const data = await response.json();
    if (data.feeds && data.feeds.length > 0) {
      processThingSpeakFeeds(data.feeds);
      showToast('Fetched latest telemetry from ThingSpeak', 'success');
    } else {
      showToast('Connected to Channel, but no feed records found yet.', 'warning');
    }
  } catch (err) {
    console.warn('ThingSpeak API Fetch Error, falling back to simulated live stream:', err);
    showToast(`ThingSpeak Error: ${err.message}. Showing simulation stream.`, 'warning');
    simulateThingSpeakTick();
  }
}

/**
 * Process Raw Feeds from ThingSpeak API
 */
function processThingSpeakFeeds(rawFeeds) {
  STATE.feeds = rawFeeds.map(f => {
    const ldrRaw = parseFloat(f.field1) || 0;
    const motion = parseInt(f.field2, 10) || 0;
    const pwm = parseFloat(f.field3) || calculatePWM(ldrRaw, motion);
    const power = parseFloat(f.field4) || calculatePower(pwm);

    return {
      entry_id: f.entry_id,
      created_at: f.created_at,
      ldrRaw,
      motion,
      pwm,
      power,
      isDark: ldrRaw < LUX_THRESHOLD
    };
  });

  const latest = STATE.feeds[STATE.feeds.length - 1];
  STATE.current = latest;
  updateUI(latest);
  updateChartsWithFeeds(STATE.feeds);
  updateTable(STATE.feeds);
}

/**
 * Calculate PWM and Power based on logic in sketch.ino
 */
function calculatePWM(ldrRaw, motion) {
  const isDark = (ldrRaw < LUX_THRESHOLD);
  if (!isDark) return PWM_OFF; // Daytime
  if (motion === 1) return PWM_FULL; // Motion active
  return PWM_DIM; // Night Standby
}

function calculatePower(pwm) {
  // Assuming 100W Max Streetlight LED Luminaire
  if (pwm === 0) return 0.0;
  if (pwm <= 50) return 20.0;
  return 100.0;
}

/**
 * Triggered from Manual Simulator Sliders
 */
function triggerSimulationUpdate(ldrVal, motionVal) {
  const pwmVal = calculatePWM(ldrVal, motionVal);
  const powerVal = calculatePower(pwmVal);
  const isDark = ldrVal < LUX_THRESHOLD;

  const simEntry = {
    entry_id: (STATE.feeds.length + 1),
    created_at: new Date().toISOString(),
    ldrRaw: ldrVal,
    motion: motionVal,
    pwm: pwmVal,
    power: powerVal,
    isDark
  };

  STATE.current = simEntry;
  STATE.feeds.push(simEntry);
  if (STATE.feeds.length > 25) STATE.feeds.shift();

  updateUI(simEntry);
  updateChartsWithFeeds(STATE.feeds);
  updateTable(STATE.feeds);
}

/**
 * Simulate periodic variations for Demo Mode
 */
function simulateThingSpeakTick() {
  const time = Date.now() / 10000;
  // Sine wave ambient day/night cycle simulation
  const ldrBase = 500 + Math.sin(time) * 450;
  const ldrRaw = Math.max(50, Math.min(1000, Math.round(ldrBase + (Math.random() * 60 - 30))));
  
  // Random motion detection when dark
  const isDark = ldrRaw < LUX_THRESHOLD;
  const motion = (isDark && Math.random() > 0.6) ? 1 : 0;
  const pwm = calculatePWM(ldrRaw, motion);
  const power = calculatePower(pwm);

  const newFeed = {
    entry_id: (STATE.feeds.length + 1),
    created_at: new Date().toISOString(),
    ldrRaw,
    motion,
    pwm,
    power,
    isDark
  };

  STATE.current = newFeed;
  STATE.feeds.push(newFeed);
  if (STATE.feeds.length > 25) STATE.feeds.shift();

  updateUI(newFeed);
  updateChartsWithFeeds(STATE.feeds);
  updateTable(STATE.feeds);
}

/**
 * Generate initial mock feeds for immediate visual delight
 */
function generateMockFeeds() {
  STATE.feeds = [];
  const now = Date.now();
  for (let i = 20; i >= 0; i--) {
    const timestamp = new Date(now - i * 15000).toISOString();
    const ldrRaw = Math.round(750 - i * 20 + Math.sin(i) * 50);
    const isDark = ldrRaw < LUX_THRESHOLD;
    const motion = (isDark && (i % 4 === 0)) ? 1 : 0;
    const pwm = calculatePWM(ldrRaw, motion);
    const power = calculatePower(pwm);

    STATE.feeds.push({
      entry_id: 100 - i,
      created_at: timestamp,
      ldrRaw,
      motion,
      pwm,
      power,
      isDark
    });
  }
}

/**
 * Master UI update dispatcher
 */
function updateUI(data) {
  const { ldrRaw, motion, pwm, power, isDark } = data;

  // 1. Ambient Light UI
  const ldrPct = Math.round((ldrRaw / 1023) * 100);
  const luxEst = Math.round((ldrRaw / 1023) * 1000);

  elements.ldrProgressVal.textContent = `${ldrPct}%`;
  elements.ldrProgress.style.background = `conic-gradient(var(--accent-amber) ${ldrPct * 3.6}deg, #1e293b 0deg)`;
  elements.ldrRawText.textContent = `${ldrRaw} / 1023`;
  elements.ldrLuxText.textContent = `~${luxEst} Lux`;

  if (!isDark) {
    elements.topAmbientState.textContent = 'Daytime (Bright)';
    elements.ldrConditionChip.textContent = 'Bright (Day)';
    elements.ldrConditionChip.style.borderColor = 'var(--accent-amber)';
    elements.ldrConditionChip.style.color = 'var(--accent-amber)';
    elements.ldrAssessmentText.textContent = 'Sunlight Active (Light OFF)';
    elements.ldrAssessmentText.className = 'text-amber';
  } else {
    elements.topAmbientState.textContent = 'Nighttime (Dark)';
    elements.ldrConditionChip.textContent = 'Night (Dark)';
    elements.ldrConditionChip.style.borderColor = 'var(--accent-cyan)';
    elements.ldrConditionChip.style.color = 'var(--accent-cyan)';
    elements.ldrAssessmentText.textContent = 'Illumination Required';
    elements.ldrAssessmentText.className = 'text-cyan';
  }
  elements.topLdrSub.textContent = `Raw ADC: ${ldrRaw} • Lux: ${ldrPct}%`;

  // 2. Motion PIR UI
  if (motion === 1) {
    elements.topMotionState.textContent = 'Motion Detected!';
    elements.topMotionState.style.color = 'var(--accent-rose)';
    elements.topMotionSub.textContent = 'Pedestrian / Vehicle Active';
    elements.pirStatusChip.textContent = 'DETECTED';
    elements.pirStatusChip.style.background = 'rgba(244, 63, 94, 0.2)';
    elements.pirStatusChip.style.color = 'var(--accent-rose)';
    elements.radarBlip.classList.add('active');
    elements.pedestrianAvatar.classList.add('visible');

    STATE.motionCount++;
    elements.motionTriggerCount.textContent = STATE.motionCount;
    elements.lastMotionTime.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } else {
    elements.topMotionState.textContent = 'Idle / Clear';
    elements.topMotionState.style.color = 'var(--text-primary)';
    elements.topMotionSub.textContent = 'PIR: Digital LOW';
    elements.pirStatusChip.textContent = 'Clear';
    elements.pirStatusChip.style.background = 'rgba(6, 182, 212, 0.15)';
    elements.pirStatusChip.style.color = 'var(--accent-cyan)';
    elements.radarBlip.classList.remove('active');
    elements.pedestrianAvatar.classList.remove('visible');
  }

  // 3. Operating State & Digital Twin Visualizer
  elements.hudLdrVal.textContent = ldrRaw;
  elements.hudPirVal.textContent = motion ? 'HIGH (1)' : 'LOW (0)';
  elements.hudPwmVal.textContent = pwm;

  if (pwm === PWM_OFF) {
    elements.topLampState.textContent = 'OFF (0% PWM)';
    elements.topPwmSub.textContent = `PWM: 0/255 • 0.0W`;
    elements.lampModeBadge.textContent = 'DAY MODE: OFF';
    elements.lampModeBadge.style.color = '#94a3b8';
    elements.lightCone.className = 'light-cone';
    elements.svgLedBulb.setAttribute('fill', '#64748b');
    elements.hudLumens.textContent = '0 lm';
    elements.skyBackdrop.className = 'sky-backdrop'; // Bright blue sky
  } else if (pwm === PWM_DIM) {
    elements.topLampState.textContent = 'STANDBY (20% Dim)';
    elements.topPwmSub.textContent = `PWM: 50/255 • ~20.0W`;
    elements.lampModeBadge.textContent = 'NIGHT STANDBY (20%)';
    elements.lampModeBadge.style.color = 'var(--accent-amber)';
    elements.lightCone.className = 'light-cone dim';
    elements.svgLedBulb.setAttribute('fill', '#fbbf24');
    elements.hudLumens.textContent = '1,200 lm (Dim)';
    elements.skyBackdrop.className = 'sky-backdrop night'; // Night star sky
  } else {
    elements.topLampState.textContent = 'ACTIVE (100% Full)';
    elements.topPwmSub.textContent = `PWM: 255/255 • 100.0W`;
    elements.lampModeBadge.textContent = 'MOTION ACTIVE (100%)';
    elements.lampModeBadge.style.color = 'var(--accent-cyan)';
    elements.lightCone.className = 'light-cone full';
    elements.svgLedBulb.setAttribute('fill', '#ffffff');
    elements.hudLumens.textContent = '6,000 lm (Max)';
    elements.skyBackdrop.className = 'sky-backdrop night';
  }

  // 4. Power & Energy Savings KPI
  elements.currentPowerWatts.textContent = `${power.toFixed(1)} W`;
  elements.powerBarFill.style.width = `${power}%`;

  // Theoretical Savings vs Conventional Always-ON (100W for 12h night)
  const savingsPct = (100 - power).toFixed(1);
  elements.topSavingsPercent.textContent = `${savingsPct}% Saved`;
}

/**
 * Update Chart.js Series
 */
function updateChartsWithFeeds(feeds) {
  if (!lightChart || !pwmChart || feeds.length === 0) return;

  const labels = feeds.map(f => {
    const d = new Date(f.created_at);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  // Light Chart
  lightChart.data.labels = labels;
  lightChart.data.datasets[0].data = feeds.map(f => f.ldrRaw);
  lightChart.data.datasets[1].data = feeds.map(() => LUX_THRESHOLD);
  lightChart.update('none');

  // PWM & Motion Chart
  pwmChart.data.labels = labels;
  pwmChart.data.datasets[0].data = feeds.map(f => f.pwm);
  pwmChart.data.datasets[1].data = feeds.map(f => f.motion);
  pwmChart.update('none');
}

/**
 * Update Feeds Table
 */
function updateTable(feeds) {
  elements.feedCountBadge.textContent = `${feeds.length} Entries`;
  
  if (feeds.length === 0) {
    elements.feedsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4">No feeds recorded.</td></tr>`;
    return;
  }

  const reversed = [...feeds].reverse();
  elements.feedsTableBody.innerHTML = reversed.map(f => {
    let modeTag = '';
    if (f.pwm === PWM_OFF) modeTag = '<span class="status-tag tag-off">Daytime OFF</span>';
    else if (f.pwm === PWM_DIM) modeTag = '<span class="status-tag tag-dim">Standby 20%</span>';
    else modeTag = '<span class="status-tag tag-active">Active 100%</span>';

    const dateStr = new Date(f.created_at).toLocaleTimeString();

    return `
      <tr>
        <td>#${f.entry_id}</td>
        <td>${dateStr}</td>
        <td><strong>${f.ldrRaw}</strong> ADC</td>
        <td>${f.motion ? '<span class="text-rose font-bold">DETECTED (1)</span>' : 'None (0)'}</td>
        <td>${f.pwm} / 255</td>
        <td>${f.power.toFixed(1)} W</td>
        <td>${modeTag}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Export Feeds to CSV File
 */
function exportFeedsCsv() {
  if (STATE.feeds.length === 0) {
    showToast('No feeds to export!', 'warning');
    return;
  }

  let csvContent = 'data:text/csv;charset=utf-8,';
  csvContent += 'Entry ID,Timestamp,LDR Raw,PIR Motion,PWM Output,Power Watts,Dark Mode\n';

  STATE.feeds.forEach(f => {
    csvContent += `${f.entry_id},${f.created_at},${f.ldrRaw},${f.motion},${f.pwm},${f.power},${f.isDark ? '1' : '0'}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `thingspeak_streetlight_data_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Exported CSV dataset successfully!', 'success');
}

/**
 * Toast Notification Helper
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'warning') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;

  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
