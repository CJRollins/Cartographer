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
    y: 0,
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
