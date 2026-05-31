import React, { useRef, useState } from "react";

const DEFAULT_SELECTION = { x: 0.08, y: 0.32, width: 0.84, height: 0.36 };

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

// Modal para recortar manualmente la operacion antes del OCR.
export default function ImageModal({ previewUrl, busy, onClose, onScan }) {
  const frameRef = useRef(null);
  const imageRef = useRef(null);
  const startRef = useRef(null);
  const [selection, setSelection] = useState(DEFAULT_SELECTION);

  function pointFromEvent(event) {
    const rect = frameRef.current.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height)
    };
  }

  function startSelection(event) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    startRef.current = point;
    setSelection({ x: point.x, y: point.y, width: 0.01, height: 0.01 });
  }

  function resizeSelection(event) {
    if (!startRef.current) return;
    const point = pointFromEvent(event);
    const start = startRef.current;
    setSelection({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.max(0.01, Math.abs(point.x - start.x)),
      height: Math.max(0.01, Math.abs(point.y - start.y))
    });
  }

  function finishSelection() {
    startRef.current = null;
  }

  function scanCrop() {
    const image = imageRef.current;
    if (!image || selection.width < 0.03 || selection.height < 0.03) return;
    const sourceX = Math.round(selection.x * image.naturalWidth);
    const sourceY = Math.round(selection.y * image.naturalHeight);
    const sourceWidth = Math.round(selection.width * image.naturalWidth);
    const sourceHeight = Math.round(selection.height * image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    canvas.getContext("2d").drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
    onScan(canvas.toDataURL("image/png"));
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-slate-950/90 p-3 backdrop-blur-sm md:p-6">
      <section className="tree-modal mx-auto flex h-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
          <div>
            <p className="text-xs font-black uppercase text-blue-700">Recortar imagen</p>
            <h2 className="text-xl font-black">Selecciona solamente la operacion</h2>
          </div>
          <button className="rounded-full bg-slate-950 px-4 py-2 font-black text-white" onClick={onClose}>Cerrar X</button>
        </header>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-100 p-3">
          <div
            ref={frameRef}
            className="relative inline-block touch-none select-none overflow-hidden bg-white shadow-lg"
            onPointerDown={startSelection}
            onPointerMove={resizeSelection}
            onPointerUp={finishSelection}
            onPointerCancel={finishSelection}
          >
            <img
              ref={imageRef}
              src={previewUrl}
              alt="Imagen seleccionada"
              className="block max-h-[68vh] max-w-full"
              draggable="false"
            />
            <div
              className="pointer-events-none absolute border-4 border-cyan-500 bg-cyan-300/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.58)]"
              style={{
                left: `${selection.x * 100}%`,
                top: `${selection.y * 100}%`,
                width: `${selection.width * 100}%`,
                height: `${selection.height * 100}%`
              }}
            />
          </div>
        </div>

        <footer className="border-t border-slate-200 p-4">
          <p className="mb-3 text-center text-sm font-semibold text-slate-600">
            Arrastra sobre la imagen para encerrar una sola formula.
          </p>
          <button className="w-full rounded-xl bg-emerald-700 px-4 py-4 text-lg font-black text-white" onClick={scanCrop} disabled={busy}>
            {busy ? "Escaneando recorte..." : "Escanear recorte"}
          </button>
        </footer>
      </section>
    </div>
  );
}
