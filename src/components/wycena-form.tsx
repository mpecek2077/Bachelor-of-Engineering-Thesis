"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatPricePln } from "@/lib/catalog-types";
import { submitCustomQuoteAction } from "@/lib/custom-order-actions";
import {
  CUSTOM_MODEL_EXTENSIONS,
  CUSTOM_MODEL_MAX_BYTES,
} from "@/lib/custom-model-constants";
import {
  calculateCustomQuote,
  COMPLEXITY_CLIENT_OPTIONS,
  COMPLEXITY_LABELS,
  FINISH_LABELS,
  FINISH_OPTIONS,
  INFILL_LABELS,
  INFILL_OPTIONS,
  MATERIAL_LABELS,
  MATERIAL_OPTIONS,
  QUALITY_LABELS,
  QUALITY_OPTIONS,
  type Complexity,
  type Finish,
  type Infill,
  type Material,
  type Quality,
} from "@/lib/pricing";

export type WycenaBrandOption = {
  id: string;
  name: string;
  models: { id: string; name: string }[];
};

type WycenaFormProps = {
  brands: WycenaBrandOption[];
  isLoggedIn: boolean;
};

type WycenaDraft = {
  brandId?: string;
  modelId?: string;
  description: string;
  complexity: Complexity;
  material: Material;
  volumeCm3: number;
  infill: Infill;
  quality: Quality;
  finish: Finish;
};

const ACCEPT_MODEL = CUSTOM_MODEL_EXTENSIONS.join(",");
const MAX_MODEL_MB = Math.round(CUSTOM_MODEL_MAX_BYTES / (1024 * 1024));
const WYCENA_DRAFT_KEY = "flydes-wycena-draft-v1";

const DEFAULT_DRAFT: WycenaDraft = {
  description: "",
  complexity: 2,
  material: "PLA",
  volumeCm3: 120,
  infill: 20,
  quality: "standard",
  finish: "raw",
};

const draftListeners = new Set<() => void>();
let cachedDraftRaw: string | null | undefined = undefined;
let cachedDraft: WycenaDraft = DEFAULT_DRAFT;
let sessionStorageUnavailable = false;

function isOneOf<T>(options: readonly T[], value: unknown): value is T {
  return options.includes(value as T);
}

function parseDraft(raw: string | null): WycenaDraft {
  if (!raw) {
    return DEFAULT_DRAFT;
  }
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return DEFAULT_DRAFT;
    }
    const rawVolume = Number(data.volumeCm3);
    const volumeCm3 =
      Number.isFinite(rawVolume) && rawVolume >= 1 && rawVolume <= 5000
        ? Math.round(rawVolume)
        : DEFAULT_DRAFT.volumeCm3;

    return {
      brandId: typeof data.brandId === "string" ? data.brandId : undefined,
      modelId: typeof data.modelId === "string" ? data.modelId : undefined,
      description:
        typeof data.description === "string"
          ? data.description
          : DEFAULT_DRAFT.description,
      complexity: isOneOf(COMPLEXITY_CLIENT_OPTIONS, data.complexity)
        ? data.complexity
        : DEFAULT_DRAFT.complexity,
      material: isOneOf(MATERIAL_OPTIONS, data.material)
        ? data.material
        : DEFAULT_DRAFT.material,
      volumeCm3,
      infill: isOneOf(INFILL_OPTIONS, data.infill)
        ? data.infill
        : DEFAULT_DRAFT.infill,
      quality: isOneOf(QUALITY_OPTIONS, data.quality)
        ? data.quality
        : DEFAULT_DRAFT.quality,
      finish: isOneOf(FINISH_OPTIONS, data.finish)
        ? data.finish
        : DEFAULT_DRAFT.finish,
    };
  } catch {
    return DEFAULT_DRAFT;
  }
}

