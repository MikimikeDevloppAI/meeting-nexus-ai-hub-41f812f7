
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
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
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Separate function to fetch user profile with retry logic
  const fetchUserProfile = async (userId: string, maxRetries = 2): Promise<User | null> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Fetching user profile for ${userId}, attempt ${attempt + 1}`);
        const { data: userProfile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          console.error(`Error fetching user profile (attempt ${attempt + 1}):`, error);
          if (attempt === maxRetries) {
            return null;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }

        if (!userProfile) {
          console.log('No user profile found');
          return null;
        }

        return userProfile as User;
      } catch (error) {
        console.error(`Exception fetching user profile (attempt ${attempt + 1}):`, error);
        if (attempt === maxRetries) {
          return null;
        }
      }
    }
    return null;
  };

  useEffect(() => {
    let mounted = true;

    const checkUser = async () => {
      try {
        console.log("Checking initial auth session...");
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session error:", error);
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        if (session?.user && mounted) {
          console.log("Found existing session for user:", session.user.id);
          
          // Defer profile fetching to avoid blocking
          setTimeout(async () => {
            if (!mounted) return;
            
            const userProfile = await fetchUserProfile(session.user.id);
            
            if (!mounted) return;
            
            if (!userProfile) {
              console.log("Could not fetch user profile, but keeping session");
              // Don't sign out immediately, just set loading to false
              setIsLoading(false);
              return;
            }

            if (!userProfile.approved) {
              console.log("User not approved");
              toast({
                title: "Compte en attente",
                description: "Votre compte attend l'approbation de l'administrateur.",
                variant: "destructive",
              });
              // Don't navigate immediately, let user see the message
              setTimeout(() => {
                navigate("/login");
              }, 2000);
            } else {
              console.log("User approved, setting user state:", userProfile);
              setUser(userProfile);
            }
            setIsLoading(false);
          }, 100);
        } else {
          console.log("No existing session found");
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
        if (mounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    checkUser();

    // Setup auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state changed:", event, session?.user?.id);
        
        if (!mounted) return;
        
        if (event === "SIGNED_IN" && session) {
          // Only update state synchronously, defer API calls
          setTimeout(async () => {
            if (!mounted) return;
            
            const userProfile = await fetchUserProfile(session.user.id);
            
            if (!mounted) return;
            
            if (!userProfile) {
              console.error("Could not fetch user profile after sign in");
              return;
            }
            
            if (!userProfile.approved) {
              toast({
                title: "Compte en attente",
                description: "Votre compte attend l'approbation de l'administrateur.",
                variant: "destructive",
              });
              setTimeout(() => {
                navigate("/login");
              }, 2000);
            } else {
              console.log("Setting authenticated user:", userProfile);
              setUser(userProfile);
              navigate("/assistant");
            }
          }, 100);
        } else if (event === "SIGNED_OUT") {
          console.log("User signed out");
          setUser(null);
          navigate("/login");
        } else if (event === "TOKEN_REFRESHED") {
          console.log("Token refreshed successfully");
          // Don't do anything special, just log
        }
      }
    );

    // Clean up subscription and mounted flag
    return () => {
      mounted = false;
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, [navigate, toast]);

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Let the auth state change handler deal with the rest
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

      // Create user profile with approved=false
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
      navigate("/login");
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
      navigate("/login");
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
