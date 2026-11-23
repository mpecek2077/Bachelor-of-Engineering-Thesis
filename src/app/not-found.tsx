import Link from "next/link";

export default function NotFoundPage() {
  return (
    <section>
      <div className="panel">
        <h1>404 - Nie znaleziono strony</h1>
        <p className="lead" style={{ marginTop: "0.5rem" }}>
          Szukany zasób nie istnieje lub został przeniesiony.
        </p>
        <div className="actions">
          <Link href="/" className="btn">
            Strona główna
          </Link>
          <Link href="/konfigurator" className="btn btn-secondary">
            Konfigurator
          </Link>
        </div>
      </div>
    </section>
  );
}
