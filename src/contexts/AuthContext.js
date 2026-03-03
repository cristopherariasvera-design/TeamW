import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../config/supabaseClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // NUEVO: Estado para saber si venimos de un correo de recuperación
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    // 1. Verificar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Escuchar cambios de estado (Aquí está el truco)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Evento de Auth:", event); // Para que lo veas en consola

      if (event === 'PASSWORD_RECOVERY') {
        // ACTIVAMOS el modo recuperación
        setIsRecovering(true);
        setUser(session?.user ?? null);
        setLoading(false);
      } else if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id);
        setIsRecovering(false); // Por si acaso, nos aseguramos que esté en false
      } else {
        setUser(null);
        setProfile(null);
        setIsRecovering(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email, password, fullName) => {
    return await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setProfile(null);
      setIsRecovering(false);
    }
    return { error };
  };

    const resetPassword = async (email) => {
      const redirectUrl = __DEV__ 
        ? 'http://localhost:8081/#/ResetPasswordScreen' 
        : 'https://cristopherariasvera-design.github.io/TeamW/#/ResetPasswordScreen';

      console.log("Enviando enlace a:", redirectUrl);

      return await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
    };

  const value = {
    user,
    profile,
    loading,
    isRecovering, // Exportamos el nuevo estado
    setIsRecovering, // Exportamos la función para resetearlo después
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};