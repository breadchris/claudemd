package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/breadchris/share/db"
	"github.com/evanw/esbuild/pkg/api"
	"github.com/urfave/cli/v2"
)

// Global configuration manager for pinned documents
var configManager *db.ConfigManager[db.PinnedDocsConfig]

func init() {
	// Initialize the configuration manager
	var err error
	configDir := filepath.Join(".", "data", "config")
	configManager, err = db.NewConfigManager[db.PinnedDocsConfig](configDir)
	if err != nil {
		fmt.Printf("Warning: Failed to initialize config manager: %v\n", err)
	}
}

func main() {
	app := &cli.App{
		Name:  "supabase-server",
		Usage: "Supabase CLAUDE.md Platform Server",
		Commands: []*cli.Command{
			{
				Name:  "serve",
				Usage: "Start the development server",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:  "port",
						Value: "3001",
						Usage: "Port to run server on",
					},
				},
				Action: serveCommand,
			},
			{
				Name:   "build",
				Usage:  "Build the application for production",
				Action: buildCommand,
			},
		},
	}

	if err := app.Run(os.Args); err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
}

// serveCommand starts the development server
func serveCommand(c *cli.Context) error {
	port := c.String("port")

	mux := createHTTPServer()

	fmt.Printf("🚀 Supabase CLAUDE.md Platform Server starting on http://localhost:%s\n", port)
	fmt.Printf("📁 Serving from: %s\n", getCurrentDir())
	fmt.Printf("🔧 Development mode with esbuild integration\n")
	fmt.Printf("🎯 Available endpoints:\n")
	fmt.Printf("   • GET  /              - Main Supabase CLAUDE.md app\n")
	fmt.Printf("   • GET  /render/{path} - Component debugging\n")
	fmt.Printf("   • GET  /module/{path} - ES module serving\n")
	fmt.Printf("   • GET  /api/config/pinned-docs - Get pinned documents\n")
	fmt.Printf("   • POST /api/config/pinned-docs - Update pinned documents\n")
	fmt.Printf("   • PUT  /api/config/pinned-docs/{id} - Toggle pin status\n")

	return http.ListenAndServe(":"+port, mux)
}

// buildCommand builds the application for production
func buildCommand(c *cli.Context) error {
	fmt.Println("🏗️ Starting production build...")

	buildDir := "./"

	// Build main app bundle
	result := buildWithEsbuild("./index.tsx", filepath.Join(buildDir, "app.js"), true)

	if len(result.Errors) > 0 {
		fmt.Println("❌ Production build failed:")
		for _, err := range result.Errors {
			fmt.Printf("   • %s\n", err.Text)
		}
		return fmt.Errorf("build failed with %d errors", len(result.Errors))
	}

	// Generate production HTML
	htmlContent := generateProductionHTML()
	htmlPath := filepath.Join(buildDir, "index.html")
	if err := os.WriteFile(htmlPath, []byte(htmlContent), 0644); err != nil {
		return fmt.Errorf("failed to write HTML file: %v", err)
	}

	fmt.Println("✅ Production build completed successfully!")
	fmt.Printf("📁 Output directory: %s\n", buildDir)
	fmt.Printf("📄 Files generated:\n")
	fmt.Printf("   • index.html\n")
	fmt.Printf("   • app.js\n")

	return nil
}

// createHTTPServer creates the HTTP server with only essential endpoints
func createHTTPServer() *http.ServeMux {
	mux := http.NewServeMux()

	// Main Supabase CLAUDE.md app page
	mux.HandleFunc("/", serveSupabaseApp)

	// Component renderer endpoint for debugging
	mux.HandleFunc("/render/", handleRenderComponent)

	// ES Module endpoint for serving compiled JavaScript
	mux.HandleFunc("/module/", handleServeModule)

	// Configuration API endpoints
	mux.HandleFunc("/api/config/pinned-docs", handlePinnedDocsConfig)
	mux.HandleFunc("/api/config/pinned-docs/", handlePinnedDocsToggle)

	return mux
}

