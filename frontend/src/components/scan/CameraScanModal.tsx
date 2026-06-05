import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X, Camera, Upload, RefreshCw } from 'lucide-react'

// Lazily load Tesseract.js from a CDN so it isn't bundled (OCR is rarely used).
function loadTesseract(): Promise<any> {
  const w = window as any
  if (w.Tesseract) return Promise.resolve(w.Tesseract)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'
    s.onload = () => resolve((window as any).Tesseract)
    s.onerror = () => reject(new Error('cdn'))
    document.body.appendChild(s)
  })
}

// Keep the first substantial line (the card name sits at the top of the card).
function cleanName(raw: string): string {
  const lines = (raw || '').split('\n').map(l => l.trim()).filter(Boolean)
  for (const l of lines) {
    const cleaned = l.replace(/[^A-Za-zÀ-ÿ'’,\- ]/g, '').replace(/\s+/g, ' ').trim()
    if (cleaned.replace(/[^A-Za-z]/g, '').length >= 3) return cleaned
  }
  return ''
}

export default function CameraScanModal({ onClose, onText }: { onClose: () => void; onText: (name: string) => void }) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'starting' | 'live' | 'processing' | 'error'>('starting')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
        if (cancelled) { stream.getTracks().forEach(tk => tk.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
        setStatus('live')
      } catch {
        setStatus('error')  // no camera / permission denied → offer file upload
      }
    })()
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(tk => tk.stop()) }
  }, [])

  // Crop the name band (top of the card) from a source, then OCR it.
  const ocrFromCanvas = async (canvas: HTMLCanvasElement) => {
    setStatus('processing'); setProgress(0)
    try {
      const T = await loadTesseract()
      const { data } = await T.recognize(canvas, 'eng', {
        logger: (m: any) => { if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100)) },
      })
      const name = cleanName(data?.text || '')
      streamRef.current?.getTracks().forEach(tk => tk.stop())
      onText(name)
      onClose()
    } catch {
      setStatus('live')
    }
  }

  const capture = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    // Crop the top band where the card name lives (matches the on-screen guide).
    const sx = v.videoWidth * 0.06, sw = v.videoWidth * 0.88
    const sy = v.videoHeight * 0.06, sh = v.videoHeight * 0.16
    const canvas = document.createElement('canvas')
    canvas.width = sw; canvas.height = sh
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh)
    ocrFromCanvas(canvas)
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    const img = new Image()
    img.onload = () => {
      // Upload path: OCR the top ~22% of the photo (name area).
      const sw = img.width, sh = img.height * 0.22
      const canvas = document.createElement('canvas')
      canvas.width = sw; canvas.height = sh
      canvas.getContext('2d')!.drawImage(img, 0, 0, sw, sh, 0, 0, sw, sh)
      ocrFromCanvas(canvas)
    }
    img.src = URL.createObjectURL(file)
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="font-display font-bold flex items-center gap-2"><Camera size={18} /> {t('scan.cameraTitle')}</span>
        <button onClick={onClose} className="text-white/80 hover:text-white"><X size={22} /></button>
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {status === 'error' ? (
          <div className="text-center text-white/80 px-6">
            <p className="mb-4">{t('scan.cameraError')}</p>
            <button onClick={() => fileRef.current?.click()} className="btn-primary inline-flex items-center gap-2">
              <Upload size={16} /> {t('scan.uploadPhoto')}
            </button>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="max-h-full max-w-full" />
            {/* Name-alignment guide band */}
            {status === 'live' && (
              <div className="absolute inset-x-[6%] top-[6%] h-[16%] border-2 border-vault-gold/80 rounded-lg pointer-events-none flex items-start justify-center">
                <span className="text-[11px] text-vault-gold bg-black/60 px-2 py-0.5 rounded-b">{t('scan.alignName')}</span>
              </div>
            )}
            {status === 'processing' && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white gap-3">
                <RefreshCw size={28} className="animate-spin" />
                <p>{t('scan.reading')} {progress > 0 ? `${progress}%` : ''}</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-4 py-5 flex items-center justify-center gap-4">
        <button onClick={() => fileRef.current?.click()} className="text-white/80 hover:text-white p-3" title={t('scan.uploadPhoto')}>
          <Upload size={22} />
        </button>
        <button
          onClick={capture}
          disabled={status !== 'live'}
          className="w-16 h-16 rounded-full bg-white disabled:opacity-40 border-4 border-white/40 active:scale-95 transition-transform"
          aria-label={t('scan.capture')}
        />
        <div className="w-[46px]" />
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
    </div>,
    document.body,
  )
}
