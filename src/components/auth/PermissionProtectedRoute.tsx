import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserPermissions } from "@/hooks/useUserPermissions";

interface PermissionProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission: string;
  fallbackPath?: string;
}

export const PermissionProtectedRoute = ({ 
  children, 
  requiredPermission, 
  fallbackPath = "/todos" 
}: PermissionProtectedRouteProps) => {
  const { hasPermission, loading } = useUserPermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !hasPermission(requiredPermission)) {
      console.log(`Permission denied for ${requiredPermission}, redirecting to ${fallbackPath}`);
      navigate(fallbackPath, { replace: true });
    }
  }, [loading]); // Ne dépendre que du loading pour éviter les boucles

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Vérification des permissions...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission(requiredPermission)) {
    return null;
  }

  return <>{children}</>;
};