
import React from 'react';

export interface PreAgentAnalysis {
  type: 'task_creation' | 'meeting_point' | 'normal_query';
  confidence: number;
  extractedContent?: string;
  reasoning: string;
}

export class PreAgent {
  
  // Fonction principale d'analyse
  static analyzeRequest(message: string): PreAgentAnalysis {
    const normalizedMessage = this.normalizeText(message);
    
    console.log('[PRE-AGENT] 🔍 Analyse de la demande:', message);
    console.log('[PRE-AGENT] 📝 Message normalisé:', normalizedMessage);
    
    // 1. Analyser pour création de tâche
    const taskAnalysis = this.analyzeTaskCreation(normalizedMessage, message);
    if (taskAnalysis.confidence > 0.8) {
      console.log('[PRE-AGENT] ✅ TÂCHE détectée avec confiance:', taskAnalysis.confidence);
      return taskAnalysis;
    }
    
    // 2. Analyser pour point de réunion
    const meetingAnalysis = this.analyzeMeetingPoint(normalizedMessage, message);
    if (meetingAnalysis.confidence > 0.8) {
      console.log('[PRE-AGENT] ✅ POINT RÉUNION détecté avec confiance:', meetingAnalysis.confidence);
      return meetingAnalysis;
    }
    
    // 3. Si ambiguïté, choisir le plus probable
    if (taskAnalysis.confidence > meetingAnalysis.confidence && taskAnalysis.confidence > 0.6) {
      console.log('[PRE-AGENT] ⚖️ TÂCHE choisie par probabilité:', taskAnalysis.confidence);
      return taskAnalysis;
    }
    
    if (meetingAnalysis.confidence > 0.6) {
      console.log('[PRE-AGENT] ⚖️ POINT RÉUNION choisi par probabilité:', meetingAnalysis.confidence);
      return meetingAnalysis;
    }
    
    // 4. Requête normale
    console.log('[PRE-AGENT] 💬 Requête normale détectée');
    return {
      type: 'normal_query',
      confidence: 1.0,
      reasoning: 'Aucun pattern de création de tâche ou de point de réunion détecté'
    };
  }
  
  // Analyse spécifique pour création de tâche
  private static analyzeTaskCreation(normalizedMessage: string, originalMessage: string): PreAgentAnalysis {
    let confidence = 0;
    let reasoning = '';
    
    // Patterns très spécifiques pour tâches
    const strongTaskPatterns = [
      /(?:peux tu|pourrais tu|pourrait tu|tu peux|peut tu)\s+(?:cree|creer|faire|ajouter|crée|créer|mettre|donner|assigner|demander|dire)\s+(?:une|un)?\s*(?:tache|task|action|travail)/i,
      /(?:nouvelle|nouveau)\s+(?:tache|task|action|travail)/i,
      /(?:cree|créer|creer|faire|ajouter)\s+(?:une|un)?\s*(?:tache|task|action|travail)/i
    ];
    
    // Patterns avec assignation de personne
    const personAssignmentPatterns = [
      /(?:demander|dire|confier|assigner|donner|prevenir|rappeler|informer)\s+(?:a|à)\s+(?:emilie|david|leila|hortensia|parmice|sybil)/i,
      /(?:emilie|david|leila|hortensia|parmice|sybil)\s+(?:doit|devrait|peut|pourrait|va|dois)\s+(?:faire|acheter|organiser|preparer|mettre|donner|creer|créer)/i
    ];
    
    // Patterns d'action spécifique
    const actionPatterns = [
      /(?:acheter|achat|commander|commande|organiser|preparer|faire|creer|créer|planifier)/i,
      /(?:formation|cours|apprentissage).*(?:pour|à|avec)\s+(?:emilie|david|leila|hortensia|parmice|sybil)/i
    ];
    
    // Vérification des patterns forts
    const hasStrongPattern = strongTaskPatterns.some(pattern => pattern.test(originalMessage));
    if (hasStrongPattern) {
      confidence += 0.9;
      reasoning += 'Pattern fort de création de tâche détecté. ';
    }
    
    // Vérification assignation de personne
    const hasPersonAssignment = personAssignmentPatterns.some(pattern => pattern.test(originalMessage));
    if (hasPersonAssignment) {
      confidence += 0.8;
      reasoning += 'Assignation à une personne spécifique détectée. ';
    }
    
    // Vérification d'actions spécifiques
    const hasActionPattern = actionPatterns.some(pattern => pattern.test(originalMessage));
    if (hasActionPattern) {
      confidence += 0.6;
      reasoning += 'Action spécifique détectée. ';
    }
    
    // Mots-clés de tâche
    const taskKeywords = ['tache', 'task', 'travail', 'mission', 'action', 'activite', 'todo'];
    const hasTaskKeywords = taskKeywords.some(keyword => normalizedMessage.includes(keyword));
    if (hasTaskKeywords) {
      confidence += 0.4;
      reasoning += 'Mots-clés de tâche présents. ';
    }
    
    // Verbes d'action
    const actionVerbs = ['creer', 'créer', 'faire', 'organiser', 'planifier', 'acheter', 'commander', 'assigner', 'demander'];
    const hasActionVerbs = actionVerbs.some(verb => normalizedMessage.includes(verb));
    if (hasActionVerbs) {
      confidence += 0.3;
      reasoning += 'Verbes d\'action présents. ';
    }
    
    // Limitation de confiance
    confidence = Math.min(confidence, 1.0);
    
    return {
      type: 'task_creation',
      confidence,
      extractedContent: originalMessage,
      reasoning: reasoning.trim() || 'Analyse de création de tâche'
    };
  }
  
