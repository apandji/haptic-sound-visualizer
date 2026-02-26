// Initialize Signal Quality Visualizer
        function initializeSignalQualityVisualizer() {
            signalQualityVisualizer = new SignalQualityVisualizer({
                containerId: 'signalQualityVisualizer',
                updateInterval: 1000, // 1 second
                useMockData: false,
                liveDataTimeoutMs: 3000,
                // deviceType defaults to 'ganglionDevice' if not provided
                onQualityChange: (qualities) => {
                    console.log('Signal quality updated:', qualities);
                },
                onConnectionChange: (state, previousState) => {
                    console.log('Signal quality connection changed:', previousState, '→', state);
                },
                onError: (error) => {
                    console.error('Signal quality error:', error);
                }
            });

        }
