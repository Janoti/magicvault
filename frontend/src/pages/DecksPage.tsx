import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { decksApi, cardsApi } from '@/lib/api'
import { useState } from 'react'
import { Plus, Trash2, Swords, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const FORMATS = ['casual', 'commander', 'standard', 'pioneer', 'modern', 'legacy', 'vintage', 'pauper', 'draft']

export default function DecksPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', format: 'casual', description: '' })
  const qc = useQueryClient()
  const { t } = useTranslation()

  const { data: decks = [], isLoading } = useQuery({ queryKey: ['decks'], queryFn: decksApi.list })

  const createMutation = useMutation({
    mutationFn: decksApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['decks'] }); setShowCreate(false); setForm({ name: '', format: 'casual', description: '' }) },
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
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> {t('pages.newDeck')}
        </button>
      </div>

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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck: any, i: number) => (
            <motion.div key={deck.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/decks/${deck.id}`}
                className="block surface p-5 hover:border-vault-accent/40 transition-all group relative overflow-hidden min-h-[130px]">
                {/* Faded card-art cover */}
                {deck.cover ? (
                  <>
                    <img src={deck.cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-[0.13] group-hover:opacity-20 transition-opacity pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-t from-vault-surface via-vault-surface/80 to-transparent pointer-events-none" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-vault-accent/5 to-transparent pointer-events-none" />
                )}
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-display font-bold text-vault-text">{deck.name}</h3>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (confirm(t('pages.confirmDeleteDeck', { name: deck.name }))) deleteMutation.mutate(deck.id) }}
                      className="opacity-0 group-hover:opacity-100 text-vault-muted hover:text-red-400 transition-all p-1.5 rounded-lg hover:bg-red-400/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-vault-accent/20 text-vault-accent">
                      {deck.format}
                    </span>
                  </div>
                  {deck.description && <p className="text-xs text-vault-muted mb-3 line-clamp-2">{deck.description}</p>}
                  <p className="text-xs text-vault-muted flex items-center justify-between">
                    <span>{t('common.cardsCount', { count: deck.card_count })}</span>
                    <ChevronRight size={15} className="text-vault-muted group-hover:text-vault-accent transition-colors" />
                  </p>
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
    </div>
  )
}
