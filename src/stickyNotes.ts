// Sticky Notes Module for Mindmap Application

interface StickyNote {
    id: number;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    fontSize: number;
    fontFamily: string;
    element: HTMLDivElement;
    textArea: HTMLTextAreaElement;
    isEditing: boolean;
}

interface StickyNoteData {
    id: number;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    fontSize: number;
    fontFamily: string;
}

interface StickyNoteTheme {
    name: string;
    color: string;
    textColor: string;
}

export class StickyNotesManager {
    private stickyNotes: Map<number, StickyNote> = new Map();
    private nextStickyNoteId: number = 1;
    private canvas: HTMLElement;
    private isDragging: boolean = false;
    private dragElement: StickyNote | null = null;
    private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
    private isResizing: boolean = false;
    private resizeElement: StickyNote | null = null;

    // Predefined themes
    private themes: StickyNoteTheme[] = [
        { name: 'Yellow', color: '#fff59d', textColor: '#333' },
        { name: 'Pink', color: '#f8bbd9', textColor: '#333' },
        { name: 'Blue', color: '#81d4fa', textColor: '#333' },
        { name: 'Green', color: '#a5d6a7', textColor: '#333' },
        { name: 'Orange', color: '#ffcc80', textColor: '#333' },
        { name: 'Purple', color: '#ce93d8', textColor: '#333' },
        { name: 'Mint', color: '#80cbc4', textColor: '#333' },
        { name: 'Coral', color: '#ffab91', textColor: '#333' }
    ];

    private fontFamilies: string[] = [
        'Arial, sans-serif',
        'Georgia, serif',
        'Times New Roman, serif',
        'Helvetica, sans-serif',
        'Comic Sans MS, cursive',
        'Courier New, monospace',
        'Verdana, sans-serif',
        'Impact, sans-serif'
    ];

    constructor(canvas: HTMLElement) {
        this.canvas = canvas;
        this.setupEventListeners();
        this.createStickyNoteButton();
    }

