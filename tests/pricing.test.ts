import assert from "node:assert/strict";
import test from "node:test";
import { calculateCustomQuote } from "@/lib/pricing";

test("calculateCustomQuote computes baseline PLA standard raw quote", () => {
  const result = calculateCustomQuote({
    material: "PLA",
    volumeCm3: 100,
    infill: 20,
    quality: "standard",
    finish: "raw",
  });

  assert.equal(result.breakdown.basePln, 80);
  assert.equal(result.breakdown.volumeCost, 45);
  assert.equal(result.estimatedPrice, 125);
});

test("calculateCustomQuote applies material, infill, quality, finish multipliers and rounds", () => {
  const result = calculateCustomQuote({
    material: "ABS",
    volumeCm3: 250,
    infill: 50,
    quality: "fine",
    finish: "painted",
  });

  // 250 * 0.45 * 1.3 * 1.4 * 1.35 * 1.55 = 428.439375 -> 428.44
  assert.equal(result.breakdown.volumeCost, 428.44);
  assert.equal(result.estimatedPrice, 508.44);
  assert.equal(result.breakdown.materialMult, 1.3);
  assert.equal(result.breakdown.infillMult, 1.4);
  assert.equal(result.breakdown.qualityMult, 1.35);
  assert.equal(result.breakdown.finishMult, 1.55);
});

test("calculateCustomQuote clamps volumeCm3 to [1, 5000]", () => {
  const minQuote = calculateCustomQuote({
    material: "PLA",
    volumeCm3: -50,
    infill: 20,
    quality: "standard",
    finish: "raw",
  });
  assert.equal(minQuote.estimatedPrice, 80.45);

  const maxQuote = calculateCustomQuote({
    material: "PLA",
    volumeCm3: 99999,
    infill: 20,
    quality: "standard",
    finish: "raw",
  });
  assert.equal(maxQuote.estimatedPrice, 80 + 5000 * 0.45);
});
