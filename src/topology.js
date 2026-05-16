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
