let _nextId = 1;

export function resetIdCounter(nodes) {
  const maxId = nodes.reduce((m, n) => {
    const num = parseInt(n.id.split("_")[1]) || 0;
    return Math.max(m, num);
  }, 0);
  _nextId = maxId + 1;
}

export function makeId() {
  return "loc_" + (_nextId++);
}

export function placeNear(parent, existingNodes) {
  if (!parent) return { x: 0, y: 0, z: 0 };

  const angle = Math.random() * Math.PI * 2;
  const dist = 2.5 + Math.random() * 1.5;
  const candidate = {
    x: parent.x + Math.cos(angle) * dist,
    y: Number.isFinite(parent.y) ? parent.y : 0,
    z: parent.z + Math.sin(angle) * dist,
  };

  // Nudge away from existing nodes to avoid overlap
  existingNodes.forEach(n => {
    const dx = candidate.x - n.x;
    const dz = candidate.z - n.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 2) {
      candidate.x += (dx / d) * (2 - d);
      candidate.z += (dz / d) * (2 - d);
    }
  });

  return candidate;
}

export function spatialDistance(a, b) {
  if (!a || !b) return 0;
  const dx = (b.x || 0) - (a.x || 0);
  const dy = (b.y || 0) - (a.y || 0);
  const dz = (b.z || 0) - (a.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function directionBetween(a, b) {
  if (!a || !b) return "unknown";
  const dx = (b.x || 0) - (a.x || 0);
  const dz = (b.z || 0) - (a.z || 0);
  if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) return "same";
  const angle = Math.atan2(dx, -dz);
  const dirs = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  const index = Math.round(angle / (Math.PI / 4) + 8) % 8;
  return dirs[index];
}

export function boundarySides(shape) {
  if (shape === "triangle") return 3;
  if (shape === "square") return 4;
  if (shape === "hex") return 6;
  if (shape === "octagon") return 8;
  return 0;
}

export function boundaryVertices(node) {
  const sides = boundarySides(node?.boundary?.shape);
  if (!sides) return [];
  const radius = Math.max(0.5, Number(node.boundary.radius) || 1.6);
  const start = sides === 4 ? Math.PI / 4 : -Math.PI / 2;
  return Array.from({ length: sides }, (_, i) => {
    const angle = start + (i / sides) * Math.PI * 2;
    return {
      x: (node.x || 0) + Math.cos(angle) * radius,
      z: (node.z || 0) + Math.sin(angle) * radius,
    };
  });
}

export function connectionKey(a, b) {
  return [a, b].sort().join(":");
}

export function placementToBoundaryPoint(node, placement) {
  const verts = boundaryVertices(node);
  if (!verts.length) return { x: node?.x || 0, z: node?.z || 0 };
  const edgeIndex = Math.max(0, Math.min(verts.length - 1, Math.round(placement?.edgeIndex || 0)));
  const t = Math.max(0, Math.min(1, Number(placement?.t) || 0));
  const a = verts[edgeIndex];
  const b = verts[(edgeIndex + 1) % verts.length];
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function projectPointToBoundary(node, point) {
  const verts = boundaryVertices(node);
  if (!verts.length) return { edgeIndex: 0, t: 0.5 };
  let best = { edgeIndex: 0, t: 0, distSq: Infinity };

  verts.forEach((a, i) => {
    const b = verts[(i + 1) % verts.length];
    const vx = b.x - a.x;
    const vz = b.z - a.z;
    const lenSq = vx * vx + vz * vz || 1;
    const rawT = ((point.x - a.x) * vx + (point.z - a.z) * vz) / lenSq;
    const t = Math.max(0, Math.min(1, rawT));
    const px = a.x + vx * t;
    const pz = a.z + vz * t;
    const dx = point.x - px;
    const dz = point.z - pz;
    const distSq = dx * dx + dz * dz;
    if (distSq < best.distSq) best = { edgeIndex: i, t, distSq };
  });

  return { edgeIndex: best.edgeIndex, t: best.t };
}

export function connectionBoundaryPlacement(node, other, key = "") {
  const verts = boundaryVertices(node);
  if (!verts.length || !other) return null;
  const dx = (other.x || 0) - (node.x || 0);
  const dz = (other.z || 0) - (node.z || 0);
  if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) return { edgeIndex: 0, t: 0.5, connectionKey: key };

  let best = null;
  verts.forEach((a, i) => {
    const b = verts[(i + 1) % verts.length];
    const sx = b.x - a.x;
    const sz = b.z - a.z;
    const den = dx * sz - dz * sx;
    if (Math.abs(den) < 0.0001) return;
    const cx = a.x - node.x;
    const cz = a.z - node.z;
    const rayT = (cx * sz - cz * sx) / den;
    const edgeT = (cx * dz - cz * dx) / den;
    if (rayT >= 0 && edgeT >= 0 && edgeT <= 1 && (!best || rayT < best.rayT)) {
      best = { edgeIndex: i, t: edgeT, rayT };
    }
  });

  return best
    ? { edgeIndex: best.edgeIndex, t: best.t, connectionKey: key }
    : { ...projectPointToBoundary(node, other), connectionKey: key };
}
