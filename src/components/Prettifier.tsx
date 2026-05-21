import { Check, Copy, Download, RotateCcw, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  defaultConfig,
  loadConfig,
  type PrettierConfig,
  saveConfig,
} from '@/lib/prettier-config'
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
  const [config, setConfig] = useState<PrettierConfig>(() => loadConfig(language))

  // Persist whenever config changes for this language.
  useEffect(() => {
    saveConfig(language, config)
  }, [language, config])

  // Auto-format on input/config/language changes, debounced. All setState
  // calls live inside the timer callback so we don't trigger
  // react-hooks/set-state-in-effect.
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
          const formatted = await formatSource(input, language, config)
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
  }, [input, language, config])

  async function manualFormat() {
    setBusy(true)
    try {
      const formatted = await formatSource(input, language, config)
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
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 px-4 py-6">
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

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_1fr_260px]">
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
        <ConfigPanel
          config={config}
          language={language}
          onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
          onReset={() => setConfig(defaultConfig)}
        />
      </div>
    </div>
  )
}

function ConfigPanel({
  config,
  language,
  onChange,
  onReset,
}: {
  config: PrettierConfig
  language: Language
  onChange: (patch: Partial<PrettierConfig>) => void
  onReset: () => void
}) {
  const isJs = language !== 'css'
  return (
    <aside className="flex flex-col gap-4 rounded-md border bg-card p-4">
      <div className="flex items-center">
        <span className="text-sm font-semibold">Settings</span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-7 px-2 text-xs"
          onClick={onReset}
          title="Reset to defaults"
        >
          <RotateCcw /> Reset
        </Button>
      </div>

      <Field label={`Print width · ${config.printWidth}`}>
        <input
          type="range"
          min={40}
          max={200}
          step={1}
          value={config.printWidth}
          onChange={(e) => onChange({ printWidth: Number(e.target.value) })}
          className="w-full"
        />
      </Field>

      <Field label={`Tab width · ${config.tabWidth}`}>
        <input
          type="range"
          min={1}
          max={8}
          step={1}
          value={config.tabWidth}
          onChange={(e) => onChange({ tabWidth: Number(e.target.value) })}
          className="w-full"
        />
      </Field>

      <Toggle
        checked={config.useTabs}
        label="Use tabs"
        onChange={(v) => onChange({ useTabs: v })}
      />

      <Toggle
        checked={config.singleQuote}
        label="Single quotes"
        onChange={(v) => onChange({ singleQuote: v })}
      />

      {isJs ? (
        <>
          <Toggle
            checked={config.semi}
            label="Semicolons"
            onChange={(v) => onChange({ semi: v })}
          />
          <Toggle
            checked={config.bracketSpacing}
            label="Bracket spacing"
            onChange={(v) => onChange({ bracketSpacing: v })}
          />
          <Field label="Trailing comma">
            <select
              value={config.trailingComma}
              onChange={(e) =>
                onChange({
                  trailingComma: e.target.value as PrettierConfig['trailingComma'],
                })
              }
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="none">none</option>
              <option value="es5">es5</option>
              <option value="all">all</option>
            </select>
          </Field>
          <Field label="Arrow parens">
            <select
              value={config.arrowParens}
              onChange={(e) =>
                onChange({
                  arrowParens: e.target.value as PrettierConfig['arrowParens'],
                })
              }
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="always">always</option>
              <option value="avoid">avoid</option>
            </select>
          </Field>
        </>
      ) : null}
    </aside>
  )
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
      <span>{label}</span>
    </label>
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
