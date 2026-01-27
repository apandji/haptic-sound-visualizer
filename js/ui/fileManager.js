// File management UI
class FileManager {
    constructor() {
        this.files = [];
        this.currentFileIndex = -1;
        this.uploadArea = null;
        this.fileInput = null;
        this.fileList = null;
        this.onFileSelectCallback = null;
    }

    async init() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.fileList = document.getElementById('fileList');
        
        // Try to load files from directory on startup
        await this.loadFilesFromDirectory();
        
        // Setup drag and drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.style.borderColor = '#4a9eff';
        });
        
        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.style.borderColor = '#404040';
        });
        
        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.style.borderColor = '#404040';
            this.handleFiles(e.dataTransfer.files);
        });
        
        // Setup file input button
        const uploadBtn = document.getElementById('uploadBtn');
        uploadBtn.addEventListener('click', () => {
            this.fileInput.click();
        });
        
        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
    }

    async loadFilesFromDirectory() {
        try {
            console.log('Loading files from directory...');
            const response = await fetch('/api/list-audio-files');
            if (!response.ok) {
                console.warn('API endpoint not available:', response.status, response.statusText);
                return;
            }
            
            const audioFiles = await response.json();
            console.log(`Found ${audioFiles.length} audio files in directory`);
            
            if (audioFiles.length === 0) {
                console.log('No audio files found in directory');
                return;
            }
            
            // Add files from directory
            audioFiles.forEach(fileInfo => {
                this.addFileFromPath(fileInfo);
            });
            
            console.log(`Loaded ${this.files.length} files into file manager`);
            
            // Auto-select first file if none selected
            // Delay to ensure audio processor is initialized
            if (this.currentFileIndex === -1 && this.files.length > 0) {
                setTimeout(() => {
                    this.selectFile(0);
                }, 500);
            }
        } catch (error) {
            console.error('Error loading files from directory:', error);
        }
    }

    addFileFromPath(fileInfo) {
        const fileItem = {
            name: fileInfo.name,
            path: fileInfo.path,
            size: this.formatFileSize(fileInfo.size),
            duration: '...',
            id: Date.now() + Math.random(),
            isUrl: true
        };
        
        this.files.push(fileItem);
        this.renderFileList();
        
        // Try to get duration (will be updated when loaded)
        this.getAudioDurationFromUrl(fileInfo.path).then(duration => {
            fileItem.duration = this.formatTime(duration);
            this.renderFileList();
        }).catch(() => {
            fileItem.duration = '?';
            this.renderFileList();
        });
    }

    async getAudioDurationFromUrl(url) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.onloadedmetadata = () => {
                resolve(audio.duration);
                URL.revokeObjectURL(audio.src);
            };
            audio.onerror = () => {
                URL.revokeObjectURL(audio.src);
                reject(new Error('Failed to load audio'));
            };
            audio.src = url;
        });
    }

    handleFiles(fileList) {
        const audioFiles = Array.from(fileList).filter(file => {
            return file.type.startsWith('audio/');
        });
        
        if (audioFiles.length === 0) {
            alert('Please select audio files only.');
            return;
        }
        
        audioFiles.forEach(file => {
            this.addFile(file);
        });
        
        // Auto-select first file if none selected
        if (this.currentFileIndex === -1 && this.files.length > 0) {
            this.selectFile(0);
        }
    }

    addFile(file) {
        const fileInfo = {
            file: file,
            name: file.name,
            size: this.formatFileSize(file.size),
            duration: '...',
            id: Date.now() + Math.random()
        };
        
        this.files.push(fileInfo);
        this.renderFileList();
        
        // Try to get duration (will be updated when loaded)
        this.getAudioDuration(file).then(duration => {
            fileInfo.duration = this.formatTime(duration);
            this.renderFileList();
        });
    }

    async getAudioDuration(file) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.onloadedmetadata = () => {
                resolve(audio.duration);
            };
            audio.onerror = () => {
                resolve(0);
            };
            audio.src = URL.createObjectURL(file);
        });
    }

    selectFile(index) {
        if (index < 0 || index >= this.files.length) return;
        
        this.currentFileIndex = index;
        this.renderFileList();
        
        if (this.onFileSelectCallback) {
            const fileInfo = this.files[index];
            // Pass either File object or URL string
            const file = fileInfo.isUrl ? fileInfo.path : fileInfo.file;
            this.onFileSelectCallback(file);
        }
    }

    getCurrentFile() {
        if (this.currentFileIndex >= 0 && this.currentFileIndex < this.files.length) {
            return this.files[this.currentFileIndex];
        }
        return null;
    }

    renderFileList() {
        this.fileList.innerHTML = '';
        
        this.files.forEach((fileInfo, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            if (index === this.currentFileIndex) {
                fileItem.classList.add('active');
            }
            
            // Add error indicator if file failed to load
            const errorIndicator = fileInfo.error ? ' ⚠️' : '';
            
            fileItem.innerHTML = `
                <div class="file-item-name">${fileInfo.name}${errorIndicator}</div>
                <div class="file-item-meta">${fileInfo.size} • ${fileInfo.duration}</div>
            `;
            
            fileItem.addEventListener('click', () => {
                this.selectFile(index);
            });
            
            this.fileList.appendChild(fileItem);
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds === 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    onFileSelect(callback) {
        this.onFileSelectCallback = callback;
    }
}

// Initialize file manager when DOM is ready
let fileManager = null;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        fileManager = new FileManager();
        await fileManager.init();
    });
} else {
    fileManager = new FileManager();
    (async () => {
        await fileManager.init();
    })();
}