function getDraftSnapshot(): WycenaDraft {
  if (typeof window === "undefined") {
    return DEFAULT_DRAFT;
  }
  if (sessionStorageUnavailable) {
    return cachedDraft;
  }
  try {
    const raw = window.sessionStorage.getItem(WYCENA_DRAFT_KEY);
    if (raw === cachedDraftRaw) {
      return cachedDraft;
    }
    cachedDraftRaw = raw;
    cachedDraft = parseDraft(raw);
    return cachedDraft;
  } catch {
    sessionStorageUnavailable = true;
    return cachedDraft;
  }
}

function getServerDraftSnapshot(): WycenaDraft {
  return DEFAULT_DRAFT;
}

function emitDraftChange() {
  for (const listener of draftListeners) {
    listener();
  }
}

function subscribeDraft(listener: () => void): () => void {
  draftListeners.add(listener);
  return () => {
    draftListeners.delete(listener);
  };
}

function patchDraft(patch: Partial<WycenaDraft>) {
  const next: WycenaDraft = { ...getDraftSnapshot(), ...patch };
  cachedDraft = next;
  if (typeof window !== "undefined") {
    try {
      const serialized = JSON.stringify(next);
      window.sessionStorage.setItem(WYCENA_DRAFT_KEY, serialized);
      cachedDraftRaw = serialized;
      sessionStorageUnavailable = false;
    } catch {
      sessionStorageUnavailable = true;
    }
  }
  emitDraftChange();
}

function clearDraft() {
  cachedDraft = DEFAULT_DRAFT;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(WYCENA_DRAFT_KEY);
      cachedDraftRaw = null;
      sessionStorageUnavailable = false;
    } catch {
      sessionStorageUnavailable = true;
    }
  }
  emitDraftChange();
}

