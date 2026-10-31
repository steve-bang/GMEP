import vi from './vi.json';

export type Messages = typeof vi;
export const messages: Messages = vi;

/** Minimal lookup with {param} interpolation for non-React code (API errors, logs). UI uses next-intl on the same JSON. */
export function translate(key: string, params: Record<string, string | number> = {}): string {
  let node: unknown = vi;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in node)
      node = (node as Record<string, unknown>)[part];
    else return key;
  }
  if (typeof node !== 'string') return key;
  return node.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
