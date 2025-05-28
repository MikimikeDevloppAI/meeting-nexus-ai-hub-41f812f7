import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Plus, Trash2, Edit, Save, X, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TodoComments } from "@/components/TodoComments";
import { TodoParticipantManager } from "@/components/TodoParticipantManager";

interface Participant {
  id: string;
  name: string;
  email: string;
}

interface Meeting {
  id: string;
  title: string;
}

interface Todo {
  id: string;
  description: string;
  status: string;
  meeting_id: string | null;
  assigned_to: string | null;
  created_at: string;
  ai_recommendation_generated: boolean | null;
  meetings?: {
    title: string;
  }[] | null;
  participants?: {
    name: string;
  }[] | null;
  todo_participants?: {
    participant_id: string;
    participants: {
      id: string;
      name: string;
      email: string;
    };
  }[];
}

const Todos = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTodoDescription, setNewTodoDescription] = useState("");
  const [selectedMeeting, setSelectedMeeting] = useState<string>("");
  const [selectedParticipant, setSelectedParticipant] = useState<string>("");
  const [activeTab, setActiveTab] = useState("all");
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState<string | null>(null);
  const [expandedTodoId, setExpandedTodoId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchTodos();
    fetchMeetings();
    fetchParticipants();
  }, []);

  const fetchTodos = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("todos")
        .select(`
          id, 
          description, 
          status, 
          meeting_id, 
          assigned_to, 
          created_at,
          ai_recommendation_generated,
          meetings!meeting_id (title),
          participants!assigned_to (name),
          todo_participants!inner (
            participant_id,
            participants!inner (
              id,
              name,
              email
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTodos(data || []);
    } catch (error: any) {
      console.error("Error fetching todos:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de charger les tâches",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, title")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error("Error fetching meetings:", error);
    }
  };

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from("participants")
        .select("id, name, email")
        .order("name", { ascending: true });

      if (error) throw error;
      setParticipants(data || []);
    } catch (error) {
      console.error("Error fetching participants:", error);
    }
  };

  const handleAddTodo = async () => {
    if (!newTodoDescription.trim()) return;

    try {
      const todoData = {
        description: newTodoDescription,
        status: "pending",
        meeting_id: selectedMeeting || null,
        assigned_to: selectedParticipant || null,
      };

      const { data, error } = await supabase
        .from("todos")
        .insert([todoData])
        .select(`
          id, 
          description, 
          status, 
          meeting_id, 
          assigned_to, 
          created_at,
          ai_recommendation_generated,
          meetings!meeting_id (title),
          participants!assigned_to (name),
          todo_participants!inner (
            participant_id,
            participants!inner (
              id,
              name,
              email
            )
          )
        `)
        .single();

      if (error) throw error;

      if (data) {
        setTodos([data, ...todos]);
        setNewTodoDescription("");
        setSelectedMeeting("");
        setSelectedParticipant("");
        setDialogOpen(false);
        
        toast({
          title: "Tâche ajoutée",
          description: "La tâche a été créée avec succès.",
        });
      }
    } catch (error: any) {
      console.error("Error adding todo:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la tâche",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("todos")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      setTodos(
        todos.map((todo) =>
          todo.id === id ? { ...todo, status: newStatus } : todo
        )
      );
      
      const statusText = newStatus === "completed" ? "complétée" : 
                        newStatus === "confirmed" ? "confirmée" : "en attente";
      
      toast({
        title: "Statut mis à jour",
        description: `La tâche est maintenant ${statusText}.`,
      });
    } catch (error: any) {
      console.error("Error updating todo:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le statut",
        variant: "destructive",
      });
    }
  };

  const startEditing = (todo: Todo) => {
    setEditingTodoId(todo.id);
    setEditDescription(todo.description);
  };

  const cancelEditing = () => {
    setEditingTodoId(null);
    setEditDescription("");
  };

  const saveEditing = async (id: string) => {
    if (!editDescription.trim()) return;

    try {
      const { error } = await supabase
        .from("todos")
        .update({ description: editDescription })
        .eq("id", id);

      if (error) throw error;

      setTodos(
        todos.map((todo) =>
          todo.id === id ? { ...todo, description: editDescription } : todo
        )
      );
      
      cancelEditing();
      toast({
        title: "Tâche mise à jour",
        description: "La description a été mise à jour avec succès.",
      });
    } catch (error: any) {
      console.error("Error updating todo:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour la tâche",
        variant: "destructive",
      });
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      const { error } = await supabase
        .from("todos")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setTodos(todos.filter((todo) => todo.id !== id));
      toast({
        title: "Tâche supprimée",
        description: "La tâche a été supprimée avec succès.",
      });
    } catch (error: any) {
      console.error("Error deleting todo:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la tâche",
        variant: "destructive",
      });
    }
  };

  const filteredTodos = todos.filter((todo) => {
    if (activeTab === "pending") return todo.status === "pending";
    if (activeTab === "completed") return todo.status === "completed";
    return true; // All todos
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "confirmed": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestion des tâches</h1>
          <p className="text-muted-foreground">
            Visualisez et gérez toutes les tâches
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nouvelle tâche
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une nouvelle tâche</DialogTitle>
              <DialogDescription>
                Créez une nouvelle tâche et assignez-la si nécessaire.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={newTodoDescription}
                  onChange={(e) => setNewTodoDescription(e.target.value)}
                  placeholder="Description de la tâche"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="meeting">Réunion (optionnel)</Label>
                <Select value={selectedMeeting} onValueChange={setSelectedMeeting}>
                  <SelectTrigger id="meeting" className="mt-1">
                    <SelectValue placeholder="Sélectionner une réunion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucune réunion</SelectItem>
                    {meetings.map((meeting) => (
                      <SelectItem key={meeting.id} value={meeting.id}>
                        {meeting.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="assignee">Assignée à (optionnel)</Label>
                <Select value={selectedParticipant} onValueChange={setSelectedParticipant}>
                  <SelectTrigger id="assignee" className="mt-1">
                    <SelectValue placeholder="Assignée à" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Non assignée</SelectItem>
                    {participants.map((participant) => (
                      <SelectItem key={participant.id} value={participant.id}>
                        {participant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" onClick={handleAddTodo}>Ajouter</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="completed">Complétées</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <Card key={item} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-5 bg-primary/10 rounded w-2/3 mb-2"></div>
                    <div className="h-4 bg-primary/5 rounded w-1/3"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredTodos.length > 0 ? (
            <div className="space-y-4">
              {filteredTodos.map((todo) => {
                const assignedParticipants = todo.todo_participants?.map(tp => tp.participants) || [];
                
                return (
                  <Card key={todo.id}>
                    <CardContent className="p-4">
                      {editingTodoId === todo.id ? (
                        <div className="flex gap-2 items-center">
                          <Input
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="flex-1"
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => saveEditing(todo.id)}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={cancelEditing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="flex gap-2">
                                <Button
                                  variant={todo.status === "completed" ? "default" : "outline"}
                                  size="icon"
                                  className={
                                    todo.status === "completed"
                                      ? "h-6 w-6 bg-green-500 hover:bg-green-600"
                                      : "h-6 w-6"
                                  }
                                  onClick={() =>
                                    handleStatusChange(
                                      todo.id,
                                      todo.status === "completed" ? "pending" : "completed"
                                    )
                                  }
                                >
                                  {todo.status === "completed" && (
                                    <CheckSquare className="h-4 w-4" />
                                  )}
                                </Button>
                                {todo.status === "pending" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleStatusChange(todo.id, "confirmed")}
                                  >
                                    Confirmer
                                  </Button>
                                )}
                              </div>
                              <div className="space-y-1 flex-1">
                                <p
                                  className={`text-md ${
                                    todo.status === "completed"
                                      ? "line-through text-muted-foreground"
                                      : ""
                                  }`}
                                >
                                  {todo.description}
                                </p>
                                <div className="flex flex-wrap gap-2 text-xs">
                                  <Badge variant={getStatusBadgeVariant(todo.status)}>
                                    {todo.status === "completed" ? "Complétée" : 
                                     todo.status === "confirmed" ? "Confirmée" : "En attente"}
                                  </Badge>
                                  {todo.meetings && todo.meetings.length > 0 && (
                                    <Badge variant="outline">
                                      Réunion: {todo.meetings[0].title}
                                    </Badge>
                                  )}
                                  {todo.ai_recommendation_generated && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                      IA consultée
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 self-end sm:self-center mt-2 sm:mt-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setCommentsOpen(todo.id)}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => startEditing(todo)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deleteTodo(todo.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Participants assignés:</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedTodoId(expandedTodoId === todo.id ? null : todo.id)}
                              >
                                {expandedTodoId === todo.id ? "Masquer" : "Gérer"}
                              </Button>
                            </div>
                            
                            {expandedTodoId === todo.id ? (
                              <TodoParticipantManager
                                todoId={todo.id}
                                currentParticipants={assignedParticipants}
                                onParticipantsUpdate={fetchTodos}
                              />
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {assignedParticipants.length > 0 ? (
                                  assignedParticipants.map((participant) => (
                                    <Badge key={participant.id} variant="secondary">
                                      {participant.name}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-sm text-muted-foreground">Non assignée</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-center">Aucune tâche trouvée</CardTitle>
                <CardDescription className="text-center">
                  {activeTab === "all" 
                    ? "Vous n'avez pas encore créé de tâches." 
                    : activeTab === "pending" 
                    ? "Il n'y a pas de tâches en attente." 
                    : "Il n'y a pas de tâches complétées."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center pb-6">
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Créer une tâche
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <TodoComments
        todoId={commentsOpen || ""}
        isOpen={!!commentsOpen}
        onClose={() => setCommentsOpen(null)}
      />
    </div>
  );
};

export default Todos;
