#!/usr/bin/env node
/**
 * generate_mock.js — Generates mock session data for analysis dashboard testing.
 * Usage: node data/generate_mock.js
 * Output: data/mock_sessions.json
 */
const fs = require("fs");
const path = require("path");

function gaussianNoise(amplitude) {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2) * amplitude;
}

function normalizeRelative(obj) {
  const keys = ["delta_rel", "theta_rel", "alpha_rel", "beta_rel", "gamma_rel"];
  const sum = keys.reduce((s, k) => s + obj[k], 0);
  if (sum === 0) return;
  for (const k of keys) obj[k] = parseFloat((obj[k] / sum).toFixed(6));
}

function lerp(a, b, t) { return a + (b - a) * t; }
function r4(n) { return parseFloat(n.toFixed(4)); }

function generateCalibrationReadings(startMs, pv) {
  const readings = [];
  const stable = { d: 0.20, t: 0.22, a: 0.28, b: 0.22, g: 0.08 };
  const absBase = { d: 3.0, t: 3.3, a: 4.2, b: 3.3, g: 1.2 };

  for (let i = 0; i < 200; i++) {
    const settling = i < 50;
    const noise = settling ? lerp(0.04, 0.015, i / 50) : 0.015;
    const absNoise = settling ? lerp(2.5, 1.0, i / 50) : 1.0;

    const reading = {
      timestamp_ms: startMs + i * 100,
      delta_abs: r4(Math.max(0, absBase.d * pv.d + gaussianNoise(0.3 * absNoise))),
      theta_abs: r4(Math.max(0, absBase.t * pv.t + gaussianNoise(0.3 * absNoise))),
      alpha_abs: r4(Math.max(0, absBase.a * pv.a + gaussianNoise(0.4 * absNoise))),
      beta_abs: r4(Math.max(0, absBase.b * pv.b + gaussianNoise(0.3 * absNoise))),
      gamma_abs: r4(Math.max(0, absBase.g * pv.g + gaussianNoise(0.15 * absNoise))),
      delta_rel: Math.max(0.01, stable.d * pv.d + gaussianNoise(noise)),
      theta_rel: Math.max(0.01, stable.t * pv.t + gaussianNoise(noise)),
      alpha_rel: Math.max(0.01, stable.a * pv.a + gaussianNoise(noise)),
      beta_rel: Math.max(0.01, stable.b * pv.b + gaussianNoise(noise)),
      gamma_rel: Math.max(0.01, stable.g * pv.g + gaussianNoise(noise)),
      phase: "calibration"
    };
    normalizeRelative(reading);
    readings.push(reading);
  }
  return readings;
}

function generateBaselineReadings(startMs, pv) {
  const readings = [];
  const base = { d: 0.127, t: 0.208, a: 0.366, b: 0.244, g: 0.056 };
  const absBase = { d: 2.5, t: 4.1, a: 7.2, b: 4.8, g: 1.1 };

  for (let i = 0; i < 300; i++) {
    const reading = {
      timestamp_ms: startMs + i * 100,
      delta_abs: r4(Math.max(0, absBase.d * pv.d + gaussianNoise(0.2))),
      theta_abs: r4(Math.max(0, absBase.t * pv.t + gaussianNoise(0.3))),
      alpha_abs: r4(Math.max(0, absBase.a * pv.a + gaussianNoise(0.4))),
      beta_abs: r4(Math.max(0, absBase.b * pv.b + gaussianNoise(0.3))),
      gamma_abs: r4(Math.max(0, absBase.g * pv.g + gaussianNoise(0.1))),
      delta_rel: Math.max(0.01, base.d * pv.d + gaussianNoise(0.012)),
      theta_rel: Math.max(0.01, base.t * pv.t + gaussianNoise(0.012)),
      alpha_rel: Math.max(0.01, base.a * pv.a + gaussianNoise(0.012)),
      beta_rel: Math.max(0.01, base.b * pv.b + gaussianNoise(0.012)),
      gamma_rel: Math.max(0.01, base.g * pv.g + gaussianNoise(0.012)),
      phase: "baseline"
    };
    normalizeRelative(reading);
    readings.push(reading);
  }
  return readings;
}

function generateStimReadings(startMs, pv, sRel, eRel, sAbs, eAbs) {
  const readings = [];
  for (let i = 0; i < 300; i++) {
    const t = i / 299;
    const reading = {
      timestamp_ms: startMs + i * 100,
      delta_abs: r4(Math.max(0, lerp(sAbs.d, eAbs.d, t) * pv.d + gaussianNoise(0.25))),
      theta_abs: r4(Math.max(0, lerp(sAbs.t, eAbs.t, t) * pv.t + gaussianNoise(0.3))),
      alpha_abs: r4(Math.max(0, lerp(sAbs.a, eAbs.a, t) * pv.a + gaussianNoise(0.4))),
      beta_abs: r4(Math.max(0, lerp(sAbs.b, eAbs.b, t) * pv.b + gaussianNoise(0.3))),
      gamma_abs: r4(Math.max(0, lerp(sAbs.g, eAbs.g, t) * pv.g + gaussianNoise(0.12))),
      delta_rel: Math.max(0.01, lerp(sRel.d, eRel.d, t) * pv.d + gaussianNoise(0.015)),
      theta_rel: Math.max(0.01, lerp(sRel.t, eRel.t, t) * pv.t + gaussianNoise(0.015)),
      alpha_rel: Math.max(0.01, lerp(sRel.a, eRel.a, t) * pv.a + gaussianNoise(0.015)),
      beta_rel: Math.max(0.01, lerp(sRel.b, eRel.b, t) * pv.b + gaussianNoise(0.015)),
      gamma_rel: Math.max(0.01, lerp(sRel.g, eRel.g, t) * pv.g + gaussianNoise(0.015)),
      phase: "stimulation"
    };
    normalizeRelative(reading);
    readings.push(reading);
  }
  return readings;
}

