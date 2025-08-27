import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface SupplierSelectorProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  existingSuppliers: string[];
  className?: string;
  placeholder?: string;
  showBadge?: boolean;
  disabled?: boolean;
}

// Helper function to properly decode and display supplier names
const formatSupplierName = (supplierName?: string): string => {
  if (!supplierName) return '';
  
  try {
    let decoded = supplierName;
    
    // First handle common UTF-8 encoding issues
    decoded = decoded
      .replace(/Ã©/g, 'é')
      .replace(/Ã¨/g, 'è')
      .replace(/Ã /g, 'à')
      .replace(/Ã§/g, 'ç')
      .replace(/Ã´/g, 'ô')
      .replace(/Ã¢/g, 'â')
      .replace(/Ã¯/g, 'ï')
      .replace(/Ã«/g, 'ë')
      .replace(/Ã¹/g, 'ù')
      .replace(/Ã»/g, 'û');
    
    // Try HTML entity decoding
    const textarea = document.createElement('textarea');
    textarea.innerHTML = decoded;
    const htmlDecoded = textarea.value;
    
    if (htmlDecoded !== decoded) {
      decoded = htmlDecoded;
    }
    
    // Try URL decoding if there are % signs
    if (decoded.includes('%')) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch (e) {
        console.warn('URL decoding failed for:', decoded);
      }
    }
    
    return decoded || supplierName;
  } catch (error) {
    console.error('Error decoding supplier name:', error);
    return supplierName;
  }
};

export function SupplierSelector({
  value,
  onChange,
  existingSuppliers,
  className = "",
  placeholder = "Sélectionner ou saisir un fournisseur",
  showBadge = true,
  disabled = false
}: SupplierSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  
  // Initialize search value with current value when dropdown opens
  useEffect(() => {
    if (open) {
      setSearchValue(value || "");
    }
  }, [open, value]);

  // Determine if supplier is new or existing
  const isNewSupplier = useCallback((supplierName: string | null | undefined): boolean => {
    if (!supplierName) return true;
    
    const cleanedName = formatSupplierName(supplierName).toLowerCase().trim();
    
    return !existingSuppliers.some(existing => 
      formatSupplierName(existing).toLowerCase().trim() === cleanedName
    );
  }, [existingSuppliers]);

  // Optimized filtered suppliers with debounce effect
  const filteredSuppliers = useMemo(() => {
    if (!searchValue) return existingSuppliers.slice(0, 50); // Limit initial results
    
    const searchTerm = searchValue.toLowerCase();
    return existingSuppliers
      .filter(supplier => 
        formatSupplierName(supplier).toLowerCase().includes(searchTerm)
      )
      .slice(0, 50); // Limit to 50 results for performance
  }, [existingSuppliers, searchValue]);

  const handleSelect = useCallback((supplierValue: string) => {
    onChange(supplierValue);
    setSearchValue(supplierValue);
    setOpen(false);
  }, [onChange]);

  const handleInputChange = useCallback((inputValue: string) => {
    setSearchValue(inputValue);
    onChange(inputValue);
  }, [onChange]);

  const displayValue = formatSupplierName(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-full justify-between",
                !value && "text-muted-foreground",
                className
              )}
              disabled={disabled}
            >
              {displayValue || placeholder}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0 bg-card border shadow-md z-[100]" style={{ width: 'var(--radix-popover-trigger-width)' }}>
            <Command shouldFilter={false}>
              <CommandInput 
                placeholder="Rechercher ou saisir un fournisseur..." 
                value={searchValue}
                onValueChange={handleInputChange}
                className="border-0"
              />
              <CommandList className="max-h-48">
                <CommandEmpty>
                  <div className="p-2 text-sm text-muted-foreground">
                    {searchValue ? 
                      'Nouveau fournisseur sera créé' : 
                      'Tapez pour rechercher ou créer un nouveau fournisseur'
                    }
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {filteredSuppliers.map((supplier) => {
                    const formattedSupplier = formatSupplierName(supplier);
                    return (
                      <CommandItem
                        key={supplier}
                        value={supplier}
                        onSelect={() => handleSelect(supplier)}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === supplier ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {formattedSupplier}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* New/Existing supplier badge */}
        {showBadge && value && (
          isNewSupplier(value) ? (
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs whitespace-nowrap">
              <UserPlus className="h-3 w-3 mr-1" />
              Nouveau
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs whitespace-nowrap">
              <Users className="h-3 w-3 mr-1" />
              Existant
            </Badge>
          )
        )}
      </div>
    </div>
  );
}