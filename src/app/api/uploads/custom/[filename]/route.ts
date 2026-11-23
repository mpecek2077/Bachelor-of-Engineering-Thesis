import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  CUSTOM_MODEL_ROUTE_PREFIX,
  CUSTOM_MODEL_STORAGE_DIR,
  isSafeStoredFilename,
} from "@/lib/custom-model-upload";
import { parseCustomPayload } from "@/lib/custom-payload";
import { prisma } from "@/lib/prisma";

const LEGACY_CUSTOM_MODEL_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "custom",
);

async function readFromDir(
  dir: string,
  filename: string,
): Promise<Buffer | null> {
  const resolvedDir = path.resolve(dir);
  const resolvedFile = path.resolve(resolvedDir, filename);
  if (!resolvedFile.startsWith(`${resolvedDir}${path.sep}`)) {
    return null;
  }
  try {
    return await readFile(resolvedFile);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | null)?.code;
    if (code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

function sanitizeDownloadFilename(name: string): string {
  const base = path.basename(name).replace(/[\r\n"\\]/g, "_");
  return base || "model";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Wymagane logowanie." }, { status: 401 });
  }

  const { filename } = await context.params;
  if (!isSafeStoredFilename(filename)) {
    return NextResponse.json(
      { error: "Nieprawidłowa nazwa pliku." },
      { status: 400 },
    );
  }

  const apiPath = `${CUSTOM_MODEL_ROUTE_PREFIX}${filename}`;
  const legacyPath = `/uploads/custom/${filename}`;
  const isAdmin = session.user.role === "ADMIN";

  const order = await prisma.order.findFirst({
    where: {
      type: "CUSTOM",
      ...(isAdmin ? {} : { userId: session.user.id }),
      OR: [
        { customPayload: { path: ["modelFilePath"], equals: apiPath } },
        { customPayload: { path: ["modelFilePath"], equals: legacyPath } },
      ],
    },
    select: { id: true, customPayload: true },
  });

  if (!isAdmin && !order) {
    return NextResponse.json({ error: "Nie znaleziono pliku." }, { status: 404 });
  }

  const fileBuffer =
    (await readFromDir(CUSTOM_MODEL_STORAGE_DIR, filename)) ??
    (await readFromDir(LEGACY_CUSTOM_MODEL_DIR, filename));

  if (!fileBuffer) {
    return NextResponse.json({ error: "Nie znaleziono pliku." }, { status: 404 });
  }

  const payload = parseCustomPayload(order?.customPayload);
  const originalName = sanitizeDownloadFilename(
    payload.modelFileName ?? filename,
  );
  const asciiFallback = originalName.replace(/[^\x20-\x7e]/g, "_");

  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(originalName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
