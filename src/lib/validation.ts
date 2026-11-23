/**
 * Pomocnicze funkcje walidacji i normalizacji współdzielone między serwerem, UI i testami.
 */

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Akceptuje pustą wartość, ścieżkę lokalną zaczynającą się od pojedynczego `/`
 * (bez protocol-relative `//...`) albo adres `http://` / `https://`.
 */
export function isSafeAssetUrl(value: string | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) {
    return true;
  }
  if (trimmed.startsWith("/")) {
    return !trimmed.startsWith("//");
  }
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}
