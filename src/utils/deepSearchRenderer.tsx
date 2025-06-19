
import React from 'react';

interface DeepSearchRendererProps {
  text: string;
  sources: string[];
}

export const renderDeepSearchContent = (text: string, sources: string[] = []) => {
  if (!text) return text;

  // Remplacer les références [1], [2], etc. par des liens cliquables
  const renderedText = text.replace(/\[(\d+)\]/g, (match, number) => {
    const sourceIndex = parseInt(number) - 1;
    const sourceUrl = sources[sourceIndex];
    
    if (sourceUrl) {
      return `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center px-1 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded border border-blue-200 hover:bg-blue-200 transition-colors">[${number}]</a>`;
    }
    
    return match; // Garder le texte original si pas de source correspondante
  });

  return renderedText;
};

export const DeepSearchContent: React.FC<DeepSearchRendererProps> = ({ text, sources }) => {
  const renderedContent = renderDeepSearchContent(text, sources);
  
  return (
    <div className="space-y-4">
      <div 
        className="text-sm leading-relaxed whitespace-pre-wrap break-words hyphens-auto"
        style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
        dangerouslySetInnerHTML={{ __html: renderedContent }}
      />
      
      {sources && sources.length > 0 && (
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Sources :</h4>
          <ul className="space-y-1">
            {sources.map((source, index) => (
              <li key={index} className="text-xs">
                <span className="text-muted-foreground">[{index + 1}]</span>{' '}
                <a
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  {source}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
