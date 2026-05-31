import React from "react";

const PHASES = ["CAPTURA", "OCR", "PARSER", "ARBOL"];

export default function AnalysisPanel({ phase, progress, status }) {
  const activeIndex = Math.max(0, PHASES.indexOf(phase));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
        <span className={`h-3 w-3 rounded-full ${progress > 0 && progress < 100 ? "animate-pulse bg-cyan-500" : "bg-slate-400"}`} />
        <span>{status}</span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {PHASES.map((item, index) => (
          <span
            className={`rounded-lg px-1 py-2 text-center text-[10px] font-bold ${
              index <= activeIndex ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"
            }`}
            key={item}
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}
