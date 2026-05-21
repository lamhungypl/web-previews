import { Loader2, UploadCloud } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { type Accept, useDropzone } from 'react-dropzone'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface FilePickerProps {
  accept: Accept
  busy?: boolean
  className?: string
  hint?: ReactNode
  icon?: ComponentType<{ className?: string }>
  label?: string
  multiple?: boolean
  onFile: (file: File) => void
}

export function FilePicker({
  accept,
  busy = false,
  className,
  hint,
  icon: Icon = UploadCloud,
  label = 'Drop a file here, or click to choose',
  multiple = false,
  onFile,
}: FilePickerProps) {
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept,
    disabled: busy,
    multiple,
    onDrop: (accepted) => {
      const file = accepted[0]
      if (file) onFile(file)
    },
  })

  return (
    <Card
      {...getRootProps()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-10 transition-colors',
        isDragActive && !isDragReject && 'border-primary bg-primary/5',
        isDragReject && 'border-destructive bg-destructive/5',
        busy && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input {...getInputProps()} />
      {busy ? (
        <Loader2 className="size-10 animate-spin text-muted-foreground" />
      ) : (
        <Icon className="size-10 text-muted-foreground" />
      )}
      <div className="text-center">
        <p className="font-medium">
          {busy
            ? 'Loading…'
            : isDragActive
              ? isDragReject
                ? 'That file type is not supported'
                : 'Drop to load'
              : label}
        </p>
        {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      </div>
    </Card>
  )
}
