import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

const spiritus = (t, f, a) => Math.sin(t * f * Math.PI * 2) * a;
const fermentum = (t, s) => { const x = t * s; return (Math.sin(x * 127.1 + Math.cos(x * 311.7)) * 0.5 + 0.5) * 2 - 1; };
const inter = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

const ATMOS = [
  { id: "spiritus", label: "Spiritus", key: "1", color: "#5DCAA5", hex: 0x5dcaa5, desc: "Steady, breathing" },
  { id: "fermentum", label: "Fermentum", key: "2", color: "#F0997B", hex: 0xf0997b, desc: "Chaotic, unsettled" },
  { id: "pulsus", label: "Pulsus", key: "3", color: "#85B7EB", hex: 0x85b7eb, desc: "Cyclic, haunted" },
  { id: "silent", label: "Silent", key: "4", color: "#4a4a4a", hex: 0x4a4a4a, desc: "Dead, abandoned" },
];
const CONN_TYPES = ["path","street","gate","tunnel","descent","river","bridge","secret","blocked"];
const CONN_COLORS = { path:0xb59850, street:0xd4b66e, gate:0xd4b66e, tunnel:0x6a5a40, descent:0x8c1f18, river:0x4a7aaa, bridge:0xd4b66e, secret:0x8c1f18, blocked:0x4a4a4a };
const atmoHex = a => ATMOS.find(x => x.id === a)?.hex || 0xb59850;
const atmoColor = a => ATMOS.find(x => x.id === a)?.color || "#b59850";

let _nid = 1;
function mkId() { return "loc_" + (_nid++); }
function placeNear(parent, nodes) {
  if (!parent) return { x: 0, y: 0, z: 0 };
  const a = Math.random() * Math.PI * 2, d = 2.5 + Math.random() * 1.5;
  const c = { x: parent.x + Math.cos(a) * d, y: 0, z: parent.z + Math.sin(a) * d };
  nodes.forEach(n => { const dx = c.x - n.x, dz = c.z - n.z, dist = Math.sqrt(dx * dx + dz * dz); if (dist < 2) { c.x += (dx / dist) * (2 - dist); c.z += (dz / dist) * (2 - dist); } });
  return c;
}

