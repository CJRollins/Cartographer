import React from 'react';
import { FONT_MONO, BORDER } from '../constants.js';

const SHORTCUTS = [
  "N — focus name input",
  "R — rename selected",
  "C — connect from selected",
  "1-4 — set atmosphere",
  "Tab — cycle nodes",
  "Delete — remove",
  "F — focus camera",
  "Ctrl+Z — undo",
  "Ctrl+Shift+Z — redo",
  "Ctrl+S — export",
  "Esc — cancel / deselect",
];

export function ShortcutsPanel() {
  return (
    <details style={{ padding: "6px 16px", borderBottom: BORDER }}>
      <summary style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#5a4e38", cursor: "pointer" }}>
        Shortcuts
      </summary>
      <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38", lineHeight: 2, marginTop: 4 }}>
        {SHORTCUTS.map(s => <div key={s}>{s}</div>)}
      </div>
    </details>
  );
}

export function ConsolePanel({ log }) {
  return (
    <div style={{ flex: 1, padding: "8px 16px", overflowY: "auto" }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a4e38", letterSpacing: ".1em", marginBottom: 4 }}>
        CONSOLE
      </div>
      {log.map((l, i) => (
        <div key={i} style={{
          fontFamily: FONT_MONO, fontSize: 9, color: "#5a6848",
          opacity: 1 - i * 0.04, marginBottom: 2,
        }}>{l}</div>
      ))}
    </div>
  );
}
