import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, getMissingConfigDetails } from '../services/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const configured = isSupabaseConfigured();
  const missingConfigs = getMissingConfigDetails();

  // Helper to fetch user's profile from database
  const fetchProfile = async (userId) => {
    if (!supabase || !userId) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at, updated_at')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('Profile fetch error:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.warn('Failed to load user profile:', err);
      return null;
    }
  };

  useEffect(() => {
    let subscription = null;

    if (!configured) {
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          setAuthError(error.message);
        }

        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);
          const userProfile = await fetchProfile(initialSession.user.id);
          setProfile(userProfile);
          setRole(userProfile?.role || 'personal');
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          setRole(null);
        }
      } catch (err) {
        setAuthError(err.message);
      } finally {
        setLoading(false);
      }

      // Listen for auth state changes (login, logout, token refresh)
      const { data: listener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user || null);

        if (currentSession?.user) {
          const userProfile = await fetchProfile(currentSession.user.id);
          setProfile(userProfile);
          setRole(userProfile?.role || 'personal');
        } else {
          setProfile(null);
          setRole(null);
        }
        setLoading(false);
      });

      subscription = listener?.subscription;
    };

    initAuth();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [configured]);

  // Real Email/Password Login
  const signIn = async (email, password) => {
    setAuthError(null);
    if (!configured) {
      throw new Error(
        `Supabase configuration missing (${missingConfigs.join(', ')}). Real authentication requires active credentials.`
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message);
      throw error;
    }

    if (data?.user) {
      const userProfile = await fetchProfile(data.user.id);
      setProfile(userProfile);
      setRole(userProfile?.role || 'personal');
    }

    return data;
  };

  // Real User Registration
  const signUp = async (email, password, fullName) => {
    setAuthError(null);
    if (!configured) {
      throw new Error(
        `Supabase configuration missing (${missingConfigs.join(', ')}). Real registration requires active credentials.`
      );
    }

    // Role cannot be set from client; trigger strictly sets 'personal'
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setAuthError(error.message);
      throw error;
    }

    return data;
  };

  // Logout
  const signOut = async () => {
    setAuthError(null);
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const value = {
    user,
    session,
    profile,
    role,
    loading,
    error: authError,
    isConfigured: configured,
    missingConfigs,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
