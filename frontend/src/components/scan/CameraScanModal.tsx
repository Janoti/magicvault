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
  const bandRef = useRef<HTMLDivElement>(null)      // the name band (what we OCR)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)                      // prevents overlapping OCR runs
  const autoRef = useRef(!serverOcr)                  // cloud OCR → manual tap (cost); else free auto-loop
  const doneRef = useRef(false)
  const [status, setStatus] = useState<'starting' | 'live' | 'processing' | 'error'>('starting')
  const [auto, setAuto] = useState(!serverOcr)

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

  // Crop the name band from the live video (mapping screen coords → source,
  // accounting for object-cover scaling), upscaled for sharper OCR.
  const bandCanvas = (): HTMLCanvasElement | null => {
    const v = videoRef.current, band = bandRef.current
    if (!v || !v.videoWidth || !band) return null
    const vr = v.getBoundingClientRect(), br = band.getBoundingClientRect()
    const cw = v.clientWidth, ch = v.clientHeight, vw = v.videoWidth, vh = v.videoHeight
    const scale = Math.max(cw / vw, ch / vh)
    const offX = (vw * scale - cw) / 2, offY = (vh * scale - ch) / 2
    const bx = br.left - vr.left, by = br.top - vr.top
    const sx = (bx + offX) / scale, sy = (by + offY) / scale
    const sw = br.width / scale, sh = br.height / scale
    if (sw <= 0 || sh <= 0) return null
    const outW = 1000, outH = Math.max(1, Math.round((sh / sw) * outW))
    const canvas = document.createElement('canvas')
    canvas.width = outW; canvas.height = outH
    canvas.getContext('2d')!.drawImage(v, sx, sy, sw, sh, 0, 0, outW, outH)
    return canvas
  }

  // allowServer: use the cloud OCR (premium, costs money) — only on manual taps,
  // so the free Tesseract auto-loop doesn't rack up API calls.
  const recognize = async (canvas: HTMLCanvasElement, allowServer: boolean): Promise<string> => {
    if (allowServer && serverOcr) {
      try {
        const r = await scanApi.ocr(canvas.toDataURL('image/jpeg', 0.85))
        if (r?.name) return r.name
      } catch { /* fall back to local OCR below */ }
    }
    preprocess(canvas)
    const worker = await getWorker()
    const { data } = await worker.recognize(canvas)
    return cleanName(data?.text || '')
  }

  // One OCR attempt. In auto mode, keep retrying until a name is read.
  const attempt = async (isAuto: boolean) => {
    if (busyRef.current || doneRef.current) return
    const canvas = bandCanvas()
    if (!canvas) { if (isAuto) scheduleAuto(); return }
    busyRef.current = true
    if (!isAuto) setStatus('processing')
    try {
      const name = await recognize(canvas, !isAuto)
      if (name) { finish(name); return }
    } catch { /* ignore, retry/return */ }
    finally { busyRef.current = false }
    if (isAuto) scheduleAuto()
    else setStatus('live')
  }

  const scheduleAuto = () => {
    if (!autoRef.current || doneRef.current) return
    setTimeout(() => autoLoop(), 900)
  }
  const autoLoop = () => { if (autoRef.current && !doneRef.current) attempt(true) }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    autoRef.current = false; setAuto(false); setStatus('processing')
    const img = new Image()
    img.onload = async () => {
      const sw = img.width, sh = img.height * 0.22  // top of the photo = name area
      const canvas = document.createElement('canvas')
      canvas.width = sw; canvas.height = sh
      canvas.getContext('2d')!.drawImage(img, 0, 0, sw, sh, 0, 0, sw, sh)
      try { finish(await recognize(canvas, true)) } catch { setStatus('error') }
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
            <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            {/* Card-shaped guide (vertical, 63:88) so it fits the whole card. */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative h-[58%] max-h-[58%] max-w-[78%] aspect-[63/88] border-2 border-vault-gold/70 rounded-xl">
                {/* Name band at the top of the card — this is what gets OCR'd. */}
                <div ref={bandRef} className="absolute inset-x-0 top-0 h-[16%] border-2 border-vault-gold rounded-t-xl bg-vault-gold/10 flex items-center justify-center">
                  <span className="text-[11px] text-vault-gold bg-black/70 px-2 py-0.5 rounded">{t('scan.alignName')}</span>
                </div>
                {auto && status === 'live' && (
                  <div className="absolute -bottom-7 inset-x-0 flex items-center justify-center gap-2 text-vault-gold text-xs">
                    <RefreshCw size={13} className="animate-spin" /> {t('scan.autoScanning')}
                  </div>
                )}
              </div>
            </div>
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
