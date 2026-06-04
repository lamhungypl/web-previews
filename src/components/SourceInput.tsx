import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SourceInputProps {
  busy?: boolean
  onSubmit: (text: string) => void
  placeholder?: string
  submitLabel?: string
}

/**
 * A textarea where the user can paste or type source, with an explicit
 * "Preview" action. Unlike a global paste listener, the pasted content stays
 * visible and editable before it's rendered. ⌘/Ctrl+Enter submits.
 */
export function SourceInput({
  busy = false,
  onSubmit,
  placeholder,
  submitLabel = 'Preview',
}: SourceInputProps) {
  const [text, setText] = useState('')
  const trimmed = text.trim()

  function submit() {
    if (trimmed && !busy) onSubmit(text)
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={placeholder}
        spellCheck={false}
        disabled={busy}
        className={cn(
          'min-h-40 w-full resize-y rounded-md border bg-background p-3 font-mono text-sm',
          'focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      />
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-muted-foreground">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">⌘↵</kbd> to preview
        </span>
        <Button onClick={submit} disabled={!trimmed || busy}>
          {busy ? 'Loading…' : submitLabel}
        </Button>
      </div>
    </div>
  )
}
