// State
let dataProcessor = null;
let dataLoader = null;
let toolbar = null;
let sidebarNav = null;
let sidebar = null;
let summaryStats = null;
let radarChart = null;
let boxPlotChart = null;
let timeSeriesChart = null;
let patternTabs = null;
let subjectiveProfilePanel = null;
let trialDetailView = null;
let landscapeChart = null;
let attentionQueuePanel = null;
let tagCohortsPanel = null;
let patternTagsPanel = null;
let actionsWordCloud = null;
let vibesWordCloud = null;
let trialsWorkbench = null;
let allTrialsWorkbench = null;

let currentView = 'patterns'; // 'patterns' | 'trials'
let selectedPatternName = null;
let selectedTrialDbId = null;
let patternMetadataCatalog = {};
let modeSearchQueries = { patterns: '', trials: '' };

// Analyst tag system (loaded from the DB via the API)
let analysisTags = [];                 // [{id, name, color, isDefault}]
let analysisTagsById = new Map();      // Map<id, tag>
let patternTagAssignments = new Map(); // Map<patternName, number[]>
let patternAnnotations = new Map();    // Map<patternName, {notes, updatedAt}>

let previewAudio = null;
let previewingFilePath = null;

let analyzePlaceholder = null;
let analyzeContent = null;
let patternsModeViewEl = null;
let patternViewEl = null;
let trialsViewEl = null;
let patternRailEl = null;
let attentionRailEl = null;
let globalSearchEl = null;
let globalSortWrapEl = null;
