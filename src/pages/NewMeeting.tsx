
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useSimpleMeetingCreation } from "@/hooks/useSimpleMeetingCreation";
import { SimpleMeetingForm } from "@/components/meeting/SimpleMeetingForm";
import { MeetingPreparation } from "@/components/MeetingPreparation";
import { useAuth } from "@/lib/auth";

const NewMeeting = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { isSubmitting, isComplete, createMeeting, resetMeetingCreation, cleanupOnUnmount } = useSimpleMeetingCreation();

  useEffect(() => {
    if (!isSubmitting) {
      resetMeetingCreation();
    }
    
    return () => {
      cleanupOnUnmount();
    };
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [user, isLoading, navigate]);

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

  if (!user) {
    return null;
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Button
          variant="ghost" 
          onClick={() => navigate("/meetings")}
          className="mb-2"
          disabled={isSubmitting}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour aux Réunions
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Créer une nouvelle réunion</h1>
        <p className="text-muted-foreground">Planifiez et configurez votre réunion</p>
      </div>

      {/* Composant de préparation de réunion */}
      <MeetingPreparation />

      <SimpleMeetingForm
        isSubmitting={isSubmitting}
        isComplete={isComplete}
        onSubmit={createMeeting}
      />
    </div>
  );
};

export default NewMeeting;
