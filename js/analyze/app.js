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
        externalControls: true,
        onPatternSelect: handlePatternSelect,
        onFilePreview: handleFilePreview
    });

    summaryStats = new SummaryStats({ containerId: 'summaryStats' });
    radarChart = new RadarChart({ containerId: 'radarChart' });
    boxPlotChart = new BoxPlotChart({ containerId: 'boxPlotChart' });
    timeSeriesChart = new TimeSeriesChart({ containerId: 'timeSeriesChart' });

    patternTabs = new AnalyzePatternTabs({
        containerId: 'analyzePatternTabs',
        onChange: () => handleResize()
    });

    subjectiveProfilePanel = new SubjectiveProfilePanel();

    trialDetailView = new TrialDetailView({
        containerId: 'trialDetailView',
        onExcludeChange: handleTrialExcludeChange,
        onNavigate: (dbTrialId) => openTrialView(dbTrialId),
        onSaveNote: handleDetailNoteSave
    });

    // Landscape home: the map navigates down the hierarchy on click.
    landscapeChart = new NadLandscapeChart({
        containerId: 'nadLandscapeChart',
        onPatternSelect: openPattern
    });

    attentionQueuePanel = new AttentionQueuePanel({
        containerId: 'attentionQueuePanel',
        onPatternSelect: openPattern,
        onTagToggle: handleQueueTagToggle
    });

    tagCohortsPanel = new TagCohortsPanel({
        containerId: 'tagCohortsPanel',
        onHighlightTag: (tagId) => landscapeChart?.setHighlightedTag(tagId)
    });

    // Pattern view additions
    patternTagsPanel = new PatternTagsPanel({
        containerId: 'patternTagsPanel',
        onSave: savePatternTagState,
        onCreateTag: createAnalysisTag
    });

    actionsWordCloud = new WordCloudPanel({
        containerId: 'actionsWordCloud',
        emptyText: 'No reported actions yet.'
    });

    vibesWordCloud = new WordCloudPanel({
        containerId: 'vibesWordCloud',
        emptyText: 'No vibe responses yet.'
    });

    trialsWorkbench = new TrialsWorkbench({
        containerId: 'trialsWorkbench',
        onExcludeToggle: handleWorkbenchExcludeToggle,
        onTrialOpen: (dbTrialId) => openTrialView(dbTrialId),
        getTrialDetail: (dbTrialId) => dataProcessor.getTrialDetail(dbTrialId),
        onSaveNote: saveTrialAnalystNote
    });

    // Trials mode: the workbench is the trial list; rows select into the
    // persistent detail panel beside it. Search comes from the modebar.
    allTrialsWorkbench = new TrialsWorkbench({
        containerId: 'allTrialsWorkbench',
        selectable: true,
        externalSearch: true,
        onExcludeToggle: handleWorkbenchExcludeToggle,
        onTrialOpen: (dbTrialId) => openTrialView(dbTrialId),
        getTrialDetail: (dbTrialId) => dataProcessor.getTrialDetail(dbTrialId),
        onSaveNote: saveTrialAnalystNote
    });

    patternsModeViewEl = document.getElementById('patternsModeView');
    trialsViewEl = document.getElementById('trialsView');
    patternViewEl = document.getElementById('patternView');
    patternRailEl = document.getElementById('patternRail');
    attentionRailEl = document.getElementById('attentionRail');

    bindModebar();
}

function bindModebar() {
    globalSearchEl = document.getElementById('analyzeGlobalSearch');
    globalSortWrapEl = document.getElementById('analyzeGlobalSortWrap');
    const sortSelect = document.getElementById('analyzeGlobalSort');

    if (globalSearchEl) {
        globalSearchEl.addEventListener('input', () => {
            const query = globalSearchEl.value;
            modeSearchQueries[currentView] = query;
            if (currentView === 'trials') {
                allTrialsWorkbench.setSearchQuery(query);
            } else {
                sidebar.setSearchQuery(query);
            }
        });
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', () => sidebar.setSortBy(sortSelect.value));
    }
}

// Keep the modebar + rails consistent with the active mode.
function updateModeChrome() {
    const isTrials = currentView === 'trials';
    sidebarNav.setActiveView(currentView);
    if (patternRailEl) patternRailEl.hidden = isTrials;
    if (attentionRailEl) attentionRailEl.hidden = isTrials;
    if (globalSearchEl) {
        globalSearchEl.placeholder = isTrials
            ? 'Search trials — pattern, participant, action…'
            : 'Search patterns…';
        globalSearchEl.value = modeSearchQueries[currentView] || '';
    }
    if (globalSortWrapEl) globalSortWrapEl.hidden = isTrials;
}

function refreshSidebarContent() {
    const items = dataProcessor.getPatternSidebarItems();
    sidebar.setPatterns(items);
    const meta = document.getElementById('patternRailMeta');
    if (meta) meta.textContent = `${items.length} patterns`;
}

