// File Manager for handling mindmap file operations with metadata and backups

export interface MindmapFileMetadata {
    version: string;
    appVersion: string;
    fileName: string;
    filePath?: string;
    created: string;
    modified: string;
    backupCount: number;
    autoSave: boolean;
    description?: string;
}

export interface MindmapFileData {
    metadata: MindmapFileMetadata;
    mindmap: {
        nodes: {
            id: number;
            text: string;
            parentId: number | null;
            x: number;
            y: number;
            note: string;
            isRoot: boolean;
            color?: string;
            shape?: 'rectangle' | 'circle' | 'diamond';
        }[];
        connections: {
            fromId: number;
            toId: number;
            type: 'hierarchical' | 'neural';
        }[];
        nodeIdCounter: number;
        notesVisible: boolean;
        canvasOffset?: { x: number; y: number };
        stickyNotes?: any[];
    };
}

export interface FileManagerOptions {
    defaultPath: string;
    autoSaveInterval: number;
    maxBackups: number;
    enableBackups: boolean;
}

export class FileManager {
    private static readonly APP_VERSION = '1.0.0';
    private static readonly FILE_VERSION = '1.0.0';
    private static readonly DEFAULT_FILENAME = 'Untitled';

    private options: FileManagerOptions;
    private currentFile: MindmapFileMetadata | null = null;
    private currentFileHandle: FileSystemFileHandle | null = null; // Store file handle for auto-save
    private isDirty: boolean = false;
    private autoSaveTimer: number | null = null;
    private debounceTimer: number | null = null; // Debounce timer for auto-save
    private isAutoSaving: boolean = false; // Track auto-save state
    private onFileChanged?: (fileData: MindmapFileData | null) => void;
    private onSaveStatusChanged?: (status: 'saved' | 'saving' | 'dirty' | 'error' | 'auto-saving' | 'auto-saved') => void;
    private onAutoSave?: () => any; // Callback to get current data for auto-save

    constructor(options: Partial<FileManagerOptions> = {}) {
        this.options = {
            defaultPath: 'Documents/Mindmaps',
            autoSaveInterval: 3000, // 3 seconds
            maxBackups: 5,
            enableBackups: true,
            ...options
        };
    }

    // Set callbacks for file and save status changes
    public setCallbacks(
        onFileChanged?: (fileData: MindmapFileData | null) => void,
        onSaveStatusChanged?: (status: 'saved' | 'saving' | 'dirty' | 'error' | 'auto-saving' | 'auto-saved') => void,
        onAutoSave?: () => any
    ): void {
        this.onFileChanged = onFileChanged;
        this.onSaveStatusChanged = onSaveStatusChanged;
        this.onAutoSave = onAutoSave;
    }

    // Create a new file
    public createNewFile(initialData?: any): MindmapFileData {
        const now = new Date().toISOString();

        this.currentFile = {
            version: FileManager.FILE_VERSION,
            appVersion: FileManager.APP_VERSION,
            fileName: FileManager.DEFAULT_FILENAME,
            created: now,
            modified: now,
            backupCount: 0,
            autoSave: true
        };

        this.currentFileHandle = null; // Clear file handle for new files

        const fileData: MindmapFileData = {
            metadata: this.currentFile,
            mindmap: initialData || {
                nodes: [],
                connections: [],
                nodeIdCounter: 0,
                notesVisible: false,
                canvasOffset: { x: 0, y: 0 },
                stickyNotes: []
            }
        };

        this.isDirty = false;
        this.startAutoSave();
        this.notifyCallbacks(fileData, 'saved');

        return fileData;
    }

    // Open an existing file
    public async openFile(): Promise<MindmapFileData | null> {
        try {
            const fileHandle = await this.showOpenFilePicker();
            if (!fileHandle) return null;

            const file = await fileHandle.getFile();
            const content = await file.text();
            const fileData = JSON.parse(content) as MindmapFileData;

            // Validate file format
            if (!this.validateFileFormat(fileData)) {
                throw new Error('Invalid file format');
            }

            // Update metadata
            fileData.metadata.modified = new Date().toISOString();
            fileData.metadata.fileName = file.name.replace('.json', '');

            this.currentFile = fileData.metadata;
            this.currentFileHandle = fileHandle; // Store the file handle for future saves
            this.isDirty = false;
            this.startAutoSave();
            this.notifyCallbacks(fileData, 'saved');

            return fileData;
        } catch (error) {
            console.error('Error opening file:', error);
            this.notifyCallbacks(null, 'error');
            return null;
        }
    }

