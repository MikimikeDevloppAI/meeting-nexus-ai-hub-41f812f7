
export interface EmbeddingContext {
  chunks: any[];
  sources: any[];
  hasRelevantContext: boolean;
  searchIterations: number;
  finalSearchTerms: string[];
  fuzzyResults: any[];
  expansionLevel: number;
}

export class EmbeddingsAgent {
  private openaiApiKey: string;
  private supabase: any;

  constructor(openaiApiKey: string, supabase: any) {
    this.openaiApiKey = openaiApiKey;
    this.supabase = supabase;
  }

  async searchEmbeddings(
    message: string, 
    analysis: any,
    relevantIds?: { meetingIds: string[], documentIds: string[], todoIds: string[], participantIds: string[] }
  ): Promise<EmbeddingContext> {
    console.log('[EMBEDDINGS] RECHERCHE VECTORIELLE ULTRA-AGRESSIVE pour enrichissement maximum');
    
    let searchIterations = 0;
    let allChunks: any[] = [];
    let allSources: any[] = [];
    let fuzzyResults: any[] = [];
    let expansionLevel = 0;
    
    // PHASE 1: RECHERCHE PRINCIPALE (seuil ultra-bas pour capturer plus de contenu)
    console.log('[EMBEDDINGS] 🎯 Phase 1: Recherche principale ultra-agressive');
    let searchResults = await this.performSearchUltraAggressive(message, relevantIds, 0.12); // Seuil réduit de 0.15 à 0.12
    searchIterations++;
    
    if (searchResults.chunks.length > 0) {
      allChunks.push(...searchResults.chunks);
      allSources.push(...searchResults.sources);
      console.log(`[EMBEDDINGS] ✅ Phase 1: ${searchResults.chunks.length} chunks trouvés (seuil 0.12)`);
    }
    
    // PHASE 2: RECHERCHE AVEC TOUS LES TERMES (expansion maximale)
    console.log('[EMBEDDINGS] 🔄 Phase 2: Expansion maximale avec tous les termes');
    for (const term of analysis.searchTerms) {
      if (searchIterations >= 10) break; // Plus d'itérations
      
      const termResults = await this.performSearchUltraAggressive(term, relevantIds, 0.08); // Seuil encore plus bas
      searchIterations++;
      
      if (termResults.chunks.length > 0) {
        allChunks.push(...termResults.chunks);
        allSources.push(...termResults.sources);
        console.log(`[EMBEDDINGS] ✅ Phase 2: ${termResults.chunks.length} chunks pour "${term}" (seuil 0.08)`);
      }
    }
    
    // PHASE 3: RECHERCHE AVEC TOUS LES SYNONYMES (systématique)
    console.log('[EMBEDDINGS] 🔄 Phase 3: Recherche systématique avec synonymes');
    for (const synonym of analysis.synonyms.slice(0, 10)) { // Plus de synonymes
      if (searchIterations >= 15) break;
      
      const synonymResults = await this.performSearchUltraAggressive(synonym, relevantIds, 0.10); // Seuil adapté
      searchIterations++;
      
      if (synonymResults.chunks.length > 0) {
        allChunks.push(...synonymResults.chunks);
        allSources.push(...synonymResults.sources);
        console.log(`[EMBEDDINGS] ✅ Phase 3: ${synonymResults.chunks.length} chunks pour synonyme "${synonym}"`);
      }
    }
    
    // PHASE 4: RECHERCHE FUZZY SI ENABLED
    if (analysis.fuzzyMatching && allChunks.length < 10) { // Seuil augmenté
      console.log('[EMBEDDINGS] 🔄 Phase 4: Recherche fuzzy activée');
      fuzzyResults = await this.performFuzzyEmbeddingSearch(message, analysis, relevantIds);
      searchIterations += fuzzyResults.length;
      
      if (fuzzyResults.length > 0) {
        allChunks.push(...fuzzyResults.flatMap(fr => fr.chunks));
        allSources.push(...fuzzyResults.flatMap(fr => fr.sources));
        console.log(`[EMBEDDINGS] ✅ Phase 4: ${fuzzyResults.length} résultats fuzzy trouvés`);
      }
    }
    
    // PHASE 5: RECHERCHE GÉNÉRALE SANS FILTRES (dernière chance)
    if (allChunks.length < 5) { // Seuil augmenté
      console.log('[EMBEDDINGS] 🔄 Phase 5: Recherche générale sans filtres (dernière chance)');
      const generalResults = await this.performSearchUltraAggressive(message, undefined, 0.03); // Seuil minimal
      searchIterations++;
      expansionLevel = 5;
      
      if (generalResults.chunks.length > 0) {
        allChunks.push(...generalResults.chunks);
        allSources.push(...generalResults.sources);
        console.log(`[EMBEDDINGS] ✅ Phase 5: ${generalResults.chunks.length} chunks en recherche générale (seuil 0.03)`);
      }
    }
    
    // PHASE 6: EXPANSION CONTEXTUELLE OPHTACARE
    if (allChunks.length < 8) { // Seuil augmenté
      console.log('[EMBEDDINGS] 🔄 Phase 6: Expansion contextuelle OphtaCare spécialisée');
      const ophtalmoTerms = this.generateOphtalmoExpansion(message, analysis);
      
      for (const ophtalmoTerm of ophtalmoTerms.slice(0, 6)) { // Plus de termes
        if (searchIterations >= 18) break;
        
        const ophtalmoResults = await this.performSearchUltraAggressive(ophtalmoTerm, relevantIds, 0.06); // Seuil très bas
        searchIterations++;
        
        if (ophtalmoResults.chunks.length > 0) {
          allChunks.push(...ophtalmoResults.chunks);
          allSources.push(...ophtalmoResults.sources);
          console.log(`[EMBEDDINGS] ✅ Phase 6: ${ophtalmoResults.chunks.length} chunks OphtaCare pour "${ophtalmoTerm}"`);
        }
      }
      expansionLevel = 6;
    }
    
    // NETTOYAGE ET TRI INTELLIGENT
    const uniqueChunks = this.removeDuplicateChunksEnhanced(allChunks);
    const sortedChunks = this.smartSortChunks(uniqueChunks, message, analysis);
    const finalChunks = sortedChunks.slice(0, 20); // Plus de chunks finaux
    
    const finalSources = this.generateEnhancedSources(finalChunks);
    
    console.log(`[EMBEDDINGS] ✅ RECHERCHE ULTRA-AGRESSIVE TERMINÉE: ${searchIterations} itérations, ${finalChunks.length} chunks uniques, niveau expansion: ${expansionLevel}`);
    
    // Log détaillé des meilleurs résultats
    if (finalChunks.length > 0) {
      console.log('[EMBEDDINGS] 📊 TOP 5 RÉSULTATS:');
      finalChunks.slice(0, 5).forEach((chunk, i) => {
        console.log(`  ${i+1}. Similarité: ${chunk.similarity?.toFixed(3)}, Score: ${chunk.relevanceScore || 0}, Texte: "${chunk.chunk_text?.substring(0, 120)}..."`);
      });
    } else {
      console.log('[EMBEDDINGS] ⚠️ AUCUN RÉSULTAT - recherche ultra-agressive a échoué');
    }
    
    return {
      chunks: finalChunks,
      sources: finalSources,
      hasRelevantContext: finalChunks.length > 0,
      searchIterations,
      finalSearchTerms: analysis.searchTerms,
      fuzzyResults,
      expansionLevel
    };
  }

