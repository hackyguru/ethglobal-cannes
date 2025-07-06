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

const WalrusCodebaseBrowser: React.FC<WalrusCodebaseBrowserProps> = ({ blobId, className = '' }) => {
  const [codebaseData, setCodebaseData] = useState<CodebaseData | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

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

  // Filter files based on search term
  const filteredFiles = codebaseData?.files.filter(file =>
    file.path.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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

          {/* File List */}
          <div className="max-h-96 overflow-y-auto">
            {filteredFiles.map((file) => (
              <div
                key={file.path}
                onClick={() => handleFileSelect(file.path)}
                className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedFile?.filePath === file.path ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getFileIcon(file.path)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {file.path.split('/').pop()}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {file.path}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatFileSize(file.size)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
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