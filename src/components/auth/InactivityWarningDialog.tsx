import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

interface InactivityWarningDialogProps {
  isOpen: boolean;
  timeLeft: number;
  onExtendSession: () => void;
}

export const InactivityWarningDialog = ({ 
  isOpen, 
  timeLeft, 
  onExtendSession 
}: InactivityWarningDialogProps) => {
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Session expirée bientôt
          </AlertDialogTitle>
          <AlertDialogDescription>
            Votre session va expirer dans <strong>{formatTime(timeLeft)}</strong> en raison d'inactivité. 
            Cliquez sur "Rester connecté" pour prolonger votre session.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction asChild>
            <Button onClick={onExtendSession} className="w-full">
              Rester connecté
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};