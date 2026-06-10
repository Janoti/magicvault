import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Library, Upload, Coins, LineChart, PieChart, Users, Heart, ArrowLeftRight,
  Compass, ArrowRight, Check, Lightbulb,
} from 'lucide-react'
import PublicPage from '@/components/PublicPage'
import { useSeo } from '@/components/Seo'

// Detailed, task-oriented help. Each section follows the same template:
// "O que é" · "O que dá pra fazer" · "Como fazer" · (exemplo / dica).
// Content is intentionally inline (pt-BR) so it stays rich and easy to edit.
type Section = {
  id: string
  icon: typeof Library
  to: string
  title: string
  what: string
  canDo: string[]
  how: string[]
  example?: string
  tip?: string
}

const SECTIONS: Section[] = [
  {
    id: 'colecao', icon: Library, to: '/collection', title: 'Coleção',
    what: 'É onde ficam todas as suas cartas, com quantidade, condição, versão foil e o valor atual de cada uma (preços do Scryfall, atualizados automaticamente).',
    canDo: [
      'Adicionar cartas por busca, pela câmera (escanear) ou um set inteiro de uma vez',
      'Editar quantidade, condição (NM, LP, …) e foil',
      'Registrar quanto você pagou em cada carta (custo) — é o que habilita o P&L',
      'Importar/exportar em CSV e deixar a coleção pública pra mostrar pra galera',
    ],
    how: [
      'Abra Coleção e clique em adicionar (ou use Escanear pra usar a câmera)',
      'Busque a carta pelo nome e escolha a edição',
      'Ajuste quantidade, condição e foil',
      'Opcional: informe "quanto paguei" pra acompanhar lucro/prejuízo depois',
      'Salvar — o valor atual aparece automático',
    ],
    tip: 'Informar o custo das cartas é o que destrava os números de lucro na tela de P&L.',
  },
  {
    id: 'importar', icon: Upload, to: '/decks', title: 'Importar deck',
    what: 'Cria um deck na sua conta colando a lista exportada de qualquer site — a app detecta o formato sozinha.',
    canDo: [
      'Colar listas do Moxfield, Archidekt, MTG Arena, MTGO, Deckstats, TappedOut ou CSV',
      'Reconhece seções Commander/Sideboard, prefixo "SB:" e anotações de set/foil',
      'Mostra quantas cartas entraram e a contagem por seção',
    ],
    how: [
      'Vá em Decks → Importar',
      'Dê um nome ao deck e escolha o formato',
      'Cole a lista no campo de texto',
      'Clique em Importar — não precisa "limpar" a lista antes',
    ],
    example: 'Commander\n1 Krenko, Mob Boss\n\nDeck\n1 Sol Ring (C21) 263\n30 Mountain\n\nSideboard\n2 Pyroblast',
  },
  {
    id: 'pnl', icon: Coins, to: '/collection/pnl', title: 'Custo $ vs Lucro (P&L)',
    what: 'Compara quanto você PAGOU (custo) com o VALOR ATUAL das cartas. É o seu lucro ou prejuízo "no papel" (não realizado) da coleção.',
    canDo: [
      'Ver custo total investido vs valor atual e o resultado (lucro/prejuízo)',
      'Ver carta a carta quais subiram e quais caíram',
      'Identificar cartas sem preço de mercado (sinalizadas)',
    ],
    how: [
      'Primeiro registre o custo: na Coleção, edite a carta e preencha "quanto paguei" (em USD ou BRL)',
      'Abra Coleção → P&L',
      'Veja o resumo: custo total vs valor atual',
      'Clique no card pra abrir o detalhamento por carta',
    ],
    tip: 'Só entram no cálculo as cartas que têm custo informado — o resto da coleção não atrapalha a conta.',
  },
  {
    id: 'valor', icon: LineChart, to: '/collection/value', title: 'Valor da coleção no tempo',
    what: 'Mostra a evolução do valor total da sua coleção ao longo dos dias, num gráfico.',
    canDo: [
      'Acompanhar se sua coleção valorizou ou desvalorizou',
      'Ver tendências (subidas/quedas) ao longo do tempo',
    ],
    how: [
      'Abra Coleção → Valor',
      'A app tira automaticamente um "snapshot" do valor total uma vez por dia',
      'Acompanhe a curva — quanto mais tempo usando, mais histórico aparece',
    ],
    tip: 'O histórico começa a contar a partir de quando você usa a app; cada dia adiciona um ponto novo no gráfico.',
  },
  {
    id: 'sets', icon: PieChart, to: '/sets', title: 'Conclusão por set',
    what: 'Mostra quanto de cada coleção (set) você já tem, em porcentagem — útil pra quem quer completar coleções.',
    canDo: [
      'Ver a % de conclusão de cada set',
      'Descobrir exatamente quais cartas faltam',
      'Entrar no set e adicionar as faltantes direto à sua coleção',
    ],
    how: [
      'Abra Sets',
      'Veja a barra de conclusão de cada coleção',
      'Entre num set pra ver as cartas que você ainda não tem',
      'Adicione as que faltam pela própria tela do set',
    ],
  },
  {
    id: 'comunidade', icon: Users, to: '/decks-comunidade', title: 'Decks da comunidade',
    what: 'Uma vitrine de decks públicos (puxados do Archidekt) pra você se inspirar e aprender construções.',
    canDo: [
      'Explorar e filtrar decks da comunidade',
      'Abrir e ver a lista completa de cada deck',
      'Importar um deck pra sua conta pra editar ou comparar com a sua coleção',
    ],
    how: [
      'Abra Decks da comunidade',
      'Navegue/filtre e abra um deck que te interessar',
      'Use Importar pra trazer pra sua conta',
      'Depois compare com a sua coleção pra ver o que você já tem e o que falta',
    ],
  },
  {
    id: 'wishlist', icon: Heart, to: '/wishlist', title: 'Lista de desejos (Wishlist)',
    what: 'A lista das cartas que você quer adquirir, com preço-alvo — sua "lista de compras" do Magic.',
    canDo: [
      'Adicionar cartas que você quer conseguir',
      'Definir um preço-alvo e acompanhar o valor atual',
      'Usar a wishlist como referência nas trocas do Mercado',
    ],
    how: [
      'Abra Wishlist',
      'Busque a carta e adicione',
      'Opcional: defina um preço-alvo pra saber quando está num bom valor',
    ],
  },
  {
    id: 'mercado', icon: ArrowLeftRight, to: '/trades', title: 'Mercado (+ Wishlist)',
    what: 'Onde você anuncia cartas pra vender ou trocar e encontra o que outros jogadores estão oferecendo.',
    canDo: [
      'Anunciar uma carta com condição, foil, preço e foto',
      'Aceitar ofertas e, em trocas, pedir cartas específicas em retorno',
      'Demonstrar interesse num anúncio e conversar por mensagem dentro da app',
    ],
    how: [
      'Pra anunciar: Mercado → Anunciar, escolha a carta e defina condição/foil/preço',
      'Se for troca, liste as cartas que você quer receber (use sua Wishlist como referência)',
      'Pra comprar/trocar: ache o anúncio, clique em "Tenho interesse" e combine pela conversa',
    ],
    tip: 'Integração com a Wishlist: a Wishlist guarda o que você procura; no Mercado você pede exatamente essas cartas em troca, sem precisar lembrar de cabeça.',
  },
]

