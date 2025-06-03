
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Tag } from "lucide-react";

interface ProcessingResultsProps {
  document: {
    ai_generated_name: string | null;
    ai_summary: string | null;
    taxonomy: any;
    processed: boolean;
    created_at: string;
    original_name: string;
    extracted_text: string | null;
  };
}

export const ProcessingResults = ({ document }: ProcessingResultsProps) => {
  if (!document.processed) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardContent className="space-y-4 pt-6">
        {document.ai_summary && (
          <div>
            <h4 className="font-medium mb-2">Résumé</h4>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
              {document.ai_summary}
            </p>
          </div>
        )}
        
        {document.taxonomy && Object.keys(document.taxonomy).length > 0 && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-1">
              <Tag className="h-4 w-4" />
              Catégorisation
            </h4>
            <div className="flex flex-wrap gap-2">
              {document.taxonomy.category && (
                <Badge variant="secondary">
                  {document.taxonomy.category}
                </Badge>
              )}
              {document.taxonomy.subcategory && (
                <Badge variant="outline">
                  {document.taxonomy.subcategory}
                </Badge>
              )}
              {document.taxonomy.documentType && (
                <Badge variant="outline">
                  {document.taxonomy.documentType}
                </Badge>
              )}
              {document.taxonomy.keywords?.slice(0, 4).map((keyword: string, index: number) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {document.extracted_text && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText className="h-4 w-4" />
            <span>{document.extracted_text.length.toLocaleString()} caractères extraits</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
