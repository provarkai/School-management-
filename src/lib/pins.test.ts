import test from "node:test";
import assert from "node:assert/strict";
import { generatePins } from "./pins.ts";

test("every card in a batch gets a distinct serial and PIN", () => {
  const batch = generatePins(500);
  assert.equal(new Set(batch.map((p) => p.serial)).size, 500);
  assert.equal(new Set(batch.map((p) => p.pin)).size, 500);
});

test("serials avoid the glyphs a parent misreads off a printed card", () => {
  // 0/O and 1/I are excluded on purpose: a wrong guess here is a support
  // call, and the serial is half the access control on /check-result.
  for (const { serial } of generatePins(200)) {
    assert.match(serial, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    assert.ok(!/[01OI]/.test(serial), `serial ${serial} contains an ambiguous glyph`);
  }
});

test("PINs are a fixed 10 digits, zero-padded", () => {
  for (const { pin } of generatePins(200)) {
    assert.match(pin, /^\d{10}$/);
  }
});

test("generatePins(0) returns nothing rather than throwing", () => {
  assert.deepEqual(generatePins(0), []);
});
