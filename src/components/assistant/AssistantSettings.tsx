
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Database, FileText, Globe, ListTodo, Users, CheckCircle } from "lucide-react";

interface AssistantSettingsProps {
  databaseSearchEnabled: boolean;
  setDatabaseSearchEnabled: (value: boolean) => void;
  documentSearchEnabled: boolean;
  setDocumentSearchEnabled: (value: boolean) => void;
  internetSearchEnabled: boolean;
  setInternetSearchEnabled: (value: boolean) => void;
  todoEnabled: boolean;
  setTodoEnabled: (value: boolean) => void;
  meetingPointsEnabled: boolean;
  setMeetingPointsEnabled: (value: boolean) => void;
}

const AssistantSettings = ({
  databaseSearchEnabled,
  setDatabaseSearchEnabled,
  documentSearchEnabled,
  setDocumentSearchEnabled,
  internetSearchEnabled,
  setInternetSearchEnabled,
  todoEnabled,
  setTodoEnabled,
  meetingPointsEnabled,
  setMeetingPointsEnabled,
}: AssistantSettingsProps) => {
  const enabledCount = [
    databaseSearchEnabled,
    documentSearchEnabled,
    internetSearchEnabled,
    todoEnabled,
    meetingPointsEnabled
  ].filter(Boolean).length;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Fonctionnalités de l'assistant</CardTitle>
        <CardDescription>
          Activez ou désactivez les différentes fonctionnalités de l'assistant IA.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Database Search Toggle */}
          <div className="flex items-center space-x-3 p-3 border rounded-lg">
            <Database className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <Label htmlFor="database-search" className="text-sm font-medium">
                Recherche base de données
              </Label>
              <p className="text-xs text-muted-foreground">Recherche dans les données du cabinet</p>
            </div>
            <Switch 
              id="database-search" 
              checked={databaseSearchEnabled} 
              onCheckedChange={setDatabaseSearchEnabled} 
            />
          </div>

          {/* Document Search Toggle */}
          <div className="flex items-center space-x-3 p-3 border rounded-lg">
            <FileText className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <Label htmlFor="document-search" className="text-sm font-medium">
                Recherche documentaire
              </Label>
              <p className="text-xs text-muted-foreground">Recherche dans les documents</p>
            </div>
            <Switch 
              id="document-search" 
              checked={documentSearchEnabled} 
              onCheckedChange={setDocumentSearchEnabled} 
            />
          </div>

          {/* Internet Search Toggle */}
          <div className="flex items-center space-x-3 p-3 border rounded-lg">
            <Globe className="h-5 w-5 text-purple-600" />
            <div className="flex-1">
              <Label htmlFor="internet-search" className="text-sm font-medium">
                Recherche internet
              </Label>
              <p className="text-xs text-muted-foreground">Recherche d'informations en ligne</p>
            </div>
            <Switch 
              id="internet-search" 
              checked={internetSearchEnabled} 
              onCheckedChange={setInternetSearchEnabled} 
            />
          </div>

          {/* Todo Management Toggle */}
          <div className="flex items-center space-x-3 p-3 border rounded-lg">
            <ListTodo className="h-5 w-5 text-orange-600" />
            <div className="flex-1">
              <Label htmlFor="todo-management" className="text-sm font-medium">
                Gestion des tâches
              </Label>
              <p className="text-xs text-muted-foreground">Création et suivi des tâches</p>
            </div>
            <Switch 
              id="todo-management" 
              checked={todoEnabled} 
              onCheckedChange={setTodoEnabled} 
            />
          </div>

          {/* Meeting Points Toggle */}
          <div className="flex items-center space-x-3 p-3 border rounded-lg">
            <Users className="h-5 w-5 text-red-600" />
            <div className="flex-1">
              <Label htmlFor="meeting-points" className="text-sm font-medium">
                Points de réunion
              </Label>
              <p className="text-xs text-muted-foreground">Gestion de l'ordre du jour</p>
            </div>
            <Switch 
              id="meeting-points" 
              checked={meetingPointsEnabled} 
              onCheckedChange={setMeetingPointsEnabled} 
            />
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="font-medium">
              {enabledCount} fonctionnalité(s) activée(s)
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AssistantSettings;
