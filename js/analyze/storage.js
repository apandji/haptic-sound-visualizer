function analyzeGetPatternLastViewedMap() {
    try {
        const raw = localStorage.getItem(ANALYZE_STORAGE_KEYS.patternLastViewed);
        return raw ? JSON.parse(raw) : {};
    } catch (_err) {
        return {};
    }
}

function analyzeMarkPatternViewed(patternName) {
    if (!patternName) return;
    const map = analyzeGetPatternLastViewedMap();
    map[patternName] = new Date().toISOString();
    localStorage.setItem(ANALYZE_STORAGE_KEYS.patternLastViewed, JSON.stringify(map));
}

function analyzePatternHasNewData(patternName, latestTrialEndTime) {
    if (!patternName || !latestTrialEndTime) return false;
    const map = analyzeGetPatternLastViewedMap();
    const lastViewed = map[patternName];
    if (!lastViewed) return true;
    return new Date(latestTrialEndTime) > new Date(lastViewed);
}
