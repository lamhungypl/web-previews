/// <reference types="vite/client" />

// File System Access API bits that TypeScript's lib.dom doesn't declare yet.
// The handle interfaces themselves (FileSystemFileHandle etc.) *are* built in,
// so we only augment the pickers and the permission methods.
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemHandle {
  queryPermission?(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>
  requestPermission?(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>
}

interface FilePickerAcceptType {
  accept: Record<string, string[]>
  description?: string
}

interface OpenFilePickerOptions {
  excludeAcceptAllOption?: boolean
  id?: string
  multiple?: boolean
  startIn?: FileSystemHandle | string
  types?: FilePickerAcceptType[]
}

interface DirectoryPickerOptions {
  id?: string
  mode?: 'read' | 'readwrite'
  startIn?: FileSystemHandle | string
}

interface Window {
  showDirectoryPicker?(
    options?: DirectoryPickerOptions,
  ): Promise<FileSystemDirectoryHandle>
  showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
}

interface DataTransferItem {
  getAsFileSystemHandle?(): Promise<
    FileSystemFileHandle | FileSystemDirectoryHandle | null
  >
}
