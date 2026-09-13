import { en, TKey } from './en';
import { ur } from './ur';

export type TranslationParams = Readonly<Record<string, string | number>>;
/** Replacement callback preserves literal dollar signs and replaces every occurrence. */
export function translate(language: 'en' | 'ur', key: TKey, params: TranslationParams = {}): string {
  const value = (language === 'ur' ? ur : en)[key];
  return value.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (token, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : token);
}
