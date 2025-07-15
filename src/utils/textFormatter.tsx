import React from 'react';

interface FormattedTextProps {
  content: string;
  className?: string;
}

/**
 * Formatte le texte avec des styles de base sans utiliser ReactMarkdown
 * pour éviter les problèmes d'affichage avec les phrases très longues
 */
export const FormattedText = ({ content, className = "" }: FormattedTextProps) => {
  if (!content) return null;

  // Divise le contenu en lignes pour traiter chaque ligne individuellement
  const lines = content.split('\n');
  
  const formatLine = (line: string, index: number) => {
    const trimmedLine = line.trim();
    
    // Ligne vide
    if (!trimmedLine) {
      return <br key={index} />;
    }
    
    // Titres (# ## ###)
    if (trimmedLine.match(/^#{1,3}\s+/)) {
      const level = (trimmedLine.match(/^#+/) || [''])[0].length;
      const text = trimmedLine.replace(/^#+\s+/, '');
      const baseClasses = "font-bold mb-2 block break-words overflow-wrap-break-word hyphens-auto";
      
      if (level === 1) {
        return <h1 key={index} className={`text-xl ${baseClasses}`}>{text}</h1>;
      } else if (level === 2) {
        return <h2 key={index} className={`text-lg ${baseClasses}`}>{text}</h2>;
      } else {
        return <h3 key={index} className={`text-base ${baseClasses}`}>{text}</h3>;
      }
    }
    
    // Listes (- * +)
    if (trimmedLine.match(/^[-*+]\s+/)) {
      const text = trimmedLine.replace(/^[-*+]\s+/, '');
      return (
        <div key={index} className="flex items-start gap-2 mb-1">
          <span className="text-gray-600 mt-1">•</span>
          <span className="break-words overflow-wrap-break-word hyphens-auto flex-1 text-sm">
            {formatInlineText(text)}
          </span>
        </div>
      );
    }
    
    // Listes numérotées (1. 2. etc.)
    if (trimmedLine.match(/^\d+\.\s+/)) {
      const number = (trimmedLine.match(/^\d+/) || [''])[0];
      const text = trimmedLine.replace(/^\d+\.\s+/, '');
      return (
        <div key={index} className="flex items-start gap-2 mb-1">
          <span className="text-gray-600 mt-1">{number}.</span>
          <span className="break-words overflow-wrap-break-word hyphens-auto flex-1 text-sm">
            {formatInlineText(text)}
          </span>
        </div>
      );
    }
    
    // Paragraphe normal
    return (
      <p key={index} className="mb-2 text-sm break-words overflow-wrap-break-word hyphens-auto">
        {formatInlineText(trimmedLine)}
      </p>
    );
  };
  
  // Formatte le texte en ligne (gras, italique)
  const formatInlineText = (text: string) => {
    // Gras (**text** ou __text__)
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // Italique (*text* ou _text_)
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  return (
    <div className={`w-full min-w-0 ${className}`} style={{ 
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
      whiteSpace: 'pre-wrap',
      maxWidth: '100%'
    }}>
      {lines.map((line, index) => formatLine(line, index))}
    </div>
  );
};