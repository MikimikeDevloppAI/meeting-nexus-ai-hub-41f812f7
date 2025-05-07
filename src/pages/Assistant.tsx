
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

const Assistant = () => {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Assistant</h1>
        <p className="text-muted-foreground">
          Chat with an AI assistant that has access to all your company data
        </p>
      </div>

      <Card className="border-dashed border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="mr-2 h-5 w-5 text-primary" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            This feature is under development
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            The AI Assistant will allow you to:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Chat with an AI that has access to all your company's stored data</li>
            <li>Get answers based on historical meeting notes</li>
            <li>Request summaries of past actions</li>
            <li>Search relevant information across your knowledge base</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Assistant;
