// TypeScript interfaces and types for the Mindmap application

interface Position {
    x: number;
    y: number;
}

interface DragOffset {
    x: number;
    y: number;
}

interface MindmapNode {
    id: number;
    text: string;
    parentId: number | null;
    x: number;
    y: number;
    element: HTMLDivElement;
    noteDisplay: HTMLDivElement;
    note: string;
}

interface Connection {
    parentId: number;
    childId: number;
}

interface MindmapData {
    nodes: {
        id: number;
        text: string;
        parentId: number | null;
        x: number;
        y: number;
        note: string;
    }[];
    connections: Connection[];
    exportDate?: string;
}

interface CanvasOffset {
    x: number;
    y: number;
}

interface SessionData extends MindmapData {
    nodeIdCounter: number;
    notesVisible: boolean;
    lastSaved: string;
    canvasOffset?: CanvasOffset;
}

type Theme = 'modern' | 'roman';
type NavigationDirection = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

class MindmapApp {
    private nodes: MindmapNode[] = [];
    private connections: Connection[] = [];
    private selectedNode: MindmapNode | null = null;
    private nodeIdCounter: number = 0;
    private isDragging: boolean = false;
    private dragOffset: DragOffset = { x: 0, y: 0 };
    private currentNoteNode: MindmapNode | null = null;
    private notesVisible: boolean = false;
    private currentTheme: Theme = 'modern';
    private autoSaveInterval: number | null = null;

    // Canvas panning state
    private isCanvasPanning: boolean = false;
    private canvasOffset: CanvasOffset = { x: 0, y: 0 };
    private canvasDragStart: Position = { x: 0, y: 0 };

    // DOM elements
    private nodesContainer!: HTMLElement;
    private mindmapContainer!: HTMLElement;
    private svg!: SVGElement;
    private helpModal!: HTMLElement;
    private noteModal!: HTMLElement;
    private noteTextarea!: HTMLTextAreaElement;

    constructor() {
        this.initializeApp();
        this.setupEventListeners();
        this.loadTheme();
        this.loadSession();
        this.startAutoSave();
    }

    private initializeApp(): void {
        this.nodesContainer = this.getElementByIdSafe('nodesContainer');
        this.mindmapContainer = this.getElementByIdSafe('mindmapContainer');
        this.svg = this.getElementByIdSafe('mindmapSvg') as unknown as SVGElement;
        this.helpModal = this.getElementByIdSafe('helpModal');
        this.noteModal = this.getElementByIdSafe('noteModal');
        this.noteTextarea = this.getElementByIdSafe('noteTextarea') as HTMLTextAreaElement;
    }

