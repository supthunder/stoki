"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
  options: { value: string; label: string }[]
  value: string
  onSelect: (value: string) => void
  placeholder?: string
  emptyText?: string
  className?: string
}

export function Combobox({
  options,
  value,
  onSelect,
  placeholder = "Select an option",
  emptyText = "No results found.",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  // Direct selection handler to ensure proper handling
  const handleItemClick = (optionValue: string) => {
    console.log("Direct click on option:", optionValue);
    onSelect(optionValue);
    setOpen(false);
  }

  // Fixed onSelect handler for CommandItem
  const handleCommandSelect = (currentValue: string) => {
    console.log("Command select for option:", currentValue);
    onSelect(currentValue);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[200px] justify-between", className)}
        >
          {value
            ? options.find((option) => option.value === value)?.label || placeholder
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandEmpty>{emptyText}</CommandEmpty>
          <CommandGroup>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => handleCommandSelect(option.value)}
                className="cursor-pointer hover:bg-accent"
                onClick={() => handleItemClick(option.value)}
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
        </Command>
      </PopoverContent>
    </Popover>
  )
} 