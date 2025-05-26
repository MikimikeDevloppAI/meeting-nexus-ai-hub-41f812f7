
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface Participant {
  id: string;
  name: string;
  email: string;
}

interface ParticipantsSectionProps {
  participants: Participant[];
  selectedParticipantIds: string[];
  onToggleParticipant: (id: string) => void;
  onOpenNewParticipantDialog: () => void;
}

export const ParticipantsSection = ({
  participants,
  selectedParticipantIds,
  onToggleParticipant,
  onOpenNewParticipantDialog
}: ParticipantsSectionProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Participants</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenNewParticipantDialog}
          className="text-xs"
        >
          <Plus className="h-3 w-3 mr-1" /> Ajouter
        </Button>
      </div>

      {participants.length > 0 ? (
        <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="flex items-center p-3"
            >
              <Checkbox
                id={`participant-${participant.id}`}
                checked={selectedParticipantIds.includes(participant.id)}
                onCheckedChange={() => onToggleParticipant(participant.id)}
              />
              <label
                htmlFor={`participant-${participant.id}`}
                className="ml-3 flex flex-col cursor-pointer flex-1"
              >
                <span className="text-sm font-medium">
                  {participant.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {participant.email}
                </span>
              </label>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          <p>Aucun participant disponible</p>
          <Button
            variant="link"
            onClick={onOpenNewParticipantDialog}
            className="mt-2"
          >
            Ajouter votre premier participant
          </Button>
        </div>
      )}
    </div>
  );
};
