import { useEffect, useRef } from 'react'

import { fileStamp } from '@/lib/fs-access'

/**
 * Re-read a file handle on an interval and call back when its contents change.
 *
 * There is no filesystem change event on the web, so polling mtime+size is the
 * only option. Cheap enough at this cadence, and it's what makes editing a
 * Markdown file in your editor refresh the preview on save. Paused while the
 * tab is hidden.
 */
export function useFileWatch(
  file: FileSystemFileHandle | null,
  enabled: boolean,
  onChange: () => void,
  intervalMs = 1200,
): void {
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!file || !enabled) return
    let stamp: null | string = null
    let cancelled = false

    async function poll() {
      if (cancelled || document.hidden) return
      try {
        const next = fileStamp(await file!.getFile())
        // First tick just records the baseline; only later changes fire.
        if (stamp !== null && next !== stamp) onChangeRef.current()
        stamp = next
      } catch {
        // File moved, deleted, or permission revoked — stop nagging.
        cancelled = true
      }
    }

    void poll()
    const timer = setInterval(() => void poll(), intervalMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [file, enabled, intervalMs])
}