// Select a pattern from anywhere (map dot, queue row, sidebar).
function openPattern(patternName) {
    sidebar.setSelectedPattern(patternName);
    handlePatternSelect(patternName);
}

function openTrialView(dbTrialId) {
    selectedTrialDbId = dbTrialId;
    if (currentView !== 'trials') {
        currentView = 'trials';
        renderCurrentView();
    } else {
        renderTrialDetail();
    }
    allTrialsWorkbench.setSelectedTrial(dbTrialId);
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

async function loadPatternCatalog() {
    try {
        const response = await fetch('/api/list-audio-files');
        if (!response.ok) return;
        dataProcessor.setPatternCatalog(await response.json());
    } catch (err) {
        console.warn('Analyze: could not load pattern catalog', err);
    }
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

async function loadTagData() {
    try {
        const [tagsResponse, stateResponse] = await Promise.all([
            fetch('/api/analysis/tags'),
            fetch('/api/analysis/pattern-tags')
        ]);
        if (tagsResponse.ok) {
            const payload = await tagsResponse.json();
            analysisTags = payload.tags || [];
            analysisTagsById = new Map(analysisTags.map(tag => [tag.id, tag]));
        }
        if (stateResponse.ok) {
            const payload = await stateResponse.json();
            patternTagAssignments = new Map(Object.entries(payload.patternTags || {}));
            patternAnnotations = new Map(Object.entries(payload.annotations || {}));
        }
    } catch (err) {
        console.warn('Analyze: could not load analyst tags', err);
    }
}

async function createAnalysisTag(name) {
    const response = await fetch('/api/analysis/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not create tag');
    }
    if (!analysisTagsById.has(result.tag.id)) {
        analysisTags.push(result.tag);
        analysisTagsById.set(result.tag.id, result.tag);
    }
    return result.tag;
}

async function savePatternTagState(payload) {
    const response = await fetch('/api/analysis/pattern-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not save tags');
    }
    patternTagAssignments.set(result.patternName, result.tagIds);
    patternAnnotations.set(result.patternName, {
        notes: result.notes,
        updatedAt: result.updatedAt
    });
    return result;
}

// Inline tagging from the attention queue: flip one tag, keep existing
// notes, then refresh the landscape (map colors, queue chips, cohorts) and
// the open pattern's tag panel if it's the same pattern.
async function handleQueueTagToggle(patternName, tagId) {
    const current = new Set(patternTagAssignments.get(patternName) || []);
    if (current.has(tagId)) current.delete(tagId);
    else current.add(tagId);

    const annotation = patternAnnotations.get(patternName);
    await savePatternTagState({
        patternName,
        tagIds: Array.from(current),
        notes: annotation?.notes || ''
    });

    renderLandscapeView();
    if (selectedPatternName === patternName) {
        renderPatternAnalysis(patternName);
    }
}

async function saveTrialAnalystNote(dbTrialId, text) {
    const response = await fetch('/api/analysis/trials/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trialId: Number(dbTrialId), analystNotes: text })
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not save note');
    }
    dataProcessor.updateTrialAnalystNotes(dbTrialId, result.analystNotes);
    return result;
}

async function handleSessionsLoaded(sessions) {
    await Promise.all([loadPatternCatalog(), loadPatternMetadata(), loadTagData()]);
    dataProcessor.loadSessions(sessions);
    refreshAnalyzeViews({ resetToLandscape: true });
}

function handleFiltersChange(filters) {
    dataProcessor.setFilters(filters);
    refreshAnalyzeViews();
}

// Mode tabs flip between the two flattened screens.
function handleViewChange(mode) {
    currentView = mode === 'trials' ? 'trials' : 'patterns';
    renderCurrentView();
}

function refreshAnalyzeViews(options = {}) {
    const summary = dataProcessor.getCorpusSummary();
    toolbar.updateSummary(summary);
    toolbar.setFilterOptions(dataProcessor.getFilterOptions());
    refreshSidebarContent();

    if (options.resetToLandscape) {
        currentView = 'patterns';
    }

    renderCurrentView();
}

function renderCurrentView() {
    updateModeChrome();
    if (currentView === 'trials') {
        renderTrialsMode();
    } else {
        renderPatternsMode();
    }
}

// Patterns mode: map on top, selected pattern's details right below it.
function renderPatternsMode() {
    trialsViewEl.classList.remove('active');
    patternsModeViewEl.classList.add('active');
    analyzePlaceholder.style.display = 'none';
    analyzeContent.classList.add('active');
    analyzeContent.classList.remove('analyze-main__content--viewport');
    renderLandscapeView();
    renderPatternDetails();
    handleResize();
}

