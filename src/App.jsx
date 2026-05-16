import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DEFAULT_TEMPORAL, FONT_SERIF, FONT_MONO, BORDER, PANEL_BG, atmoColor } from './constants.js';
import { makeId, placeNear, resetIdCounter } from './topology.js';
import { useHistory } from './useHistory.js';
import { exportAdventure, importAdventure, saveToStorage, loadFromStorage, normalizeTemporal } from './io.js';
import CartographerScene from './scene/CartographerScene.jsx';
import AdventureHeader from './panels/AdventureHeader.jsx';
import SelectedPanel from './panels/SelectedPanel.jsx';
import CreatePanel from './panels/CreatePanel.jsx';
import { Layer0AuditPanel, ShortcutsPanel, ConsolePanel } from './panels/Console.jsx';

export default function App() {
  const mountRef = useRef(null);
  const sceneRef = useRef({});
  const nameInputRef = useRef(null);

  // ── Core state ──
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selected, setSelected] = useState(null);
  const [adventureName, setAdventureName] = useState("Untitled Adventure");

  // ── UI state ──
  const [newName, setNewName] = useState("");
  const [newAtmo, setNewAtmo] = useState("spiritus");
  const [connType, setConnType] = useState("path");
  const [mode, setMode] = useState("create");
  const [connectFrom, setConnectFrom] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [renameBuf, setRenameBuf] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [log, setLog] = useState(["The void awaits. Name your first location."]);
  const [hoverInfo, setHoverInfo] = useState(null);

  // ── Derived ──
  const selectedNode = nodes.find(n => n.id === selected);
  const selectedEdges = selected ? edges.filter(e => e.from === selected || e.to === selected) : [];
  const orphanCount = nodes.filter(n => !edges.some(e => e.from === n.id || e.to === n.id)).length;
  const maxDeg = nodes.reduce((m, n) => Math.max(m, edges.filter(e => e.from === n.id || e.to === n.id).length), 0);
  const addLog = msg => setLog(l => [msg, ...l.slice(0, 24)]);

  // ── History ──
  const getSnapshot = useCallback(() => ({ nodes: nodes.map(n => ({ ...n })), edges: edges.map(e => ({ ...e })) }), [nodes, edges]);
  const applySnapshot = useCallback((snap) => {
    setNodes(snap.nodes); setEdges(snap.edges);
    sceneRef.current.pendingRebuild = { nodes: snap.nodes, edges: snap.edges };
  }, []);
  const { pushHistory, undo, redo, canUndo, canRedo } = useHistory(getSnapshot, applySnapshot);

  // ── Load from localStorage on mount ──
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved && saved.nodes?.length) {
      setNodes(saved.nodes);
      setEdges(saved.edges || []);
      setAdventureName(saved.name || "Untitled Adventure");
      resetIdCounter(saved.nodes);
      sceneRef.current.pendingRebuild = { nodes: saved.nodes, edges: saved.edges || [] };
      setLog(l => [`Restored: ${saved.name} (${saved.nodes.length} locations)`, ...l]);
    }
  }, []);

  // ── Auto-save to localStorage ──
  useEffect(() => {
    if (nodes.length > 0) saveToStorage(adventureName, nodes, edges);
  }, [nodes, edges, adventureName]);

  // ── Sync to scene ref ──
  useEffect(() => { sceneRef.current.selectedId = selected; }, [selected]);
  useEffect(() => { sceneRef.current._edges = edges; }, [edges]);

  // ═══ MUTATIONS ═══
  const createNode = useCallback((name, atmo, parentId) => {
    pushHistory();
    const parent = parentId ? nodes.find(n => n.id === parentId) : null;
    const pos = placeNear(parent, nodes);
    const now = Date.now();
    const node = {
      id: makeId(),
      name,
      atmosphere: atmo,
      x: pos.x,
      y: 0,
      z: pos.z,
      notes: "",
      created: now,
      temporal: { ...DEFAULT_TEMPORAL, lastChanged: now },
    };
    const nn = [...nodes, node];
    const ne = parentId ? [...edges, { from: parentId, to: node.id, type: connType }] : [...edges];
    setNodes(nn); setEdges(ne); setSelected(node.id); setNewName("");
    addLog(`+ ${name} [${atmo}]${parentId ? ` ← ${connType} → ${nodes.find(n => n.id === parentId)?.name}` : ""}`);
    sceneRef.current.pendingRebuild = { nodes: nn, edges: ne };
    sceneRef.current.focusId = node.id;
  }, [nodes, edges, connType, pushHistory]);

  const renameNode = useCallback((id, name) => {
    if (!name.trim()) return;
    pushHistory();
    const nn = nodes.map(n => n.id === id ? { ...n, name: name.trim() } : n);
    setNodes(nn); setRenaming(false);
    addLog(`✎ Renamed → ${name.trim()}`);
    sceneRef.current.pendingRebuild = { nodes: nn, edges };
  }, [nodes, edges, pushHistory]);

  const updateAtmo = useCallback((id, atmo) => {
    pushHistory();
    const nn = nodes.map(n => n.id === id ? { ...n, atmosphere: atmo } : n);
    setNodes(nn);
    addLog(`◈ ${nodes.find(n => n.id === id)?.name} → ${atmo}`);
    sceneRef.current.pendingRebuild = { nodes: nn, edges };
  }, [nodes, edges, pushHistory]);

  const updateNotes = useCallback((id, notes) => {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, notes } : n));
  }, []);

  const updateTemporal = useCallback((id, patch) => {
    pushHistory();
    const nn = nodes.map(n => n.id === id
      ? { ...n, temporal: normalizeTemporal({ ...n.temporal, ...patch, lastChanged: Date.now() }) }
      : n
    );
    setNodes(nn);
    addLog(`⌁ ${nodes.find(n => n.id === id)?.name} temporal state updated`);
    sceneRef.current.pendingRebuild = { nodes: nn, edges };
  }, [nodes, edges, pushHistory]);

  const addConnection = useCallback((fromId, toId, type) => {
    if (fromId === toId) return;
    if (edges.find(e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId))) { addLog("Already connected."); return; }
    pushHistory();
    const ne = [...edges, { from: fromId, to: toId, type }];
    setEdges(ne); setConnectFrom(null); setMode("create");
    addLog(`⟷ ${nodes.find(n => n.id === fromId)?.name} ← ${type} → ${nodes.find(n => n.id === toId)?.name}`);
    sceneRef.current.pendingRebuild = { nodes, edges: ne };
    sceneRef.current.connectMode = false;
  }, [nodes, edges, pushHistory]);

  const removeConnection = useCallback((fromId, toId) => {
    pushHistory();
    const ne = edges.filter(e => !(e.from === fromId && e.to === toId) && !(e.from === toId && e.to === fromId));
    setEdges(ne); addLog("✂ Disconnected");
    sceneRef.current.pendingRebuild = { nodes, edges: ne };
  }, [nodes, edges, pushHistory]);

  const editConnType = useCallback((fromId, toId, newType) => {
    pushHistory();
    const ne = edges.map(e => ((e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)) ? { ...e, type: newType } : e);
    setEdges(ne); addLog(`⟷ Connection → ${newType}`);
    sceneRef.current.pendingRebuild = { nodes, edges: ne };
  }, [nodes, edges, pushHistory]);

  const deleteNode = useCallback((id) => {
    pushHistory();
    const name = nodes.find(n => n.id === id)?.name;
    const nn = nodes.filter(n => n.id !== id);
    const ne = edges.filter(e => e.from !== id && e.to !== id);
    setNodes(nn); setEdges(ne); setSelected(null); setConfirmDel(null);
    addLog(`✕ Removed: ${name}`);
    sceneRef.current.pendingRebuild = { nodes: nn, edges: ne };
  }, [nodes, edges, pushHistory]);

  const startConnect = () => {
    if (!selected) return;
    setConnectFrom(selected); setMode("connect");
    addLog(`Select destination from ${selectedNode?.name}...`);
    sceneRef.current.connectMode = true;
    sceneRef.current.connectCallback = (tid) => { addConnection(selected, tid, connType); sceneRef.current.connectCallback = null; };
  };

  const cancelConnect = () => {
    setMode("create"); setConnectFrom(null);
    sceneRef.current.connectMode = false; sceneRef.current.connectCallback = null;
  };

  // ═══ IO ═══
  const handleExport = () => { exportAdventure(adventureName, nodes, edges); addLog("⬇ Exported JSON"); };
  const handleImport = () => {
    importAdventure((err, data) => {
      if (err) { addLog("Import failed: " + err.message); return; }
      pushHistory();
      setNodes(data.nodes || []); setEdges(data.edges || []);
      setAdventureName(data.name || "Imported");
      resetIdCounter(data.nodes || []);
      sceneRef.current.pendingRebuild = { nodes: data.nodes || [], edges: data.edges || [] };
      addLog(`⬆ Imported: ${data.name}`);
    });
  };

  // ═══ KEYBOARD ═══
  useEffect(() => {
    const h = (e) => {
      const inInput = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); if (undo()) addLog("↶ Undo"); return; }
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" && e.shiftKey || e.key === "y")) { e.preventDefault(); if (redo()) addLog("↷ Redo"); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleExport(); return; }
      if (inInput) return;
      if (e.key === "Escape") {
        if (mode === "connect") cancelConnect();
        else if (renaming) setRenaming(false);
        else if (confirmDel) setConfirmDel(null);
        else setSelected(null);
        return;
      }
      if (e.key === "n" || e.key === "N") { nameInputRef.current?.focus(); e.preventDefault(); return; }
      if (e.key === "r" || e.key === "R") { if (selected && selectedNode) { setRenaming(true); setRenameBuf(selectedNode.name); } return; }
      if (e.key === "c" || e.key === "C") { if (selected) startConnect(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { if (selected) setConfirmDel(selected); return; }
      if (e.key === "Tab") {
        e.preventDefault();
        if (!nodes.length) return;
        const idx = selected ? nodes.findIndex(n => n.id === selected) : -1;
        const next = e.shiftKey ? (idx <= 0 ? nodes.length - 1 : idx - 1) : (idx + 1) % nodes.length;
        setSelected(nodes[next].id);
        sceneRef.current.focusId = nodes[next].id;
        return;
      }
      if (e.key === "1") { if (selected) updateAtmo(selected, "spiritus"); return; }
      if (e.key === "2") { if (selected) updateAtmo(selected, "fermentum"); return; }
      if (e.key === "3") { if (selected) updateAtmo(selected, "pulsus"); return; }
      if (e.key === "4") { if (selected) updateAtmo(selected, "silent"); return; }
      if (e.key === "f" || e.key === "F") { if (selected) sceneRef.current.focusId = selected; return; }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  // ═══ RENDER ═══
  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", background: "#06040a", overflow: "hidden" }}>
      {/* 3D Scene */}
      <div ref={mountRef} style={{ flex: 1, position: "relative" }}>
        <CartographerScene mountRef={mountRef} sceneRef={sceneRef} setSelected={setSelected} setNodes={setNodes} setHoverInfo={setHoverInfo} />

        {/* Overlay: title + stats */}
        <div style={{ position: "absolute", top: 12, left: 16, pointerEvents: "none", userSelect: "none" }}>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 18, letterSpacing: ".2em", color: "#D4B66E" }}>The Cartographer</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#5a4e38", marginTop: 2 }}>
            layer 0 · {nodes.length} loc · {edges.length} conn
            {orphanCount > 0 && ` · ${orphanCount} orphan${orphanCount > 1 ? "s" : ""}`}
            {maxDeg > 0 && ` · hub: ${maxDeg}`}
          </div>
        </div>

        {/* Overlay: connect mode banner */}
        {mode === "connect" && (
          <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(140,31,24,0.15)", border: "1px solid rgba(140,31,24,0.2)", padding: "6px 16px", fontFamily: FONT_MONO, fontSize: 11, color: "#F0997B", borderRadius: 3 }}>
            Click destination — from {nodes.find(n => n.id === connectFrom)?.name}
            <span onClick={cancelConnect} style={{ marginLeft: 10, cursor: "pointer", color: "#8c1f18" }}>cancel</span>
          </div>
        )}

        {/* Overlay: confirm delete */}
        {confirmDel && (
          <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)", background: PANEL_BG, border: BORDER, padding: 20, fontFamily: FONT_MONO, fontSize: 11, color: "#b59850", textAlign: "center", zIndex: 10, borderRadius: 4 }}>
            <div style={{ marginBottom: 10 }}>
              Remove {nodes.find(n => n.id === confirmDel)?.name} and {edges.filter(e => e.from === confirmDel || e.to === confirmDel).length} connections?
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => deleteNode(confirmDel)} style={{ padding: "4px 10px", background: "rgba(140,31,24,0.1)", border: "1px solid rgba(140,31,24,0.15)", color: "#8c1f18", fontFamily: FONT_MONO, fontSize: 10, cursor: "pointer", borderRadius: 3 }}>Remove</button>
              <button onClick={() => setConfirmDel(null)} style={{ padding: "4px 10px", background: "rgba(181,152,80,0.06)", border: BORDER, color: "#b59850", fontFamily: FONT_MONO, fontSize: 10, cursor: "pointer", borderRadius: 3 }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Overlay: hover tooltip */}
        {hoverInfo && hoverInfo.id !== selected && (
          <div style={{ position: "absolute", left: hoverInfo.x + 12, top: hoverInfo.y - 30, background: PANEL_BG, border: BORDER, padding: "4px 10px", fontFamily: FONT_MONO, fontSize: 10, color: "#D4B66E", pointerEvents: "none", whiteSpace: "nowrap", borderRadius: 3, zIndex: 5 }}>
            {hoverInfo.name} <span style={{ color: atmoColor(hoverInfo.atmo), fontSize: 9 }}>{hoverInfo.atmo}</span> <span style={{ color: "#5a4e38", fontSize: 8 }}>{hoverInfo.conns}</span>
            {hoverInfo.temporal && <div style={{ color: "#5a4e38", fontSize: 8, marginTop: 2 }}>{hoverInfo.temporal.era} · {hoverInfo.temporal.phase} · {hoverInfo.temporal.cadence}</div>}
          </div>
        )}

        {/* Overlay: controls hint */}
        <div style={{ position: "absolute", bottom: 10, left: 16, fontFamily: FONT_MONO, fontSize: 8, color: "#3a3530", pointerEvents: "none" }}>
          drag node to reposition · click empty to deselect · Tab cycles · Ctrl+Z undo
        </div>
      </div>

      {/* Sidebar */}
      <div style={{ width: 300, background: PANEL_BG, borderLeft: BORDER, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <AdventureHeader adventureName={adventureName} setAdventureName={setAdventureName} onExport={handleExport} onImport={handleImport} />

        <SelectedPanel
          node={selectedNode} edges={selectedEdges} nodes={nodes} selected={selected}
          renaming={renaming} setRenaming={setRenaming} renameBuf={renameBuf} setRenameBuf={setRenameBuf}
          onRename={renameNode} onUpdateAtmo={updateAtmo} onUpdateNotes={updateNotes}
          onUpdateTemporal={updateTemporal}
          onEditConnType={editConnType} onRemoveConnection={removeConnection}
          onSelectNode={setSelected} onStartConnect={startConnect} onConfirmDelete={setConfirmDel}
          sceneRef={sceneRef}
        />

        <CreatePanel
          selected={selected} selectedNode={selectedNode} nodes={nodes}
          newName={newName} setNewName={setNewName} newAtmo={newAtmo} setNewAtmo={setNewAtmo}
          connType={connType} setConnType={setConnType}
          onCreate={createNode} onDeselect={() => setSelected(null)} nameInputRef={nameInputRef}
        />

        <Layer0AuditPanel nodes={nodes} edges={edges} />
        <ShortcutsPanel />
        <ConsolePanel log={log} />
      </div>
    </div>
  );
}
