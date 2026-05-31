import { createWorker, PSM } from "tesseract.js";
import { cleanExpression } from "./mathTree.js";

let workerPromise = null;
let progressListener = null;

// Carga el motor una sola vez para acelerar los siguientes escaneos.
async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, {
      logger: (event) => {
        if (event.status === "recognizing text") progressListener?.(event.progress);
      }
    }).then(async (worker) => {
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
    image.onerror = () => reject(new Error("No se pudo abrir la imagen seleccionada."));
    image.src = source;
  });
}

function limitSize(width, height, maxSide = 1500) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

// Busca el area oscura principal para quitar bordes amplios de la hoja.
function detectInkBounds(image) {
  const previewSize = limitSize(image.width, image.height, 700);
  const canvas = document.createElement("canvas");
  canvas.width = previewSize.width;
  canvas.height = previewSize.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      const index = (y * canvas.width + x) * 4;
      const gray = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
      if (gray < 145) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0 || maxY < 0) return null;
  const scaleX = image.width / canvas.width;
  const scaleY = image.height / canvas.height;
  const paddingX = Math.max(18, (maxX - minX) * 0.1);
  const paddingY = Math.max(18, (maxY - minY) * 0.35);
  const x = Math.max(0, (minX - paddingX) * scaleX);
  const y = Math.max(0, (minY - paddingY) * scaleY);
  const right = Math.min(image.width, (maxX + paddingX) * scaleX);
  const bottom = Math.min(image.height, (maxY + paddingY) * scaleY);

  return { x, y, width: right - x, height: bottom - y };
}

// Crea una version ampliada para no perder signos delgados.
function createVariant(image, bounds, mode = "contrast") {
  const width = bounds?.width || image.width;
  const height = bounds?.height || image.height;
  const x = bounds?.x || 0;
  const y = bounds?.y || 0;
  const scale = Math.max(1.5, Math.min(4, 1900 / width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114;
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.55 + 128));
    const value = mode === "binary" ? (contrast > 170 ? 255 : 0) : contrast;
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
  const numbers = (expression.match(/\d+(?:\.\d+)?/g) || []).length;
  const parentheses = (expression.match(/[()]/g) || []).length;
  const invalidEnding = /[+\-*/.(]$/.test(expression) ? 20 : 0;
  return operators * 20 + numbers * 7 + parentheses * 2 + expression.length - invalidEnding;
}

async function readVariant(worker, canvas) {
  const result = await worker.recognize(canvas);
  return cleanExpression(result.data.text);
}

// Prueba varios tratamientos y devuelve la formula mas completa.
export async function recognizeFormula(source, onProgress) {
  progressListener = onProgress;
  try {
    const worker = await getWorker();
    const image = await loadImage(source);
    const inkBounds = detectInkBounds(image);
    const candidates = [];

    candidates.push(await readVariant(worker, createVariant(image, inkBounds, "contrast")));

    if (scoreFormula(candidates[0]) < 35) {
      candidates.push(await readVariant(worker, createVariant(image, inkBounds, "binary")));
      candidates.push(await readVariant(worker, createVariant(image, null, "contrast")));
    }

    return candidates.sort((a, b) => scoreFormula(b) - scoreFormula(a))[0] || "";
  } finally {
    progressListener = null;
  }
}
