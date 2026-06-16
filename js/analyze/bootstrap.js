window.addEventListener('DOMContentLoaded', () => {
    analyzePlaceholder = document.getElementById('analyzePlaceholder');
    analyzeContent = document.getElementById('analyzeContent');
    initializeComponents();
    if (dataLoader && typeof dataLoader.loadFromDatabase === 'function') {
        dataLoader.loadFromDatabase();
    }
});

window.addEventListener('sail-theme-change', () => {
    if (typeof currentView === 'undefined') return;
    if (currentView === 'patterns') {
        renderLandscapeView();
        if (selectedPatternName) renderPatternAnalysis(selectedPatternName);
    }
    handleResize();
});

window.addEventListener('resize', handleResize);
