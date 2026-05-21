import { FileArchive, FileCode, Loader2, UploadCloud } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface DropzoneProps {
  busy?: boolean
  onFile: (file: File) => void
}

export function Dropzone({ onFile, busy = false }: DropzoneProps) {
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    multiple: false,
    disabled: busy,
    onDrop: (accepted) => {
      const file = accepted[0]
      if (file) onFile(file)
    },
    accept: {
      'text/html': ['.html', '.htm'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
    },
  })

  return (
    <Card
      {...getRootProps()}
      className={cn(
        'flex w-full cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-12 transition-colors',
        isDragActive && !isDragReject && 'border-primary bg-primary/5',
        isDragReject && 'border-destructive bg-destructive/5',
        busy && 'cursor-not-allowed opacity-60',
      )}
    >
      <input {...getInputProps()} />
      {busy ? (
        <Loader2 className="size-10 animate-spin text-muted-foreground" />
      ) : (
        <UploadCloud className="size-10 text-muted-foreground" />
      )}
      <div className="text-center">
        <p className="font-medium">
          {busy
            ? 'Loading project…'
            : isDragActive
              ? isDragReject
                ? 'That file type is not supported'
                : 'Drop to load'
              : 'Drop a file here, or click to choose'}
        </p>
        <p className="mt-1 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <FileCode className="size-3.5" /> .html
          </span>
          <span className="inline-flex items-center gap-1">
            <FileArchive className="size-3.5" /> .zip
          </span>
        </p>
      </div>
    </Card>
  )
}
