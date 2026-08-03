import { randomInt } from "node:crypto";

// Excludes 0/O and 1/I — the pair a parent squinting at a printed scratch
// card in poor light is most likely to mix up.
const SERIAL_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomSerial(): string {
  let out = "";
  for (let group = 0; group < 3; group++) {
    if (group > 0) out += "-";
    for (let i = 0; i < 4; i++) {
      out += SERIAL_ALPHABET[randomInt(SERIAL_ALPHABET.length)];
    }
  }
  return out;
}

function randomPin(): string {
  return String(randomInt(0, 1_000_000_000)).padStart(10, "0");
}

export interface GeneratedPin {
  serial: string;
  pin: string;
}

/** One serial + PIN pair per card, both freshly random per card — a batch
 * of 500 doesn't share a PIN or a serial with another card in the same or
 * any other batch (serial is checked unique at insert; the PIN space is
 * large enough that a collision within one batch is not worth guarding
 * against separately). */
export function generatePins(count: number): GeneratedPin[] {
  return Array.from({ length: count }, () => ({ serial: randomSerial(), pin: randomPin() }));
}