// serveSupabaseApp serves the main Supabase CLAUDE.md application
func serveSupabaseApp(w http.ResponseWriter, r *http.Request) {
	htmlContent := `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Supabase CLAUDE.md Platform</title>
    
    <!-- Import maps for modern ES modules -->
    <script type="importmap">
    {
        "imports": {
            "react": "https://esm.sh/react@18",
            "react-dom": "https://esm.sh/react-dom@18",
            "react-dom/client": "https://esm.sh/react-dom@18/client",
            "react/jsx-runtime": "https://esm.sh/react@18/jsx-runtime",
            "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
        }
    }
    </script>
    
    <!-- Tailwind CSS and DaisyUI for styling -->
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/daisyui@5">
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    
    <!-- Global styles -->
    <style>
        body { 
            margin: 0; 
            padding: 0; 
            font-family: system-ui, -apple-system, sans-serif;
            background-color: #f9fafb;
        }
        #root { 
            width: 100%; 
            min-height: 100vh; 
        }
        .error { 
            padding: 20px; 
            color: #dc2626; 
            background: #fef2f2; 
            border: 1px solid #fecaca; 
            margin: 20px; 
            border-radius: 8px;
            font-family: monospace;
        }
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            gap: 12px;
        }
        .spinner {
            border: 2px solid #f3f4f6;
            border-top: 2px solid #3b82f6;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div id="root">
        <div class="loading">
            <div class="spinner"></div>
            <span>Loading Supabase CLAUDE.md Platform...</span>
        </div>
    </div>
    
    <script type="module">
        try {
            console.log('🚀 Loading Supabase CLAUDE.md Platform...');
            
            // Import the main Supabase app component
            const appModule = await import('/module/index.tsx');
            
            // Import React and ReactDOM
            const React = await import('react');
            const ReactDOM = await import('react-dom/client');
            
            console.log('📦 Modules loaded successfully');
            
            // Get the main app component (ClaudeDocApp is the default export)
            const App = appModule.default || appModule.ClaudeDocApp;
            
            if (!App) {
                throw new Error('No default export found in Supabase app module');
            }
            
            console.log('🎨 Rendering Supabase CLAUDE.md Platform...');
            
            // Render the application
            const root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(React.createElement(App));
            
            console.log('✅ Supabase CLAUDE.md Platform loaded successfully!');
            
        } catch (error) {
            console.error('❌ Failed to load Supabase CLAUDE.md Platform:', error);
            
            document.getElementById('root').innerHTML = 
                '<div class="error">' +
                '<h3>🚨 Error Loading Supabase CLAUDE.md Platform</h3>' +
                '<p><strong>Error:</strong> ' + error.message + '</p>' +
                '<pre>' + (error.stack || '') + '</pre>' +
                '<h4>🔧 Troubleshooting:</h4>' +
                '<ul>' +
                '<li>Check that all TypeScript files compile correctly</li>' +
                '<li>Verify Supabase configuration in SupabaseClient.ts</li>' +
                '<li>Ensure all dependencies are properly imported</li>' +
                '<li>Check browser console for additional error details</li>' +
                '</ul>' +
                '</div>';
        }
    </script>
</body>
</html>`

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlContent))
}

// handleRenderComponent builds and renders a React component in a simple HTML page
func handleRenderComponent(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	componentPath := strings.TrimPrefix(r.URL.Path, "/render/")
	if componentPath == "" {
		http.Error(w, "Component path is required", http.StatusBadRequest)
		return
	}

	componentName := r.URL.Query().Get("component")
	if componentName == "" {
		componentName = "App"
	}

	cleanPath := filepath.Clean(componentPath)
	if strings.Contains(cleanPath, "..") {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	srcPath := filepath.Join(".", cleanPath)

	if _, err := os.Stat(srcPath); os.IsNotExist(err) {
		http.Error(w, "Source file not found", http.StatusNotFound)
		return
	}

	sourceCode, err := os.ReadFile(srcPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read source file: %v", err), http.StatusInternalServerError)
		return
	}

	// Build with esbuild for rendering
	result := buildComponentForRendering(string(sourceCode), filepath.Dir(srcPath), filepath.Base(srcPath))

	if len(result.Errors) > 0 {
		errorMessages := make([]string, len(result.Errors))
		for i, err := range result.Errors {
			errorMessages[i] = fmt.Sprintf("%s:%d:%d: %s", err.Location.File, err.Location.Line, err.Location.Column, err.Text)
		}

		errorHTML := generateErrorHTML(componentPath, errorMessages)
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(errorHTML))
		return
	}

	if len(result.OutputFiles) == 0 {
		http.Error(w, "No output generated from build", http.StatusInternalServerError)
		return
	}

	// Generate HTML page for component rendering
	htmlPage := generateComponentHTML(componentName, componentPath)
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(htmlPage))
}