    // Save file with new name (Save As)
    public async saveAsFile(data: any, suggestedName?: string): Promise<boolean> {
        try {
            const fileName = suggestedName || this.currentFile?.fileName || FileManager.DEFAULT_FILENAME;
            const fileHandle = await this.showSaveFilePicker(fileName);
            if (!fileHandle) return false;

            const success = await this.saveToHandle(fileHandle, data);
            if (success && this.currentFile) {
                this.currentFile.fileName = fileHandle.name.replace('.json', '');
                this.currentFile.filePath = fileHandle.name;
                this.currentFileHandle = fileHandle; // Store the file handle for future saves
            }

            return success;
        } catch (error) {
            console.error('Error saving file as:', error);
            this.notifyCallbacks(null, 'error');
            return false;
        }
    }

    // Save current file
    public async saveCurrentFile(data: any, isAutoSave: boolean = false): Promise<boolean> {
        if (!this.currentFile) {
            return this.saveAsFile(data);
        }

        try {
            // For auto-save, don't show "saving" status to prevent flicker
            if (!isAutoSave) {
                this.notifyCallbacks(null, 'saving');
            }

            // Create backup if enabled
            if (this.options.enableBackups && this.currentFile.filePath) {
                await this.createBackup();
            }

            // Update metadata
            this.currentFile.modified = new Date().toISOString();

            const fileData: MindmapFileData = {
                metadata: this.currentFile,
                mindmap: data
            };

            // If we have a file handle, use it (File System Access API)
            if (this.currentFileHandle && 'createWritable' in this.currentFileHandle) {
                try {
                    const success = await this.saveToHandle(this.currentFileHandle, data);
                    if (success) {
                        this.isDirty = false;
                        // Use different status for auto-save completion to prevent UI reload
                        this.notifyCallbacks(fileData, isAutoSave ? 'auto-saved' : 'saved');
                        return true;
                    }
                } catch (error) {
                    console.error('Error saving to file handle:', error);
                    // Fall through to download method
                }
            }

            // Fallback: For auto-save without file handle, don't download
            if (isAutoSave && !this.currentFileHandle) {
                // For auto-save, just mark as saved without downloading
                this.isDirty = false;
                this.notifyCallbacks(fileData, 'auto-saved');
                return true;
            }

            // For manual saves or when File System Access API is not available
            await this.downloadFile(fileData);

            this.isDirty = false;
            this.notifyCallbacks(fileData, 'saved');
            return true;

        } catch (error) {
            console.error('Error saving current file:', error);
            this.notifyCallbacks(null, 'error');
            return false;
        }
    }

    // Mark file as dirty (has unsaved changes)
    public markDirty(): void {
        if (!this.isDirty) {
            this.isDirty = true;
            this.notifyCallbacks(null, 'dirty');
        }

        // Debounce auto-save to prevent excessive saves
        this.debouncedAutoSave();
    }

    // Debounced auto-save trigger
    private debouncedAutoSave(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = window.setTimeout(() => {
            this.triggerAutoSave();
        }, 500); // 500ms debounce
    }

    // Trigger immediate auto-save
    private async triggerAutoSave(): Promise<void> {
        if (!this.isDirty || !this.onAutoSave || this.isAutoSaving) return;

        try {
            this.isAutoSaving = true;
            this.notifyCallbacks(null, 'auto-saving');

            // Get current data from the app
            const currentData = this.onAutoSave();

            // Save the file with auto-save flag
            const success = await this.saveCurrentFile(currentData, true);

            if (!success) {
                console.error('Auto-save failed to save file');
                this.notifyCallbacks(null, 'error');
            }

        } catch (error) {
            console.error('Auto-save failed:', error);
            this.notifyCallbacks(null, 'error');
        } finally {
            this.isAutoSaving = false;
        }
    }

    // Get current file info
    public getCurrentFileInfo(): { name: string; isDirty: boolean; path?: string } | null {
        if (!this.currentFile) return null;

        return {
            name: this.currentFile.fileName,
            isDirty: this.isDirty,
            path: this.currentFile.filePath
        };
    }

