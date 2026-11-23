"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_ITEM_QUANTITY = 99;

const cartItemSchema = z.object({
  partId: z.string().min(1),
  quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
  expectedPricePln: z.number().positive().optional(),
});

const placeOrderSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Koszyk jest pusty"),
});

export type PlaceOrderState = {
  error?: string;
  orderId?: string;
  updatedPrices?: Record<string, number>;
};

function toPrice(value: { toString(): string } | number): number {
  return typeof value === "number" ? value : Number(value.toString());
}

export async function placeOrderAction(
  rawItems: unknown,
): Promise<PlaceOrderState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Musisz być zalogowany, aby złożyć zamówienie." };
  }

  const parsed = placeOrderSchema.safeParse(rawItems);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane koszyka",
    };
  }

  // Scal duplikaty partId (gdyby client wysłał dwa razy to samo)
  const quantityByPartId = new Map<string, number>();
  const expectedPriceByPartId = new Map<string, number>();
  for (const item of parsed.data.items) {
    const nextQuantity = (quantityByPartId.get(item.partId) ?? 0) + item.quantity;
    if (nextQuantity > MAX_ITEM_QUANTITY) {
      return {
        error: `Maksymalna ilość jednej części w zamówieniu to ${MAX_ITEM_QUANTITY} szt.`,
      };
    }
    quantityByPartId.set(item.partId, nextQuantity);
    if (item.expectedPricePln !== undefined) {
      expectedPriceByPartId.set(item.partId, item.expectedPricePln);
    }
  }

  const partIds = [...quantityByPartId.keys()];
  const parts = await prisma.part.findMany({
    where: { id: { in: partIds }, archivedAt: null },
    select: { id: true, pricePln: true, name: true },
  });

  if (parts.length !== partIds.length) {
    const found = new Set(parts.map((part) => part.id));
    const missing = partIds.filter((id) => !found.has(id));
    return {
      error: `Część jest niedostępna lub została zarchiwizowana (id: ${missing[0]}). Usuń ją z koszyka i spróbuj ponownie.`,
    };
  }

  const updatedPrices: Record<string, number> = {};
  let priceChanged = false;
  for (const part of parts) {
    const unitPrice = toPrice(part.pricePln);
    updatedPrices[part.id] = unitPrice;
    const expected = expectedPriceByPartId.get(part.id);
    if (expected !== undefined && Math.abs(expected - unitPrice) > 0.005) {
      priceChanged = true;
    }
  }

  if (priceChanged) {
    return {
      error:
        "Ceny części w katalogu uległy zmianie. Zaktualizowaliśmy koszyk - sprawdź nową sumę i złóż zamówienie ponownie.",
      updatedPrices,
    };
  }

  const lines = parts.map((part) => {
    const quantity = quantityByPartId.get(part.id)!;
    const unitPrice = toPrice(part.pricePln);
    return {
      partId: part.id,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
    };
  });

  const totalPln =
    Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) /
    100;

  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      type: "CATALOG",
      status: "NEW",
      totalPln,
      items: {
        create: lines.map((line) => ({
          partId: line.partId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        })),
      },
    },
    select: { id: true },
  });

  return { orderId: order.id };
}
