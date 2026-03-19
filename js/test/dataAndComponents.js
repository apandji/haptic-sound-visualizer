// Load pattern metadata
        async function loadPatternMetadata() {
            try {
                const response = await fetch('pattern_metadata.json');
                if (response.ok) {
                    const data = await response.json();
                    if (data.patterns && Array.isArray(data.patterns)) {
                        patternMetadata = {};
                        data.patterns.forEach(pattern => {
                            patternMetadata[pattern.filename] = pattern;
                        });
                        console.log('Loaded metadata for', Object.keys(patternMetadata).length, 'patterns');
                    }
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
            if (fileListEl) {
                fileListEl.innerHTML = '<div style="padding: 20px; color: #999; font-size: 12px;">Failed to load audio files</div>';
            }
        }
        
        // Initialize all components
        async function initializeComponents() {
            // Initialize time estimator
            timeEstimator = new SessionTimeEstimator({
                // Values can be overridden here, or edit js/modules/sessionTimingConfig.json
            });

            await loadParticipants();
            
            // Initialize Queue
            queue = new PatternQueue({
                containerId: 'queue',
                metadata: patternMetadata,
                headerLabel: 'Queue',
                getAvailableFiles: () => {
                    // Return currently filtered files for random selection
                    if (patternExplorer && patternExplorer.getFilteredFiles) {
                        return patternExplorer.getFilteredFiles();
                    }
                    return [];
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
                onItemAdd: (file, index) => {
                    console.log('Item added to queue:', file.name);
                    setTimeout(() => {
                        if (sessionInfo && queue) {
                            sessionInfo.updateSessionEstimate(queue.getItems().length);
                        }
                        updatePatternsSelectedCount();
                    }, 0);
                },
                onItemRemove: (file, index) => {
                    console.log('Item removed from queue:', file.name);
                    // Sync selection state with PatternExplorer
                    if (patternExplorer) {
                        patternExplorer.syncWithQueue();
                    }
                    // Update session estimate after a short delay to ensure queue is updated
                    // Skip update if queue is empty (likely being cleared)
                    setTimeout(() => {
                        if (sessionInfo && queue) {
                            const count = queue.getItems().length;
                            if (count > 0) {
                                sessionInfo.updateSessionEstimate(count);
                            }
                        }
                        updatePatternsSelectedCount();
                    }, 0);
                },
                onClear: (clearedItems) => {
                    console.log('Queue cleared:', clearedItems.length, 'items');
                    // Sync selection state with PatternExplorer
                    if (patternExplorer) {
                        patternExplorer.syncWithQueue();
                    }
                    // Update session estimate immediately to 0 (queue is already empty)
                    if (sessionInfo) {
                        sessionInfo.patternCount = 0;
                        sessionInfo.updateEstimatePanelVisibility();
                        sessionInfo.updateSessionEstimate(0);
                    }
                    updatePatternsSelectedCount();
                },
                onRandomSelect: (selected, requestedCount) => {
                    console.log(`Randomly selected ${selected.length} patterns (requested ${requestedCount})`);
                    // Sync selection state with PatternExplorer
                    if (patternExplorer) {
                        patternExplorer.syncWithQueue();
                    }
                    // Update session estimate after all items are added - use setTimeout to ensure it happens after render
                    setTimeout(() => {
                        if (sessionInfo && queue) {
                            sessionInfo.updateSessionEstimate(queue.getItems().length);
                        }
                        updatePatternsSelectedCount();
                    }, 0);
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
                    // Update session estimate when selection changes
                    if (sessionInfo) {
                        sessionInfo.updateSessionEstimate(queue.getItems().length);
                    }
                },
                onFilterChange: (filters) => {
                    console.log('Filters changed:', filters);
                }
            });
            
            // Initial session estimate update
            if (sessionInfo) {
                sessionInfo.updateSessionEstimate(queue.getItems().length);
            }

            // Patterns header: "N selected"
            updatePatternsSelectedCount();

            // Filters: icon + popover (no longer inline so list isn't pushed down)
            wrapFilterPanelInPopover();
        }

        function wrapFilterPanelInPopover() {
            const fp = document.getElementById('filterPanel');
            if (!fp || !fp.parentNode) return;
            const parent = fp.parentNode;
            const wrap = document.createElement('div');
            wrap.className = 'filter-popover';
            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'filter-popover__trigger';
            trigger.setAttribute('aria-label', 'Open filters');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>';
            const popoverContent = document.createElement('div');
            popoverContent.className = 'filter-popover__content';
            parent.insertBefore(wrap, fp);
            parent.removeChild(fp);
            popoverContent.appendChild(fp);
            wrap.appendChild(trigger);
            wrap.appendChild(popoverContent);
            trigger.addEventListener('click', function (e) {
                e.stopPropagation();
                const open = popoverContent.classList.toggle('is-open');
                trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
            document.addEventListener('click', function (e) {
                if (!wrap.contains(e.target)) {
                    popoverContent.classList.remove('is-open');
                    trigger.setAttribute('aria-expanded', 'false');
                }
            });
        }

        function updatePatternsSelectedCount() {
            const el = document.getElementById('patternsSelectedCount');
            if (!el || !queue) return;
            const n = queue.getItems().length;
            el.textContent = n === 1 ? '1 selected' : `${n} selected`;
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
