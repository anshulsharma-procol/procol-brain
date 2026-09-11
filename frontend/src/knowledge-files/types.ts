// Domain types for the Knowledge "Files" tab — a lightweight folder/file
// tree so people can save and browse information the same way they would
// in a normal file manager, alongside the structured knowledge entries.

export type FileNodeKind = 'folder' | 'file'

/** How a file's content can be shown in the preview panel. */
export type PreviewKind = 'text' | 'unsupported'

export interface FileSystemNode {
  id: string
  parentId: string | null
  name: string
  kind: FileNodeKind
  /** Only present for text-previewable files. */
  content?: string
  previewKind?: PreviewKind
  sizeBytes?: number
  updatedAt: string
}
