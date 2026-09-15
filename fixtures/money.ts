/** Price parsing and formatting - shared by two pages and two specs. */

/** "$29.99" -> 29.99. Throws rather than returning a silently poisonous NaN. */
export function parsePrice(text: string): number {
  const match = text.match(/\$([\d,]+\.\d{2})/);
  if (!match) throw new Error(`Could not parse a price from "${text}"`);
  return Number(match[1].replace(/,/g, ''));
}

/** 29.99 -> "$29.99", matching how the app renders prices. */
export function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}
