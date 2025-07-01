
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface LetterContentCardProps {
  letterContent: string;
  setLetterContent: (content: string) => void;
}

export const LetterContentCard = ({ letterContent, setLetterContent }: LetterContentCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contenu de la Lettre</CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <Label htmlFor="letter-content">Texte de la lettre</Label>
          <Textarea
            id="letter-content"
            value={letterContent}
            onChange={(e) => setLetterContent(e.target.value)}
            placeholder="Le contenu dicté apparaîtra ici, ou vous pouvez saisir directement..."
            rows={15}
            className="mt-1"
          />
        </div>
      </CardContent>
    </Card>
  );
};
