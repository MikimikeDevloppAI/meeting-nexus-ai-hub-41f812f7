import { useTodoCounter } from "@/hooks/useTodoCounter";

export const TodoCounterWrapper = () => {
  // Ce composant utilise le hook useTodoCounter pour mettre à jour le titre de la page
  useTodoCounter();
  
  // Ce composant ne rend rien, il sert juste à exécuter le hook
  return null;
};