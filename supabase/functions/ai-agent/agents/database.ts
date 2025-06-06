
export interface DatabaseContext {
  meetings: any[];
  documents: any[];
  todos: any[];
  participants: any[];
  relevantIds: {
    meetingIds: string[];
    documentIds: string[];
    todoIds: string[];
    participantIds: string[];
  };
  targetedExtracts?: {
    entity: string;
    sections: string[];
  };
  fuzzyMatches?: {
    originalTerm: string;
    matches: any[];
  }[];
}

export class DatabaseAgent {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async searchContext(analysis: any): Promise<DatabaseContext> {
    console.log('[DATABASE] Recherche contexte ENRICHIE avec accès tâches et fuzzy matching');
    
    const context: DatabaseContext = {
      meetings: [],
      documents: [],
      todos: [],
      participants: [],
      relevantIds: { meetingIds: [], documentIds: [], todoIds: [], participantIds: [] }
    };

    // 1. RÉCUPÉRATION SYSTÉMATIQUE DES TÂCHES avec participants
    console.log('[DATABASE] 📋 Récupération complète des tâches avec participants');
    const { data: allTodos } = await this.supabase
      .from('todos')
      .select(`
        id, description, status, due_date, created_at, assigned_to,
        participants:todo_participants(
          participant:participants(id, name, email)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50); // Plus de tâches pour contexte enrichi

    if (allTodos && allTodos.length > 0) {
      const filteredTodos = this.filterTodosByRelevanceEnhanced(allTodos, analysis);
      context.todos = filteredTodos;
      context.relevantIds.todoIds = filteredTodos.map((t: any) => t.id);
      console.log(`[DATABASE] ✅ ${filteredTodos.length} tâches trouvées avec participants`);
    }

    // 2. RÉCUPÉRATION DES PARTICIPANTS avec fuzzy matching
    console.log('[DATABASE] 👥 Récupération participants avec fuzzy matching');
    const { data: allParticipants } = await this.supabase
      .from('participants')
      .select('id, name, email, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (allParticipants && allParticipants.length > 0) {
      const filteredParticipants = this.filterParticipantsWithFuzzy(allParticipants, analysis);
      context.participants = filteredParticipants;
      context.relevantIds.participantIds = filteredParticipants.map((p: any) => p.id);
      console.log(`[DATABASE] ✅ ${filteredParticipants.length} participants trouvés`);
    }

    // 3. RECHERCHE RÉUNIONS ENRICHIE
    console.log('[DATABASE] 📋 Recherche réunions enrichie');
    const { data: meetings } = await this.supabase
      .from('meetings')
      .select('id, title, transcript, summary, created_at')
      .not('transcript', 'is', null)
      .order('created_at', { ascending: false })
      .limit(analysis.timeContext === 'récent' ? 10 : 25); // Plus de réunions

    if (meetings && meetings.length > 0) {
      const filteredMeetings = this.filterMeetingsByRelevanceEnhanced(meetings, analysis);
      context.meetings = filteredMeetings;
      context.relevantIds.meetingIds = filteredMeetings.map((m: any) => m.id);
      console.log(`[DATABASE] 📋 ${filteredMeetings.length} réunions pertinentes trouvées`);
      
      // Extraction ciblée si nécessaire
      if (analysis.targetedExtraction) {
        context.targetedExtracts = await this.extractTargetedSectionsEnhanced(
          filteredMeetings, 
          analysis.targetedExtraction,
          analysis.fuzzyMatching
        );
      }
    }

    // 4. RECHERCHE DOCUMENTS ENRICHIE
    console.log('[DATABASE] 📁 Recherche documents enrichie');
    const { data: documents } = await this.supabase
      .from('uploaded_documents')
      .select('id, ai_generated_name, original_name, extracted_text, ai_summary, created_at')
      .not('extracted_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(15); // Plus de documents

    if (documents && documents.length > 0) {
      const filteredDocuments = this.filterDocumentsByRelevanceEnhanced(documents, analysis);
      context.documents = filteredDocuments;
      context.relevantIds.documentIds = filteredDocuments.map((d: any) => d.id);
      console.log(`[DATABASE] 📁 ${filteredDocuments.length} documents pertinents trouvés`);
    }

    // 5. FUZZY MATCHING RESULTS
    if (analysis.fuzzyMatching && analysis.specificEntities && analysis.specificEntities.length > 0) {
      context.fuzzyMatches = await this.performFuzzyMatching(analysis.specificEntities, context);
    }

    console.log(`[DATABASE] ✅ Contexte enrichi complet: ${context.meetings.length} réunions, ${context.documents.length} documents, ${context.todos.length} tâches, ${context.participants.length} participants`);

    return context;
  }

  private filterTodosByRelevanceEnhanced(todos: any[], analysis: any): any[] {
    if (!analysis.searchTerms || analysis.searchTerms.length === 0) {
      return todos.slice(0, 20); // Plus de tâches par défaut
    }

    // Assurer que synonyms existe et est un tableau
    const synonyms = analysis.synonyms || [];
    const allTerms = [...analysis.searchTerms, ...synonyms];
    
    return todos.filter(todo => {
      const searchText = `${todo.description} ${todo.status} ${todo.assigned_to || ''}`.toLowerCase();
      
      // Recherche dans les participants associés
      const participantText = todo.participants?.map((tp: any) => 
        `${tp.participant?.name || ''} ${tp.participant?.email || ''}`
      ).join(' ').toLowerCase() || '';
      
      const fullSearchText = `${searchText} ${participantText}`;
      
      return allTerms.some(term => 
        fullSearchText.includes(term.toLowerCase()) ||
        this.fuzzyMatch(term.toLowerCase(), fullSearchText, 0.8)
      );
    }).slice(0, 15); // Limite raisonnable mais généreuse
  }

  private filterParticipantsWithFuzzy(participants: any[], analysis: any): any[] {
    if (!analysis.searchTerms || analysis.searchTerms.length === 0) {
      return participants.slice(0, 10);
    }

    // Assurer que synonyms existe et est un tableau
    const synonyms = analysis.synonyms || [];
    const allTerms = [...analysis.searchTerms, ...synonyms];
    
    return participants.filter(participant => {
      const searchText = `${participant.name} ${participant.email}`.toLowerCase();
      
      return allTerms.some(term => {
        const lowerTerm = term.toLowerCase();
        // Recherche exacte ou fuzzy
        return searchText.includes(lowerTerm) ||
               this.fuzzyMatch(lowerTerm, searchText, 0.7) ||
               // Recherche partielle pour noms
               this.partialNameMatch(lowerTerm, participant.name.toLowerCase());
      });
    });
  }

  private filterMeetingsByRelevanceEnhanced(meetings: any[], analysis: any): any[] {
    if (!analysis.searchTerms || analysis.searchTerms.length === 0) {
      return meetings.slice(0, 8);
    }

    // Assurer que synonyms existe et est un tableau
    const synonyms = analysis.synonyms || [];
    const allTerms = [...analysis.searchTerms, ...synonyms];
    
    const scoredMeetings = meetings.map(meeting => {
      const searchText = `${meeting.title} ${meeting.transcript || ''} ${meeting.summary || ''}`.toLowerCase();
      let score = 0;
      
      // Score basé sur correspondances
      allTerms.forEach(term => {
        const lowerTerm = term.toLowerCase();
        if (searchText.includes(lowerTerm)) {
          score += 2;
        } else if (this.fuzzyMatch(lowerTerm, searchText, 0.8)) {
          score += 1;
        }
      });
      
      return { ...meeting, relevanceScore: score };
    });

    return scoredMeetings
      .filter(m => m.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 8);
  }

  private filterDocumentsByRelevanceEnhanced(documents: any[], analysis: any): any[] {
    if (!analysis.searchTerms || analysis.searchTerms.length === 0) {
      return documents.slice(0, 8);
    }

    // Assurer que synonyms existe et est un tableau
    const synonyms = analysis.synonyms || [];
    const allTerms = [...analysis.searchTerms, ...synonyms];
    
    const scoredDocuments = documents.map(doc => {
      const searchText = `${doc.ai_generated_name || ''} ${doc.original_name} ${doc.extracted_text || ''} ${doc.ai_summary || ''}`.toLowerCase();
      let score = 0;
      
      allTerms.forEach(term => {
        const lowerTerm = term.toLowerCase();
        if (searchText.includes(lowerTerm)) {
          score += 2;
        } else if (this.fuzzyMatch(lowerTerm, searchText, 0.8)) {
          score += 1;
        }
      });
      
      return { ...doc, relevanceScore: score };
    });

    return scoredDocuments
      .filter(d => d.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 8);
  }

  private fuzzyMatch(term: string, text: string, threshold: number = 0.8): boolean {
    // Implémentation simple de fuzzy matching
    const words = text.split(/\s+/);
    
    return words.some(word => {
      if (word.length === 0 || term.length === 0) return false;
      
      const longer = word.length > term.length ? word : term;
      const shorter = word.length > term.length ? term : word;
      
      if (longer.length === 0) return true;
      
      const similarity = (longer.length - this.levenshteinDistance(longer, shorter)) / longer.length;
      return similarity >= threshold;
    });
  }

  private partialNameMatch(term: string, name: string): boolean {
    // Recherche partielle pour noms (mr fischer -> fischer)
    const nameParts = name.split(/\s+/);
    const termParts = term.split(/\s+/);
    
    return termParts.some(termPart => 
      nameParts.some(namePart => 
        namePart.includes(termPart) || termPart.includes(namePart) ||
        this.levenshteinDistance(termPart, namePart) <= 2
      )
    );
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private async performFuzzyMatching(entities: string[], context: DatabaseContext): Promise<any[]> {
    console.log('[DATABASE] 🔍 Fuzzy matching pour entités:', entities);
    
    const fuzzyMatches = [];
    
    for (const entity of entities) {
      const matches = {
        originalTerm: entity,
        matches: []
      };
      
      // Recherche dans participants
      context.participants.forEach(p => {
        if (this.fuzzyMatch(entity, p.name, 0.7) || this.partialNameMatch(entity, p.name)) {
          matches.matches.push({ type: 'participant', data: p, similarity: 'fuzzy' });
        }
      });
      
      // Recherche dans tâches
      context.todos.forEach(t => {
        if (this.fuzzyMatch(entity, t.description, 0.7)) {
          matches.matches.push({ type: 'todo', data: t, similarity: 'fuzzy' });
        }
      });
      
      if (matches.matches.length > 0) {
        fuzzyMatches.push(matches);
      }
    }
    
    console.log(`[DATABASE] ✅ ${fuzzyMatches.length} correspondances fuzzy trouvées`);
    return fuzzyMatches;
  }

  private async extractTargetedSectionsEnhanced(meetings: any[], targetedExtraction: any, fuzzyMatching: boolean = false): Promise<any> {
    console.log('[DATABASE] 🎯 Extraction ciblée renforcée pour:', targetedExtraction.entity);
    
    const sections: string[] = [];
    
    meetings.forEach(meeting => {
      if (meeting.transcript) {
        const transcript = meeting.transcript.toLowerCase();
        const entity = targetedExtraction.entity.toLowerCase();
        
        const sentences = meeting.transcript.split(/[.!?]+/);
        
        let relevantSentences = sentences.filter(sentence => 
          sentence.toLowerCase().includes(entity)
        );
        
        // Si fuzzy matching activé et pas de résultats exacts
        if (fuzzyMatching && relevantSentences.length === 0) {
          relevantSentences = sentences.filter(sentence => 
            this.fuzzyMatch(entity, sentence.toLowerCase(), 0.7)
          );
        }
        
        if (relevantSentences.length > 0) {
          relevantSentences.forEach(targetSentence => {
            const index = sentences.indexOf(targetSentence);
            const contextStart = Math.max(0, index - 3); // Plus de contexte
            const contextEnd = Math.min(sentences.length, index + 4);
            
            const sectionWithContext = sentences.slice(contextStart, contextEnd).join('. ');
            sections.push(sectionWithContext);
          });
        }
      }
    });
    
    console.log(`[DATABASE] ✅ ${sections.length} sections ciblées extraites`);
    
    return {
      entity: targetedExtraction.entity,
      sections: [...new Set(sections)]
    };
  }

  async searchByKeywordsEnhanced(keywords: string[], fuzzyEnabled: boolean = true): Promise<any> {
    console.log('[DATABASE] 🔍 Recherche par mots-clés enrichie:', keywords);
    
    const { data: meetings } = await this.supabase
      .from('meetings')
      .select('id, title, transcript, summary, created_at')
      .not('transcript', 'is', null);

    const { data: todos } = await this.supabase
      .from('todos')
      .select(`
        id, description, status, assigned_to, due_date, created_at,
        participants:todo_participants(
          participant:participants(id, name, email)
        )
      `);

    const relevantMeetings = meetings?.filter(meeting => {
      const searchText = `${meeting.title} ${meeting.transcript || ''} ${meeting.summary || ''}`.toLowerCase();
      return keywords.some(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        return searchText.includes(lowerKeyword) ||
               (fuzzyEnabled && this.fuzzyMatch(lowerKeyword, searchText, 0.8));
      });
    }) || [];

    const relevantTodos = todos?.filter(todo => {
      const searchText = `${todo.description} ${todo.status}`.toLowerCase();
      const participantText = todo.participants?.map((tp: any) => 
        `${tp.participant?.name || ''} ${tp.participant?.email || ''}`
      ).join(' ').toLowerCase() || '';
      
      const fullText = `${searchText} ${participantText}`;
      
      return keywords.some(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        return fullText.includes(lowerKeyword) ||
               (fuzzyEnabled && this.fuzzyMatch(lowerKeyword, fullText, 0.8));
      });
    }) || [];

    return {
      meetings: relevantMeetings.slice(0, 8),
      todos: relevantTodos.slice(0, 10),
      meetingIds: relevantMeetings.slice(0, 8).map(m => m.id),
      todoIds: relevantTodos.slice(0, 10).map(t => t.id)
    };
  }
}
