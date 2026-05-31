import React from "react";
import TreeCanvas from "./TreeCanvas.jsx";

// Modal del arbol: solo aparece despues de presionar Generar.
export default function TreeModal({ expression, tree, steps, currentStep, answer, onClose, onReset, onPlay, onNext, onEdit }) {
  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-slate-950/85 p-0 backdrop-blur-sm md:p-5">
      <section className="tree-modal mx-auto flex h-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl md:rounded-3xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
          <div>
            <p className="text-xs font-black uppercase text-teal-700">Arbol de expresion</p>
            <h2 className="text-xl font-black">{expression}</h2>
          </div>
          <button className="rounded-full bg-slate-950 px-4 py-3 font-black text-white" onClick={onClose}>Cerrar X</button>
        </header>
        <div className="flex items-center justify-between gap-3 bg-slate-950 px-4 py-3 text-white">
          <strong className="text-4xl font-black text-emerald-400">Resultado: {answer}</strong>
          <span className="text-sm font-black">Paso {currentStep} de {steps.length}</span>
        </div>
        <div className="grid-lab relative flex-1 overflow-hidden">
          <TreeCanvas tree={tree} steps={steps} currentStep={currentStep} answer={answer} />
        </div>
        <footer className="grid grid-cols-2 gap-2 p-3 md:grid-cols-4">
          <button className="rounded-xl bg-slate-700 py-3 font-black text-white" onClick={onReset}>Reiniciar</button>
          <button className="rounded-xl bg-amber-600 py-3 font-black text-white" onClick={onPlay}>Play</button>
          <button className="rounded-xl bg-orange-700 py-3 font-black text-white" onClick={onNext}>Siguiente</button>
          <button className="rounded-xl bg-blue-700 py-3 font-black text-white" onClick={onEdit}>Editar formula</button>
        </footer>
      </section>
    </div>
  );
}
