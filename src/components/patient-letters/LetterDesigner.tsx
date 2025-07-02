
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
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-gray-50" style={{ zIndex: 1 }}>
                  {/* Top letterhead area */}
                  <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-r from-blue-100 to-blue-50 border-b-2 border-blue-200 flex items-center justify-center">
                    <span className="text-blue-700 font-medium">📄 Template PDF - Zone d'en-tête</span>
                  </div>
                  
                  {/* Center content area */}
                  <div className="absolute inset-x-0 top-20 bottom-20 flex items-center justify-center">
                    <div className="text-center text-blue-600 bg-white bg-opacity-50 p-6 rounded-lg border border-blue-200">
                      <Type className="h-12 w-12 mx-auto mb-3 opacity-70" />
                      <h3 className="font-semibold">Template chargé</h3>
                      <p className="text-sm opacity-80">Positionnez votre texte</p>
                    </div>
                  </div>
                  
                  {/* Bottom area */}
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-r from-gray-50 to-blue-50 border-t border-blue-200 flex items-center justify-center">
                    <span className="text-blue-600 text-xs">Zone de pied de page du template</span>
                  </div>
                  
                  {/* Decorative pattern */}
                  <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <div className="grid grid-cols-12 gap-1 h-full p-4">
                      {Array.from({ length: 48 }, (_, i) => (
                        <div key={i} className="bg-blue-300 rounded-sm h-1"></div>
                      ))}
                    </div>
                  </div>
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
              <p className="text-blue-600">✅ Template chargé - Le PDF sera appliqué lors de l'export final</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
