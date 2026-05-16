import { useEffect } from 'react';
import * as THREE from 'three';
import { atmoHex, CONN_COLORS } from '../constants.js';
import { spiritus, fermentum, inter } from '../animancy.js';

const LABEL_CANVAS_SIZE = 512;
const CAMERA_ANGLE = {
  top: { phi: 1.56, radius: 14 },
  angle: { phi: 0.8, radius: 12 },
};
const CURSOR_SELECT_RADIUS = 0.95;

function drawArcText(ctx, text, radius, centerAngle, color) {
  const chars = Array.from(text);
  const widths = chars.map(ch => ctx.measureText(ch).width);
  const totalAngle = widths.reduce((sum, width) => sum + width / radius, 0);
  let angle = centerAngle - totalAngle / 2;

  chars.forEach((ch, i) => {
    const charAngle = widths[i] / radius;
    angle += charAngle / 2;

    ctx.save();
    ctx.translate(
      LABEL_CANVAS_SIZE / 2 + Math.cos(angle) * radius,
      LABEL_CANVAS_SIZE / 2 + Math.sin(angle) * radius
    );
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = color;
    ctx.fillText(ch, 0, 0);
    ctx.restore();

    angle += charAngle / 2;
  });
}

function createNodeLabel(name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_CANVAS_SIZE;
  canvas.height = LABEL_CANVAS_SIZE;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, LABEL_CANVAS_SIZE, LABEL_CANVAS_SIZE);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 26px ui-monospace, SFMono-Regular, Menlo, monospace';

  const label = String(name || 'Unnamed').toUpperCase();
  const safeLabel = label.length > 28 ? `${label.slice(0, 25)}...` : label;
  const arcRadius = 206;

  ctx.shadowColor = 'rgba(6,4,10,0.9)';
  ctx.shadowBlur = 6;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(6,4,10,0.9)';

  drawArcText(ctx, safeLabel, arcRadius, -Math.PI / 2, 'rgba(212,182,110,0.9)');

  ctx.shadowBlur = 0;
  drawArcText(ctx, safeLabel, arcRadius, Math.PI / 2, color);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 2.15), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;

  return mesh;
}

function disposeMaterial(material) {
  if (!material) return;
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach(mat => {
    if (mat.map) mat.map.dispose();
    mat.dispose();
  });
}

function disposeObjectTree(group) {
  group.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    disposeMaterial(obj.material);
  });
  while (group.children.length) group.remove(group.children[0]);
}

