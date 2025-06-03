
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
  const navigate = useNavigate();
  const { toast } = useToast();

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
          // Get user profile with approval status
          const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            console.error("Error fetching user profile:", profileError);
            if (mounted) {
              setUser(null);
              setIsLoading(false);
            }
            return;
          }

          if (!userProfile?.approved) {
            console.log("User not approved, signing out");
            toast({
              title: "Compte en attente",
              description: "Votre compte attend l'approbation de l'administrateur.",
              variant: "destructive",
            });
            await supabase.auth.signOut();
            if (mounted) {
              setUser(null);
              setIsLoading(false);
              navigate("/login");
            }
          } else {
            console.log("User approved, setting user state");
            if (mounted) {
              setUser(userProfile as User);
              setIsLoading(false);
            }
          }
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
      async (event, session) => {
        console.log("Auth state changed:", event, session?.user?.id);
        
        if (!mounted) return;
        
        if (event === "SIGNED_IN" && session) {
          try {
            // Get user profile with approval status
            const { data: userProfile, error } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (error) {
              console.error("Error fetching user profile:", error);
              setUser(null);
              navigate("/login");
            } else {
              if (!userProfile?.approved) {
                toast({
                  title: "Compte en attente",
                  description: "Votre compte attend l'approbation de l'administrateur.",
                  variant: "destructive",
                });
                await supabase.auth.signOut();
                setUser(null);
                navigate("/login");
              } else {
                setUser(userProfile as User);
                navigate("/assistant");
              }
            }
          } catch (error) {
            console.error("Error in auth state change handler:", error);
            setUser(null);
            navigate("/login");
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          navigate("/login");
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

      // Check if user is approved
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) throw profileError;

      if (!userProfile.approved) {
        toast({
          title: "Compte en attente",
          description: "Votre compte attend l'approbation de l'administrateur.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        return;
      }

      toast({
        title: "Connexion réussie !",
        description: "Vous êtes maintenant connecté.",
      });
      navigate("/assistant");
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
