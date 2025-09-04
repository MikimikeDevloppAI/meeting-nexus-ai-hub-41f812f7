import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
  options: { value: string; label: string }[]
  value?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  onSelect: (value: string) => void
  className?: string
  allowCustom?: boolean
  triggerAs?: "button" | "input"
}

export function Combobox({
  options,
  value,
  placeholder = "Sélectionner...",
  searchPlaceholder = "Rechercher...",
  emptyText = "Aucun résultat trouvé.",
  onSelect,
  className,
  allowCustom = false,
  triggerAs = "button",
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [isCreatingNew, setIsCreatingNew] = React.useState(false)

  const handleSelect = (selectedValue: string) => {
    if (selectedValue === "__create_new__") {
      setIsCreatingNew(true)
      setSearch("")
      return
    }
    onSelect(selectedValue === value ? "" : selectedValue)
    setOpen(false)
    setSearch("")
    setIsCreatingNew(false)
  }

  const handleCreateNew = () => {
    if (search.trim()) {
      onSelect(search.trim())
      setOpen(false)
      setSearch("")
      setIsCreatingNew(false)
    }
  }

  const handleCancelCreate = () => {
    setIsCreatingNew(false)
    setSearch("")
  }

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase())
  )

  // Ajouter l'option "Nouveau médecin" si allowCustom est activé
  const allOptions = allowCustom 
    ? [...filteredOptions, { value: "__create_new__", label: "➕ Nouveau médecin" }]
    : filteredOptions

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {isCreatingNew ? (
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom du nouveau médecin"
              className={cn("flex-1", className)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleCreateNew()
                } else if (e.key === "Escape") {
                  e.preventDefault()
                  handleCancelCreate()
                }
              }}
              autoFocus
            />
            <Button 
              type="button" 
              size="sm" 
              onClick={handleCreateNew}
              disabled={!search.trim()}
            >
              ✓
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={handleCancelCreate}
            >
              ✕
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between", className)}
          >
            {value
              ? options.find((option) => option.value === value)?.label || value
              : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-popover border shadow-md z-50" style={{ width: "var(--radix-popover-trigger-width)" }}>
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {allOptions.length === 0 && (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            <CommandGroup>
              {allOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
