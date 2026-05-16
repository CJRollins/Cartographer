import { useEffect } from 'react';
import * as THREE from 'three';
import { atmoHex, CONN_COLORS } from '../constants.js';
import { spiritus, fermentum, inter } from '../animancy.js';

export default function CartographerScene({ mountRef, sceneRef, setSelected, setNodes, setHoverInfo }) {
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
      while (worldGroup.children.length) worldGroup.remove(worldGroup.children[0]);
      meshMap = {};
      lineObjs = [];

      // Nodes
      data.nodes.forEach(node => {
        const col = new THREE.Color(atmoHex(node.atmosphere));
        const isOrphan = !data.edges.some(e => e.from === node.id || e.to === node.id);
        const degCount = data.edges.filter(e => e.from === node.id || e.to === node.id).length;
        const sz = 0.15 + Math.min(degCount * 0.015, 0.08);

        // Platform
        const platGeo = new THREE.CylinderGeometry(0.75 + degCount * 0.04, 0.8 + degCount * 0.04, 0.08, 24);
        const platMat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.5, roughness: 0.4, transparent: true, opacity: isOrphan ? 0.15 : 0.3 });
        const plat = new THREE.Mesh(platGeo, platMat);
        plat.position.set(node.x, -0.04, node.z);
        worldGroup.add(plat);

        // Rim
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(0.75 + degCount * 0.04, isOrphan ? 0.008 : 0.015, 6, 48),
          new THREE.MeshBasicMaterial({ color: isOrphan ? 0x8c1f18 : col, transparent: true, opacity: isOrphan ? 0.4 : 0.2 })
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.set(node.x, 0, node.z);
        worldGroup.add(rim);

        // Marker
        const mGeo = new THREE.SphereGeometry(sz, 12, 8);
        const mMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3, metalness: 0.4, roughness: 0.3 });
        const marker = new THREE.Mesh(mGeo, mMat);
        marker.position.set(node.x, 0.4, node.z);
        worldGroup.add(marker);

        meshMap[node.id] = { marker, mat: mMat, plat, platMat, node, isOrphan };
      });

      // Edges
      data.edges.forEach(e => {
        const from = data.nodes.find(n => n.id === e.from);
        const to = data.nodes.find(n => n.id === e.to);
        if (!from || !to) return;

        const isDescent = e.type === "descent" || e.type === "tunnel";
        const pts = isDescent
          ? [new THREE.Vector3(from.x, 0.1, from.z), new THREE.Vector3((from.x + to.x) / 2, -0.5, (from.z + to.z) / 2), new THREE.Vector3(to.x, 0.1, to.z)]
          : [new THREE.Vector3(from.x, 0.1, from.z), new THREE.Vector3(to.x, 0.1, to.z)];

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
          const bs = 0.12;
          const arm1 = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(mx - bs, 0.2, mz - bs), new THREE.Vector3(mx + bs, 0.2, mz + bs)]),
            new THREE.LineBasicMaterial({ color: 0xaa3333, linewidth: 2 })
          );
          const arm2 = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(mx + bs, 0.2, mz - bs), new THREE.Vector3(mx - bs, 0.2, mz + bs)]),
            new THREE.LineBasicMaterial({ color: 0xaa3333, linewidth: 2 })
          );
          worldGroup.add(arm1, arm2);
          const blockDot = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.06, 0),
            new THREE.MeshStandardMaterial({ color: 0xaa3333, emissive: 0xaa3333, emissiveIntensity: 0.5 })
          );
          blockDot.position.set(mx, 0.2, mz);
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

    sceneRef.current = { meshMap, pendingRebuild: null, selectedId: null, connectMode: false, connectCallback: null, focusId: null, _edges: [] };

    // ── Camera orbit ──
    let theta = 0, phi = 0.5, radius = 12, drag = false, lx = 0, ly = 0;
    let gx = 0, gz = 0, tx = 0, tz = 0;
    let draggingNode = null, dragStart = null;
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
            entry.node.x = groundPt.x;
            entry.node.z = groundPt.z;
          }
          sceneRef.current.pendingRebuild = { nodes: Object.values(meshMap).map(m => m.node), edges: sceneRef.current._edges || [] };
        }
        return;
      }

      if (drag) {
        theta -= (e.clientX - lx) * 0.005;
        phi = Math.max(0.1, Math.min(1.3, phi - (e.clientY - ly) * 0.005));
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

    window.addEventListener("mouseup", () => {
      if (draggingNode && dragStart) {
        const entry = meshMap[draggingNode];
        if (entry && (Math.abs(entry.node.x - dragStart.x) > 0.1 || Math.abs(entry.node.z - dragStart.z) > 0.1)) {
          setNodes(ns => ns.map(n => n.id === draggingNode ? { ...n, x: entry.node.x, z: entry.node.z } : n));
        }
      }
      draggingNode = null; dragStart = null; drag = false;
    });

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

    // Touch support
    cvs.addEventListener("touchstart", e => { if (e.touches.length) { drag = true; lx = e.touches[0].clientX; ly = e.touches[0].clientY; } }, { passive: true });
    window.addEventListener("touchend", () => { drag = false; });
    window.addEventListener("touchmove", e => {
      if (!drag || !e.touches.length) return;
      theta -= (e.touches[0].clientX - lx) * 0.005;
      phi = Math.max(0.1, Math.min(1.3, phi - (e.touches[0].clientY - ly) * 0.005));
      lx = e.touches[0].clientX; ly = e.touches[0].clientY;
    }, { passive: true });

    // ── Animation loop ──
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const t = clock.getElapsedTime();

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

      // Camera
      tx += (gx - tx) * 0.04; tz += (gz - tz) * 0.04;
      camera.position.x = tx + Math.sin(theta) * Math.cos(phi) * radius;
      camera.position.y = Math.sin(phi) * radius * 0.6 + 2;
      camera.position.z = tz + Math.cos(theta) * Math.cos(phi) * radius;
      camera.lookAt(tx, 0, tz);

      // Node animation
      const selId = sceneRef.current.selectedId;
      Object.entries(meshMap).forEach(([id, { marker, mat, node }]) => {
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
        if (!draggingNode || draggingNode !== id) {
          marker.position.y = 0.4 + spiritus(t + node.x, 0.12, 0.02);
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
      renderer.dispose();
      if (cvs.parentNode) cvs.parentNode.removeChild(cvs);
      window.removeEventListener("resize", onR);
    };
  }, []);

  return null;
}
