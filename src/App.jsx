import React, { useEffect, useMemo, useRef, useState } from "react";
import Tesseract from "tesseract.js";

class TreeNode {
  constructor(value, left = null, right = null) {
    this.value = value;
    this.left = left;
    this.right = right;
    this.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    this.x = 0;
    this.y = 0;
    this.result = null;
  }

  get isOperator() {
    return ["+", "-", "*", "/"].includes(this.value);
  }
}

function cleanExpression(text) {
  return String(text || "")
    .replace(/[xX]/g, "*")
    .replace(/,/g, ".")
    .replace(/÷/g, "/")
    .replace(/×/g, "*")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "")
    .replace(/[^0-9+\-*/().]/g, "");
}

function tokenize(expression) {
  const tokens = [];
  let i = 0;
  while (i < expression.length) {
    const char = expression[i];
    const previous = tokens[tokens.length - 1];
    const unaryMinus = char === "-" && (!previous || ["+", "-", "*", "/", "("].includes(previous));

    if (/\d|\./.test(char) || unaryMinus) {
      let value = unaryMinus ? "-" : "";
      i += unaryMinus ? 1 : 0;
      while (i < expression.length && /[\d.]/.test(expression[i])) value += expression[i++];
      if (value === "-" || Number.isNaN(Number(value))) throw new Error("Numero invalido.");
      tokens.push(value);
      continue;
    }

    if (["+", "-", "*", "/", "(", ")"].includes(char)) {
      tokens.push(char);
      i++;
      continue;
    }

    throw new Error("Caracter no permitido.");
  }
  return tokens;
}

function parseExpression(expression) {
  const tokens = tokenize(cleanExpression(expression));
  let position = 0;

  function primary() {
    const token = tokens[position++];
    if (!token) throw new Error("La expresion esta incompleta.");
    if (token === "(") {
      const node = addSub();
      if (tokens[position++] !== ")") throw new Error("Falta cerrar un parentesis.");
      return node;
    }
    if (!Number.isNaN(Number(token))) return new TreeNode(token);
    throw new Error("Se esperaba un numero o parentesis.");
  }

  function mulDiv() {
    let node = primary();
    while (["*", "/"].includes(tokens[position])) {
      const operator = tokens[position++];
      node = new TreeNode(operator, node, primary());
    }
    return node;
  }

  function addSub() {
    let node = mulDiv();
    while (["+", "-"].includes(tokens[position])) {
      const operator = tokens[position++];
      node = new TreeNode(operator, node, mulDiv());
    }
    return node;
  }

  const root = addSub();
  if (position < tokens.length) throw new Error("Hay simbolos sobrantes.");
  return root;
}

function evaluate(node, steps = []) {
  if (!node.isOperator) {
    node.result = Number(node.value);
    return node.result;
  }
  const left = evaluate(node.left, steps);
  const right = evaluate(node.right, steps);
  if (node.value === "/" && right === 0) throw new Error("No se puede dividir entre cero.");
  const result = { "+": left + right, "-": left - right, "*": left * right, "/": left / right }[node.value];
  node.result = result;
  steps.push({ nodeId: node.id, leftId: node.left.id, rightId: node.right.id, result });
  return result;
}

function collectNodes(node, nodes = []) {
  if (!node) return nodes;
  collectNodes(node.left, nodes);
  nodes.push(node);
  collectNodes(node.right, nodes);
  return nodes;
}

function layoutTree(root) {
  let order = 0;
  function walk(node, depth) {
    if (!node) return;
    walk(node.left, depth + 1);
    node.x = order * 110;
    node.y = depth * 118;
    order += 1;
    walk(node.right, depth + 1);
  }
  walk(root, 0);
  const nodes = collectNodes(root);
  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  nodes.forEach((node) => {
    node.x -= (minX + maxX) / 2;
  });
}

function round(value) {
  return Number.parseFloat(Number(value).toFixed(6));
}

