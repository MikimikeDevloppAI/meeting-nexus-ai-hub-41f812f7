
import React from 'react';

export interface PreAgentAnalysis {
  type: 'task_creation' | 'meeting_point' | 'normal_query';
  confidence: number;
  extractedContent?: string;
  reasoning: string;
}

export class PreAgent {
  
  // Fonction principale d'analyse - BEAUCOUP PLUS STRICTE
  static analyzeRequest(message: string): PreAgentAnalysis {
    const normalizedMessage = this.normalizeText(message);
    
    console.log('[PRE-AGENT] 🔍 Analyse STRICTE de la demande:', message);
    console.log('[PRE-AGENT] 📝 Message normalisé:', normalizedMessage);
    
    // 1. Analyser pour création de tâche - SEUIL TRÈS ÉLEVÉ
    const taskAnalysis = this.analyzeTaskCreation(normalizedMessage, message);
    if (taskAnalysis.confidence > 0.95) {
      console.log('[PRE-AGENT] ✅ TÂCHE détectée avec confiance TRÈS ÉLEVÉE:', taskAnalysis.confidence);
      return taskAnalysis;
    }
    
    // 2. Analyser pour point de réunion - SEUIL TRÈS ÉLEVÉ
    const meetingAnalysis = this.analyzeMeetingPoint(normalizedMessage, message);
    if (meetingAnalysis.confidence > 0.95) {
      console.log('[PRE-AGENT] ✅ POINT RÉUNION détecté avec confiance TRÈS ÉLEVÉE:', meetingAnalysis.confidence);
      return meetingAnalysis;
    }
    
    // 3. Si pas assez explicite, traiter comme requête normale
    console.log('[PRE-AGENT] 💬 Requête normale - pas assez explicite pour action');
    return {
      type: 'normal_query',
      confidence: 1.0,
      reasoning: 'Demande pas assez explicite pour créer une action automatique'
    };
  }
  
  // Analyse ULTRA-STRICTE pour création de tâche
  private static analyzeTaskCreation(normalizedMessage: string, originalMessage: string): PreAgentAnalysis {
    let confidence = 0;
    let reasoning = '';
    
    // SEULS les patterns TRÈS EXPLICITES sont acceptés
    const veryExplicitTaskPatterns = [
      // Formulations très directes et explicites uniquement
      /(?:peux tu|pourrais tu|tu peux|peut tu)\s+(?:cree|creer|créer)\s+(?:une|un)?\s*(?:tache|task|travail)/i,
      /(?:ajoute|ajouter|crée|créer|faire)\s+(?:une|un)?\s*(?:nouvelle)?\s*(?:tache|task)\s+(?:pour|à)/i,
      /(?:nouvelle|nouveau)\s+(?:tache|task)\s+(?:pour|à|concernant)/i,
      /(?:cree|créer|creer)\s+(?:moi|nous)?\s*(?:une|un)?\s*(?:tache|task)/i
    ];
    
    // Patterns d'assignation TRÈS EXPLICITES
    const explicitAssignmentPatterns = [
      /(?:peux tu|pourrais tu)\s+(?:demander|dire|confier)\s+(?:a|à)\s+(?:emilie|david|leila|hortensia)\s+(?:de|d')\s+(?:faire|creer|créer|organiser)/i,
      /(?:cree|créer|creer)\s+(?:une|un)?\s*(?:tache|task)\s+(?:pour|à)\s+(?:emilie|david|leila|hortensia)/i
    ];
    
    // Vérification des patterns TRÈS explicites seulement
    const hasVeryExplicitPattern = veryExplicitTaskPatterns.some(pattern => pattern.test(originalMessage));
    if (hasVeryExplicitPattern) {
      confidence = 1.0;
      reasoning = 'Pattern TRÈS explicite de création de tâche détecté. ';
    }
    
    // Vérification assignation TRÈS explicite
    const hasExplicitAssignment = explicitAssignmentPatterns.some(pattern => pattern.test(originalMessage));
    if (hasExplicitAssignment) {
      confidence = Math.max(confidence, 0.98);
      reasoning += 'Assignation TRÈS explicite à une personne détectée. ';
    }
    
    // SUPPRESSION des détections génériques - seules les demandes TRÈS explicites passent
    
    return {
      type: 'task_creation',
      confidence,
      extractedContent: originalMessage,
      reasoning: reasoning.trim() || 'Analyse de création de tâche - pas assez explicite'
    };
  }
  
  // Analyse ULTRA-STRICTE pour point de réunion
  private static analyzeMeetingPoint(normalizedMessage: string, originalMessage: string): PreAgentAnalysis {
    let confidence = 0;
    let reasoning = '';
    
    // SEULS les patterns TRÈS EXPLICITES pour réunions
    const veryExplicitMeetingPatterns = [
      /(?:peux tu|pourrais tu|tu peux)\s+(?:ajouter|mettre|noter)\s+(?:un|une)?\s*(?:point|sujet)\s+(?:a|à|dans)\s*(?:l')?(?:ordre|agenda|reunion)/i,
      /(?:ajoute|ajouter|mettre)\s+(?:un|une)?\s*(?:point|sujet)\s+(?:a|à|dans)\s*(?:l')?(?:ordre|agenda|reunion)/i,
      /(?:nouveau|nouvelle)\s+(?:point|sujet)\s+(?:pour|dans)\s*(?:l')?(?:ordre|agenda|reunion)/i,
      /(?:point|sujet)\s+(?:pour|dans)\s+(?:la|le)?\s*(?:prochaine|prochain)?\s*(?:reunion|meeting|ordre)/i
    ];
    
    // Vérification des patterns TRÈS explicites seulement
    const hasVeryExplicitPattern = veryExplicitMeetingPatterns.some(pattern => pattern.test(originalMessage));
    if (hasVeryExplicitPattern) {
      confidence = 1.0;
      reasoning = 'Pattern TRÈS explicite de point de réunion détecté. ';
    }
    
    // SUPPRESSION de toute détection générique
    
    return {
      type: 'meeting_point',
      confidence,
      extractedContent: originalMessage,
      reasoning: reasoning.trim() || 'Analyse de point de réunion - pas assez explicite'
    };
  }
  
  // Normalisation du texte (gardée identique)
  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
      .replace(/[^a-z0-9\s]/g, ' ') // Remplace la ponctuation par des espaces
      .replace(/\s+/g, ' ') // Remplace les espaces multiples par un seul
      .trim();
  }
}

export default PreAgent;
