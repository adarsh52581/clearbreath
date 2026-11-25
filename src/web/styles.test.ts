import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

function parseHexTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const regex = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(css)) !== null) {
    if (match[1] && match[2]) {
      tokens[match[1]] = match[2];
    }
  }
  return tokens;
}

function channelLuminance(c8: number): number {
  const s = c8 / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Design token WCAG AA contrast ratios', () => {
  const cssPath = path.resolve(process.cwd(), 'src/web/styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const tokens = parseHexTokens(css);

  const pairs: readonly [string, string][] = [
    ['ink', 'surface'],
    ['ink', 'surface-2'],
    ['ink-muted', 'surface'],
    ['ink-muted', 'surface-2'],
    ['accent', 'surface'],
    ['accent', 'surface-2'],
    ['danger', 'surface'],
    ['danger', 'surface-2'],
    ['warning-ink', 'surface'],
    ['warning-ink', 'surface-2'],
    ['focus', 'surface'],
    ['surface', 'accent'],
  ];

  it.each(pairs)('%s on %s has contrast ratio >= 4.5:1', (fg, bg) => {
    const fgHex = tokens[fg];
    const bgHex = tokens[bg];
    expect(fgHex).toBeDefined();
    expect(bgHex).toBeDefined();
    const ratio = contrastRatio(fgHex!, bgHex!);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
