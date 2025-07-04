
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
  const [backgroundImage, setBackgroundImage] = useState<string>("");
  const [isConverting, setIsConverting] = useState(false);
  const [conversionError, setConversionError] = useState(false);
  
  // Position fixe avec marges raisonnables pour document A4
  const fixedPosition = {
    x: 8, // Marge gauche de 8%
    y: 15, // Marge haute de 15%
    fontSize: 12,
    color: "#000000"
  };

  // Utilisé directement l'URL du template comme background
  React.useEffect(() => {
    console.log('🔍 LetterDesigner useEffect triggered');
    console.log('📄 templateUrl:', templateUrl);
    console.log('🖼️ current backgroundImage:', backgroundImage);
    
    if (templateUrl && templateUrl !== backgroundImage) {
      console.log('✅ Setting new background image directly:', templateUrl);
      setBackgroundImage(templateUrl);
      setConversionError(false);
    } else if (!templateUrl && backgroundImage) {
      console.log('🗑️ No template, clearing background');
      setBackgroundImage("");
      setConversionError(false);
    } else {
      console.log('⏭️ Template same as background, skipping');
    }
  }, [templateUrl]); // Retirer backgroundImage des dépendances pour éviter la boucle

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="h-5 w-5" />
          Prévisualisation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Preview Canvas */}
          <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
            <div 
              ref={canvasRef}
              className="pdf-container relative w-full aspect-[210/297] mx-auto bg-white max-w-4xl"
            >
              {/* PDF Background Image */}
              {backgroundImage ? (
                <img 
                  src={backgroundImage} 
                  alt="PDF Template"
                  className="pdf-background w-full h-full object-contain block"
                />
              ) : templateUrl ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-50">
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
                <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400">
                  <div className="text-center">
                    <Type className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Uploadez un template pour voir l'aperçu</p>
                    <p className="text-xs mt-2">Format A4 - 210 x 297 mm</p>
                  </div>
                </div>
              )}
              
              {/* Text Overlay */}
              {(backgroundImage || templateUrl) && (
                <div
                  className="text-overlay absolute p-3 border-2 border-dashed border-gray-300 bg-white bg-opacity-90 rounded shadow-sm select-none"
                  style={{
                    top: `${fixedPosition.y}%`,
                    left: `${fixedPosition.x}%`,
                    fontSize: `${Math.max(fixedPosition.fontSize * 0.8, 8)}px`,
                    color: fixedPosition.color,
                    width: `${84}%`, // Largeur fixe avec marges
                    fontFamily: "'Times New Roman', serif",
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    lineHeight: '1.4',
                    hyphens: 'auto',
                  }}
                >
                  <div className="font-bold mb-2">Patient: {patientName}</div>
                  <div className="whitespace-pre-wrap leading-relaxed break-words">
                    {letterContent || "Saisissez ou dictez le contenu de votre lettre..."}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p>📝 Prévisualisation de la lettre avec formatage automatique</p>
            <p>✏️ Le formatage du contenu se fait dans la section "Contenu de la Lettre"</p>
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
