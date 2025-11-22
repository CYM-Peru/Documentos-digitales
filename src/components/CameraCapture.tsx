'use client'

import { useState, useRef, useCallback } from 'react'
import Webcam from 'react-webcam'

interface CapturedPhoto {
  file: File
  preview: string
}

interface CameraCaptureProps {
  onCapture: (files: File[]) => void
  onCancel?: () => void
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [showGallery, setShowGallery] = useState(false)

  const videoConstraints = {
    facingMode: facingMode,
  }

  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (imageSrc) {
      setCapturedImage(imageSrc)
    }
  }, [])

  const handleConfirmPhoto = useCallback(async () => {
    if (capturedImage) {
      // Convertir base64 a File
      const blob = await fetch(capturedImage).then((res) => res.blob())
      const file = new File([blob], `invoice-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      })

      const newPhoto: CapturedPhoto = {
        file,
        preview: capturedImage,
      }

      setPhotos((prev) => [...prev, newPhoto])
      setCapturedImage(null)

      // Preguntar si quiere tomar otra
      // En lugar de usar un alert, mostramos opciones en la UI
    }
  }, [capturedImage])

  const handleRetake = useCallback(() => {
    setCapturedImage(null)
  }, [])

  const toggleFacingMode = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
  }, [])

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].preview)
      updated.splice(index, 1)
      return updated
    })
  }, [])

  const handleFinish = useCallback(() => {
    if (photos.length > 0) {
      const files = photos.map((p) => p.file)
      onCapture(files)
      // Limpiar
      photos.forEach((p) => URL.revokeObjectURL(p.preview))
      setPhotos([])
      setCapturedImage(null)
      setShowGallery(false)
    }
  }, [photos, onCapture])

  const handleCancelAll = useCallback(() => {
    // Limpiar todas las previews
    photos.forEach((p) => URL.revokeObjectURL(p.preview))
    setPhotos([])
    setCapturedImage(null)
    setShowGallery(false)
    onCancel?.()
  }, [photos, onCancel])

  const handleCaptureAnother = useCallback(() => {
    setShowGallery(false)
  }, [])

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-black/50 backdrop-blur-sm p-4 flex items-center justify-between">
        <button
          onClick={handleCancelAll}
          className="text-white font-semibold hover:text-gray-300 transition-colors"
        >
          Cancelar
        </button>
        <h2 className="text-white font-bold text-lg">
          {photos.length > 0 ? `${photos.length} foto${photos.length > 1 ? 's' : ''}` : 'Capturar Factura'}
        </h2>
        {photos.length > 0 && !showGallery && !capturedImage && (
          <button
            onClick={() => setShowGallery(true)}
            className="text-white font-semibold hover:text-indigo-300 transition-colors"
          >
            Ver galería
          </button>
        )}
        {(showGallery || capturedImage) && <div className="w-24"></div>}
      </div>

      {/* Main content */}
      <div className="flex-1 relative flex items-center justify-center">
        {showGallery ? (
          // Vista de galería
          <div className="w-full h-full p-4 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden">
                  <img
                    src={photo.preview}
                    alt={`Foto ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {/* Botón eliminar */}
                  <button
                    onClick={() => handleRemovePhoto(index)}
                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {/* Número de foto */}
                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-full">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : capturedImage ? (
          // Preview de foto recién capturada
          <img src={capturedImage} alt="Preview" className="max-w-full max-h-full object-contain" />
        ) : (
          // Vista de cámara en vivo
          <>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="w-full h-full object-cover"
            />
            {/* Overlay con guía */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-full max-w-md aspect-[3/4] border-4 border-white/30 rounded-2xl">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl"></div>
              </div>
            </div>
            <div className="absolute bottom-24 left-0 right-0 text-center pointer-events-none">
              <p className="text-white text-sm font-medium bg-black/50 backdrop-blur-sm inline-block px-4 py-2 rounded-full">
                Centra la factura dentro del recuadro
              </p>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black/50 backdrop-blur-sm p-6 flex items-center justify-center gap-4">
        {showGallery ? (
          // Controles de galería
          <>
            <button
              onClick={handleCaptureAnother}
              className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all backdrop-blur-sm border border-white/20 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Capturar más
            </button>
            <button
              onClick={handleFinish}
              className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Subir {photos.length}
            </button>
          </>
        ) : capturedImage ? (
          // Controles después de captura
          <>
            <button
              onClick={handleRetake}
              className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all backdrop-blur-sm border border-white/20"
            >
              Tomar otra
            </button>
            <button
              onClick={handleConfirmPhoto}
              className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
            >
              ✓ Agregar foto
            </button>
          </>
        ) : (
          // Controles de cámara en vivo
          <>
            <button
              onClick={toggleFacingMode}
              className="p-4 bg-white/10 text-white rounded-full backdrop-blur-sm hover:bg-white/20 transition-all border border-white/20"
              title="Cambiar cámara"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <button
              onClick={handleCapture}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform active:scale-95"
            >
              <div className="w-16 h-16 bg-white border-4 border-gray-800 rounded-full"></div>
            </button>
            {photos.length > 0 && (
              <button
                onClick={() => setShowGallery(true)}
                className="relative p-4 bg-white/10 text-white rounded-full backdrop-blur-sm hover:bg-white/20 transition-all border border-white/20"
                title="Ver fotos capturadas"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {photos.length}
                </span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