function renderPatternDetails() {
    const empty = document.getElementById('patternDetailsEmpty');
    const content = document.getElementById('patternDetailsContent');
    if (!selectedPatternName) {
        if (empty) {
            empty.hidden = false;
            empty.textContent = 'Select a pattern from the list or click a dot on the map to see its details here.';
        }
        if (content) content.hidden = true;
        return;
    }
    renderPatternAnalysis(selectedPatternName);
}

function renderLandscapeView() {
    if (!landscapeChart) return;

    const landscape = dataProcessor.getCorpusLandscape();

    landscapeChart.update(landscape, {
        tagsById: analysisTagsById,
        patternTags: patternTagAssignments
    });

    attentionQueuePanel.update(
        dataProcessor.getResearchHealth(landscape),
        landscape,
        patternTagAssignments,
        analysisTags
    );
    tagCohortsPanel.update(analysisTags, patternTagAssignments, landscape.mappablePatternCount);

    const fieldMeta = document.getElementById('landscapeFieldMeta');
    if (fieldMeta) {
        fieldMeta.textContent = landscapeMetaText(landscape);
    }
}

function landscapeMetaText(landscape) {
    const parts = [`${landscape.mappablePatternCount} of ${landscape.totalPatternCount} patterns on the map`];
    const neverTested = landscape.totalPatternCount - landscape.testedPatternCount;
    const awaitingSurveys = landscape.testedPatternCount - landscape.mappablePatternCount;
    if (awaitingSurveys > 0) parts.push(`${awaitingSurveys} awaiting surveys`);
    if (neverTested > 0) parts.push(`${neverTested} never tested`);
    return parts.join(' · ');
}

// Trials mode: list and detail live side by side — no page jumps.
function renderTrialsMode() {
    patternsModeViewEl.classList.remove('active');
    trialsViewEl.classList.add('active');
    analyzePlaceholder.style.display = 'none';
    analyzeContent.classList.add('active');
    analyzeContent.classList.add('analyze-main__content--viewport');

    allTrialsWorkbench.render(dataProcessor.getTrials({ includeExcluded: true }));
    allTrialsWorkbench.setSelectedTrial(selectedTrialDbId);

    if (selectedTrialDbId) {
        renderTrialDetail();
    } else {
        trialDetailView.render(null);
    }
}

// Trials in the same order the workbench displays them:
// sessions newest-first, trials by run order within each session.
function orderedTrialIds() {
    const sessions = new Map();
    for (const trial of dataProcessor.getTrials({ includeExcluded: true })) {
        const key = String(trial.dbSessionId ?? trial.sessionId ?? 'unknown');
        if (!sessions.has(key)) {
            sessions.set(key, { date: trial.sessionDate || trial.startTime || '', trials: [] });
        }
        sessions.get(key).trials.push(trial);
    }

    const ordered = [];
    Array.from(sessions.values())
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .forEach(session => {
            session.trials
                .sort((a, b) => (a.trialOrder || 0) - (b.trialOrder || 0))
                .forEach(trial => ordered.push(String(trial.dbTrialId)));
        });
    return ordered;
}

function renderTrialDetail() {
    const ids = orderedTrialIds();
    const index = ids.indexOf(String(selectedTrialDbId));
    trialDetailView.render(dataProcessor.getTrialDetail(selectedTrialDbId), {
        prevId: index > 0 ? ids[index - 1] : null,
        nextId: index >= 0 && index < ids.length - 1 ? ids[index + 1] : null,
        position: index >= 0 ? `${index + 1} of ${ids.length}` : null
    });
}

