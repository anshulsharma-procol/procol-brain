import { ChevronRight, File, FilePlus, Folder, FolderPlus, Home, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import FilePreviewPanel from './components/FilePreviewPanel'
import {
  formatFileDate,
  formatFileSize,
  isTextExtension,
  loadFileNodesFromStorage,
  newFileNodeId,
  saveFileNodesToStorage,
} from './storage'
import type { FileSystemNode } from './types'

/** A save-and-browse file/folder tree for the Knowledge page's "Files" tab. */
export default function FileExplorer() {
  const [nodes, setNodes] = useState<FileSystemNode[]>(() => loadFileNodesFromStorage())
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function persist(next: FileSystemNode[]) {
    setNodes(next)
    saveFileNodesToStorage(next)
  }

  const breadcrumb = useMemo(() => {
    const trail: FileSystemNode[] = []
    let cursor = currentFolderId
    while (cursor) {
      const folder = nodes.find((node) => node.id === cursor)
      if (!folder) break
      trail.unshift(folder)
      cursor = folder.parentId
    }
    return trail
  }, [currentFolderId, nodes])

  const children = nodes
    .filter((node) => node.parentId === currentFolderId)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  const selectedFile = nodes.find((node) => node.id === selectedFileId) ?? null

  function childCount(folderId: string): number {
    return nodes.filter((node) => node.parentId === folderId).length
  }

  function collectWithDescendants(nodeId: string): string[] {
    const ids = [nodeId]
    const stack = [nodeId]
    while (stack.length > 0) {
      const current = stack.pop()!
      const kids = nodes.filter((node) => node.parentId === current)
      for (const kid of kids) {
        ids.push(kid.id)
        stack.push(kid.id)
      }
    }
    return ids
  }

  function handleDelete(nodeId: string) {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) return
    const label = node.kind === 'folder' ? 'this folder and everything inside it' : 'this file'
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return
    const idsToRemove = new Set(collectWithDescendants(nodeId))
    persist(nodes.filter((item) => !idsToRemove.has(item.id)))
    if (selectedFileId && idsToRemove.has(selectedFileId)) setSelectedFileId(null)
  }

  function handleCreateFolder() {
    const name = newFolderName.trim()
    if (!name) {
      setCreatingFolder(false)
      return
    }
    const folder: FileSystemNode = {
      id: newFileNodeId(),
      parentId: currentFolderId,
      name,
      kind: 'folder',
      updatedAt: new Date().toISOString(),
    }
    persist([...nodes, folder])
    setNewFolderName('')
    setCreatingFolder(false)
  }

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)

    Promise.all(
      files.map(
        (file) =>
          new Promise<FileSystemNode>((resolve) => {
            const base: Omit<FileSystemNode, 'content' | 'previewKind'> = {
              id: newFileNodeId(),
              parentId: currentFolderId,
              name: file.name,
              kind: 'file',
              sizeBytes: file.size,
              updatedAt: new Date().toISOString(),
            }
            if (!isTextExtension(file.name)) {
              resolve({ ...base, previewKind: 'unsupported' })
              return
            }
            const reader = new FileReader()
            reader.onload = () => {
              resolve({ ...base, previewKind: 'text', content: String(reader.result ?? '') })
            }
            reader.onerror = () => resolve({ ...base, previewKind: 'unsupported' })
            reader.readAsText(file)
          }),
      ),
    ).then((newNodes) => {
      persist([...nodes, ...newNodes])
    })
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
            <button
              type="button"
              onClick={() => setCurrentFolderId(null)}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium ${
                currentFolderId === null ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Home className="h-3.5 w-3.5" />
              Knowledge
            </button>
            {breadcrumb.map((folder) => (
              <span key={folder.id} className="flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                <button
                  type="button"
                  onClick={() => setCurrentFolderId(folder.id)}
                  className={`rounded-lg px-2 py-1 font-medium ${
                    folder.id === currentFolderId ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setCreatingFolder(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <FilePlus className="h-4 w-4" />
              Upload File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                handleFilesSelected(event.target.files)
                event.target.value = ''
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {creatingFolder && (
            <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <Folder className="h-4.5 w-4.5 text-amber-600" />
              </div>
              <input
                autoFocus
                type="text"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleCreateFolder()
                  if (event.key === 'Escape') {
                    setCreatingFolder(false)
                    setNewFolderName('')
                  }
                }}
                placeholder="Folder name"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCreateFolder}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Create
              </button>
              <button
                type="button"
                aria-label="Cancel"
                onClick={() => {
                  setCreatingFolder(false)
                  setNewFolderName('')
                }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {children.length === 0 && !creatingFolder ? (
            <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
              This folder is empty. Create a folder or upload a file to get started.
            </p>
          ) : (
            children.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => (node.kind === 'folder' ? setCurrentFolderId(node.id) : setSelectedFileId(node.id))}
                className={`group flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                  node.kind === 'file' && node.id === selectedFileId
                    ? 'border-blue-300 bg-blue-50/60'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    node.kind === 'folder' ? 'bg-amber-100' : 'bg-blue-100'
                  }`}
                >
                  {node.kind === 'folder' ? (
                    <Folder className="h-4.5 w-4.5 text-amber-600" />
                  ) : (
                    <File className="h-4.5 w-4.5 text-blue-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{node.name}</p>
                  <p className="text-xs text-gray-400">
                    {node.kind === 'folder'
                      ? `${childCount(node.id)} item${childCount(node.id) === 1 ? '' : 's'}`
                      : `${formatFileSize(node.sizeBytes)} · Updated ${formatFileDate(node.updatedAt)}`}
                  </p>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleDelete(node.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.stopPropagation()
                      handleDelete(node.id)
                    }
                  }}
                  aria-label={`Delete ${node.name}`}
                  className="shrink-0 rounded p-1.5 text-gray-300 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <FilePreviewPanel node={selectedFile} onDelete={handleDelete} />
    </div>
  )
}
