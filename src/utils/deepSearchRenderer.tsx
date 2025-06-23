
import React from 'react';

interface DeepSearchRendererProps {
  text: string;
  sources: string[];
}

export const DeepSearchContent: React.FC<DeepSearchRendererProps> = ({ text, sources }) => {
  // Fonction pour convertir les tableaux Markdown en HTML
  const convertMarkdownTables = (text: string) => {
    // Regex pour détecter les tableaux Markdown
    const tableRegex = /(\|[^\n]+\|\n\|[\s\-:]+\|\n(?:\|[^\n]+\|\n?)+)/g;
    
    return text.replace(tableRegex, (match) => {
      const lines = match.trim().split('\n');
      if (lines.length < 3) return match;
      
      // Première ligne = headers
      const headerLine = lines[0];
      // Deuxième ligne = séparateurs (ignorée)
      // Lignes suivantes = données
      const dataLines = lines.slice(2);
      
      // Parser les headers
      const headers = headerLine.split('|')
        .map(h => h.trim())
        .filter(h => h.length > 0);
      
      // Parser les données
      const rows = dataLines.map(line => 
        line.split('|')
          .map(cell => cell.trim())
          .filter(cell => cell.length > 0)
      ).filter(row => row.length > 0);
      
      // Construire le HTML du tableau
      let tableHTML = '<table class="markdown-table">';
      
      // Headers
      if (headers.length > 0) {
        tableHTML += '<thead><tr>';
        headers.forEach(header => {
          tableHTML += `<th>${header}</th>`;
        });
        tableHTML += '</tr></thead>';
      }
      
      // Body
      if (rows.length > 0) {
        tableHTML += '<tbody>';
        rows.forEach(row => {
          tableHTML += '<tr>';
          row.forEach(cell => {
            // Convertir le markdown en gras dans les cellules
            const processedCell = cell.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            tableHTML += `<td>${processedCell}</td>`;
          });
          tableHTML += '</tr>';
        });
        tableHTML += '</tbody>';
      }
      
      tableHTML += '</table>';
      return tableHTML;
    });
  };

  // Prétraitement du texte pour améliorer la mise en forme
  const processText = (text: string) => {
    // D'abord convertir les tableaux Markdown
    let processedText = convertMarkdownTables(text);
    
    // Remplacer les références [1], [2], etc. par des liens cliquables
    processedText = processedText.replace(/\[(\d+)\]/g, (match, number) => {
      const sourceIndex = parseInt(number) - 1;
      const sourceUrl = sources[sourceIndex];
      
      if (sourceUrl) {
        return `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center px-1 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded border border-blue-200 hover:bg-blue-200 transition-colors">[${number}]</a>`;
      }
      
      return match;
    });

    // Convertir les doubles sauts de ligne en paragraphes
    processedText = processedText.replace(/\n\n/g, '</p><p>');
    
    // Convertir les sauts de ligne simples en <br>
    processedText = processedText.replace(/\n/g, '<br>');
    
    // Ajouter les balises p d'ouverture et de fermeture
    processedText = `<p>${processedText}</p>`;
    
    // Nettoyer les paragraphes vides
    processedText = processedText.replace(/<p><\/p>/g, '');
    processedText = processedText.replace(/<p><br><\/p>/g, '');

    // Améliorer le rendu des listes
    processedText = processedText.replace(/(<br>)?(\d+\.\s)/g, '<br><strong>$2</strong>');
    processedText = processedText.replace(/(<br>)?(-\s)/g, '<br>• ');
    
    return processedText;
  };

  const renderedText = processText(text);

  return (
    <div className="space-y-4">
      <div 
        className="prose prose-sm max-w-none deep-search-content text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: renderedText }}
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
