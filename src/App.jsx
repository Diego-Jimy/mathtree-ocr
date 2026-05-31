import React, { useEffect, useMemo, useRef, useState } from "react";
import AnalysisPanel from "./components/AnalysisPanel.jsx";
import CameraModal from "./components/CameraModal.jsx";
import ImageModal from "./components/ImageModal.jsx";
import TreeModal from "./components/TreeModal.jsx";
import { cleanExpression, evaluateTree, formatResult, layoutTree, parseExpression } from "./lib/mathTree.js";
import { recognizeFormula } from "./lib/ocr.js";

const EXAMPLES = ["(4+8)/3", "2+3*4", "(10-2)*(6/3)"];

export default function App() {
  const videoRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const playTimerRef = useRef(null);

  const [expression, setExpression] = useState("(4+8)/3");
  const [status, setStatus] = useState("Sube una imagen, abre la camara o escribe una formula.");
  const [phase, setPhase] = useState("CAPTURA");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState(null);
  const [capturedUrl, setCapturedUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const [tree, setTree] = useState(null);
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [installEvent, setInstallEvent] = useState(null);

  const resultText = useMemo(() => (answer === null ? "--" : formatResult(answer)), [answer]);

  // Guarda el aviso de instalacion para usarlo desde el boton.
  useEffect(() => {
    function saveInstallEvent(event) {
      event.preventDefault();
      setInstallEvent(event);
    }
    window.addEventListener("beforeinstallprompt", saveInstallEvent);
    return () => window.removeEventListener("beforeinstallprompt", saveInstallEvent);
  }, []);

  // Conecta la transmision despues de mostrar el modal.
  useEffect(() => {
    if (showCamera && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [showCamera, stream]);

  // Libera camara y temporizadores al salir de la pagina.
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
      window.clearInterval(playTimerRef.current);
    };
  }, [stream]);

  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
    setCapturedUrl("");
    setShowCamera(false);
  }

  function closeCamera() {
    stopCamera();
    setStatus("Camara apagada.");
    setPhase("CAPTURA");
    setProgress(0);
  }

  async function openCamera() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus("La camara del celular necesita HTTPS. Pruebala desde tu enlace publico de Vercel.");
      return;
    }
    setShowCamera(true);
    setCapturedUrl("");
    setStatus("Solicitando permiso para usar la camara.");
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      setStream(nextStream);
      setStatus("Camara encendida. Apunta hacia la formula y toma la fotografia.");
    } catch {
      setShowCamera(false);
      setStatus("No se pudo abrir la camara. Revisa el permiso del navegador.");
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setStatus("Espera un momento mientras inicia la camara.");
      return;
    }
    // Guarda solamente la franja central marcada en la camara.
    const sourceWidth = video.videoWidth * 0.86;
    const sourceHeight = video.videoHeight * 0.3;
    const sourceX = (video.videoWidth - sourceWidth) / 2;
    const sourceY = (video.videoHeight - sourceHeight) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sourceWidth);
    canvas.height = Math.round(sourceHeight);
    canvas.getContext("2d").drawImage(
      video,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
    setCapturedUrl(canvas.toDataURL("image/jpeg", 0.95));
    setStatus("Fotografia lista. Confirma con Escanear foto o toma otra.");
  }

  function selectImage(file) {
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const nextUrl = URL.createObjectURL(file);
    setImageUrl(nextUrl);
    setShowImage(true);
    setStatus("Imagen seleccionada. Confirma para ejecutar el OCR.");
    setPhase("CAPTURA");
    setProgress(8);
  }

  async function scanSource(source) {
    if (!source || busy) return;
    setBusy(true);
    setPhase("OCR");
    setProgress(18);
    setStatus("Leyendo la expresion matematica...");
    try {
      const detected = await recognizeFormula(source, (ocrProgress) => {
        setProgress(20 + Math.round(ocrProgress * 62));
      });
      if (!detected) throw new Error("No se reconocio una formula.");
      setExpression(detected);
      setShowImage(false);
      stopCamera();
      setPhase("PARSER");
      setProgress(88);
      setStatus(`Formula detectada: ${detected}. Puedes corregirla antes de generar el arbol.`);
    } catch (error) {
      setStatus(error.message || "No se pudo reconocer la formula. Prueba con una imagen mas clara.");
      setProgress(0);
      setPhase("CAPTURA");
    } finally {
      setBusy(false);
    }
  }

  function generateTree() {
    try {
      const cleaned = cleanExpression(expression);
      if (!cleaned) throw new Error("Escribe o escanea una formula primero.");
      const nextTree = parseExpression(cleaned);
      const nextSteps = [];
      const nextAnswer = evaluateTree(nextTree, nextSteps);
      layoutTree(nextTree);
      window.clearInterval(playTimerRef.current);
      setExpression(cleaned);
      setTree(nextTree);
      setSteps(nextSteps);
      setCurrentStep(0);
      setAnswer(nextAnswer);
      setShowTree(true);
      setPhase("ARBOL");
      setProgress(100);
      setStatus("Arbol generado correctamente.");
    } catch (error) {
      setStatus(error.message || "La formula no es valida.");
      setPhase("PARSER");
      setProgress(0);
    }
  }

  function nextStep() {
    setCurrentStep((step) => Math.min(step + 1, steps.length));
  }

  function resetSteps() {
    window.clearInterval(playTimerRef.current);
    setCurrentStep(0);
  }

  function playSteps() {
    window.clearInterval(playTimerRef.current);
    setCurrentStep(0);
    let step = 0;
    playTimerRef.current = window.setInterval(() => {
      step += 1;
      setCurrentStep(Math.min(step, steps.length));
      if (step >= steps.length) window.clearInterval(playTimerRef.current);
    }, 850);
  }

  function editFormula() {
    setShowTree(false);
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }

  async function installApp() {
    if (!installEvent) {
      setStatus("Si no aparece el aviso, abre el menu del navegador y elige Instalar aplicacion.");
      return;
    }
    installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 text-slate-950 md:px-6">
      <section className="mx-auto max-w-3xl rounded-3xl border border-white bg-white/95 p-4 shadow-xl md:p-6">
        <header className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-2xl font-black text-teal-300 shadow-lg">+</div>
            <div>
              <p className="text-xs font-black uppercase text-teal-700">MathTree OCR Lab</p>
              <h1 className="text-2xl font-black leading-tight">Escaner inteligente de formulas</h1>
            </div>
          </div>
          <button className="shrink-0 rounded-xl bg-slate-950 px-3 py-3 text-xs font-black text-white shadow-lg" onClick={installApp}>
            Instalar app
          </button>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="rounded-xl bg-teal-700 px-4 py-4 font-black text-white shadow-md" onClick={openCamera}>Camara</button>
          <button className="rounded-xl bg-blue-700 px-4 py-4 font-black text-white shadow-md" onClick={() => fileRef.current?.click()}>Subir imagen</button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              selectImage(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>

        <div className="mt-4">
          <AnalysisPanel phase={phase} progress={progress} status={status} />
        </div>

        <label className="mt-5 block text-sm font-black text-slate-700" htmlFor="formula">Formula detectada o escrita</label>
        <input
          ref={inputRef}
          id="formula"
          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-2xl font-black shadow-inner outline-none ring-teal-500 transition focus:ring-2"
          value={expression}
          inputMode="text"
          autoComplete="off"
          spellCheck="false"
          onChange={(event) => setExpression(cleanExpression(event.target.value))}
        />

        <div className="mt-4 grid grid-cols-3 gap-2">
          {EXAMPLES.map((example) => (
            <button className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-sm font-bold text-slate-700" key={example} onClick={() => setExpression(example)}>
              {example}
            </button>
          ))}
        </div>

        <button className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-4 text-lg font-black text-white shadow-lg" onClick={generateTree}>
          Generar arbol visual
        </button>
      </section>

      {showCamera ? (
        <CameraModal
          videoRef={videoRef}
          capturedUrl={capturedUrl}
          busy={busy}
          onClose={closeCamera}
          onCapture={capturePhoto}
          onRetake={() => setCapturedUrl("")}
          onScan={() => scanSource(capturedUrl)}
        />
      ) : null}

      {showImage ? <ImageModal previewUrl={imageUrl} busy={busy} onClose={() => setShowImage(false)} onScan={scanSource} /> : null}

      {showTree && tree ? (
        <TreeModal
          expression={expression}
          tree={tree}
          steps={steps}
          currentStep={currentStep}
          answer={resultText}
          onClose={() => setShowTree(false)}
          onReset={resetSteps}
          onPlay={playSteps}
          onNext={nextStep}
          onEdit={editFormula}
        />
      ) : null}
    </main>
  );
}