export default function CartographerQoL() {
  const mountRef = useRef(null);
  const sceneRef = useRef({});
  const nameInputRef = useRef(null);
  const renameInputRef = useRef(null);

  // Core
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selected, setSelected] = useState(null);
  const [adventureName, setAdventureName] = useState("Untitled Adventure");

  // History
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  // UI
  const [newName, setNewName] = useState("");
  const [newAtmo, setNewAtmo] = useState("spiritus");
  const [connType, setConnType] = useState("path");
  const [mode, setMode] = useState("create");
  const [connectFrom, setConnectFrom] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [renameBuf, setRenameBuf] = useState("");
  const [noteBuf, setNoteBuf] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [log, setLog] = useState(["The void awaits. Name your first location."]);
  const [hoverInfo, setHoverInfo] = useState(null);

  const selectedNode = nodes.find(n => n.id === selected);
  const selectedEdges = selected ? edges.filter(e => e.from === selected || e.to === selected) : [];
  const orphanCount = nodes.filter(n => !edges.some(e => e.from === n.id || e.to === n.id)).length;
  const maxDeg = nodes.reduce((m, n) => Math.max(m, edges.filter(e => e.from === n.id || e.to === n.id).length), 0);
  const addLog = msg => setLog(l => [msg, ...l.slice(0, 24)]);

  // ═══ HISTORY ═══
  const snap = () => ({ nodes: nodes.map(n => ({ ...n })), edges: edges.map(e => ({ ...e })) });
  const pushH = useCallback(() => { setHistory(h => [snap(), ...h].slice(0, 40)); setFuture([]); }, [nodes, edges]);

  const undo = useCallback(() => {
    if (!history.length) return;
    setFuture(f => [snap(), ...f]);
    const prev = history[0]; setHistory(h => h.slice(1));
    setNodes(prev.nodes); setEdges(prev.edges);
    sceneRef.current.pendingRebuild = { nodes: prev.nodes, edges: prev.edges };
    addLog("↶ Undo");
  }, [history, nodes, edges]);

  const redo = useCallback(() => {
    if (!future.length) return;
    setHistory(h => [snap(), ...h]);
    const next = future[0]; setFuture(f => f.slice(1));
    setNodes(next.nodes); setEdges(next.edges);
    sceneRef.current.pendingRebuild = { nodes: next.nodes, edges: next.edges };
    addLog("↷ Redo");
  }, [future, nodes, edges]);

  // ═══ MUTATIONS ═══
  const createNode = useCallback((name, atmo, parentId) => {
    pushH();
    const parent = parentId ? nodes.find(n => n.id === parentId) : null;
    const pos = placeNear(parent, nodes);
    const node = { id: mkId(), name, atmosphere: atmo, x: pos.x, y: 0, z: pos.z, notes: "", created: Date.now() };
    const nn = [...nodes, node];
    const ne = parentId ? [...edges, { from: parentId, to: node.id, type: connType }] : [...edges];
    setNodes(nn); setEdges(ne); setSelected(node.id); setNewName("");
    addLog(`+ ${name} [${atmo}]${parentId ? ` ← ${connType} → ${nodes.find(n => n.id === parentId)?.name}` : ""}`);
    sceneRef.current.pendingRebuild = { nodes: nn, edges: ne };
    sceneRef.current.focusId = node.id;
  }, [nodes, edges, connType, pushH]);

  const renameNode = useCallback((id, name) => {
    if (!name.trim()) return;
    pushH();
    const nn = nodes.map(n => n.id === id ? { ...n, name: name.trim() } : n);
    setNodes(nn); setRenaming(false);
    addLog(`✎ Renamed → ${name.trim()}`);
    sceneRef.current.pendingRebuild = { nodes: nn, edges };
  }, [nodes, edges, pushH]);

  const updateAtmo = useCallback((id, atmo) => {
    pushH();
    const nn = nodes.map(n => n.id === id ? { ...n, atmosphere: atmo } : n);
    setNodes(nn);
    addLog(`◈ ${nodes.find(n => n.id === id)?.name} → ${atmo}`);
    sceneRef.current.pendingRebuild = { nodes: nn, edges };
  }, [nodes, edges, pushH]);

  const updateNotes = useCallback((id, notes) => {
    const nn = nodes.map(n => n.id === id ? { ...n, notes } : n);
    setNodes(nn);
  }, [nodes]);

  const addConnection = useCallback((fromId, toId, type) => {
    if (fromId === toId) return;
    if (edges.find(e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId))) { addLog("Already connected."); return; }
    pushH();
    const ne = [...edges, { from: fromId, to: toId, type }];
    setEdges(ne); setConnectFrom(null); setMode("create");
    addLog(`⟷ ${nodes.find(n => n.id === fromId)?.name} ← ${type} → ${nodes.find(n => n.id === toId)?.name}`);
    sceneRef.current.pendingRebuild = { nodes, edges: ne };
    sceneRef.current.connectMode = false;
  }, [nodes, edges, pushH]);

  const removeConnection = useCallback((fromId, toId) => {
    pushH();
    const ne = edges.filter(e => !(e.from === fromId && e.to === toId) && !(e.from === toId && e.to === fromId));
    setEdges(ne);
    addLog(`✂ Disconnected`);
    sceneRef.current.pendingRebuild = { nodes, edges: ne };
  }, [nodes, edges, pushH]);

  const editConnType = useCallback((fromId, toId, newType) => {
    pushH();
    const ne = edges.map(e => ((e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)) ? { ...e, type: newType } : e);
    setEdges(ne);
    addLog(`⟷ Connection → ${newType}`);
    sceneRef.current.pendingRebuild = { nodes, edges: ne };
  }, [nodes, edges, pushH]);

  const deleteNode = useCallback((id) => {
    pushH();
    const name = nodes.find(n => n.id === id)?.name;
    const nn = nodes.filter(n => n.id !== id);
    const ne = edges.filter(e => e.from !== id && e.to !== id);
    setNodes(nn); setEdges(ne); setSelected(null); setConfirmDel(null);
    addLog(`✕ Removed: ${name}`);
    sceneRef.current.pendingRebuild = { nodes: nn, edges: ne };
  }, [nodes, edges, pushH]);

  const startConnect = () => {
    if (!selected) return;
    setConnectFrom(selected); setMode("connect");
    addLog(`Select destination from ${selectedNode?.name}...`);
    sceneRef.current.connectMode = true;
    sceneRef.current.connectCallback = (tid) => { addConnection(selected, tid, connType); sceneRef.current.connectCallback = null; };
  };

  const cancelConnect = () => { setMode("create"); setConnectFrom(null); sceneRef.current.connectMode = false; sceneRef.current.connectCallback = null; };

  // ═══ EXPORT / IMPORT ═══
  const exportJSON = () => {
    const data = { version: "layer0", name: adventureName, created: new Date().toISOString(), nodes, edges };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${adventureName.replace(/\s+/g, "_").toLowerCase()}.json`; a.click();
    URL.revokeObjectURL(url); addLog("⬇ Exported JSON");
  };
  const importJSON = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json";
    input.onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader();
      r.onload = ev => { try { const d = JSON.parse(ev.target.result); pushH(); setNodes(d.nodes || []); setEdges(d.edges || []); setAdventureName(d.name || "Imported"); _nid = Math.max(...(d.nodes || []).map(n => parseInt(n.id.split("_")[1]) || 0), 0) + 1; sceneRef.current.pendingRebuild = { nodes: d.nodes || [], edges: d.edges || [] }; addLog(`⬆ Imported: ${d.name}`); } catch(err) { addLog("Import failed: " + err.message); } };
      r.readAsText(f); };
    input.click();
  };

  // ═══ THREE.JS ═══
  useEffect(() => {
    const el = mountRef.current; if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x06040a); scene.fog = new THREE.FogExp2(0x06040a, 0.02);
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 200);
    camera.position.set(0, 8, 10);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; el.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0x181410, 0.4));
    const light = new THREE.PointLight(0xd4b66e, 0.8, 30); light.position.set(0, 8, 0); scene.add(light);
    scene.add(new THREE.GridHelper(30, 30, 0x1a1610, 0x0e0c08));
    const dN = 200, dp = new Float32Array(dN * 3);
    for (let i = 0; i < dN; i++) { dp[i * 3] = (Math.random() - .5) * 20; dp[i * 3 + 1] = Math.random() * 8; dp[i * 3 + 2] = (Math.random() - .5) * 20; }
    const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute("position", new THREE.BufferAttribute(dp, 3));
    scene.add(new THREE.Points(dGeo, new THREE.PointsMaterial({ color: 0xb59850, size: 0.04, transparent: true, opacity: 0.2 })));

    let meshMap = {}, lineObjs = [];
    const worldGroup = new THREE.Group(); scene.add(worldGroup);

    function rebuild(data) {
      while (worldGroup.children.length) worldGroup.remove(worldGroup.children[0]);
      meshMap = {}; lineObjs = [];
      data.nodes.forEach(node => {
        const col = new THREE.Color(atmoHex(node.atmosphere));
        const isOrphan = !data.edges.some(e => e.from === node.id || e.to === node.id);
        const degCount = data.edges.filter(e => e.from === node.id || e.to === node.id).length;
        const sz = 0.15 + Math.min(degCount * 0.015, 0.08);
        const platGeo = new THREE.CylinderGeometry(0.75 + degCount * 0.04, 0.8 + degCount * 0.04, 0.08, 24);
        const platMat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.5, roughness: 0.4, transparent: true, opacity: isOrphan ? 0.15 : 0.3 });
        const plat = new THREE.Mesh(platGeo, platMat); plat.position.set(node.x, -0.04, node.z); worldGroup.add(plat);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.75 + degCount * 0.04, isOrphan ? 0.008 : 0.015, 6, 48), new THREE.MeshBasicMaterial({ color: isOrphan ? 0x8c1f18 : col, transparent: true, opacity: isOrphan ? 0.4 : 0.2 }));
        rim.rotation.x = Math.PI / 2; rim.position.set(node.x, 0, node.z); worldGroup.add(rim);
        const mGeo = new THREE.SphereGeometry(sz, 12, 8);
        const mMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3, metalness: 0.4, roughness: 0.3 });
        const marker = new THREE.Mesh(mGeo, mMat); marker.position.set(node.x, 0.4, node.z); worldGroup.add(marker);
        meshMap[node.id] = { marker, mat: mMat, plat, platMat, node, isOrphan };
      });
      data.edges.forEach(e => {
        const from = data.nodes.find(n => n.id === e.from), to = data.nodes.find(n => n.id === e.to);
        if (!from || !to) return;
        const isDescent = e.type === "descent" || e.type === "tunnel";
        const pts = isDescent ? [new THREE.Vector3(from.x, .1, from.z), new THREE.Vector3((from.x + to.x) / 2, -.5, (from.z + to.z) / 2), new THREE.Vector3(to.x, .1, to.z)] : [new THREE.Vector3(from.x, .1, from.z), new THREE.Vector3(to.x, .1, to.z)];
        const lc = CONN_COLORS[e.type] || 0xb59850;
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        let lm, line;
        if (e.type === "secret") {
          geo.computeLineDistances();
          lm = new THREE.LineDashedMaterial({ color: lc, transparent: true, opacity: 0.14, dashSize: 0.15, gapSize: 0.12 });
          line = new THREE.Line(geo, lm);
        } else {
          lm = new THREE.LineBasicMaterial({ color: lc, transparent: true, opacity: 0.12 });
          line = new THREE.Line(geo, lm);
        }
        worldGroup.add(line); lineObjs.push({ line, mat: lm, from: e.from, to: e.to });
        if (e.type === "blocked") {
          const mx = (from.x + to.x) / 2, mz = (from.z + to.z) / 2;
          const blockSize = 0.12;
          const arm1 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(mx - blockSize, 0.2, mz - blockSize), new THREE.Vector3(mx + blockSize, 0.2, mz + blockSize)]), new THREE.LineBasicMaterial({ color: 0xaa3333, linewidth: 2 }));
          const arm2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(mx + blockSize, 0.2, mz - blockSize), new THREE.Vector3(mx - blockSize, 0.2, mz + blockSize)]), new THREE.LineBasicMaterial({ color: 0xaa3333, linewidth: 2 }));
          worldGroup.add(arm1, arm2);
          const blockDot = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({ color: 0xaa3333, emissive: 0xaa3333, emissiveIntensity: 0.5 }));
          blockDot.position.set(mx, 0.2, mz);
          worldGroup.add(blockDot);
        }
      });
      if (data.nodes.length) { const cx = data.nodes.reduce((s, n) => s + n.x, 0) / data.nodes.length; const cz = data.nodes.reduce((s, n) => s + n.z, 0) / data.nodes.length; light.position.set(cx, 8, cz); }
    }

    sceneRef.current = { meshMap, pendingRebuild: null, selectedId: null, connectMode: false, connectCallback: null, focusId: null };

    let theta = 0, phi = 0.5, radius = 12, drag = false, lx = 0, ly = 0;
    let gx = 0, gz = 0, tx = 0, tz = 0;
    let draggingNode = null, dragStart = null;
    const cvs = renderer.domElement;
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(99, 99);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const groundPt = new THREE.Vector3();

    cvs.addEventListener("mousemove", e => {
      const r = cvs.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      if (draggingNode) {
        ray.setFromCamera(mouse, camera);
        if (ray.ray.intersectPlane(groundPlane, groundPt)) {
          const entry = meshMap[draggingNode];
          if (entry) { entry.marker.position.x = groundPt.x; entry.marker.position.z = groundPt.z; entry.plat.position.x = groundPt.x; entry.plat.position.z = groundPt.z; entry.node.x = groundPt.x; entry.node.z = groundPt.z; }
          // rebuild lines
          sceneRef.current.pendingRebuild = { nodes: Object.values(meshMap).map(m => m.node), edges: sceneRef.current._edges || [] };
        }
        return;
      }
      if (drag) { theta -= (e.clientX - lx) * 0.005; phi = Math.max(0.1, Math.min(1.3, phi - (e.clientY - ly) * 0.005)); lx = e.clientX; ly = e.clientY; return; }
      // Hover detection
      ray.setFromCamera(mouse, camera);
      const targets = Object.values(meshMap).map(m => m.marker);
      const hits = ray.intersectObjects(targets);
      if (hits.length) {
        const entry = Object.entries(meshMap).find(([_, v]) => v.marker === hits[0].object);
        if (entry) { const n = entry[1].node; const rc = cvs.getBoundingClientRect(); setHoverInfo({ name: n.name, atmo: n.atmosphere, conns: (sceneRef.current._edges || []).filter(e => e.from === n.id || e.to === n.id).length, x: e.clientX - rc.left, y: e.clientY - rc.top, id: n.id }); }
      } else { setHoverInfo(null); }
    });

    cvs.addEventListener("mousedown", e => {
      lx = e.clientX; ly = e.clientY;
      ray.setFromCamera(mouse, camera);
      const targets = Object.values(meshMap).map(m => m.marker);
      const hits = ray.intersectObjects(targets);
      if (hits.length) {
        const entry = Object.entries(meshMap).find(([_, v]) => v.marker === hits[0].object);
        if (entry && entry[0] === sceneRef.current.selectedId && !sceneRef.current.connectMode) {
          draggingNode = entry[0]; dragStart = { x: entry[1].node.x, z: entry[1].node.z }; return;
        }
      }
      drag = true;
    });

    window.addEventListener("mouseup", () => {
      if (draggingNode && dragStart) {
        const entry = meshMap[draggingNode];
        if (entry && (Math.abs(entry.node.x - dragStart.x) > 0.1 || Math.abs(entry.node.z - dragStart.z) > 0.1)) {
          // Position changed — commit
          setNodes(ns => ns.map(n => n.id === draggingNode ? { ...n, x: entry.node.x, z: entry.node.z } : n));
        }
      }
      draggingNode = null; dragStart = null; drag = false;
    });

    cvs.addEventListener("click", e => {
      if (draggingNode) return;
      ray.setFromCamera(mouse, camera);
      const targets = Object.values(meshMap).map(m => m.marker);
      const hits = ray.intersectObjects(targets);
      if (hits.length) {
        const entry = Object.entries(meshMap).find(([_, v]) => v.marker === hits[0].object);
        if (entry) {
          const id = entry[0];
          if (sceneRef.current.connectMode) { sceneRef.current.connectCallback?.(id); }
          else { setSelected(id); gx = entry[1].node.x; gz = entry[1].node.z; }
        }
      } else { setSelected(null); }
    });

    cvs.addEventListener("wheel", e => { radius = Math.max(4, Math.min(25, radius + e.deltaY * 0.02)); }, { passive: true });
    cvs.addEventListener("touchstart", e => { if (e.touches.length) { drag = true; lx = e.touches[0].clientX; ly = e.touches[0].clientY; } }, { passive: true });
    window.addEventListener("touchend", () => { drag = false; });
    window.addEventListener("touchmove", e => { if (!drag || !e.touches.length) return; theta -= (e.touches[0].clientX - lx) * 0.005; phi = Math.max(0.1, Math.min(1.3, phi - (e.touches[0].clientY - ly) * 0.005)); lx = e.touches[0].clientX; ly = e.touches[0].clientY; }, { passive: true });

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const t = clock.getElapsedTime();
      if (sceneRef.current.pendingRebuild) { rebuild(sceneRef.current.pendingRebuild); sceneRef.current._edges = sceneRef.current.pendingRebuild.edges; meshMap = sceneRef.current.meshMap = { ...meshMap }; sceneRef.current.pendingRebuild = null; }
      if (sceneRef.current.focusId) { const m = meshMap[sceneRef.current.focusId]; if (m) { gx = m.node.x; gz = m.node.z; radius = Math.min(radius, 8); } sceneRef.current.focusId = null; }
      tx += (gx - tx) * 0.04; tz += (gz - tz) * 0.04;
      camera.position.x = tx + Math.sin(theta) * Math.cos(phi) * radius;
      camera.position.y = Math.sin(phi) * radius * 0.6 + 2;
      camera.position.z = tz + Math.cos(theta) * Math.cos(phi) * radius;
      camera.lookAt(tx, 0, tz);
      const selId = sceneRef.current.selectedId;
      Object.entries(meshMap).forEach(([id, { marker, mat, node, isOrphan }]) => {
        if (!node) return;
        let ei = 0.2;
        if (node.atmosphere === "spiritus") ei = 0.25 + spiritus(t, 0.2, 0.12);
        else if (node.atmosphere === "fermentum") ei = 0.22;
        else if (node.atmosphere === "pulsus") ei = 0.15 + Math.max(0, spiritus(t, 0.08, 0.2));
        else ei = 0.05;
        if (id === selId) {
          if (node.atmosphere === "fermentum") ei = 0.5 + fermentum(t, 1.0) * 0.06;
          else ei = Math.max(ei, 0.6 + spiritus(t, 0.8, 0.2));
        }
        mat.emissiveIntensity = ei;
        if (!draggingNode || draggingNode !== id) marker.position.y = 0.4 + spiritus(t + node.x, 0.12, 0.02);
      });
      lineObjs.forEach(({ mat, from, to }) => { mat.opacity = inter(mat.opacity, from === selId || to === selId ? 0.35 : 0.1, 0.06); });
      const dpos = dGeo.attributes.position.array;
      for (let i = 0; i < dN; i++) { dpos[i * 3 + 1] += 0.002; if (dpos[i * 3 + 1] > 8) dpos[i * 3 + 1] = 0; }
      dGeo.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    });
    const onR = () => { camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(el.clientWidth, el.clientHeight); };
    window.addEventListener("resize", onR);
    return () => { renderer.setAnimationLoop(null); renderer.dispose(); if (cvs.parentNode) cvs.parentNode.removeChild(cvs); window.removeEventListener("resize", onR); };
  }, []);

  useEffect(() => { sceneRef.current.selectedId = selected; }, [selected]);
  useEffect(() => { sceneRef.current._edges = edges; }, [edges]);

  // ═══ KEYBOARD ═══
  useEffect(() => { const h = e => {
    const inInput = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === "y") { e.preventDefault(); redo(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); exportJSON(); return; }
    if (inInput) return;
    if (e.key === "Escape") { if (mode === "connect") cancelConnect(); else if (renaming) setRenaming(false); else if (confirmDel) setConfirmDel(null); else setSelected(null); return; }
    if (e.key === "n" || e.key === "N") { nameInputRef.current?.focus(); e.preventDefault(); return; }
    if (e.key === "r" || e.key === "R") { if (selected && selectedNode) { setRenaming(true); setRenameBuf(selectedNode.name); setTimeout(() => renameInputRef.current?.focus(), 50); } return; }
    if (e.key === "c" || e.key === "C") { if (selected) startConnect(); return; }
    if (e.key === "Delete" || e.key === "Backspace") { if (selected) setConfirmDel(selected); return; }
    if (e.key === "Tab") { e.preventDefault(); if (!nodes.length) return; const idx = selected ? nodes.findIndex(n => n.id === selected) : -1; const next = e.shiftKey ? (idx <= 0 ? nodes.length - 1 : idx - 1) : (idx + 1) % nodes.length; setSelected(nodes[next].id); sceneRef.current.focusId = nodes[next].id; return; }
    if (e.key === "1") { if (selected) updateAtmo(selected, "spiritus"); return; }
    if (e.key === "2") { if (selected) updateAtmo(selected, "fermentum"); return; }
    if (e.key === "3") { if (selected) updateAtmo(selected, "pulsus"); return; }
    if (e.key === "4") { if (selected) updateAtmo(selected, "silent"); return; }
    if (e.key === "f" || e.key === "F") { if (selected) sceneRef.current.focusId = selected; return; }
  }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); });

  const F = "'Cormorant Garamond',Georgia,serif", M = "ui-monospace,'SF Mono',Menlo,monospace";
  const bdr = "1px solid rgba(181,152,80,0.12)", panelBg = "rgba(8,6,10,0.95)";
  const inputStyle = { width: "100%", background: "rgba(181,152,80,0.05)", border: bdr, color: "#D4B66E", fontFamily: M, fontSize: 12, padding: "6px 10px", outline: "none", borderRadius: 3, boxSizing: "border-box" };
  const btn = (label, action, opts = {}) => <button key={label} onClick={action} disabled={opts.disabled} style={{ padding: "4px 10px", background: opts.accent ? "rgba(212,166,110,0.12)" : opts.danger ? "rgba(140,31,24,0.1)" : "rgba(181,152,80,0.06)", border: opts.danger ? "1px solid rgba(140,31,24,0.15)" : bdr, color: opts.disabled ? "#3a3530" : opts.danger ? "#8c1f18" : opts.accent ? "#D4B66E" : "#b59850", fontFamily: M, fontSize: opts.small ? 9 : 10, cursor: opts.disabled ? "default" : "pointer", borderRadius: 3, opacity: opts.disabled ? 0.5 : 1 }}>{label}</button>;

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", background: "#06040a", overflow: "hidden" }}>
      {/* 3D */}
      <div ref={mountRef} style={{ flex: 1, position: "relative" }}>
        <div style={{ position: "absolute", top: 12, left: 16, pointerEvents: "none", userSelect: "none" }}>
          <div style={{ fontFamily: F, fontSize: 18, letterSpacing: ".2em", color: "#D4B66E" }}>The Cartographer</div>
          <div style={{ fontFamily: M, fontSize: 9, color: "#5a4e38", marginTop: 2 }}>
            layer 0 · {nodes.length} loc · {edges.length} conn{orphanCount > 0 ? ` · ${orphanCount} orphan${orphanCount > 1 ? "s" : ""}` : ""}{maxDeg > 0 ? ` · hub: ${maxDeg}` : ""}
          </div>
        </div>
        {mode === "connect" && <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(140,31,24,0.15)", border: "1px solid rgba(140,31,24,0.2)", padding: "6px 16px", fontFamily: M, fontSize: 11, color: "#F0997B", borderRadius: 3 }}>
          Click destination — from {nodes.find(n => n.id === connectFrom)?.name} <span onClick={cancelConnect} style={{ marginLeft: 10, cursor: "pointer", color: "#8c1f18" }}>cancel</span>
        </div>}
        {confirmDel && <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)", background: panelBg, border: bdr, padding: 20, fontFamily: M, fontSize: 11, color: "#b59850", textAlign: "center", zIndex: 10, borderRadius: 4 }}>
          <div style={{ marginBottom: 10 }}>Remove {nodes.find(n => n.id === confirmDel)?.name} and {edges.filter(e => e.from === confirmDel || e.to === confirmDel).length} connections?</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>{btn("Remove", () => deleteNode(confirmDel), { danger: true })} {btn("Cancel", () => setConfirmDel(null))}</div>
        </div>}
        {hoverInfo && hoverInfo.id !== selected && <div style={{ position: "absolute", left: hoverInfo.x + 12, top: hoverInfo.y - 30, background: panelBg, border: bdr, padding: "4px 10px", fontFamily: M, fontSize: 10, color: "#D4B66E", pointerEvents: "none", whiteSpace: "nowrap", borderRadius: 3, zIndex: 5 }}>
          {hoverInfo.name} <span style={{ color: atmoColor(hoverInfo.atmo), fontSize: 9 }}>{hoverInfo.atmo}</span> <span style={{ color: "#5a4e38", fontSize: 8 }}>{hoverInfo.conns}</span>
        </div>}
        <div style={{ position: "absolute", bottom: 10, left: 16, fontFamily: M, fontSize: 8, color: "#3a3530", pointerEvents: "none" }}>
          drag node to reposition · click empty to deselect · Tab cycles · Ctrl+Z undo
        </div>
      </div>

      {/* PANEL */}
      <div style={{ width: 300, background: panelBg, borderLeft: bdr, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {/* Adventure name */}
        <div style={{ padding: "10px 16px", borderBottom: bdr, display: "flex", alignItems: "center", gap: 8 }}>
          <input value={adventureName} onChange={e => setAdventureName(e.target.value)} style={{ ...inputStyle, fontFamily: F, fontSize: 14, letterSpacing: ".08em", background: "transparent", border: "none", padding: 0 }} />
          <div style={{ display: "flex", gap: 4 }}>
            {btn("⬇", exportJSON, { small: true })}
            {btn("⬆", importJSON, { small: true })}
          </div>
        </div>

        {/* Selected */}
        {selectedNode && <div style={{ padding: "10px 16px", borderBottom: bdr }}>
          {renaming ? <input ref={renameInputRef} value={renameBuf} onChange={e => setRenameBuf(e.target.value)} onKeyDown={e => { if (e.key === "Enter") renameNode(selected, renameBuf); if (e.key === "Escape") setRenaming(false); }} onBlur={() => { if (renameBuf.trim()) renameNode(selected, renameBuf); }} style={inputStyle} />
            : <div onDoubleClick={() => { setRenaming(true); setRenameBuf(selectedNode.name); setTimeout(() => renameInputRef.current?.focus(), 50); }} style={{ fontFamily: F, fontSize: 15, color: "#D4B66E", cursor: "text", marginBottom: 4 }}>{selectedNode.name} <span style={{ fontSize: 9, color: "#5a4e38", fontFamily: M }}>dbl-click to rename</span></div>}
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", margin: "6px 0" }}>
            {ATMOS.map(a => <button key={a.id} onClick={() => updateAtmo(selected, a.id)} title={`${a.desc} [${a.key}]`} style={{ padding: "2px 7px", fontSize: 9, fontFamily: M, cursor: "pointer", borderRadius: 2, background: selectedNode.atmosphere === a.id ? "rgba(181,152,80,0.15)" : "transparent", border: selectedNode.atmosphere === a.id ? `1px solid ${a.color}` : bdr, color: a.color }}>{a.label}</button>)}
          </div>
          <textarea value={selectedNode.notes || ""} onChange={e => updateNotes(selected, e.target.value)} placeholder="Notes..." rows={2} style={{ ...inputStyle, fontSize: 10, resize: "vertical", minHeight: 36 }} />
          {selectedEdges.length > 0 && <div style={{ marginTop: 8 }}>
            <div style={{ fontFamily: M, fontSize: 8, color: "#5a4e38", marginBottom: 4 }}>CONNECTIONS ({selectedEdges.length})</div>
            {selectedEdges.map((e, i) => {
              const oid = e.from === selected ? e.to : e.from;
              const other = nodes.find(n => n.id === oid);
              return <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                <span onClick={() => { setSelected(oid); sceneRef.current.focusId = oid; }} style={{ cursor: "pointer", fontFamily: M, fontSize: 10, color: "#b59850", flex: 1 }}>→ {other?.name}</span>
                <select value={e.type} onChange={ev => editConnType(e.from, e.to, ev.target.value)} style={{ background: "#0a0806", border: bdr, color: "#b59850", fontFamily: M, fontSize: 8, padding: "1px 3px" }}>
                  {CONN_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                </select>
                <span onClick={() => removeConnection(e.from, e.to)} style={{ cursor: "pointer", color: "#8c1f18", fontSize: 11, padding: "0 2px" }} title="Remove connection">✕</span>
              </div>;
            })}
          </div>}
          {nodes.find(n => n.id === selected && !edges.some(e => e.from === n.id || e.to === n.id)) && <div style={{ fontFamily: M, fontSize: 9, color: "#8c1f18", marginTop: 6, opacity: 0.8 }}>⚠ Orphan — no connections</div>}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
            {btn("Connect to...", startConnect)} {btn("Remove", () => setConfirmDel(selected), { danger: true })}
          </div>
        </div>}

        {/* Create */}
        <div style={{ padding: "10px 16px", borderBottom: bdr }}>
          <div style={{ fontFamily: M, fontSize: 9, color: "#5a4e38", marginBottom: 4 }}>{selected ? `NEW FROM ${selectedNode?.name?.toUpperCase()}` : nodes.length ? "NEW STANDALONE" : "FIRST LOCATION"}</div>
          <input ref={nameInputRef} value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { if (newName.trim()) createNode(newName.trim(), newAtmo, selected); } }} placeholder="Location name... [N]" style={inputStyle} />
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", margin: "6px 0" }}>
            {ATMOS.map(a => <button key={a.id} onClick={() => setNewAtmo(a.id)} style={{ padding: "2px 7px", fontSize: 9, fontFamily: M, cursor: "pointer", borderRadius: 2, background: newAtmo === a.id ? "rgba(181,152,80,0.15)" : "transparent", border: newAtmo === a.id ? `1px solid ${a.color}` : bdr, color: a.color }}>{a.label}</button>)}
          </div>
          {selected && <div style={{ marginBottom: 6 }}>
            <div style={{ fontFamily: M, fontSize: 8, color: "#5a4e38", marginBottom: 3 }}>VIA</div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {CONN_TYPES.map(ct => <button key={ct} onClick={() => setConnType(ct)} style={{ padding: "2px 5px", fontSize: 8, fontFamily: M, cursor: "pointer", borderRadius: 2, background: connType === ct ? "rgba(181,152,80,0.12)" : "transparent", border: connType === ct ? bdr : "1px solid transparent", color: connType === ct ? "#D4B66E" : "#5a4e38" }}>{ct}</button>)}
            </div>
          </div>}
          {btn(selected ? `Create & connect` : "Create", () => { if (newName.trim()) createNode(newName.trim(), newAtmo, selected); }, { accent: true, disabled: !newName.trim() })}
          {selected && <span style={{ marginLeft: 8 }}>{btn("Deselect", () => setSelected(null), { small: true })}</span>}
        </div>

        {/* Shortcuts */}
        <details style={{ padding: "6px 16px", borderBottom: bdr }}>
          <summary style={{ fontFamily: M, fontSize: 9, color: "#5a4e38", cursor: "pointer" }}>Shortcuts</summary>
          <div style={{ fontFamily: M, fontSize: 8, color: "#5a4e38", lineHeight: 2, marginTop: 4 }}>
            {["N — focus name input","R — rename selected","C — connect from selected","1-4 — set atmosphere","Tab — cycle nodes","Delete — remove","F — focus camera","Ctrl+Z — undo","Ctrl+Shift+Z — redo","Ctrl+S — export","Esc — cancel / deselect"].map(s => <div key={s}>{s}</div>)}
          </div>
        </details>

        {/* Console */}
        <div style={{ flex: 1, padding: "8px 16px", overflowY: "auto" }}>
          <div style={{ fontFamily: M, fontSize: 8, color: "#5a4e38", letterSpacing: ".1em", marginBottom: 4 }}>CONSOLE</div>
          {log.map((l, i) => <div key={i} style={{ fontFamily: M, fontSize: 9, color: "#5a6848", opacity: 1 - i * 0.04, marginBottom: 2 }}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}
