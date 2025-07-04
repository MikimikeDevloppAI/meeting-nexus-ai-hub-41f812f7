
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
            className="mt-1 font-mono text-sm"
            style={{
              fontFamily: "'Times New Roman', serif",
              lineHeight: '1.4',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}
          />
          <div className="text-sm text-gray-600 mt-2">
            <p>📝 Le texte sera automatiquement formaté avec des marges A4 lors de l'export PDF</p>
            <p>✂️ Les mots longs seront coupés avec des tirets si nécessaire</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
