import { FileArchive, FileCode } from 'lucide-react'

import { FilePicker } from '@/components/FilePicker'

interface DropzoneProps {
  busy?: boolean
  onFile: (file: File) => void
}

export function Dropzone({ onFile, busy = false }: DropzoneProps) {
  return (
    <FilePicker
      accept={{
        'text/html': ['.html', '.htm'],
        'application/zip': ['.zip'],
        'application/x-zip-compressed': ['.zip'],
      }}
      busy={busy}
      className="w-full p-12"
      hint={
        <span className="flex items-center justify-center gap-3">
          <span className="inline-flex items-center gap-1">
            <FileCode className="size-3.5" /> .html
          </span>
          <span className="inline-flex items-center gap-1">
            <FileArchive className="size-3.5" /> .zip
          </span>
        </span>
      }
      onFile={onFile}
    />
  )
}
