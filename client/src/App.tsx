import { useEffect, useState } from 'react'
import AuthPage from './features/auth/AuthPage'
import { IconBird } from './components/icons'
import HomePage from './features/home/HomePage'
import { storedUser, type User } from './api/auth'
import { kvGet, kvSet } from './lib/blua-local'

const THEME_STORAGE_KEY = 'blue-atmosphere:theme'

function initialDarkMode() {
  return document.documentElement.classList.contains('dark')
}

function App() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [dark, setDark] = useState(initialDarkMode)

  // bootstrap : session + thème depuis IndexedDB (blua-local)
  useEffect(() => {
    Promise.all([storedUser(), kvGet<string>('pref:theme')]).then(([u, theme]) => {
      setUser(u)
      // IndexedDB est asynchrone. La valeur locale appliquée dans index.html
      // est la source de démarrage pour ne pas afficher brièvement le thème clair.
      setDark(theme ? theme === 'dark' : initialDarkMode())
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light')
    } catch {
      // Le thème IndexedDB reste disponible si le stockage synchrone est bloqué.
    }
    void kvSet('pref:theme', dark ? 'dark' : 'light')
  }, [dark, ready])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-night-0">
        <IconBird className="animate-bounce text-4xl text-accent" />
      </div>
    )
  }

  if (!user) {
    return <AuthPage onAuth={setUser} dark={dark} toggleDark={() => setDark(!dark)} />
  }

  return (
    <HomePage
      user={user}
      dark={dark}
      toggleDark={() => setDark(!dark)}
      onLogout={() => setUser(null)}
    />
  )
}

export default App
