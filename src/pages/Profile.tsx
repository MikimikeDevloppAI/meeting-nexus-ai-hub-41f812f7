
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { User } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { validatePassword } from "@/utils/passwordValidation";
import { PasswordStrength } from "@/components/ui/password-strength";

const Profile = () => {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const updateProfile = async () => {
    if (!user) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ name })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Profil mis à jour",
        description: "Votre profil a été mis à jour avec succès",
      });
    } catch (error: any) {
      console.error("Erreur de mise à jour du profil:", error);
      toast({
        title: "Erreur de mise à jour du profil",
        description: error.message || "Veuillez réessayer plus tard",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const changePassword = async () => {
    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      toast({
        title: "Mot de passe trop faible",
        description: passwordValidation.errors.join(", "),
        variant: "destructive",
      });
      return;
    }
    
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      
      toast({
        title: "Mot de passe modifié",
        description: "Votre mot de passe a été mis à jour avec succès",
      });
    } catch (error: any) {
      console.error("Erreur de changement de mot de passe:", error);
      toast({
        title: "Erreur de changement de mot de passe",
        description: error.message || "Veuillez réessayer plus tard",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Profil utilisateur</h1>
          <p className="text-muted-foreground">Chargement de vos informations de profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profil utilisateur</h1>
        <p className="text-muted-foreground">Visualisez et modifiez les informations de votre compte</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informations du profil</CardTitle>
            <CardDescription>Mettez à jour vos informations personnelles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">{user.name}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="name">Nom complet</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                L'adresse e-mail ne peut pas être modifiée
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={updateProfile} 
              disabled={isUpdating || name === user.name}
            >
              {isUpdating ? "Mise à jour..." : "Mettre à jour le profil"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sécurité</CardTitle>
            <CardDescription>Gérez la sécurité de votre compte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Mot de passe actuel</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <PasswordStrength password={newPassword} />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={changePassword}
              disabled={
                isChangingPassword || 
                !currentPassword || 
                !newPassword || 
                !validatePassword(newPassword).isValid
              }
            >
              {isChangingPassword ? "Changement du mot de passe..." : "Changer le mot de passe"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
