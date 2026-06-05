/**
 * Shared EEG channel quality thresholds and classification (RMS only).
 * Keep in sync with data/eeg_quality_config.json and eeg_quality.py.
 */
(function (global) {
    const EEG_QUALITY_CONFIG = {
        rms_good_min: 5.0,
        rms_good_max: 100.0,
        rms_ok_max: 150.0,
        smoothing_alpha: 0.28,
        tier_hold_readings: 3,
        hysteresis_good_exit_uv: 12.0,
        hysteresis_fair_exit_high_uv: 15.0,
        hysteresis_fair_exit_low_uv: 10.0,
        hysteresis_poor_enter_uv: 8.0,
        quality_labels: {
            good: 'GOOD',
            ok: 'OK',
            poor: 'POOR'
        },
        stability_seconds: 1.5,
        stability_min_good_channels: 3,
        window_fill_seconds: 2.0
    };

    function classifyRmsTier(rms_uV, config) {
        const cfg = config || EEG_QUALITY_CONFIG;
        const rms = Number(rms_uV);
        if (!Number.isFinite(rms)) {
            return 'poor';
        }
        if (rms >= cfg.rms_good_min && rms <= cfg.rms_good_max) {
            return 'good';
        }
        if (rms > cfg.rms_good_max && rms <= cfg.rms_ok_max) {
            return 'ok';
        }
        return 'poor';
    }

    function classifyRmsTierWithHysteresis(rms_uV, previousTier, config) {
        const cfg = config || EEG_QUALITY_CONFIG;
        const rms = Number(rms_uV);
        if (!Number.isFinite(rms)) {
            return 'poor';
        }

        const prev = previousTier || null;
        if (!prev) {
            return classifyRmsTier(rms, cfg);
        }

        const gMin = Number(cfg.rms_good_min);
        const gMax = Number(cfg.rms_good_max);
        const fMax = Number(cfg.rms_ok_max);
        const exitGood = gMax + Number(cfg.hysteresis_good_exit_uv ?? 12);
        const exitFairHigh = fMax + Number(cfg.hysteresis_fair_exit_high_uv ?? 15);
        const enterGoodFromFair = gMax - Number(cfg.hysteresis_fair_exit_low_uv ?? 10);
        const enterOkFromPoor = gMin + Number(cfg.hysteresis_poor_enter_uv ?? 8);

        if (prev === 'good') {
            if (rms <= exitGood) return 'good';
            if (rms <= exitFairHigh) return 'ok';
            return 'poor';
        }
        if (prev === 'ok') {
            if (rms >= gMin && rms <= enterGoodFromFair) return 'good';
            if (rms <= exitFairHigh) return 'ok';
            return 'poor';
        }
        if (rms >= gMin && rms <= gMax) return 'good';
        if (rms <= exitFairHigh && rms >= enterOkFromPoor) return 'ok';
        return 'poor';
    }

    function classifyChannelQuality(rms_uV, _p60Rel, config) {
        return classifyRmsTier(rms_uV, config);
    }

    class ChannelQualitySmoother {
        constructor(config) {
            this.config = config || EEG_QUALITY_CONFIG;
            this.channels = new Map();
        }

        reset() {
            this.channels.clear();
        }

        smoothChannel(channelKey, rawRms) {
            const cfg = this.config;
            const alpha = Number(cfg.smoothing_alpha ?? 0.28);
            const holdN = Math.max(1, Number(cfg.tier_hold_readings ?? 3));
            const raw = Number(rawRms);

            if (!Number.isFinite(raw)) {
                return null;
            }

            let state = this.channels.get(channelKey);
            if (!state) {
                const quality = classifyRmsTier(raw, cfg);
                state = { emaRms: raw, tier: quality, pendingTier: quality, pendingCount: 0 };
                this.channels.set(channelKey, state);
                return { rms_uV: raw, rms_uV_raw: raw, quality };
            }

            state.emaRms = alpha * raw + (1 - alpha) * state.emaRms;
            const instantTier = classifyRmsTierWithHysteresis(state.emaRms, state.tier, cfg);

            if (instantTier === state.tier) {
                state.pendingTier = instantTier;
                state.pendingCount = 0;
            } else if (instantTier === state.pendingTier) {
                state.pendingCount += 1;
                if (state.pendingCount >= holdN) {
                    state.tier = instantTier;
                    state.pendingTier = instantTier;
                    state.pendingCount = 0;
                }
            } else {
                state.pendingTier = instantTier;
                state.pendingCount = 1;
            }

            return { rms_uV: state.emaRms, rms_uV_raw: raw, quality: state.tier };
        }
    }

    function getQualityDisplayLabel(quality, config) {
        const cfg = config || EEG_QUALITY_CONFIG;
        const labels = cfg.quality_labels || {};
        return labels[quality] || quality;
    }

    function formatRms(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n.toFixed(1) : '--';
    }

    function formatBandPercent(relValue) {
        const n = Number(relValue);
        return Number.isFinite(n) ? `${Math.round(n * 100)}%` : '--';
    }

    function normalizeChannelMetric(metric, config) {
        if (!metric || typeof metric !== 'object') {
            return null;
        }
        const rms_uV = Number(metric.rms_uV);
        const quality = classifyChannelQuality(rms_uV, null, config);
        return {
            channel_index: metric.channel_index,
            board_channel_index: metric.board_channel_index,
            rms_uV: Number.isFinite(rms_uV) ? rms_uV : null,
            quality
        };
    }

    function getChannelQualityHint(metric, config) {
        const cfg = config || EEG_QUALITY_CONFIG;
        if (!metric || typeof metric !== 'object') {
            return 'Waiting for channel data.';
        }
        const rms_uV = Number(metric.rms_uV);
        const quality = typeof metric.quality === 'string'
            ? metric.quality.toLowerCase()
            : classifyChannelQuality(rms_uV, null, cfg);

        if (quality === 'good') {
            return 'Contact looks good.';
        }
        if (!Number.isFinite(rms_uV) || rms_uV < cfg.rms_good_min) {
            return 'Re-gel or re-seat electrode — very low signal.';
        }
        if (rms_uV > cfg.rms_ok_max) {
            return 'Check movement or muscle tension — signal saturated.';
        }
        if (rms_uV > cfg.rms_good_max) {
            return 'Signal high — ask participant to sit still and relax jaw.';
        }
        return 'Adjust electrode contact.';
    }

    function getChannelQuality(metric, config) {
        if (!metric || typeof metric !== 'object') {
            return null;
        }
        if (typeof metric.quality === 'string') {
            return metric.quality.toLowerCase();
        }
        return classifyChannelQuality(metric.rms_uV, null, config);
    }

    function countQualities(metrics, config) {
        const counts = { good: 0, ok: 0, poor: 0 };
        (metrics || []).forEach((metric) => {
            const quality = getChannelQuality(metric, config);
            if (quality && counts[quality] !== undefined) {
                counts[quality] += 1;
            }
        });
        return counts;
    }

    function buildQualitySummary(metrics, config) {
        const counts = countQualities(metrics, config);
        const cfg = config || EEG_QUALITY_CONFIG;
        const labels = cfg.quality_labels || {};
        const parts = [];
        if (counts.good > 0) parts.push(`${counts.good} ${labels.good || 'good'}`);
        if (counts.ok > 0) parts.push(`${counts.ok} ${labels.ok || 'ok'}`);
        if (counts.poor > 0) parts.push(`${counts.poor} ${labels.poor || 'poor'}`);
        return parts.length > 0 ? parts.join(', ') : '--';
    }

    global.EEGQuality = {
        config: EEG_QUALITY_CONFIG,
        classifyRmsTier,
        classifyRmsTierWithHysteresis,
        classifyChannelQuality,
        ChannelQualitySmoother,
        getQualityDisplayLabel,
        formatRms,
        formatBandPercent,
        normalizeChannelMetric,
        getChannelQualityHint,
        getChannelQuality,
        countQualities,
        buildQualitySummary
    };
})(typeof window !== 'undefined' ? window : globalThis);
