import { Prettifier } from '@/components/Prettifier'

const SAMPLE = `.btn{display:inline-flex;align-items:center;gap:.5rem;padding:.5rem 1rem;border-radius:.5rem;background:#1c1c1c;color:#fff}.btn:hover{background:#000}@media (min-width:640px){.btn{padding:.75rem 1.25rem}}`

export function CssPrettifyRoute() {
  return (
    <Prettifier
      downloadName="formatted.css"
      initial={SAMPLE}
      language="css"
      placeholder="Paste CSS here…"
      title="CSS Prettify"
    />
  )
}
