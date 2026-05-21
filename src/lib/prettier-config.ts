// User-tweakable subset of Prettier options, persisted per language in
// localStorage so the panel "remembers" between visits.

import type { Language } from '@/lib/prettify'

export interface PrettierConfig {
  arrowParens: 'always' | 'avoid'
  bracketSpacing: boolean
  printWidth: number
  semi: boolean
  singleQuote: boolean
  tabWidth: number
  trailingComma: 'all' | 'es5' | 'none'
  useTabs: boolean
}

export const defaultConfig: PrettierConfig = {
  arrowParens: 'always',
  bracketSpacing: true,
  printWidth: 90,
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  useTabs: false,
}

const storageKey = (language: Language) => `web-previews:prettify-config:${language}`

export function loadConfig(language: Language): PrettierConfig {
  if (typeof localStorage === 'undefined') return defaultConfig
  try {
    const raw = localStorage.getItem(storageKey(language))
    if (!raw) return defaultConfig
    const parsed = JSON.parse(raw) as Partial<PrettierConfig>
    return { ...defaultConfig, ...parsed }
  } catch {
    return defaultConfig
  }
}

export function saveConfig(language: Language, config: PrettierConfig): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(storageKey(language), JSON.stringify(config))
  } catch {
    // quota or storage disabled — silently ignore; the in-memory state still works
  }
}
