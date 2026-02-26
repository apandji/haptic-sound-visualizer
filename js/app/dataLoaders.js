(function registerDataLoaders() {
    const app = window.HapticApp || (window.HapticApp = {});
    const state = app.state;

    app.loadPatternMetadata = async function loadPatternMetadata() {
        try {
            const response = await fetch('pattern_metadata.json');
            if (response.ok) {
                const data = await response.json();
                if (data.patterns && Array.isArray(data.patterns)) {
                    state.patternMetadata = {};
                    data.patterns.forEach((pattern) => {
                        state.patternMetadata[pattern.filename] = pattern;
                    });
                    console.log('Loaded metadata for', Object.keys(state.patternMetadata).length, 'patterns');
                }
            }
        } catch (error) {
            console.warn('Could not load pattern metadata:', error);
        }
    };

    app.loadFileList = async function loadFileList() {
        try {
            const apiResponse = await fetch('/api/list-audio-files');
            if (apiResponse.ok) {
                const contentType = apiResponse.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = await apiResponse.json();
                    if (Array.isArray(data)) {
                        state.allFilesList = data;
                        console.log('Loaded', state.allFilesList.length, 'files from API');
                        app.initializeComponent();
                        return;
                    }
                }
            }
        } catch (apiError) {
            console.log('API endpoint not available:', apiError.message);
        }

        const basePath = window.location.pathname.replace(/\/[^/]*$/, '') || '';
        const jsonPaths = [
            `${basePath}/audio-files.json`,
            './audio-files.json',
            'audio-files.json',
            '/audio-files.json'
        ];

        for (const path of jsonPaths) {
            try {
                console.log('Trying to load from:', path);
                const response = await fetch(path);

                if (!response.ok) {
                    console.log('Response not OK, status:', response.status, 'for path:', path);
                    continue;
                }

                const contentType = response.headers.get('content-type') || '';
                const text = await response.text();

                const isJson =
                    contentType.includes('application/json') ||
                    contentType.includes('text/json') ||
                    text.trim().startsWith('[') ||
                    text.trim().startsWith('{');

                if (!isJson) {
                    console.log('Response does not appear to be JSON, starts with:', text.substring(0, 50));
                    continue;
                }

                const data = JSON.parse(text);
                if (Array.isArray(data) && data.length > 0) {
                    state.allFilesList = data;
                    console.log('Successfully loaded', state.allFilesList.length, 'files from:', path);
                    app.initializeComponent();
                    return;
                }
            } catch (fetchError) {
                console.log('Error loading from', path, ':', fetchError.message);
            }
        }

        console.error('Failed to load audio files from any source');
        const fileListEl = document.getElementById('fileList');
        if (fileListEl) {
            fileListEl.innerHTML =
                '<div style="padding: 20px; color: #999; font-size: 12px;">Failed to load audio files</div>';
        }
    };
})();
