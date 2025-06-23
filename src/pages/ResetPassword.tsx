
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrength } from "@/components/ui/password-strength";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validatePassword } from "@/utils/passwordValidation";
import { Eye, EyeOff } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Vérifier la session de récupération
  useEffect(() => {
    const handleAuthSession = async () => {
      try {
        console.log("URL actuelle:", window.location.href);
        console.log("Paramètres URL:", Object.fromEntries(searchParams.entries()));

        // Vérifier d'abord s'il y a une session active
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Erreur de session:", sessionError);
          throw sessionError;
        }

        console.log("Session trouvée:", session);

        if (session?.user) {
          console.log("Session de récupération valide");
          setIsValidSession(true);
        } else {
          // Si pas de session, mais qu'on a les paramètres d'authentification dans l'URL
          const accessToken = searchParams.get('access_token');
          const refreshToken = searchParams.get('refresh_token');
          const type = searchParams.get('type');

          if (accessToken && refreshToken && type === 'recovery') {
            console.log("Paramètres d'authentification trouvés, établissement de la session...");
            
            // Établir la session avec les tokens fournis
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (error) {
              console.error("Erreur lors de l'établissement de la session:", error);
              throw error;
            }

            if (data.session) {
              console.log("Session établie avec succès");
              setIsValidSession(true);
            } else {
              throw new Error("Impossible d'établir la session");
            }
          } else {
            throw new Error("Lien de réinitialisation invalide ou expiré");
          }
        }
      } catch (error) {
        console.error("Erreur lors de la vérification de la session:", error);
        toast({
          title: "Lien invalide",
          description: "Ce lien de réinitialisation est invalide ou a expiré. Veuillez demander un nouveau lien.",
          variant: "destructive",
        });
        navigate("/forgot-password");
      }
    };

    handleAuthSession();
  }, [searchParams, navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidSession) {
      toast({
        title: "Session invalide",
        description: "Veuillez utiliser le lien de réinitialisation reçu par email",
        variant: "destructive",
      });
      return;
    }
    
    const validation = validatePassword(password);
    if (!validation.isValid) {
      toast({
        title: "Mot de passe invalide",
        description: validation.errors[0],
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      toast({
        title: "Mot de passe mis à jour",
        description: "Votre mot de passe a été réinitialisé avec succès",
      });

      navigate("/login");
    } catch (error: any) {
      console.error("Erreur lors de la réinitialisation:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la réinitialisation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Afficher un loader pendant la vérification de la session
  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-accent px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">NexusHub</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Internal Management System</p>
          </div>
          
          <Card className="animate-scale-in">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
              <p className="text-center text-muted-foreground mt-4 text-sm">
                Vérification du lien de réinitialisation...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">NexusHub</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Internal Management System</p>
        </div>
        
        <Card className="animate-scale-in">
          <CardHeader className="text-center">
            <CardTitle className="text-xl sm:text-2xl">Nouveau mot de passe</CardTitle>
            <CardDescription className="text-sm">
              Choisissez un nouveau mot de passe sécurisé
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {password && <PasswordStrength password={password} />}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !password || !confirmPassword}
              >
                {isLoading ? "Mise à jour..." : "Réinitialiser le mot de passe"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
