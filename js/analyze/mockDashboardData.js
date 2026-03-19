/**
 * Mock session data for the Analyze dashboard — use to preview charts without DB/localStorage.
 * Shape matches what AnalysisDataProcessor expects (completed trials, band readings, tags).
 */
(function () {
    const BANDS = ['delta', 'theta', 'alpha', 'beta', 'gamma'];

    function randomJitter() {
        return (Math.random() - 0.5) * 0.04;
    }

    /**
     * @param {number} startMs
     * @param {number} durationSec
     * @param {number} intervalMs
     * @param {Object} relBase - band -> center value for _rel
     * @param {Object} [relDelta] - optional per-band offset added linearly over time (stimulation lift)
     */
    function buildReadings(startMs, durationSec, intervalMs, relBase, relDelta = null) {
        const out = [];
        const steps = Math.ceil((durationSec * 1000) / intervalMs);
        for (let i = 0; i < steps; i++) {
            const ts = startMs + i * intervalMs;
            const t = i / Math.max(steps - 1, 1);
            const r = { timestamp_ms: ts };
            for (const band of BANDS) {
                let v = relBase[band] + randomJitter();
                if (relDelta && relDelta[band]) {
                    v += relDelta[band] * t;
                }
                r[`${band}_rel`] = Math.max(0.01, Math.min(0.95, v));
                r[`${band}_abs`] = r[`${band}_rel`] * (1.8 + Math.random() * 0.4);
            }
            out.push(r);
        }
        return out;
    }

    const TAG_POOL = [
        { id: 'calm', label: 'Calm', isCustom: false },
        { id: 'intense', label: 'Intense', isCustom: false },
        { id: 'pleasant', label: 'Pleasant', isCustom: false },
        { id: 'rough', label: 'Rough', isCustom: false },
        { id: 'warm', label: 'Warm', isCustom: false },
        { id: 'sharp', label: 'Sharp', isCustom: false }
    ];

    function pickTags(seed) {
        const a = TAG_POOL[seed % TAG_POOL.length];
        const b = TAG_POOL[(seed + 2) % TAG_POOL.length];
        return seed % 3 === 0 ? [a] : [a, b];
    }

    function makeTrial({
        patternName,
        patternPath,
        trialOrder,
        participantHint,
        baselineBase,
        stimLift
    }) {
        const t0 = Date.now() + trialOrder * 100000;
        const cal = buildReadings(t0, 5, 200, {
            delta: 0.22, theta: 0.18, alpha: 0.2, beta: 0.15, gamma: 0.08
        });
        const bl = buildReadings(t0 + 6000, 10, 100, baselineBase);
        const stim = buildReadings(t0 + 17000, 28, 100, baselineBase, stimLift);
        return {
            status: 'completed',
            trialOrder,
            pattern: { name: patternName, path: patternPath },
            baselineReadings: bl,
            stimulationReadings: stim,
            selectedTags: pickTags(trialOrder + participantHint)
        };
    }

    /**
     * @returns {Array<Object>} sessions array suitable for AnalysisDataProcessor.loadSessions
     */
    function getMockAnalysisSessions() {
        const baseA = { delta: 0.2, theta: 0.17, alpha: 0.24, beta: 0.14, gamma: 0.07 };
        const baseB = { delta: 0.18, theta: 0.2, alpha: 0.2, beta: 0.16, gamma: 0.09 };
        const liftAlpha = { delta: 0.02, theta: 0.03, alpha: 0.12, beta: 0.06, gamma: 0.04 };
        const liftBeta = { delta: 0.01, theta: 0.02, alpha: 0.04, beta: 0.14, gamma: 0.08 };

        const calReadings = buildReadings(Date.now() - 86400000, 5, 200, {
            delta: 0.21, theta: 0.19, alpha: 0.19, beta: 0.14, gamma: 0.08
        });

        const session1 = {
            sessionId: 'MOCK-DEMO-001',
            participant_id: 101,
            calibrationReadings: calReadings,
            trials: [
                makeTrial({
                    patternName: 'Demo_Pattern_A.mp3',
                    patternPath: 'audio_files/Demo_Pattern_A.mp3',
                    trialOrder: 1,
                    participantHint: 0,
                    baselineBase: baseA,
                    stimLift: liftAlpha
                }),
                makeTrial({
                    patternName: 'Demo_Pattern_B.mp3',
                    patternPath: 'audio_files/Demo_Pattern_B.mp3',
                    trialOrder: 2,
                    participantHint: 1,
                    baselineBase: baseB,
                    stimLift: liftBeta
                }),
                makeTrial({
                    patternName: 'Demo_Pattern_A.mp3',
                    patternPath: 'audio_files/Demo_Pattern_A.mp3',
                    trialOrder: 3,
                    participantHint: 2,
                    baselineBase: baseA,
                    stimLift: liftAlpha
                })
            ]
        };

        const session2 = {
            sessionId: 'MOCK-DEMO-002',
            participant_id: 102,
            calibrationReadings: calReadings,
            trials: [
                makeTrial({
                    patternName: 'Demo_Pattern_B.mp3',
                    patternPath: 'audio_files/Demo_Pattern_B.mp3',
                    trialOrder: 1,
                    participantHint: 3,
                    baselineBase: baseB,
                    stimLift: liftBeta
                }),
                makeTrial({
                    patternName: 'Demo_Pattern_C.mp3',
                    patternPath: 'audio_files/Demo_Pattern_C.mp3',
                    trialOrder: 2,
                    participantHint: 4,
                    baselineBase: {
                        delta: 0.19,
                        theta: 0.16,
                        alpha: 0.22,
                        beta: 0.17,
                        gamma: 0.1
                    },
                    stimLift: { delta: 0.04, theta: 0.05, alpha: 0.08, beta: 0.1, gamma: 0.06 }
                })
            ]
        };

        return [session1, session2];
    }

    window.getMockAnalysisSessions = getMockAnalysisSessions;
})();