const fadeUp = { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } }

export default function GuidePage() {
  useSeo({
    title: 'Guia — VaultSpell',
    description: 'Como funciona cada recurso do VaultSpell: coleção, importar deck, P&L, valor no tempo, conclusão por set, decks da comunidade, wishlist e mercado.',
    path: '/guia',
  })

  const body = (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-vault-accent bg-vault-accent/10 border border-vault-accent/30 rounded-full px-3 py-1 mb-4">
          <Compass size={13} /> Guia completo
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-vault-gold">Como usar o VaultSpell</h1>
        <p className="text-vault-muted mt-3 max-w-2xl mx-auto">
          O que cada recurso é, o que dá pra fazer e o passo a passo — com exemplos.
        </p>
      </div>

      {/* Mobile quick-jump */}
      <div className="lg:hidden flex gap-2 overflow-x-auto pb-2 mb-6 -mx-6 px-6">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-vault-border bg-vault-card/40 text-vault-muted hover:text-vault-text">
            <s.icon size={13} /> {s.title}
          </a>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        {/* Sticky side nav */}
        <aside className="hidden lg:block">
          <nav className="sticky top-20 space-y-1">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-vault-muted hover:text-vault-text hover:bg-vault-card/60 transition-colors">
                <s.icon size={15} className="text-vault-accent shrink-0" /> {s.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Sections */}
        <div className="space-y-6">
          {SECTIONS.map((s) => (
            <motion.section key={s.id} id={s.id} {...fadeUp} className="surface p-6 scroll-mt-20">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-11 h-11 rounded-xl bg-vault-accent/15 border border-vault-accent/30 flex items-center justify-center shrink-0">
                  <s.icon size={20} className="text-vault-accent" />
                </span>
                <h2 className="font-display text-xl font-bold text-vault-gold">{s.title}</h2>
              </div>

              <p className="text-sm text-vault-text/90 leading-relaxed">{s.what}</p>

              <h3 className="text-xs font-bold uppercase tracking-wide text-vault-muted mt-5 mb-2">O que dá pra fazer</h3>
              <ul className="space-y-2">
                {s.canDo.map((it, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm text-vault-text">
                    <Check size={16} className="text-vault-accent shrink-0 mt-0.5" /><span>{it}</span>
                  </li>
                ))}
              </ul>

              <h3 className="text-xs font-bold uppercase tracking-wide text-vault-muted mt-5 mb-2">Como fazer</h3>
              <ol className="space-y-2">
                {s.how.map((it, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm text-vault-text">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-vault-accent/15 text-vault-accent text-[11px] font-bold flex items-center justify-center mt-0.5">{j + 1}</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ol>

              {s.example && (
                <pre className="mt-4 rounded-lg border border-vault-border bg-vault-bg/60 p-3 text-[11px] font-mono text-vault-muted overflow-x-auto whitespace-pre">{s.example}</pre>
              )}
              {s.tip && (
                <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-vault-gold/30 bg-vault-gold/5 p-3">
                  <Lightbulb size={16} className="text-vault-gold shrink-0 mt-0.5" />
                  <p className="text-xs text-vault-text/90">{s.tip}</p>
                </div>
              )}

              <Link to={s.to} className="mt-5 inline-flex items-center gap-1.5 text-sm text-vault-accent hover:underline">
                Ir para {s.title} <ArrowRight size={14} />
              </Link>
            </motion.section>
          ))}

          <div className="surface p-6 text-center bg-gradient-to-br from-vault-accent/10 to-transparent">
            <p className="text-sm text-vault-muted">Ainda com dúvida? Veja todos os recursos em detalhe.</p>
            <Link to="/features" className="mt-3 inline-flex items-center gap-1.5 text-sm text-vault-gold hover:underline">
              Ver recursos <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )

  return <PublicPage>{body}</PublicPage>
}
