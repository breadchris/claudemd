# Supabase CLAUDE.md Platform Server

A Go-based development and production server for the Supabase CLAUDE.md platform using esbuild for TypeScript/React compilation.

## 🚀 Quick Start

### Install and Build

```bash
# Install dependencies
go mod tidy

# Build the server
go build -o supabase-server main.go
```

### Development Mode

```bash
# Start the development server (default port 3001)
./supabase-server serve

# Start with custom port
./supabase-server serve --port 8080
```

### Production Build

```bash
# Build the application for production
./supabase-server build
```

## 📋 CLI Commands

### `serve` - Development Server
Start the development server with live TypeScript/React compilation.

```bash
./supabase-server serve [--port PORT]
```

**Options:**
- `--port` - Port to run server on (default: 3001)

**Features:**
- Live TypeScript/React compilation
- Component debugging endpoints
- ES module serving
- Zero-configuration setup

### `build` - Production Build
Generate optimized production build.

```bash
./supabase-server build
```

**Output:**
- Creates `./build/` directory
- Generates `index.html` (entry point)
- Generates `app.js` (compiled application bundle)

## 🎯 Available Endpoints

### Main Application
- **`GET /`** - Serves the main Supabase CLAUDE.md platform application

### Component Development & Debugging
- **`GET /render/{path}`** - Renders individual React components in isolation
  - Query param: `?component=ComponentName` (defaults to "App")
  - Example: `/render/demo/TestApp.tsx?component=TestApp`
  - Use for debugging and testing individual components

### Module System
- **`GET /module/{path}`** - Serves TypeScript/React files as compiled ES modules
  - Automatically handles TypeScript compilation
  - Supports JSX/TSX files with React 18
  - Example: `/module/index.ts`
  - Use for importing components in the browser

## 🏗️ esbuild Configuration

The server uses esbuild with optimized settings for the Supabase platform:

### TypeScript/React Support
- **File types**: `.ts`, `.tsx`, `.js`, `.jsx`, `.css`
- **JSX**: React 18 automatic JSX transform
- **Target**: ES2020 for modern browsers
- **Bundle**: True (includes dependencies)
- **Tree shaking**: Enabled for smaller bundles

### External Dependencies
The following packages are marked as external and loaded from CDN:
- `react` - https://esm.sh/react@18
- `react-dom` - https://esm.sh/react-dom@18
- `@supabase/supabase-js` - https://esm.sh/@supabase/supabase-js@2

### Import Maps
Modern ES modules with import maps for browser compatibility:
```json
{
  "imports": {
    "react": "https://esm.sh/react@18",
    "react-dom": "https://esm.sh/react-dom@18",
    "react-dom/client": "https://esm.sh/react-dom@18/client",
    "react/jsx-runtime": "https://esm.sh/react@18/jsx-runtime",
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
  }
}
```

## 🎨 Styling Integration

### Tailwind CSS + DaisyUI
- **Tailwind CSS**: Modern utility-first CSS framework
- **DaisyUI**: Component library built on Tailwind
- **JIT Mode**: Just-in-time compilation for optimal performance

Both are loaded via CDN for zero-configuration styling.

## 🔧 Development Features

### Error Handling
- Detailed TypeScript compilation errors
- Runtime error boundaries in HTML pages
- Helpful troubleshooting information
- Build error display in browser

### Performance
- Build-on-demand for faster initial startup
- Efficient incremental compilation
- No file watching overhead

## 🚢 Production Deployment

### Build Workflow
```bash
# 1. Generate production build
./supabase-server build

# 2. The build/ directory contains:
#    - index.html (entry point)
#    - app.js (compiled application bundle)
```

### Deployment Options
1. **Static hosting**: Deploy `build/` directory to any static host (Vercel, Netlify, etc.)
2. **Self-hosted**: Run the Go server in production with `serve` command
3. **Docker**: Containerize the Go server and build artifacts

## 📁 Directory Structure

```
supabase/
├── main.go              # Main server implementation
├── SERVER.md           # This documentation
├── go.mod              # Go module dependencies
├── supabase-server     # Compiled binary
├── build/              # Production build output (generated)
├── auth/               # Authentication components
├── components/         # UI components
├── data/               # Data access layer
├── demo/               # Demo and test components
├── hooks/              # Custom React hooks
├── services/           # Business logic layer
├── types/              # TypeScript type definitions
└── index.ts            # Main application entry point
```

## 🔍 Debugging

### Component Development
```bash
# Debug individual components
http://localhost:3001/render/demo/TestApp.tsx?component=TestApp
http://localhost:3001/render/components/ClaudeDocApp.tsx
```

### Module Inspection
```bash
# View compiled modules
http://localhost:3001/module/index.ts
http://localhost:3001/module/demo/ErrorTestDemo.tsx
```

### Build Issues
- Check TypeScript compilation errors in browser console
- Verify import paths and module exports
- Ensure all dependencies are properly configured
- Use component debugging endpoints to isolate issues

### Runtime Issues
- Check browser network tab for failed module loads
- Verify Supabase configuration in `data/SupabaseClient.ts`
- Check browser console for JavaScript errors

### Server Issues
- Check Go compilation errors: `go build main.go`
- Verify file permissions for source file access
- Check available disk space for build output

## 📝 Examples

### Development Workflow
```bash
# 1. Start development server
./supabase-server serve

# 2. Access main app
open http://localhost:3001

# 3. Debug individual components
open http://localhost:3001/render/demo/TestApp.tsx?component=TestApp

# 4. Inspect compiled modules
curl http://localhost:3001/module/index.ts
```

### Production Workflow
```bash
# 1. Build for production
./supabase-server build

# 2. Deploy build/ directory to static hosting
# Or serve locally:
./supabase-server serve --port 8080
```

### Component Testing
```bash
# Test the error testing component
curl http://localhost:3001/render/demo/ErrorTestDemo.tsx?component=ErrorTestDemo

# Test the main app component
curl http://localhost:3001/render/components/ClaudeDocApp.tsx?component=ClaudeDocApp
```

This server provides a focused development environment for the Supabase CLAUDE.md platform with modern tooling, optimized for component debugging and production builds.