import Tesseract from "tesseract.js";
import { cleanExpression } from "./mathTree.js";

// Aumenta contraste y resolucion antes de ejecutar OCR.
async function prepareImage(source) {
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

// Devuelve una formula limpia lista para editar o generar.
export async function recognizeFormula(source, onProgress) {
  const prepared = await prepareImage(source);
  const result = await Tesseract.recognize(prepared, "eng", {
    logger: (event) => {
      if (event.status === "recognizing text") onProgress?.(event.progress);
    },
    tessedit_char_whitelist: "0123456789+-*/().xX"
  });
  return cleanExpression(result.data.text);
}
