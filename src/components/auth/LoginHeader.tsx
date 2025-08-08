
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AuthBrand } from "@/components/auth/AuthBrand";

export const LoginHeader = ({ title = "Connexion", description }: { title?: string; description?: string }) => {
  return (
    <>
      <AuthBrand />
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{title}</CardTitle>
        {(description || title === "Connexion") && (
          <CardDescription>
            {description ?? "Entrez vos identifiants pour accéder à votre compte"}
          </CardDescription>
        )}
      </CardHeader>
    </>
  );
};
