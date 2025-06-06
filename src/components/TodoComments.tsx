
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  comment: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface TodoCommentsProps {
  todoId: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export const TodoComments = ({ todoId, isOpen, onClose }: TodoCommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // Load comments on component mount or when the todoId changes
    fetchComments();
  }, [todoId]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("todo_comments")
        .select("*")
        .eq("todo_id", todoId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error: any) {
      console.error("Error fetching comments:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les commentaires",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    console.log("handleAddComment triggered", { newComment: newComment.trim(), user });
    
    if (!newComment.trim() || !user) {
      console.log("Comment rejected - empty comment or no user");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("todo_comments")
        .insert([
          {
            todo_id: todoId,
            user_id: user.id,
            comment: newComment.trim(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setComments([...comments, data]);
      setNewComment("");
      toast({
        title: "Commentaire ajouté",
        description: "Votre commentaire a été ajouté avec succès.",
      });
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le commentaire",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("todo_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      setComments(comments.filter(comment => comment.id !== commentId));
      toast({
        title: "Commentaire supprimé",
        description: "Le commentaire a été supprimé avec succès.",
      });
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le commentaire",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  // For the modal view
  if (isOpen === false) return null;
  
  // If it's used as a modal
  if (isOpen === true) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Commentaires
              </h3>
              <Button variant="ghost" onClick={onClose}>
                ×
              </Button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
              {isLoading ? (
                <div className="text-center py-4">Chargement...</div>
              ) : comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                      {user?.id === comment.user_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm">{comment.comment}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  Aucun commentaire pour le moment
                </div>
              )}
            </div>

            <form onSubmit={handleAddComment} className="space-y-3">
              <Textarea
                placeholder="Ajouter un commentaire..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={handleKeyPress}
                rows={3}
              />
              <Button
                type="submit"
                disabled={!newComment.trim() || isSubmitting}
                className="w-full"
              >
                <Send className="mr-2 h-4 w-4" />
                {isSubmitting ? "Envoi..." : "Ajouter un commentaire"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For the inline display in the card
  return (
    <div className="space-y-3 mt-2 border-t pt-2">
      {comments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500">Commentaires ({comments.length})</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-gray-50 rounded p-2 text-sm">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                  {user?.id === comment.user_id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0"
                      onClick={() => handleDeleteComment(comment.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-xs mt-1">{comment.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleAddComment} className="flex gap-2">
        <Textarea
          placeholder="Ajouter un commentaire..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={1}
          className="text-xs min-h-[40px] py-1 flex-1"
        />
        <Button
          type="submit"
          disabled={!newComment.trim() || isSubmitting}
          className="h-10 px-3"
          size="sm"
        >
          <Send className="h-3 w-3" />
        </Button>
      </form>
    </div>
  );
};
