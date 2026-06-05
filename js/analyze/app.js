function initializeComponents() {
    dataProcessor = new AnalysisDataProcessor();

    toolbar = new AnalyzeToolbar({
        containerId: 'analyzeToolbar',
        onFiltersChange: handleFiltersChange,
        onRefresh: () => dataLoader?.loadFromDatabase()
    });

    dataLoader = new AnalysisDataLoader({
        refreshButton: toolbar.refreshButton,
        onSessionsLoaded: handleSessionsLoaded
    });

    sidebarNav = new AnalyzeSidebarNav({
        containerId: 'analyzeSidebarNav',
        onViewChange: handleViewChange
    });

    sidebar = new PatternExplorerForAnalysis({
        containerId: 'patternList',
        onPatternSelect: handlePatternSelect,
        onFilePreview: handleFilePreview
    });

    trialsSidebar = new TrialsSidebarList({
        containerId: 'trialSidebarList',
        onTrialSelect: handleTrialSelect
    });

    summaryStats = new SummaryStats({ containerId: 'summaryStats' });
    actionFrequencyChart = new ActionFrequencyChart({ containerId: 'actionFrequencyChart' });
    radarChart = new RadarChart({ containerId: 'radarChart' });
    boxPlotChart = new BoxPlotChart({ containerId: 'boxPlotChart' });
    timeSeriesChart = new TimeSeriesChart({ containerId: 'timeSeriesChart' });

    patternTrialsListView = new TrialsListView({
        containerId: 'patternTrialsListView',
        compact: true,
        onTrialSelect: (dbTrialId) => openTrialView(dbTrialId)
    });

    patternTabs = new AnalyzePatternTabs({
        containerId: 'analyzePatternTabs',
        onChange: () => handleResize()
    });

    subjectiveProfilePanel = new SubjectiveProfilePanel();

    trialDetailView = new TrialDetailView({
        containerId: 'trialDetailView',
        onExcludeChange: handleTrialExcludeChange,
        onBack: handleTrialDetailBack
    });

    patternViewEl = document.getElementById('patternView');
    trialsViewEl = document.getElementById('trialsView');
    patternSidebarPanel = document.getElementById('patternSidebarPanel');
    trialSidebarPanel = document.getElementById('trialSidebarPanel');
}

function updateSidebarMode(view) {
    const isPattern = view === 'pattern';
    if (patternSidebarPanel) {
        patternSidebarPanel.classList.toggle('analyze-sidebar__panel--active', isPattern);
    }
    if (trialSidebarPanel) {
        trialSidebarPanel.classList.toggle('analyze-sidebar__panel--active', !isPattern);
    }
}

function refreshSidebarContent() {
    sidebar.setPatterns(dataProcessor.getPatternSidebarItems());

    const trials = dataProcessor.getTrials({ includeExcluded: true });
    trialsSidebar.setTrials(trials);
    if (selectedTrialDbId) {
        trialsSidebar.selectTrial(selectedTrialDbId);
    }
}

function setSidebarView(view) {
    sidebarNav.setActiveView(view);
    updateSidebarMode(view);
}

function openTrialView(dbTrialId) {
    selectedTrialDbId = dbTrialId;
    currentView = 'trials';
    setSidebarView('trials');
    trialsSidebar.selectTrial(dbTrialId);
    renderCurrentView();
}

function updatePatternHeader(patternName, metadata) {
    const header = document.getElementById('patternDetailHeader');
    const title = document.getElementById('patternDetailTitle');
    const meta = document.getElementById('patternDetailMeta');
    if (!header || !title || !meta) return;

    if (!patternName) {
        header.hidden = true;
        return;
    }

    header.hidden = false;
    title.textContent = patternName;

    if (!metadata) {
        meta.innerHTML = '';
        return;
    }

    const pills = [
        metadata.durationSec != null ? `${metadata.durationSec.toFixed(1)}s` : null,
        metadata.rmsMean != null ? `RMS ${metadata.rmsMean.toFixed(3)}` : null,
        metadata.stereoBalance != null ? `Balance ${metadata.stereoBalance.toFixed(2)}` : null,
        metadata.stereoMovement != null ? `Movement ${metadata.stereoMovement.toFixed(2)}` : null
    ].filter(Boolean);

    meta.innerHTML = pills.map(text => `<span class="pattern-detail-header__pill">${text}</span>`).join('');
}

