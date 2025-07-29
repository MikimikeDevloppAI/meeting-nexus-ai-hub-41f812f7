
import { useEffect } from 'react';
import { useTodoCounter } from '@/hooks/useTodoCounter';

export const TodoCounterWrapper = () => {
  // Utiliser le même hook que les autres composants
  const pendingCount = useTodoCounter();

  // Mettre à jour le titre de la page avec le badge
  useEffect(() => {
    const baseTitle = 'IOL Management';
    
    if (pendingCount > 0) {
      document.title = `(${pendingCount}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [pendingCount]);

  // Ce composant ne rend rien, il sert juste à exécuter le hook
  return null;
};
