
import React from 'react';

interface DeepSearchRendererProps {
  text: string;
  sources: string[];
}

export const DeepSearchContent: React.FC<DeepSearchRendererProps> = ({ text, sources }) => {
  const renderedText = text.replace(/\[(\d+)\]/g, (match, number) => {
    const sourceIndex = parseInt(number) - 1;
    const sourceUrl = sources[sourceIndex];
    
    if (sourceUrl) {
      return `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center px-1 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded border border-blue-200 hover:bg-blue-200 transition-colors">[${number}]</a>`;
    }
    
    return match;
  });

  return (
    <div className="space-y-4">
      <div 
        className="prose prose-sm max-w-none deep-search-content"
        dangerouslySetInnerHTML={{ __html: renderedText }}
        style={{
          // Styles pour les tableaux Markdown
          '--table-border': '1px solid #e2e8f0',
          '--table-bg': '#ffffff',
          '--table-header-bg': '#f8fafc'
        } as React.CSSProperties}
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
      
      <style jsx>{`
        .deep-search-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          border: var(--table-border);
          border-radius: 0.375rem;
          overflow: hidden;
        }
        
        .deep-search-content thead {
          background-color: var(--table-header-bg);
        }
        
        .deep-search-content th,
        .deep-search-content td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: var(--table-border);
          border-right: var(--table-border);
        }
        
        .deep-search-content th:last-child,
        .deep-search-content td:last-child {
          border-right: none;
        }
        
        .deep-search-content tr:last-child td {
          border-bottom: none;
        }
        
        .deep-search-content th {
          font-weight: 600;
          font-size: 0.875rem;
          color: #374151;
        }
        
        .deep-search-content td {
          font-size: 0.875rem;
          color: #6b7280;
        }
        
        .deep-search-content tbody tr:hover {
          background-color: #f9fafb;
        }
        
        .deep-search-content p {
          margin-bottom: 1rem;
          line-height: 1.6;
        }
        
        .deep-search-content h1 {
          font-size: 1.25rem;
          font-weight: bold;
          margin-bottom: 1rem;
        }
        
        .deep-search-content h2 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
        }
        
        .deep-search-content h3 {
          font-size: 1rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
        }
        
        .deep-search-content ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-bottom: 1rem;
        }
        
        .deep-search-content ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin-bottom: 1rem;
        }
        
        .deep-search-content li {
          margin-bottom: 0.25rem;
        }
        
        .deep-search-content strong {
          font-weight: 600;
        }
        
        .deep-search-content em {
          font-style: italic;
        }
        
        .deep-search-content code {
          background-color: #f3f4f6;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          font-family: monospace;
        }
        
        .deep-search-content blockquote {
          border-left: 4px solid #d1d5db;
          padding-left: 1rem;
          font-style: italic;
          margin: 1rem 0;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
};
