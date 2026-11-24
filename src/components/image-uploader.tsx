'use client'

import { useState } from 'react'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'
import { Camera, Loader2 } from 'lucide-react'

interface ImageUploaderProps {
  folder: 'avatars' | 'portfolio' | 'requests'
  userId: string
  onUploadSuccess: (publicUrl: string) => void
  label?: string
}

export function ImageUploader({
  folder,
  userId,
  onUploadSuccess,
  label = 'Adicionar foto',
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const supabase = createClient()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Escolha um arquivo de imagem (foto).')
      e.target.value = ''
      return
    }

    setIsUploading(true)
    setErrorMsg(null)

    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.25,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: 0.8,
      })

      const fileName = `${userId}/${folder}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('maocerta-media')
        .upload(fileName, compressedFile, {
          contentType: 'image/jpeg',
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('maocerta-media')
        .getPublicUrl(fileName)

      onUploadSuccess(data.publicUrl)
    } catch (err: unknown) {
      console.error(err)
      setErrorMsg('Não foi possível enviar a imagem. Tente novamente.')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
        {isUploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-[#0F4C81]" />
            <span>Otimizando e enviando...</span>
          </>
        ) : (
          <>
            <Camera className="h-4 w-4 text-[#0F4C81]" />
            <span>{label}</span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={isUploading}
          className="hidden"
        />
      </label>
      {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
    </div>
  )
}
