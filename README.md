# Interactive Mindmap Application

A fully-featured mindmap application built with TypeScript, featuring node creation, notes, themes, and session persistence.

## Features

- **Node Management**: Create sibling nodes (Enter) and child nodes (Ctrl+Enter)
- **Canvas Panning**: Use middle mouse button to drag and pan the entire canvas
- **Notes System**: Double-click nodes to add notes, toggle visibility
- **File Operations**: Save/load/export mindmap data as JSON
- **Session Persistence**: Auto-save every 30 seconds + restore on refresh (includes canvas position)
- **Theme Switching**: Modern and Roman themes with persistent preferences
- **Keyboard Navigation**: Arrow keys for node navigation
- **Drag & Drop**: Move individual nodes around with left mouse button
- **Reset View**: Button to reset canvas to center position
- **Clean UI**: Minimalistic design with responsive layout

## TypeScript Benefits

This project has been converted to TypeScript to provide:

- **Type Safety**: Catch errors at compile time
- **Better IDE Support**: IntelliSense, auto-completion, and refactoring
- **Code Documentation**: Self-documenting interfaces and types
- **Improved Maintainability**: Easier to understand and modify code
- **Build Tools**: Proper compilation and development workflow

## Development Setup

### Prerequisites

- Node.js (v14 or higher)
- TypeScript (installed via npm)

### Installation

```bash
npm install
```

### Development Commands

```bash
# Build TypeScript to JavaScript
npm run build

# Build for production (no source maps/declarations)
npm run build:prod

# Watch mode - auto-compile on file changes
npm run watch

# Start development server
npm run serve

# Type checking without compilation
npm run type-check

# Clean build directory
npm run clean
```

### Development Workflow

1. **Start watch mode**: `npm run watch`
2. **Start server**: `npm run serve` (in another terminal)
3. **Open browser**: Navigate to `http://localhost:8000`
4. **Edit source**: Modify files in `/src` directory
5. **Auto-compile**: TypeScript automatically compiles on save

## Project Structure

```
mindmap/
├── src/
│   └── script.ts          # TypeScript source code
├── dist/                  # Compiled JavaScript output
│   ├── script.js         # Compiled JavaScript
│   ├── script.js.map     # Source map for debugging
│   ├── script.d.ts       # Type declarations
│   └── script.d.ts.map   # Declaration source map
├── index.html            # Main HTML file
├── style.css            # CSS styles and themes
├── package.json         # npm configuration
├── tsconfig.json        # TypeScript configuration
└── README.md           # This file
```

## TypeScript Features Used

### Interfaces and Types

- **MindmapNode**: Defines the structure of mindmap nodes
- **Connection**: Represents parent-child relationships
- **MindmapData**: JSON export/import format
- **SessionData**: Session storage format
- **Theme**: Union type for theme options
- **NavigationDirection**: Arrow key navigation types

### Class Structure

- **Private methods**: Encapsulation with TypeScript private modifier
- **Type annotations**: All parameters and return types specified
- **Null safety**: Proper handling of potentially null values
- **DOM typing**: Correct types for HTML elements and events

### Error Prevention

- **Compile-time checks**: Catch type mismatches before runtime
- **Null checking**: Prevent null reference errors
- **Parameter validation**: Ensure correct function parameters
- **IDE support**: Real-time error highlighting and suggestions

## Usage

### Basic Controls

- **Enter**: Create a sibling node at the same level
- **Ctrl/Cmd + Enter**: Create a child node
- **Click node**: Select and edit text
- **Double-click node**: Add/edit notes
- **Delete key**: Remove selected node (except root)
- **Arrow keys**: Navigate between nodes

### Mouse Controls

- **Left mouse drag**: Move individual nodes around
- **Middle mouse drag**: Pan the entire canvas view
- **Middle mouse button**: Hold and drag to pan the canvas

### Buttons

- **Show/Hide Notes**: Toggle visibility of all notes
- **Reset View**: Center the canvas back to the original position
- **Modern/Roman Theme**: Switch between visual themes
- **Save**: Download mindmap as JSON file
- **Load**: Import mindmap from JSON file
- **Export**: Download with timestamp
- **Help**: Show keyboard shortcuts

### Auto-Save Features

- Session data is automatically saved every 30 seconds
- Canvas position is preserved across sessions
- Theme preference is remembered
- All changes are auto-saved when you interact with the mindmap

## Browser Compatibility

- Modern browsers with ES2020 support
- TypeScript compiles to ES2020 for broad compatibility
- Uses native DOM APIs and localStorage

## Contributing

When contributing to this project:

1. Write TypeScript code in the `/src` directory
2. Follow existing type definitions and interfaces
3. Run `npm run type-check` to verify types
4. Test the compiled output in the browser
5. Ensure all TypeScript compilation passes without errors

## License

MIT License - see package.json for details
