import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import WalrusCodebaseBrowser from '../../components/WalrusCodebaseBrowser'
import JSZip from 'jszip'

const RepositoryDetailsPage = () => {
  const router = useRouter()
  const { name, blobId } = router.query
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    if (router.isReady) {
      setIsLoading(false)
    }
  }, [router.isReady])

  const handleBackToDashboard = () => {
    router.push('/dashboard')
  }

  const handleDownloadRepository = async () => {
    if (!blobId || !name) return
    
    setIsDownloading(true)
    
    try {
      // First, get the codebase metadata and file list
      const metadataResponse = await fetch(`/api/walrus/${blobId}`)
      const metadataResult = await metadataResponse.json()
      
      if (!metadataResult.success) {
        throw new Error('Failed to fetch repository metadata')
      }
      
      const { data: codebaseData } = metadataResult
      
      // Create a new ZIP file
      const zip = new JSZip()
      
      // Add each file to the ZIP
      const downloadPromises = codebaseData.files.map(async (fileInfo: { path: string; size: number; mimeType: string; contentType: string }) => {
        try {
          const fileResponse = await fetch(`/api/walrus/${blobId}?file=${encodeURIComponent(fileInfo.path)}`)
          const fileResult = await fileResponse.json()
          
          if (fileResult.success && fileResult.data) {
            const fileData = fileResult.data
            
            // Add file to ZIP
            if (fileData.contentType === 'text') {
              zip.file(fileInfo.path, fileData.content)
            } else if (fileData.contentType === 'binary') {
              // For binary files, we'll add a placeholder or skip
              zip.file(fileInfo.path + '.placeholder', `Binary file: ${fileInfo.mimeType}\nSize: ${fileInfo.size} bytes`)
            }
          }
        } catch (error) {
          console.error(`Failed to download file ${fileInfo.path}:`, error)
          // Add error placeholder
          zip.file(fileInfo.path + '.error', `Error downloading file: ${error}`)
        }
      })
      
      // Wait for all files to be processed
      await Promise.all(downloadPromises)
      
      // Add README if exists
      if (codebaseData.readmeContent) {
        zip.file('README.md', codebaseData.readmeContent)
      }
      
      // Add metadata file
      const metadataContent = JSON.stringify(codebaseData.metadata, null, 2)
      zip.file('gitvault-metadata.json', metadataContent)
      
      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      
      // Create download link
      const downloadUrl = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${name}-${codebaseData.metadata.commit.substring(0, 7)}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)
      
    } catch (error) {
      console.error('Download failed:', error)
      alert('Failed to download repository. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #ebebeb, #ffffff)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#9dff00' }}></div>
      </div>
    )
  }

  if (!name || !blobId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #ebebeb, #ffffff)' }}>
        <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl border border-gray-300/50 p-12 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg" style={{ backgroundColor: '#9dff00' }}>
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#1b1b1b' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.168 14.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold mb-6" style={{ color: '#1b1b1b', fontFamily: 'VT323, monospace' }}>Repository Not Found</h2>
          <p className="text-lg mb-8" style={{ color: '#1b1b1b', opacity: 0.6 }}>
            The repository you're looking for doesn't exist or the parameters are invalid.
          </p>
          <button
            onClick={handleBackToDashboard}
            className="px-8 py-4 rounded-2xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl text-lg"
            style={{ backgroundColor: '#9dff00', color: '#1b1b1b' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#8ae600'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#9dff00'
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, #ebebeb, #ffffff)' }}>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-300/50 sticky top-0 z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToDashboard}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-200/60 hover:bg-gray-300/80 rounded-xl transition-all duration-200 border border-gray-300/50 hover:border-gray-400/50"
                style={{ color: '#1b1b1b' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Dashboard</span>
              </button>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#9dff00' }}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#1b1b1b' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold" style={{ color: '#1b1b1b', fontFamily: 'VT323, monospace' }}>{name}</h1>
                  <p style={{ color: '#1b1b1b', opacity: 0.6 }}>Repository Details</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleDownloadRepository}
                disabled={isDownloading}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl shadow-md transition-all duration-200 font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#9dff00', color: '#1b1b1b' }}
                onMouseEnter={(e) => {
                  if (!isDownloading) {
                    e.currentTarget.style.backgroundColor = '#8ae600'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#9dff00'
                }}
              >
                {isDownloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent" style={{ borderColor: '#1b1b1b' }}></div>
                    <span className="text-sm">Downloading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm">Download ZIP</span>
                  </>
                )}
              </button>
              <div className="flex items-center space-x-2 px-4 py-2 rounded-xl shadow-md" style={{ backgroundColor: '#9dff00', color: '#1b1b1b' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-semibold">Backed up</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-8">
        <div className="space-y-6">
          {/* Blob ID Info */}
          <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-xl border border-gray-300/50 p-6">
            <div className="flex items-center space-x-3 p-4 rounded-2xl border border-gray-300/50" style={{ backgroundColor: 'rgba(157, 255, 0, 0.1)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#9dff00' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#1b1b1b' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold mb-1" style={{ color: '#1b1b1b' }}>Walrus Blob ID</p>
                <code className="text-sm bg-gray-200 px-3 py-2 rounded-lg font-mono break-all" style={{ color: '#1b1b1b' }}>{blobId}</code>
              </div>
            </div>
          </div>

          {/* Repository Browser */}
          <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-xl border border-gray-300/50 overflow-hidden">
            <div className="p-6">
              <WalrusCodebaseBrowser 
                blobId={blobId as string} 
                className="border-0 shadow-none bg-gray-100/50 backdrop-blur-sm rounded-2xl"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default RepositoryDetailsPage 