  private async performSearchUltraAggressive(
    query: string, 
    relevantIds?: { meetingIds: string[], documentIds: string[], todoIds: string[], participantIds: string[] },
    threshold: number = 0.08 // Seuil par défaut réduit
  ): Promise<{ chunks: any[], sources: any[] }> {
    try {
      console.log(`[EMBEDDINGS] 🔍 Recherche ultra-agressive: "${query}" (seuil: ${threshold})`);
      
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: query,
        }),
      });

      if (!embeddingResponse.ok) {
        throw new Error(`Embedding API error: ${embeddingResponse.status}`);
      }

      const embeddingData = await embeddingResponse.json();
      const queryEmbedding = embeddingData.data[0].embedding;

      let searchResults;
      
      // Recherche avec count plus élevé et seuil plus permissif
      const { data: generalResults, error } = await this.supabase.rpc('search_document_embeddings', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: 30 // Plus de résultats par recherche
      });

      if (!error && generalResults) {
        // Filtrage optionnel par IDs pertinents mais plus permissif
        if (relevantIds && (relevantIds.meetingIds.length > 0 || relevantIds.documentIds.length > 0)) {
          const filteredResults = generalResults.filter((result: any) => 
            relevantIds.meetingIds.includes(result.meeting_id) ||
            relevantIds.documentIds.includes(result.document_id)
          );
          
          // Si filtrage donne peu de résultats, garder plus de résultats généraux
          if (filteredResults.length < 5) { // Seuil réduit de 3 à 5
            console.log('[EMBEDDINGS] 🔄 Filtrage strict donne peu de résultats, utilisation générale étendue');
            searchResults = generalResults.slice(0, 20); // Garder plus de résultats
          } else {
            searchResults = filteredResults;
          }
        } else {
          searchResults = generalResults;
        }
      }

      if (searchResults && searchResults.length > 0) {
        console.log(`[EMBEDDINGS] ✅ ${searchResults.length} résultats ultra-agressifs pour "${query}"`);
        const sources = this.generateEnhancedSources(searchResults);
        return { chunks: searchResults, sources };
      } else {
        console.log(`[EMBEDDINGS] ❌ Aucun résultat ultra-agressif pour "${query}" (seuil: ${threshold})`);
      }

      return { chunks: [], sources: [] };

    } catch (error) {
      console.error('[EMBEDDINGS] ❌ Erreur recherche ultra-agressive:', error);
      return { chunks: [], sources: [] };
    }
  }

  private async performFuzzyEmbeddingSearch(
    originalQuery: string,
    analysis: any,
    relevantIds?: any
  ): Promise<any[]> {
    console.log('[EMBEDDINGS] 🔍 Recherche fuzzy embedding activée');
    
    const fuzzyVariants = this.generateFuzzyVariants(originalQuery, analysis);
    const fuzzyResults = [];
    
    for (const variant of fuzzyVariants.slice(0, 4)) {
      const result = await this.performSearchUltraAggressive(variant, relevantIds, 0.08);
      if (result.chunks.length > 0) {
        fuzzyResults.push({
          originalTerm: variant,
          chunks: result.chunks,
          sources: result.sources,
          fuzzyType: 'variant'
        });
      }
    }
    
    return fuzzyResults;
  }

  private generateFuzzyVariants(query: string, analysis: any): string[] {
    const variants = [];
    
    // Variantes orthographiques communes
    const commonVariants: { [key: string]: string[] } = {
      'fischer': ['fisher', 'fischar', 'fischer', 'fishcher'],
      'dupixent': ['dupixent', 'dupilumab', 'dupixant', 'dupixant'],
      'clim': ['clim', 'climat', 'climatic', 'climatisation'],
      'règles': ['règles', 'regles', 'règlement', 'rules']
    };
    
    const words = query.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (commonVariants[word]) {
        variants.push(...commonVariants[word]);
      }
    });
    
    // Ajout des synonymes comme variantes
    variants.push(...analysis.synonyms.slice(0, 5));
    
    return [...new Set(variants)];
  }

  private generateOphtalmoExpansion(message: string, analysis: any): string[] {
    const ophtalmoTerms = [];
    
    // Expansion spécialisée selon le contenu
    if (message.includes('dupixent') || message.includes('bonus')) {
      ophtalmoTerms.push(
        'dupilumab traitement dermatologie',
        'bonus remboursement assurance',
        'règles indemnisation médical',
        'protocole prescription dupixent',
        'critères éligibilité traitement'
      );
    }
    
    if (message.includes('fischer') || message.includes('fisher')) {
      ophtalmoTerms.push(
        'monsieur fischer patient',
        'dossier fischer médical',
        'consultation fischer ophtalmo',
        'suivi patient fischer'
      );
    }
    
    if (message.includes('clim') || message.includes('climat')) {
      ophtalmoTerms.push(
        'climatisation cabinet médical',
        'température salle consultation',
        'air conditionné ophtalmologie',
        'confort patient climat'
      );
    }
    
    // Termes généraux OphtaCare
    ophtalmoTerms.push(
      'cabinet ophtalmologie tabibian',
      'consultation ophtalmo genève',
      'gestion administrative médical',
      'planning patient rendez-vous'
    );
    
    return ophtalmoTerms;
  }

  private removeDuplicateChunksEnhanced(chunks: any[]): any[] {
    const seen = new Map();
    return chunks.filter(chunk => {
      const key = `${chunk.document_id || chunk.meeting_id}-${chunk.chunk_index}`;
      if (seen.has(key)) {
        // Garder celui avec la meilleure similarité
        const existing = seen.get(key);
        if ((chunk.similarity || 0) > (existing.similarity || 0)) {
          seen.set(key, chunk);
          return true;
        }
        return false;
      }
      seen.set(key, chunk);
      return true;
    });
  }

  private smartSortChunks(chunks: any[], originalQuery: string, analysis: any): any[] {
    return chunks.map(chunk => {
      let relevanceScore = chunk.similarity || 0;
      
      // Bonus pour correspondance exacte avec termes de recherche
      analysis.searchTerms.forEach(term => {
        if (chunk.chunk_text?.toLowerCase().includes(term.toLowerCase())) {
          relevanceScore += 0.1;
        }
      });
      
      // Bonus pour correspondance avec entités spécifiques
      analysis.specificEntities.forEach(entity => {
        if (chunk.chunk_text?.toLowerCase().includes(entity.toLowerCase())) {
          relevanceScore += 0.15;
        }
      });
      
      // Bonus pour contexte médical OphtaCare
      const medicalTerms = ['ophtalmologie', 'cabinet', 'patient', 'consultation', 'traitement', 'médical'];
      medicalTerms.forEach(term => {
        if (chunk.chunk_text?.toLowerCase().includes(term)) {
          relevanceScore += 0.05;
        }
      });
      
      return { ...chunk, relevanceScore };
    }).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  private generateEnhancedSources(chunks: any[]): any[] {
    return chunks.map((result: any) => ({
      type: 'document_embedding',
      title: result.metadata?.title || result.document_type || 'Document OphtaCare',
      similarity: result.similarity,
      relevanceScore: result.relevanceScore,
      chunk_index: result.chunk_index,
      source_id: result.document_id || result.meeting_id,
      context: result.chunk_text?.substring(0, 150) + '...'
    }));
  }

  async searchWithFallback(
    originalQuery: string,
    expandedTerms: string[],
    relevantIds?: any
  ): Promise<EmbeddingContext> {
    console.log('[EMBEDDINGS] 🔄 Recherche fallback ultra-intensive avec termes étendus');
    
    let allChunks: any[] = [];
    let searchIterations = 0;
    
    // Recherche avec chaque terme étendu avec seuils très bas
    for (const term of expandedTerms) {
      const result = await this.performSearchUltraAggressive(term, relevantIds, 0.05); // Seuil minimal
      searchIterations++;
      
      if (result.chunks.length > 0) {
        allChunks.push(...result.chunks);
      }
    }
    
    const uniqueChunks = this.removeDuplicateChunksEnhanced(allChunks);
    const sources = this.generateEnhancedSources(uniqueChunks);
    
    console.log(`[EMBEDDINGS] ✅ Fallback ultra-intensif: ${uniqueChunks.length} chunks uniques trouvés`);
    
    return {
      chunks: uniqueChunks,
      sources: sources,
      hasRelevantContext: uniqueChunks.length > 0,
      searchIterations: searchIterations,
      finalSearchTerms: expandedTerms,
      fuzzyResults: [],
      expansionLevel: 7
    };
  }
}
