import assert from "node:assert/strict";
import test from "node:test";
import { brandAccentColor, brandInitials } from "@/lib/brand-initials";
import { formatGenerationYears } from "@/lib/catalog-types";
import { parseCustomPayload } from "@/lib/custom-payload";
import { formatOrderListTitle } from "@/lib/order-labels";
import { safeCallbackUrl } from "@/lib/safe-callback";
import { isSafeAssetUrl, slugify } from "@/lib/validation";

test("safeCallbackUrl allows only relative app paths", () => {
  assert.equal(safeCallbackUrl("/koszyk"), "/koszyk");
  assert.equal(safeCallbackUrl("/admin?tab=active"), "/admin?tab=active");
  assert.equal(safeCallbackUrl("//evil.example/phish", "/"), "/");
  assert.equal(safeCallbackUrl("https://evil.example", "/login"), "/login");
  assert.equal(safeCallbackUrl("javascript:alert(1)", "/"), "/");
  assert.equal(safeCallbackUrl("", "/"), "/");
  assert.equal(safeCallbackUrl(null, "/"), "/");
});

test("isSafeAssetUrl accepts local single-slash and http(s) URLs, rejects protocol-relative and schemes", () => {
  assert.equal(isSafeAssetUrl(undefined), true);
  assert.equal(isSafeAssetUrl(""), true);
  assert.equal(isSafeAssetUrl("/parts/lotka.svg"), true);
  assert.equal(isSafeAssetUrl("https://cdn.example.com/a.glb"), true);
  assert.equal(isSafeAssetUrl("http://localhost:3000/a.png"), true);
  assert.equal(isSafeAssetUrl("//evil.example/x.png"), false);
  assert.equal(isSafeAssetUrl(" //evil.example/x.png"), false);
  assert.equal(isSafeAssetUrl("javascript:alert(1)"), false);
  assert.equal(isSafeAssetUrl("data:text/html,hi"), false);
  assert.equal(isSafeAssetUrl("parts/lotka.svg"), false);
});

test("slugify normalizes Polish characters and limits length", () => {
  assert.equal(slugify("Lotka dachowa Żółć Łąka"), "lotka-dachowa-zolc-laka");
  assert.equal(slugify("  ---BMW M3 / G80!--- "), "bmw-m3-g80");
  assert.equal(slugify("a".repeat(120)).length, 80);
});

test("brandInitials and brandAccentColor handle known and fallback brands", () => {
  assert.equal(brandInitials("BMW", "bmw"), "BMW");
  assert.equal(brandInitials("Mercedes", "mercedes"), "MB");
  assert.equal(brandInitials("Alfa Romeo"), "AR");
  assert.equal(brandInitials("Porsche"), "PO");
  assert.match(brandAccentColor("bmw"), /^#[0-9a-f]{6}$/i);
  assert.match(brandAccentColor("porsche", "Porsche"), /^#[0-9a-f]{6}$/i);
});

test("formatGenerationYears formats ranges cleanly", () => {
  assert.equal(formatGenerationYears(2014, 2020), "2014-2020");
  assert.equal(formatGenerationYears(2020, null), "od 2020");
  assert.equal(formatGenerationYears(null, 2019), "do 2019");
  assert.equal(formatGenerationYears(null, null), null);
});

test("formatOrderListTitle formats catalog and custom orders", () => {
  assert.deepEqual(
    formatOrderListTitle({
      type: "CATALOG",
      items: [{ part: { name: "Lotka G80" } }],
    }),
    { title: "Lotka G80" },
  );

  assert.deepEqual(
    formatOrderListTitle({
      type: "CATALOG",
      items: [
        { part: { name: "Lotka G80" } },
        { part: { name: "Spoiler G80" } },
        { part: { name: "Dyfuzor" } },
      ],
    }),
    { title: "Lotka G80 i 2 więcej" },
  );

  assert.deepEqual(
    formatOrderListTitle({
      type: "CUSTOM",
      customPayload: {
        brandName: "BMW",
        modelName: "M3",
        description: "Lotka carbon look",
      },
    }),
    {
      title: "Wycena niestandardowa",
      detail: "BMW · M3 · Lotka carbon look",
    },
  );
});

test("parseCustomPayload parses valid objects and guards against invalid JSON shapes", () => {
  assert.deepEqual(parseCustomPayload(null), {});
  assert.deepEqual(parseCustomPayload(["not", "an", "object"]), {});
  assert.deepEqual(parseCustomPayload("string"), {});

  const parsed = parseCustomPayload({
    brandName: "Audi",
    modelName: "A4",
    volumeCm3: 240,
    extraField: "kept",
  });
  assert.equal(parsed.brandName, "Audi");
  assert.equal(parsed.modelName, "A4");
  assert.equal(parsed.volumeCm3, 240);
  assert.equal(parsed.extraField, "kept");
});
