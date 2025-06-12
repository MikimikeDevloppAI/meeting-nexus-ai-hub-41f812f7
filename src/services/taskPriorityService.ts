
import { supabase } from "@/integrations/supabase/client";

export interface TaskWithPriority {
  id: string;
  description: string;
  meeting_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
  priority_score: number;
  priority_reason: string;
  participants?: any[];
  todo_participants?: any[];
}

export const TaskPriorityService = {
  async getTasksWithPriority(): Promise<TaskWithPriority[]> {
    try {
      // Récupérer toutes les tâches en cours
      const { data: todos, error } = await supabase
        .from("todos")
        .select(`
          *,
          participants(name),
          todo_participants(
            participant_id,
            participants(id, name, email)
          )
        `)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!todos || todos.length === 0) {
        return [];
      }

      // Appeler l'IA pour classer par importance
      const { data, error: functionError } = await supabase.functions.invoke('task-priority-classifier', {
        body: { tasks: todos }
      });

      if (functionError) {
        console.error('Error classifying tasks:', functionError);
        // En cas d'erreur, retourner les tâches avec une priorité par défaut
        return todos.map(todo => ({
          ...todo,
          priority_score: 5,
          priority_reason: "Classification automatique non disponible"
        }));
      }

      return data.tasks || [];
    } catch (error) {
      console.error('Error fetching tasks with priority:', error);
      return [];
    }
  }
};
