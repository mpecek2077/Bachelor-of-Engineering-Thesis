"use client";

import Link from "next/link";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <section>
      <div className="panel">
        <h1>Wystąpił błąd</h1>
        <p className="lead" style={{ marginTop: "0.5rem" }}>
          Nie udało się przetworzyć żądania. Spróbuj odświeżyć widok lub wróć na
          stronę główną.
        </p>
        {error.digest ? (
          <p className="muted order-id-secondary" style={{ marginBottom: "1rem" }}>
            Kod błędu: <code>{error.digest}</code>
          </p>
        ) : null}
        <div className="actions">
          <button type="button" className="btn" onClick={() => reset()}>
            Spróbuj ponownie
          </button>
          <Link href="/" className="btn btn-secondary">
            Strona główna
          </Link>
        </div>
      </div>
    </section>
  );
}
