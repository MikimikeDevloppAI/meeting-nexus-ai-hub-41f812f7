
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
    const checkSession = async () => {
      try {
        // Récupérer la session actuelle
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log("Session actuelle:", session);
        
        if (error) {
          console.error("Erreur de session:", error);
          throw error;
        }

        if (session?.user) {
          console.log("Session valide trouvée pour la réinitialisation");
          setIsValidSession(true);
        } else {
          // Si pas de session, vérifier si on a des paramètres de récupération
          const token = searchParams.get('token');
          const type = searchParams.get('type');
          
          if (token && type === 'recovery') {
            console.log("Token de récupération détecté, attente de la session...");
            // Attendre un peu que Supabase traite le token
            setTimeout(async () => {
              const { data: { session: newSession } } = await supabase.auth.getSession();
              if (newSession?.user) {
                setIsValidSession(true);
              } else {
                toast({
                  title: "Lien invalide",
                  description: "Ce lien de réinitialisation est invalide ou a expiré",
                  variant: "destructive",
                });
                navigate("/forgot-password");
              }
            }, 1000);
          } else {
            toast({
              title: "Lien invalide",
              description: "Ce lien de réinitialisation est invalide ou a expiré",
              variant: "destructive",
            });
            navigate("/forgot-password");
          }
        }
      } catch (error) {
        console.error("Erreur lors de la vérification de la session:", error);
        toast({
          title: "Erreur",
          description: "Une erreur est survenue lors du traitement du lien",
          variant: "destructive",
        });
        navigate("/forgot-password");
      }
    };

    checkSession();
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

      // Rediriger vers la page de connexion
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
      <div className="min-h-screen flex items-center justify-center bg-accent p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-primary">NexusHub</h1>
            <p className="text-muted-foreground">Internal Management System</p>
          </div>
          
          <Card className="animate-scale-in">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
              <p className="text-center text-muted-foreground mt-4">
                Vérification du lien de réinitialisation...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary">NexusHub</h1>
          <p className="text-muted-foreground">Internal Management System</p>
        </div>
        
        <Card className="animate-scale-in">
          <CardHeader>
            <CardTitle>Nouveau mot de passe</CardTitle>
            <CardDescription>
              Choisissez un nouveau mot de passe sécurisé
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
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
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    required
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
