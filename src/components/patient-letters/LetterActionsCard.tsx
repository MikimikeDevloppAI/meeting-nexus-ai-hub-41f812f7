
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Download } from "lucide-react";

interface LetterActionsCardProps {
  patientName: string;
  letterContent: string;
  saveLetterLocally: () => void;
  exportAsText: () => void;
  clearForm: () => void;
}

export const LetterActionsCard = ({ 
  patientName, 
  letterContent, 
  saveLetterLocally, 
  exportAsText, 
  clearForm 
}: LetterActionsCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button onClick={saveLetterLocally} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Sauvegarder (JSON)
          </Button>
          <Button onClick={exportAsText} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exporter (TXT)
          </Button>
          <Button onClick={clearForm} variant="outline">
            Nouvelle lettre
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
