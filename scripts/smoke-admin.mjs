import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

let createdPartId = null;
let touchedOrderId = null;
let originalOrderStatus = null;

try {
  const generation = await prisma.generation.findFirst({
    include: { model: { include: { brand: true } } },
  });

  if (!generation) {
    console.error("Brak generacji - uruchom seed.");
    process.exitCode = 1;
  } else {
    const slug = `smoke-part-${Date.now()}`;
    const part = await prisma.part.create({
      data: {
        name: "Smoke Lotka Admin",
        slug,
        description: "Część testowa Etapu 3",
        pricePln: 123.45,
        generationId: generation.id,
      },
    });
    createdPartId = part.id;

    await prisma.part.update({
      where: { id: part.id },
      data: { archivedAt: new Date() },
    });

    const activeCount = await prisma.part.count({ where: { archivedAt: null } });
    const archived = await prisma.part.findUnique({ where: { id: part.id } });

    const order = await prisma.order.findFirst();
    if (order) {
      touchedOrderId = order.id;
      originalOrderStatus = order.status;
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "IN_PROGRESS" },
      });
    }

    console.log(
      JSON.stringify(
        {
          generation: `${generation.model.brand.name} ${generation.model.name}/${generation.name}`,
          partId: part.id,
          archivedAt: Boolean(archived?.archivedAt),
          activeParts: activeCount,
          orderStatusTouched: Boolean(order),
        },
        null,
        2,
      ),
    );
  }
} finally {
  if (touchedOrderId && originalOrderStatus) {
    await prisma.order
      .update({
        where: { id: touchedOrderId },
        data: { status: originalOrderStatus },
      })
      .catch(() => undefined);
  }
  if (createdPartId) {
    await prisma.part
      .delete({ where: { id: createdPartId } })
      .catch(() => undefined);
  }
  await prisma.$disconnect();
}
