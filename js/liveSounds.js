(() => {
    'use strict';

    const STORAGE_KEY = 'sail.liveSounds.v1';
    const BANDS = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
    const COLORS = ['#8b5cf6', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444'];
    const MAX_READINGS = 3600;
    const $ = id => document.getElementById(id);
    const ui = Object.fromEntries(['connection', 'participant', 'sound-note', 'connect', 'baseline', 'sound', 'stop', 'export', 'export-summary', 'new-session', 'message', 'current', 'quality', 'quality-placeholder', 'electrode-quality', 'chart', 'segments'].map(id => [id, $(id)]));
    const freshSession = () => ({ version: 1, id: crypto.randomUUID(), createdAt: new Date().toISOString(), label: '', segments: [] });
    let session;
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        session = saved && saved.version === 1 && Array.isArray(saved.segments) ? saved : freshSession();
    } catch (_) { session = freshSession(); }
    let ws = null;
    let connected = false;
    let ready = false;
    let ownsStream = false;
    let pendingKind = null;
    let active = null;
    let lastTimestamp = null;
    let recent = [];
    let elapsedTimer = null;
    const electrodeQuality = new SignalQualityVisualizer({
        containerId: 'liveElectrodeQuality',
        updateInterval: 1000,
        useMockData: false,
        liveDataTimeoutMs: 3000
    });
    electrodeQuality.mountTo(ui['electrode-quality']);
    electrodeQuality.setEmbeddedMode(true);

    const message = value => { ui.message.textContent = value; };
    const send = command => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ command })); };
    function persist() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); return true; }
        catch (_) { message('Browser storage is full or unavailable. Export this session now.'); return false; }
    }
    function refreshControls() {
        ui.connect.textContent = connected ? 'Disconnect EEG' : 'Connect EEG';
        ui.baseline.disabled = !ready || Boolean(active) || session.segments.some(s => s.kind === 'baseline');
        ui.sound.disabled = !ready || Boolean(active) || !session.segments.some(s => s.kind === 'baseline' && s.readings.length);
        ui.sound.textContent = `Start sound ${session.segments.filter(s => s.kind === 'sound').length + 1}`;
        ui.stop.disabled = !active;
        ui.export.disabled = !session.segments.length;
        ui['export-summary'].disabled = !session.segments.length;
        ui['new-session'].disabled = Boolean(active) || Boolean(pendingKind);
    }
    const bandMean = (segment, band) => {
        const values = segment.readings.map(r => Number(r[`${band}_rel`])).filter(Number.isFinite);
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };
    const meanField = (segment, field) => {
        const values = segment.readings.map(r => Number(r[field])).filter(Number.isFinite);
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };
    const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    function download(text, type, filename) {
        const blob = new Blob([text], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function summaryCsv() {
        const header = ['session_id', 'session_label', 'session_created_at', 'segment_kind', 'sound_number', 'started_at', 'ended_at', 'duration_seconds', 'reading_count', 'source', 'sound_note', 'mean_signal_quality'];
        BANDS.forEach(band => header.push(`mean_${band}_relative`, `${band}_vs_baseline_pp`));
        const baseline = session.segments.find(segment => segment.kind === 'baseline');
        const rows = [header];
        session.segments.forEach(segment => {
            const row = [session.id, session.label, session.createdAt, segment.kind, segment.soundNumber ?? '', segment.startedAt, segment.endedAt, Math.max(0, (Date.parse(segment.endedAt) - Date.parse(segment.startedAt)) / 1000), segment.readings.length, segment.readings[0]?.source || '', segment.note || '', meanField(segment, 'signal_quality')];
            BANDS.forEach(band => {
                const current = bandMean(segment, band);
                const reference = baseline && bandMean(baseline, band);
                row.push(current, segment.kind === 'sound' && current !== null && reference !== null ? (current - reference) * 100 : '');
            });
            rows.push(row);
        });
        return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
    }
    function renderSegments() {
        ui.segments.replaceChildren();
        if (!session.segments.length) {
            const row = ui.segments.insertRow();
            const cell = row.insertCell(); cell.colSpan = 7; cell.textContent = 'No segments yet';
            return;
        }
        const baseline = session.segments.find(s => s.kind === 'baseline');
        session.segments.forEach(segment => {
            const alpha = bandMean(segment, 'alpha');
            const duration = Math.round((Date.parse(segment.endedAt) - Date.parse(segment.startedAt)) / 1000);
            const change = segment.kind === 'baseline' ? '—' : BANDS.map(band => {
                const current = bandMean(segment, band), reference = baseline && bandMean(baseline, band);
                return current === null || reference === null ? `${band}: —` : `${band}: ${((current - reference) * 100).toFixed(1)} pp`;
            }).join('\n');
            const label = segment.kind === 'sound' ? `Sound ${segment.soundNumber || session.segments.filter(s => s.kind === 'sound' && Date.parse(s.startedAt) <= Date.parse(segment.startedAt)).length}` : 'Baseline';
            const values = [label, new Date(segment.startedAt).toLocaleString(), `${duration}s`, String(segment.readings.length), alpha === null ? '—' : `${(alpha * 100).toFixed(1)}%`, change, segment.note || '—'];
            const row = ui.segments.insertRow();
            values.forEach(value => { const cell = row.insertCell(); cell.textContent = value; });
        });
    }
    function drawChart() {
        const canvas = ui.chart, ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height, pad = 36;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--color-bg') || '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#9ca3af66'; ctx.lineWidth = 1;
        ctx.font = '13px sans-serif'; ctx.fillStyle = '#777';
        [0, .25, .5, .75, 1].forEach(value => {
            const y = h - pad - value * (h - 2 * pad);
            ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - 10, y); ctx.stroke();
            ctx.fillText(`${Math.round(value * 100)}%`, 2, y + 4);
        });
        if (recent.length < 2) return;
        BANDS.forEach((band, index) => {
            ctx.beginPath(); ctx.strokeStyle = COLORS[index]; ctx.lineWidth = 2;
            recent.forEach((reading, i) => {
                const x = pad + i * (w - pad - 10) / Math.max(1, recent.length - 1);
                const value = Math.max(0, Math.min(1, Number(reading[`${band}_rel`]) || 0));
                const y = h - pad - value * (h - 2 * pad);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });
    }
    function finishSegment() {
        if (!active) return;
        active.endedAt = new Date().toISOString();
        const count = active.readings.length;
        const wasSound = active.kind === 'sound';
        if (count) session.segments.push(active);
        active = null;
        clearInterval(elapsedTimer);
        ui.current.textContent = 'No segment recording';
        persist(); renderSegments(); refreshControls();
        if (wasSound && count) ui['sound-note'].value = '';
        message(count ? `Saved ${wasSound ? 'sound' : 'baseline'} segment with ${count} readings. ${wasSound ? 'Describe the next sound and start it when ready.' : 'Describe sound 1 when ready.'}` : 'No EEG readings arrived, so the segment was discarded. Check the connection and try again.');
    }
    function beginSegment(kind) {
        if (!ready || active || pendingKind) return;
        const note = ui['sound-note'].value.trim();
        if (kind === 'sound' && !note) { message('Describe the sound before starting its recording.'); ui['sound-note'].focus(); return; }
        if (kind === 'baseline' && session.segments.some(s => s.kind === 'baseline')) { message('This session already has a baseline. Start a new session for a new baseline.'); return; }
        session.label = ui.participant.value.trim();
        pendingKind = kind;
        if (ownsStream) startPending(); else send('start');
    }
    function startPending() {
        if (!pendingKind) return;
        active = { kind: pendingKind, soundNumber: pendingKind === 'sound' ? session.segments.filter(s => s.kind === 'sound').length + 1 : null, startedAt: new Date().toISOString(), note: pendingKind === 'sound' ? ui['sound-note'].value.trim() : '', readings: [] };
        pendingKind = null;
        lastTimestamp = null;
        ui.current.textContent = `Recording ${active.kind === 'sound' ? `sound ${active.soundNumber}` : 'baseline'}: 0s, 0 readings`;
        elapsedTimer = setInterval(() => {
            if (active) ui.current.textContent = `Recording ${active.kind === 'sound' ? `sound ${active.soundNumber}` : 'baseline'}: ${Math.floor((Date.now() - Date.parse(active.startedAt)) / 1000)}s, ${active.readings.length} readings`;
        }, 500);
        message(`Recording ${active.kind}. Start or play the external sound at the same moment you press Start sound.`);
        refreshControls();
    }
    function disconnect() {
        finishSegment();
        if (ownsStream) send('stop');
        electrodeQuality.stop(); ui['quality-placeholder'].hidden = false;
        ownsStream = false; ready = false; connected = false; pendingKind = null;
        if (ws) { ws.close(); ws = null; }
        recent = []; drawChart(); ui.quality.textContent = 'Waiting for readings';
        ui.connection.textContent = 'Disconnected';
        refreshControls();
    }
    function connect() {
        if (connected) { disconnect(); message('EEG disconnected.'); return; }
        ui.connection.textContent = 'Connecting…';
        const socket = new WebSocket('ws://localhost:8765');
        ws = socket;
        socket.onopen = () => { connected = true; send('status'); refreshControls(); };
        socket.onmessage = event => {
            let packet;
            try { packet = JSON.parse(event.data); } catch (_) { return; }
            if (packet.type === 'connected') {
                ui.connection.textContent = packet.mock_mode ? 'Connected · mock EEG' : 'Connected · real EEG';
            } else if (packet.type === 'response' && packet.command === 'status') {
                // The EEG service has a global stream. Do not join or interrupt another workflow.
                if (!packet.is_streaming && packet.connected_clients === 1) {
                    message('Starting EEG to check electrode quality…');
                    send('start');
                } else {
                    ready = false;
                    message('EEG stream is in use by another page. Close Test or other EEG clients, then reconnect.');
                }
                refreshControls();
            } else if (packet.type === 'response' && packet.command === 'start') {
                if (packet.success) {
                    ownsStream = true; ready = true;
                    // This visualizer only renders readings; the WebSocket command owns the real stream.
                    electrodeQuality.doStartStream(); electrodeQuality.expand();
                    ui['quality-placeholder'].hidden = true;
                    if (pendingKind) startPending();
                    else message('EEG ready. Check electrode quality, then record a quiet baseline.');
                    refreshControls();
                }
                else { pendingKind = null; message(`Could not start EEG: ${packet.error || 'unknown error'}`); }
            } else if (packet.type === 'reading') {
                const reading = packet.data || {};
                electrodeQuality.ingestReading(reading);
                recent.push(reading); if (recent.length > 90) recent.shift();
                drawChart();
                ui.quality.textContent = `Signal quality: ${reading.signal_quality ?? 'unknown'} · Latest reading: ${new Date(Number(reading.timestamp_ms) || Date.now()).toLocaleTimeString()}`;
                const timestamp = Number(reading.bf_time ?? reading.timestamp_ms);
                if (active && Number.isFinite(timestamp) && timestamp !== lastTimestamp) {
                    lastTimestamp = timestamp;
                    active.readings.push(reading);
                    if (active.readings.length >= MAX_READINGS) { finishSegment(); message(`Stopped at ${MAX_READINGS} readings. Export this session before recording more.`); }
                }
            } else if (packet.type === 'error') message(packet.message || 'EEG server error');
        };
        socket.onerror = () => { message('Could not reach the EEG service at ws://localhost:8765. Start run_servers.py and try again.'); };
        socket.onclose = () => {
            if (ws !== socket) return;
            finishSegment(); ws = null; connected = false; ready = false; ownsStream = false; pendingKind = null;
            electrodeQuality.stop(); ui['quality-placeholder'].hidden = false;
            recent = []; drawChart(); ui.quality.textContent = 'Waiting for readings';
            ui.connection.textContent = 'Disconnected'; refreshControls();
        };
    }
    ui.participant.value = session.label || '';
    ui.connect.addEventListener('click', connect);
    ui.baseline.addEventListener('click', () => beginSegment('baseline'));
    ui.sound.addEventListener('click', () => beginSegment('sound'));
    ui.stop.addEventListener('click', finishSegment);
    ui.export.addEventListener('click', () => {
        download(JSON.stringify(session), 'application/json', `sail-live-sounds-${session.id}.json`);
    });
    ui['export-summary'].addEventListener('click', () => {
        download(summaryCsv(), 'text/csv;charset=utf-8', `sail-live-sounds-summary-${session.id}.csv`);
    });
    ui['new-session'].addEventListener('click', () => {
        if (session.segments.length && !window.confirm('Start a new session? Export the current recording first if you need it.')) return;
        session = freshSession(); ui.participant.value = ''; ui['sound-note'].value = '';
        recent = []; drawChart();
        persist(); renderSegments(); refreshControls();
        message(ready ? 'New session ready. Record its baseline now.' : 'New session ready. Connect EEG to record its baseline.');
    });
    window.addEventListener('beforeunload', () => { finishSegment(); if (ownsStream) send('stop'); });
    renderSegments(); refreshControls(); drawChart();
})();
