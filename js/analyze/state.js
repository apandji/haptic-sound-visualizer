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
let actionFrequencyChart = null;
let patternTabs = null;
let subjectiveProfilePanel = null;
let trialsSidebar = null;
let patternTrialsListView = null;
let trialDetailView = null;

let currentView = 'pattern';
let selectedPatternName = null;
let selectedTrialDbId = null;
let patternMetadataCatalog = {};

let previewAudio = null;
let previewingFilePath = null;

let analyzePlaceholder = null;
let analyzeContent = null;
let patternSidebarPanel = null;
let trialSidebarPanel = null;
let patternViewEl = null;
let trialsViewEl = null;