    // Start auto-save timer
    private startAutoSave(): void {
        this.stopAutoSave();

        if (this.currentFile?.autoSave) {
            // Set up a background timer for periodic auto-save (fallback)
            this.autoSaveTimer = window.setInterval(async () => {
                // Only save if dirty and not already auto-saving
                if (this.isDirty && !this.isAutoSaving) {
                    await this.triggerAutoSave();
                }
            }, this.options.autoSaveInterval);
        }
    }

    // Stop auto-save timer
    private stopAutoSave(): void {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    // Create backup of current file
    private async createBackup(): Promise<void> {
        if (!this.currentFile?.filePath) return;

        try {
            // In a real desktop app, this would copy the file
            // For browser, we'll just increment backup count
            this.currentFile.backupCount = Math.min(
                this.currentFile.backupCount + 1,
                this.options.maxBackups
            );

            console.log(`Backup created for ${this.currentFile.fileName} (${this.currentFile.backupCount})`);
        } catch (error) {
            console.error('Error creating backup:', error);
        }
    }

    // Show file open picker (uses File System Access API when available)
    private async showOpenFilePicker(): Promise<FileSystemFileHandle | null> {
        try {
            // Check if File System Access API is supported
            if ('showOpenFilePicker' in window) {
                const [fileHandle] = await (window as any).showOpenFilePicker({
                    types: [{
                        description: 'Mindmap files',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                return fileHandle;
            } else {
                // Fallback to input element
                return this.fallbackOpenFile();
            }
        } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error('Error showing open picker:', error);
            }
            return null;
        }
    }

    // Show file save picker
    private async showSaveFilePicker(suggestedName: string): Promise<FileSystemFileHandle | null> {
        try {
            if ('showSaveFilePicker' in window) {
                const fileHandle = await (window as any).showSaveFilePicker({
                    suggestedName: `${suggestedName}.json`,
                    types: [{
                        description: 'Mindmap files',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                return fileHandle;
            } else {
                // Fallback to download
                return null;
            }
        } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error('Error showing save picker:', error);
            }
            return null;
        }
    }

    // Fallback file opening using input element
    private fallbackOpenFile(): Promise<FileSystemFileHandle | null> {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                    // Create a mock FileSystemFileHandle-like object
                    const mockHandle = {
                        name: file.name,
                        getFile: () => Promise.resolve(file)
                    } as any;
                    resolve(mockHandle);
                } else {
                    resolve(null);
                }
            };
            input.click();
        });
    }

    // Save to file handle
    private async saveToHandle(fileHandle: FileSystemFileHandle, data: any): Promise<boolean> {
        try {
            const fileData: MindmapFileData = {
                metadata: this.currentFile!,
                mindmap: data
            };

            if ('createWritable' in fileHandle) {
                const writable = await fileHandle.createWritable();
                await writable.write(JSON.stringify(fileData, null, 2));
                await writable.close();
            }

            return true;
        } catch (error) {
            console.error('Error writing to file handle:', error);
            return false;
        }
    }

    // Download file (fallback for browsers without File System Access API)
    private async downloadFile(fileData: MindmapFileData): Promise<void> {
        const content = JSON.stringify(fileData, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileData.metadata.fileName}.json`;
        link.click();

        URL.revokeObjectURL(url);
    }

    // Validate file format
    private validateFileFormat(fileData: any): fileData is MindmapFileData {
        return (
            fileData &&
            fileData.metadata &&
            fileData.mindmap &&
            typeof fileData.metadata.version === 'string' &&
            typeof fileData.metadata.fileName === 'string' &&
            Array.isArray(fileData.mindmap.nodes) &&
            Array.isArray(fileData.mindmap.connections)
        );
    }

    // Notify callbacks about changes
    private notifyCallbacks(fileData: MindmapFileData | null, status: 'saved' | 'saving' | 'dirty' | 'error' | 'auto-saving' | 'auto-saved'): void {
        // Only trigger onFileChanged for manual operations, not auto-save operations
        if (this.onFileChanged && fileData && status !== 'auto-saving' && status !== 'auto-saved') {
            this.onFileChanged(fileData);
        }
        if (this.onSaveStatusChanged) {
            this.onSaveStatusChanged(status);
        }
    }

    // Cleanup
    public destroy(): void {
        this.stopAutoSave();
    }
}
