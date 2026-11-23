import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminActionForm } from "@/components/admin-action-form";
import { AdminPartForm } from "@/components/admin-part-form";
import {
  archivePartAction,
  deletePartAction,
  restorePartAction,
  updatePartAction,
} from "@/lib/admin-actions";
import { getGenerationOptions } from "@/lib/admin-catalog";
import { prisma } from "@/lib/prisma";

type EditPartPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditPartPage({ params }: EditPartPageProps) {
  const { id } = await params;
  const [part, generations, orderItemCount] = await Promise.all([
    prisma.part.findUnique({
      where: { id },
      include: {
        generation: {
          include: {
            model: { include: { brand: true } },
          },
        },
      },
    }),
    getGenerationOptions(),
    prisma.orderItem.count({ where: { partId: id } }),
  ]);

  if (!part) {
    notFound();
  }

  const archived = Boolean(part.archivedAt);
  const canHardDelete = orderItemCount === 0;

  return (
    <section>
      <h1>Edycja części</h1>
      <p className="lead">
        {part.generation.model.brand.name} {part.generation.model.name} /{" "}
        {part.generation.name}
        {archived ? " · zarchiwizowana (ukryta w konfiguratorze)" : ""}
      </p>

      <div className="panel">
        <AdminPartForm
          mode="edit"
          action={updatePartAction}
          generations={generations}
          initial={{
            id: part.id,
            name: part.name,
            slug: part.slug,
            description: part.description ?? "",
            pricePln: part.pricePln.toString(),
            generationId: part.generationId,
            imageUrl: part.imageUrl ?? "",
            modelUrl: part.modelUrl ?? "",
          }}
        />
      </div>

      <div className="panel" style={{ marginTop: "1rem" }}>
        <h2>Usuwanie / archiwizacja</h2>
        {canHardDelete ? (
          <>
            <p className="muted" style={{ marginBottom: "0.75rem" }}>
              Część nie występuje w żadnym zamówieniu - możesz usunąć na stałe
              albo tylko zarchiwizować.
            </p>
            <div className="actions">
              <AdminActionForm
                id={part.id}
                action={deletePartAction}
                label="Usuń na stałe"
                className="btn btn-danger"
                confirmMessage={`Na pewno trwale usunąć „${part.name}”? Tej operacji nie cofniesz.`}
              />
              {!archived && (
                <AdminActionForm
                  id={part.id}
                  action={archivePartAction}
                  label="Archiwizuj"
                  className="btn btn-secondary"
                />
              )}
              {archived && (
                <AdminActionForm
                  id={part.id}
                  action={restorePartAction}
                  label="Przywróć"
                  className="btn"
                />
              )}
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: "0.75rem" }}>
              Część jest użyta w {orderItemCount} pozycji zamówień - twarde
              usunięcie jest zablokowane. Możesz archiwizować (ukrycie w
              konfiguratorze).
            </p>
            {archived ? (
              <AdminActionForm
                id={part.id}
                action={restorePartAction}
                label="Przywróć część"
                className="btn"
              />
            ) : (
              <AdminActionForm
                id={part.id}
                action={archivePartAction}
                label="Archiwizuj część"
                className="btn btn-secondary"
              />
            )}
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              <button type="button" className="btn btn-danger" disabled>
                Usuń na stałe
              </button>{" "}
              - niedostępne (historia zamówień)
            </p>
          </>
        )}
      </div>

      <p style={{ marginTop: "1rem" }}>
        <Link href="/admin/czesci">← Wróć do listy</Link>
      </p>
    </section>
  );
}
