
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface User {
  id: string;
  name: string;
  email: string;
}

interface ParticipantsSectionProps {
  users: User[];
  selectedUserIds: string[];
  onToggleUser: (id: string) => void;
}

export const ParticipantsSection = ({
  users,
  selectedUserIds,
  onToggleUser
}: ParticipantsSectionProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Participants</Label>
      </div>

      {users.length > 0 ? (
        <div className="border rounded-md divide-y max-h-[400px] overflow-y-auto">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center p-4"
            >
              <Checkbox
                id={`user-${user.id}`}
                checked={selectedUserIds.includes(user.id)}
                onCheckedChange={() => onToggleUser(user.id)}
              />
              <label
                htmlFor={`user-${user.id}`}
                className="ml-3 flex flex-col cursor-pointer flex-1"
              >
                <span className="text-sm font-medium">
                  {user.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user.email}
                </span>
              </label>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          <p>Aucun utilisateur disponible</p>
        </div>
      )}
    </div>
  );
};