export function WycenaForm({ brands, isLoggedIn }: WycenaFormProps) {
  const router = useRouter();
  const draft = useSyncExternalStore(
    subscribeDraft,
    getDraftSnapshot,
    getServerDraftSnapshot,
  );
  const [modelFileName, setModelFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const brandId = useMemo(() => {
    if (draft.brandId && brands.some((b) => b.id === draft.brandId)) {
      return draft.brandId;
    }
    return brands[0]?.id ?? "";
  }, [brands, draft.brandId]);

  const models = useMemo(
    () => brands.find((brand) => brand.id === brandId)?.models ?? [],
    [brands, brandId],
  );

  const modelId = useMemo(() => {
    if (draft.modelId && models.some((m) => m.id === draft.modelId)) {
      return draft.modelId;
    }
    return models[0]?.id ?? "";
  }, [models, draft.modelId]);

  const quote = useMemo(
    () =>
      calculateCustomQuote({
        material: draft.material,
        volumeCm3: draft.volumeCm3,
        infill: draft.infill,
        quality: draft.quality,
        finish: draft.finish,
      }),
    [
      draft.material,
      draft.volumeCm3,
      draft.infill,
      draft.quality,
      draft.finish,
    ],
  );

  function onBrandChange(nextBrandId: string) {
    const nextModels =
      brands.find((brand) => brand.id === nextBrandId)?.models ?? [];
    patchDraft({
      brandId: nextBrandId,
      modelId: nextModels[0]?.id ?? "",
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isLoggedIn) {
      router.push("/login?callbackUrl=/wycena");
      return;
    }

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("modelFile");
    if (fileInput instanceof HTMLInputElement && fileInput.files?.[0]) {
      const file = fileInput.files[0];
      if (file.size > CUSTOM_MODEL_MAX_BYTES) {
        setError(`Plik modelu jest za duży (max ${MAX_MODEL_MB} MB).`);
        return;
      }
    }

    const formData = new FormData(form);
    startTransition(async () => {
      const result = await submitCustomQuoteAction(formData);
      if (result.error || !result.orderId) {
        setError(result.error ?? "Nie udało się wysłać wyceny.");
        return;
      }
      clearDraft();
      router.push(`/zamowienie/${result.orderId}`);
      router.refresh();
    });
  }

  if (brands.length === 0) {
    return (
      <div className="panel">
        <p className="muted">Brak marek w bazie - uruchom seed.</p>
      </div>
    );
  }

  return (
    <form
      className="panel wycena-form"
      onSubmit={handleSubmit}
      encType="multipart/form-data"
    >
      <div className="wycena-grid">
        <label>
          Marka pojazdu
          <select
            name="brandId"
            value={brandId}
            onChange={(event) => onBrandChange(event.target.value)}
            required
          >
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Model
          <select
            name="modelId"
            value={modelId}
            onChange={(event) => patchDraft({ modelId: event.target.value })}
            required
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </label>

        <label className="wycena-full">
          Opis części
          <textarea
            name="description"
            required
            minLength={10}
            rows={3}
            value={draft.description}
            onChange={(event) => patchDraft({ description: event.target.value })}
            placeholder="Np. lotka dachowa z kanałami pod światła..."
          />
        </label>

        <label className="wycena-full">
          Plik modelu (opcjonalnie)
          <input
            name="modelFile"
            type="file"
            accept={ACCEPT_MODEL}
            onChange={(event) =>
              setModelFileName(event.target.files?.[0]?.name ?? null)
            }
          />
          <span className="field-hint">
            STL, OBJ lub 3MF, max {MAX_MODEL_MB} MB
            {modelFileName ? `. Wybrano: ${modelFileName}` : ""}.
          </span>
        </label>

        <label>
          Trudność geometrii
          <select
            name="complexity"
            value={draft.complexity}
            onChange={(event) =>
              patchDraft({
                complexity: Number(event.target.value) as Complexity,
              })
            }
          >
            {COMPLEXITY_CLIENT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {COMPLEXITY_LABELS[value]}
              </option>
            ))}
          </select>
          <span className="field-hint">
            Informacja dla warsztatu - nie zmienia szacunkowej ceny.
          </span>
        </label>

        <label>
          Materiał
          <select
            name="material"
            value={draft.material}
            onChange={(event) =>
              patchDraft({ material: event.target.value as Material })
            }
          >
            {MATERIAL_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {MATERIAL_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Przybliżona objętość (cm³)
          <input
            name="volumeCm3"
            type="number"
            min={1}
            max={5000}
            step={1}
            value={draft.volumeCm3}
            onChange={(event) =>
              patchDraft({
                volumeCm3: Math.min(
                  5000,
                  Math.max(1, Number(event.target.value) || 1),
                ),
              })
            }
            required
          />
          <span className="field-hint">
            Jeśli nie wiesz, zostaw domyślną lub opisz w polu części.
          </span>
        </label>

        <label>
          Wypełnienie
          <select
            name="infill"
            value={draft.infill}
            onChange={(event) =>
              patchDraft({ infill: Number(event.target.value) as Infill })
            }
          >
            {INFILL_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {INFILL_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Jakość powierzchni
          <select
            name="quality"
            value={draft.quality}
            onChange={(event) =>
              patchDraft({ quality: event.target.value as Quality })
            }
          >
            {QUALITY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {QUALITY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Wykończenie
          <select
            name="finish"
            value={draft.finish}
            onChange={(event) =>
              patchDraft({ finish: event.target.value as Finish })
            }
          >
            {FINISH_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {FINISH_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="wycena-result">
        <div className="wycena-result-price">
          <p className="muted">Szacunkowa cena</p>
          <p className="part-price wycena-price">
            {formatPricePln(quote.estimatedPrice)}
          </p>
          <p className="field-hint">
            Orientacyjnie - po wysłaniu doprecyzujemy szczegóły.
          </p>
        </div>
        <div className="wycena-result-cta actions">
          {isLoggedIn ? (
            <button type="submit" className="btn" disabled={pending}>
              {pending ? "Wysyłanie…" : "Wyślij do wyceny"}
            </button>
          ) : (
            <Link href="/login?callbackUrl=/wycena" className="btn">
              Zaloguj i wyślij
            </Link>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
    </form>
  );
}
