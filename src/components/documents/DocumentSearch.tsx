
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X, Filter, Calendar, FileType, Tag } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DocumentSearchProps {
  onSearch: (filters: SearchFilters) => void;
  documents: any[];
}

interface SearchFilters {
  query: string;
  category?: string;
  documentType?: string;
  dateRange?: string;
  keywords?: string[];
}

export const DocumentSearch = ({ onSearch, documents }: DocumentSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({ query: "" });
  const [showFilters, setShowFilters] = useState(false);

  // Extraire les catégories uniques des documents
  const categories = Array.from(new Set(
    documents
      .filter(doc => doc.taxonomy?.category)
      .map(doc => doc.taxonomy.category)
  ));

  const documentTypes = Array.from(new Set(
    documents
      .filter(doc => doc.taxonomy?.documentType)
      .map(doc => doc.taxonomy.documentType)
  ));

  // Extraire tous les mots-clés uniques des documents
  const allKeywords = Array.from(new Set(
    documents
      .filter(doc => doc.taxonomy?.keywords)
      .flatMap(doc => doc.taxonomy.keywords || [])
  ));

  const handleSearch = (newFilters: Partial<SearchFilters> = {}) => {
    const filters = { ...activeFilters, query: searchQuery, ...newFilters };
    setActiveFilters(filters);
    onSearch(filters);
  };

  const clearFilter = (filterKey: keyof SearchFilters) => {
    const newFilters = { ...activeFilters };
    delete newFilters[filterKey];
    setActiveFilters(newFilters);
    onSearch(newFilters);
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setActiveFilters({ query: "" });
    onSearch({ query: "" });
  };

  const toggleKeyword = (keyword: string) => {
    const currentKeywords = activeFilters.keywords || [];
    const newKeywords = currentKeywords.includes(keyword)
      ? currentKeywords.filter(k => k !== keyword)
      : [...currentKeywords, keyword];
    
    handleSearch({ keywords: newKeywords.length > 0 ? newKeywords : undefined });
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Barre de recherche principale */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, contenu, résumé..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={() => handleSearch()}>
              Rechercher
            </Button>
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtres
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <h4 className="font-medium">Filtres avancés</h4>
                  
                  {/* Filtre par catégorie */}
                  {categories.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Catégorie</label>
                      <Command>
                        <CommandInput placeholder="Sélectionner une catégorie..." />
                        <CommandList>
                          <CommandEmpty>Aucune catégorie trouvée.</CommandEmpty>
                          <CommandGroup>
                            {categories.map((category) => (
                              <CommandItem
                                key={category}
                                onSelect={() => {
                                  handleSearch({ category });
                                  setShowFilters(false);
                                }}
                              >
                                <Tag className="h-4 w-4 mr-2" />
                                {category}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </div>
                  )}
                  
                  {/* Filtre par type de document */}
                  {documentTypes.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Type de document</label>
                      <Command>
                        <CommandInput placeholder="Sélectionner un type..." />
                        <CommandList>
                          <CommandEmpty>Aucun type trouvé.</CommandEmpty>
                          <CommandGroup>
                            {documentTypes.map((type) => (
                              <CommandItem
                                key={type}
                                onSelect={() => {
                                  handleSearch({ documentType: type });
                                  setShowFilters(false);
                                }}
                              >
                                <FileType className="h-4 w-4 mr-2" />
                                {type}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </div>
                  )}

                  {/* Filtre par mots-clés */}
                  {allKeywords.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Mots-clés</label>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {allKeywords.map((keyword) => (
                          <div key={keyword} className="flex items-center space-x-2">
                            <Checkbox
                              id={keyword}
                              checked={activeFilters.keywords?.includes(keyword) || false}
                              onCheckedChange={() => toggleKeyword(keyword)}
                            />
                            <label 
                              htmlFor={keyword} 
                              className="text-sm cursor-pointer"
                            >
                              {keyword}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Filtre par date */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Période</label>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          handleSearch({ dateRange: 'today' });
                          setShowFilters(false);
                        }}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Aujourd'hui
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          handleSearch({ dateRange: 'week' });
                          setShowFilters(false);
                        }}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Cette semaine
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          handleSearch({ dateRange: 'month' });
                          setShowFilters(false);
                        }}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Ce mois
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Filtres actifs */}
          {(activeFilters.query || activeFilters.category || activeFilters.documentType || activeFilters.dateRange || activeFilters.keywords?.length) && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">Filtres actifs:</span>
              
              {activeFilters.query && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  "{activeFilters.query}"
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => {
                      setSearchQuery("");
                      clearFilter('query');
                    }}
                  />
                </Badge>
              )}
              
              {activeFilters.category && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Catégorie: {activeFilters.category}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => clearFilter('category')} />
                </Badge>
              )}
              
              {activeFilters.documentType && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Type: {activeFilters.documentType}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => clearFilter('documentType')} />
                </Badge>
              )}
              
              {activeFilters.keywords?.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="flex items-center gap-1">
                  {keyword}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => toggleKeyword(keyword)} 
                  />
                </Badge>
              ))}
              
              {activeFilters.dateRange && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  {activeFilters.dateRange === 'today' ? 'Aujourd\'hui' :
                   activeFilters.dateRange === 'week' ? 'Cette semaine' :
                   activeFilters.dateRange === 'month' ? 'Ce mois' : activeFilters.dateRange}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => clearFilter('dateRange')} />
                </Badge>
              )}
              
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                Effacer tout
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
