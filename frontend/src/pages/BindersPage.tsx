import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bindersApi } from '@/lib/api'
import { Link } from 'react-router-dom'
import { Plus, BookOpen, Trash2, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const ICONS = ['book', 'star', 'fire', 'dragon', 'castle', 'sword', 'shield', 'gem', 'crown', 'wolf']
const COLORS = ['#6c5ce7', '#00cec9', '#fd79a8', '#e17055', '#55efc4', '#fdcb6e', '#74b9ff', '#a29bfe']

export default function BindersPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', color: '#6c5ce7', icon: 'book', is_public: false })
  const qc = useQueryClient()
  const { t } = useTranslation()

  const { data: binders = [], isLoading } = useQuery({
    queryKey: ['binders'],
    queryFn: bindersApi.list,
  })

  const createMutation = useMutation({
    mutationFn: bindersApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['binders'] })
      setShowCreate(false)
      setForm({ name: '', description: '', color: '#6c5ce7', icon: 'book', is_public: false })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: bindersApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['binders'] }),
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-vault-gold">{t('pages.bindersTitle')}</h1>
          <p className="text-vault-muted text-sm mt-0.5">{t('pages.bindersSubtitle')}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> {t('pages.newBinder')}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : binders.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen size={48} className="mx-auto text-vault-muted mb-4 opacity-50" />
          <p className="text-vault-muted mb-4">{t('pages.bindersEmpty')}</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> {t('pages.newBinder')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {binders.map((binder: any, i: number) => (
              <motion.div
                key={binder.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group"
              >
                <div
                  className="surface p-5 hover:border-vault-accent/50 transition-all cursor-pointer relative"
                  style={{ borderLeftColor: binder.color, borderLeftWidth: 3 }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: binder.color + '20', borderColor: binder.color + '40', border: '1px solid' }}
                    >
                      📚
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => deleteMutation.mutate(binder.id)}
                        className="p-1.5 rounded-lg text-vault-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <Link to={`/binders/${binder.id}`}>
                    <h3 className="font-display font-bold text-vault-text mb-1">{binder.name}</h3>
                    {binder.description && (
                      <p className="text-xs text-vault-muted mb-3 line-clamp-2">{binder.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-vault-muted">
                        <span className="font-mono font-bold text-vault-accent">{binder.card_count}</span> cartas
                      </span>
                      <ChevronRight size={14} className="text-vault-muted" />
                    </div>
                  </Link>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowCreate(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative z-10 bg-vault-surface border border-vault-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <h2 className="font-display text-xl font-bold text-vault-gold mb-4">{t('modal.newBinder')}</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-vault-muted mb-1.5 block">{t('modal.nameReq')}</label>
                  <input
                    className="input-field"
                    placeholder={t('modal.binderNamePh')}
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-vault-muted mb-1.5 block">{t('modal.description')}</label>
                  <textarea
                    className="input-field resize-none"
                    rows={2}
                    placeholder={t('modal.descPh')}
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-vault-muted mb-1.5 block">{t('modal.binderColor')}</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setForm(f => ({ ...f, color }))}
                        className="w-7 h-7 rounded-full border-2 transition-all"
                        style={{
                          backgroundColor: color,
                          borderColor: form.color === color ? 'white' : color,
                          transform: form.color === color ? 'scale(1.25)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowCreate(false)} className="btn-ghost flex-1">{t('common.cancel')}</button>
                <button
                  onClick={() => createMutation.mutate(form)}
                  disabled={!form.name || createMutation.isPending}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {createMutation.isPending ? t('modal.creating') : t('modal.createBinder')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