    private setupEventListeners(): void {
        // Mouse events for dragging and resizing
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // Keyboard events
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    private createStickyNoteButton(): void {
        const toolbar = document.querySelector('.toolbar');
        if (!toolbar) return;

        const button = document.createElement('button');
        button.textContent = 'Add Sticky Note';
        button.title = 'Add a new sticky note (Alt+S)';
        button.addEventListener('click', () => this.createStickyNote());
        toolbar.appendChild(button);
    }

    public createStickyNote(x?: number, y?: number): StickyNote {
        const canvasRect = this.canvas.getBoundingClientRect();
        const stickyNote: StickyNote = {
            id: this.nextStickyNoteId++,
            text: 'New sticky note',
            x: x || canvasRect.width / 2,
            y: y || canvasRect.height / 2,
            width: 200,
            height: 150,
            color: '#fff59d', // Default yellow
            fontSize: 14,
            fontFamily: 'Arial, sans-serif',
            element: document.createElement('div'),
            textArea: document.createElement('textarea'),
            isEditing: false
        };

        this.setupStickyNoteElement(stickyNote);
        this.canvas.appendChild(stickyNote.element);
        this.stickyNotes.set(stickyNote.id, stickyNote);

        // Start editing immediately
        this.startEditing(stickyNote);

        return stickyNote;
    }

    private setupStickyNoteElement(stickyNote: StickyNote): void {
        const element = stickyNote.element;
        element.className = 'sticky-note';
        element.style.position = 'absolute';
        element.style.left = `${stickyNote.x}px`;
        element.style.top = `${stickyNote.y}px`;
        element.style.width = `${stickyNote.width}px`;
        element.style.height = `${stickyNote.height}px`;
        element.style.backgroundColor = stickyNote.color;
        element.style.border = '1px solid #ddd';
        element.style.borderRadius = '8px';
        element.style.boxShadow = '2px 2px 8px rgba(0,0,0,0.2)';
        element.style.cursor = 'move';
        element.style.zIndex = '1000';
        element.style.overflow = 'hidden';

        // Create header for drag handle and controls
        const header = document.createElement('div');
        header.className = 'sticky-note-header';
        header.style.height = '25px';
        header.style.backgroundColor = 'rgba(0,0,0,0.1)';
        header.style.cursor = 'move';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.padding = '2px 5px';

        // Settings button
        const settingsBtn = document.createElement('button');
        settingsBtn.textContent = '⚙️';
        settingsBtn.style.background = 'none';
        settingsBtn.style.border = 'none';
        settingsBtn.style.cursor = 'pointer';
        settingsBtn.style.fontSize = '12px';
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showStickyNoteSettings(stickyNote);
        });

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '×';
        deleteBtn.style.background = 'none';
        deleteBtn.style.border = 'none';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.fontSize = '16px';
        deleteBtn.style.fontWeight = 'bold';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteStickyNote(stickyNote.id);
        });

        header.appendChild(settingsBtn);
        header.appendChild(deleteBtn);

        // Create text area
        const textArea = stickyNote.textArea;
        textArea.value = stickyNote.text;
        textArea.style.width = '100%';
        textArea.style.height = `${stickyNote.height - 25}px`;
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.resize = 'none';
        textArea.style.backgroundColor = 'transparent';
        textArea.style.fontFamily = stickyNote.fontFamily;
        textArea.style.fontSize = `${stickyNote.fontSize}px`;
        textArea.style.padding = '8px';
        textArea.style.display = 'none'; // Hidden by default

        // Create text display
        const textDisplay = document.createElement('div');
        textDisplay.className = 'sticky-note-text';
        textDisplay.textContent = stickyNote.text;
        textDisplay.style.padding = '8px';
        textDisplay.style.height = `${stickyNote.height - 25}px`;
        textDisplay.style.overflowY = 'auto';
        textDisplay.style.fontFamily = stickyNote.fontFamily;
        textDisplay.style.fontSize = `${stickyNote.fontSize}px`;
        textDisplay.style.whiteSpace = 'pre-wrap';
        textDisplay.style.wordWrap = 'break-word';

        // Create resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'sticky-note-resize';
        resizeHandle.style.position = 'absolute';
        resizeHandle.style.bottom = '0';
        resizeHandle.style.right = '0';
        resizeHandle.style.width = '15px';
        resizeHandle.style.height = '15px';
        resizeHandle.style.cursor = 'nw-resize';
        resizeHandle.style.backgroundColor = 'rgba(0,0,0,0.3)';
        resizeHandle.textContent = '⋰';
        resizeHandle.style.fontSize = '12px';
        resizeHandle.style.textAlign = 'center';
        resizeHandle.style.lineHeight = '15px';

        // Event listeners
        textDisplay.addEventListener('dblclick', () => this.startEditing(stickyNote));
        textArea.addEventListener('blur', () => this.stopEditing(stickyNote));
        textArea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.stopEditing(stickyNote);
            }
        });

        element.appendChild(header);
        element.appendChild(textDisplay);
        element.appendChild(textArea);
        element.appendChild(resizeHandle);
    }

    private startEditing(stickyNote: StickyNote): void {
        stickyNote.isEditing = true;
        const textDisplay = stickyNote.element.querySelector('.sticky-note-text') as HTMLElement;
        const textArea = stickyNote.textArea;

        textDisplay.style.display = 'none';
        textArea.style.display = 'block';
        textArea.focus();
        textArea.select();
    }

    private stopEditing(stickyNote: StickyNote): void {
        stickyNote.isEditing = false;
        const textDisplay = stickyNote.element.querySelector('.sticky-note-text') as HTMLElement;
        const textArea = stickyNote.textArea;

        stickyNote.text = textArea.value;
        textDisplay.textContent = stickyNote.text;

        textArea.style.display = 'none';
        textDisplay.style.display = 'block';
    }

    private showStickyNoteSettings(stickyNote: StickyNote): void {
        // Create settings modal
        const modal = document.createElement('div');
        modal.className = 'sticky-note-settings-modal';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.backgroundColor = 'white';
        modal.style.border = '2px solid #333';
        modal.style.borderRadius = '8px';
        modal.style.padding = '20px';
        modal.style.zIndex = '10000';
        modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        modal.style.maxWidth = '400px';

        const title = document.createElement('h3');
        title.textContent = 'Sticky Note Settings';
        title.style.marginTop = '0';
        modal.appendChild(title);

        // Color themes
        const colorSection = document.createElement('div');
        colorSection.innerHTML = '<h4>Color Theme:</h4>';
        const colorGrid = document.createElement('div');
        colorGrid.style.display = 'grid';
        colorGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
        colorGrid.style.gap = '8px';
        colorGrid.style.marginBottom = '15px';

        this.themes.forEach(theme => {
            const colorBtn = document.createElement('button');
            colorBtn.style.width = '40px';
            colorBtn.style.height = '40px';
            colorBtn.style.backgroundColor = theme.color;
            colorBtn.style.border = stickyNote.color === theme.color ? '3px solid #333' : '1px solid #ddd';
            colorBtn.style.borderRadius = '4px';
            colorBtn.style.cursor = 'pointer';
            colorBtn.title = theme.name;
            colorBtn.addEventListener('click', () => {
                stickyNote.color = theme.color;
                stickyNote.element.style.backgroundColor = theme.color;
                // Update border styles
                colorGrid.querySelectorAll('button').forEach(btn => {
                    (btn as HTMLElement).style.border = '1px solid #ddd';
                });
                colorBtn.style.border = '3px solid #333';
            });
            colorGrid.appendChild(colorBtn);
        });

        colorSection.appendChild(colorGrid);
        modal.appendChild(colorSection);

        // Font size
        const fontSizeSection = document.createElement('div');
        fontSizeSection.innerHTML = '<h4>Font Size:</h4>';
        const fontSizeSlider = document.createElement('input');
        fontSizeSlider.type = 'range';
        fontSizeSlider.min = '10';
        fontSizeSlider.max = '24';
        fontSizeSlider.value = stickyNote.fontSize.toString();
        fontSizeSlider.style.width = '100%';

        const fontSizeLabel = document.createElement('span');
        fontSizeLabel.textContent = `${stickyNote.fontSize}px`;

        fontSizeSlider.addEventListener('input', () => {
            const size = parseInt(fontSizeSlider.value);
            stickyNote.fontSize = size;
            fontSizeLabel.textContent = `${size}px`;
            this.updateStickyNoteStyles(stickyNote);
        });

        fontSizeSection.appendChild(fontSizeSlider);
        fontSizeSection.appendChild(fontSizeLabel);
        modal.appendChild(fontSizeSection);

        // Font family
        const fontFamilySection = document.createElement('div');
        fontFamilySection.innerHTML = '<h4>Font Family:</h4>';
        const fontSelect = document.createElement('select');
        fontSelect.style.width = '100%';
        fontSelect.style.padding = '5px';

        this.fontFamilies.forEach(font => {
            const option = document.createElement('option');
            option.value = font;
            option.textContent = font.split(',')[0];
            option.selected = stickyNote.fontFamily === font;
            fontSelect.appendChild(option);
        });

        fontSelect.addEventListener('change', () => {
            stickyNote.fontFamily = fontSelect.value;
            this.updateStickyNoteStyles(stickyNote);
        });

        fontFamilySection.appendChild(fontSelect);
        modal.appendChild(fontFamilySection);

        // Buttons
        const buttonDiv = document.createElement('div');
        buttonDiv.style.textAlign = 'right';
        buttonDiv.style.marginTop = '20px';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.padding = '8px 16px';
        closeBtn.style.marginLeft = '10px';
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        buttonDiv.appendChild(closeBtn);
        modal.appendChild(buttonDiv);

        document.body.appendChild(modal);

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    private updateStickyNoteStyles(stickyNote: StickyNote): void {
        const textDisplay = stickyNote.element.querySelector('.sticky-note-text') as HTMLElement;
        const textArea = stickyNote.textArea;

        textDisplay.style.fontFamily = stickyNote.fontFamily;
        textDisplay.style.fontSize = `${stickyNote.fontSize}px`;
        textArea.style.fontFamily = stickyNote.fontFamily;
        textArea.style.fontSize = `${stickyNote.fontSize}px`;
    }

    private handleMouseDown(e: MouseEvent): void {
        const target = e.target as HTMLElement;
        const stickyNoteElement = target.closest('.sticky-note') as HTMLElement;

        if (!stickyNoteElement) return;

        const stickyNote = this.findStickyNoteByElement(stickyNoteElement);
        if (!stickyNote) return;

        if (target.classList.contains('sticky-note-resize')) {
            this.isResizing = true;
            this.resizeElement = stickyNote;
            e.preventDefault();
        } else if (target.classList.contains('sticky-note-header') || target.closest('.sticky-note-header')) {
            this.isDragging = true;
            this.dragElement = stickyNote;
            const rect = stickyNoteElement.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();
            this.dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            e.preventDefault();
        }
    }

    private handleMouseMove(e: MouseEvent): void {
        if (this.isDragging && this.dragElement) {
            const canvasRect = this.canvas.getBoundingClientRect();
            const newX = e.clientX - canvasRect.left - this.dragOffset.x;
            const newY = e.clientY - canvasRect.top - this.dragOffset.y;

            this.dragElement.x = Math.max(0, Math.min(newX, canvasRect.width - this.dragElement.width));
            this.dragElement.y = Math.max(0, Math.min(newY, canvasRect.height - this.dragElement.height));

            this.dragElement.element.style.left = `${this.dragElement.x}px`;
            this.dragElement.element.style.top = `${this.dragElement.y}px`;
        } else if (this.isResizing && this.resizeElement) {
            const canvasRect = this.canvas.getBoundingClientRect();
            const newWidth = Math.max(100, e.clientX - canvasRect.left - this.resizeElement.x);
            const newHeight = Math.max(80, e.clientY - canvasRect.top - this.resizeElement.y);

            this.resizeElement.width = newWidth;
            this.resizeElement.height = newHeight;

            this.resizeElement.element.style.width = `${newWidth}px`;
            this.resizeElement.element.style.height = `${newHeight}px`;

            // Update text area height
            this.resizeElement.textArea.style.height = `${newHeight - 25}px`;
            const textDisplay = this.resizeElement.element.querySelector('.sticky-note-text') as HTMLElement;
            textDisplay.style.height = `${newHeight - 25}px`;
        }
    }

    private handleMouseUp(): void {
        this.isDragging = false;
        this.dragElement = null;
        this.isResizing = false;
        this.resizeElement = null;
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (e.altKey && e.key === 's') {
            e.preventDefault();
            this.createStickyNote();
        }
    }

    private findStickyNoteByElement(element: HTMLElement): StickyNote | null {
        for (const stickyNote of this.stickyNotes.values()) {
            if (stickyNote.element === element) {
                return stickyNote;
            }
        }
        return null;
    }

    public deleteStickyNote(id: number): void {
        const stickyNote = this.stickyNotes.get(id);
        if (!stickyNote) return;

        if (confirm('Delete this sticky note?')) {
            this.canvas.removeChild(stickyNote.element);
            this.stickyNotes.delete(id);
        }
    }

    // Data persistence methods
    public getStickyNotesData(): StickyNoteData[] {
        return Array.from(this.stickyNotes.values()).map(note => ({
            id: note.id,
            text: note.text,
            x: note.x,
            y: note.y,
            width: note.width,
            height: note.height,
            color: note.color,
            fontSize: note.fontSize,
            fontFamily: note.fontFamily
        }));
    }

    public loadStickyNotesData(data: StickyNoteData[]): void {
        // Clear existing sticky notes
        this.clearAllStickyNotes();

        // Load sticky notes from data
        data.forEach(noteData => {
            const stickyNote: StickyNote = {
                ...noteData,
                element: document.createElement('div'),
                textArea: document.createElement('textarea'),
                isEditing: false
            };

            this.setupStickyNoteElement(stickyNote);
            this.canvas.appendChild(stickyNote.element);
            this.stickyNotes.set(stickyNote.id, stickyNote);

            // Update next ID
            if (stickyNote.id >= this.nextStickyNoteId) {
                this.nextStickyNoteId = stickyNote.id + 1;
            }
        });
    }

    public clearAllStickyNotes(): void {
        this.stickyNotes.forEach(note => {
            this.canvas.removeChild(note.element);
        });
        this.stickyNotes.clear();
    }

    public exportStickyNotes(): string {
        return JSON.stringify(this.getStickyNotesData(), null, 2);
    }

    public importStickyNotes(jsonData: string): void {
        try {
            const data = JSON.parse(jsonData) as StickyNoteData[];
            this.loadStickyNotesData(data);
        } catch (error) {
            console.error('Failed to import sticky notes:', error);
            alert('Invalid sticky notes data format');
        }
    }
}
