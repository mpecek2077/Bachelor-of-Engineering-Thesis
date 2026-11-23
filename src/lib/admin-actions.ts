"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSafeAssetUrl, slugify } from "@/lib/validation";

export type AdminActionState = {
  error?: string;
  success?: string;
};

async function assertAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

const assetUrlSchema = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .refine(
      isSafeAssetUrl,
      `${label}: ścieżka lokalna (/… bez //) lub http(s)`,
    );

const partSchema = z.object({
  name: z.string().trim().min(2, "Podaj nazwę (min. 2 znaki)"),
  description: z.string().trim().optional(),
  pricePln: z.coerce.number().positive("Cena musi być większa od 0"),
  generationId: z.string().min(1, "Wybierz generację"),
  slug: z.string().trim().optional(),
  imageUrl: assetUrlSchema("URL zdjęcia"),
  modelUrl: assetUrlSchema("URL modelu 3D"),
});

export async function createPartAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  if (!(await assertAdmin())) {
    return { error: "Brak uprawnień administratora." };
  }

  const parsed = partSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    pricePln: formData.get("pricePln"),
    generationId: formData.get("generationId"),
    slug: formData.get("slug") || undefined,
    imageUrl: String(formData.get("imageUrl") ?? "").trim() || undefined,
    modelUrl: String(formData.get("modelUrl") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Błędne dane" };
  }

  const generation = await prisma.generation.findUnique({
    where: { id: parsed.data.generationId },
  });
  if (!generation) {
    return { error: "Wybrana generacja nie istnieje." };
  }

  const slug = slugify(parsed.data.slug || parsed.data.name);
  if (!slug) {
    return { error: "Nie udało się utworzyć sluga z nazwy." };
  }

  const existing = await prisma.part.findUnique({
    where: {
      generationId_slug: {
        generationId: parsed.data.generationId,
        slug,
      },
    },
  });
  if (existing) {
    return { error: "Część o tym slugu już istnieje w tej generacji." };
  }

  const part = await prisma.part.create({
    data: {
      name: parsed.data.name,
      slug,
      description: parsed.data.description || null,
      pricePln: parsed.data.pricePln,
      imageUrl: parsed.data.imageUrl || null,
      modelUrl: parsed.data.modelUrl || null,
      generationId: parsed.data.generationId,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/czesci");
  revalidatePath("/konfigurator");
  redirect(`/admin/czesci/${part.id}`);
}

export async function updatePartAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  if (!(await assertAdmin())) {
    return { error: "Brak uprawnień administratora." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Brak ID części." };
  }

  const parsed = partSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    pricePln: formData.get("pricePln"),
    generationId: formData.get("generationId"),
    slug: formData.get("slug") || undefined,
    imageUrl: String(formData.get("imageUrl") ?? "").trim() || undefined,
    modelUrl: String(formData.get("modelUrl") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Błędne dane" };
  }

  const current = await prisma.part.findUnique({ where: { id } });
  if (!current) {
    return { error: "Część nie istnieje." };
  }

  const generation = await prisma.generation.findUnique({
    where: { id: parsed.data.generationId },
  });
  if (!generation) {
    return { error: "Wybrana generacja nie istnieje." };
  }

  const slug = slugify(parsed.data.slug || parsed.data.name);
  if (!slug) {
    return { error: "Nie udało się utworzyć sluga z nazwy." };
  }

  const conflict = await prisma.part.findFirst({
    where: {
      generationId: parsed.data.generationId,
      slug,
      NOT: { id },
    },
  });
  if (conflict) {
    return { error: "Część o tym slugu już istnieje w tej generacji." };
  }

  await prisma.part.update({
    where: { id },
    data: {
      name: parsed.data.name,
      slug,
      description: parsed.data.description || null,
      pricePln: parsed.data.pricePln,
      imageUrl: parsed.data.imageUrl || null,
      modelUrl: parsed.data.modelUrl || null,
      generationId: parsed.data.generationId,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/czesci");
  revalidatePath(`/admin/czesci/${id}`);
  revalidatePath("/konfigurator");
  return { success: "Zapisano zmiany." };
}

export async function archivePartAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  if (!(await assertAdmin())) {
    return { error: "Brak uprawnień administratora." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Brak ID części." };
  }

  try {
    await prisma.part.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { error: "Część nie istnieje." };
    }
    return { error: "Nie udało się zarchiwizować części." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/czesci");
  revalidatePath(`/admin/czesci/${id}`);
  revalidatePath("/konfigurator");
  return { success: "Część została zarchiwizowana." };
}

export async function restorePartAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  if (!(await assertAdmin())) {
    return { error: "Brak uprawnień administratora." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Brak ID części." };
  }

  try {
    await prisma.part.update({
      where: { id },
      data: { archivedAt: null },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { error: "Część nie istnieje." };
    }
    return { error: "Nie udało się przywrócić części." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/czesci");
  revalidatePath(`/admin/czesci/${id}`);
  revalidatePath("/konfigurator");
  return { success: "Część została przywrócona." };
}

/** Twarde usunięcie tylko gdy część nie występuje w żadnym OrderItem. */
export async function deletePartAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  if (!(await assertAdmin())) {
    return { error: "Brak uprawnień administratora." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Brak ID części." };
  }

  const usedCount = await prisma.orderItem.count({ where: { partId: id } });
  if (usedCount > 0) {
    return {
      error: "Część jest użyta w zamówieniach - możesz ją tylko zarchiwizować.",
    };
  }

  try {
    await prisma.part.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Część nie istnieje." };
      }
      if (error.code === "P2003") {
        return {
          error:
            "Część jest użyta w zamówieniach - możesz ją tylko zarchiwizować.",
        };
      }
    }
    return { error: "Nie udało się usunąć części." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/czesci");
  revalidatePath("/konfigurator");
  redirect("/admin/czesci");
}

const statusSchema = z.enum([
  "NEW",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
] as const);

export async function updateOrderStatusAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  if (!(await assertAdmin())) {
    return { error: "Brak uprawnień administratora." };
  }

  const id = String(formData.get("id") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  const parsed = statusSchema.safeParse(statusRaw);

  if (!id || !parsed.success) {
    return { error: "Nieprawidłowy status lub ID zamówienia." };
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return { error: "Zamówienie nie istnieje." };
  }

  try {
    await prisma.order.update({
      where: { id },
      data: { status: parsed.data },
    });
  } catch {
    return { error: "Nie udało się zaktualizować statusu." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/zamowienia");
  revalidatePath(`/zamowienie/${id}`);
  revalidatePath("/zamowienia");
  return { success: "Status zapisany." };
}
