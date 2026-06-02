import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Library, Swords, BookOpen, Share2, TrendingUp, Upload,
  Sparkles, ArrowRight, Check, Github,
} from 'lucide-react'

const features = [
  { icon: Library, title: 'Sua coleção, organizada', desc: 'Adicione cartas por busca, controle quantidade, condição e foil, com valor em tempo real.' },
  { icon: Swords, title: 'Decks para qualquer formato', desc: 'Monte decks de Commander a Standard, com sideboard e commander.' },
  { icon: BookOpen, title: 'Binders temáticos', desc: 'Organize por tema, cor e set. Veja o valor total de cada binder.' },
  { icon: Share2, title: 'Compartilhe com amigos', desc: 'Adicione amigos e compartilhe coleção, deck ou binder — ou gere um link público.' },
  { icon: TrendingUp, title: 'Preços reais', desc: 'Valores atualizados via Scryfall (TCGplayer / Cardmarket) em cada carta.' },
  { icon: Upload, title: 'Importe e exporte', desc: 'Traga sua coleção via CSV (compatível com grimdeck) e leve seus dados quando quiser.' },
]

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-vault-bg text-vault-text">
      {/* Nav */}
      <header className="border-b border-vault-border/60 backdrop-blur sticky top-0 z-20 bg-vault-bg/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display text-xl font-bold text-vault-gold tracking-wider">⚔ MagicVault</span>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-vault-muted hover:text-vault-text transition-colors">Entrar</Link>
            <Link to="/register" className="btn-primary text-sm">Criar conta grátis</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-vault-accent/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center relative">
          <motion.div {...fadeUp}
            className="inline-flex items-center gap-2 text-xs font-medium text-vault-gold bg-vault-gold/10 border border-vault-gold/30 rounded-full px-3 py-1 mb-6">
            <Sparkles size={13} /> 100% grátis para usar
          </motion.div>
          <motion.h1 {...fadeUp} transition={{ delay: 0.05 }}
            className="font-display text-4xl sm:text-6xl font-bold text-vault-gold leading-tight">
            Gerencie sua coleção de<br />Magic: The Gathering
          </motion.h1>
          <motion.p {...fadeUp} transition={{ delay: 0.1 }}
            className="text-vault-muted text-lg mt-5 max-w-2xl mx-auto">
            Catalogue suas cartas, monte decks e binders, acompanhe preços reais e
            compartilhe com seus amigos — tudo em um só lugar.
          </motion.p>
          <motion.div {...fadeUp} transition={{ delay: 0.15 }}
            className="flex items-center justify-center gap-3 mt-8">
            <Link to="/register" className="btn-primary flex items-center gap-2 text-base px-6 py-3">
              Começar agora <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="btn-ghost text-base px-6 py-3">Já tenho conta</Link>
          </motion.div>
          <motion.p {...fadeUp} transition={{ delay: 0.2 }} className="text-xs text-vault-muted mt-4">
            Sem cartão de crédito • Dados via Scryfall
          </motion.p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div key={f.title} {...fadeUp} transition={{ delay: Math.min(i * 0.05, 0.3) }}
              className="surface p-6 hover:border-vault-accent/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-vault-accent/15 border border-vault-accent/30 flex items-center justify-center mb-4">
                <f.icon size={18} className="text-vault-accent" />
              </div>
              <h3 className="font-medium text-vault-text mb-1.5">{f.title}</h3>
              <p className="text-sm text-vault-muted leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Sharing highlight */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <motion.div {...fadeUp} className="surface p-8 sm:p-12 text-center bg-gradient-to-br from-vault-accent/10 to-transparent">
          <Share2 size={28} className="mx-auto text-vault-accent mb-4" />
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-vault-gold">Feito para compartilhar</h2>
          <p className="text-vault-muted mt-3 max-w-xl mx-auto">
            Gere um link público do seu deck ou coleção e mande pra qualquer pessoa —
            sem precisar de conta pra visualizar. Ou compartilhe direto com seus amigos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-sm text-vault-text">
            <span className="flex items-center gap-2"><Check size={15} className="text-green-400" /> Link público</span>
            <span className="flex items-center gap-2"><Check size={15} className="text-green-400" /> Amigos por username/email</span>
            <span className="flex items-center gap-2"><Check size={15} className="text-green-400" /> Visualização read-only</span>
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <motion.h2 {...fadeUp} className="font-display text-3xl font-bold text-vault-gold">
          Pronto para organizar sua coleção?
        </motion.h2>
        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="mt-6">
          <Link to="/register" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3">
            Criar conta grátis <ArrowRight size={18} />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-vault-border/60">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-vault-muted">
          <span className="font-display text-vault-gold">⚔ MagicVault</span>
          <span>Dados de cartas via Scryfall. Não afiliado à Wizards of the Coast.</span>
          <a href="https://github.com/Janoti/magicvault" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 hover:text-vault-text transition-colors">
            <Github size={15} /> Código aberto
          </a>
        </div>
      </footer>
    </div>
  )
}
