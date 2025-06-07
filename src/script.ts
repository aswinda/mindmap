// Import sticky notes module
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
        this.setupEventListeners();
        this.loadTheme();
        this.loadSession();
        this.startAutoSave();
        this.initializeStickyNotes();
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
        this.getElementByIdSafe('connectionModeBtn').addEventListener('click', () => this.toggleConnectionMode());
        this.getElementByIdSafe('removeConnectionBtn').addEventListener('click', () => this.toggleRemoveConnectionMode());
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

    // Session Management
    private saveSession(): void {
        const sessionData: SessionData = {
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
            lastSaved: new Date().toISOString(),
            canvasOffset: this.canvasOffset,
            stickyNotes: this.stickyNotesManager?.getStickyNotesData() || []
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

                    // Restore sticky notes
                    if (data.stickyNotes && this.stickyNotesManager) {
                        this.stickyNotesManager.loadStickyNotesData(data.stickyNotes);
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

    private handleCanvasDoubleClick(e: MouseEvent): void {
        // Only create nodes if not clicking on existing elements
        const target = e.target as HTMLElement;
        if (target === this.mindmapContainer || target === this.nodesContainer) {
            e.preventDefault();

            // Calculate position relative to the canvas offset
            const containerRect = this.mindmapContainer.getBoundingClientRect();
            const x = e.clientX - containerRect.left - this.canvasOffset.x;
            const y = e.clientY - containerRect.top - this.canvasOffset.y;

            // Create a new root node at the clicked position
            const newNode = this.createNode('New Node', null, x, y);
            newNode.isRoot = true;
            newNode.element.classList.add('root');
            this.selectNode(newNode);

            // Focus the input for immediate editing
            const input = newNode.element.querySelector('input') as HTMLInputElement;
            if (input) {
                input.focus();
                input.select();
            }
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

    // Neural Network Connection Methods
    private toggleConnectionMode(): void {
        this.isConnectionMode = !this.isConnectionMode;
        const connectionBtn = this.getElementByIdSafe('connectionModeBtn');

        if (this.isConnectionMode) {
            connectionBtn.textContent = 'Exit Connection Mode';
            connectionBtn.classList.add('active');
            this.mindmapContainer.style.cursor = 'crosshair';
            this.connectionStartNode = null;
        } else {
            connectionBtn.textContent = 'Neural Connect Mode';
            connectionBtn.classList.remove('active');
            this.mindmapContainer.style.cursor = 'default';
            this.connectionStartNode = null;
            // Clear connection highlighting
            this.nodes.forEach(node => {
                node.element.classList.remove('connection-start', 'connection-candidate');
            });
        }
    }

    private toggleRemoveConnectionMode(): void {
        this.isRemoveConnectionMode = !this.isRemoveConnectionMode;
        const removeBtn = this.getElementByIdSafe('removeConnectionBtn');

        if (this.isRemoveConnectionMode) {
            // Turn off connection mode if it's on
            if (this.isConnectionMode) {
                this.toggleConnectionMode();
            }

            removeBtn.textContent = 'Exit Remove Mode';
            removeBtn.classList.add('active');
            this.mindmapContainer.style.cursor = 'not-allowed';

            // Make connections clickable for removal
            this.makeConnectionsClickable();
        } else {
            removeBtn.textContent = 'Remove Connections';
            removeBtn.classList.remove('active');
            this.mindmapContainer.style.cursor = 'default';

            // Remove connection click handlers
            this.removeConnectionClickHandlers();
        }
    }

    private makeConnectionsClickable(): void {
        // Add click handlers to all connection lines
        const connectionLines = this.svg.querySelectorAll('path');
        connectionLines.forEach((line, index) => {
            line.style.cursor = 'pointer';
            line.style.strokeWidth = '4'; // Make them thicker for easier clicking
            line.setAttribute('data-connection-index', index.toString());

            const clickHandler = (e: Event) => {
                e.stopPropagation();
                this.removeConnection(index);
            };

            line.addEventListener('click', clickHandler);
            // Store the handler so we can remove it later
            (line as any)._clickHandler = clickHandler;
        });
    }

    private removeConnectionClickHandlers(): void {
        const connectionLines = this.svg.querySelectorAll('path');
        connectionLines.forEach(line => {
            line.style.cursor = 'default';
            // Reset stroke width
            const isNeural = line.classList.contains('neural-connection-line');
            line.style.strokeWidth = isNeural ? '2' : '1.5';

            if ((line as any)._clickHandler) {
                line.removeEventListener('click', (line as any)._clickHandler);
                delete (line as any)._clickHandler;
            }
        });
    }

    private removeConnection(connectionIndex: number): void {
        if (connectionIndex >= 0 && connectionIndex < this.connections.length) {
            const connection = this.connections[connectionIndex];
            const fromNode = this.findNodeById(connection.fromId);
            const toNode = this.findNodeById(connection.toId);

            const confirmMessage = `Remove ${connection.type} connection between "${fromNode?.text}" and "${toNode?.text}"?`;

            if (confirm(confirmMessage)) {
                this.connections.splice(connectionIndex, 1);
                this.updateConnections();
                this.saveSession();

                // Refresh clickable connections
                if (this.isRemoveConnectionMode) {
                    setTimeout(() => this.makeConnectionsClickable(), 100);
                }
            }
        }
    }

    private createNeuralConnection(fromNode: MindmapNode, toNode: MindmapNode): void {
        // Check if connection already exists
        const existingConnection = this.connections.find(c =>
            c.fromId === fromNode.id && c.toId === toNode.id ||
            c.fromId === toNode.id && c.toId === fromNode.id
        );

        if (existingConnection) {
            alert('Connection already exists between these nodes');
            return;
        }

        // Create bidirectional neural connection
        this.connections.push({
            fromId: fromNode.id,
            toId: toNode.id,
            type: 'neural'
        });

        this.updateConnections();
        this.saveSession();
    }

    private createMultipleRootNodes(): void {
        // Allow creating root nodes anywhere on canvas
        const rootCount = this.nodes.filter(n => n.isRoot).length;
        const newX = 200 + (rootCount * 300);
        const newY = 300;

        const newRoot = this.createNode('New Root', null, newX, newY);
        newRoot.element.classList.add('root');
        this.selectNode(newRoot);
    }

    private handleNeuralConnection(node: MindmapNode): void {
        if (!this.isConnectionMode) return;

        if (!this.connectionStartNode) {
            // First node selected
            this.connectionStartNode = node;
            node.element.classList.add('connection-start');

            // Highlight other nodes as connection candidates
            this.nodes.forEach(n => {
                if (n.id !== node.id) {
                    n.element.classList.add('connection-candidate');
                }
            });
        } else if (this.connectionStartNode.id !== node.id) {
            // Second node selected - create connection
            this.createNeuralConnection(this.connectionStartNode, node);

            // Clear highlighting
            this.nodes.forEach(n => {
                n.element.classList.remove('connection-start', 'connection-candidate');
            });

            this.connectionStartNode = null;
        }
    }

    // Node Design Customization Methods
    private changeNodeColor(nodeId: number, color: string): void {
        const node = this.findNodeById(nodeId);
        if (node) {
            node.color = color;
            this.applyNodeStyling(node);
            this.saveSession();
        }
    }

    private changeNodeShape(nodeId: number, shape: 'rectangle' | 'circle' | 'diamond'): void {
        const node = this.findNodeById(nodeId);
        if (node) {
            node.shape = shape;
            this.applyNodeStyling(node);
            this.saveSession();
        }
    }

    private applyNodeStyling(node: MindmapNode): void {
        // Remove existing shape classes
        node.element.classList.remove('node-circle', 'node-diamond', 'node-rectangle');

        // Apply color
        if (node.color) {
            node.element.style.backgroundColor = node.color;
        }

        // Apply shape
        switch (node.shape) {
            case 'circle':
                node.element.classList.add('node-circle');
                break;
            case 'diamond':
                node.element.classList.add('node-diamond');
                break;
            case 'rectangle':
            default:
                node.element.classList.add('node-rectangle');
                break;
        }
    }

    private showNodeCustomizationMenu(nodeId: number): void {
        const node = this.findNodeById(nodeId);
        if (!node) return;

        const colors = ['#ffffff', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd', '#98d8c8'];
        const shapes = ['rectangle', 'circle', 'diamond'] as const;

        const menu = document.createElement('div');
        menu.className = 'node-customization-menu';
        menu.style.cssText = `
            position: absolute;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            min-width: 200px;
        `;

        // Color section
        const colorSection = document.createElement('div');
        colorSection.innerHTML = '<h4 style="margin: 0 0 8px 0; font-size: 12px;">Color:</h4>';

        const colorGrid = document.createElement('div');
        colorGrid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 12px;';

        colors.forEach(color => {
            const colorBtn = document.createElement('button');
            colorBtn.style.cssText = `
                width: 24px; height: 24px; border: 1px solid #ccc; 
                border-radius: 4px; cursor: pointer; background: ${color};
            `;
            colorBtn.onclick = () => {
                this.changeNodeColor(nodeId, color);
                document.body.removeChild(menu);
            };
            colorGrid.appendChild(colorBtn);
        });

        // Shape section
        const shapeSection = document.createElement('div');
        shapeSection.innerHTML = '<h4 style="margin: 0 0 8px 0; font-size: 12px;">Shape:</h4>';

        shapes.forEach(shape => {
            const shapeBtn = document.createElement('button');
            shapeBtn.textContent = shape.charAt(0).toUpperCase() + shape.slice(1);
            shapeBtn.className = 'btn btn-secondary';
            shapeBtn.style.cssText = 'margin-right: 4px; padding: 4px 8px; font-size: 10px;';
            shapeBtn.onclick = () => {
                this.changeNodeShape(nodeId, shape);
                document.body.removeChild(menu);
            };
            shapeSection.appendChild(shapeBtn);
        });

        menu.appendChild(colorSection);
        menu.appendChild(colorGrid);
        menu.appendChild(shapeSection);

        // Position menu near the node
        const rect = node.element.getBoundingClientRect();
        menu.style.left = (rect.right + 10) + 'px';
        menu.style.top = rect.top + 'px';

        // Close menu when clicking outside
        const closeMenu = (e: Event) => {
            if (!menu.contains(e.target as Node)) {
                document.body.removeChild(menu);
                document.removeEventListener('click', closeMenu);
            }
        };

        document.body.appendChild(menu);
        setTimeout(() => document.addEventListener('click', closeMenu), 100);
    }

    private initializeStickyNotes(): void {
        this.stickyNotesManager = new StickyNotesManager(this.mindmapContainer);
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MindmapApp();
});
