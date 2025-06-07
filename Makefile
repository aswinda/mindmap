# Mindmap Application Makefile
# TypeScript-based interactive mindmap with file management

# Variables
NODE_MODULES = node_modules
DIST_DIR = dist
SRC_DIR = src
PORT = 8000
BROWSER_CMD = open
TYPESCRIPT_FILES = $(wildcard $(SRC_DIR)/*.ts)
DIST_FILES = $(TYPESCRIPT_FILES:$(SRC_DIR)/%.ts=$(DIST_DIR)/%.js)

# Default target
.DEFAULT_GOAL := help

# Phony targets
.PHONY: help install build build-prod clean dev serve start watch type-check test open browser deps check status all

## Help - Display available commands
help:
	@echo "Mindmap Application - Available Commands:"
	@echo ""
	@echo "📦 Setup & Dependencies:"
	@echo "  install      - Install npm dependencies"
	@echo "  deps         - Check dependency status"
	@echo ""
	@echo "🔨 Build Commands:"
	@echo "  build        - Build TypeScript files (development)"
	@echo "  build-prod   - Build TypeScript files (production)"
	@echo "  watch        - Build and watch for changes"
	@echo "  clean        - Remove built files"
	@echo ""
	@echo "🚀 Development:"
	@echo "  dev          - Start development (watch + serve)"
	@echo "  serve        - Start HTTP server on port $(PORT)"
	@echo "  start        - Build and start server"
	@echo "  open         - Open application in browser"
	@echo ""
	@echo "🔍 Quality & Testing:"
	@echo "  type-check   - Run TypeScript type checking"
	@echo "  check        - Run all checks (type-check)"
	@echo "  status       - Show project status"
	@echo ""
	@echo "🎯 Shortcuts:"
	@echo "  all          - Clean, install, build, and start"
	@echo ""

## Install npm dependencies
install: package.json
	@echo "📦 Installing dependencies..."
	npm install
	@echo "✅ Dependencies installed successfully"

## Check if dependencies are installed
deps:
	@echo "🔍 Checking dependencies..."
	@if [ -d "$(NODE_MODULES)" ]; then \
		echo "✅ Dependencies are installed"; \
		echo "📋 Dependency status:"; \
		npm list --depth=0 2>/dev/null || true; \
	else \
		echo "❌ Dependencies not installed"; \
		echo "Run 'make install' to install dependencies"; \
		exit 1; \
	fi

## Build TypeScript files (development mode)
build: $(NODE_MODULES) $(DIST_FILES)
	@echo "🔨 Building TypeScript files..."
	npm run build
	@echo "✅ Build completed successfully"

## Build TypeScript files (production mode)
build-prod: $(NODE_MODULES)
	@echo "🔨 Building TypeScript files (production)..."
	npm run build:prod
	@echo "✅ Production build completed successfully"

## Build individual TypeScript files
$(DIST_DIR)/%.js: $(SRC_DIR)/%.ts | $(NODE_MODULES)
	@echo "🔨 Building $<..."
	npm run build

## Watch for changes and rebuild automatically
watch: $(NODE_MODULES)
	@echo "👀 Starting TypeScript watch mode..."
	@echo "Press Ctrl+C to stop watching"
	npm run watch

## Start HTTP server
serve:
	@echo "🚀 Starting HTTP server on port $(PORT)..."
	@echo "🌐 Open http://localhost:$(PORT) in your browser"
	@echo "📁 Serving files from current directory"
	@echo "Press Ctrl+C to stop server"
	npm run serve

## Development mode (watch + serve in parallel)
dev: $(NODE_MODULES)
	@echo "🚀 Starting development mode..."
	@echo "🔨 TypeScript will watch for changes"
	@echo "🌐 Server will run on http://localhost:$(PORT)"
	@echo "Press Ctrl+C to stop development server"
	npm run dev:server

## Build and start server
start: build serve

## Open application in browser
open browser:
	@echo "🌐 Opening application in browser..."
	@if command -v $(BROWSER_CMD) >/dev/null 2>&1; then \
		$(BROWSER_CMD) http://localhost:$(PORT); \
	else \
		echo "❌ Cannot open browser automatically"; \
		echo "Please open http://localhost:$(PORT) manually"; \
	fi

## Clean built files
clean:
	@echo "🧹 Cleaning built files..."
	npm run clean
	@echo "✅ Clean completed"

## Run TypeScript type checking
type-check: $(NODE_MODULES)
	@echo "🔍 Running TypeScript type checking..."
	npm run type-check
	@echo "✅ Type checking passed"

## Run all quality checks
check: type-check
	@echo "✅ All checks passed"

## Show project status
status:
	@echo "📊 Mindmap Application Status"
	@echo "================================"
	@echo ""
	@echo "📂 Project Directory: $(PWD)"
	@echo "📦 Package: $(shell grep '"name"' package.json | cut -d'"' -f4)"
	@echo "🏷️  Version: $(shell grep '"version"' package.json | cut -d'"' -f4)"
	@echo ""
	@echo "📁 Directories:"
	@echo "  Source: $(SRC_DIR)/ $(if $(wildcard $(SRC_DIR)/*),✅,❌)"
	@echo "  Dist: $(DIST_DIR)/ $(if $(wildcard $(DIST_DIR)/*),✅,❌)"
	@echo "  Modules: $(NODE_MODULES)/ $(if $(wildcard $(NODE_MODULES)/*),✅,❌)"
	@echo ""
	@echo "📄 TypeScript Files:"
	@for file in $(TYPESCRIPT_FILES); do \
		echo "  $$file ✅"; \
	done
	@echo ""
	@echo "🏗️  Built Files:"
	@if [ -d "$(DIST_DIR)" ]; then \
		for file in $(DIST_DIR)/*.js; do \
			if [ -f "$$file" ]; then \
				echo "  $$file ✅"; \
			fi; \
		done; \
	else \
		echo "  No built files found (run 'make build')"; \
	fi
	@echo ""

## Complete setup: clean, install, build, and start
all: clean install build start

# Ensure node_modules exists
$(NODE_MODULES): package.json
	@if [ ! -d "$(NODE_MODULES)" ]; then \
		echo "📦 Installing dependencies..."; \
		npm install; \
	fi

# Create dist directory if it doesn't exist
$(DIST_DIR):
	@mkdir -p $(DIST_DIR)

# Auto-create dist directory for build targets
$(DIST_FILES): | $(DIST_DIR)
