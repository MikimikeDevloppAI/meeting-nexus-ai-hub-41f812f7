
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
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Get user profile with approval status
          const { data: userProfile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (error) {
            console.error("Error fetching user profile:", error);
            setUser(null);
            return; // Don't navigate yet, let the app handle routing
          } else {
            if (!userProfile?.approved) {
              toast({
                title: "Account pending approval",
                description: "Your account is waiting for admin approval.",
                variant: "destructive",
              });
              await supabase.auth.signOut();
              setUser(null);
              navigate("/login");
            } else {
              setUser(userProfile as User);
            }
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();

    // Setup auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event, session?.user?.id);
        
        if (event === "SIGNED_IN" && session) {
          // Delay fetching user profile to avoid potential deadlocks
          setTimeout(async () => {
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
                    title: "Account pending approval",
                    description: "Your account is waiting for admin approval.",
                    variant: "destructive",
                  });
                  await supabase.auth.signOut();
                  setUser(null);
                  navigate("/login");
                } else {
                  setUser(userProfile as User);
                  // Explicitly navigate to meetings page on sign in
                  navigate("/meetings");
                }
              }
            } catch (error) {
              console.error("Error in auth state change handler:", error);
            }
          }, 0);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          navigate("/login");
        }
      }
    );

    // Clean up subscription
    return () => {
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
          title: "Account pending approval",
          description: "Your account is waiting for admin approval.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });
      navigate("/meetings");
    } catch (error: any) {
      console.error("Sign in error:", error);
      toast({
        title: "Error signing in",
        description: error.message || "Please try again",
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
        title: "Account created",
        description: "Your account is pending admin approval.",
      });
      navigate("/login");
    } catch (error: any) {
      console.error("Sign up error:", error);
      toast({
        title: "Error signing up",
        description: error.message || "Please try again",
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
        title: "Signed out",
        description: "You've been successfully signed out.",
      });
      navigate("/login");
    } catch (error: any) {
      console.error("Sign out error:", error);
      toast({
        title: "Error signing out",
        description: error.message || "Please try again",
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