    private getElementByIdSafe(id: string): HTMLElement {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Element with id "${id}" not found`);
        }
        return element;
    }

    private setupEventListeners(): void {
        // Keyboard events
        document.addEventListener('keydown', (e: KeyboardEvent) => this.handleKeyDown(e));

        // Button events
        this.getElementByIdSafe('themeBtn').addEventListener('click', () => this.toggleTheme());
        this.getElementByIdSafe('toggleNotesBtn').addEventListener('click', () => this.toggleNotesVisibility());
        this.getElementByIdSafe('resetCanvasBtn').addEventListener('click', () => this.resetCanvasPosition());
        this.getElementByIdSafe('saveBtn').addEventListener('click', () => this.saveMindmap());
        this.getElementByIdSafe('loadBtn').addEventListener('click', () => this.loadMindmap());
        this.getElementByIdSafe('exportBtn').addEventListener('click', () => this.exportMindmap());
        this.getElementByIdSafe('helpBtn').addEventListener('click', () => this.showHelp());
        this.getElementByIdSafe('fileInput').addEventListener('change', (e: Event) => this.handleFileLoad(e));

        // Modal events
        const closeBtn = document.querySelector('.close');
        const noteCloseBtn = document.querySelector('.note-close');

        if (closeBtn) closeBtn.addEventListener('click', () => this.hideHelp());
        if (noteCloseBtn) noteCloseBtn.addEventListener('click', () => this.hideNoteModal());

        this.getElementByIdSafe('saveNoteBtn').addEventListener('click', () => this.saveNote());
        this.getElementByIdSafe('cancelNoteBtn').addEventListener('click', () => this.hideNoteModal());

        // Click outside modal to close
        window.addEventListener('click', (e: Event) => {
            if (e.target === this.helpModal) this.hideHelp();
            if (e.target === this.noteModal) this.hideNoteModal();
        });

        // Mouse events for dragging
        document.addEventListener('mousemove', (e: MouseEvent) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e: MouseEvent) => this.handleMouseUp(e));

        // Canvas panning events
        this.mindmapContainer.addEventListener('mousedown', (e: MouseEvent) => this.handleCanvasMouseDown(e));
        document.addEventListener('contextmenu', (e: Event) => {
            // Prevent context menu on middle mouse button
            if ((e as MouseEvent).button === 1) {
                e.preventDefault();
            }
        });

        // Canvas panning events
        this.mindmapContainer.addEventListener('mousedown', (e: MouseEvent) => this.handleCanvasMouseDown(e));
        document.addEventListener('contextmenu', (e: Event) => {
            // Prevent context menu on middle mouse button
            if ((e as MouseEvent).button === 1) {
                e.preventDefault();
            }
        });
    }

    private createRootNode(): void {
        const rootNode = this.createNode('Root Node', null, 400, 300);
        rootNode.element.classList.add('root');
        this.selectNode(rootNode);
    }

    private createNode(text: string, parentId: number | null, x: number, y: number): MindmapNode {
        const nodeId = this.nodeIdCounter++;
        const nodeElement = document.createElement('div');
        nodeElement.className = 'mindmap-node';
        nodeElement.style.left = x + 'px';
        nodeElement.style.top = y + 'px';
        nodeElement.dataset.nodeId = nodeId.toString();

        const input = document.createElement('input');
        input.type = 'text';
        input.value = text;
        input.addEventListener('blur', () => this.updateNodeText(nodeId, input.value));
        input.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        });

        nodeElement.appendChild(input);
        this.nodesContainer.appendChild(nodeElement);

        // Create note display element
        const noteDisplay = document.createElement('div');
        noteDisplay.className = 'note-display';
        noteDisplay.dataset.nodeId = nodeId.toString();
        this.nodesContainer.appendChild(noteDisplay);

        // Node events
        nodeElement.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            this.selectNode(this.findNodeById(nodeId));
        });

        nodeElement.addEventListener('dblclick', (e: Event) => {
            e.stopPropagation();
            this.showNoteModal(nodeId);
        });

        nodeElement.addEventListener('mousedown', (e: MouseEvent) => this.startDrag(e, nodeId));

        const node: MindmapNode = {
            id: nodeId,
            text: text,
            parentId: parentId,
            x: x,
            y: y,
            element: nodeElement,
            noteDisplay: noteDisplay,
            note: ''
        };

        this.nodes.push(node);

        if (parentId !== null) {
            this.connections.push({ parentId, childId: nodeId });
        }

        this.updateConnections();
        this.updateNotePosition(node);
        this.saveSession(); // Auto-save after creating a node
        return node;
    }

    private findNodeById(id: number): MindmapNode | undefined {
        return this.nodes.find(node => node.id === id);
    }

    private selectNode(node: MindmapNode | undefined): void {
        // Remove selection from all nodes
        this.nodes.forEach(n => n.element.classList.remove('selected'));

        if (node) {
            node.element.classList.add('selected');
            this.selectedNode = node;
            const input = node.element.querySelector('input');
            if (input) input.focus();
        }
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (!this.selectedNode) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                this.createChildNode();
            } else {
                this.createSiblingNode();
            }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            const target = e.target as HTMLElement;
            if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                this.deleteNode();
            }
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
            e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const target = e.target as HTMLElement;
            if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                this.navigateNodes(e.key as NavigationDirection);
            }
        }
    }

    private createSiblingNode(): void {
        if (!this.selectedNode || this.selectedNode.parentId === null) {
            // If root node, create child instead
            this.createChildNode();
            return;
        }

        const parent = this.findNodeById(this.selectedNode.parentId);
        if (!parent) return;

        const siblings = this.nodes.filter(n => n.parentId === parent.id);
        const newY = this.selectedNode.y + 80;

        const newNode = this.createNode('New Node', parent.id, this.selectedNode.x, newY);
        this.selectNode(newNode);
    }

    private createChildNode(): void {
        if (!this.selectedNode) return;

        const children = this.nodes.filter(n => n.parentId === this.selectedNode!.id);
        const newX = this.selectedNode.x + 200;
        const newY = this.selectedNode.y + (children.length * 80);

        const newNode = this.createNode('New Node', this.selectedNode.id, newX, newY);
        this.selectNode(newNode);
    }

    private deleteNode(): void {
        if (!this.selectedNode || this.selectedNode.parentId === null) {
            alert('Cannot delete the root node');
            return;
        }

        // Remove all children recursively
        this.deleteNodeAndChildren(this.selectedNode.id);

        // Select parent or first available node
        const parent = this.findNodeById(this.selectedNode.parentId!);
        this.selectNode(parent || this.nodes[0]);
        this.saveSession(); // Auto-save after deletion
    }

    private deleteNodeAndChildren(nodeId: number): void {
        const children = this.nodes.filter(n => n.parentId === nodeId);
        children.forEach(child => this.deleteNodeAndChildren(child.id));

        const node = this.findNodeById(nodeId);
        if (node) {
            node.element.remove();
            node.noteDisplay.remove();
            this.nodes = this.nodes.filter(n => n.id !== nodeId);
            this.connections = this.connections.filter(c => c.childId !== nodeId && c.parentId !== nodeId);
        }
    }

    private navigateNodes(direction: NavigationDirection): void {
        if (!this.selectedNode) return;

        let targetNode: MindmapNode | undefined = undefined;
        const current = this.selectedNode;

        switch (direction) {
            case 'ArrowUp':
                targetNode = this.findClosestNode(current, 'up');
                break;
            case 'ArrowDown':
                targetNode = this.findClosestNode(current, 'down');
                break;
            case 'ArrowLeft':
                targetNode = this.findNodeById(current.parentId!) || this.findClosestNode(current, 'left');
                break;
            case 'ArrowRight':
                const children = this.nodes.filter(n => n.parentId === current.id);
                targetNode = children[0] || this.findClosestNode(current, 'right');
                break;
        }

        if (targetNode) {
            this.selectNode(targetNode);
        }
    }

    private findClosestNode(current: MindmapNode, direction: 'up' | 'down' | 'left' | 'right'): MindmapNode | undefined {
        let closestNode: MindmapNode | undefined = undefined;
        let minDistance = Infinity;

        this.nodes.forEach(node => {
            if (node.id === current.id) return;

            const dx = node.x - current.x;
            const dy = node.y - current.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            let validDirection = false;
            switch (direction) {
                case 'up': validDirection = dy < -20; break;
                case 'down': validDirection = dy > 20; break;
                case 'left': validDirection = dx < -20; break;
                case 'right': validDirection = dx > 20; break;
            }

            if (validDirection && distance < minDistance) {
                minDistance = distance;
                closestNode = node;
            }
        });

        return closestNode;
    }

    private updateNodeText(nodeId: number, text: string): void {
        const node = this.findNodeById(nodeId);
        if (node) {
            node.text = text;
            this.saveSession(); // Auto-save after text change
        }
    }

    private startDrag(e: MouseEvent, nodeId: number): void {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT') return;

        this.isDragging = true;
        const node = this.findNodeById(nodeId);
        if (!node) return;

        this.selectNode(node);

        const rect = node.element.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;

        e.preventDefault();
    }

    private handleMouseMove(e: MouseEvent): void {
        if (this.isCanvasPanning) {
            // Handle canvas panning
            const deltaX = e.clientX - this.canvasDragStart.x;
            const deltaY = e.clientY - this.canvasDragStart.y;

            this.canvasOffset.x += deltaX;
            this.canvasOffset.y += deltaY;

            this.applyCanvasTransform();

            this.canvasDragStart.x = e.clientX;
            this.canvasDragStart.y = e.clientY;

            return;
        }

        if (!this.isDragging || !this.selectedNode) return;

        const containerRect = this.nodesContainer.getBoundingClientRect();
        const newX = e.clientX - containerRect.left - this.dragOffset.x;
        const newY = e.clientY - containerRect.top - this.dragOffset.y;

        this.selectedNode.x = Math.max(0, newX);
        this.selectedNode.y = Math.max(0, newY);

        this.selectedNode.element.style.left = this.selectedNode.x + 'px';
        this.selectedNode.element.style.top = this.selectedNode.y + 'px';

        this.updateConnections();
        this.updateNotePosition(this.selectedNode);
        this.saveSession(); // Auto-save after moving
    }

    private handleMouseUp(e: MouseEvent): void {
        if (this.isCanvasPanning) {
            this.isCanvasPanning = false;
            this.mindmapContainer.style.cursor = '';
            this.saveSession(); // Auto-save after canvas panning
        }
        this.isDragging = false;
    }

    private updateConnections(): void {
        // Clear existing lines
        this.svg.innerHTML = '';

        this.connections.forEach(connection => {
            const parent = this.findNodeById(connection.parentId);
            const child = this.findNodeById(connection.childId);

            if (parent && child) {
                this.drawConnection(parent, child);
            }
        });
    }

    private drawConnection(parent: MindmapNode, child: MindmapNode): void {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        const startX = parent.x + parent.element.offsetWidth / 2;
        const startY = parent.y + parent.element.offsetHeight / 2;
        const endX = child.x + child.element.offsetWidth / 2;
        const endY = child.y + child.element.offsetHeight / 2;

        const midX = (startX + endX) / 2;

        const pathData = `M ${startX} ${startY} Q ${midX} ${startY} ${endX} ${endY}`;

        line.setAttribute('d', pathData);
        line.setAttribute('class', 'connection-line');

        this.svg.appendChild(line);
    }

    private showNoteModal(nodeId: number): void {
        const node = this.findNodeById(nodeId);
        if (!node) return;

        this.currentNoteNode = node;
        this.noteTextarea.value = node.note || '';
        this.noteModal.style.display = 'block';
        this.noteTextarea.focus();
    }

    private hideNoteModal(): void {
        this.noteModal.style.display = 'none';
        this.currentNoteNode = null;
    }

    private saveNote(): void {
        if (this.currentNoteNode) {
            this.currentNoteNode.note = this.noteTextarea.value;

            // Update visual indicator
            if (this.noteTextarea.value.trim()) {
                this.currentNoteNode.element.classList.add('has-note');
            } else {
                this.currentNoteNode.element.classList.remove('has-note');
            }

            // Update note display
            this.updateNoteDisplay(this.currentNoteNode);
        }
        this.hideNoteModal();
        this.saveSession(); // Auto-save after note change
    }

    private toggleNotesVisibility(): void {
        this.notesVisible = !this.notesVisible;
        const toggleBtn = this.getElementByIdSafe('toggleNotesBtn');

        if (this.notesVisible) {
            toggleBtn.textContent = 'Hide Notes';
            this.showAllNotes();
        } else {
            toggleBtn.textContent = 'Show Notes';
            this.hideAllNotes();
        }
    }

    private showAllNotes(): void {
        this.nodes.forEach(node => {
            if (node.note && node.note.trim()) {
                node.noteDisplay.classList.add('visible');
            }
        });
    }

    private hideAllNotes(): void {
        this.nodes.forEach(node => {
            node.noteDisplay.classList.remove('visible');
        });
    }

    private updateNoteDisplay(node: MindmapNode): void {
        if (node.note && node.note.trim()) {
            node.noteDisplay.textContent = node.note;
            node.noteDisplay.classList.remove('empty');
            if (this.notesVisible) {
                node.noteDisplay.classList.add('visible');
            }
        } else {
            node.noteDisplay.textContent = '';
            node.noteDisplay.classList.add('empty');
            node.noteDisplay.classList.remove('visible');
        }
    }

    private updateNotePosition(node: MindmapNode): void {
        // Position note display to the right of the node
        const noteX = node.x + node.element.offsetWidth + 10;
        const noteY = node.y;

        node.noteDisplay.style.left = noteX + 'px';
        node.noteDisplay.style.top = noteY + 'px';
    }

    private showHelp(): void {
        this.helpModal.style.display = 'block';
    }

    private hideHelp(): void {
        this.helpModal.style.display = 'none';
    }

    private saveMindmap(): void {
        const mindmapData: MindmapData = {
            nodes: this.nodes.map(node => ({
                id: node.id,
                text: node.text,
                parentId: node.parentId,
                x: node.x,
                y: node.y,
                note: node.note
            })),
            connections: this.connections
        };

        const dataStr = JSON.stringify(mindmapData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'mindmap.json';
        link.click();
    }

    private loadMindmap(): void {
        this.getElementByIdSafe('fileInput').click();
    }

    private handleFileLoad(e: Event): void {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event: ProgressEvent<FileReader>) => {
            try {
                const result = event.target?.result;
                if (typeof result === 'string') {
                    const mindmapData: MindmapData = JSON.parse(result);
                    this.loadMindmapData(mindmapData);
                }
            } catch (error) {
                alert('Error loading mindmap file: ' + (error as Error).message);
            }
        };
        reader.readAsText(file);
    }

    private loadMindmapData(data: MindmapData): void {
        // Clear existing mindmap
        this.nodes.forEach(node => {
            node.element.remove();
            node.noteDisplay.remove();
        });
        this.nodes = [];
        this.connections = [];
        this.svg.innerHTML = '';

        // Load nodes
        data.nodes.forEach(nodeData => {
            const nodeElement = document.createElement('div');
            nodeElement.className = 'mindmap-node';
            nodeElement.style.left = nodeData.x + 'px';
            nodeElement.style.top = nodeData.y + 'px';
            nodeElement.dataset.nodeId = nodeData.id.toString();

            if (nodeData.parentId === null) {
                nodeElement.classList.add('root');
            }

            if (nodeData.note && nodeData.note.trim()) {
                nodeElement.classList.add('has-note');
            }

            const input = document.createElement('input');
            input.type = 'text';
            input.value = nodeData.text;
            input.addEventListener('blur', () => this.updateNodeText(nodeData.id, input.value));
            input.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    input.blur();
                }
            });

            nodeElement.appendChild(input);
            this.nodesContainer.appendChild(nodeElement);

            // Create note display element
            const noteDisplay = document.createElement('div');
            noteDisplay.className = 'note-display';
            noteDisplay.dataset.nodeId = nodeData.id.toString();
            this.nodesContainer.appendChild(noteDisplay);

            // Node events
            nodeElement.addEventListener('click', (e: Event) => {
                e.stopPropagation();
                this.selectNode(this.findNodeById(nodeData.id));
            });

            nodeElement.addEventListener('dblclick', (e: Event) => {
                e.stopPropagation();
                this.showNoteModal(nodeData.id);
            });

            nodeElement.addEventListener('mousedown', (e: MouseEvent) => this.startDrag(e, nodeData.id));

            const node: MindmapNode = {
                id: nodeData.id,
                text: nodeData.text,
                parentId: nodeData.parentId,
                x: nodeData.x,
                y: nodeData.y,
                element: nodeElement,
                noteDisplay: noteDisplay,
                note: nodeData.note || ''
            };

            this.nodes.push(node);

            // Update note display
            this.updateNoteDisplay(node);
            this.updateNotePosition(node);
        });

        // Load connections
        this.connections = data.connections || [];

        // Update counter
        this.nodeIdCounter = Math.max(...this.nodes.map(n => n.id)) + 1;

        // Update visual connections
        this.updateConnections();

        // Select root node
        const rootNode = this.nodes.find(n => n.parentId === null);
        if (rootNode) {
            this.selectNode(rootNode);
        }
    }

    private exportMindmap(): void {
        const mindmapData: MindmapData = {
            nodes: this.nodes.map(node => ({
                id: node.id,
                text: node.text,
                parentId: node.parentId,
                x: node.x,
                y: node.y,
                note: node.note
            })),
            connections: this.connections,
            exportDate: new Date().toISOString()
        };

        const dataStr = JSON.stringify(mindmapData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `mindmap-export-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }

