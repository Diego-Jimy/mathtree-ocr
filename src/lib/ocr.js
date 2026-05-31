import { createWorker, PSM } from "tesseract.js";
import { cleanExpression } from "./mathTree.js";

let workerPromise = null;
let progressListener = null;

// Carga Tesseract una sola vez. Los siguientes escaneos son mas rapidos.
async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, {
      logger: (event) => {
        if (event.status === "recognizing text") {
          progressListener?.(event.progress);
        }
      }
    }).then(async (worker) => {
      // La imagen contiene una formula corta, no un documento completo.
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789+-*/().xX",
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        preserve_interword_spaces: "0",
        user_defined_dpi: "300"
      });
      return worker;
    });
  }
  return workerPromise;
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo abrir la imagen."));
    image.src = source;
  });
}

// Mejora contraste y resolucion sin borrar signos delgados como + o /.
async function prepareImage(source, { cropCenter = false, threshold = false } = {}) {
  const image = await loadImage(source);
  const sourceX = cropCenter ? image.width * 0.08 : 0;
  const sourceY = cropCenter ? image.height * 0.28 : 0;
  const sourceWidth = cropCenter ? image.width * 0.84 : image.width;
  const sourceHeight = cropCenter ? image.height * 0.44 : image.height;
  const scale = Math.max(2, Math.min(3, 1900 / sourceWidth));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  ctx.drawImage(
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

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.7 + 128));
    const value = threshold ? (contrasted > 155 ? 255 : 0) : contrasted;
    pixels.data[index] = value;
    pixels.data[index + 1] = value;
    pixels.data[index + 2] = value;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function scoreFormula(expression) {
  if (!expression) return -100;
  const operators = (expression.match(/[+\-*/]/g) || []).length;
  const numbers = (expression.match(/\d+/g) || []).length;
  const open = (expression.match(/\(/g) || []).length;
  const close = (expression.match(/\)/g) || []).length;
  return operators * 12 + numbers * 4 + expression.length - Math.abs(open - close) * 15;
}

async function recognizeVariant(worker, canvas) {
  const result = await worker.recognize(canvas);
  return cleanExpression(result.data.text);
}

// Lee rapido primero. Solo intenta otras variantes si faltan operadores.
export async function recognizeFormula(source, onProgress) {
  progressListener = onProgress;
  const worker = await getWorker();
  const candidates = [];

  const normal = await recognizeVariant(worker, await prepareImage(source));
  candidates.push(normal);

  if (!/[+\-*/]/.test(normal)) {
    const centered = await recognizeVariant(worker, await prepareImage(source, { cropCenter: true }));
    candidates.push(centered);
  }

  if (!candidates.some((candidate) => /[+\-*/]/.test(candidate))) {
    const threshold = await recognizeVariant(worker, await prepareImage(source, { threshold: true }));
    candidates.push(threshold);
  }

  progressListener = null;
  return candidates.sort((a, b) => scoreFormula(b) - scoreFormula(a))[0] || "";
}