function ScannerFrame({ videoRef, previewUrl, analyzing }) {
  return (
    <div className={`relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/15 bg-slate-950 shadow-glow ${analyzing ? "ring-2 ring-cyan-300" : ""}`}>
      <video ref={videoRef} className={`h-full w-full object-cover ${previewUrl ? "hidden" : "block"}`} autoPlay playsInline muted />
      {previewUrl ? <img src={previewUrl} alt="Documento cargado" className="absolute inset-0 h-full w-full object-cover" /> : null}

      {!previewUrl ? (
        <div className="absolute inset-0 grid place-items-center text-center text-slate-200">
          <div>
            <img src="/icon.svg" alt="" className="mx-auto mb-4 h-20 w-20 rounded-2xl shadow-2xl" />
            <p className="text-xl font-black">Centro de escaneo listo</p>
            <p className="mt-2 text-sm text-slate-400">Usa camara o sube una imagen de tu ejercicio.</p>
          </div>
        </div>
      ) : null}

      <div className="absolute inset-5 border border-cyan-200/30">
        <span className="absolute -left-px -top-px h-10 w-10 border-l-4 border-t-4 border-cyan-300" />
        <span className="absolute -right-px -top-px h-10 w-10 border-r-4 border-t-4 border-cyan-300" />
        <span className="absolute -bottom-px -left-px h-10 w-10 border-b-4 border-l-4 border-cyan-300" />
        <span className="absolute -bottom-px -right-px h-10 w-10 border-b-4 border-r-4 border-cyan-300" />
        {analyzing ? <span className="scanner-line absolute left-4 right-4 top-6 h-0.5 bg-gradient-to-r from-transparent via-cyan-200 to-transparent shadow-[0_0_20px_rgba(103,232,249,0.9)]" /> : null}
      </div>
    </div>
  );
}

function AnalysisPanel({ analysis, progress }) {
  const stages = ["Captura", "OCR", "Parser", "Arbol"];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${analysis.active ? "animate-ping bg-cyan-400" : analysis.done ? "bg-emerald-500" : "bg-slate-400"}`} />
        <strong className="text-sm text-slate-800">{analysis.title}</strong>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {stages.map((stage, index) => (
          <div key={stage} className={`rounded-lg px-2 py-2 text-center text-[11px] font-black uppercase ${progress >= (index + 1) * 24 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {stage}
          </div>
        ))}
      </div>
    </div>
  );
}

function TreeCanvas({ tree, steps, currentStep, answer }) {
  const canvasRef = useRef(null);
  const viewRef = useRef({ scale: 1, x: 0, y: 0, dragging: false, sx: 0, sy: 0, ox: 0, oy: 0 });

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(rect.width / 2 + viewRef.current.x, 96 + viewRef.current.y);
    ctx.scale(viewRef.current.scale, viewRef.current.scale);

    const active = steps[currentStep - 1];
    const activeIds = active ? new Set([active.nodeId, active.leftId, active.rightId]) : new Set();
    const resolvedIds = new Set(steps.slice(0, currentStep).map((step) => step.nodeId));

    function drawLines(node) {
      if (!node) return;
      [node.left, node.right].forEach((child) => {
        if (!child) return;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y + 32);
        ctx.lineTo(child.x, child.y - 32);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 4;
        ctx.stroke();
        drawLines(child);
      });
    }

    function drawNode(node) {
      if (!node) return;
      drawNode(node.left);
      const isActive = activeIds.has(node.id);
      const isDone = resolvedIds.has(node.id);
      ctx.beginPath();
      ctx.arc(node.x, node.y, isActive ? 37 : 32, 0, Math.PI * 2);
      ctx.fillStyle = node.isOperator ? "#0f766e" : "#ffffff";
      ctx.fill();
      ctx.lineWidth = isActive ? 7 : 4;
      ctx.strokeStyle = isActive ? "#f59e0b" : isDone ? "#22c55e" : node.isOperator ? "#0f766e" : "#334155";
      ctx.stroke();
      ctx.fillStyle = node.isOperator ? "#ffffff" : "#0f172a";
      ctx.font = "800 20px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.value, node.x, node.y);
      if ((isActive || isDone) && node.result !== null) {
        ctx.fillStyle = isDone ? "#15803d" : "#b45309";
        ctx.font = "800 13px Inter, sans-serif";
        ctx.fillText(`= ${round(node.result)}`, node.x, node.y + 51);
      }
      drawNode(node.right);
    }

    if (tree) {
      drawLines(tree);
      drawNode(tree);
    } else {
      ctx.fillStyle = "#64748b";
      ctx.font = "900 22px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("El arbol aparecera aqui", 0, 160);
    }
    ctx.restore();

    if (answer !== null) {
      ctx.fillStyle = "#07111f";
      ctx.beginPath();
      ctx.roundRect(18, 18, 320, 58, 16);
      ctx.fill();
      ctx.fillStyle = "#ecfeff";
      ctx.font = "900 19px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${currentStep >= steps.length && steps.length ? "Respuesta final" : "Resultado"}: ${round(answer)}`, 178, 48);
    }
  }

  useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [tree, steps, currentStep, answer]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full min-h-[580px] w-full touch-none"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        Object.assign(viewRef.current, { dragging: true, sx: event.clientX, sy: event.clientY, ox: viewRef.current.x, oy: viewRef.current.y });
      }}
      onPointerMove={(event) => {
        if (!viewRef.current.dragging) return;
        viewRef.current.x = viewRef.current.ox + event.clientX - viewRef.current.sx;
        viewRef.current.y = viewRef.current.oy + event.clientY - viewRef.current.sy;
        draw();
      }}
      onPointerUp={() => {
        viewRef.current.dragging = false;
      }}
      onWheel={(event) => {
        event.preventDefault();
        viewRef.current.scale = Math.max(0.35, Math.min(2.8, viewRef.current.scale * (event.deltaY > 0 ? 0.92 : 1.08)));
        draw();
      }}
    />
  );
}

