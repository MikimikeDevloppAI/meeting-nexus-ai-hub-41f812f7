
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface User {
  id: string;
  email: string;
  name: string;
  approved: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionChecked, setSessionChecked] = useState(false);
  const { toast } = useToast();

  // Fonction pour récupérer le profil utilisateur
  const fetchUserProfile = async (userId: string): Promise<User | null> => {
    try {
      console.log(`Fetching user profile for ${userId}`);
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !userProfile) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return userProfile as User;
    } catch (error) {
      console.error('Exception fetching user profile:', error);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      if (sessionChecked) return; // Éviter les re-vérifications

      try {
        console.log("Checking initial auth session...");
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session error:", error);
          if (mounted) {
            setUser(null);
            setIsLoading(false);
            setSessionChecked(true);
          }
          return;
        }

        if (session?.user && mounted) {
          console.log("Found existing session for user:", session.user.id);
          
          const userProfile = await fetchUserProfile(session.user.id);
          
          if (!mounted) return;
          
          if (userProfile) {
            if (!userProfile.approved) {
              console.log("User not approved");
              toast({
                title: "Compte en attente",
                description: "Votre compte attend l'approbation de l'administrateur.",
                variant: "destructive",
              });
              setUser(null);
            } else {
              console.log("User approved, setting user state:", userProfile);
              setUser(userProfile);
            }
          }
        } else {
          console.log("No existing session found");
          if (mounted) setUser(null);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) {
          setIsLoading(false);
          setSessionChecked(true);
        }
      }
    };

    // Vérifier la session une seule fois au démarrage
    if (!sessionChecked) {
      initializeAuth();
    }

    // Écouter les changements d'état d'auth seulement pour les événements importants
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state changed:", event);
        
        if (!mounted) return;
        
        if (event === "SIGNED_IN" && session?.user) {
          // Ne pas naviguer automatiquement, juste mettre à jour l'état
          setTimeout(async () => {
            if (!mounted) return;
            
            const userProfile = await fetchUserProfile(session.user.id);
            
            if (!mounted) return;
            
            if (userProfile?.approved) {
              setUser(userProfile);
            } else {
              setUser(null);
              toast({
                title: "Compte en attente",
                description: "Votre compte attend l'approbation de l'administrateur.",
                variant: "destructive",
              });
            }
          }, 100);
        } else if (event === "SIGNED_OUT") {
          console.log("User signed out");
          setUser(null);
        }
        // Ignorer TOKEN_REFRESHED pour éviter les rechargements
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [sessionChecked, toast]);

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Connexion réussie !",
        description: "Vous êtes maintenant connecté.",
      });
    } catch (error: any) {
      console.error("Sign in error:", error);
      toast({
        title: "Erreur de connexion",
        description: error.message || "Veuillez réessayer",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      // Créer le profil utilisateur
      const { error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: data.user?.id,
            email,
            name,
            approved: false,
          },
        ]);

      if (profileError) throw profileError;

      toast({
        title: "Compte créé",
        description: "Votre compte attend l'approbation de l'administrateur.",
      });
    } catch (error: any) {
      console.error("Sign up error:", error);
      toast({
        title: "Erreur d'inscription",
        description: error.message || "Veuillez réessayer",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      console.log("Signing out user...");
      await supabase.auth.signOut();
      setUser(null);
      toast({
        title: "Déconnexion",
        description: "Vous avez été déconnecté avec succès.",
      });
    } catch (error: any) {
      console.error("Sign out error:", error);
      toast({
        title: "Erreur de déconnexion",
        description: error.message || "Veuillez réessayer",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
