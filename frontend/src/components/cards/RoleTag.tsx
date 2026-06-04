import { useTranslation } from 'react-i18next'

const ROLE_STYLE: Record<string, string> = {
  ramp: 'bg-green-500/15 text-green-400',
  draw: 'bg-blue-500/15 text-blue-400',
  removal: 'bg-red-500/15 text-red-400',
  wipe: 'bg-orange-500/15 text-orange-400',
  interaction: 'bg-purple-500/15 text-purple-300',
  finisher: 'bg-vault-gold/15 text-vault-gold',
}

export default function RoleTag({ role }: { role?: string | null }) {
  const { t } = useTranslation()
  if (!role || !ROLE_STYLE[role]) return null
  return (
    <span className={`inline-block mr-2 align-middle text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded ${ROLE_STYLE[role]}`}>
      {t(`analysis.cat_${role}`)}
    </span>
  )
}
