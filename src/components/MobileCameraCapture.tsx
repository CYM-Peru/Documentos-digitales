'use client'

import { useState, useRef, useCallback } from 'react'

interface CapturedPhoto {
  file: File
  preview: string
}

interface MobileCameraCaptureProps {
  onCapture: (files: File[]) => void
  onCancel?: () => void
}

export default function MobileCameraCapture({
  onCapture,
  onCancel,
}: MobileCameraCaptureProps) {
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Abre la cámara nativa del dispositivo
  const handleOpenCamera = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // Procesa las imágenes capturadas por la cámara nativa
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    if (files.length > 0) {
      const newPhotos: CapturedPhoto[] = files.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }))

      setPhotos((prev) => [...prev, ...newPhotos])
    }

    // Reset input para permitir seleccionar los mismos archivos nuevamente
    e.target.value = ''
  }, [])

  // Confirma y envía todas las fotos
  const handleConfirm = useCallback(() => {
    if (photos.length > 0) {
      const files = photos.map((p) => p.file)
      onCapture(files)
      // Limpiar previews
      photos.forEach((p) => URL.revokeObjectURL(p.preview))
      setPhotos([])
    }
  }, [photos, onCapture])

  // Elimina una foto específica
  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].preview)
      updated.splice(index, 1)
      return updated
    })
  }, [])

  // Cancelar
  const handleCancel = useCallback(() => {
    // Limpiar previews
    photos.forEach((p) => URL.revokeObjectURL(p.preview))
    setPhotos([])
    onCancel?.()
  }, [photos, onCancel])

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Input oculto para cámara nativa - con multiple */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className="bg-black/50 backdrop-blur-sm p-4 flex items-center justify-between">
        <button
          onClick={handleCancel}
          className="text-white font-semibold hover:text-gray-300 transition-colors"
        >
          Cancelar
        </button>
        <h2 className="text-white font-bold text-lg">
          {photos.length > 0 ? `${photos.length} foto${photos.length > 1 ? 's' : ''}` : 'Capturar Facturas'}
        </h2>
        <div className="w-20"></div>
      </div>

      {/* Área de vista/preview */}
      <div className="flex-1 relative flex items-center justify-center overflow-y-auto">
        {photos.length > 0 ? (
          // Galería de fotos capturadas
          <div className="w-full p-4">
            <div className="grid grid-cols-2 gap-3">
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
        ) : (
          // Estado inicial - esperando primera captura
          <div className="flex flex-col items-center justify-center gap-4 text-white p-8">
            <svg
              className="w-20 h-20 text-white/60 animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <p className="text-lg font-medium text-center">
              Toca el botón de cámara
            </p>
            <p className="text-sm text-white/60 text-center">
              Puedes capturar múltiples facturas
            </p>
          </div>
        )}

        {/* Overlay con guía visual (solo si no hay fotos) */}
        {photos.length === 0 && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <div className="w-full max-w-md aspect-[3/4] border-4 border-white/30 rounded-2xl shadow-lg">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl"></div>
              </div>
            </div>
            <div className="absolute bottom-24 left-0 right-0 text-center">
              <p className="text-white text-sm font-medium bg-black/50 backdrop-blur-sm inline-block px-4 py-2 rounded-full">
                Centra la factura dentro del recuadro
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controles inferiores */}
      <div className="bg-black/50 backdrop-blur-sm p-6 flex items-center justify-center gap-4">
        {photos.length > 0 ? (
          // Botones con fotos capturadas
          <>
            <button
              onClick={handleOpenCamera}
              className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all backdrop-blur-sm border border-white/20 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar más
            </button>
            <button
              onClick={handleConfirm}
              className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Subir {photos.length}
            </button>
          </>
        ) : (
          // Botón para abrir cámara por primera vez
          <button
            onClick={handleOpenCamera}
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform active:scale-95"
          >
            <svg
              className="w-10 h-10 text-gray-800"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