async function loadPatternMetadata() {
    try {
        const response = await fetch('/api/analysis/pattern-metadata');
        if (!response.ok) return;
        patternMetadataCatalog = await response.json();
        dataProcessor.setPatternMetadata(patternMetadataCatalog);
    } catch (err) {
        console.warn('Analyze: could not load pattern metadata', err);
    }
}

async function handleSessionsLoaded(sessions) {
    await loadPatternMetadata();
    dataProcessor.loadSessions(sessions);
    refreshAnalyzeViews({ autoSelectFirstPattern: true });
}

function handleFiltersChange(filters) {
    dataProcessor.setFilters(filters);
    refreshAnalyzeViews();
}

function handleViewChange(view) {
    currentView = view;
    setSidebarView(view);
    renderCurrentView();
}

function refreshAnalyzeViews(options = {}) {
    const summary = dataProcessor.getCorpusSummary();
    toolbar.updateSummary(summary);
    toolbar.setFilterOptions(dataProcessor.getFilterOptions());
    refreshSidebarContent();

    if (options.autoSelectFirstPattern) {
        currentView = 'pattern';
        setSidebarView('pattern');
        const patterns = dataProcessor.getPatternSidebarItems();
        const firstWithData = patterns.find(pattern => pattern.trialCount > 0);
        if (firstWithData) {
            selectedPatternName = firstWithData.name;
            sidebar.selectPattern(firstWithData.name);
            return;
        }
        showPlaceholder('No completed trials found for the current filters.');
        return;
    }

    renderCurrentView();
}

function renderCurrentView() {
    setSidebarView(currentView);

    if (currentView === 'trials') {
        showTrialsView();
        return;
    }

    showPatternView();
    if (selectedPatternName) {
        renderPatternAnalysis(selectedPatternName);
    } else {
        showPlaceholder('Select a pattern to view its analysis.');
    }
}

function showPatternView() {
    patternViewEl.classList.add('active');
    trialsViewEl.classList.remove('active');
}

function showTrialsView() {
    patternViewEl.classList.remove('active');
    trialsViewEl.classList.add('active');
    analyzePlaceholder.style.display = 'none';
    analyzeContent.classList.add('active');

    const detailPanel = document.getElementById('trialDetailPanel');
    const emptyState = document.getElementById('trialsEmptyState');

    if (selectedTrialDbId) {
        trialDetailView.render(dataProcessor.getTrialDetail(selectedTrialDbId));
        detailPanel.hidden = false;
        emptyState.hidden = true;
        return;
    }

    detailPanel.hidden = true;
    emptyState.hidden = false;
    trialDetailView.render(null);
}

function handlePatternSelect(patternName) {
    selectedPatternName = patternName;
    currentView = 'pattern';
    setSidebarView('pattern');
    analyzeMarkPatternViewed(patternName);
    renderCurrentView();
}

function renderPatternAnalysis(patternName) {
    const analysis = dataProcessor.getPatternAnalysis(patternName);
    if (!analysis) {
        updatePatternHeader(null);
        showPlaceholder('No data available for this pattern under the current filters.');
        return;
    }

    showContent();
    updatePatternHeader(patternName, analysis.metadata);
    summaryStats.update(analysis.summary);
    updateSampleNote(analysis.summary?.surveyedCount || 0);
    updatePanelMetaLabels(analysis);

    actionFrequencyChart.update(analysis.actionFrequency);
    subjectiveProfilePanel.update(analysis.subjective);

    if (analysis.radar) {
        radarChart.update(analysis);
    } else {
        radarChart.clear();
    }
    if (analysis.boxPlots) {
        boxPlotChart.update(analysis.boxPlots);
    } else {
        boxPlotChart.clear();
    }
    if (analysis.timeSeries) {
        timeSeriesChart.update(analysis.timeSeries);
    } else {
        timeSeriesChart.clear();
    }

    const trialsPanel = document.getElementById('patternTrialsPanel');
    const trialsSummary = document.getElementById('patternTrialsSummary');
    if (trialsPanel && trialsSummary) {
        patternTrialsListView.render(analysis.trials);
        trialsSummary.textContent = `Trials (${analysis.trials.length})`;
        trialsPanel.hidden = analysis.trials.length === 0;
    }

    refreshSidebarContent();
    handleResize();
}

