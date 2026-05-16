const STORAGE_KEY = "cartographer_adventure";

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
        const data = JSON.parse(ev.target.result);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: adventureName, nodes, edges }));
  } catch (e) {
    // Storage full or unavailable — fail silently
  }
}

export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearStorage() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}
