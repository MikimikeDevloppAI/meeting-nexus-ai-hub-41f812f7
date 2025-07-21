import { useTodoCounter } from "@/hooks/useTodoCounter";

export const TodoCounterWrapper = () => {
  // Ce composant utilise le hook useTodoCounter pour mettre à jour le titre de la page
  // avec le nombre de tâches en cours attribuées à l'utilisateur connecté
  useTodoCounter();
  
  // Ce composant ne rend rien, il sert juste à exécuter le hook
  return null;
};