function updateSampleNote(surveyedCount) {
    const note = document.getElementById('analyzeSampleNote');
    if (!note) return;

    const threshold = typeof ANALYZE_SMALL_SAMPLE_THRESHOLD !== 'undefined'
        ? ANALYZE_SMALL_SAMPLE_THRESHOLD
        : 5;

    if (surveyedCount > 0 && surveyedCount < threshold) {
        note.hidden = false;
        note.textContent = `${surveyedCount} surveyed trial${surveyedCount === 1 ? '' : 's'} — interpret subjective readouts cautiously.`;
        return;
    }

    note.hidden = true;
    note.textContent = '';
}

function updatePanelMetaLabels(analysis) {
    const surveyed = analysis.subjective?.surveyedCount || 0;
    const surveyedLabel = surveyed
        ? `${surveyed} surveyed`
        : 'No survey data';

    const setMeta = (id, suffix) => {
        const el = document.getElementById(id);
        if (el) el.textContent = suffix ? `${surveyedLabel} · ${suffix}` : surveyedLabel;
    };

    setMeta('actionsPanelMeta', null);
    setMeta('scalesPanelMeta', null);
    setMeta('directionPanelMeta', null);
    setMeta('emotionPanelMeta', null);
    setMeta('texturePanelMeta', null);

    const physioMeta = document.getElementById('physioPanelMeta');
    if (physioMeta) {
        const eegCount = analysis.eegTrialCount || 0;
        physioMeta.textContent = eegCount ? `${eegCount} with EEG` : 'No EEG data';
    }
}

function handleTrialSelect(dbTrialId) {
    selectedTrialDbId = dbTrialId;
    trialsSidebar.selectTrial(dbTrialId);
    renderCurrentView();
}

function handleTrialDetailBack() {
    selectedTrialDbId = null;
    trialsSidebar.selectTrial(null);
    renderCurrentView();
}

async function handleTrialExcludeChange(dbTrialId, excluded) {
    try {
        const response = await fetch('/api/analysis/trials/exclude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trialId: Number(dbTrialId), excludeFromAnalysis: excluded })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Could not update trial exclusion');
        }
        dataProcessor.updateTrialExclusion(dbTrialId, excluded);
        refreshSidebarContent();
        if (selectedTrialDbId) {
            trialsSidebar.selectTrial(selectedTrialDbId);
            trialDetailView.render(dataProcessor.getTrialDetail(selectedTrialDbId));
        }
        if (currentView === 'pattern' && selectedPatternName) {
            renderPatternAnalysis(selectedPatternName);
        } else if (currentView === 'pattern') {
            toolbar.updateSummary(dataProcessor.getCorpusSummary());
            sidebar.setPatterns(dataProcessor.getPatternSidebarItems());
        } else {
            toolbar.updateSummary(dataProcessor.getCorpusSummary());
        }
    } catch (err) {
        console.error('Analyze: failed to update trial exclusion', err);
        alert('Could not save exclusion flag. Reload and try again.');
    }
}

function playPreviewWithHandling(audio, onSettled) {
    try {
        const result = audio.play();
        if (result !== undefined && typeof result.then === 'function') {
            result.then(() => onSettled(true)).catch((err) => {
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

function handleFilePreview(file) {
    if (previewAudio && previewingFilePath === file.path) {
        if (previewAudio.paused) {
            playPreviewWithHandling(previewAudio, (ok) => sidebar.setPlayingState(file.path, ok));
        } else {
            previewAudio.pause();
            sidebar.setPlayingState(file.path, false);
        }
        return;
    }

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
    }
    analyzePlaceholder.style.display = 'flex';
    analyzeContent.classList.remove('active');
}

function showContent() {
    analyzePlaceholder.style.display = 'none';
    analyzeContent.classList.add('active');
}

function handleResize() {
    if (analyzeContent.classList.contains('active')) {
        analyzeContent.querySelectorAll('.js-plotly-plot').forEach(div => Plotly.Plots.resize(div));
    }
}
