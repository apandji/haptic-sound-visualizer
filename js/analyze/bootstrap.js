window.addEventListener('DOMContentLoaded', () => {
    analyzePlaceholder = document.getElementById('analyzePlaceholder');
    analyzeContent = document.getElementById('analyzeContent');
    initializeComponents();
    if (dataLoader && typeof dataLoader.loadFromDatabase === 'function') {
        dataLoader.loadFromDatabase();
    }
});

window.addEventListener('resize', handleResize);
