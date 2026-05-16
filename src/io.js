import {
  ATMOS,
  CONN_TYPES,
  DEFAULT_BOUNDARY,
  DEFAULT_TEMPORAL,
  BOUNDARY_SHAPES,
  TEMPORAL_CADENCES,
  TEMPORAL_ERAS,
  TEMPORAL_PHASES,
} from './constants.js';

const STORAGE_KEY = "cartographer_adventure";
const VALID_ATMOS = new Set(ATMOS.map(a => a.id));
const VALID_CONN_TYPES = new Set(CONN_TYPES);
const VALID_BOUNDARY_SHAPES = new Set(BOUNDARY_SHAPES);
const VALID_ERAS = new Set(TEMPORAL_ERAS);
const VALID_PHASES = new Set(TEMPORAL_PHASES);
const VALID_CADENCES = new Set(TEMPORAL_CADENCES);

function num(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeTemporal(temporal = {}) {
  return {
    era: VALID_ERAS.has(temporal.era) ? temporal.era : DEFAULT_TEMPORAL.era,
    phase: VALID_PHASES.has(temporal.phase) ? temporal.phase : DEFAULT_TEMPORAL.phase,
    cadence: VALID_CADENCES.has(temporal.cadence) ? temporal.cadence : DEFAULT_TEMPORAL.cadence,
    lastChanged: num(temporal.lastChanged, Date.now()),
  };
}

export function normalizeBoundary(boundary = {}) {
  const gatePlacements = Array.isArray(boundary.gatePlacements)
    ? boundary.gatePlacements.map(gate => ({
      edgeIndex: Math.max(0, Math.round(num(gate?.edgeIndex, 0))),
      t: Math.max(0, Math.min(1, num(gate?.t, 0.5))),
      connectionKey: typeof gate?.connectionKey === "string" ? gate.connectionKey : "",
    }))
    : [];

  return {
    shape: VALID_BOUNDARY_SHAPES.has(boundary.shape) ? boundary.shape : DEFAULT_BOUNDARY.shape,
    radius: Math.max(0.5, num(boundary.radius, DEFAULT_BOUNDARY.radius)),
    walled: Boolean(boundary.walled),
    gates: Math.max(0, Math.round(num(boundary.gates, DEFAULT_BOUNDARY.gates))),
    gatePlacements,
  };
}

export function normalizeAdventure(data = {}) {
  const seen = new Set();
  const nodes = Array.isArray(data.nodes)
    ? data.nodes.map((node, index) => {
      const rawId = typeof node?.id === "string" && node.id.trim() ? node.id.trim() : `loc_${index + 1}`;
      const id = seen.has(rawId) ? `${rawId}_${index + 1}` : rawId;
      seen.add(id);
      return {
        id,
        name: typeof node?.name === "string" && node.name.trim() ? node.name.trim() : `Location ${index + 1}`,
        atmosphere: VALID_ATMOS.has(node?.atmosphere) ? node.atmosphere : "spiritus",
        x: num(node?.x, index * 2),
        y: num(node?.y, 0),
        z: num(node?.z, 0),
        layer: Math.round(num(node?.y, 0)),
        notes: typeof node?.notes === "string" ? node.notes : "",
        created: num(node?.created, Date.now()),
        temporal: normalizeTemporal(node?.temporal),
        boundary: normalizeBoundary(node?.boundary),
      };
    })
    : [];

  const validNodeIds = new Set(nodes.map(n => n.id));
  const edgeKeys = new Set();
  const edges = Array.isArray(data.edges)
    ? data.edges.reduce((safeEdges, edge) => {
      if (!validNodeIds.has(edge?.from) || !validNodeIds.has(edge?.to) || edge.from === edge.to) return safeEdges;
      const key = [edge.from, edge.to].sort().join(":");
      if (edgeKeys.has(key)) return safeEdges;
      edgeKeys.add(key);
      safeEdges.push({
        from: edge.from,
        to: edge.to,
        type: VALID_CONN_TYPES.has(edge?.type) ? edge.type : "path",
        label: typeof edge?.label === "string" ? edge.label : "",
        travelLength: num(edge?.travelLength, 0),
      });
      return safeEdges;
    }, [])
    : [];

  return {
    version: "layer0",
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Untitled Adventure",
    created: typeof data.created === "string" ? data.created : new Date().toISOString(),
    nodes,
    edges,
  };
}

// ═══ EXPORT ═══
export function exportAdventure(adventureName, nodes, edges) {
  const data = {
    version: "layer0",
    name: adventureName,
    created: new Date().toISOString(),
    nodes,
    edges,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${adventureName.replace(/\s+/g, "_").toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══ IMPORT ═══
export function importAdventure(callback) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = normalizeAdventure(JSON.parse(ev.target.result));
        callback(null, data);
      } catch (err) {
        callback(err, null);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ═══ LOCAL STORAGE ═══
export function saveToStorage(adventureName, nodes, edges) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAdventure({ name: adventureName, nodes, edges })));
  } catch (e) {
    // Storage full or unavailable — fail silently
  }
}

export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeAdventure(JSON.parse(raw));
  } catch (e) {
    return null;
  }
}

export function clearStorage() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}
