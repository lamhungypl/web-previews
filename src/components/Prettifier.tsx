import { Check, Copy, Download, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { formatSource, type Language } from '@/lib/prettify'

interface PrettifierProps {
  /** Suggested filename when downloading the formatted output. */
  downloadName: string
  /** Optional sample to pre-populate the input on first mount. */
  initial?: string
  language: Language
  placeholder?: string
  title: string
}

export function Prettifier({
  downloadName,
  initial = '',
  language,
  placeholder,
  title,
}: PrettifierProps) {
  const [input, setInput] = useState(initial)
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  // Auto-format on input changes, debounced — keeps the UX one-click but
  // doesn't fight the user as they type. All setState calls live inside the
  // timer callback so we don't trigger react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false
    const empty = !input.trim()
    const t = setTimeout(
      async () => {
        if (cancelled) return
        if (empty) {
          setOutput('')
          setError(null)
          return
        }
        setBusy(true)
        try {
          const formatted = await formatSource(input, language)
          if (cancelled) return
          setOutput(formatted)
          setError(null)
        } catch (err) {
          if (cancelled) return
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          if (!cancelled) setBusy(false)
        }
      },
      empty ? 0 : 350,
    )
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [input, language])

  async function manualFormat() {
    setBusy(true)
    try {
      const formatted = await formatSource(input, language)
      setOutput(formatted)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function download() {
    if (!output) return
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      setInput(text)
    } catch {
      toast.error('Clipboard read was blocked.')
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Auto-formats as you type. Everything runs locally.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={pasteFromClipboard}>
            Paste
          </Button>
          <Button size="sm" onClick={manualFormat} disabled={busy || !input.trim()}>
            <Wand2 /> Format
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <Pane title="Input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder ?? 'Paste your code here…'}
            spellCheck={false}
            className="h-full w-full resize-none rounded-md border bg-background p-3 font-mono text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </Pane>
        <Pane
          title="Output"
          actions={
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={copy}
                disabled={!output}
                title="Copy to clipboard"
              >
                {copied ? <Check /> : <Copy />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={download}
                disabled={!output}
                title="Download"
              >
                <Download />
              </Button>
            </>
          }
        >
          {error ? (
            <pre className="h-full w-full overflow-auto rounded-md border border-destructive bg-destructive/5 p-3 font-mono text-sm text-destructive">
              {error}
            </pre>
          ) : (
            <textarea
              value={output}
              readOnly
              spellCheck={false}
              placeholder={busy ? 'Formatting…' : 'Formatted output appears here.'}
              className="h-full w-full resize-none rounded-md border bg-muted p-3 font-mono text-sm outline-none"
            />
          )}
        </Pane>
      </div>
    </div>
  )
}

function Pane({
  actions,
  children,
  title,
}: {
  actions?: React.ReactNode
  children: React.ReactNode
  title: string
}) {
  return (
    <div className="flex min-h-[40vh] flex-col gap-1.5">
      <div className="flex h-7 items-center">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <div className="ml-auto flex items-center gap-1">{actions}</div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