    // Session Management
    private saveSession(): void {
        const sessionData: SessionData = {
            nodes: this.nodes.map(node => ({
                id: node.id,
                text: node.text,
                parentId: node.parentId,
                x: node.x,
                y: node.y,
                note: node.note
            })),
            connections: this.connections,
            nodeIdCounter: this.nodeIdCounter,
            notesVisible: this.notesVisible,
            lastSaved: new Date().toISOString(),
            canvasOffset: this.canvasOffset
        };

        localStorage.setItem('mindmap-session', JSON.stringify(sessionData));
    }

    private loadSession(): void {
        const sessionData = localStorage.getItem('mindmap-session');
        if (sessionData) {
            try {
                const data: SessionData = JSON.parse(sessionData);
                if (data.nodes && data.nodes.length > 0) {
                    this.loadMindmapData(data);

                    // Restore canvas offset
                    if (data.canvasOffset) {
                        this.canvasOffset = data.canvasOffset;
                        this.applyCanvasTransform();
                    }

                    // Restore notes visibility state
                    if (data.notesVisible) {
                        this.notesVisible = true;
                        this.getElementByIdSafe('toggleNotesBtn').textContent = 'Hide Notes';
                        this.showAllNotes();
                    }

                    console.log('Session restored from:', data.lastSaved);
                    return;
                }
            } catch (error) {
                console.error('Error loading session:', error);
            }
        }

        // Create default root node if no session data
        this.createRootNode();
    }

