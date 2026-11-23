import assert from "node:assert/strict";
import test from "node:test";
import {
  isSafeStoredFilename,
  validateCustomModelBuffer,
} from "@/lib/custom-model-upload";

test("isSafeStoredFilename accepts UUID-prefixed safe names and rejects traversal", () => {
  const valid = "123e4567-e89b-12d3-a456-426614174000-spoiler-v1.stl";
  assert.equal(isSafeStoredFilename(valid), true);
  assert.equal(isSafeStoredFilename("123e4567-e89b-12d3-a456-426614174000-model.3mf"), true);

  assert.equal(isSafeStoredFilename("../secret.stl"), false);
  assert.equal(isSafeStoredFilename("dir/123e4567-e89b-12d3-a456-426614174000-a.stl"), false);
  assert.equal(isSafeStoredFilename("not-a-uuid-model.stl"), false);
  assert.equal(isSafeStoredFilename("123e4567-e89b-12d3-a456-426614174000-a.exe"), false);
});

test("validateCustomModelBuffer accepts valid ASCII and binary STL and rejects invalid", () => {
  const asciiStl = Buffer.from(
    "solid spoiler\n  facet normal 0 0 1\n    outer loop\n      vertex 0 0 0\n    endloop\n  endfacet\nendsolid spoiler\n",
    "utf8",
  );
  assert.equal(validateCustomModelBuffer(".stl", asciiStl), null);

  const binaryStl = Buffer.alloc(84 + 2 * 50);
  binaryStl.write("binary stl header", 0, "ascii");
  binaryStl.writeUInt32LE(2, 80);
  assert.equal(validateCustomModelBuffer(".stl", binaryStl), null);

  const spoofedStl = Buffer.from("<html><script>alert(1)</script></html>", "utf8");
  assert.notEqual(validateCustomModelBuffer(".stl", spoofedStl), null);
  assert.notEqual(validateCustomModelBuffer(".stl", Buffer.alloc(0)), null);
});

test("validateCustomModelBuffer validates OBJ and 3MF signatures", () => {
  const validObj = Buffer.from("# Wavefront OBJ\nv 0.0 0.0 0.0\nf 1 2 3\n", "utf8");
  assert.equal(validateCustomModelBuffer(".obj", validObj), null);

  const binaryFakeObj = Buffer.from([0x00, 0x01, 0x76, 0x20, 0x30]);
  assert.notEqual(validateCustomModelBuffer(".obj", binaryFakeObj), null);
  assert.notEqual(
    validateCustomModelBuffer(".obj", Buffer.from("hello world", "utf8")),
    null,
  );

  const valid3mf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
  assert.equal(validateCustomModelBuffer(".3mf", valid3mf), null);

  const invalid3mf = Buffer.from("not a zip archive", "utf8");
  assert.notEqual(validateCustomModelBuffer(".3mf", invalid3mf), null);
});