function handlePatternSelect(patternName) {
    selectedPatternName = patternName;
    analyzeMarkPatternViewed(patternName);
    if (currentView !== 'patterns') {
        currentView = 'patterns';
        renderCurrentView();
    } else {
        renderPatternDetails();
        refreshSidebarContent();
    }
    if (patternViewEl) {
        patternViewEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function renderPatternAnalysis(patternName, options = {}) {
    const analysis = dataProcessor.getPatternAnalysis(patternName);
    const empty = document.getElementById('patternDetailsEmpty');
    const content = document.getElementById('patternDetailsContent');

    if (!analysis) {
        updatePatternHeader(null);
        const landscape = dataProcessor.getCorpusLandscape();
        const entry = landscape.patterns.find(p => p.name === patternName);
        if (empty) {
            empty.hidden = false;
            empty.textContent = entry && entry.trialCount === 0
                ? `${patternName} has never been tested — run trials in the Test tab to put it on the map.`
                : 'No data available for this pattern under the current filters.';
        }
        if (content) content.hidden = true;
        return;
    }

    if (empty) empty.hidden = true;
    if (content) content.hidden = false;
    updatePatternHeader(patternName, analysis.metadata);
    summaryStats.update(analysis.summary);
    updateSampleNote(analysis.summary?.surveyedCount || 0);
    updatePanelMetaLabels(analysis);

    // Classification & notes block (tags + digest + analyst notes)
    const landscape = dataProcessor.getCorpusLandscape();
    const entry = landscape.patterns.find(p => p.name === patternName) || null;
    patternTagsPanel.render(
        entry,
        analysisTags,
        patternTagAssignments.get(patternName) || [],
        patternAnnotations.get(patternName) || null
    );
    const classifySection = document.getElementById('patternClassifySection');
    if (classifySection) classifySection.hidden = !entry;

    // Qualitative: word clouds for actions and vibes
    actionsWordCloud.update(
        (analysis.actionFrequency || []).map(item => ({ label: item.action, count: item.count }))
    );
    vibesWordCloud.update(vibeWordItems(analysis.subjective));
    subjectiveProfilePanel.update(analysis.subjective);

    // Quantitative: EEG charts
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

    // Trials workbench (includes excluded trials so flags stay visible)
    const trialsPanel = document.getElementById('patternTrialsPanel');
    if (trialsPanel && !options.skipWorkbench) {
        const workbenchTrials = dataProcessor.getTrials({ patternName, includeExcluded: true });
        trialsWorkbench.render(workbenchTrials, patternName);
        trialsPanel.hidden = workbenchTrials.length === 0;
    }

    refreshSidebarContent();
    handleResize();
}

function vibeWordItems(subjective) {
    const items = [];
    (subjective?.vibeRows || []).forEach(row => {
        (row.options || []).forEach(option => {
            if (option.count > 0) items.push({ label: option.label, count: option.count });
        });
    });
    return items;
}

async function handleWorkbenchExcludeToggle(dbTrialId, excluded) {
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
        toolbar.updateSummary(dataProcessor.getCorpusSummary());

        // Flip the row in place (in whichever workbench shows it), refresh
        // the charts around it without rebuilding (keeps drawer + scroll).
        trialsWorkbench.updateRowExclusion(dbTrialId, excluded);
        allTrialsWorkbench.updateRowExclusion(dbTrialId, excluded);
        if (currentView === 'patterns' && selectedPatternName) {
            renderPatternAnalysis(selectedPatternName, { skipWorkbench: true });
        }
    } catch (err) {
        console.error('Analyze: failed to update trial exclusion from workbench', err);
        trialsWorkbench.updateRowExclusion(dbTrialId, !excluded);
        allTrialsWorkbench.updateRowExclusion(dbTrialId, !excluded);
        alert('Could not save exclusion flag. Reload and try again.');
    }
}

function updateSampleNote(surveyedCount) {
    const note = document.getElementById('analyzeSampleNote');
    if (!note) return;

    const threshold = typeof ANALYZE_SMALL_SAMPLE_THRESHOLD !== 'undefined'
        ? ANALYZE_SMALL_SAMPLE_THRESHOLD
        : 5;

    if (surveyedCount > 0 && surveyedCount < threshold) {
        note.hidden = false;
        note.textContent = `${surveyedCount} surveyed trial${surveyedCount === 1 ? '' : 's'} — interpret qualitative readouts cautiously.`;
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
    setMeta('binaryPanelMeta', null);
    setMeta('emotionPanelMeta', null);
    setMeta('vibesPanelMeta', null);

    const physioMeta = document.getElementById('physioPanelMeta');
    if (physioMeta) {
        const eegCount = analysis.eegTrialCount || 0;
        physioMeta.textContent = eegCount ? `${eegCount} with EEG` : 'No EEG data';
    }
}

// Note save from the persistent detail panel: persist, then sync the
// note indicator on the corresponding workbench row.
async function handleDetailNoteSave(dbTrialId, text) {
    const result = await saveTrialAnalystNote(dbTrialId, text);
    const hasNote = Boolean(String(result.analystNotes || '').trim());
    allTrialsWorkbench.updateRowNote(dbTrialId, hasNote);
    trialsWorkbench.updateRowNote(dbTrialId, hasNote);
    return result;
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
        allTrialsWorkbench.updateRowExclusion(dbTrialId, excluded);
        if (selectedTrialDbId) {
            renderTrialDetail();
        }
        toolbar.updateSummary(dataProcessor.getCorpusSummary());
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
    analyzePlaceholder.setAttribute('aria-busy', 'false');
    analyzeContent.classList.remove('active');
}

function showContent() {
    analyzePlaceholder.style.display = 'none';
    analyzePlaceholder.setAttribute('aria-busy', 'false');
    analyzeContent.classList.add('active');
}

function handleResize() {
    if (!analyzeContent.classList.contains('active')) return;
    analyzeContent.querySelectorAll('.js-plotly-plot').forEach(div => {
        // Skip plots inside hidden regions — Plotly throws on undisplayed divs.
        if (div.offsetParent !== null) Plotly.Plots.resize(div);
    });
}
