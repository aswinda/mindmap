// Import sticky notes module
import { FileManager } from './fileManager.js';
import { StickyNotesManager } from './stickyNotes.js';

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
    parentId: number | null; // Keep for backward compatibility
    x: number;
    y: number;
    element: HTMLDivElement;
    noteDisplay: HTMLDivElement;
    note: string;
    isRoot: boolean; // New: mark if this is a root node
    color?: string; // Node background color
    shape?: 'rectangle' | 'circle' | 'diamond'; // Node shape
}

interface Connection {
    fromId: number; // Changed from parentId to be more flexible
    toId: number;   // Changed from childId to be more flexible
    type: 'hierarchical' | 'neural'; // New: connection type
}

interface MindmapData {
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
    stickyNotes?: any[]; // Add sticky notes data
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
    private stickyNotesManager: StickyNotesManager | null = null;
    private fileManager: FileManager | null = null;

    // Neural connection mode
    private isConnectionMode: boolean = false;
    private connectionStartNode: MindmapNode | null = null;
    private isRemoveConnectionMode: boolean = false;

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
        this.initializeFileManager();
        this.setupEventListeners();
        this.loadTheme();
        this.initializeStickyNotes();
        // Start with a new file instead of loading session
        this.createNewFile();
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
        // File Management
        this.getElementByIdSafe('newFileBtn').addEventListener('click', () => {
            this.createNewFile();
        });
        this.getElementByIdSafe('openFileBtn').addEventListener('click', () => {
            this.openFile();
        });
        this.getElementByIdSafe('saveAsBtn').addEventListener('click', () => {
            this.saveAsFile();
        });