    private clearSession(): void {
        localStorage.removeItem('mindmap-session');
    }

    private startAutoSave(): void {
        // Auto-save every 30 seconds
        this.autoSaveInterval = window.setInterval(() => {
            if (this.nodes.length > 0) {
                this.saveSession();
            }
        }, 30000);
    }

    // Theme Management
    private toggleTheme(): void {
        this.currentTheme = this.currentTheme === 'modern' ? 'roman' : 'modern';
        this.applyTheme();
        this.saveTheme();
    }

    private applyTheme(): void {
        const body = document.body;
        const themeBtn = this.getElementByIdSafe('themeBtn');

        if (this.currentTheme === 'roman') {
            body.classList.add('roman-theme');
            themeBtn.textContent = 'Modern Theme';
        } else {
            body.classList.remove('roman-theme');
            themeBtn.textContent = 'Roman Theme';
        }
    }

    private saveTheme(): void {
        localStorage.setItem('mindmap-theme', this.currentTheme);
    }

    private loadTheme(): void {
        const savedTheme = localStorage.getItem('mindmap-theme');
        if (savedTheme && (savedTheme === 'modern' || savedTheme === 'roman')) {
            this.currentTheme = savedTheme as Theme;
        }
        this.applyTheme();
    }

    private handleCanvasMouseDown(e: MouseEvent): void {
        // Only handle middle mouse button (button 1) for canvas panning
        if (e.button === 1) {
            e.preventDefault();
            this.isCanvasPanning = true;
            this.canvasDragStart.x = e.clientX;
            this.canvasDragStart.y = e.clientY;
            this.mindmapContainer.style.cursor = 'grabbing';
        }
    }

    private applyCanvasTransform(): void {
        const transform = `translate(${this.canvasOffset.x}px, ${this.canvasOffset.y}px)`;
        this.nodesContainer.style.transform = transform;
        this.svg.style.transform = transform;
    }

    private resetCanvasPosition(): void {
        this.canvasOffset.x = 0;
        this.canvasOffset.y = 0;
        this.applyCanvasTransform();
        this.saveSession();
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MindmapApp();
});
