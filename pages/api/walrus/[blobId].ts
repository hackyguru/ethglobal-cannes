import { NextApiRequest, NextApiResponse } from 'next'

interface WalrusCodebaseData {
  metadata: {
    timestamp: string
    repository: string
    branch: string
    commit: string
    total_files: number
    total_size: number
  }
  files: {
    [filePath: string]: {
      content: string
      content_type: 'text' | 'binary' | 'error'
      mime_type: string
      size: number
      modified: string
    }
  }
}

interface ApiResponse {
  success: boolean
  data?: any
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Only GET requests are supported.'
    })
  }

  const { blobId, file } = req.query

  if (!blobId || typeof blobId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Blob ID is required and must be a string'
    })
  }

  try {
    // Fetch the blob from Walrus
    const walrusResponse = await fetch(`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`)
    
    if (!walrusResponse.ok) {
      throw new Error(`Failed to fetch blob from Walrus: ${walrusResponse.status} ${walrusResponse.statusText}`)
    }

    // Parse the JSON response
    const codebaseData: WalrusCodebaseData = await walrusResponse.json()

    // Validate the response structure
    if (!codebaseData.metadata || !codebaseData.files) {
      throw new Error('Invalid codebase data structure')
    }

    // If a specific file is requested
    if (file && typeof file === 'string') {
      const fileData = codebaseData.files[file]
      
      if (!fileData) {
        return res.status(404).json({
          success: false,
          error: `File not found: ${file}`
        })
      }

      // Return the specific file data
      return res.status(200).json({
        success: true,
        data: {
          filePath: file,
          content: fileData.content,
          contentType: fileData.content_type,
          mimeType: fileData.mime_type,
          size: fileData.size,
          modified: fileData.modified,
          metadata: codebaseData.metadata
        }
      })
    }

    // If no specific file requested, return the full codebase structure
    const fileList = Object.keys(codebaseData.files).map(filePath => ({
      path: filePath,
      size: codebaseData.files[filePath].size,
      mimeType: codebaseData.files[filePath].mime_type,
      contentType: codebaseData.files[filePath].content_type,
      modified: codebaseData.files[filePath].modified
    }))

    // Find README file for quick access
    const readmeFile = Object.keys(codebaseData.files).find(path => 
      path.toLowerCase().includes('readme') && 
      codebaseData.files[path].content_type === 'text'
    )

    return res.status(200).json({
      success: true,
      data: {
        metadata: codebaseData.metadata,
        files: fileList,
        readmeFile: readmeFile || null,
        readmeContent: readmeFile ? codebaseData.files[readmeFile].content : null,
        totalFiles: codebaseData.metadata.total_files,
        totalSize: codebaseData.metadata.total_size
      }
    })

  } catch (error) {
    console.error('Error fetching from Walrus:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

// Helper function to get file extension
const getFileExtension = (filePath: string): string => {
  const lastDot = filePath.lastIndexOf('.')
  return lastDot !== -1 ? filePath.substring(lastDot + 1).toLowerCase() : ''
}

// Helper function to determine if a file is likely code
const isCodeFile = (filePath: string): boolean => {
  const codeExtensions = [
    'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'php',
    'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'sh', 'bash', 'sql', 'json', 'xml',
    'yaml', 'yml', 'toml', 'md', 'txt', 'vue', 'svelte', 'dart', 'r', 'matlab'
  ]
  
  const extension = getFileExtension(filePath)
  return codeExtensions.includes(extension)
}

// Export helper functions for potential use elsewhere
export { getFileExtension, isCodeFile } 