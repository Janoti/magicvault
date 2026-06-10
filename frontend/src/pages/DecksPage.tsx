import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { decksApi, cardsApi } from '@/lib/api'
import { useState, useRef } from 'react'
import { Plus, Trash2, Swords, ChevronRight, Upload, Folder, FolderPlus, Share2, Pencil } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const FORMATS = ['casual', 'commander', 'standard', 'pioneer', 'modern', 'legacy', 'vintage', 'pauper', 'draft']

export default function DecksPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', format: 'casual', description: '' })
  const [showImport, setShowImport] = useState(false)
  const [importForm, setImportForm] = useState({ name: '', format: 'casual', list: '' })
  const [importResult, setImportResult] = useState<any>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const [importFile, setImportFile] = useState('')
  const qc = useQueryClient()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: decks = [], isLoading } = useQuery({ queryKey: ['decks'], queryFn: decksApi.list })
  const { data: folders = [] } = useQuery({ queryKey: ['deck-folders'], queryFn: decksApi.folders })
  const [activeFolder, setActiveFolder] = useState<'all' | 'none' | number>('all')

  const refreshFolders = () => { qc.invalidateQueries({ queryKey: ['deck-folders'] }); qc.invalidateQueries({ queryKey: ['decks'] }) }
  const folderMut = useMutation({ mutationFn: (v: { id: number; folder_id: number }) => decksApi.update(v.id, { folder_id: v.folder_id }), onSuccess: refreshFolders })
  const createFolderMut = useMutation({ mutationFn: (name: string) => decksApi.createFolder({ name }), onSuccess: refreshFolders })
  const renameFolderMut = useMutation({ mutationFn: (v: { id: number; name: string }) => decksApi.updateFolder(v.id, { name: v.name }), onSuccess: refreshFolders })
  const deleteFolderMut = useMutation({ mutationFn: (id: number) => decksApi.deleteFolder(id), onSuccess: () => { setActiveFolder('all'); refreshFolders() } })

  const shareFolder = (f: any) => {
    navigator.clipboard?.writeText(`${window.location.origin}/f/${f.public_token}`)
    alert(t('pages.folderLinkCopied'))
  }
  const visibleDecks = decks.filter((d: any) =>
    activeFolder === 'all' ? true : activeFolder === 'none' ? !d.folder_id : d.folder_id === activeFolder)
  const activeF = typeof activeFolder === 'number' ? folders.find((f: any) => f.id === activeFolder) : null

  const createMutation = useMutation({
    mutationFn: decksApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['decks'] }); setShowCreate(false); setForm({ name: '', format: 'casual', description: '' }) },
  })

  const importMutation = useMutation({
    mutationFn: () => decksApi.import(importForm),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['decks'] })
      if (res.skipped > 0) {
        setImportResult(res)  // show what couldn't be resolved before leaving
      } else {
        setShowImport(false)
        navigate(`/decks/${res.id}`)
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: decksApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['decks'] }),
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-vault-gold">{t('pages.decksTitle')}</h1>
          <p className="text-vault-muted text-sm">{t('pages.decksSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowImport(true); setImportResult(null) }} className="btn-ghost flex items-center gap-2">
            <Upload size={16} /> {t('pages.importDeck')}
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> {t('pages.newDeck')}
          </button>
        </div>
      </div>

      {/* Folder filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {([['all', t('pages.allDecks')], ['none', t('pages.noFolder')]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setActiveFolder(k)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${activeFolder === k ? 'border-vault-accent bg-vault-accent/15 text-vault-accent' : 'border-vault-border text-vault-muted hover:text-vault-text'}`}>
            {label}
          </button>
        ))}
        {folders.map((f: any) => (
          <button key={f.id} onClick={() => setActiveFolder(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5 ${activeFolder === f.id ? 'border-vault-accent bg-vault-accent/15 text-vault-accent' : 'border-vault-border text-vault-muted hover:text-vault-text'}`}>
            <Folder size={13} style={{ color: f.color }} /> {f.name} <span className="opacity-60">{f.deck_count}</span>
          </button>
        ))}
        <button onClick={() => { const n = prompt(t('pages.folderNamePrompt')); if (n?.trim()) createFolderMut.mutate(n.trim()) }}
          className="px-3 py-1.5 rounded-lg text-xs border border-dashed border-vault-border text-vault-muted hover:text-vault-accent hover:border-vault-accent/40 flex items-center gap-1.5">
          <FolderPlus size={14} /> {t('pages.newFolder')}
        </button>
      </div>
      {activeF && (
        <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
          <button onClick={() => shareFolder(activeF)} className="flex items-center gap-1.5 text-vault-accent hover:underline"><Share2 size={13} /> {t('pages.shareFolder')}</button>
          <button onClick={() => { const n = prompt(t('pages.folderNamePrompt'), activeF.name); if (n?.trim()) renameFolderMut.mutate({ id: activeF.id, name: n.trim() }) }} className="flex items-center gap-1.5 text-vault-muted hover:text-vault-text"><Pencil size={13} /> {t('pages.rename')}</button>
          <button onClick={() => { if (confirm(t('pages.confirmDeleteFolder'))) deleteFolderMut.mutate(activeF.id) }} className="flex items-center gap-1.5 text-vault-muted hover:text-red-400"><Trash2 size={13} /> {t('pages.deleteFolder')}</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : decks.length === 0 ? (
        <div className="text-center py-20">
          <Swords size={48} className="mx-auto text-vault-muted mb-4 opacity-50" />
          <p className="text-vault-muted mb-4">{t('pages.decksEmpty')}</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> {t('pages.newDeck')}
          </button>
        </div>
      ) : visibleDecks.length === 0 ? (
        <p className="surface p-10 text-center text-vault-muted">{t('pages.folderEmpty')}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleDecks.map((deck: any, i: number) => (
            <motion.div key={deck.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/decks/${deck.id}`}
                className="block surface overflow-hidden hover:border-vault-accent/40 transition-all group relative">
                {/* Sharp card-art cover banner with the title overlaid */}
                <div className="relative h-28 bg-vault-card overflow-hidden">
                  {deck.cover ? (
                    <img src={deck.cover} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-vault-accent/25 to-vault-card flex items-center justify-center">
                      <Swords size={32} className="text-vault-accent/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-vault-surface via-vault-surface/30 to-black/20 pointer-events-none" />
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (confirm(t('pages.confirmDeleteDeck', { name: deck.name }))) deleteMutation.mutate(deck.id) }}
                    className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 text-white/80 hover:text-red-400 bg-black/40 transition-all p-1.5 rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                  <h3 className="absolute bottom-2 left-3 right-3 font-display font-bold text-white drop-shadow-lg truncate">{deck.name}</h3>
                </div>
                {/* Body */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-vault-accent/20 text-vault-accent">
                      {deck.format}
                    </span>
                  </div>
                  {deck.description && <p className="text-xs text-vault-muted mb-3 line-clamp-2">{deck.description}</p>}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-vault-muted">{t('common.cardsCount', { count: deck.card_count })}</span>
                    {folders.length > 0 && (
                      <select
                        value={deck.folder_id || 0}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                        onChange={(e) => { e.preventDefault(); e.stopPropagation(); folderMut.mutate({ id: deck.id, folder_id: Number(e.target.value) }) }}
                        className="text-[11px] bg-vault-card border border-vault-border rounded px-1.5 py-0.5 text-vault-muted max-w-[45%]">
                        <option value={0}>{t('pages.noFolder')}</option>
                        {folders.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    )}
                    <ChevronRight size={15} className="text-vault-muted group-hover:text-vault-accent transition-colors" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="relative z-10 bg-vault-surface border border-vault-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h2 className="font-display text-xl font-bold text-vault-gold mb-4">{t('modal.newDeck')}</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-vault-muted mb-1.5 block">{t('modal.nameReq')}</label>
                  <input className="input-field" placeholder={t('modal.deckNamePh')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-vault-muted mb-1.5 block">{t('modal.format')}</label>
                  <select className="input-field" value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))}>
                    {FORMATS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-vault-muted mb-1.5 block">{t('modal.description')}</label>
                  <textarea className="input-field resize-none" rows={2} placeholder={t('modal.optional')} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowCreate(false)} className="btn-ghost flex-1">{t('common.cancel')}</button>
                <button onClick={() => createMutation.mutate(form)} disabled={!form.name} className="btn-primary flex-1 disabled:opacity-50">
                  {createMutation.isPending ? t('modal.creating') : t('modal.createDeck')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import deck modal */}
      <AnimatePresence>
        {showImport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowImport(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="relative z-10 bg-vault-surface border border-vault-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[88vh] overflow-y-auto">
              <div className="flex items-center gap-2 mb-1">
                <span className="grid place-items-center w-8 h-8 rounded-lg bg-vault-accent/15 text-vault-accent"><Upload size={16} /></span>
                <h2 className="font-display text-xl font-bold text-vault-gold">{t('modal.importDeckTitle')}</h2>
              </div>
              <p className="text-xs text-vault-muted mb-3">
                {t('modal.importDeckHint2', 'Selecione o arquivo do deck exportado de qualquer site — a gente detecta o formato automaticamente.')}
              </p>

              {/* Supported formats */}
              <div className="rounded-lg border border-vault-border bg-vault-card/40 px-3 py-2.5 mb-4">
                <p className="text-[10px] uppercase tracking-wide text-vault-muted mb-1.5">{t('modal.formatsAccepted', 'Formatos aceitos')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Moxfield', 'Archidekt', 'MTG Arena', 'MTGO', 'Deckstats', 'TappedOut', 'CSV'].map(s => (
                    <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-vault-accent/10 border border-vault-accent/25 text-vault-accent">{s}</span>
                  ))}
                </div>
                <p className="text-[11px] text-vault-muted mt-2">{t('modal.formatsHint', 'Reconhece seções Commander/Sideboard, prefixo SB:, e anotações de set/foil (ex.: (C21) 263 *F*).')}</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-vault-muted mb-1.5 block">{t('modal.nameReq')}</label>
                    <input className="input-field" placeholder={t('modal.deckNamePh')} value={importForm.name} onChange={e => setImportForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-vault-muted mb-1.5 block">{t('modal.format')}</label>
                    <select className="input-field" value={importForm.format} onChange={e => setImportForm(f => ({ ...f, format: e.target.value }))}>
                      {FORMATS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-vault-muted mb-1.5 block">{t('modal.decklistFile', 'Arquivo do deck')}</label>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".txt,.dec,.csv,.text,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = () => {
                        const text = String(reader.result || '')
                        setImportFile(file.name)
                        setImportForm(f => ({ ...f, list: text, name: f.name || file.name.replace(/\.[^.]+$/, '') }))
                      }
                      reader.readAsText(file)
                      e.target.value = ''
                    }}
                  />
                  <button type="button" onClick={() => importFileRef.current?.click()}
                    className="w-full border border-dashed border-vault-border rounded-lg py-7 flex flex-col items-center gap-1.5 text-vault-muted hover:border-vault-accent/40 hover:text-vault-text transition-colors">
                    <Upload size={20} />
                    <span className="text-sm">{importFile || t('modal.selectDeckFile', 'Selecionar arquivo (.txt, .dec, .csv)')}</span>
                    {importFile && <span className="text-[11px] text-vault-accent">✓ arquivo carregado</span>}
                  </button>
                </div>
                {importResult && (
                  <div className="rounded-lg border border-vault-gold/30 bg-vault-gold/5 p-3 text-xs">
                    <p className="text-vault-text mb-1">{t('modal.importDone', { added: importResult.added, skipped: importResult.skipped })}</p>
                    {importResult.counts && (
                      <p className="text-vault-muted mb-1">
                        Main {importResult.counts.main} · Sideboard {importResult.counts.sideboard} · Commander {importResult.counts.commander}
                      </p>
                    )}
                    {importResult.errors?.length > 0 && (
                      <ul className="text-vault-muted list-disc list-inside max-h-24 overflow-y-auto">
                        {importResult.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                      </ul>
                    )}
                    <button onClick={() => { setShowImport(false); navigate(`/decks/${importResult.id}`) }} className="btn-primary w-full mt-3">
                      {t('modal.openDeck')}
                    </button>
                  </div>
                )}
              </div>
              {!importResult && (
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowImport(false)} className="btn-ghost flex-1">{t('common.cancel')}</button>
                  <button onClick={() => importMutation.mutate()} disabled={!importForm.name || !importForm.list.trim() || importMutation.isPending} className="btn-primary flex-1 disabled:opacity-50">
                    {importMutation.isPending ? t('modal.importing') : t('modal.importBtn')}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
