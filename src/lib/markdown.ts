import { Marked, type Tokens } from 'marked'

/**
 * Render a Markdown string into a complete standalone HTML document with
 * GitHub-flavored styling. The result is shown in a sandboxed iframe (and can
 * be opened in a new tab), mirroring how the HTML preview serves documents —
 * so embedded HTML is left as-is, same trust model as previewing raw .html.
 *
 * ```mermaid``` code blocks are rendered to inline SVG here in the host page
 * (mermaid is lazy-loaded), so the iframe document needs no scripts.
 */
export async function renderMarkdownDocument(
  markdown: string,
  title: string,
): Promise<string> {
  // Collect mermaid blocks during parse and splice rendered SVGs in after —
  // marked's renderer hooks are synchronous, mermaid rendering is not.
  const mermaidBlocks: string[] = []
  const md = new Marked({ gfm: true })
  md.use({
    renderer: {
      code(token: Tokens.Code): false | string {
        if (token.lang?.trim().split(/\s/)[0] === 'mermaid') {
          mermaidBlocks.push(token.text)
          return `<!--mermaid-${mermaidBlocks.length - 1}-->`
        }
        return false
      },
    },
  })

  let body = await md.parse(markdown, { async: true })

  if (mermaidBlocks.length > 0) {
    const svgs = await renderMermaidBlocks(mermaidBlocks)
    body = body.replace(/<!--mermaid-(\d+)-->/g, (_, i: string) => svgs[Number(i)])
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${MARKDOWN_CSS}</style>
</head>
<body>
<article class="markdown-body">
${body}
</article>
</body>
</html>`
}

/** Render mermaid sources to SVG strings; a failed block becomes an error box. */
async function renderMermaidBlocks(blocks: string[]): Promise<string[]> {
  const mermaid = (await import('mermaid')).default
  // suppressErrorRendering: a bad diagram must not splat mermaid's error SVG
  // into the host page — we show our own error box in the document instead.
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
  })

  return Promise.all(
    blocks.map(async (source, i) => {
      try {
        const { svg } = await mermaid.render(
          `mermaid-${crypto.randomUUID().slice(0, 8)}-${i}`,
          source,
        )
        return `<div class="mermaid-diagram">${svg}</div>`
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return `<pre class="mermaid-error">${escapeHtml(message)}\n\n${escapeHtml(source)}</pre>`
      }
    }),
  )
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Compact GitHub-like markdown styling, light theme. */
const MARKDOWN_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #ffffff;
  color: #1f2328;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
}
.markdown-body {
  max-width: 860px;
  margin: 0 auto;
  padding: 32px 24px 64px;
  word-wrap: break-word;
}
.markdown-body > :first-child { margin-top: 0; }
h1, h2, h3, h4, h5, h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}
h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid #d1d9e0; }
h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid #d1d9e0; }
h3 { font-size: 1.25em; }
h4 { font-size: 1em; }
h5 { font-size: 0.875em; }
h6 { font-size: 0.85em; color: #59636e; }
p, blockquote, ul, ol, dl, table, pre { margin-top: 0; margin-bottom: 16px; }
a { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote {
  padding: 0 1em;
  color: #59636e;
  border-left: 0.25em solid #d1d9e0;
  margin-left: 0;
  margin-right: 0;
}
ul, ol { padding-left: 2em; }
li + li { margin-top: 0.25em; }
li > p { margin-bottom: 8px; }
code, kbd, pre, samp {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
}
code {
  padding: 0.2em 0.4em;
  font-size: 85%;
  background: #f0f1f3;
  border-radius: 6px;
}
pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background: #f6f8fa;
  border-radius: 6px;
}
pre code { padding: 0; font-size: 100%; background: transparent; border-radius: 0; }
table { border-spacing: 0; border-collapse: collapse; display: block; max-width: 100%; overflow: auto; }
th, td { padding: 6px 13px; border: 1px solid #d1d9e0; }
th { font-weight: 600; }
tr:nth-child(2n) { background: #f6f8fa; }
img { max-width: 100%; height: auto; }
hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background: #d1d9e0;
  border: 0;
}
input[type="checkbox"] { margin-right: 0.5em; }
.mermaid-diagram { margin-bottom: 16px; overflow-x: auto; text-align: center; }
.mermaid-diagram svg { max-width: 100%; height: auto; }
.mermaid-error { color: #d1242f; background: #fff1f0; border: 1px solid #ffd7d5; }
li:has(> input[type="checkbox"]) { list-style: none; margin-left: -1.5em; }
`
