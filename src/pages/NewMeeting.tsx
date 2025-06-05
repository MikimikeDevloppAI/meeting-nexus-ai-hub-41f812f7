
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useMeetingCreation } from "@/hooks/useMeetingCreation";
import { MeetingForm } from "@/components/meeting/MeetingForm";
import { useAuth } from "@/lib/auth";

const NewMeeting = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { isSubmitting, processingSteps, progress, createMeeting, resetMeetingCreation } = useMeetingCreation();

  // Reset meeting creation state when component mounts
  useEffect(() => {
    resetMeetingCreation();
  }, [resetMeetingCreation]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      console.log('[NewMeeting] User not authenticated, redirecting to login');
      navigate("/login");
    }
  }, [user, isLoading, navigate]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Vérification de l'authentification...</p>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user) {
    return null;
  }

  console.log('[NewMeeting] Rendering for authenticated user:', user.id);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/meetings")}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour aux Réunions
        </Button>
        <h1 className="text-2xl font-bold">Créer une nouvelle réunion</h1>
        <p className="text-muted-foreground">
          Remplissez les détails de la réunion et ajoutez des participants
        </p>
      </div>

      <MeetingForm
        isSubmitting={isSubmitting}
        processingSteps={processingSteps}
        progress={progress}
        onSubmit={createMeeting}
      />
    </div>
  );
};

export default NewMeeting;
