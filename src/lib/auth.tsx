
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
  const { toast } = useToast();

  // Fonction pour récupérer le profil utilisateur
  const fetchUserProfile = async (userId: string): Promise<User | null> => {
    try {
      console.log(`Récupération du profil utilisateur pour ${userId}`);
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !userProfile) {
        console.error('Erreur lors de la récupération du profil:', error);
        return null;
      }

      return userProfile as User;
    } catch (error) {
      console.error('Exception lors de la récupération du profil:', error);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log("Vérification de la session d'authentification...");
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Erreur de session:", error);
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        if (session?.user && mounted) {
          console.log("Session existante trouvée pour l'utilisateur:", session.user.id);
          
          const userProfile = await fetchUserProfile(session.user.id);
          
          if (!mounted) return;
          
          if (userProfile) {
            if (!userProfile.approved) {
              console.log("Utilisateur non approuvé");
              setUser(null);
            } else {
              console.log("Utilisateur approuvé, mise à jour de l'état:", userProfile);
              setUser(userProfile);
            }
          }
        } else {
          console.log("Aucune session existante trouvée");
          if (mounted) setUser(null);
        }
      } catch (error) {
        console.error("Erreur lors de la vérification d'authentification:", error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Écouter les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Changement d'état d'authentification:", event);
        
        if (!mounted) return;
        
        if (event === "SIGNED_IN" && session?.user) {
          console.log("Utilisateur connecté, mise à jour du profil");
          const userProfile = await fetchUserProfile(session.user.id);
          
          if (!mounted) return;
          
          if (userProfile?.approved) {
            setUser(userProfile);
          } else {
            setUser(null);
            if (userProfile && !userProfile.approved) {
              toast({
                title: "Compte en attente",
                description: "Votre compte attend l'approbation de l'administrateur.",
                variant: "destructive",
              });
            }
          }
        } else if (event === "SIGNED_OUT") {
          console.log("Utilisateur déconnecté");
          setUser(null);
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [toast]);

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
      console.error("Erreur de connexion:", error);
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
      console.error("Erreur d'inscription:", error);
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
      console.log("Déconnexion de l'utilisateur...");
      await supabase.auth.signOut();
      setUser(null);
      toast({
        title: "Déconnexion",
        description: "Vous avez été déconnecté avec succès.",
      });
    } catch (error: any) {
      console.error("Erreur de déconnexion:", error);
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
