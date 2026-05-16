# The Cartographer — Layer 0

World-building tool for creating and navigating adventure topologies. Build locations, connect them, set their temporal atmosphere, and see the structure grow in 3D.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Your adventure auto-saves to localStorage.

For another device on the same network:

```bash
npm run dev:network
```

Vite will print the network URL to open.

## Architecture

```
src/
  constants.js                 Atmosphere types, connection types, colors, style tokens
  animancy.js                  Spiritus, Fermentum, Inter — the motion primitives
  topology.js                  Node ID generation, spatial placement
  useHistory.js                Undo/redo hook (40-deep stack)
  io.js                        Export/import JSON, localStorage persistence
  scene/
    CartographerScene.jsx      Three.js — nodes, edges, camera, raycasting, drag, animation
  panels/
    AdventureHeader.jsx        Adventure name + export/import
    SelectedPanel.jsx          Selected node info, rename, atmosphere, notes, connections
    CreatePanel.jsx            New location form
    Console.jsx                Log output + shortcuts reference
  App.jsx                      Orchestrator — state, keyboard, mutations, layout
  main.jsx                     React entry
```

## Keyboard

| Key | Action |
|-----|--------|
| N | Focus name input |
| R | Rename selected |
| C | Connect from selected |
| 1-4 | Set atmosphere |
| Tab / Shift+Tab | Cycle nodes |
| Delete | Remove (with confirmation) |
| F | Focus camera |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+S | Export JSON |
| Escape | Cancel / deselect |

## Mouse

- **Click node** → select
- **Click selected node + drag** → reposition
- **Click empty** → deselect
- **Drag empty** → orbit camera
- **Scroll** → zoom

## Features

- Undo/redo with 40-deep history
- Inline rename (double-click)
- Drag to reposition nodes
- Edit/remove individual connections
- Confirm before delete
- Export/import JSON adventures
- Auto-save to localStorage
- Hover tooltips with name, atmosphere, connection count
- Orphan warnings (red rim, panel indicator)
- Node size scales with connection count
- Connection line colors by type
- Secret connections as dashed lines
- Blocked connections with X marker
- Fermentum steady when deselected, shimmers only when focused
- Topology stats (locations, connections, orphans, hub degree)
