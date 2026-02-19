# Nekazari Module Template

This repository provides a starter template for creating **external modules** for the Nekazari platform.

## Features

- **Runtime Injection**: Pre-configured for the IIFE Runtime Module System.
- **Vite Preset**: Uses `@nekazari/module-builder` for zero-config builds.
- **Shared Dependencies**: React, SDK, and UI-Kit are externalized automatically.
- **Tailwind CSS**: Configured with prefix and disabled preflight to avoid host conflicts.
- **TypeScript**: Full type support for SDK and host globals.

## module structure

```
my-module/
├── src/
│   ├── components/     # Your React components
│   ├── slots/          # Define where your components appear
│   └── moduleEntry.ts  # Entry point (registers module with host)
├── manifest.json       # Metadata (ID, version, etc.)
├── package.json        # Dependencies
├── vite.config.ts      # Build config (uses nkzModulePreset)
└── dist/               # Output bundle (nkz-module.js)
```

## Getting Started

1.  **Clone this repository**:
    ```bash
    git clone https://github.com/k8-benetis/nkz-module-template.git my-module
    cd my-module
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Update Config**:
    - `vite.config.ts`: Update `moduleId` to your unique ID.
    - `src/moduleEntry.ts`: Update `MODULE_ID`.
    - `manifest.json`: Update metadata (id, name, author, etc.).
    - `package.json`: Update name and version.

4.  **Develop**:
    ```bash
    npm run dev
    # Starts local Vite server at http://localhost:5003
    ```
    *Note: The local server is for testing logic components. Full integration requires the host application.*

5.  **Build**:
    ```bash
    npm run build
    # Generates dist/nkz-module.js
    ```

## Definition of Slots

Edit `src/slots/index.ts` to expose your components to the host.

Available slots:
- `map-layer`: Toolbar/widget in the map view.
- `context-panel`: Side panel widget.
- `bottom-panel`: Data table or graph area.
- `entity-tree`: Context menu or additions to the entity tree.

## Build Rules

- **JSX Runtime**: Must be `classic` (`"jsx": "react"` in tsconfig.json). The automatic runtime (`react-jsx`) emits `_jsx()` which doesn't exist on the UMD `window.React` global. The module-builder preset enforces this.
- **Externals**: React, ReactDOM, react-router-dom, @nekazari/sdk, and @nekazari/ui-kit are provided by the host as window globals. Do NOT bundle them — they are externalized automatically by the preset.
- **Output**: Single IIFE bundle at `dist/nkz-module.js`. Do NOT use Module Federation.

## CSS Guidelines

- **Tailwind**: Used by default. The configuration (prefix user `nm-`) ensures styles don't leak.
- **Custom CSS**: If writing raw CSS, ensure you verify that it is scoped locally.

## License

This template is licensed under AGPL-3.0.
