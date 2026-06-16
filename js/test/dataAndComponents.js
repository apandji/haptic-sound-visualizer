// Load pattern metadata
        async function loadPatternMetadata() {
            try {
                const cache = window.AppDataCache;
                const data = cache
                    ? await cache.fetchJson('pattern-metadata', 'pattern_metadata.json')
                    : await fetch('pattern_metadata.json').then(r => r.json());

                if (data.patterns && Array.isArray(data.patterns)) {
                    patternMetadata = {};
                    data.patterns.forEach(pattern => {
                        patternMetadata[pattern.filename] = pattern;
                    });
                    console.log('Loaded metadata for', Object.keys(patternMetadata).length, 'patterns');
                }
            } catch (error) {
                console.warn('Could not load pattern metadata:', error);
            }
        }

        // Load participants from database API (with local fallback)
        async function loadParticipants() {
            try {
                const response = await fetch('/api/participants');
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        availableParticipants = data
                            .map(participant => ({
                                participant_id: participant.participant_id ?? participant.id,
                                participant_code: participant.participant_code || participant.code,
                                age: participant.age ?? null,
                                gender: participant.gender ?? null,
                                handedness: participant.handedness ?? null,
                                notes: participant.notes ?? null
                            }))
                            .filter(participant =>
                                participant.participant_id !== undefined &&
                                participant.participant_id !== null &&
                                participant.participant_code
                            );

                        console.log('Loaded', availableParticipants.length, 'participants from API');
                        return;
                    }
                }
            } catch (error) {
                console.warn('Could not load participants from API:', error);
            }

            // Fallback to SessionInfo localStorage source on failure
            availableParticipants = null;
        }
        
        // Load file list from server or static JSON file
        async function loadFileList() {
            const cache = window.AppDataCache;

            if (cache) {
                const cached = cache.get('audio-files');
                if (Array.isArray(cached) && cached.length) {
                    allFilesList = cached.map(file => {
                        const filename = typeof file === 'string' ? file : file.name || file.filename;
                        return {
                            name: filename,
                            path: `audio_files/${filename}`
                        };
                    });
                    await initializeComponents();
                }
            }

            // Try API endpoint first (for local development)
            try {
                const apiResponse = await fetch('/api/list-audio-files');
                if (apiResponse.ok) {
                    const contentType = apiResponse.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const data = await apiResponse.json();
                        if (Array.isArray(data)) {
                            allFilesList = data.map(file => {
                                const filename = typeof file === 'string' ? file : file.name || file.filename;
                                return {
                                    name: filename,
                                    path: `audio_files/${filename}`
                                };
                            });
                            if (cache) cache.set('audio-files', data);
                            console.log('Loaded', allFilesList.length, 'files from API');
                            await initializeComponents();
                            return;
                        }
                    }
                }
            } catch (apiError) {
                console.log('API endpoint not available:', apiError.message);
            }
            
            // Fallback to static JSON file (for GitHub Pages)
            const basePath = window.location.pathname.replace(/\/[^/]*$/, '') || '';
            const jsonPaths = [
                basePath + '/audio-files.json',
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
                    
                    const isJson = contentType.includes('application/json') || 
                                  contentType.includes('text/json') ||
                                  text.trim().startsWith('[') || 
                                  text.trim().startsWith('{');
                    
                    if (!isJson) {
                        console.log('Response does not appear to be JSON, starts with:', text.substring(0, 50));
                        continue;
                    }
                    
                    const data = JSON.parse(text);
                    let fileArray = [];
                    
                    if (data.files && Array.isArray(data.files)) {
                        fileArray = data.files;
                    } else if (Array.isArray(data)) {
                        fileArray = data;
                    }
                    
                    if (fileArray.length > 0) {
                        allFilesList = fileArray.map(file => {
                            const filename = typeof file === 'string' ? file : file.name || file.filename;
                            return {
                                name: filename,
                                path: `audio_files/${filename}`
                            };
                        });
                        console.log('Successfully loaded', allFilesList.length, 'files from:', path);
                        await initializeComponents();
                        return;
                    }
                } catch (fetchError) {
                    console.log('Error loading from', path, ':', fetchError.message);
                    continue;
                }
            }
            
            // If we get here, all attempts failed
            console.error('Failed to load audio files from any source');
            const fileListEl = document.getElementById('fileList');
            if (window.AppUI) {
                AppUI.renderError(fileListEl, {
                    title: 'Could not load patterns',
                    hint: 'Check your connection or refresh the page.',
                    onRetry: () => loadFileList(),
                });
                AppUI.showBanner({
                    type: 'error',
                    message: 'Could not load the pattern library.',
                    actionLabel: 'Retry',
                    onAction: () => loadFileList(),
                });
            } else if (fileListEl) {
                fileListEl.innerHTML = '<div style="padding: 20px; color: #999; font-size: 12px;">Failed to load audio files</div>';
            }
        }
        
        // Initialize all components
        async function initializeComponents() {
            if (componentsInitialized) {
                if (patternExplorer && typeof patternExplorer.setFiles === 'function') {
                    patternExplorer.setFiles(allFilesList);
                }
                if (queue && typeof queue.updateMetadata === 'function') {
                    queue.updateMetadata(patternMetadata);
                }
                return;
            }
            componentsInitialized = true;

            const fileListEl = document.getElementById('fileList');
            if (window.AppUI) {
                AppUI.clearBusy(fileListEl);
            }

            // Initialize time estimator: loads sessionTimingConfig.json and
            // empirical timing stats (/api/timing-stats) when available.
            timeEstimator = await SessionTimeEstimator.create();

            await loadParticipants();

            function updatePatternsSelectedCount() {
                const el = document.getElementById('patternsSelectedCount');
                if (!el || !queue) return;
                const n = queue.getItems().length;
                el.textContent = n === 1 ? '1 selected' : `${n} selected`;
            }

            function handleQueueChange(source) {
                const count = queue ? queue.getItems().length : 0;
                if (sessionInfo) {
                    sessionInfo.updateSessionEstimate(count);
                }
                updatePatternsSelectedCount();
                if (typeof updateSetupStepContinueButton === 'function') {
                    updateSetupStepContinueButton();
                }
            }
            
            // Initialize Queue
            queue = new PatternQueue({
                containerId: 'queue',
                metadata: patternMetadata,
                headerLabel: 'Queue',
                getAvailableFiles: () => {
                    if (patternExplorer && typeof patternExplorer.getFilteredFiles === 'function') {
                        const filtered = patternExplorer.getFilteredFiles();
                        if (filtered.length > 0) return filtered;
                    }
                    if (patternExplorer?.allFiles?.length) {
                        return patternExplorer.allFiles;
                    }
                    return allFilesList || [];
                },
                // Random selection favors patterns that still need data.
                // Weight anchors to the 3-surveyed-trials confidence floor:
                // never-tested patterns weigh 4, fully-covered ones weigh 1,
                // with a 1.5x boost when the selected participant hasn't
                // experienced the pattern yet.
                getPatternWeights: async () => {
                    const participantId = sessionInfo?.data?.participant_id || null;
                    const url = participantId
                        ? `/api/pattern-stats?participant_id=${encodeURIComponent(participantId)}`
                        : '/api/pattern-stats';
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`pattern-stats ${response.status}`);
                    const payload = await response.json();

                    const weights = new Map();
                    for (const entry of payload.patterns || []) {
                        let weight = Math.max(1, 4 - (entry.surveyedCount || 0));
                        if (participantId && (entry.participantTrials || 0) === 0) {
                            weight *= 1.5;
                        }
                        weights.set(entry.name, weight);
                    }
                    return weights;
                },
                onItemClick: (file, index) => {
                    console.log('Queue item clicked:', file, 'at index:', index);
                    // Play clicked file in audio player (legacy - now handled by play button)
                    // playFileFromLibrary(file);
                },
                onFilePreview: (file) => {
                    // Play file when play button is clicked
                    playFileFromLibrary(file);
                },
                onPlayStateChange: (file, isPlaying) => {
                    // Handle play/pause state changes
                    if (!isPlaying) {
                        // Paused - stop playback and hide progress bar
                        pauseAudioPlayback();
                    }
                },
                onItemAdd: (file) => {
                    console.log('Item added to queue:', file.name);
                },
                onItemRemove: (file) => {
                    console.log('Item removed from queue:', file.name);
                    if (patternExplorer) {
                        patternExplorer.syncWithQueue();
                    }
                },
                onClear: (clearedItems) => {
                    console.log('Queue cleared:', clearedItems.length, 'items');
                    if (patternExplorer) {
                        patternExplorer.syncWithQueue();
                    }
                },
                onRandomSelect: (selected, requestedCount) => {
                    console.log(`Randomly selected ${selected.length} patterns (requested ${requestedCount})`);
                    if (patternExplorer) {
                        patternExplorer.syncWithQueue();
                    }
                },
                onQueueChange: (items, source) => {
                    handleQueueChange(source);
                },
                onReorder: (items) => {
                    console.log('Queue reordered:', items.map(i => i.name));
                }
            });
            
            // Initialize SessionInfo
            sessionInfo = new SessionInfo({
                containerId: 'sessionInfo',
                participants: availableParticipants,
                locations: [
                    { location_id: 1, name: 'MDes Lab' },
                    { location_id: 2, name: 'Steinberg 204' },
                    { location_id: 3, name: 'Weil Hall' }
                ],
                timeEstimator: timeEstimator,
                queue: queue, // Pass queue reference for validation
                getQueueItemCount: () => queue ? queue.getItems().length : 0,
                onChange: (change) => {
                    console.log('SessionInfo changed:', change);
                },
                onValidationChange: (isValid, data) => {
                    console.log('SessionInfo validation changed:', isValid);
                },
                onStartSession: (sessionData) => {
                    console.log('Session started!', sessionData);
                    handleSessionStart(sessionData);
                }
            });
            
            // Initialize PatternExplorerWithSelection
            patternExplorer = new PatternExplorerWithSelection({
                containerId: 'fileList',
                filterContainerId: 'filterPanel',
                files: allFilesList,
                metadata: patternMetadata,
                queue: queue,
                onFileClick: (file) => {
                    // Optional: Handle file click (e.g., preview)
                    console.log('File clicked:', file.name);
                },
                onFileHover: (file, metadata, event) => {
                    // Show tooltip
                    showTooltip(file, metadata, event);
                },
                onFilePreview: (file) => {
                    // Play file when play button is clicked
                    playFileFromLibrary(file);
                    
                    // Sync play state with Queue
                    if (queue) {
                        queue.setPlayingFile(file.path, true);
                    }
                },
                onPlayStateChange: (file, isPlaying) => {
                    // Handle play/pause state changes
                    if (!isPlaying) {
                        // Paused - stop playback and hide progress bar
                        pauseAudioPlayback();
                        
                        // Sync play state with Queue
                        if (queue) {
                            queue.setPlayingFile(null, false);
                        }
                    } else {
                        // Sync play state with Queue
                        if (queue) {
                            queue.setPlayingFile(file.path, true);
                        }
                    }
                },
                onSelectionChange: (file, isSelected) => {
                    console.log('Selection changed:', file.name, isSelected);
                },
                onFilterChange: (filters) => {
                    console.log('Filters changed:', filters);
                }
            });
            
            // Initial session estimate update
            handleQueueChange('init');

            // Patterns header: "N selected"
            updatePatternsSelectedCount();
        }
        
        // Tooltip handling
        function showTooltip(file, metadata, event) {
            const tooltip = document.getElementById('fileTooltip');
            if (!tooltip || !metadata) return;
            
            const tooltipRows = [];
            if (metadata.rms_mean !== undefined) {
                tooltipRows.push(`RMS Mean: ${metadata.rms_mean.toFixed(3)}`);
            }
            if (metadata.duration !== undefined) {
                tooltipRows.push(`Duration: ${metadata.duration.toFixed(2)}s`);
            }
            if (metadata.stereo_balance !== undefined) {
                tooltipRows.push(`Stereo Balance: ${metadata.stereo_balance.toFixed(3)}`);
            }
            if (metadata.stereo_movement !== undefined) {
                tooltipRows.push(`Stereo Movement: ${metadata.stereo_movement.toFixed(3)}`);
            }
            
            if (tooltipRows.length === 0) {
                tooltip.classList.remove('show');
                return;
            }
            
            tooltip.innerHTML = tooltipRows.map(row => 
                `<div class="tooltip-row">${row}</div>`
            ).join('');
            
            // Position tooltip near cursor (if event is provided)
            if (event && event.clientX !== undefined && event.clientY !== undefined) {
                const x = event.clientX + 10;
                const y = event.clientY + 10;
                tooltip.style.left = x + 'px';
                tooltip.style.top = y + 'px';
            }
            tooltip.classList.add('show');
        }
        
        // Hide tooltip on mouse leave
        document.addEventListener('mousemove', (e) => {
            if (!e.target.closest('.pattern-explorer__item')) {
                const tooltip = document.getElementById('fileTooltip');
                if (tooltip) {
                    tooltip.classList.remove('show');
                }
            }
        });
