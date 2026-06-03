import { motion } from 'framer-motion'

// Slow rising embers + soft arcane glows. Fixed, behind all content, non-interactive.
const embers = Array.from({ length: 18 }).map((_, i) => ({
  left: (i * 37) % 100,
  size: 2 + (i % 3),
  delay: (i % 9) * 1.6,
  duration: 16 + (i % 6) * 3, // slow
  drift: ((i % 5) - 2) * 30,
}))

export default function EmberBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-vault-bg">
      <motion.div
        className="absolute -top-40 -left-40 w-[34rem] h-[34rem] rounded-full bg-vault-accent/10 blur-3xl"
        animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-48 -right-32 w-[38rem] h-[38rem] rounded-full bg-vault-gold/[0.07] blur-3xl"
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '34px 34px' }}
      />
      {embers.map((e, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-vault-gold/50"
          style={{ left: `${e.left}%`, bottom: -12, width: e.size, height: e.size }}
          animate={{ y: [0, -900], x: [0, e.drift], opacity: [0, 0.9, 0] }}
          transition={{ duration: e.duration, delay: e.delay, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}
