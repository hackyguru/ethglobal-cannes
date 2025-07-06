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
            className="p-2 cursor-pointer hover:bg-gray-50 transition-colors flex items-center"
            style={{ paddingLeft: paddingLeft + 8 }}
          >
            <span className="text-lg mr-2">{getFolderIcon(isExpanded)}</span>
            <span className="text-sm font-medium text-gray-700">{node.name}</span>
            {node.children && (
              <span className="ml-auto text-xs text-gray-400">
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
      return (
        <div
          key={node.path}
          onClick={() => handleFileSelect(node.path)}
          className={`p-2 cursor-pointer hover:bg-gray-50 transition-colors flex items-center ${
            selectedFile?.filePath === node.path ? 'bg-blue-50 border-r-2 border-blue-500' : ''
          }`}
          style={{ paddingLeft: paddingLeft + 8 }}
        >
          <span className="text-lg mr-2">{getFileIcon(node.path)}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {node.name}
            </div>
            {node.size && (
              <div className="text-xs text-gray-400">
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
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-600">Loading codebase...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="text-center py-8">
          <div className="text-red-500 text-lg mb-2">❌ Error</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!codebaseData) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="text-center py-8">
          <p className="text-gray-600">No codebase data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {codebaseData.metadata.repository}
        </h2>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>🌿 Branch: {codebaseData.metadata.branch}</span>
          <span>💾 {codebaseData.totalFiles} files</span>
          <span>📦 {formatFileSize(codebaseData.totalSize)}</span>
          <span>🕐 {new Date(codebaseData.metadata.timestamp).toLocaleString()}</span>
        </div>
      </div>

      <div className="flex">
        {/* File Browser */}
        <div className="w-1/3 border-r border-gray-200">
          {/* Search */}
          <div className="p-4 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* File Tree */}
          <div className="max-h-96 overflow-y-auto">
            {fileTree.length > 0 ? (
              <div className="py-2">
                {fileTree.map(node => renderTreeNode(node))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                {searchTerm ? 'No files match your search' : 'No files found'}
              </div>
            )}
          </div>
        </div>

        {/* File Content */}
        <div className="flex-1">
          {isLoadingFile ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-gray-600">Loading file...</span>
            </div>
          ) : selectedFile ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  {selectedFile.filePath}
                </h3>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>{formatFileSize(selectedFile.size)}</span>
                  <span>•</span>
                  <span>{selectedFile.mimeType}</span>
                </div>
              </div>

              {selectedFile.contentType === 'text' ? (
                <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                    {selectedFile.content}
                  </pre>
                </div>
              ) : selectedFile.contentType === 'binary' ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📁</div>
                  <p>Binary file - {selectedFile.mimeType}</p>
                  <p className="text-sm">Cannot display binary content</p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">❌</div>
                  <p>Error loading file content</p>
                </div>
              )}
            </div>
          ) : codebaseData.readmeContent ? (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                📝 README
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                  {codebaseData.readmeContent}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-500">
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