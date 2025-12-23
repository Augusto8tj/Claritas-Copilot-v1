
"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import React, { useEffect, useState, useMemo } from "react";
import { Skeleton } from "../ui/skeleton";
import { useDerivApi, type Asset } from "@/hooks/use-deriv-api";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


interface AssetSelectorProps {
  selectedAsset: string;
  onAssetChange: (value: string) => void;
}

const filters = [
    { label: "Todos", value: "all" },
    { label: "Volatilidade", value: "volatility" },
    { label: "Crash/Boom", value: "boom" },
    { label: "Jump", value: "jump" },
    { label: "Step", value: "step" },
    { label: "Cestas Forex", value: "basket" },
];

export function AssetSelector({ selectedAsset, onAssetChange }: AssetSelectorProps) {
  const { assetGroups, isAssetsLoading } = useDerivApi();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  const filteredAssets = useMemo(() => {
    if (filter === 'all') {
      return assetGroups;
    }
    return assetGroups.map(group => ({
      ...group,
      options: group.options.filter(option => {
        const submarketLower = option.submarket.toLowerCase();
        if (filter === 'volatility') {
          return submarketLower.includes('continuous indices');
        }
        if (filter === 'boom') {
          return submarketLower.includes('crash') || submarketLower.includes('boom');
        }
        if (filter === 'basket') {
            return submarketLower.includes('basket_indices');
        }
        return submarketLower.includes(filter);
      })
    })).filter(group => group.options.length > 0);
  }, [assetGroups, filter]);
  
  const selectedAssetLabel = useMemo(() => {
     for (const group of assetGroups) {
      const asset = group.options.find(a => a.value === selectedAsset);
      if (asset) return asset.label;
    }
    return "Selecione um ativo";
  }, [assetGroups, selectedAsset]);


  if (isAssetsLoading) {
    return <Skeleton className="w-full sm:w-[280px] h-10" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full sm:w-[280px] justify-between"
        >
          <span className="truncate">{selectedAssetLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full sm:w-[350px] p-0">
        <Command>
          <CommandInput placeholder="Pesquisar ativo..." />
          <div className="p-2 border-b">
              <p className="text-xs text-muted-foreground px-1 pb-1">Filtar por tipo:</p>
              <div className="flex flex-wrap gap-1">
                {filters.map(f => (
                    <Button 
                        key={f.value}
                        variant={filter === f.value ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs rounded-full"
                        onClick={() => setFilter(f.value)}
                    >
                        {f.label}
                    </Button>
                ))}
              </div>
          </div>
          <CommandList>
            <CommandEmpty>Nenhum ativo encontrado.</CommandEmpty>
            {filteredAssets.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onAssetChange(option.value);
                      setOpen(false);
                    }}
                  >
                     <div className="flex items-center justify-between w-full">
                        <div className="flex items-center">
                            <Check
                                className={cn(
                                "mr-2 h-4 w-4",
                                selectedAsset === option.value ? "opacity-100" : "opacity-0"
                                )}
                            />
                            <span>{option.label}</span>
                        </div>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                     <div className={cn("h-2 w-2 rounded-full", option.marketIsOpen ? "bg-green-500" : "bg-muted-foreground")}/>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Mercado {option.marketIsOpen ? "Aberto" : "Fechado"}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
