import { useState } from 'react'
import { NextPage } from 'next'
import Head from 'next/head'
import WalrusCodebaseBrowser from '@/components/WalrusCodebaseBrowser'

const CodebaseBrowserDemo: NextPage = () => {
  const [blobId, setBlobId] = useState('')
  const [showBrowser, setShowBrowser] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (blobId.trim()) {
      setShowBrowser(true)
    }
  }

  const handleReset = () => {
    setBlobId('')
    setShowBrowser(false)
  }

  return (
    <>
      <Head>
        <title>Walrus Codebase Browser - GitVault</title>
        <meta name="description" content="Browse and preview codebases stored on Walrus" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              🐋 Walrus Codebase Browser
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Browse and preview codebases stored on Walrus. Enter a blob ID to explore repository files, 
              view README content, and navigate through the codebase structure.
            </p>
          </div>

          {!showBrowser ? (
            <div className="max-w-md mx-auto">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                  Enter Blob ID
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="blobId" className="block text-sm font-medium text-gray-700 mb-2">
                      Walrus Blob ID
                    </label>
                    <input
                      type="text"
                      id="blobId"
                      value={blobId}
                      onChange={(e) => setBlobId(e.target.value)}
                      placeholder="e.g., E7_nNXvFU_3qZVu3OH1yycRG7LZlyn1-UxEDCDDqGGU"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Enter the blob ID of a codebase stored on Walrus
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    Browse Codebase
                  </button>
                </form>
                
                <div className="mt-6 p-4 bg-gray-50 rounded-md">
                  <h3 className="text-sm font-medium text-gray-800 mb-2">Example Features:</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 📁 File browser with search</li>
                    <li>• 📝 README preview</li>
                    <li>• 👀 Code syntax highlighting</li>
                    <li>• 📊 File metadata and sizes</li>
                    <li>• 🔍 Repository information</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleReset}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Back</span>
                  </button>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Blob ID:</span> {blobId}
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>Powered by</span>
                  <span className="font-medium text-blue-600">Walrus</span>
                </div>
              </div>

              <WalrusCodebaseBrowser 
                blobId={blobId}
                className="w-full"
              />
            </div>
          )}
        </div>
      </main>
    </>
  )
}

export default CodebaseBrowserDemo 