let allFilesList = [];
        let patternMetadata = {};
        
        // Component instances
        let patternExplorer = null;
        let queue = null;
        let sessionInfo = null;
        let timeEstimator = null;
        let signalQualityVisualizer = null;
        let availableParticipants = null;
        let componentsInitialized = false;
        
        // Simple audio preview
        let audioPlayerInstance = null;
        let currentPreviewFile = null;
