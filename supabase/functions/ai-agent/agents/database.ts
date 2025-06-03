
export interface DatabaseContext {
  meetings: any[];
  documents: any[];
  todos: any[];
  relevantIds: {
    meetingIds: string[];
    documentIds: string[];
  };
  targetedExtracts?: {
    entity: string;
    sections: string[];
  };
}

export class DatabaseAgent {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async searchContext(analysis: any): Promise<DatabaseContext> {
    console.log('[DATABASE] Starting enhanced context search based on analysis');
    
    const context: DatabaseContext = {
      meetings: [],
      documents: [],
      todos: [],
      relevantIds: { meetingIds: [], documentIds: [] }
    };

    // Enhanced meeting search with intelligent filtering
    const { data: meetings } = await this.supabase
      .from('meetings')
      .select('id, title, transcript, summary, created_at')
      .not('transcript', 'is', null)
      .order('created_at', { ascending: false })
      .limit(analysis.timeContext === 'récent' ? 5 : 15);

    if (meetings && meetings.length > 0) {
      // Intelligent filtering based on search terms
      const filteredMeetings = this.filterMeetingsByRelevance(meetings, analysis);
      context.meetings = filteredMeetings;
      context.relevantIds.meetingIds = filteredMeetings.map((m: any) => m.id);
      console.log(`[DATABASE] 📋 Found ${filteredMeetings.length} relevant meetings`);
      
      // Targeted extraction if needed
      if (analysis.targetedExtraction) {
        context.targetedExtracts = await this.extractTargetedSections(
          filteredMeetings, 
          analysis.targetedExtraction
        );
      }
    }

    // Enhanced document search
    const { data: documents } = await this.supabase
      .from('uploaded_documents')
      .select('id, ai_generated_name, original_name, extracted_text, ai_summary, created_at')
      .not('extracted_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (documents && documents.length > 0) {
      const filteredDocuments = this.filterDocumentsByRelevance(documents, analysis);
      context.documents = filteredDocuments;
      context.relevantIds.documentIds = filteredDocuments.map((d: any) => d.id);
      console.log(`[DATABASE] 📁 Found ${filteredDocuments.length} relevant documents`);
    }

    // Smart todo search
    const { data: todos } = await this.supabase
      .from('todos')
      .select('id, description, status, due_date, created_at, assigned_to')
      .order('created_at', { ascending: false })
      .limit(20);

    if (todos && todos.length > 0) {
      const filteredTodos = this.filterTodosByRelevance(todos, analysis);
      context.todos = filteredTodos;
      console.log(`[DATABASE] ✅ Found ${filteredTodos.length} relevant todos`);
    }

    return context;
  }

  private filterMeetingsByRelevance(meetings: any[], analysis: any): any[] {
    if (!analysis.searchTerms || analysis.searchTerms.length === 0) {
      return meetings;
    }

    const allTerms = [...analysis.searchTerms, ...analysis.synonyms];
    
    return meetings.filter(meeting => {
      const searchText = `${meeting.title} ${meeting.transcript || ''} ${meeting.summary || ''}`.toLowerCase();
      
      // Check if any search term or synonym is found
      return allTerms.some(term => 
        searchText.includes(term.toLowerCase())
      );
    }).slice(0, 5); // Limit to most relevant
  }

  private filterDocumentsByRelevance(documents: any[], analysis: any): any[] {
    if (!analysis.searchTerms || analysis.searchTerms.length === 0) {
      return documents;
    }

    const allTerms = [...analysis.searchTerms, ...analysis.synonyms];
    
    return documents.filter(doc => {
      const searchText = `${doc.ai_generated_name || ''} ${doc.original_name} ${doc.extracted_text || ''} ${doc.ai_summary || ''}`.toLowerCase();
      
      return allTerms.some(term => 
        searchText.includes(term.toLowerCase())
      );
    }).slice(0, 5);
  }

  private filterTodosByRelevance(todos: any[], analysis: any): any[] {
    if (!analysis.searchTerms || analysis.searchTerms.length === 0) {
      return todos;
    }

    const allTerms = [...analysis.searchTerms, ...analysis.synonyms];
    
    return todos.filter(todo => {
      const searchText = todo.description.toLowerCase();
      
      return allTerms.some(term => 
        searchText.includes(term.toLowerCase())
      );
    });
  }

  private async extractTargetedSections(meetings: any[], targetedExtraction: any): Promise<any> {
    console.log('[DATABASE] 🎯 Extracting targeted sections for:', targetedExtraction.entity);
    
    const sections: string[] = [];
    
    meetings.forEach(meeting => {
      if (meeting.transcript) {
        const transcript = meeting.transcript.toLowerCase();
        const entity = targetedExtraction.entity.toLowerCase();
        
        // Split transcript into sentences
        const sentences = meeting.transcript.split(/[.!?]+/);
        
        // Find sentences containing the entity
        const relevantSentences = sentences.filter(sentence => 
          sentence.toLowerCase().includes(entity)
        );
        
        if (relevantSentences.length > 0) {
          // Add context (previous and next sentences)
          relevantSentences.forEach(targetSentence => {
            const index = sentences.indexOf(targetSentence);
            const contextStart = Math.max(0, index - 2);
            const contextEnd = Math.min(sentences.length, index + 3);
            
            const sectionWithContext = sentences.slice(contextStart, contextEnd).join('. ');
            sections.push(sectionWithContext);
          });
        }
      }
    });
    
    console.log(`[DATABASE] ✅ Extracted ${sections.length} targeted sections`);
    
    return {
      entity: targetedExtraction.entity,
      sections: [...new Set(sections)] // Remove duplicates
    };
  }

  async findSpecificMeeting(query: string): Promise<any> {
    console.log('[DATABASE] Searching for specific meeting:', query);
    
    const { data: meetings } = await this.supabase
      .from('meetings')
      .select('id, title, transcript, summary, created_at')
      .not('transcript', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (meetings && meetings.length > 0) {
      console.log('[DATABASE] ✅ Found latest meeting:', meetings[0].title);
      return meetings[0];
    }

    return null;
  }

  async searchByKeywords(keywords: string[]): Promise<any> {
    console.log('[DATABASE] 🔍 Keyword search:', keywords);
    
    // Search in meetings
    const { data: meetings } = await this.supabase
      .from('meetings')
      .select('id, title, transcript, summary, created_at')
      .not('transcript', 'is', null);

    const relevantMeetings = meetings?.filter(meeting => {
      const searchText = `${meeting.title} ${meeting.transcript || ''} ${meeting.summary || ''}`.toLowerCase();
      return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
    }) || [];

    return {
      meetings: relevantMeetings.slice(0, 5),
      meetingIds: relevantMeetings.slice(0, 5).map(m => m.id)
    };
  }
}
