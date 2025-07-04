import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Move, Type, Palette } from "lucide-react";

import { LETTER_CONSTANTS, getLetterDimensions, formatTextForPreview } from "@/utils/letterLayout";

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
  
  // Utiliser les constantes standardisées
  const fixedPosition = {
    x: LETTER_CONSTANTS.MARGIN_LEFT_PERCENT,
    y: LETTER_CONSTANTS.MARGIN_TOP_PERCENT,
    fontSize: LETTER_CONSTANTS.FONT_SIZE,
    color: LETTER_CONSTANTS.DEFAULT_TEXT_COLOR
  };

  // Formatage du texte avec les règles unifiées
  const { lines: formattedLines } = formatTextForPreview(letterContent, fixedPosition.fontSize);

  // Gestion de l'image de fond
  useEffect(() => {
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
  }, [templateUrl]);

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
              
              {/* Text Overlay avec formatage amélioré */}
              {(backgroundImage || templateUrl) && (
                <div
                  className="text-overlay absolute p-3 border-2 border-dashed border-gray-300 bg-white bg-opacity-90 rounded shadow-sm select-none"
                  style={{
                    top: `${fixedPosition.y}%`,
                    left: `${fixedPosition.x}%`,
                    fontSize: `${Math.max(fixedPosition.fontSize * 0.8, 8)}px`,
                    color: fixedPosition.color,
                    width: `${100 - fixedPosition.x - LETTER_CONSTANTS.MARGIN_RIGHT_PERCENT}%`,
                    fontFamily: LETTER_CONSTANTS.FONT_FAMILY,
                    lineHeight: `${LETTER_CONSTANTS.LINE_HEIGHT_MULTIPLIER}`,
                    overflow: 'hidden'
                  }}
                >
                  {/* En-tête */}
                  <div className="font-bold mb-2">Patient: {patientName}</div>
                  <div className="mb-1">Date: {new Date().toLocaleDateString('fr-FR')}</div>
                  
                  {/* Contenu principal avec formatage avancé */}
                  <div style={{ marginTop: '1em' }}>
                    {formattedLines.length > 0 ? (
                      formattedLines.map((line, index) => (
                        <div 
                          key={index} 
                          style={{ 
                            marginBottom: line.isEmpty ? `${LETTER_CONSTANTS.PARAGRAPH_SPACING_MULTIPLIER}em` : '0',
                            minHeight: line.isEmpty ? `${LETTER_CONSTANTS.PARAGRAPH_SPACING_MULTIPLIER}em` : 'auto',
                            textIndent: line.isFirstLineOfParagraph ? `${LETTER_CONSTANTS.PARAGRAPH_INDENT_PERCENT}%` : '0',
                            textAlign: 'justify',
                            wordSpacing: '0.1em',
                            hyphens: 'auto',
                            WebkitHyphens: 'auto',
                            MozHyphens: 'auto',
                            letterSpacing: '0.02em'
                          }}
                        >
                          {!line.isEmpty && line.text}
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400 italic">
                        Saisissez ou dictez le contenu de votre lettre...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Informations et statistiques */}
          <div className="text-sm text-gray-600 space-y-1">
            <p>📝 Prévisualisation avec formatage automatique et justification</p>
            <p>✏️ Indentation automatique des paragraphes</p>
            <p>📐 Largeur optimisée: {100 - LETTER_CONSTANTS.MARGIN_LEFT_PERCENT - LETTER_CONSTANTS.MARGIN_RIGHT_PERCENT}% de la page</p>
            
            {formattedLines.length > 0 && (
              <div className="bg-blue-50 p-2 rounded text-xs">
                <p className="font-medium text-blue-800">Statistiques du texte:</p>
                <p>• {formattedLines.filter(l => !l.isEmpty).length} lignes de texte</p>
                <p>• {formattedLines.filter(l => l.isFirstLineOfParagraph).length} paragraphes</p>
                <p>• {letterContent.split(' ').filter(w => w.length > 0).length} mots</p>
              </div>
            )}
            
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
