import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  CUSTOM_MODEL_EXTENSIONS,
  CUSTOM_MODEL_MAX_BYTES,
} from "@/lib/custom-model-constants";

export {
  CUSTOM_MODEL_EXTENSIONS,
  CUSTOM_MODEL_MAX_BYTES,
} from "@/lib/custom-model-constants";

export const CUSTOM_MODEL_STORAGE_DIR = path.join(
  process.cwd(),
  "uploads",
  "custom",
);

export const CUSTOM_MODEL_ROUTE_PREFIX = "/api/uploads/custom/";

const SAFE_STORED_FILENAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[\w.-]+\.(stl|obj|3mf)$/i;

const OBJ_DIRECTIVE_RE =
  /^\s*(?:#|v|vn|vt|vp|f|l|p|o|g|s|mtllib|usemtl)\b/m;

export type SavedCustomModel = {
  modelFileName: string;
  modelFilePath: string;
  modelFileSize: number;
};

function extensionOf(filename: string): string {
  return path.extname(filename).toLowerCase();
}

function sanitizeBaseName(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  return (
    base
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "model"
  );
}

export function isSafeStoredFilename(name: string): boolean {
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) {
    return false;
  }
  return SAFE_STORED_FILENAME_RE.test(name);
}

export function validateCustomModelBuffer(
  ext: string,
  buffer: Buffer,
): string | null {
  if (buffer.length === 0) {
    return "Plik modelu jest pusty.";
  }

  const normalizedExt = ext.toLowerCase();

  if (normalizedExt === ".3mf") {
    const isZip =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04;
    return isZip
      ? null
      : "Nieprawidłowy plik 3MF (oczekiwano archiwum ZIP 3MF).";
  }

  if (normalizedExt === ".stl") {
    if (buffer.length >= 84) {
      const triangleCount = buffer.readUInt32LE(80);
      if (84 + triangleCount * 50 === buffer.length) {
        return null;
      }
    }
    const sample = buffer.subarray(0, 4096);
    if (!sample.includes(0)) {
      const text = sample.toString("utf8").trimStart();
      if (/^solid(?:\s|$)/i.test(text)) {
        return null;
      }
    }
    return "Nieprawidłowy plik STL (oczekiwano formatu ASCII lub binarnego STL).";
  }

  if (normalizedExt === ".obj") {
    const sample = buffer.subarray(0, 4096);
    if (sample.includes(0)) {
      return "Nieprawidłowy plik OBJ (wykryto dane binarne).";
    }
    const text = buffer.subarray(0, 65536).toString("utf8");
    if (!OBJ_DIRECTIVE_RE.test(text)) {
      return "Nieprawidłowy plik OBJ (brak prawidłowych dyrektyw geometrii).";
    }
    return null;
  }

  return "Dozwolone formaty modelu: STL, OBJ, 3MF.";
}

export async function saveCustomModelFile(
  file: File | null | undefined,
): Promise<{ saved?: SavedCustomModel; error?: string }> {
  if (!file || file.size === 0 || !file.name) {
    return {};
  }

  const ext = extensionOf(file.name);
  if (!(CUSTOM_MODEL_EXTENSIONS as readonly string[]).includes(ext)) {
    return {
      error: "Dozwolone formaty modelu: STL, OBJ, 3MF.",
    };
  }

  if (file.size > CUSTOM_MODEL_MAX_BYTES) {
    return {
      error: `Plik modelu jest za duży (max ${Math.round(CUSTOM_MODEL_MAX_BYTES / (1024 * 1024))} MB).`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentError = validateCustomModelBuffer(ext, buffer);
  if (contentError) {
    return { error: contentError };
  }

  const safeName = `${randomUUID()}-${sanitizeBaseName(file.name)}${ext}`;
  const relativeUrl = `${CUSTOM_MODEL_ROUTE_PREFIX}${safeName}`;
  const absolutePath = path.join(CUSTOM_MODEL_STORAGE_DIR, safeName);

  try {
    await mkdir(CUSTOM_MODEL_STORAGE_DIR, { recursive: true });
    await writeFile(absolutePath, buffer);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | null)?.code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      return {
        error:
          "Przesyłanie plików 3D nie jest dostępne w trybie serverless (system plików tylko do odczytu). Wyślij wycenę bez pliku lub uruchom aplikację lokalnie.",
      };
    }
    return { error: "Nie udało się zapisać pliku modelu." };
  }

  return {
    saved: {
      modelFileName: file.name,
      modelFilePath: relativeUrl,
      modelFileSize: file.size,
    },
  };
}

export async function removeCustomModelFile(filePath: string): Promise<void> {
  if (!filePath.startsWith(CUSTOM_MODEL_ROUTE_PREFIX)) {
    return;
  }
  const filename = filePath.slice(CUSTOM_MODEL_ROUTE_PREFIX.length);
  if (!isSafeStoredFilename(filename)) {
    return;
  }
  await unlink(path.join(CUSTOM_MODEL_STORAGE_DIR, filename)).catch(
    () => undefined,
  );
}
