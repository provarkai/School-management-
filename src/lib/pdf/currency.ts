/** @react-pdf/renderer's built-in fonts (Helvetica etc., WinAnsi encoding —
 * no custom font is registered anywhere in this app) have no ₦ (U+20A6)
 * glyph, so naira()'s output silently renders as a broken tofu character in
 * every PDF. Used only inside @react-pdf/renderer documents/routes — the
 * on-screen naira() in src/lib/format.ts is unaffected and still shows the
 * real ₦ symbol, since browsers render it fine. "N" is the same fallback
 * Nigerian documents commonly fall back to when ₦ isn't available. */
export function nairaPdf(amount: number): string {
  return "N" + new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(amount);
}