// handleServeModule builds and serves a React component as an ES module
func handleServeModule(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	componentPath := strings.TrimPrefix(r.URL.Path, "/module/")
	if componentPath == "" {
		http.Error(w, "Component path is required", http.StatusBadRequest)
		return
	}

	cleanPath := filepath.Clean(componentPath)
	if strings.Contains(cleanPath, "..") {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	srcPath := filepath.Join(".", cleanPath)

	if _, err := os.Stat(srcPath); os.IsNotExist(err) {
		http.Error(w, "Source file not found", http.StatusNotFound)
		return
	}

	sourceCode, err := os.ReadFile(srcPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read source file: %v", err), http.StatusInternalServerError)
		return
	}

	// Build as ES module for browser consumption
	result := buildAsESModule(string(sourceCode), filepath.Dir(srcPath), filepath.Base(srcPath))

	if len(result.Errors) > 0 {
		errorMessages := make([]string, len(result.Errors))
		for i, err := range result.Errors {
			errorMessages[i] = fmt.Sprintf("%s:%d:%d: %s", err.Location.File, err.Location.Line, err.Location.Column, err.Text)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, `{"error": "Build failed", "details": %q}`, errorMessages)
		return
	}

	if len(result.OutputFiles) == 0 {
		http.Error(w, "No output generated from build", http.StatusInternalServerError)
		return
	}

	compiledJS := string(result.OutputFiles[0].Contents)

	w.Header().Set("Content-Type", "application/javascript")
	w.Header().Set("Cache-Control", "no-cache")
	w.Write([]byte(compiledJS))
}

// getCurrentDir returns the current working directory for logging
func getCurrentDir() string {
	dir, err := os.Getwd()
	if err != nil {
		return "unknown"
	}
	return dir
}

// buildWithEsbuild performs esbuild compilation with Supabase-specific settings
func buildWithEsbuild(inputPath, outputPath string, writeToDisk bool) api.BuildResult {
	return api.Build(api.BuildOptions{
		EntryPoints: []string{inputPath},
		Loader: map[string]api.Loader{
			".js":  api.LoaderJS,
			".jsx": api.LoaderJSX,
			".ts":  api.LoaderTS,
			".tsx": api.LoaderTSX,
			".css": api.LoaderCSS,
		},
		Outfile:         outputPath,
		Format:          api.FormatESModule,
		Bundle:          true,
		Write:           writeToDisk,
		TreeShaking:     api.TreeShakingTrue,
		Target:          api.ES2020,
		JSX:             api.JSXAutomatic,
		JSXImportSource: "react",
		LogLevel:        api.LogLevelInfo,
		// Bundle all dependencies for self-contained production build
		External: []string{},
		TsconfigRaw: `{
			"compilerOptions": {
				"jsx": "react-jsx",
				"allowSyntheticDefaultImports": true,
				"esModuleInterop": true,
				"moduleResolution": "node",
				"target": "ES2020",
				"lib": ["ES2020", "DOM", "DOM.Iterable"],
				"allowJs": true,
				"skipLibCheck": true,
				"strict": false,
				"forceConsistentCasingInFileNames": true,
				"noEmit": true,
				"incremental": true,
				"resolveJsonModule": true,
				"isolatedModules": true
			}
		}`,
	})
}

// buildComponentForRendering builds a component for HTML page rendering
func buildComponentForRendering(sourceCode, resolveDir, sourcefile string) api.BuildResult {
	return api.Build(api.BuildOptions{
		Stdin: &api.StdinOptions{
			Contents:   sourceCode,
			ResolveDir: resolveDir,
			Sourcefile: sourcefile,
			Loader:     api.LoaderTSX,
		},
		Loader: map[string]api.Loader{
			".js":  api.LoaderJS,
			".jsx": api.LoaderJSX,
			".ts":  api.LoaderTS,
			".tsx": api.LoaderTSX,
			".css": api.LoaderCSS,
		},
		Format:          api.FormatESModule,
		Bundle:          true,
		Write:           false,
		TreeShaking:     api.TreeShakingTrue,
		Target:          api.ESNext,
		JSX:             api.JSXAutomatic,
		JSXImportSource: "react",
		LogLevel:        api.LogLevelSilent,
		// Bundle all dependencies for self-contained production build
		External: []string{},
		TsconfigRaw: `{
			"compilerOptions": {
				"jsx": "react-jsx",
				"allowSyntheticDefaultImports": true,
				"esModuleInterop": true,
				"moduleResolution": "node",
				"target": "ESNext",
				"lib": ["ESNext", "DOM", "DOM.Iterable"],
				"allowJs": true,
				"skipLibCheck": true,
				"strict": false,
				"forceConsistentCasingInFileNames": true,
				"noEmit": true,
				"incremental": true,
				"resolveJsonModule": true,
				"isolatedModules": true
			}
		}`,
	})
}

// buildAsESModule builds source code as an ES module for direct browser consumption
func buildAsESModule(sourceCode, resolveDir, sourcefile string) api.BuildResult {
	return api.Build(api.BuildOptions{
		Stdin: &api.StdinOptions{
			Contents:   sourceCode,
			ResolveDir: resolveDir,
			Sourcefile: sourcefile,
			Loader:     api.LoaderTSX,
		},
		Loader: map[string]api.Loader{
			".js":  api.LoaderJS,
			".jsx": api.LoaderJSX,
			".ts":  api.LoaderTS,
			".tsx": api.LoaderTSX,
			".css": api.LoaderCSS,
		},
		Format:          api.FormatESModule,
		Bundle:          true,
		Write:           false,
		TreeShaking:     api.TreeShakingTrue,
		Target:          api.ES2020,
		JSX:             api.JSXAutomatic,
		JSXImportSource: "react",
		LogLevel:        api.LogLevelSilent,
		// Bundle all dependencies for self-contained production build
		External: []string{"react", "react-dom", "react/jsx-runtime", "@supabase/supabase-js"},
		TsconfigRaw: `{
			"compilerOptions": {
				"jsx": "react-jsx",
				"allowSyntheticDefaultImports": true,
				"esModuleInterop": true,
				"moduleResolution": "node",
				"target": "ES2020",
				"lib": ["ES2020", "DOM", "DOM.Iterable"],
				"allowJs": true,
				"skipLibCheck": true,
				"strict": false,
				"forceConsistentCasingInFileNames": true,
				"noEmit": true,
				"incremental": true,
				"resolveJsonModule": true,
				"isolatedModules": true
			}
		}`,
	})
}

// generateErrorHTML creates an HTML page for displaying build errors
func generateErrorHTML(componentPath string, errors []string) string {
	errorItems := ""
	for _, err := range errors {
		errorItems += fmt.Sprintf(`<div class="error-item">%s</div>`, err)
	}

	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Build Error - Supabase CLAUDE.md Platform</title>
    <style>
        body { font-family: monospace; margin: 20px; background: #fff5f5; }
        .error { background: #fed7d7; border: 1px solid #fc8181; padding: 15px; border-radius: 5px; }
        .error h1 { color: #c53030; margin-top: 0; }
        .error-list { margin: 10px 0; }
        .error-item { margin: 5px 0; padding: 5px; background: #ffffff; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="error">
        <h1>🚨 Build Error</h1>
        <p>Failed to build component from <code>%s</code></p>
        <div class="error-list">
            %s
        </div>
        <h4>🔧 Troubleshooting:</h4>
        <ul>
            <li>Check TypeScript syntax and imports</li>
            <li>Verify all dependencies are properly exported</li>
            <li>Ensure Supabase client is correctly configured</li>
            <li>Check for circular dependencies</li>
        </ul>
    </div>
</body>
</html>`, componentPath, errorItems)
}

// generateComponentHTML creates an HTML page for rendering individual components
func generateComponentHTML(componentName, componentPath string) string {
	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%s - Supabase CLAUDE.md Platform</title>
    <script type="importmap">
    {
        "imports": {
            "react": "https://esm.sh/react@18",
            "react-dom": "https://esm.sh/react-dom@18",
            "react-dom/client": "https://esm.sh/react-dom@18/client",
            "react/jsx-runtime": "https://esm.sh/react@18/jsx-runtime",
            "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
        }
    }
    </script>
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/daisyui@5">
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <style>
        body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
        #root { width: 100%%; height: 100vh; }
        .error { 
            padding: 20px; 
            color: #dc2626; 
            background: #fef2f2; 
            border: 1px solid #fecaca; 
            margin: 20px; 
            border-radius: 8px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="module">
        try {
            const componentModule = await import('/module/%s');
            const React = await import('react');
            const ReactDOM = await import('react-dom/client');
            
            let ComponentToRender;
            if (componentModule.%s) {
                ComponentToRender = componentModule.%s;
            } else if (componentModule.default) {
                ComponentToRender = componentModule.default;
            } else {
                throw new Error('No component found. Make sure to export a component named "%s" or a default export.');
            }
            
            const root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(React.createElement(ComponentToRender));
            
        } catch (error) {
            console.error('Runtime Error:', error);
            document.getElementById('root').innerHTML = 
                '<div class="error">' +
                '<h3>Runtime Error:</h3>' +
                '<pre>' + error.message + '</pre>' +
                '<pre>' + (error.stack || '') + '</pre>' +
                '</div>';
        }
    </script>
</body>
</html>`, componentName, componentPath, componentName, componentName, componentName)
}

// generateProductionHTML creates the production HTML for the Supabase app
func generateProductionHTML() string {
	return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Supabase CLAUDE.md Platform</title>
    
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/daisyui@5">
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body>
    <div id="root">
        <div class="loading">
            <div class="spinner"></div>
            <div>Loading Supabase CLAUDE.md Platform...</div>
        </div>
    </div>
    
    <!-- Self-contained bundled application -->
    <script type="module" src="./app.js"></script>
</body>
</html>`
}

// handlePinnedDocsConfig handles GET and POST requests for pinned documents configuration
func handlePinnedDocsConfig(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	
	// Handle preflight requests
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if configManager == nil {
		http.Error(w, "Configuration manager not initialized", http.StatusInternalServerError)
		return
	}

	switch r.Method {
	case "GET":
		// Get current pinned documents configuration
		config := configManager.GetConfig("pinned-docs", db.DefaultPinnedDocsConfig())
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(config)

	case "POST":
		// Update pinned documents configuration
		var newConfig db.PinnedDocsConfig
		if err := json.NewDecoder(r.Body).Decode(&newConfig); err != nil {
			http.Error(w, "Invalid JSON body", http.StatusBadRequest)
			return
		}

		if err := configManager.SetConfig("pinned-docs", newConfig); err != nil {
			http.Error(w, fmt.Sprintf("Failed to save configuration: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(newConfig)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handlePinnedDocsToggle handles PUT requests to toggle pin status for a specific document
func handlePinnedDocsToggle(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "PUT, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	
	// Handle preflight requests
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "PUT" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if configManager == nil {
		http.Error(w, "Configuration manager not initialized", http.StatusInternalServerError)
		return
	}

	// Extract document ID from URL path
	path := strings.TrimPrefix(r.URL.Path, "/api/config/pinned-docs/")
	docID := strings.Trim(path, "/")
	
	if docID == "" {
		http.Error(w, "Document ID is required", http.StatusBadRequest)
		return
	}

	// Toggle pin status
	var isPinned bool
	err := configManager.UpdateConfig("pinned-docs", db.DefaultPinnedDocsConfig(), func(config db.PinnedDocsConfig) db.PinnedDocsConfig {
		isPinned = config.TogglePin(docID)
		return config
	})

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to update configuration: %v", err), http.StatusInternalServerError)
		return
	}

	// Return the updated status
	response := map[string]interface{}{
		"docId":    docID,
		"isPinned": isPinned,
		"success":  true,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
