
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";

const Invoices = () => {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Invoice Processing</h1>
        <p className="text-muted-foreground">
          Upload and manage invoices with automatic data extraction
        </p>
      </div>

      <Card className="border-dashed border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="mr-2 h-5 w-5 text-primary" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            This feature is under development
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            The Invoice Processing module will allow you to:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Upload invoice files (PDF or image)</li>
            <li>Automatic data extraction via backend service</li>
            <li>View and search processed invoices</li>
            <li>Edit and validate extracted data</li>
            <li>Preview invoice documents</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Invoices;
