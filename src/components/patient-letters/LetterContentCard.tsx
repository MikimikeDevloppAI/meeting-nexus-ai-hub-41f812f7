
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { calculatePagesNeededPrecise } from "@/utils/letterLayout";

interface LetterContentCardProps {
  letterContent: string;
  setLetterContent: (content: string) => void;
}

export const LetterContentCard = ({ letterContent, setLetterContent }: LetterContentCardProps) => {
  const pagesNeeded = calculatePagesNeededPrecise(letterContent);
  const paragraphCount = letterContent.split('\n\n').filter(p => p.trim()).length;
  const lineCount = letterContent.split('\n').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Contenu de la Lettre</span>
          <div className="flex gap-2 text-sm font-normal">
            <span className={`px-2 py-1 rounded ${pagesNeeded > 1 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
              📄 {pagesNeeded} page{pagesNeeded > 1 ? 's' : ''}
            </span>
            <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">
              ¶ {paragraphCount} paragraphe{paragraphCount > 1 ? 's' : ''}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <Label htmlFor="letter-content">Texte de la lettre</Label>
          <Textarea
            id="letter-content"
            value={letterContent}
            onChange={(e) => setLetterContent(e.target.value)}
            placeholder="Le contenu dicté apparaîtra ici, ou vous pouvez saisir directement...

💡 Conseil : Laissez une ligne vide entre les paragraphes pour un meilleur formatage"
            rows={15}
            className="mt-1 font-mono text-sm"
            style={{
              fontFamily: "'Times New Roman', serif",
              lineHeight: '1.4',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
};
