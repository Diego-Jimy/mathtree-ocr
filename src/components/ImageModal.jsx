import React from "react";

// Modal para confirmar una imagen elegida de la galeria.
export default function ImageModal({ previewUrl, busy, onClose, onScan }) {
  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-slate-950/90 p-3 backdrop-blur-sm md:p-6">
      <section className="tree-modal mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
          <div>
            <p className="text-xs font-black uppercase text-blue-700">Imagen seleccionada</p>
            <h2 className="text-xl font-black">Confirma antes de escanear</h2>
          </div>
          <button className="rounded-full bg-slate-950 px-4 py-2 font-black text-white" onClick={onClose}>Cerrar X</button>
        </header>
        <div className="flex-1 overflow-hidden bg-slate-100 p-3">
          <img src={previewUrl} alt="Imagen seleccionada" className="h-full w-full object-contain" />
        </div>
        <footer className="border-t border-slate-200 p-4">
          <button className="w-full rounded-xl bg-emerald-700 px-4 py-4 text-lg font-black text-white" onClick={onScan} disabled={busy}>
            {busy ? "Escaneando imagen..." : "Escanear imagen"}
          </button>
        </footer>
      </section>
    </div>
  );
}