        // Existing Controls
        this.getElementByIdSafe('themeBtn').addEventListener('click', () => this.toggleTheme());
        this.getElementByIdSafe('toggleNotesBtn').addEventListener('click', () => this.toggleNotesVisibility());
        this.getElementByIdSafe('resetCanvasBtn').addEventListener('click', () => this.resetCanvasPosition());
        this.getElementByIdSafe('connectionModeBtn').addEventListener('click', () => this.toggleConnectionMode());
        this.getElementByIdSafe('removeConnectionBtn').addEventListener('click', () => this.toggleRemoveConnectionMode());
        this.getElementByIdSafe('exportBtn').addEventListener('click', () => this.exportMindmap());
        this.getElementByIdSafe('helpBtn').addEventListener('click', () => this.showHelp());

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
        this.mindmapContainer.addEventListener('dblclick', (e: MouseEvent) => this.handleCanvasDoubleClick(e));
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
            } else if (e.key === 'Escape') {
                input.blur();
                e.preventDefault();
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
            if (this.isConnectionMode) {
                this.handleNeuralConnection(this.findNodeById(nodeId)!);
            } else {
                this.selectNode(this.findNodeById(nodeId));
                // Focus input only if clicking directly on it
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT') {
                    (target as HTMLInputElement).focus();
                }
            }
        });

        nodeElement.addEventListener('dblclick', (e: Event) => {
            e.stopPropagation();
            const target = e.target as HTMLElement;
            if (target.tagName !== 'INPUT') {
                // Double-click on node but not input - show note modal
                this.showNoteModal(nodeId);
            }
        });

        // Add separate event for when user wants to edit text
        input.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            input.focus();
        });

        nodeElement.addEventListener('mousedown', (e: MouseEvent) => this.startDrag(e, nodeId));

        // Right-click context menu for node customization
        nodeElement.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();
            this.showNodeCustomizationMenu(nodeId);
        });

        const node: MindmapNode = {
            id: nodeId,
            text: text,
            parentId: parentId,
            x: x,
            y: y,
            element: nodeElement,
            noteDisplay: noteDisplay,
            note: '',
            isRoot: parentId === null,
            color: '#ffffff', // Default color
            shape: 'rectangle' // Default shape
        };

        this.nodes.push(node);

        // Apply default styling
        this.applyNodeStyling(node);

        if (parentId !== null) {
            this.connections.push({
                fromId: parentId,
                toId: nodeId,
                type: 'hierarchical'
            });
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
            // Don't auto-focus the input to allow delete key to work for node deletion
            // Input will be focused only when user clicks directly on it
        }
    }

    private handleKeyDown(e: KeyboardEvent): void {
        // File operation shortcuts (global)
        if (e.key === 'n' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
            e.preventDefault();
            this.createNewFile();
            return;
        }
        if (e.key === 'o' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.openFile();
            return;
        }
        if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (e.shiftKey) {
                this.saveAsFile();
            } else {
                this.saveCurrentFile();
            }
            return;
        }

        if (!this.selectedNode) {
            // Global shortcuts that work without selection
            if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.createMultipleRootNodes();
                return;
            }
            if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.toggleConnectionMode();
                return;
            }
            return;
        }

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
            } else if (target.tagName === 'INPUT') {
                // If input is empty or all text is selected, delete the node instead
                const input = target as HTMLInputElement;
                const isEmpty = input.value.trim() === '';
                const isAllSelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;

                if (isEmpty || isAllSelected) {
                    e.preventDefault();
                    this.deleteNode();
                }
            }
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
            e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const target = e.target as HTMLElement;
            if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                this.navigateNodes(e.key as NavigationDirection);
            }
        } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.toggleConnectionMode();
        } else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.toggleRemoveConnectionMode();
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
        if (!this.selectedNode) return;

        // Check if this is the last root node
        const rootNodes = this.nodes.filter(n => n.isRoot);
        if (this.selectedNode.isRoot && rootNodes.length === 1) {
            alert('Cannot delete the last root node');
            return;
        }

        // Remove all children recursively (for hierarchical connections)
        this.deleteNodeAndChildren(this.selectedNode.id);

        // Select another node
        const remainingNodes = this.nodes.filter(n => n.id !== this.selectedNode!.id);
        if (remainingNodes.length > 0) {
            // Try to select a parent, sibling, or any remaining node
            const parentConnection = this.connections.find(c => c.toId === this.selectedNode!.id && c.type === 'hierarchical');
            const parent = parentConnection ? this.findNodeById(parentConnection.fromId) : null;
            this.selectNode(parent || remainingNodes[0]);
        } else {
            this.selectedNode = null;
        }

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
            this.connections = this.connections.filter(c => c.toId !== nodeId && c.fromId !== nodeId);
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
                // Find parent via connections
                const parentConnection = this.connections.find(c => c.toId === current.id && c.type === 'hierarchical');
                targetNode = parentConnection ? this.findNodeById(parentConnection.fromId) : this.findClosestNode(current, 'left');
                break;
            case 'ArrowRight':
                // Find children via connections
                const childConnections = this.connections.filter(c => c.fromId === current.id && c.type === 'hierarchical');
                targetNode = childConnections[0] ? this.findNodeById(childConnections[0].toId) : this.findClosestNode(current, 'right');
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
            const fromNode = this.findNodeById(connection.fromId);
            const toNode = this.findNodeById(connection.toId);

            if (fromNode && toNode) {
                this.drawConnection(fromNode, toNode, connection.type);
            }
        });
    }

    private drawConnection(fromNode: MindmapNode, toNode: MindmapNode, connectionType: 'hierarchical' | 'neural' = 'hierarchical'): void {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        const startX = fromNode.x + fromNode.element.offsetWidth / 2;
        const startY = fromNode.y + fromNode.element.offsetHeight / 2;
        const endX = toNode.x + toNode.element.offsetWidth / 2;
        const endY = toNode.y + toNode.element.offsetHeight / 2;

        const midX = (startX + endX) / 2;

        const pathData = `M ${startX} ${startY} Q ${midX} ${startY} ${endX} ${endY}`;

        line.setAttribute('d', pathData);
        line.setAttribute('class', connectionType === 'neural' ? 'neural-connection-line' : 'connection-line');

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
                note: node.note,
                isRoot: node.isRoot,
                color: node.color,
                shape: node.shape
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
                } else if (e.key === 'Escape') {
                    input.blur();
                    e.preventDefault();
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
                if (this.isConnectionMode) {
                    this.handleNeuralConnection(this.findNodeById(nodeData.id)!);
                } else {
                    this.selectNode(this.findNodeById(nodeData.id));
                    // Focus input only if clicking directly on it
                    const target = e.target as HTMLElement;
                    if (target.tagName === 'INPUT') {
                        (target as HTMLInputElement).focus();
                    }
                }
            });

            nodeElement.addEventListener('dblclick', (e: Event) => {
                e.stopPropagation();
                const target = e.target as HTMLElement;
                if (target.tagName !== 'INPUT') {
                    // Double-click on node but not input - show note modal
                    this.showNoteModal(nodeData.id);
                }
            });

            // Add separate event for when user wants to edit text
            input.addEventListener('click', (e: Event) => {
                e.stopPropagation();
                input.focus();
            });

            nodeElement.addEventListener('mousedown', (e: MouseEvent) => this.startDrag(e, nodeData.id));

            // Right-click context menu for node customization
            nodeElement.addEventListener('contextmenu', (e: MouseEvent) => {
                e.preventDefault();
                this.showNodeCustomizationMenu(nodeData.id);
            });

            const node: MindmapNode = {
                id: nodeData.id,
                text: nodeData.text,
                parentId: nodeData.parentId,
                x: nodeData.x,
                y: nodeData.y,
                element: nodeElement,
                noteDisplay: noteDisplay,
                note: nodeData.note || '',
                isRoot: nodeData.isRoot || nodeData.parentId === null,
                color: nodeData.color || '#ffffff',
                shape: nodeData.shape || 'rectangle'
            };

            this.nodes.push(node);

            // Apply styling
            this.applyNodeStyling(node);

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
                note: node.note,
                isRoot: node.isRoot,
                color: node.color,
                shape: node.shape
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

    // File Management Methods
    private initializeFileManager(): void {
        try {
            this.fileManager = new FileManager();

            // Set up file manager callbacks
            this.fileManager.setCallbacks(
                (fileData) => {
                    this.onFileChanged(fileData);
                },
                (status) => {
                    this.onSaveStatusChanged(status);
                },
                () => {
                    // Auto-save callback - return current mindmap data
                    return this.getCurrentMindmapData();
                }
            );
        } catch (error) {
            console.error('Error initializing FileManager:', error);
        }
    }

    private createNewFile(): void {
        if (!this.fileManager) {
            console.error('FileManager not initialized');
            return;
        }

        // Create new file with current mindmap data
        const currentData = this.getCurrentMindmapData();
        const fileData = this.fileManager.createNewFile(currentData);

        // Reset the mindmap
        this.clearMindmap();
        this.createRootNode();

        // Update UI
        this.updateFileDisplay();
    }

    private async openFile(): Promise<void> {
        if (!this.fileManager) return;

        const fileData = await this.fileManager.openFile();
        if (fileData) {
            this.loadMindmapFromFileData(fileData);
            this.updateFileDisplay();
        }
    }

    private async saveAsFile(): Promise<void> {
        if (!this.fileManager) return;

        const currentData = this.getCurrentMindmapData();
        const success = await this.fileManager.saveAsFile(currentData);
        if (success) {
            this.updateFileDisplay();
        }
    }

    private async saveCurrentFile(): Promise<void> {
        if (!this.fileManager) return;

        const currentData = this.getCurrentMindmapData();
        await this.fileManager.saveCurrentFile(currentData);
    }

    private onFileChanged(fileData: any): void {
        if (fileData) {
            this.loadMindmapFromFileData(fileData);
        }
        this.updateFileDisplay();
    }

    private onSaveStatusChanged(status: string): void {
        const saveStatusElement = document.getElementById('saveStatus');
        if (saveStatusElement) {
            saveStatusElement.className = `save-status ${status}`;
            saveStatusElement.textContent = status === 'saved' ? '●' :
                status === 'saving' ? '●' :
                    status === 'dirty' ? '●' : '●';
        }
    }

    private updateFileDisplay(): void {
        if (!this.fileManager) return;

        const currentFileName = document.getElementById('currentFileName');
        if (currentFileName) {
            const fileInfo = this.fileManager.getCurrentFileInfo();
            const fileName = fileInfo?.name || 'Untitled';
            currentFileName.textContent = fileName;
        }
    }

    private loadMindmapFromFileData(fileData: any): void {
        if (fileData.mindmap || fileData.mindmapData) {
            const mindmapData = fileData.mindmap || fileData.mindmapData;
            this.loadMindmapData(mindmapData);

            // Restore other state
            if (mindmapData.notesVisible !== undefined) {
                this.notesVisible = mindmapData.notesVisible;
                const toggleBtn = this.getElementByIdSafe('toggleNotesBtn');
                toggleBtn.textContent = this.notesVisible ? 'Hide Notes' : 'Show Notes';
                if (this.notesVisible) {
                    this.showAllNotes();
                }
            }

            if (mindmapData.canvasOffset) {
                this.canvasOffset = mindmapData.canvasOffset;
                this.applyCanvasTransform();
            }

            // Load sticky notes
            if (mindmapData.stickyNotes && this.stickyNotesManager) {
                this.stickyNotesManager.loadStickyNotesData(mindmapData.stickyNotes);
            }
        }
    }

    private getCurrentMindmapData(): any {
        return {
            nodes: this.nodes.map(node => ({
                id: node.id,
                text: node.text,
                parentId: node.parentId,
                x: node.x,
                y: node.y,
                note: node.note,
                isRoot: node.isRoot,
                color: node.color,
                shape: node.shape
            })),
            connections: this.connections,
            nodeIdCounter: this.nodeIdCounter,
            notesVisible: this.notesVisible,
            canvasOffset: this.canvasOffset,
            stickyNotes: this.stickyNotesManager ? this.stickyNotesManager.getStickyNotesData() : []
        };
    }

    private clearMindmap(): void {
        // Clear nodes
        this.nodes.forEach(node => {
            if (node.element && node.element.parentNode) {
                node.element.parentNode.removeChild(node.element);
            }
            if (node.noteDisplay && node.noteDisplay.parentNode) {
                node.noteDisplay.parentNode.removeChild(node.noteDisplay);
            }
        });
        this.nodes = [];
        this.connections = [];
        this.selectedNode = null;
        this.nodeIdCounter = 0;

        // Clear canvas
        this.svg.innerHTML = '';

        // Clear sticky notes
        if (this.stickyNotesManager) {
            // Assuming there's a clear method in StickyNotesManager
            // this.stickyNotesManager.clearAllNotes();
        }
    }

    // Session Management
    private saveSession(): void {
        if (this.fileManager) {
            this.fileManager.markDirty();
        } else {
            // Fallback to localStorage if file manager not available
            const sessionData: SessionData = {
                ...this.getCurrentMindmapData(),
                lastSaved: new Date().toISOString()
            };
            localStorage.setItem('mindmapSession', JSON.stringify(sessionData));
        }
    }

    private loadSession(): void {
        const sessionData = localStorage.getItem('mindmapSession');
        if (sessionData) {
            try {
                const data: SessionData = JSON.parse(sessionData);
                this.loadMindmapData(data);

                // Restore other session state
                this.nodeIdCounter = data.nodeIdCounter || 0;
                this.notesVisible = data.notesVisible || false;

                const toggleBtn = this.getElementByIdSafe('toggleNotesBtn');
                toggleBtn.textContent = this.notesVisible ? 'Hide Notes' : 'Show Notes';

                if (this.notesVisible) {
                    this.showAllNotes();
                }

                if (data.canvasOffset) {
                    this.canvasOffset = data.canvasOffset;
                    this.applyCanvasTransform();
                }

                // Load sticky notes
                if (data.stickyNotes && this.stickyNotesManager) {
                    this.stickyNotesManager.loadStickyNotesData(data.stickyNotes);
                }
            } catch (error) {
                console.error('Error loading session:', error);
                this.createRootNode();
            }
        } else {
            this.createRootNode();
        }
    }

    // Theme Management
    private toggleTheme(): void {
        this.currentTheme = this.currentTheme === 'modern' ? 'roman' : 'modern';
        this.saveTheme();
        this.loadTheme();

        const themeBtn = this.getElementByIdSafe('themeBtn');
        themeBtn.textContent = this.currentTheme === 'modern' ? 'Roman Theme' : 'Modern Theme';
    }

    private saveTheme(): void {
        localStorage.setItem('mindmapTheme', this.currentTheme);
    }

    private loadTheme(): void {
        const savedTheme = localStorage.getItem('mindmapTheme') as Theme;
        if (savedTheme) {
            this.currentTheme = savedTheme;
        }

        document.body.className = `theme-${this.currentTheme}`;

        const themeBtn = this.getElementByIdSafe('themeBtn');
        themeBtn.textContent = this.currentTheme === 'modern' ? 'Roman Theme' : 'Modern Theme';
    }

    // Canvas Management
    private handleCanvasMouseDown(e: MouseEvent): void {
        // Only start panning if clicking on empty space (not on nodes)
        if (e.target === this.mindmapContainer || e.target === this.svg || e.target === this.nodesContainer) {
            if (e.button === 1) { // Middle mouse button
                this.isCanvasPanning = true;
                this.canvasDragStart.x = e.clientX;
                this.canvasDragStart.y = e.clientY;
                this.mindmapContainer.style.cursor = 'grabbing';
                e.preventDefault();
            }
        }
    }

    private handleCanvasDoubleClick(e: MouseEvent): void {
        // Create a new root node at the clicked position
        if (e.target === this.mindmapContainer || e.target === this.svg || e.target === this.nodesContainer) {
            const containerRect = this.nodesContainer.getBoundingClientRect();
            const x = e.clientX - containerRect.left - this.canvasOffset.x;
            const y = e.clientY - containerRect.top - this.canvasOffset.y;

            const newNode = this.createNode('New Root', null, x, y);
            newNode.element.classList.add('root');
            this.selectNode(newNode);
        }
    }

    private resetCanvasPosition(): void {
        this.canvasOffset = { x: 0, y: 0 };
        this.applyCanvasTransform();
        this.saveSession();
    }

    private applyCanvasTransform(): void {
        const transform = `translate(${this.canvasOffset.x}px, ${this.canvasOffset.y}px)`;
        this.nodesContainer.style.transform = transform;
        this.svg.style.transform = transform;
    }

    // Neural Connection Mode
    private toggleConnectionMode(): void {
        this.isConnectionMode = !this.isConnectionMode;
        this.isRemoveConnectionMode = false;

        const connectionBtn = this.getElementByIdSafe('connectionModeBtn');
        const removeBtn = this.getElementByIdSafe('removeConnectionBtn');

        if (this.isConnectionMode) {
            connectionBtn.textContent = 'Exit Neural Mode';
            connectionBtn.classList.add('active');
            this.mindmapContainer.style.cursor = 'crosshair';
        } else {
            connectionBtn.textContent = 'Neural Connect Mode';
            connectionBtn.classList.remove('active');
            this.mindmapContainer.style.cursor = '';
            this.connectionStartNode = null;
        }

        removeBtn.classList.remove('active');
    }

    private toggleRemoveConnectionMode(): void {
        this.isRemoveConnectionMode = !this.isRemoveConnectionMode;
        this.isConnectionMode = false;

        const removeBtn = this.getElementByIdSafe('removeConnectionBtn');
        const connectionBtn = this.getElementByIdSafe('connectionModeBtn');

        if (this.isRemoveConnectionMode) {
            removeBtn.textContent = 'Exit Remove Mode';
            removeBtn.classList.add('active');
            this.mindmapContainer.style.cursor = 'not-allowed';
        } else {
            removeBtn.textContent = 'Remove Connections';
            removeBtn.classList.remove('active');
            this.mindmapContainer.style.cursor = '';
        }

        connectionBtn.classList.remove('active');
        connectionBtn.textContent = 'Neural Connect Mode';
        this.connectionStartNode = null;
    }

    private handleNeuralConnection(node: MindmapNode): void {
        if (this.isRemoveConnectionMode) {
            this.removeNodeConnections(node);
            return;
        }

        if (!this.connectionStartNode) {
            this.connectionStartNode = node;
            node.element.classList.add('connection-start');
        } else if (this.connectionStartNode.id !== node.id) {
            // Create neural connection
            this.connections.push({
                fromId: this.connectionStartNode.id,
                toId: node.id,
                type: 'neural'
            });

            this.updateConnections();
            this.saveSession();

            // Reset
            this.connectionStartNode.element.classList.remove('connection-start');
            this.connectionStartNode = null;
        }
    }

    private removeNodeConnections(node: MindmapNode): void {
        const initialCount = this.connections.length;
        this.connections = this.connections.filter(connection =>
            connection.fromId !== node.id && connection.toId !== node.id
        );

        if (this.connections.length < initialCount) {
            this.updateConnections();
            this.saveSession();
        }
    }

    private createMultipleRootNodes(): void {
        const rootNodes = this.nodes.filter(n => n.isRoot);
        const spacing = 300;
        const x = rootNodes.length * spacing + 100;
        const y = 300;

        const newNode = this.createNode('New Root', null, x, y);
        newNode.element.classList.add('root');
        this.selectNode(newNode);
    }

    // Node Customization
    private showNodeCustomizationMenu(nodeId: number): void {
        const node = this.findNodeById(nodeId);
        if (!node) return;

        // Simple implementation: cycle through colors
        const colors = ['#ffffff', '#ffebee', '#e8f5e8', '#fff3e0', '#e3f2fd', '#f3e5f5'];
        const currentIndex = colors.indexOf(node.color || '#ffffff');
        const nextIndex = (currentIndex + 1) % colors.length;

        node.color = colors[nextIndex];
        this.applyNodeStyling(node);
        this.saveSession();
    }

    private applyNodeStyling(node: MindmapNode): void {
        if (node.color) {
            node.element.style.backgroundColor = node.color;
        }

        // Apply shape styling if needed
        if (node.shape === 'circle') {
            node.element.style.borderRadius = '50%';
        } else if (node.shape === 'diamond') {
            node.element.style.transform += ' rotate(45deg)';
        } else {
            node.element.style.borderRadius = '8px';
        }
    }

    // Sticky Notes Integration
    private initializeStickyNotes(): void {
        const notesContainer = document.getElementById('notesContainer') || this.mindmapContainer;
        this.stickyNotesManager = new StickyNotesManager(notesContainer);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        new MindmapApp();
    } catch (error) {
        console.error('Error initializing MindmapApp:', error);
    }
});
