import { useState, useEffect, useCallback, useRef } from 'react';

interface UseInactivityTimerProps {
  timeout: number; // en millisecondes
  warningTime: number; // temps d'avertissement avant déconnexion (en millisecondes)
  onTimeout: () => void;
  onWarning: () => void;
  enabled: boolean;
}

export const useInactivityTimer = ({
  timeout,
  warningTime,
  onTimeout,
  onWarning,
  enabled
}: UseInactivityTimerProps) => {
  const [isActive, setIsActive] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningTimeoutRef = useRef<NodeJS.Timeout>();
  const countdownRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef<number>(Date.now());

  const [isPaused, setIsPaused] = useState(false);

  const resetTimer = useCallback(() => {
    if (!enabled || isPaused) return;

    // Nettoyer les timers existants
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Masquer l'avertissement si affiché
    setShowWarning(false);
    setIsActive(true);
    
    // Mettre à jour la dernière activité
    lastActivityRef.current = Date.now();
    localStorage.setItem('lastActivity', lastActivityRef.current.toString());

    // Programmer l'avertissement
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
      setTimeLeft(warningTime);
      onWarning();

      // Démarrer le compte à rebours
      countdownRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1000;
          if (newTime <= 0) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            onTimeout();
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }, timeout - warningTime);

    // Programmer la déconnexion automatique
    timeoutRef.current = setTimeout(() => {
      onTimeout();
    }, timeout);
  }, [enabled, isPaused, timeout, warningTime, onTimeout, onWarning]);

  const pauseTimer = useCallback(() => {
    if (!enabled) return;
    
    setIsPaused(true);
    
    // Nettoyer les timers existants
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    // Masquer l'avertissement si affiché
    setShowWarning(false);
  }, [enabled]);

  const resumeTimer = useCallback(() => {
    if (!enabled) return;
    
    setIsPaused(false);
    // Le timer redémarrera automatiquement grâce à resetTimer
    setTimeout(() => resetTimer(), 100);
  }, [enabled, resetTimer]);

  const extendSession = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  const checkStoredActivity = useCallback(() => {
    const stored = localStorage.getItem('lastActivity');
    if (stored) {
      const lastActivity = parseInt(stored);
      const timeSinceLastActivity = Date.now() - lastActivity;
      
      if (timeSinceLastActivity >= timeout) {
        // Si l'activité stockée est trop ancienne, ne pas déconnecter immédiatement
        // mais plutôt réinitialiser le timer (considérer comme un nouveau début de session)
        console.log("Activité stockée trop ancienne, réinitialisation du timer au lieu de déconnecter");
        localStorage.removeItem('lastActivity');
        return true; // Continuer avec un timer frais
      } else if (timeSinceLastActivity >= timeout - warningTime) {
        // Afficher l'avertissement si proche du timeout
        const remaining = timeout - timeSinceLastActivity;
        setShowWarning(true);
        setTimeLeft(remaining);
        onWarning();
        
        countdownRef.current = setInterval(() => {
          setTimeLeft(prev => {
            const newTime = prev - 1000;
            if (newTime <= 0) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              onTimeout();
              return 0;
            }
            return newTime;
          });
        }, 1000);
        
        timeoutRef.current = setTimeout(() => {
          onTimeout();
        }, remaining);
        
        return true;
      }
    }
    return true;
  }, [timeout, warningTime, onTimeout, onWarning]);

  // Événements d'activité à surveiller
  const activityEvents = [
    'mousedown',
    'mousemove', 
    'keypress',
    'scroll',
    'touchstart',
    'click'
  ];

  useEffect(() => {
    if (!enabled) {
      setIsActive(false);
      setShowWarning(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    // Vérifier l'activité stockée au démarrage
    const isValidSession = checkStoredActivity();
    
    if (isValidSession) {
      resetTimer();
    }

    // Debounce pour éviter trop d'appels
    let debounceTimer: NodeJS.Timeout;
    const debouncedResetTimer = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(resetTimer, 500);
    };

    // Ajouter les écouteurs d'événements
    activityEvents.forEach(event => {
      document.addEventListener(event, debouncedResetTimer, true);
    });

    // Nettoyer à la déconnexion
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, debouncedResetTimer, true);
      });
      clearTimeout(debounceTimer);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      localStorage.removeItem('lastActivity');
    };
  }, [enabled, resetTimer, checkStoredActivity]);

  return {
    isActive,
    showWarning,
    timeLeft,
    isPaused,
    extendSession,
    resetTimer,
    pauseTimer,
    resumeTimer
  };
};