  // Analyse spécifique pour point de réunion
  private static analyzeMeetingPoint(normalizedMessage: string, originalMessage: string): PreAgentAnalysis {
    let confidence = 0;
    let reasoning = '';
    
    // Patterns très spécifiques pour réunions
    const strongMeetingPatterns = [
      /(?:peux tu|pourrais tu|tu peux|peut tu)\s+(?:ajouter|mettre|noter|inscrire).*(?:point|sujet|ordre|agenda|reunion)/i,
      /(?:ajouter|mettre|noter|inscrire|rajouter)\s+(?:un|une)?\s*(?:point|sujet).*(?:reunion|ordre|agenda)/i,
      /(?:nouveau|nouvelle)\s+(?:point|sujet).*(?:reunion|ordre|agenda)/i
    ];
    
    // Patterns contextuels réunion
    const meetingContextPatterns = [
      /(?:ordre\s+du\s+jour|agenda)/i,
      /(?:prochaine|suivante)\s+reunion/i,
      /(?:reunion|meeting).*(?:point|sujet|ordre)/i,
      /(?:point|sujet).*(?:reunion|meeting|prochaine)/i
    ];
    
    // Vérification des patterns forts
    const hasStrongPattern = strongMeetingPatterns.some(pattern => pattern.test(originalMessage));
    if (hasStrongPattern) {
      confidence += 0.9;
      reasoning += 'Pattern fort de point de réunion détecté. ';
    }
    
    // Vérification du contexte réunion
    const hasMeetingContext = meetingContextPatterns.some(pattern => pattern.test(originalMessage));
    if (hasMeetingContext) {
      confidence += 0.8;
      reasoning += 'Contexte de réunion détecté. ';
    }
    
    // Mots-clés spécifiques réunion
    const meetingKeywords = ['reunion', 'meeting', 'point', 'ordre', 'agenda', 'sujet'];
    const meetingKeywordCount = meetingKeywords.filter(keyword => normalizedMessage.includes(keyword)).length;
    if (meetingKeywordCount >= 2) {
      confidence += 0.6;
      reasoning += `${meetingKeywordCount} mots-clés de réunion présents. `;
    } else if (meetingKeywordCount === 1) {
      confidence += 0.3;
      reasoning += 'Mot-clé de réunion présent. ';
    }
    
    // Verbes contextuels réunion
    const meetingVerbs = ['ajouter', 'noter', 'inscrire', 'mettre', 'rajouter', 'discuter', 'aborder'];
    const hasMeetingVerbs = meetingVerbs.some(verb => normalizedMessage.includes(verb));
    if (hasMeetingVerbs) {
      confidence += 0.4;
      reasoning += 'Verbes contextuels de réunion présents. ';
    }
    
    // Limitation de confiance
    confidence = Math.min(confidence, 1.0);
    
    return {
      type: 'meeting_point',
      confidence,
      extractedContent: originalMessage,
      reasoning: reasoning.trim() || 'Analyse de point de réunion'
    };
  }
  
  // Normalisation du texte
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
