'use client'

interface UploadStatus {
  fileName: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

interface MultiUploadProgressProps {
  files: UploadStatus[]
  currentIndex: number
  onClose?: () => void
}

export default function MultiUploadProgress({
  files,
  currentIndex,
  onClose,
}: MultiUploadProgressProps) {
  const totalFiles = files.length
  const completedFiles = files.filter((f) => f.status === 'success' || f.status === 'error').length
  const progress = (completedFiles / totalFiles) * 100

  const allCompleted = completedFiles === totalFiles

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            {allCompleted ? '✓ Subida Completada' : 'Subiendo Facturas'}
          </h3>
          {allCompleted && onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>{completedFiles} de {totalFiles} completadas</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                allCompleted ? 'bg-green-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Files list */}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {files.map((file, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                file.status === 'success'
                  ? 'bg-green-50 border-green-200'
                  : file.status === 'error'
                  ? 'bg-red-50 border-red-200'
                  : file.status === 'uploading'
                  ? 'bg-indigo-50 border-indigo-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                {file.status === 'success' ? (
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : file.status === 'error' ? (
                  <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : file.status === 'uploading' ? (
                  <svg className="w-5 h-5 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.fileName}
                </p>
                {file.error && (
                  <p className="text-xs text-red-600 mt-1">{file.error}</p>
                )}
                {file.status === 'uploading' && (
                  <p className="text-xs text-indigo-600 mt-1">Procesando...</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action button */}
        {allCompleted && onClose && (
          <button
            onClick={onClose}
            className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
          >
            Cerrar
          </button>
        )}

        {!allCompleted && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Por favor espera mientras se procesan las facturas...
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
