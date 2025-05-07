
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare } from "lucide-react";

const Todos = () => {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">To-Do Management</h1>
        <p className="text-muted-foreground">
          View and manage all to-dos across meetings
        </p>
      </div>

      <Card className="border-dashed border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckSquare className="mr-2 h-5 w-5 text-primary" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            This feature is under development
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            The To-Do Management module will allow you to:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>View all to-dos across all meetings</li>
            <li>Filter by status, assignee, or meeting</li>
            <li>Mark tasks as complete</li>
            <li>Update task information</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Todos;
