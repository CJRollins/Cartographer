// ═══ ATMOSPHERE TYPES ═══
export const ATMOS = [
  { id: "spiritus", label: "Spiritus", key: "1", color: "#5DCAA5", hex: 0x5dcaa5, desc: "Steady, breathing" },
  { id: "fermentum", label: "Fermentum", key: "2", color: "#F0997B", hex: 0xf0997b, desc: "Chaotic, unsettled" },
  { id: "pulsus", label: "Pulsus", key: "3", color: "#85B7EB", hex: 0x85b7eb, desc: "Cyclic, haunted" },
  { id: "silent", label: "Silent", key: "4", color: "#4a4a4a", hex: 0x4a4a4a, desc: "Dead, abandoned" },
];

// ═══ CONNECTION TYPES ═══
export const CONN_TYPES = ["path", "street", "gate", "tunnel", "descent", "river", "bridge", "secret", "blocked"];

export const CONN_COLORS = {
  path: 0xb59850, street: 0xd4b66e, gate: 0xd4b66e, tunnel: 0x6a5a40,
  descent: 0x8c1f18, river: 0x4a7aaa, bridge: 0xd4b66e, secret: 0x8c1f18, blocked: 0x4a4a4a,
};

// ═══ COLOR HELPERS ═══
export const atmoHex = (a) => ATMOS.find(x => x.id === a)?.hex || 0xb59850;
export const atmoColor = (a) => ATMOS.find(x => x.id === a)?.color || "#b59850";

// ═══ STYLE TOKENS ═══
export const FONT_SERIF = "'Cormorant Garamond', Georgia, serif";
export const FONT_MONO = "ui-monospace, 'SF Mono', Menlo, monospace";
export const BORDER = "1px solid rgba(181,152,80,0.12)";
export const PANEL_BG = "rgba(8,6,10,0.95)";

export const INPUT_STYLE = {
  width: "100%", background: "rgba(181,152,80,0.05)",
  border: BORDER, color: "#D4B66E", fontFamily: FONT_MONO,
  fontSize: 12, padding: "6px 10px", outline: "none",
  borderRadius: 3, boxSizing: "border-box",
};
