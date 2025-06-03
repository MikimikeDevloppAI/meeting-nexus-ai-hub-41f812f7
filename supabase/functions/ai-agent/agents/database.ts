
export interface DatabaseContext {
  meetings: any[];
  documents: any[];
  todos: any[];
  relevantIds: {
    meetingIds: string[];
    documentIds: string[];
  };
}

export class DatabaseAgent {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async searchContext(analysis: any): Promise<DatabaseContext> {
    console.log('[DATABASE] Starting context search based on analysis');
    
    const context: DatabaseContext = {
      meetings: [],
      documents: [],
      todos: [],
      relevantIds: { meetingIds: [], documentIds: [] }
    };

    // Récupérer les réunions (avec focus sur les récentes si demandé)
    const { data: meetings } = await this.supabase
      .from('meetings')
      .select('id, title, transcript, summary, created_at')
      .not('transcript', 'is', null)
      .order('created_at', { ascending: false })
      .limit(analysis.timeContext === 'récent' ? 3 : 10);

    if (meetings && meetings.length > 0) {
      context.meetings = meetings;
      context.relevantIds.meetingIds = meetings.map((m: any) => m.id);
      console.log(`[DATABASE] 📋 Found ${meetings.length} meetings`);
    }

    // Récupérer les documents
    const { data: documents } = await this.supabase
      .from('uploaded_documents')
      .select('id, ai_generated_name, original_name, extracted_text, ai_summary, created_at')
      .not('extracted_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (documents && documents.length > 0) {
      context.documents = documents;
      context.relevantIds.documentIds = documents.map((d: any) => d.id);
      console.log(`[DATABASE] 📁 Found ${documents.length} documents`);
    }

    // Récupérer les tâches
    const { data: todos } = await this.supabase
      .from('todos')
      .select('id, description, status, due_date, created_at, assigned_to')
      .order('created_at', { ascending: false })
      .limit(20);

    if (todos && todos.length > 0) {
      context.todos = todos;
      console.log(`[DATABASE] ✅ Found ${todos.length} todos`);
    }

    return context;
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
}
