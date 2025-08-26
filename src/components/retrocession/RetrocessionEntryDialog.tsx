import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RetrocessionEntryForm } from "./RetrocessionEntryForm";

interface RetrocessionData {
  id?: string;
  doctor: string;
  period_month: string;
  chiffre_affaires: number;
  retrocession: number;
}

interface RetrocessionEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: RetrocessionData | null;
  onSuccess: () => void;
  existingDoctors: string[];
}

export function RetrocessionEntryDialog({
  open,
  onOpenChange,
  editData,
  onSuccess,
  existingDoctors,
}: RetrocessionEntryDialogProps) {
  const isEditing = !!editData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier l'entrée" : "Nouvelle entrée de rétrocession"}
          </DialogTitle>
        </DialogHeader>
        <RetrocessionEntryForm
          editData={editData}
          onSuccess={() => {
            onSuccess();
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
          existingDoctors={existingDoctors}
        />
      </DialogContent>
    </Dialog>
  );
}