export default function App() {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [expression, setExpression] = useState("(4+8)/3");
  const [tree, setTree] = useState(null);
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [status, setStatus] = useState("Sube una imagen, abre la camara o escribe una formula.");
  const [analysis, setAnalysis] = useState({ title: "Esperando documento", active: false, done: false });
  const [progress, setProgress] = useState(8);
  const [busy, setBusy] = useState(false);

  const resultText = useMemo(() => (answer === null ? "--" : round(answer)), [answer]);

  async function openCamera() {
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      videoRef.current.srcObject = nextStream;
      setStream(nextStream);
      setPreviewUrl("");
      setAnalysis({ title: "Camara conectada", active: false, done: false });
      setProgress(25);
      setStatus("Camara abierta. Enfoca la formula y presiona Escanear.");
    } catch {
      setStatus("No se pudo abrir la camara. Puedes subir una imagen o escribir la formula.");
    }
  }

  function loadImage(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setAnalysis({ title: "Documento cargado para lectura", active: false, done: false });
    setProgress(34);
    setStatus("Imagen cargada. Presiona Escanear para leer la formula.");
  }

  async function scan() {
    if (!previewUrl && !stream) {
      setStatus("Primero sube una imagen o abre la camara.");
      return;
    }
    setBusy(true);
    setAnalysis({ title: "Leyendo documento importante...", active: true, done: false });
    setProgress(42);
    try {
      let source = previewUrl;
      if (!source) {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth || 1280;
        canvas.height = videoRef.current.videoHeight || 720;
        canvas.getContext("2d").drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        source = canvas.toDataURL("image/png");
      }
      const result = await Tesseract.recognize(source, "eng", {
        logger: (event) => {
          if (event.status === "recognizing text") {
            setProgress(50 + Math.round(event.progress * 38));
            setAnalysis({ title: "OCR interpretando simbolos", active: true, done: false });
          }
        }
      });
      const detected = cleanExpression(result.data.text);
      if (!detected) throw new Error("No se detecto una formula clara.");
      setExpression(detected);
      setAnalysis({ title: "Formula detectada", active: false, done: false });
      setProgress(88);
      setStatus(`Formula detectada: ${detected}. Puedes editarla y generar el arbol.`);
    } catch (error) {
      setAnalysis({ title: "Lectura incompleta", active: false, done: false });
      setProgress(18);
      setStatus(error.message);
      navigator.vibrate?.([80, 40, 80]);
    } finally {
      setBusy(false);
    }
  }

  function buildTree() {
    try {
      const clean = cleanExpression(expression);
      const root = parseExpression(clean);
      layoutTree(root);
      const nextSteps = [];
      const result = evaluate(root, nextSteps);
      setExpression(clean);
      setTree(root);
      setSteps(nextSteps);
      setCurrentStep(0);
      setAnswer(result);
      setAnalysis({ title: "Formula convertida en arbol", active: false, done: true });
      setProgress(100);
      setStatus(`Arbol generado para: ${clean}`);
      navigator.vibrate?.(20);
    } catch (error) {
      setTree(null);
      setSteps([]);
      setCurrentStep(0);
      setAnswer(null);
      setAnalysis({ title: "Formula no valida", active: false, done: false });
      setProgress(20);
      setStatus(error.message);
      navigator.vibrate?.([80, 40, 80]);
    }
  }

  function nextStep() {
    if (!steps.length) return;
    setCurrentStep((value) => Math.min(value + 1, steps.length));
  }

  function play() {
    if (!steps.length) return;
    let index = 0;
    setCurrentStep(0);
    const timer = setInterval(() => {
      index += 1;
      setCurrentStep(index);
      if (index >= steps.length) clearInterval(timer);
    }, 850);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_10%,rgba(20,184,166,0.28),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(37,99,235,0.22),transparent_32%),linear-gradient(180deg,#f8fafc,#e2e8f0)] p-3 text-slate-950 md:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-40px)] max-w-[1500px] gap-4 lg:grid-cols-[460px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-panel backdrop-blur-2xl">
          <header className="mb-5 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/icon.svg" alt="" className="h-14 w-14 rounded-2xl shadow-xl" />
              <div>
                <p className="text-xs font-black uppercase text-teal-700">MathTree OCR Lab</p>
                <h1 className="text-2xl font-black leading-tight">Escaner inteligente de formulas</h1>
              </div>
            </div>
            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black uppercase text-cyan-100">React</span>
          </header>

          <ScannerFrame videoRef={videoRef} previewUrl={previewUrl} analyzing={analysis.active} />

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button className="rounded-xl bg-teal-700 px-3 py-3 font-black text-white shadow-lg" onClick={openCamera}>Camara</button>
            <button className="rounded-xl bg-slate-950 px-3 py-3 font-black text-white shadow-lg disabled:opacity-60" onClick={scan} disabled={busy}>{busy ? "Leyendo" : "Escanear"}</button>
            <button className="rounded-xl bg-blue-700 px-3 py-3 font-black text-white shadow-lg" onClick={() => fileRef.current.click()}>Imagen</button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => loadImage(event.target.files[0])} />
          </div>

          <div className="mt-4">
            <AnalysisPanel analysis={analysis} progress={progress} />
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-black text-slate-600">Formula detectada o escrita</span>
            <input className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-xl font-black shadow-inner outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={expression} onChange={(event) => setExpression(event.target.value)} />
          </label>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {["(4+8)/3", "2+3*4", "(10-2)*(6/3)"].map((item) => (
              <button key={item} className="rounded-xl border border-slate-200 bg-slate-100 px-2 py-2 text-sm font-black text-slate-700" onClick={() => setExpression(item)}>{item}</button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button className="rounded-xl bg-emerald-700 px-3 py-3 font-black text-white shadow-lg" onClick={buildTree}>Generar</button>
            <button className="rounded-xl bg-amber-600 px-3 py-3 font-black text-white shadow-lg" onClick={play}>Play</button>
            <button className="rounded-xl bg-orange-700 px-3 py-3 font-black text-white shadow-lg" onClick={nextStep}>Paso</button>
          </div>

          <p className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4 font-bold text-slate-600">{status}</p>
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-panel">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-5 py-4">
            <div>
              <p className="text-xs font-black uppercase text-slate-500">Resultado</p>
              <strong className="text-4xl font-black text-slate-950">{resultText}</strong>
            </div>
            <div className="text-right">
              <p className="text-xs font-black uppercase text-slate-500">Paso actual</p>
              <strong className="text-3xl font-black text-slate-950">{currentStep}/{steps.length}</strong>
            </div>
          </div>
          <div className="grid-lab relative min-h-[640px]">
            <div className="pointer-events-none absolute bottom-6 right-6 text-7xl font-black text-slate-900/5">TREE VIEW</div>
            <TreeCanvas tree={tree} steps={steps} currentStep={currentStep} answer={answer} />
          </div>
        </section>
      </div>
    </main>
  );
}