export default function CartographerScene({ mountRef, sceneRef, setSelected, setNodes, setHoverInfo, setCursorInfo }) {
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;

    // ── Scene setup ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06040a);
    scene.fog = new THREE.FogExp2(0x06040a, 0.02);
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 200);
    camera.position.set(0, 8, 10);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);

    // ── Lights ──
    scene.add(new THREE.AmbientLight(0x181410, 0.4));
    const light = new THREE.PointLight(0xd4b66e, 0.8, 30);
    light.position.set(0, 8, 0);
    scene.add(light);

    // ── Grid + Dust ──
    scene.add(new THREE.GridHelper(30, 30, 0x1a1610, 0x0e0c08));
    const dN = 200, dp = new Float32Array(dN * 3);
    for (let i = 0; i < dN; i++) {
      dp[i * 3] = (Math.random() - 0.5) * 20;
      dp[i * 3 + 1] = Math.random() * 8;
      dp[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute("position", new THREE.BufferAttribute(dp, 3));
    scene.add(new THREE.Points(dGeo, new THREE.PointsMaterial({ color: 0xb59850, size: 0.04, transparent: true, opacity: 0.2 })));

    // ── World group ──
    let meshMap = {}, lineObjs = [];
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    function rebuild(data) {
      disposeObjectTree(worldGroup);
      meshMap = {};
      lineObjs = [];

      // Nodes
      data.nodes.forEach(node => {
        const col = new THREE.Color(atmoHex(node.atmosphere));
        const isOrphan = !data.edges.some(e => e.from === node.id || e.to === node.id);
        const degCount = data.edges.filter(e => e.from === node.id || e.to === node.id).length;
        const baseY = Number.isFinite(node.y) ? node.y : 0;
        const sz = 0.15 + Math.min(degCount * 0.015, 0.08);

        // Platform
        const platGeo = new THREE.CylinderGeometry(0.75 + degCount * 0.04, 0.8 + degCount * 0.04, 0.08, 24);
        const platMat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.5, roughness: 0.4, transparent: true, opacity: isOrphan ? 0.15 : 0.3 });
        const plat = new THREE.Mesh(platGeo, platMat);
        plat.position.set(node.x, baseY - 0.04, node.z);
        worldGroup.add(plat);

        // Rim
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(0.75 + degCount * 0.04, isOrphan ? 0.008 : 0.015, 6, 48),
          new THREE.MeshBasicMaterial({ color: isOrphan ? 0x8c1f18 : col, transparent: true, opacity: isOrphan ? 0.4 : 0.2 })
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.set(node.x, baseY, node.z);
        worldGroup.add(rim);

        // Label
        const label = createNodeLabel(node.name, col.getStyle());
        label.position.set(node.x, baseY + 0.055, node.z);
        worldGroup.add(label);

        // Marker
        const mGeo = new THREE.SphereGeometry(sz, 12, 8);
        const mMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3, metalness: 0.4, roughness: 0.3 });
        const marker = new THREE.Mesh(mGeo, mMat);
        marker.position.set(node.x, baseY + 0.4, node.z);
        worldGroup.add(marker);

        meshMap[node.id] = { marker, mat: mMat, plat, platMat, rim, label, node, isOrphan };
      });

      // Edges
      data.edges.forEach(e => {
        const from = data.nodes.find(n => n.id === e.from);
        const to = data.nodes.find(n => n.id === e.to);
        if (!from || !to) return;

        const isDescent = e.type === "descent" || e.type === "tunnel";
        const fromY = Number.isFinite(from.y) ? from.y : 0;
        const toY = Number.isFinite(to.y) ? to.y : 0;
        const pts = isDescent
          ? [new THREE.Vector3(from.x, fromY + 0.1, from.z), new THREE.Vector3((from.x + to.x) / 2, Math.min(fromY, toY) - 0.5, (from.z + to.z) / 2), new THREE.Vector3(to.x, toY + 0.1, to.z)]
          : [new THREE.Vector3(from.x, fromY + 0.1, from.z), new THREE.Vector3(to.x, toY + 0.1, to.z)];

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
        worldGroup.add(line);
        lineObjs.push({ line, mat: lm, from: e.from, to: e.to });

        // Blocked marker
        if (e.type === "blocked") {
          const mx = (from.x + to.x) / 2, mz = (from.z + to.z) / 2;
          const my = (fromY + toY) / 2 + 0.2;
          const bs = 0.12;
          const arm1 = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(mx - bs, my, mz - bs), new THREE.Vector3(mx + bs, my, mz + bs)]),
            new THREE.LineBasicMaterial({ color: 0xaa3333, linewidth: 2 })
          );
          const arm2 = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(mx + bs, my, mz - bs), new THREE.Vector3(mx - bs, my, mz + bs)]),
            new THREE.LineBasicMaterial({ color: 0xaa3333, linewidth: 2 })
          );
          worldGroup.add(arm1, arm2);
          const blockDot = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.06, 0),
            new THREE.MeshStandardMaterial({ color: 0xaa3333, emissive: 0xaa3333, emissiveIntensity: 0.5 })
          );
          blockDot.position.set(mx, my, mz);
          worldGroup.add(blockDot);
        }
      });

      // Center light on world
      if (data.nodes.length) {
        const cx = data.nodes.reduce((s, n) => s + n.x, 0) / data.nodes.length;
        const cz = data.nodes.reduce((s, n) => s + n.z, 0) / data.nodes.length;
        light.position.set(cx, 8, cz);
      }
    }

    sceneRef.current = { meshMap, pendingRebuild: null, selectedId: null, connectMode: false, connectCallback: null, focusId: null, cameraMode: "angle", cursorHitId: null, _edges: [] };

    // ── Camera orbit ──
    let theta = 0, phi = CAMERA_ANGLE.angle.phi, radius = CAMERA_ANGLE.angle.radius, drag = false, lx = 0, ly = 0;
    let gx = 0, gz = 0, tx = 0, tz = 0;
    let draggingNode = null, dragStart = null;
    let cursorHitId = null;
    const keys = new Set();
    const cvs = renderer.domElement;
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(99, 99);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const groundPt = new THREE.Vector3();

    // ── Mouse events ──
    cvs.addEventListener("mousemove", e => {
      const r = cvs.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;

      if (draggingNode) {
        ray.setFromCamera(mouse, camera);
        if (ray.ray.intersectPlane(groundPlane, groundPt)) {
          const entry = meshMap[draggingNode];
          if (entry) {
            entry.marker.position.x = groundPt.x;
            entry.marker.position.z = groundPt.z;
            entry.plat.position.x = groundPt.x;
            entry.plat.position.z = groundPt.z;
            entry.rim.position.x = groundPt.x;
            entry.rim.position.z = groundPt.z;
            entry.label.position.x = groundPt.x;
            entry.label.position.z = groundPt.z;
            entry.node.x = groundPt.x;
            entry.node.z = groundPt.z;
          }
        }
        return;
      }

      if (drag) {
        theta -= (e.clientX - lx) * 0.005;
        lx = e.clientX; ly = e.clientY;
        return;
      }

      // Hover
      ray.setFromCamera(mouse, camera);
      const targets = Object.values(meshMap).map(m => m.marker);
      const hits = ray.intersectObjects(targets);
      if (hits.length) {
        const entry = Object.entries(meshMap).find(([_, v]) => v.marker === hits[0].object);
        if (entry) {
          const n = entry[1].node;
          const rc = cvs.getBoundingClientRect();
          setHoverInfo({
            name: n.name, atmo: n.atmosphere, id: n.id,
            temporal: n.temporal,
            conns: (sceneRef.current._edges || []).filter(ed => ed.from === n.id || ed.to === n.id).length,
            x: e.clientX - rc.left, y: e.clientY - rc.top,
          });
        }
      } else {
        setHoverInfo(null);
      }
    });

    cvs.addEventListener("mousedown", e => {
      lx = e.clientX; ly = e.clientY;
      ray.setFromCamera(mouse, camera);
      const targets = Object.values(meshMap).map(m => m.marker);
      const hits = ray.intersectObjects(targets);
      if (hits.length) {
        const entry = Object.entries(meshMap).find(([_, v]) => v.marker === hits[0].object);
        if (entry && entry[0] === sceneRef.current.selectedId && !sceneRef.current.connectMode) {
          draggingNode = entry[0];
          dragStart = { x: entry[1].node.x, z: entry[1].node.z };
          return;
        }
      }
      drag = true;
    });

    const handleMouseUp = () => {
      if (draggingNode && dragStart) {
        const entry = meshMap[draggingNode];
        if (entry && (Math.abs(entry.node.x - dragStart.x) > 0.1 || Math.abs(entry.node.z - dragStart.z) > 0.1)) {
          const movedNodes = Object.values(meshMap).map(m => ({ ...m.node }));
          setNodes(ns => ns.map(n => n.id === draggingNode ? { ...n, x: entry.node.x, z: entry.node.z } : n));
          sceneRef.current.pendingRebuild = { nodes: movedNodes, edges: sceneRef.current._edges || [] };
        }
      }
      draggingNode = null; dragStart = null; drag = false;
    };
    window.addEventListener("mouseup", handleMouseUp);

    cvs.addEventListener("click", () => {
      if (draggingNode) return;
      ray.setFromCamera(mouse, camera);
      const targets = Object.values(meshMap).map(m => m.marker);
      const hits = ray.intersectObjects(targets);
      if (hits.length) {
        const entry = Object.entries(meshMap).find(([_, v]) => v.marker === hits[0].object);
        if (entry) {
          const id = entry[0];
          if (sceneRef.current.connectMode) {
            sceneRef.current.connectCallback?.(id);
          } else {
            setSelected(id);
            gx = entry[1].node.x; gz = entry[1].node.z;
          }
        }
      } else {
        setSelected(null);
      }
    });

    cvs.addEventListener("wheel", e => { radius = Math.max(4, Math.min(25, radius + e.deltaY * 0.02)); }, { passive: true });

    const handleKeyDown = e => {
      const inInput = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT";
      if (inInput || e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const navKeys = ["w", "a", "s", "d", "Shift", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"];
      if (!navKeys.includes(key)) return;
      e.preventDefault();

      if (key === "Enter") {
        const id = sceneRef.current.cursorHitId;
        if (!id) return;
        if (sceneRef.current.connectMode) {
          sceneRef.current.connectCallback?.(id);
        } else {
          setSelected(id);
          const hit = meshMap[id];
          if (hit) { gx = hit.node.x; gz = hit.node.z; }
        }
        return;
      }

      keys.add(key);
    };
    const handleKeyUp = e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Touch support
    const handleTouchStart = e => { if (e.touches.length) { drag = true; lx = e.touches[0].clientX; ly = e.touches[0].clientY; } };
    const handleTouchEnd = () => { drag = false; };
    const handleTouchMove = e => {
      if (!drag || !e.touches.length) return;
      theta -= (e.touches[0].clientX - lx) * 0.005;
      lx = e.touches[0].clientX; ly = e.touches[0].clientY;
    };
    cvs.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    // ── Animation loop ──
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // Pending rebuild
      if (sceneRef.current.pendingRebuild) {
        rebuild(sceneRef.current.pendingRebuild);
        sceneRef.current._edges = sceneRef.current.pendingRebuild.edges;
        meshMap = sceneRef.current.meshMap = { ...meshMap };
        sceneRef.current.pendingRebuild = null;
      }

      // Focus
      if (sceneRef.current.focusId) {
        const m = meshMap[sceneRef.current.focusId];
        if (m) { gx = m.node.x; gz = m.node.z; radius = Math.min(radius, 8); }
        sceneRef.current.focusId = null;
      }

      // Keyboard navigation
      const moveSpeed = keys.has("Shift") ? 8 : 5;
      const step = moveSpeed * dt;
      const forwardX = -Math.sin(theta);
      const forwardZ = -Math.cos(theta);
      const rightX = Math.cos(theta);
      const rightZ = -Math.sin(theta);
      let moveX = 0, moveZ = 0;
      if (keys.has("w")) { moveX += forwardX; moveZ += forwardZ; }
      if (keys.has("s")) { moveX -= forwardX; moveZ -= forwardZ; }
      if (keys.has("d")) { moveX += rightX; moveZ += rightZ; }
      if (keys.has("a")) { moveX -= rightX; moveZ -= rightZ; }
      const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
      if (moveLen > 0) {
        gx += (moveX / moveLen) * step;
        gz += (moveZ / moveLen) * step;
      }
      const rotateStep = 1.4 * dt;
      if (keys.has("ArrowLeft")) theta -= rotateStep;
      if (keys.has("ArrowRight")) theta += rotateStep;
      if (keys.has("ArrowUp")) theta = inter(theta, 0, 0.08);
      if (keys.has("ArrowDown")) theta = inter(theta, Math.PI, 0.08);

      // Camera mode
      const targetMode = CAMERA_ANGLE[sceneRef.current.cameraMode || "angle"] || CAMERA_ANGLE.angle;
      phi = inter(phi, targetMode.phi, 0.08);
      radius = inter(radius, targetMode.radius, 0.04);

      // Camera
      tx += (gx - tx) * 0.04; tz += (gz - tz) * 0.04;
      camera.position.x = tx + Math.sin(theta) * Math.cos(phi) * radius;
      camera.position.y = Math.sin(phi) * radius * 0.6 + 2;
      camera.position.z = tz + Math.cos(theta) * Math.cos(phi) * radius;
      camera.lookAt(tx, 0, tz);

      // Center cursor hit test
      let nextCursorHit = null;
      let nextCursorDist = Infinity;
      Object.entries(meshMap).forEach(([id, { node }]) => {
        if (!node) return;
        const dx = node.x - tx;
        const dz = node.z - tz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < CURSOR_SELECT_RADIUS && dist < nextCursorDist) {
          nextCursorHit = id;
          nextCursorDist = dist;
        }
      });
      if (nextCursorHit !== cursorHitId) {
        cursorHitId = nextCursorHit;
        sceneRef.current.cursorHitId = cursorHitId;
        const node = cursorHitId ? meshMap[cursorHitId]?.node : null;
        setCursorInfo?.(node ? { id: node.id, name: node.name } : null);
      }

      // Node animation
      const selId = sceneRef.current.selectedId;
      Object.entries(meshMap).forEach(([id, { marker, mat, rim, node }]) => {
        if (!node) return;
        const cadence = node.temporal?.cadence || "static";
        const phase = node.temporal?.phase || "stable";
        let ei = 0.2;
        if (node.atmosphere === "spiritus") ei = 0.25 + spiritus(t, 0.2, 0.12);
        else if (node.atmosphere === "fermentum") ei = 0.22;
        else if (node.atmosphere === "pulsus") ei = 0.15 + Math.max(0, spiritus(t, 0.08, 0.2));
        else ei = 0.05;
        if (cadence === "cyclic") ei += Math.max(0, spiritus(t, 0.16, 0.08));
        else if (cadence === "decaying") ei *= 0.72 + spiritus(t, 0.04, 0.06);
        else if (cadence === "escalating") ei += Math.max(0, spiritus(t, 0.32, 0.14));
        if (id === selId) {
          if (node.atmosphere === "fermentum") ei = 0.5 + fermentum(t, 1.0) * 0.06;
          else ei = Math.max(ei, 0.6 + spiritus(t, 0.8, 0.2));
        }
        mat.emissiveIntensity = ei;
        if (rim?.material) {
          const targetOpacity = phase === "hidden" ? 0.08 : phase === "broken" ? 0.48 : phase === "declining" ? 0.28 : phase === "rising" ? 0.34 : 0.2;
          const activeTarget = id === cursorHitId ? 0.62 : id === selId ? Math.max(targetOpacity, 0.45) : targetOpacity;
          rim.material.opacity = inter(rim.material.opacity, activeTarget, 0.05);
        }
        if (!draggingNode || draggingNode !== id) {
          marker.position.y = (Number.isFinite(node.y) ? node.y : 0) + 0.4 + spiritus(t + node.x, 0.12, 0.02);
        }
      });

      // Connection animation
      lineObjs.forEach(({ mat, from, to }) => {
        mat.opacity = inter(mat.opacity, from === selId || to === selId ? 0.35 : 0.1, 0.06);
      });

      // Dust
      const dpos = dGeo.attributes.position.array;
      for (let i = 0; i < dN; i++) { dpos[i * 3 + 1] += 0.002; if (dpos[i * 3 + 1] > 8) dpos[i * 3 + 1] = 0; }
      dGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    });

    const onR = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", onR);

    return () => {
      renderer.setAnimationLoop(null);
      disposeObjectTree(worldGroup);
      scene.remove(worldGroup);
      renderer.dispose();
      if (cvs.parentNode) cvs.parentNode.removeChild(cvs);
      window.removeEventListener("resize", onR);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return null;
}
