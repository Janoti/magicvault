import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

// Landing spot for social login. The backend redirects here with the freshly
// issued JWT in the URL fragment: /oauth/callback#token=...&new=1&needs_email=1
// We persist it, load the user, then route into the app.
export default function OAuthCallbackPage() {
  const navigate = useNavigate()
  const loginWithToken = useAuthStore((s) => s.loginWithToken)
  const [error, setError] = useState('')
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const token = params.get('token')
    const needsEmail = params.get('needs_email') === '1'
    if (!token) {
      setError('Login não retornou um token válido.')
      return
    }
    loginWithToken(token)
      .then(() => navigate(needsEmail ? '/account?confirm_email=1' : '/collection', { replace: true }))
      .catch(() => setError('Não foi possível concluir o login.'))
  }, [loginWithToken, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-vault-bg">
      {error ? (
        <div className="text-center">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button onClick={() => navigate('/login', { replace: true })} className="btn-primary px-5 py-2">
            Voltar ao login
          </button>
        </div>
      ) : (
        <div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  )
}
