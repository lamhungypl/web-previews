// Lazy loaders for prettier/standalone + parser plugins.
// Each tool route imports only the loader it needs, and Vite splits prettier
// into separate chunks (~50-150KB each) so the home page stays light.

import type { Options } from 'prettier'

export type Language = 'css' | 'js' | 'ts'

export async function formatSource(
  source: string,
  language: Language,
  extra: Partial<Options> = {},
): Promise<string> {
  const prettier = await import('prettier/standalone')
  const parser = parserFor(language)
  const plugins = await pluginsFor(language)
  return prettier.format(source, {
    parser,
    plugins,
    printWidth: 90,
    semi: false,
    singleQuote: true,
    tabWidth: 2,
    trailingComma: 'all',
    ...extra,
  })
}

function parserFor(language: Language): string {
  if (language === 'css') return 'css'
  return 'babel-ts'
}

async function pluginsFor(language: Language) {
  if (language === 'css') {
    const postcss = await import('prettier/plugins/postcss')
    return [postcss.default]
  }
  const [babel, estree] = await Promise.all([
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ])
  return [babel.default, estree.default]
}
