
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Send, Trash2, User, Pen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  comment: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  isEditing?: boolean;
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
  const [editComment, setEditComment] = useState<{ id: string, text: string } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    console.log("TodoComments - Auth state:", { user, userExists: !!user, userId: user?.id });
    if (user) {
      fetchComments();
    }
  }, [todoId, user]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      console.log("Fetching comments for todo:", todoId);
      
      const { data, error } = await supabase
        .from("todo_comments")
        .select(`
          *,
          users!todo_comments_user_id_fkey (
            name
          )
        `)
        .eq("todo_id", todoId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching comments:", error);
        throw error;
      }
      
      const processedComments = data?.map(item => ({
        ...item,
        user_name: item.users?.name || 'Utilisateur inconnu'
      })) || [];
      
      setComments(processedComments);
      console.log("Comments fetched successfully:", processedComments);
    } catch (error: any) {
      console.error("Error fetching comments:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les commentaires: " + (error.message || "Erreur inconnue"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    console.log("handleAddComment triggered", { 
      newComment: newComment.trim(), 
      user,
      userExists: !!user,
      userId: user?.id,
      trimmedLength: newComment.trim().length
    });
    
    if (!newComment.trim()) {
      console.log("Comment rejected - empty comment");
      toast({
        title: "Erreur",
        description: "Le commentaire ne peut pas être vide",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      console.log("Comment rejected - no user authenticated");
      toast({
        title: "Erreur",
        description: "Vous devez être connecté pour ajouter un commentaire",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      console.log("Attempting to insert comment with:", {
        todo_id: todoId,
        user_id: user.id,
        comment: newComment.trim()
      });

      const { data, error } = await supabase
        .from("todo_comments")
        .insert([
          {
            todo_id: todoId,
            user_id: user.id,
            comment: newComment.trim(),
          },
        ])
        .select(`
          *,
          users!todo_comments_user_id_fkey (
            name
          )
        `)
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        throw error;
      }

      console.log("Comment inserted successfully:", data);
      
      const newCommentWithUser = {
        ...data,
        user_name: data.users?.name || 'Utilisateur inconnu'
      };
      
      setComments([...comments, newCommentWithUser]);
      setNewComment("");
      toast({
        title: "Commentaire ajouté",
        description: "Votre commentaire a été ajouté avec succès.",
      });
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le commentaire: " + (error.message || "Erreur inconnue"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditComment = (comment: Comment, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    console.log("Starting edit for comment:", comment.id, "Current user:", user?.id, "Comment user:", comment.user_id);
    
    if (!user || user.id !== comment.user_id) {
      toast({
        title: "Erreur",
        description: "Vous ne pouvez modifier que vos propres commentaires",
        variant: "destructive",
      });
      return;
    }
    
    setEditComment({ id: comment.id, text: comment.comment });
  };

  const cancelEditComment = () => {
    console.log("Cancelling edit");
    setEditComment(null);
  };

  const saveEditComment = async () => {
    if (!editComment) return;
    
    console.log("Saving edit for comment:", editComment.id);
    
    try {
      const { error } = await supabase
        .from("todo_comments")
        .update({ comment: editComment.text, updated_at: new Date().toISOString() })
        .eq("id", editComment.id)
        .eq("user_id", user?.id); // Vérification supplémentaire de sécurité

      if (error) throw error;

      setComments(comments.map(comment => 
        comment.id === editComment.id 
          ? { ...comment, comment: editComment.text, updated_at: new Date().toISOString() } 
          : comment
      ));
      
      setEditComment(null);
      
      toast({
        title: "Commentaire modifié",
        description: "Le commentaire a été modifié avec succès.",
      });
    } catch (error: any) {
      console.error("Error editing comment:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le commentaire: " + (error.message || "Erreur inconnue"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteComment = async (commentId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    try {
      const { error } = await supabase
        .from("todo_comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user?.id); // Vérification supplémentaire de sécurité

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
        description: "Impossible de supprimer le commentaire: " + (error.message || "Erreur inconnue"),
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

  // Show auth warning if user is not authenticated
  if (!user) {
    return (
      <div className="space-y-3 mt-2 border-t pt-2">
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-sm">Connectez-vous pour voir et ajouter des commentaires</p>
        </div>
      </div>
    );
  }

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
                    {editComment?.id === comment.id ? (
                      <div className="space-y-2">
                        <Textarea 
                          value={editComment.text} 
                          onChange={(e) => setEditComment({...editComment, text: e.target.value})} 
                          className="w-full text-sm"
                          rows={3}
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={cancelEditComment}>
                            Annuler
                          </Button>
                          <Button size="sm" onClick={saveEditComment} disabled={!editComment.text.trim()}>
                            Enregistrer
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{comment.user_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          {user?.id === comment.user_id && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                aria-label="Modifier le commentaire"
                                onClick={(e) => {
                                  console.log("Edit button clicked for comment:", comment.id);
                                  startEditComment(comment, e);
                                }}
                              >
                                <Pen className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => handleDeleteComment(comment.id, e)}
                                className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <p className="text-sm">{comment.comment}</p>
                      </>
                    )}
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
                {editComment?.id === comment.id ? (
                  <div className="space-y-2">
                    <Textarea 
                      value={editComment.text} 
                      onChange={(e) => setEditComment({...editComment, text: e.target.value})} 
                      className="w-full text-xs min-h-[60px]"
                      rows={2}
                    />
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={cancelEditComment}>
                        Annuler
                      </Button>
                      <Button size="sm" className="h-6 text-xs" onClick={saveEditComment} disabled={!editComment.text.trim()}>
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium">{comment.user_name}</span>
                        <span className="text-xs text-gray-500 ml-1">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {user?.id === comment.user_id && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 hover:bg-blue-50 hover:text-blue-600"
                            aria-label="Modifier le commentaire"
                            onClick={(e) => {
                              console.log("Inline edit button clicked for comment:", comment.id);
                              startEditComment(comment, e);
                            }}
                          >
                            <Pen className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 hover:bg-red-50 hover:text-red-600"
                            onClick={(e) => handleDeleteComment(comment.id, e)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs mt-1">{comment.comment}</p>
                  </>
                )}
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
