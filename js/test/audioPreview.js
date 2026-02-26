// Simple audio preview setup
        function setupAudioPreview() {
            if (window.p5Instance) return;
            
            const sketch = function(p) {
                p.setup = function() {
                    // Create loadSound function
                    window.loadSoundFn = function(path, onSuccess, onError) {
                        try {
                            return p.loadSound(path, onSuccess, onError);
                        } catch (error) {
                            console.error('Error loading sound:', error);
                            if (onError) onError(error);
                            return null;
                        }
                    };
                    
                    // Initialize AudioPlayer
                    setTimeout(() => {
                        initializeSimpleAudioPlayer();
                    }, 100);
                };
                
                p.draw = function() {
                    // Check loop duration if needed
                    if (audioPlayerInstance) {
                        audioPlayerInstance.checkLoopDuration();
                    }
                };
            };
            
            // Create container for p5
            // Note: Some browsers require the container to be at least partially visible for audio
            // We'll make it tiny and off-screen rather than completely hidden
            const p5Container = document.createElement('div');
            p5Container.id = 'p5-audio-container';
            p5Container.style.width = '1px';
            p5Container.style.height = '1px';
            p5Container.style.position = 'fixed';
            p5Container.style.top = '-10px';
            p5Container.style.left = '-10px';
            p5Container.style.overflow = 'hidden';
            p5Container.style.opacity = '0.01'; // Very faint but not completely invisible
            p5Container.style.pointerEvents = 'none';
            p5Container.style.zIndex = '-1';
            // Keep it in the DOM (don't use display: none as it can break audio)
            document.body.appendChild(p5Container);
            
            try {
                window.p5Instance = new p5(sketch, p5Container);
            } catch (error) {
                console.error('Error initializing p5.js:', error);
            }
        }
        
        // Initialize simple AudioPlayer
        function initializeSimpleAudioPlayer() {
            if (!window.loadSoundFn) {
                setTimeout(initializeSimpleAudioPlayer, 100);
                return;
            }
            
            if (audioPlayerInstance) return;
            
            try {
                audioPlayerInstance = new AudioPlayer({
                    loadSoundFn: window.loadSoundFn,
                    defaultLoop: false,
                    onLoad: () => {
                        updateAudioProgressBar();
                    },
                    onPlay: () => {
                        startProgressUpdates();
                    },
                    onPause: () => {
                        updateAudioProgressBar();
                    },
                    onStop: () => {
                        currentPreviewFile = null;
                        updateAudioProgressBar();
                    },
                    onEnd: () => {
                        currentPreviewFile = null;
                        updateAudioProgressBar();
                    }
                });
            } catch (error) {
                console.error('Error initializing AudioPlayer:', error);
            }
        }
        
        // Update audio progress bar
        function updateAudioProgressBar() {
            const progressBar = document.getElementById('audioProgressBar');
            const fileEl = document.getElementById('audioProgressFile');
            const progressFill = document.getElementById('audioProgressFill');
            const timeEl = document.getElementById('audioProgressTime');
            
            if (!audioPlayerInstance || !currentPreviewFile) {
                if (progressBar) progressBar.classList.remove('show');
                return;
            }
            
            const isLoaded = audioPlayerInstance.isLoaded();
            const isPlaying = audioPlayerInstance.isPlaying();
            
            // Hide progress bar if not playing
            if (!isLoaded || !isPlaying) {
                if (progressBar) progressBar.classList.remove('show');
                return;
            }
            
            // Show progress bar
            if (progressBar) progressBar.classList.add('show');
            
            // Update file name
            if (fileEl && currentPreviewFile) {
                fileEl.textContent = currentPreviewFile.name || 'Unknown file';
            }
            
            // Update progress
            const currentTime = audioPlayerInstance.getCurrentTime();
            const duration = audioPlayerInstance.getDuration();
            const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
            
            if (progressFill) {
                progressFill.style.width = progress + '%';
            }
            
            // Update time display
            if (timeEl) {
                const currentMin = Math.floor(currentTime / 60);
                const currentSec = Math.floor(currentTime % 60);
                const durationMin = Math.floor(duration / 60);
                const durationSec = Math.floor(duration % 60);
                timeEl.textContent = `${currentMin}:${currentSec.toString().padStart(2, '0')} / ${durationMin}:${durationSec.toString().padStart(2, '0')}`;
            }
        }
        
        // Animation frame for progress updates
        let progressAnimationFrame = null;
        function startProgressUpdates() {
            if (progressAnimationFrame) return;
            
            function update() {
                updateAudioProgressBar();
                if (audioPlayerInstance && audioPlayerInstance.isPlaying()) {
                    progressAnimationFrame = requestAnimationFrame(update);
                } else {
                    progressAnimationFrame = null;
                }
            }
            progressAnimationFrame = requestAnimationFrame(update);
        }
        
        // Pause audio playback
        function pauseAudioPlayback() {
            if (audioPlayerInstance && audioPlayerInstance.isPlaying()) {
                audioPlayerInstance.pause();
            }
            currentPreviewFile = null;
            updateAudioProgressBar();
        }
        
        // Start audio context (required for browser autoplay policy)
        function startAudioContext() {
            if (!window.p5Instance) {
                console.error('p5Instance not available for audio context');
                return Promise.resolve(false);
            }
            
            return new Promise((resolve) => {
                try {
                    const audioContext = window.p5Instance.getAudioContext();
                    if (!audioContext) {
                        console.error('Audio context not available');
                        resolve(false);
                        return;
                    }
                    
                    console.log('Audio context state:', audioContext.state);
                    
                    if (audioContext.state === 'running') {
                        console.log('Audio context already running');
                        resolve(true);
                        return;
                    }
                    
                    // Start audio context (requires user gesture)
                    console.log('Starting audio context...');
                    window.p5Instance.userStartAudio().then(() => {
                        console.log('Audio context started successfully');
                        resolve(true);
                    }).catch((error) => {
                        console.error('Error starting audio context:', error);
                        // Try resuming directly as fallback
                        if (audioContext.state === 'suspended') {
                            audioContext.resume().then(() => {
                                console.log('Audio context resumed');
                                resolve(true);
                            }).catch((resumeError) => {
                                console.error('Error resuming audio context:', resumeError);
                                resolve(false);
                            });
                        } else {
                            resolve(false);
                        }
                    });
                } catch (e) {
                    console.error('Exception starting audio context:', e);
                    resolve(false);
                }
            });
        }
        
        // Play file from library (when play button clicked)
        function playFileFromLibrary(file) {
            console.log('playFileFromLibrary called with file:', file);
            if (!file) {
                console.error('No file provided to playFileFromLibrary');
                return;
            }
            
            // Check if this file is already playing - if so, pause it
            if (currentPreviewFile && currentPreviewFile.path === file.path && 
                audioPlayerInstance && audioPlayerInstance.isPlaying()) {
                pauseAudioPlayback();
                return;
            }
            
            // Update current file
            currentPreviewFile = file;
            
            if (!audioPlayerInstance) {
                console.log('AudioPlayer not initialized yet, setting up...');
                if (!window.p5Instance) {
                    setupAudioPreview();
                }
                setTimeout(() => playFileFromLibrary(file), 300);
                return;
            }
            
            // Ensure p5.js instance exists
            if (!window.p5Instance) {
                console.error('p5.js instance not available');
                return;
            }
            
            const filePath = file.path || file;
            console.log('Loading audio file:', filePath);
            
            // Start audio context first (required for browser autoplay policy)
            startAudioContext().then((contextStarted) => {
                console.log('Audio context started:', contextStarted);
                
                // Verify audio context is running
                if (window.p5Instance) {
                    const audioContext = window.p5Instance.getAudioContext();
                    if (audioContext) {
                        console.log('Audio context state after start:', audioContext.state);
                    }
                }
                
                console.log('Loading audio file:', filePath);
                return audioPlayerInstance.loadFile(filePath);
            }).then(() => {
                console.log('Audio file loaded successfully, checking if ready to play...');
                console.log('AudioPlayer isLoaded:', audioPlayerInstance.isLoaded());
                console.log('AudioPlayer isPlaying:', audioPlayerInstance.isPlaying());
                
                // Ensure audio context is still running before playing
                if (window.p5Instance) {
                    const audioContext = window.p5Instance.getAudioContext();
                    if (audioContext && audioContext.state !== 'running') {
                        console.log('Audio context not running, attempting to resume...');
                        audioContext.resume().then(() => {
                            console.log('Audio context resumed, starting playback');
                            tryPlay();
                        }).catch((error) => {
                            console.error('Failed to resume audio context:', error);
                            tryPlay(); // Try anyway
                        });
                    } else {
                        tryPlay();
                    }
                } else {
                    tryPlay();
                }
                
                function tryPlay() {
                    // Small delay to ensure audio is ready
                    setTimeout(() => {
                        console.log('Attempting to play...');
                        console.log('Before play - isLoaded:', audioPlayerInstance.isLoaded());
                        
                        try {
                            // Set volume to 1.0 (full volume) if not already set
                            if (audioPlayerInstance.soundFile) {
                                // Force volume to 1.0
                                console.log('Setting volume to 1.0 explicitly');
                                audioPlayerInstance.soundFile.setVolume(1.0);
                                
                                // Also set gain node directly if available
                                try {
                                    if (audioPlayerInstance.soundFile.output && audioPlayerInstance.soundFile.output.gain) {
                                        audioPlayerInstance.soundFile.output.gain.value = 1.0;
                                        console.log('Set gain node value to 1.0');
                                    }
                                } catch (e) {
                                    console.warn('Could not set gain node:', e);
                                }
                                
                                const currentVolume = audioPlayerInstance.soundFile.getVolume();
                                console.log('Current volume after setting:', currentVolume);
                                
                                // Check if sound is actually ready
                                console.log('Sound file ready:', audioPlayerInstance.soundFile.isLoaded());
                                console.log('Sound file duration:', audioPlayerInstance.soundFile.duration());
                                console.log('Sound file current time:', audioPlayerInstance.soundFile.currentTime());
                                
                                // Ensure we start from the beginning
                                if (audioPlayerInstance.soundFile.currentTime() > 0) {
                                    console.log('Resetting to beginning');
                                    audioPlayerInstance.soundFile.stop();
                                }
                            }
                            
                            const playResult = audioPlayerInstance.play();
                            console.log('Play result:', playResult);
                            
                            // Check again after a brief moment
                            setTimeout(() => {
                                console.log('After play - isPlaying:', audioPlayerInstance.isPlaying());
                                console.log('Sound file isPlaying:', audioPlayerInstance.soundFile ? audioPlayerInstance.soundFile.isPlaying() : 'no soundFile');
                                
                                if (audioPlayerInstance.soundFile) {
                                    console.log('Sound file volume:', audioPlayerInstance.soundFile.getVolume());
                                    const currentTime = audioPlayerInstance.soundFile.currentTime();
                                    console.log('Sound file current time:', currentTime);
                                    console.log('Sound file duration:', audioPlayerInstance.soundFile.duration());
                                    
                                    // Check audio node connection and gain
                                    try {
                                        if (audioPlayerInstance.soundFile.output) {
                                            const outputNode = audioPlayerInstance.soundFile.output;
                                            console.log('Sound file output node:', outputNode);
                                            
                                            // Check gain value
                                            if (outputNode.gain) {
                                                console.log('Gain node value:', outputNode.gain.value);
                                                console.log('Gain node defaultValue:', outputNode.gain.defaultValue);
                                                
                                                // Ensure gain is not 0
                                                if (outputNode.gain.value === 0) {
                                                    console.warn('Gain is 0! Setting to 1.0');
                                                    outputNode.gain.value = 1.0;
                                                }
                                            }
                                            
                                            // Try to verify it's connected
                                            if (window.p5Instance) {
                                                const audioContext = window.p5Instance.getAudioContext();
                                                if (audioContext && audioContext.destination) {
                                                    console.log('Audio context destination:', audioContext.destination);
                                                    console.log('Audio context state:', audioContext.state);
                                                    
                                                    // Try to explicitly ensure connection
                                                    // p5.sound should handle this, but let's verify
                                                    try {
                                                        // Check if output is connected to destination
                                                        // Note: We can't directly check connections, but we can verify the chain exists
                                                        console.log('Verifying audio chain...');
                                                    } catch (e) {
                                                        console.warn('Could not verify audio chain:', e);
                                                    }
                                                }
                                            }
                                        }
                                    } catch (e) {
                                        console.warn('Could not check audio node:', e);
                                    }
                                    
                                    // Check if time is progressing (audio is actually playing)
                                    setTimeout(() => {
                                        const newTime = audioPlayerInstance.soundFile.currentTime();
                                        console.log('Time check - before:', currentTime, 'after:', newTime);
                                        if (newTime > currentTime) {
                                            console.log('✓ Audio is progressing - playback is working!');
                                            console.log('⚠ But no sound heard - check browser/system volume and audio output');
                                        } else {
                                            console.warn('⚠ Audio time not progressing - playback may not be working');
                                        }
                                    }, 500);
                                }
                                
                                if (audioPlayerInstance.isPlaying()) {
                                    startProgressUpdates();
                                } else {
                                    console.error('Playback did not start - checking audio context...');
                                    if (window.p5Instance) {
                                        const ctx = window.p5Instance.getAudioContext();
                                        console.log('Audio context state:', ctx ? ctx.state : 'no context');
                                    }
                                    currentPreviewFile = null;
                                    updateAudioProgressBar();
                                }
                            }, 200);
                        } catch (playError) {
                            console.error('Exception during play():', playError);
                            currentPreviewFile = null;
                            updateAudioProgressBar();
                        }
                    }, 150);
                }
            }).catch(error => {
                console.error('Error loading/playing audio file:', error);
                currentPreviewFile = null;
                updateAudioProgressBar();
            });
        }
