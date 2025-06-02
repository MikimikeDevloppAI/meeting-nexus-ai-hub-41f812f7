
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured } from "@/lib/supabase";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if Supabase is configured
    if (isSupabaseConfigured()) {
      // Redirect to meetings page if Supabase is properly configured
      navigate("/meetings");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent">
      <div className="text-center p-6 max-w-md">
        {isSupabaseConfigured() ? (
          <>
            <div className="mb-6">
              <Logo className="justify-center" />
            </div>
            <div className="animate-pulse h-6 w-36 bg-primary/20 rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement de l'application...</p>
          </>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-lg border border-red-200">
            <div className="mb-6">
              <Logo className="justify-center" />
            </div>
            <div className="flex items-center justify-center text-red-500 mb-4">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-red-600 mb-2">Erreur de configuration Supabase</h2>
            <p className="text-gray-600 mb-4">
              L'application ne peut pas se connecter à Supabase car les variables d'environnement requises sont manquantes.
            </p>
            <div className="bg-gray-100 p-4 rounded text-left text-sm font-mono mb-4">
              <p className="mb-1">VITE_SUPABASE_URL</p>
              <p>VITE_SUPABASE_ANON_KEY</p>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Pour se connecter à Supabase :
            </p>
            <ol className="text-left text-sm text-gray-600 mb-4 space-y-2 list-decimal pl-5">
              <li>Cliquez sur le bouton vert Supabase dans le coin supérieur droit de l'interface Lovable</li>
              <li>Connectez-vous à un projet Supabase existant ou créez-en un nouveau</li>
              <li>Suivez les instructions d'intégration pour configurer votre projet</li>
            </ol>
            <Button 
              className="w-full" 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              Actualiser après connexion
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
