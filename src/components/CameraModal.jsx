import React from "react";

// Modal independiente para tomar y confirmar una fotografia.
export default function CameraModal({ videoRef, capturedUrl, busy, onClose, onCapture, onScan, onRetake }) {
  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-slate-950/90 p-3 backdrop-blur-sm md:p-6">
      <section className="tree-modal mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-slate-950 shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 text-white">
          <div>
            <p className="text-xs font-black uppercase text-cyan-300">Camara OCR</p>
            <h2 className="text-xl font-black">{capturedUrl ? "Confirma la fotografia" : "Apunta hacia la formula"}</h2>
          </div>
          <button className="rounded-full bg-white px-4 py-2 font-black text-slate-950" onClick={onClose}>Cerrar X</button>
        </header>

        <div className="relative flex-1 overflow-hidden bg-black">
          <video ref={videoRef} className={`h-full w-full object-cover ${capturedUrl ? "hidden" : "block"}`} autoPlay playsInline muted />
          {capturedUrl ? <img src={capturedUrl} alt="Fotografia capturada" className="h-full w-full object-contain" /> : null}
        </div>

        <footer className="grid grid-cols-2 gap-3 border-t border-white/10 p-4">
          {capturedUrl ? (
            <>
              <button className="rounded-xl bg-slate-700 px-4 py-4 font-black text-white" onClick={onRetake} disabled={busy}>Tomar otra</button>
              <button className="rounded-xl bg-emerald-600 px-4 py-4 font-black text-white" onClick={onScan} disabled={busy}>{busy ? "Escaneando..." : "Escanear foto"}</button>
            </>
          ) : (
            <button className="col-span-2 rounded-xl bg-emerald-600 px-4 py-4 text-lg font-black text-white" onClick={onCapture}>Tomar fotografia</button>
          )}
        </footer>
      </section>
    </div>
  );
}
