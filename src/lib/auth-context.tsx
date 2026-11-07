import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { fetchProfile, Profile } from './api'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<{ locked?: boolean; message?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle()
      if (error) {
        console.error('Profile load error:', error)
        return
      }
      setProfile(data as Profile | null)
    } catch (err) {
      console.error('Profile load failed:', err)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.id)
    }
  }, [user, loadProfile])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id).finally(() => {
          if (mounted) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      ;(async () => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await loadProfile(session.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      })()
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
      },
    })
    if (error) throw error

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        phone: phone || null,
      })
      if (profileError) {
        console.error('Profile creation error:', profileError)
      }
    }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      await supabase.rpc('record_login_attempt', {
        p_email: email,
        p_success: false,
        p_ip_address: null,
      })
      throw error
    }

    if (data.user) {
      await supabase.rpc('record_login_attempt', {
        p_email: email,
        p_success: true,
        p_ip_address: null,
      })
      await loadProfile(data.user.id)
    }
    return {}
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, signUp, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
