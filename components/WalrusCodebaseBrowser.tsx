import { useState, useEffect } from 'react'

interface FileInfo {
  path: string
  size: number
  mimeType: string
  contentType: 'text' | 'binary' | 'error'
  modified: string
}

interface CodebaseMetadata {
  timestamp: string
  repository: string
  branch: string
  commit: string
  total_files: number
  total_size: number
}

interface CodebaseData {
  metadata: CodebaseMetadata
  files: FileInfo[]
  readmeFile: string | null
  readmeContent: string | null
  totalFiles: number
  totalSize: number
}

interface FileData {
  filePath: string
  content: string
  contentType: 'text' | 'binary' | 'error'
  mimeType: string
  size: number
  modified: string
  metadata: CodebaseMetadata
}

interface WalrusCodebaseBrowserProps {
  blobId: string
  className?: string
}

interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  mimeType?: string
  contentType?: 'text' | 'binary' | 'error'
  modified?: string
  children?: FileTreeNode[]
}

const WalrusCodebaseBrowser: React.FC<WalrusCodebaseBrowserProps> = ({ blobId, className = '' }) => {
  const [codebaseData, setCodebaseData] = useState<CodebaseData | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Load codebase overview
  useEffect(() => {
    const fetchCodebaseData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/walrus/${blobId}`)
        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch codebase data')
        }

        setCodebaseData(result.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    if (blobId) {
      fetchCodebaseData()
    }
  }, [blobId])

  // Auto-expand root folders when codebase data loads
  useEffect(() => {
    if (codebaseData && codebaseData.files.length > 0) {
      const rootFolders = new Set<string>()
      
      codebaseData.files.forEach(file => {
        const parts = file.path.split('/')
        if (parts.length > 1) {
          // Add first level folder
          rootFolders.add(parts[0])
          // Also add second level if it exists (for better UX)
          if (parts.length > 2) {
            rootFolders.add(`${parts[0]}/${parts[1]}`)
          }
        }
      })
      
      setExpandedFolders(rootFolders)
    }
  }, [codebaseData])

  // Load specific file content
  const handleFileSelect = async (filePath: string) => {
    try {
      setIsLoadingFile(true)
      setError(null)

      const response = await fetch(`/api/walrus/${blobId}?file=${encodeURIComponent(filePath)}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch file content')
      }

      setSelectedFile(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file')
    } finally {
      setIsLoadingFile(false)
    }
  }

  // Build file tree structure
  const buildFileTree = (files: FileInfo[]): FileTreeNode[] => {
    const tree: FileTreeNode[] = []
    const nodeMap = new Map<string, FileTreeNode>()

    // Sort files by path to ensure consistent ordering
    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path))

    sortedFiles.forEach(file => {
      const parts = file.path.split('/')
      let currentPath = ''

      parts.forEach((part, index) => {
        const previousPath = currentPath
        currentPath = currentPath ? `${currentPath}/${part}` : part
        
        if (!nodeMap.has(currentPath)) {
          const isFile = index === parts.length - 1
          const node: FileTreeNode = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : []
          }

          if (isFile) {
            node.size = file.size
            node.mimeType = file.mimeType
            node.contentType = file.contentType
            node.modified = file.modified
          }

          nodeMap.set(currentPath, node)

          if (previousPath) {
            const parentNode = nodeMap.get(previousPath)
            if (parentNode && parentNode.children) {
              parentNode.children.push(node)
            }
          } else {
            tree.push(node)
          }
        }
      })
    })

    return tree
  }

  // Filter files based on search term
  const filteredFiles = codebaseData?.files.filter(file =>
    file.path.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  // Build tree structure
  const fileTree = buildFileTree(searchTerm ? filteredFiles : codebaseData?.files || [])

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Toggle folder expansion
  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath)
    } else {
      newExpanded.add(folderPath)
    }
    setExpandedFolders(newExpanded)
  }

  // Get file type icon
  const getFileIcon = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return '📄'
      case 'md':
        return '📝'
      case 'json':
        return '📋'
      case 'css':
        return '🎨'
      case 'html':
        return '🌐'
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return '🖼️'
      case 'pdf':
        return '📕'
      default:
        return '📄'
    }
  }

  // Get folder icon
  const getFolderIcon = (isExpanded: boolean): string => {
    return isExpanded ? '📂' : '📁'
  }

  // Recursive tree renderer
  const renderTreeNode = (node: FileTreeNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.path)
    const paddingLeft = depth * 16

    if (node.type === 'folder') {
      return (
        <div key={node.path}>
          <div
            onClick={() => toggleFolder(node.path)}
            className="p-2 cursor-pointer hover:bg-gray-100/50 transition-colors flex items-center"
            style={{ paddingLeft: paddingLeft + 8 }}
          >
            <span className="text-lg mr-2">{getFolderIcon(isExpanded)}</span>
            <span className="text-sm font-medium" style={{ color: '#1b1b1b' }}>{node.name}</span>
            {node.children && (
              <span className="ml-auto text-xs" style={{ color: '#1b1b1b', opacity: 0.6 }}>
                {node.children.length} items
              </span>
            )}
          </div>
          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      )
    } else {
      const isSelected = selectedFile?.filePath === node.path
      return (
        <div
          key={node.path}
          onClick={() => handleFileSelect(node.path)}
          className={`p-2 cursor-pointer hover:bg-gray-100/50 transition-colors flex items-center ${
            isSelected ? 'border-r-2' : ''
          }`}
          style={{ 
            paddingLeft: paddingLeft + 8,
            backgroundColor: isSelected ? 'rgba(157, 255, 0, 0.2)' : undefined,
            borderRightColor: isSelected ? '#9dff00' : undefined
          }}
        >
          <span className="text-lg mr-2">{getFileIcon(node.path)}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: '#1b1b1b' }}>
              {node.name}
            </div>
            {node.size && (
              <div className="text-xs" style={{ color: '#1b1b1b', opacity: 0.6 }}>
                {formatFileSize(node.size)}
              </div>
            )}
          </div>
        </div>
      )
    }
  }

  if (isLoading) {
    return (
      <div className={`bg-white/70 backdrop-blur-md rounded-lg shadow-lg p-6 border border-gray-300/50 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#9dff00' }}></div>
          <span className="ml-2" style={{ color: '#1b1b1b' }}>Loading codebase...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white/70 backdrop-blur-md rounded-lg shadow-lg p-6 border border-gray-300/50 ${className}`}>
        <div className="text-center py-8">
          <div className="text-lg mb-2" style={{ color: '#dc2626' }}>❌ Error</div>
          <p style={{ color: '#1b1b1b' }}>{error}</p>
        </div>
      </div>
    )
  }

  if (!codebaseData) {
    return (
      <div className={`bg-white/70 backdrop-blur-md rounded-lg shadow-lg p-6 border border-gray-300/50 ${className}`}>
        <div className="text-center py-8">
          <p style={{ color: '#1b1b1b' }}>No codebase data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white/70 backdrop-blur-md rounded-lg shadow-lg border border-gray-300/50 flex flex-col ${className}`} style={{ height: 'calc(100vh - 200px)' }}>
      {/* Header */}
      <div className="border-b border-gray-300/50 p-6 flex-shrink-0">
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#1b1b1b', fontFamily: 'VT323, monospace' }}>
          {codebaseData.metadata.repository}
        </h2>
        <div className="flex flex-wrap gap-4 text-sm" style={{ color: '#1b1b1b', opacity: 0.6 }}>
          <span>🌿 Branch: {codebaseData.metadata.branch}</span>
          <span>💾 {codebaseData.totalFiles} files</span>
          <span>📦 {formatFileSize(codebaseData.totalSize)}</span>
          <span>🕐 {new Date(codebaseData.metadata.timestamp).toLocaleString()}</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File Browser */}
        <div className="w-1/3 border-r border-gray-300/50 flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-gray-300/50 flex-shrink-0">
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white/80 focus:outline-none focus:ring-2 focus:border-gray-400"
              style={{ 
                color: '#1b1b1b',
                '--tw-ring-color': '#9dff00',
                '--tw-ring-opacity': '0.3'
              } as React.CSSProperties}
            />
          </div>

          {/* File Tree */}
          <div className="flex-1 overflow-y-auto">
            {fileTree.length > 0 ? (
              <div className="py-2">
                {fileTree.map(node => renderTreeNode(node))}
              </div>
            ) : (
              <div className="p-4 text-center" style={{ color: '#1b1b1b', opacity: 0.6 }}>
                {searchTerm ? 'No files match your search' : 'No files found'}
              </div>
            )}
          </div>
        </div>

        {/* File Content */}
        <div className="flex-1 flex flex-col">
          {isLoadingFile ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#9dff00' }}></div>
              <span className="ml-2" style={{ color: '#1b1b1b' }}>Loading file...</span>
            </div>
          ) : selectedFile ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-300/50 flex-shrink-0">
                <h3 className="text-lg font-semibold" style={{ color: '#1b1b1b' }}>
                  {selectedFile.filePath}
                </h3>
                <div className="flex items-center space-x-2 text-sm" style={{ color: '#1b1b1b', opacity: 0.6 }}>
                  <span>{formatFileSize(selectedFile.size)}</span>
                  <span>•</span>
                  <span>{selectedFile.mimeType}</span>
                </div>
              </div>

              {selectedFile.contentType === 'text' ? (
                <div className="flex-1 overflow-auto p-6">
                  <div className="bg-gray-100/50 rounded-lg p-4 border border-gray-300/50 h-full">
                    <pre className="text-sm whitespace-pre-wrap" style={{ color: '#1b1b1b' }}>
                      {selectedFile.content}
                    </pre>
                  </div>
                </div>
              ) : selectedFile.contentType === 'binary' ? (
                <div className="flex-1 flex items-center justify-center" style={{ color: '#1b1b1b', opacity: 0.6 }}>
                  <div className="text-center">
                    <div className="text-4xl mb-2">📁</div>
                    <p>Binary file - {selectedFile.mimeType}</p>
                    <p className="text-sm">Cannot display binary content</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center" style={{ color: '#1b1b1b', opacity: 0.6 }}>
                  <div className="text-center">
                    <div className="text-4xl mb-2">❌</div>
                    <p>Error loading file content</p>
                  </div>
                </div>
              )}
            </div>
          ) : codebaseData.readmeContent ? (
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-gray-300/50 flex-shrink-0">
                <h3 className="text-lg font-semibold" style={{ color: '#1b1b1b' }}>
                  📝 README
                </h3>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <div className="bg-gray-100/50 rounded-lg p-4 border border-gray-300/50 h-full">
                  <pre className="text-sm whitespace-pre-wrap" style={{ color: '#1b1b1b' }}>
                    {codebaseData.readmeContent}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center" style={{ color: '#1b1b1b', opacity: 0.6 }}>
              <div className="text-center">
                <div className="text-4xl mb-2">👈</div>
                <p>Select a file to view its content</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WalrusCodebaseBrowser 