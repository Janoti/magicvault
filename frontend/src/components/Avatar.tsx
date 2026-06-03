export default function Avatar({ value, size = 36 }: { value?: string | null; size?: number }) {
  if (value?.startsWith('data:')) {
    return <img src={value} alt="" className="rounded-full object-cover border border-vault-accent/40" style={{ width: size, height: size }} />
  }
  return (
    <div
      className="rounded-full bg-vault-accent/15 border border-vault-accent/30 flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
    >
      {value || '🙂'}
    </div>
  )
}
