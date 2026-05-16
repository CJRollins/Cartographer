import React from 'react';
import { FONT_SERIF, BORDER, INPUT_STYLE, FONT_MONO } from '../constants.js';

export default function AdventureHeader({ adventureName, setAdventureName, onExport, onImport }) {
  const btn = (label, action) => (
    <button onClick={action} style={{
      padding: "4px 10px", background: "rgba(181,152,80,0.06)", border: BORDER,
      color: "#b59850", fontFamily: FONT_MONO, fontSize: 9, cursor: "pointer", borderRadius: 3,
    }}>{label}</button>
  );

  return (
    <div style={{ padding: "10px 16px", borderBottom: BORDER, display: "flex", alignItems: "center", gap: 8 }}>
      <input
        value={adventureName}
        onChange={e => setAdventureName(e.target.value)}
        style={{ ...INPUT_STYLE, fontFamily: FONT_SERIF, fontSize: 14, letterSpacing: ".08em", background: "transparent", border: "none", padding: 0 }}
      />
      <div style={{ display: "flex", gap: 4 }}>
        {btn("⬇", onExport)}
        {btn("⬆", onImport)}
      </div>
    </div>
  );
}
