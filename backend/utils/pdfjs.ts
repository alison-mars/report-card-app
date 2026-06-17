import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createRequire } from "module";
import path from "path";
import { pathToFileURL } from "url";

const require = createRequire(import.meta.url);
const pdfjsDistRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));

const standardFontDataUrl = `${pathToFileURL(path.join(pdfjsDistRoot, "standard_fonts")).href}/`;
const cMapUrl = `${pathToFileURL(path.join(pdfjsDistRoot, "cmaps")).href}/`;

export function loadPdfDocument(data: Uint8Array) {
  return getDocument({
    data,
    standardFontDataUrl,
    cMapUrl,
    cMapPacked: true,
    disableFontFace: false,
    isEvalSupported: false,
  });
}
