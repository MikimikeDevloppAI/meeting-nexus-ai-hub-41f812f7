
import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Move, Type, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  console.log('🎯 LetterDesigner rendered with templateUrl:', templateUrl);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [isConverting, setIsConverting] = useState(false);
  const [conversionError, setConversionError] = useState(false);
  
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

  // Convertir le PDF en image quand le template change
  React.useEffect(() => {
    console.log('🔍 LetterDesigner useEffect triggered');
    console.log('📄 templateUrl:', templateUrl);
    console.log('📄 templateUrl type:', typeof templateUrl);
    console.log('📄 templateUrl length:', templateUrl?.length);
    console.log('🖼️ current backgroundImage:', backgroundImage);
    console.log('🖼️ backgroundImage type:', typeof backgroundImage);
    console.log('🖼️ backgroundImage length:', backgroundImage?.length);
    console.log('🔄 Comparison templateUrl !== backgroundImage:', templateUrl !== backgroundImage);
    console.log('✅ Condition templateUrl && templateUrl !== backgroundImage:', templateUrl && templateUrl !== backgroundImage);
    
    if (templateUrl && templateUrl !== backgroundImage) {
      console.log('✅ Starting conversion for new template');
      convertPdfToImageLocal(templateUrl);
    } else if (!templateUrl) {
      console.log('🗑️ No template, clearing background');
      setBackgroundImage("");
      setConversionError(false);
    } else {
      console.log('⏭️ Template same as background, skipping conversion');
    }
  }, [templateUrl, backgroundImage]);

  const convertPdfToImageLocal = async (pdfUrl: string) => {
    console.log('🚀 convertPdfToImageLocal called with:', pdfUrl);
    setIsConverting(true);
    setConversionError(false);
    
    try {
      console.log('🔄 Converting PDF to image using Supabase edge function...');
      
      const { data, error } = await supabase.functions.invoke('convert-pdf-to-image', {
        body: { pdfUrl }
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw error;
      }

      if (!data.success) {
        console.error('❌ Conversion failed:', data.error);
        throw new Error(data.error);
      }

      console.log('✅ PDF converted successfully, setting background image');
      console.log('🖼️ Image URL:', data.imageUrl);
      setBackgroundImage(data.imageUrl);
    } catch (error) {
      console.error('❌ Exception during PDF conversion:', error);
      setConversionError(true);
    } finally {
      setIsConverting(false);
    }
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
            <div className="pdf-container relative w-full max-w-[794px] mx-auto bg-white">
              {/* PDF Background Image */}
              {backgroundImage ? (
                <img 
                  src={backgroundImage} 
                  alt="PDF Template"
                  className="pdf-background w-full block"
                  style={{ maxHeight: '1123px' }} // A4 height at 96dpi
                />
              ) : templateUrl ? (
                <div className="w-full aspect-[210/297] flex items-center justify-center bg-gray-50">
                  {isConverting ? (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-blue-600 font-medium">Conversion du PDF en cours...</p>
                      <p className="text-sm text-blue-500">Veuillez patienter</p>
                    </div>
                  ) : conversionError ? (
                    <div className="text-center text-orange-600">
                      <Type className="h-12 w-12 mx-auto mb-2" />
                      <p className="font-medium">Conversion impossible</p>
                      <p className="text-sm">Le template sera utilisé lors de l'export</p>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      <Type className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Préparation du template...</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full aspect-[210/297] flex items-center justify-center bg-gray-50 text-gray-400">
                  <div className="text-center">
                    <Type className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Uploadez un template pour voir l'aperçu</p>
                  </div>
                </div>
              )}
              
              {/* Text Overlay */}
              {(backgroundImage || templateUrl) && (
                <div
                  className="text-overlay absolute p-4 border-2 border-dashed border-blue-500 bg-blue-50 bg-opacity-90 rounded cursor-move shadow-sm"
                  style={{
                    top: `${textPosition.y}%`,
                    left: `${textPosition.x}%`,
                    fontSize: `${textPosition.fontSize}px`,
                    color: textPosition.color,
                    maxWidth: '80%',
                    minWidth: '200px',
                    fontFamily: "'Times New Roman', serif",
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <div className="font-bold mb-2">Patient: {patientName}</div>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {letterContent.substring(0, 200)}
                    {letterContent.length > 200 && "..."}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p>📝 Cliquez et glissez la zone de texte pour la repositionner</p>
            <p>🎨 Ajustez la taille et la couleur du texte avec les contrôles ci-dessus</p>
            {!templateUrl && (
              <p className="text-orange-600">💡 Uploadez un template PDF pour voir l'aperçu</p>
            )}
            {templateUrl && backgroundImage && (
              <p className="text-green-600">✅ PDF converti et affiché en arrière-plan</p>
            )}
            {templateUrl && isConverting && (
              <p className="text-blue-600">🔄 Conversion du PDF en cours...</p>
            )}
            {templateUrl && conversionError && (
              <p className="text-orange-600">⚠️ Conversion échouée - Template utilisé à l'export</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
