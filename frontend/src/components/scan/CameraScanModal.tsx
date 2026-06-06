import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X, Camera, Upload, RefreshCw } from 'lucide-react'
import { scanApi } from '@/lib/api'

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

// A reusable worker tuned for a single line of card-name text (much more
// accurate than the default full-page model on stylised card fonts).
function getWorker(): Promise<any> {
  const w = window as any
  if (w.__vsOcrWorker) return w.__vsOcrWorker
  w.__vsOcrWorker = (async () => {
    const T = await loadTesseract()
    const worker = await T.createWorker('eng')
    await worker.setParameters({
      tessedit_pageseg_mode: '7',  // treat the image as a single text line
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ,'-",
    })
    return worker
  })()
  return w.__vsOcrWorker
}

// Boost legibility for OCR: grayscale + contrast, and flip light-on-dark names
// (black-bordered cards) so the text is always dark on a light background.
function preprocess(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  let sum = 0
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = d[i + 1] = d[i + 2] = g
    sum += g
  }
  const mean = sum / (d.length / 4)
  const invert = mean < 115  // mostly dark → light text; invert it
  for (let i = 0; i < d.length; i += 4) {
    let v = d[i]
    if (invert) v = 255 - v
    v = (v - 128) * 1.7 + 128  // stretch contrast
    v = v < 0 ? 0 : v > 255 ? 255 : v
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
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

export default function CameraScanModal({ onClose, onText, serverOcr = false }: { onClose: () => void; onText: (name: string) => void; serverOcr?: boolean }) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)     // the card guide (what we OCR)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)                      // prevents overlapping OCR runs
  const autoRef = useRef(true)
  const doneRef = useRef(false)
  const [status, setStatus] = useState<'starting' | 'live' | 'processing' | 'error'>('starting')
  const [auto, setAuto] = useState(true)
  const [frame, setFrame] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  // Size the card guide in pixels (fits within both screen dimensions, 63:88).
  const measure = () => {
    const v = videoRef.current
    if (!v || !v.clientHeight) return
    const h = Math.min(v.clientHeight * 0.6, v.clientWidth * 0.82 * 88 / 63)
    setFrame({ h, w: h * 63 / 88 })
  }
  useEffect(() => {
    measure(); window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const finish = (name: string) => {
    doneRef.current = true
    autoRef.current = false
    streamRef.current?.getTracks().forEach(tk => tk.stop())
    onText(name)
    onClose()
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
        if (cancelled) { stream.getTracks().forEach(tk => tk.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
        setStatus('live')
        if (autoRef.current) setTimeout(() => autoLoop(), 800)
      } catch {
        setStatus('error')  // no camera / permission denied → offer file upload
      }
    })()
    return () => { cancelled = true; autoRef.current = false; streamRef.current?.getTracks().forEach(tk => tk.stop()) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Map an on-screen element's rect to source-video coordinates (the video uses
  // object-cover, so the source is scaled and centre-cropped).
  const sourceRect = (el: HTMLElement | null) => {
    const v = videoRef.current
    if (!v || !v.videoWidth || !el) return null
    const vr = v.getBoundingClientRect(), er = el.getBoundingClientRect()
    const cw = v.clientWidth, ch = v.clientHeight, vw = v.videoWidth, vh = v.videoHeight
    const scale = Math.max(cw / vw, ch / vh)
    const offX = (vw * scale - cw) / 2, offY = (vh * scale - ch) / 2
    const sx = (er.left - vr.left + offX) / scale, sy = (er.top - vr.top + offY) / scale
    const sw = er.width / scale, sh = er.height / scale
    return sw > 0 && sh > 0 ? { sx, sy, sw, sh } : null
  }
  const cropCanvas = (r: { sx: number; sy: number; sw: number; sh: number }, outW: number) => {
    const v = videoRef.current!
    const outH = Math.max(1, Math.round((r.sh / r.sw) * outW))
    const c = document.createElement('canvas')
    c.width = outW; c.height = outH
    c.getContext('2d')!.drawImage(v, r.sx, r.sy, r.sw, r.sh, 0, 0, outW, outH)
    return c
  }

  // Cloud OCR reads the whole card (very tolerant of framing); the free Tesseract
  // fallback reads just the name band (top of the card).
  const recognize = async (): Promise<string> => {
    const fr = sourceRect(frameRef.current)
    if (!fr) return ''
    if (serverOcr) {
      try {
        const c = cropCanvas(fr, 1200)
        const r = await scanApi.ocr(c.toDataURL('image/jpeg', 0.85))
        if (r?.name) return r.name
      } catch { /* fall back to local OCR */ }
    }
    const band = { sx: fr.sx, sy: fr.sy, sw: fr.sw, sh: fr.sh * 0.15 }
    const c2 = cropCanvas(band, 1000)
    preprocess(c2)
    const worker = await getWorker()
    const { data } = await worker.recognize(c2)
    return cleanName(data?.text || '')
  }

  // One OCR attempt. In auto mode, keep retrying until a name is read.
  const attempt = async (isAuto: boolean) => {
    if (busyRef.current || doneRef.current) return
    if (!frameRef.current || !videoRef.current?.videoWidth) { if (isAuto) scheduleAuto(); return }
    busyRef.current = true
    if (!isAuto) setStatus('processing')
    try {
      const name = await recognize()
      if (name) { finish(name); return }
    } catch { /* ignore, retry/return */ }
    finally { busyRef.current = false }
    if (isAuto) scheduleAuto()
    else setStatus('live')
  }

  const scheduleAuto = () => {
    if (!autoRef.current || doneRef.current) return
    // Pace the cloud OCR loop a bit slower to bound API calls.
    setTimeout(() => autoLoop(), serverOcr ? 1600 : 900)
  }
  const autoLoop = () => { if (autoRef.current && !doneRef.current) attempt(true) }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    autoRef.current = false; setAuto(false); setStatus('processing')
    const img = new Image()
    img.onload = async () => {
      try {
        if (serverOcr) {
          // Vision reads the whole photo and returns the name.
          const c = document.createElement('canvas')
          c.width = img.width; c.height = img.height
          c.getContext('2d')!.drawImage(img, 0, 0)
          const r = await scanApi.ocr(c.toDataURL('image/jpeg', 0.85))
          if (r?.name) { finish(r.name); return }
        }
        // Tesseract on the top of the photo (name area).
        const sw = img.width, sh = img.height * 0.22
        const c2 = document.createElement('canvas')
        c2.width = sw; c2.height = sh
        c2.getContext('2d')!.drawImage(img, 0, 0, sw, sh, 0, 0, sw, sh)
        preprocess(c2)
        const worker = await getWorker()
        const { data } = await worker.recognize(c2)
        finish(cleanName(data?.text || ''))
      } catch { setStatus('error') }
    }
    img.src = URL.createObjectURL(file)
  }

  const toggleAuto = () => {
    const next = !auto
    setAuto(next); autoRef.current = next
    if (next) autoLoop()
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
            <video ref={videoRef} playsInline muted onLoadedMetadata={measure} onPlaying={measure} className="absolute inset-0 w-full h-full object-cover" />
            {/* Card-shaped guide (vertical, 63:88) so it fits the whole card. */}
            {frame.h > 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div ref={frameRef} className="relative border-2 border-vault-gold/70 rounded-xl" style={{ width: `${frame.w}px`, height: `${frame.h}px` }}>
                  {/* Name band hint (top of the card). The whole frame is read. */}
                  <div className="absolute inset-x-0 top-0 h-[15%] border-b-2 border-vault-gold/60 bg-vault-gold/10 flex items-center justify-center">
                    <span className="text-[11px] text-vault-gold bg-black/70 px-2 py-0.5 rounded">{t('scan.alignName')}</span>
                  </div>
                  {auto && status === 'live' && (
                    <div className="absolute -bottom-7 inset-x-0 flex items-center justify-center gap-2 text-vault-gold text-xs">
                      <RefreshCw size={13} className="animate-spin" /> {t('scan.autoScanning')}
                    </div>
                  )}
                </div>
              </div>
            )}
            {status === 'processing' && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white gap-3">
                <RefreshCw size={28} className="animate-spin" />
                <p>{t('scan.reading')}</p>
              </div>
            )}
            <p className="absolute inset-x-0 bottom-24 text-center text-white/80 text-xs pointer-events-none px-6">{t('scan.cameraHint')}</p>
          </>
        )}
      </div>

      <div className="px-4 py-5 flex items-center justify-center gap-6">
        <button onClick={() => fileRef.current?.click()} className="text-white/80 hover:text-white p-3" title={t('scan.uploadPhoto')}>
          <Upload size={22} />
        </button>
        <button
          onClick={() => attempt(false)}
          disabled={status !== 'live'}
          className="w-16 h-16 rounded-full bg-white disabled:opacity-40 border-4 border-white/40 active:scale-95 transition-transform"
          aria-label={t('scan.capture')}
        />
        <button
          onClick={toggleAuto}
          className={`px-3 py-2 rounded-lg text-xs font-medium border ${auto ? 'border-vault-gold bg-vault-gold/20 text-vault-gold' : 'border-white/30 text-white/80'}`}
        >
          {t('scan.auto')}
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
    </div>,
    document.body,
  )
}
