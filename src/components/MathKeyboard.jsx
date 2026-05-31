import React from "react";

const KEYS = ["7", "8", "9", "+", "-", "(", "4", "5", "6", "*", "/", ")", "1", "2", "3", ".", "0", "Borrar"];

// Teclado compacto para ingresar simbolos matematicos en celular.
export default function MathKeyboard({ onKey, onClear, onClose }) {
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-sm text-slate-700">Teclado matematico</strong>
        <button className="rounded-lg bg-slate-200 px-3 py-1 text-xs font-black text-slate-700" onClick={onClose}>Ocultar</button>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {KEYS.map((key) => (
          <button key={key} className="rounded-lg border border-slate-200 bg-white px-1 py-2 text-sm font-black text-slate-800 shadow-sm" onClick={() => onKey(key)}>
            {key}
          </button>
        ))}
      </div>
      <button className="mt-2 w-full rounded-lg bg-slate-200 px-3 py-2 text-sm font-black text-slate-700" onClick={onClear}>Limpiar formula</button>
    </div>
  );
}
