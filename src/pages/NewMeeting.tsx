
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useMeetingCreation } from "@/hooks/useMeetingCreation";
import { MeetingForm } from "@/components/meeting/MeetingForm";

const NewMeeting = () => {
  const navigate = useNavigate();
  const { isSubmitting, processingSteps, progress, createMeeting, resetMeetingCreation } = useMeetingCreation();

  // Reset meeting creation state when component mounts
  useEffect(() => {
    resetMeetingCreation();
  }, [resetMeetingCreation]);

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
