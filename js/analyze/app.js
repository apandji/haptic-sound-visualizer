function initializeComponents() {
    dataProcessor = new AnalysisDataProcessor();

    dataLoader = new AnalysisDataLoader({
        containerId: 'dataLoader',
        onSessionsLoaded: handleSessionsLoaded
    });

    sidebar = new PatternExplorerForAnalysis({
        containerId: 'patternList',
        onPatternSelect: handlePatternSelect,
        onComparisonChange: handleComparisonChange,
        onFilePreview: handleFilePreview
    });

    summaryStats = new SummaryStats({ containerId: 'summaryStats' });
    radarChart = new RadarChart({ containerId: 'radarChart' });
    boxPlotChart = new BoxPlotChart({ containerId: 'boxPlotChart' });
    timeSeriesChart = new TimeSeriesChart({ containerId: 'timeSeriesChart' });
    tagFrequencyChart = new TagFrequencyChart({ containerId: 'tagFrequencyChart' });
    tagWordCloud = new TagWordCloud({ containerId: 'tagWordCloud' });
}

function handleSessionsLoaded(sessions) {
    dataProcessor.loadSessions(sessions);
    const patterns = dataProcessor.getUniquePatterns();
    sidebar.setPatterns(patterns);

    if (patterns.length > 0) {
        sidebar.selectPattern(patterns[0].name);
    } else {
        showPlaceholder('No completed trials found in loaded data.');
    }
}

function handlePatternSelect(patternName) {
    if (!patternName) {
        showPlaceholder('Select a pattern to view its analysis.');
        return;
    }

    const analysis = dataProcessor.getPatternAnalysis(patternName);
    if (!analysis) {
        showPlaceholder('No data available for this pattern.');
        return;
    }

    showContent();
    summaryStats.update(analysis.summary);
    radarChart.update(analysis);
    boxPlotChart.update(analysis.boxPlots);
    timeSeriesChart.update(analysis.timeSeries);
    tagFrequencyChart.update(analysis.tagFrequency);
    tagWordCloud.update(analysis.tagFrequency);
}

/**
 * Start HTMLAudioElement playback; handles Promise rejection from Audio.play() (autoplay / decode errors).
 * @param {HTMLAudioElement} audio
 * @param {Function} onSettled - called with true on success, false on failure
 */
function playPreviewWithHandling(audio, onSettled) {
    try {
        const result = audio.play();
        if (result !== undefined && typeof result.then === 'function') {
            result
                .then(() => onSettled(true))
                .catch((err) => {
                    console.warn('Audio preview playback failed:', err);
                    onSettled(false);
                });
        } else {
            onSettled(true);
        }
    } catch (err) {
        console.warn('Audio preview playback failed:', err);
        onSettled(false);
    }
}

function handleComparisonChange(patternNames) {
    if (patternNames.length < 2) {
        if (patternNames.length === 1) {
            handlePatternSelect(patternNames[0]);
        }
        return;
    }

    showContent();
    const comparison = dataProcessor.getComparisonAnalysis(patternNames);
    summaryStats.clear();
    radarChart.updateComparison(comparison.patterns);
    boxPlotChart.updateComparison(comparison.patterns);
    timeSeriesChart.updateComparison(comparison.patterns);
    tagFrequencyChart.updateComparison(comparison.patterns);
    tagWordCloud.updateComparison(comparison.patterns);
}

function handleFilePreview(file) {
    if (previewAudio && previewingFilePath === file.path) {
        // Toggle pause/play
        if (previewAudio.paused) {
            playPreviewWithHandling(previewAudio, (ok) => {
                sidebar.setPlayingState(file.path, ok);
            });
        } else {
            previewAudio.pause();
            sidebar.setPlayingState(file.path, false);
        }
        return;
    }

    // Stop previous
    if (previewAudio) {
        previewAudio.pause();
        previewAudio = null;
    }

    previewingFilePath = file.path;
    previewAudio = new Audio(file.path);
    previewAudio.addEventListener('ended', () => {
        sidebar.setPlayingState(file.path, false);
        previewingFilePath = null;
    });

    playPreviewWithHandling(previewAudio, (ok) => {
        sidebar.setPlayingState(file.path, ok);
        if (!ok) {
            previewAudio = null;
            previewingFilePath = null;
        }
    });
}

function showPlaceholder(message) {
    const textEl = analyzePlaceholder.querySelector('.analyze-main__placeholder-text');
    if (textEl) {
        textEl.textContent = message || 'Load session data to begin analysis.';
    } else {
        analyzePlaceholder.textContent = message || 'Load session data to begin analysis.';
    }
    analyzePlaceholder.style.display = 'flex';
    analyzeContent.classList.remove('active');
}

function showContent() {
    analyzePlaceholder.style.display = 'none';
    analyzeContent.classList.add('active');
}

// Resize handler for Plotly charts
function handleResize() {
    if (analyzeContent.classList.contains('active')) {
        const plotDivs = analyzeContent.querySelectorAll('.js-plotly-plot');
        plotDivs.forEach(div => {
            Plotly.Plots.resize(div);
        });
    }
}
