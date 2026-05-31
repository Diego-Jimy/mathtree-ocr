import React, { useEffect, useMemo, useRef, useState } from "react";
import Tesseract from "tesseract.js";

// Cada nodo guarda un numero u operador del arbol.
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

// Normaliza los simbolos que el OCR suele confundir.
function cleanExpression(text) {
  return String(text || "")
    .replace(/[xX]/g, "*")
    .replace(/,/g, ".")
    .replace(/\u00f7/g, "/")
    .replace(/\u00d7/g, "*")
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/\s+/g, "")
    .replace(/[^0-9+\-*/().]/g, "");
}

// Separa la expresion en numeros, operadores y parentesis.
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

// Construye el arbol respetando parentesis y prioridad de operadores.
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

// Resuelve el arbol de forma recursiva y registra cada paso.
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

// Asigna una posicion visual a cada nodo del arbol.
function layoutTree(root) {
  let order = 0;
  function walk(node, depth) {
    if (!node) return;
    walk(node.left, depth + 1);
    node.x = order * 138;
    node.y = depth * 148;
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

// Mantiene un decimal visible para resultados enteros, por ejemplo: 4.0.
function formatResult(value) {
  const rounded = round(value);
  return Number.isInteger(rounded) ? rounded.toFixed(1) : String(rounded);
}

// Mejora nitidez y contraste antes de ejecutar OCR.
async function prepareImageForOcr(source) {
  const image = new Image();
  image.src = source;
  await image.decode();
  const scale = Math.max(2, Math.min(3, 1800 / image.width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114;
    const value = gray > 155 ? 255 : gray < 100 ? 0 : Math.round((gray - 100) * 4.64);
    pixels.data[index] = value;
    pixels.data[index + 1] = value;
    pixels.data[index + 2] = value;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

// Limita Tesseract a los caracteres usados en formulas.
async function recognizeFormula(source, logger) {
  const preparedSource = await prepareImageForOcr(source);
  return Tesseract.recognize(preparedSource, "eng", {
    logger,
    tessedit_char_whitelist: "0123456789+-*/().xX"
  });
}

// Ventana para capturar una foto y decidir si se envia al OCR.
function CameraModal({ videoRef, capturedUrl, analyzing, onClose, onCapture, onScan, onRetake }) {
  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-slate-950/90 p-3 backdrop-blur-sm md:p-6">
      <section className="tree-modal mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 text-white">
          <div>
            <p className="text-xs font-black uppercase text-cyan-300">Camara OCR</p>
            <h2 className="text-xl font-black">{capturedUrl ? "Confirma la fotografia" : "Apunta hacia la formula"}</h2>
          </div>
          <button className="rounded-full bg-white px-4 py-2 font-black text-slate-950" onClick={onClose}>Cerrar X</button>
        </div>

        <div className="relative flex-1 overflow-hidden bg-black">
          <video ref={videoRef} className={`h-full w-full object-cover ${capturedUrl ? "hidden" : "block"}`} autoPlay playsInline muted />
          {capturedUrl ? <img src={capturedUrl} alt="Fotografia capturada" className="h-full w-full object-contain" /> : null}
          <div className="pointer-events-none absolute inset-6 border border-cyan-200/40">
            <span className="absolute -left-px -top-px h-12 w-12 border-l-4 border-t-4 border-cyan-300" />
            <span className="absolute -right-px -top-px h-12 w-12 border-r-4 border-t-4 border-cyan-300" />
            <span className="absolute -bottom-px -left-px h-12 w-12 border-b-4 border-l-4 border-cyan-300" />
            <span className="absolute -bottom-px -right-px h-12 w-12 border-b-4 border-r-4 border-cyan-300" />
            {analyzing ? <span className="scanner-line absolute left-4 right-4 top-6 h-0.5 bg-gradient-to-r from-transparent via-cyan-200 to-transparent" /> : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-white/10 p-4">
          {capturedUrl ? (
            <>
              <button className="rounded-xl bg-slate-700 px-4 py-4 font-black text-white" onClick={onRetake} disabled={analyzing}>Tomar otra</button>
              <button className="rounded-xl bg-emerald-600 px-4 py-4 font-black text-white" onClick={onScan} disabled={analyzing}>{analyzing ? "Escaneando..." : "Escanear foto"}</button>
            </>
          ) : (
            <button className="col-span-2 rounded-xl bg-emerald-600 px-4 py-4 text-lg font-black text-white" onClick={onCapture}>Tomar fotografia</button>
          )}
        </div>
      </section>
    </div>
  );
}

// Vista previa para confirmar una imagen elegida desde la galeria.
function ImageModal({ previewUrl, analyzing, onClose, onScan }) {
  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-slate-950/90 p-3 backdrop-blur-sm md:p-6">
      <section className="tree-modal mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
          <div>
            <p className="text-xs font-black uppercase text-blue-700">Imagen seleccionada</p>
            <h2 className="text-xl font-black text-slate-950">Confirma antes de escanear</h2>
          </div>
          <button className="rounded-full bg-slate-950 px-4 py-2 font-black text-white" onClick={onClose}>Cerrar X</button>
        </div>
        <div className="flex-1 overflow-hidden bg-slate-100 p-3">
          <img src={previewUrl} alt="Imagen seleccionada" className="h-full w-full object-contain" />
        </div>
        <div className="border-t border-slate-200 p-4">
          <button className="w-full rounded-xl bg-emerald-700 px-4 py-4 text-lg font-black text-white" onClick={onScan} disabled={analyzing}>
            {analyzing ? "Escaneando imagen..." : "Escanear imagen"}
          </button>
        </div>
      </section>
    </div>
  );
}

// Muestra el avance del proceso: captura, OCR, parser y arbol.
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

// Dibuja el arbol y permite arrastrar o hacer zoom.
function TreeCanvas({ tree, steps, currentStep, answer }) {
  const canvasRef = useRef(null);
  const viewRef = useRef({
    scale: 1,
    x: 0,
    y: 0,
    dragging: false,
    sx: 0,
    sy: 0,
    ox: 0,
    oy: 0,
    pinchDistance: 0,
    pinchScale: 1
  });
  const pointersRef = useRef(new Map());

  function pointerDistance() {
    const pointers = [...pointersRef.current.values()];
    if (pointers.length < 2) return 0;
    return Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
  }

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
        ctx.moveTo(node.x, node.y + 39);
        ctx.lineTo(child.x, child.y - 39);
        ctx.strokeStyle = "#9aaac0";
        ctx.lineWidth = 5;
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
      const radius = isActive ? 45 : 39;
      ctx.save();
      ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.isOperator ? "#172033" : "#ffffff";
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = isActive ? 7 : 4;
      ctx.strokeStyle = isActive ? "#22c55e" : isDone ? "#16a34a" : node.isOperator ? "#ff9800" : "#4fc3f7";
      ctx.stroke();
      ctx.fillStyle = node.isOperator ? "#ffb74d" : "#0369a1";
      ctx.font = "800 22px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.value, node.x, node.y);
      if ((isActive || isDone) && node.result !== null) {
        ctx.fillStyle = isDone ? "#15803d" : "#b45309";
        ctx.font = "800 13px Inter, sans-serif";
        ctx.fillText(`= ${formatResult(node.result)}`, node.x, node.y + 60);
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
      ctx.roundRect(18, 18, 340, 62, 16);
      ctx.fill();
      ctx.fillStyle = "#ecfeff";
      ctx.font = "900 20px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${currentStep >= steps.length && steps.length ? "Respuesta final" : "Resultado"}: ${formatResult(answer)}`, 188, 50);
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
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointersRef.current.size === 2) {
          viewRef.current.pinchDistance = pointerDistance();
          viewRef.current.pinchScale = viewRef.current.scale;
          viewRef.current.dragging = false;
          return;
        }
        Object.assign(viewRef.current, {
          dragging: true,
          sx: event.clientX,
          sy: event.clientY,
          ox: viewRef.current.x,
          oy: viewRef.current.y
        });
      }}
      onPointerMove={(event) => {
        if (pointersRef.current.has(event.pointerId)) {
          pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        }
        if (pointersRef.current.size === 2) {
          const distance = pointerDistance();
          const initialDistance = viewRef.current.pinchDistance || distance;
          viewRef.current.scale = Math.max(0.45, Math.min(2.8, viewRef.current.pinchScale * (distance / initialDistance)));
          draw();
          return;
        }
        if (!viewRef.current.dragging) return;
        viewRef.current.x = viewRef.current.ox + event.clientX - viewRef.current.sx;
        viewRef.current.y = viewRef.current.oy + event.clientY - viewRef.current.sy;
        draw();
      }}
      onPointerUp={() => {
        pointersRef.current.clear();
        viewRef.current.dragging = false;
      }}
      onPointerCancel={() => {
        pointersRef.current.clear();
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
  const expressionRef = useRef(null);
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
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showTree, setShowTree] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);

  const resultText = useMemo(() => (answer === null ? "--" : formatResult(answer)), [answer]);

  // Guarda el aviso de instalacion de Chrome para usarlo desde el boton.
  useEffect(() => {
    function handleInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, []);

  // Apaga la camara si el usuario cierra la aplicacion.
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  // Solicita permiso y enciende la camara del dispositivo.
  async function openCamera() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus("La camara requiere HTTPS. En el celular abre la URL publicada por Vercel.");
      return;
    }
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      videoRef.current.srcObject = nextStream;
      setStream(nextStream);
      setCapturedUrl("");
      setShowCamera(true);
      setAnalysis({ title: "Camara conectada", active: false, done: false });
      setProgress(25);
      setStatus("Camara abierta. Enfoca la formula y presiona Escanear.");
    } catch {
      setStatus("No se pudo abrir la camara. Puedes subir una imagen o escribir la formula.");
    }
  }

  // Detiene todas las pistas de video activas.
  function closeCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
    setCapturedUrl("");
    setShowCamera(false);
    setStatus("Camara apagada.");
  }

  // Muestra la instalacion PWA cuando el navegador la permite.
  async function installApp() {
    if (!installPrompt) {
      setStatus('Para instalar: abre el menu del navegador y elige "Instalar app" o "Agregar a pantalla principal".');
      return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  // Carga una fotografia para que el OCR pueda leerla.
  function loadImage(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setShowImage(true);
    setAnalysis({ title: "Documento cargado para lectura", active: false, done: false });
    setProgress(34);
    setStatus("Imagen cargada. Presiona Escanear para leer la formula.");
  }

  // Ejecuta OCR solo despues de que el usuario confirme una imagen.
  async function scan(source = previewUrl) {
    if (!source) return;
    setBusy(true);
    setAnalysis({ title: "Leyendo documento importante...", active: true, done: false });
    setProgress(42);
    try {
      const result = await recognizeFormula(source, (event) => {
        if (event.status === "recognizing text") {
          setProgress(50 + Math.round(event.progress * 38));
          setAnalysis({ title: "OCR interpretando simbolos", active: true, done: false });
        }
      });
      const detected = cleanExpression(result.data.text);
      if (!detected) throw new Error("No se detecto una formula clara.");
      setExpression(detected);
      setAnalysis({ title: "Formula detectada", active: false, done: false });
      setProgress(88);
      setStatus(`Formula detectada: ${detected}. Puedes editarla y generar el arbol.`);
      setShowImage(false);
      closeCamera();
    } catch (error) {
      setAnalysis({ title: "Lectura incompleta", active: false, done: false });
      setProgress(18);
      setStatus(error.message);
      navigator.vibrate?.([80, 40, 80]);
    } finally {
      setBusy(false);
    }
  }

  // Captura una fotografia pero espera confirmacion antes de escanear.
  function capturePhoto() {
    if (!videoRef.current || !stream) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    setCapturedUrl(canvas.toDataURL("image/png"));
    setStatus('Fotografia capturada. Presiona "Escanear foto" para analizarla.');
  }

  function retakePhoto() {
    setCapturedUrl("");
    setStatus("Camara abierta. Apunta hacia la formula.");
  }

  // Convierte la formula escrita en un arbol y abre la ventana de resultado.
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
      setShowTree(true);
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

  // Regresa la animacion al inicio sin borrar el arbol.
  function resetSteps() {
    setCurrentStep(0);
  }

  // Cierra la ventana para corregir la formula manualmente.
  function editExpression() {
    setShowTree(false);
    setTimeout(() => expressionRef.current?.focus(), 0);
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
      <div className="mx-auto max-w-2xl">
        <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-panel backdrop-blur-2xl">
          <header className="mb-5 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/icon.svg" alt="" className="h-14 w-14 rounded-2xl shadow-xl" />
              <div>
                <p className="text-xs font-black uppercase text-teal-700">MathTree OCR Lab</p>
                <h1 className="text-2xl font-black leading-tight">Escaner inteligente de formulas</h1>
              </div>
            </div>
            <button
              className="shrink-0 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black uppercase text-cyan-100 shadow-lg"
              onClick={installApp}
            >
              Instalar app
            </button>
          </header>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="rounded-xl bg-teal-700 px-3 py-4 font-black text-white shadow-lg" onClick={openCamera}>
              Camara
            </button>
            <button className="rounded-xl bg-blue-700 px-3 py-4 font-black text-white shadow-lg" onClick={() => fileRef.current.click()}>Subir imagen</button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => loadImage(event.target.files[0])} />
          </div>

          <div className="mt-4">
            <AnalysisPanel analysis={analysis} progress={progress} />
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-black text-slate-600">Formula detectada o escrita</span>
            <input
              ref={expressionRef}
              inputMode="decimal"
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-xl font-black shadow-inner outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              value={expression}
              onClick={() => setShowKeyboard(true)}
              onChange={(event) => setExpression(event.target.value)}
            />
          </label>

          {showKeyboard ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <strong className="text-sm text-slate-700">Teclado matematico</strong>
                <button type="button" className="rounded-lg bg-slate-200 px-3 py-1 text-xs font-black text-slate-700" onClick={() => setShowKeyboard(false)}>Ocultar</button>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {["7", "8", "9", "+", "-", "(", "4", "5", "6", "*", "/", ")", "1", "2", "3", ".", "0", "Borrar"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-1 py-2 text-sm font-black text-slate-800 shadow-sm"
                    onClick={() => setExpression((value) => key === "Borrar" ? value.slice(0, -1) : value + key)}
                  >
                    {key}
                  </button>
                ))}
              </div>
              <button type="button" className="mt-2 w-full rounded-lg bg-slate-200 px-3 py-2 text-sm font-black text-slate-700" onClick={() => setExpression("")}>Limpiar formula</button>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-3 gap-2">
            {["(4+8)/3", "2+3*4", "(10-2)*(6/3)"].map((item) => (
              <button key={item} className="rounded-xl border border-slate-200 bg-slate-100 px-2 py-2 text-sm font-black text-slate-700" onClick={() => setExpression(item)}>{item}</button>
            ))}
          </div>

          <button className="mt-4 w-full rounded-xl bg-emerald-700 px-3 py-4 text-lg font-black text-white shadow-lg" onClick={buildTree}>
            Generar arbol visual
          </button>

          <p className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4 font-bold text-slate-600">{status}</p>
        </section>
      </div>

      {showCamera ? (
        <CameraModal
          videoRef={videoRef}
          capturedUrl={capturedUrl}
          analyzing={busy}
          onClose={closeCamera}
          onCapture={capturePhoto}
          onScan={() => scan(capturedUrl)}
          onRetake={retakePhoto}
        />
      ) : null}

      {showImage ? (
        <ImageModal previewUrl={previewUrl} analyzing={busy} onClose={() => setShowImage(false)} onScan={() => scan(previewUrl)} />
      ) : null}

      {showTree ? (
        <div className="modal-backdrop fixed inset-0 z-50 bg-slate-950/85 p-0 backdrop-blur-sm md:p-5">
          <section className="tree-modal mx-auto flex h-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl md:rounded-3xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 md:px-6">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-teal-700">Arbol de expresion</p>
                <h2 className="truncate text-lg font-black text-slate-950 md:text-2xl">{expression}</h2>
              </div>
              <button
                className="shrink-0 rounded-full bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg"
                onClick={() => setShowTree(false)}
                aria-label="Cerrar ventana del arbol"
              >
                Cerrar X
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-950 px-4 py-3 text-white md:px-6">
              <div>
                <p className="text-xs font-black uppercase text-emerald-300">Resultado final</p>
                <strong className="result-pop text-4xl font-black text-emerald-400 md:text-5xl">{resultText}</strong>
              </div>
              <div className="min-w-[150px] text-right">
                <p className="text-xs font-black uppercase text-slate-300">Paso actual: {currentStep} de {steps.length}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700">
                  <div className="h-full rounded-full bg-emerald-400 transition-all duration-300" style={{ width: `${steps.length ? (currentStep / steps.length) * 100 : 0}%` }} />
                </div>
              </div>
            </div>

            <div className="grid-lab relative flex-1 overflow-hidden bg-[#f8f9fa]">
              <div className="pointer-events-none absolute bottom-6 right-6 text-6xl font-black text-slate-900/5">TREE VIEW</div>
              <TreeCanvas tree={tree} steps={steps} currentStep={currentStep} answer={answer} />
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-white p-3 md:grid-cols-4 md:gap-3 md:p-4">
              <button className="rounded-xl bg-slate-700 px-3 py-3 font-black text-white" onClick={resetSteps}>
                Reiniciar
              </button>
              <button className="rounded-xl bg-amber-600 px-3 py-3 font-black text-white" onClick={play}>
                Play automatico
              </button>
              <button className="rounded-xl bg-orange-700 px-3 py-3 font-black text-white" onClick={nextStep}>
                Siguiente paso
              </button>
              <button className="rounded-xl bg-blue-700 px-3 py-3 font-black text-white" onClick={editExpression}>
                Editar formula
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

