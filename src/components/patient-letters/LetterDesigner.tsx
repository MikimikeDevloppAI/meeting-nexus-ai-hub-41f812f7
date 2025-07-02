
import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Move, Type, Palette } from "lucide-react";

interface TextPosition {
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

interface LetterDesignerProps {
  templateUrl: string;
  letterContent: string;
  patientName: string;
  onPositionChange: (position: TextPosition) => void;
  textPosition: TextPosition;
}

export const LetterDesigner = ({ 
  templateUrl, 
  letterContent, 
  patientName, 
  onPositionChange, 
  textPosition 
}: LetterDesignerProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    onPositionChange({ ...textPosition, x, y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="h-5 w-5" />
          Designer de lettre
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="fontSize">Taille de police</Label>
              <Input
                id="fontSize"
                type="number"
                min="8"
                max="72"
                value={textPosition.fontSize}
                onChange={(e) => onPositionChange({ 
                  ...textPosition, 
                  fontSize: parseInt(e.target.value) || 12 
                })}
              />
            </div>
            <div>
              <Label htmlFor="textColor">Couleur du texte</Label>
              <Input
                id="textColor"
                type="color"
                value={textPosition.color}
                onChange={(e) => onPositionChange({ 
                  ...textPosition, 
                  color: e.target.value 
                })}
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => onPositionChange({ x: 10, y: 20, fontSize: 12, color: "#000000" })}
              >
                <Move className="h-4 w-4 mr-2" />
                Réinitialiser position
              </Button>
            </div>
          </div>

          {/* Preview Canvas */}
          <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
            <div
              ref={canvasRef}
              className="relative w-full aspect-[210/297] bg-white cursor-move"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* PDF Background */}
              {templateUrl ? (
                <div className="absolute inset-0" style={{ zIndex: 1 }}>
                  <iframe
                    src={`${templateUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&zoom=page-width`}
                    className="w-full h-full border-0 pointer-events-none"
                    style={{ 
                      backgroundColor: 'white',
                      minHeight: '100%'
                    }}
                    onError={() => {
                      console.log('PDF iframe failed to load');
                    }}
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-400">
                  <div className="text-center">
                    <Type className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Uploadez un template pour voir l'aperçu</p>
                  </div>
                </div>
              )}
              
              {/* Overlay pour interaction */}
              <div className="absolute inset-0 bg-transparent" style={{ zIndex: 2 }} />

              {/* Text Overlay */}
              <div
                className="absolute p-2 border border-dashed border-blue-500 bg-blue-50 bg-opacity-90 rounded cursor-move shadow-sm"
                style={{
                  left: `${textPosition.x}%`,
                  top: `${textPosition.y}%`,
                  fontSize: `${Math.max(8, textPosition.fontSize * 0.7)}px`,
                  color: textPosition.color,
                  maxWidth: '80%',
                  minWidth: '200px',
                  zIndex: 3
                }}
                onMouseDown={handleMouseDown}
              >
                <div className="font-bold mb-2">Patient: {patientName}</div>
                <div className="whitespace-pre-wrap">
                  {letterContent.substring(0, 200)}
                  {letterContent.length > 200 && "..."}
                </div>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p>📝 Cliquez et glissez la zone de texte pour la repositionner</p>
            <p>🎨 Ajustez la taille et la couleur du texte avec les contrôles ci-dessus</p>
            {!templateUrl && (
              <p className="text-orange-600">💡 Uploadez un template PDF pour voir l'aperçu</p>
            )}
            {templateUrl && (
              <p className="text-blue-600">ℹ️ L'aperçu PDF est maintenant visible</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
