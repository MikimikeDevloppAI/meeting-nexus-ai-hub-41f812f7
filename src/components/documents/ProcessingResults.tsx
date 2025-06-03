
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, FileText, Tag, Clock } from "lucide-react";

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="mt-4 border-green-200 bg-green-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-green-800">
          <CheckCircle className="h-5 w-5" />
          Traitement terminé
        </CardTitle>
        <CardDescription className="flex items-center gap-2 text-green-600">
          <Clock className="h-4 w-4" />
          Complété le {formatDate(document.created_at)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {document.ai_summary && (
          <div>
            <h4 className="font-medium text-green-800 mb-1">Résumé</h4>
            <p className="text-sm text-green-700">{document.ai_summary}</p>
          </div>
        )}
        
        {document.taxonomy && Object.keys(document.taxonomy).length > 0 && (
          <div>
            <h4 className="font-medium text-green-800 mb-2 flex items-center gap-1">
              <Tag className="h-4 w-4" />
              Catégorisation
            </h4>
            <div className="flex flex-wrap gap-2">
              {document.taxonomy.category && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {document.taxonomy.category}
                </Badge>
              )}
              {document.taxonomy.subcategory && (
                <Badge variant="outline" className="border-green-300 text-green-700">
                  {document.taxonomy.subcategory}
                </Badge>
              )}
              {document.taxonomy.documentType && (
                <Badge variant="outline" className="border-green-300 text-green-700">
                  {document.taxonomy.documentType}
                </Badge>
              )}
              {document.taxonomy.keywords?.slice(0, 4).map((keyword: string, index: number) => (
                <Badge key={index} variant="outline" className="border-green-200 text-green-600 text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {document.extracted_text && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <FileText className="h-4 w-4" />
            <span>{document.extracted_text.length.toLocaleString()} caractères extraits</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
