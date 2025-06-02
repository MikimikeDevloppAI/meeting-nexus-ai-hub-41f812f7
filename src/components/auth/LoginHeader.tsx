
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/Logo";

export const LoginHeader = () => {
  return (
    <>
      <div className="mb-8 text-center">
        <Logo className="justify-center mb-4" />
        <p className="text-muted-foreground">Plateforme intelligente pour cabinet d'ophtalmologie</p>
      </div>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Connexion</CardTitle>
        <CardDescription>
          Entrez vos identifiants pour accéder à votre compte
        </CardDescription>
      </CardHeader>
    </>
  );
};
