import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { getUserData } from '../supabase/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: Never stay in loading state for more than 2 seconds
    const timer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 2000);

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          const u = { ...session.user, uid: session.user.id };
          setUser(u);
          try {
            const profile = await getUserData(session.user.id);
            if (isMounted) setUserData(profile);
          } catch (pErr) {
            console.error('Error fetching profile in AuthProvider:', pErr);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (isMounted) setLoading(false);
        clearTimeout(timer);
      }
    };

    initAuth();

    // 2. Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        const u = { ...session.user, uid: session.user.id };
        setUser(u);
        try {
          const profile = await getUserData(session.user.id);
          if (isMounted) setUserData(profile);
        } catch (e) {
          console.error('Error updating profile on auth change:', e);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(timer);
      subscription?.unsubscribe();
    };
  }, []);

  const refreshUserData = async () => {
    if (user) {
      try {
        const data = await getUserData(user.id || user.uid);
        setUserData(data);
      } catch (e) {
        console.error('Failed to refresh user data:', e);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