function makeTag(w) {
  return { id: w.toLowerCase(), label: w.charAt(0).toUpperCase() + w.slice(1), isCustom: false };
}

function makePV(seed) {
  const b = (seed % 3) - 1;
  return {
    d: 1.0 + b * 0.02 + (seed * 0.007) % 0.04 - 0.02,
    t: 1.0 - b * 0.01 + (seed * 0.011) % 0.04 - 0.02,
    a: 1.0 + b * 0.03 + (seed * 0.013) % 0.04 - 0.02,
    b: 1.0 - b * 0.02 + (seed * 0.017) % 0.04 - 0.02,
    g: 1.0 + b * 0.01 + (seed * 0.019) % 0.04 - 0.02
  };
}

const patterns = [
  {
    name: "A_100_1.mp3", path: "audio_files/A_100_1.mp3",
    ids: ["SMOCK_GEN_001", "SMOCK_GEN_002", "SMOCK_GEN_003"],
    pids: [901, 902, 903],
    tags: [
      ["calming", "warm", "smooth", "pleasant", "grounding"],
      ["calming", "dreamy", "smooth", "hypnotic"],
      ["calming", "warm", "pleasant", "heavy", "grounding"]
    ],
    sRel: { d: 0.127, t: 0.208, a: 0.366, b: 0.244, g: 0.056 },
    eRel: { d: 0.127, t: 0.23, a: 0.42, b: 0.21, g: 0.056 },
    sAbs: { d: 2.5, t: 4.1, a: 7.2, b: 4.8, g: 1.1 },
    eAbs: { d: 2.5, t: 4.5, a: 8.3, b: 4.1, g: 1.1 }
  },
  {
    name: "A_120_1.mp3", path: "audio_files/A_120_1.mp3",
    ids: ["SMOCK_GEN_004", "SMOCK_GEN_005", "SMOCK_GEN_006"],
    pids: [901, 902, 903],
    tags: [
      ["energizing", "rhythmic", "sharp", "focused", "tingling"],
      ["energizing", "pulsing", "focused", "tense", "chaotic"],
      ["energizing", "rhythmic", "sharp", "light", "expansive"]
    ],
    sRel: { d: 0.127, t: 0.208, a: 0.366, b: 0.244, g: 0.056 },
    eRel: { d: 0.127, t: 0.208, a: 0.30, b: 0.31, g: 0.08 },
    sAbs: { d: 2.5, t: 4.1, a: 7.2, b: 4.8, g: 1.1 },
    eAbs: { d: 2.5, t: 4.1, a: 5.9, b: 6.1, g: 1.6 }
  }
];

const sessions = [];
const BASE = new Date("2026-02-07T10:00:00.000Z").getTime();

for (const pat of patterns) {
  for (let i = 0; i < 3; i++) {
    const pv = makePV(pat.pids[i] + i);
    const offset = (patterns.indexOf(pat) * 3 + i) * 1800000;
    const startMs = BASE + offset + 5000;

    // Per-participant jitter on end values
    const j = (i - 1) * 0.012;
    const eRel = { ...pat.eRel, a: pat.eRel.a + j, b: pat.eRel.b - j * 0.5 };
    const eAbs = { ...pat.eAbs, a: pat.eAbs.a + j * 8, b: pat.eAbs.b - j * 4 };

    const calReadings = generateCalibrationReadings(startMs, pv);
    const blStartMs = startMs + 60000;
    const blReadings = generateBaselineReadings(blStartMs, pv);
    const stStartMs = blStartMs + 30000;
    const stReadings = generateStimReadings(stStartMs, pv, pat.sRel, eRel, pat.sAbs, eAbs);

    sessions.push({
      sessionId: pat.ids[i],
      participant_id: pat.pids[i],
      location_id: 1,
      session_date: new Date(BASE + offset).toISOString(),
      equipment_info: "Mock data - generated",
      experimenter: "Generated",
      notes: "MOCK DATA - auto-generated for testing analysis dashboard",
      startedAt: new Date(startMs).toISOString(),
      queueItems: [{ name: pat.name, path: pat.path, order: 1 }],
      queueItemCount: 1,
      browserInfo: { userAgent: "MockGenerator/1.0", platform: "generated", language: "en-US" },
      screenInfo: { width: 1920, height: 1080 },
      calibrationReadings: calReadings,
      trials: [{
        trialId: pat.ids[i] + "_trial_1",
        pattern: { name: pat.name, path: pat.path },
        trialOrder: 1,
        startTime: new Date(blStartMs).toISOString(),
        endTime: new Date(stStartMs + 30000).toISOString(),
        baselineReadings: blReadings,
        stimulationReadings: stReadings,
        audioTimeOffset: 50,
        selectedTags: pat.tags[i].map(makeTag),
        status: "completed"
      }]
    });
  }
}

const outPath = path.join(__dirname, "mock_sessions.json");
fs.writeFileSync(outPath, JSON.stringify(sessions, null, 2));
console.log(`Generated ${sessions.length} sessions -> ${outPath}`);
sessions.forEach(s => {
  const t = s.trials[0];
  const tags = t.selectedTags.map(x => x.id).join(", ");
  console.log(`  ${s.sessionId} p=${s.participant_id} cal=${s.calibrationReadings.length} bl=${t.baselineReadings.length} st=${t.stimulationReadings.length} [${tags}]`);
});
