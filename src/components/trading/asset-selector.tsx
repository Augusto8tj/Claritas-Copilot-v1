"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { Skeleton } from "../ui/skeleton";
import { useDerivApi } from "@/hooks/use-deriv-api";

interface AssetSelectorProps {
  selectedAsset: string;
  onAssetChange: (value: string) => void;
}

export function AssetSelector({ selectedAsset, onAssetChange }: AssetSelectorProps) {
  const { assetGroups, isAssetsLoading } = useDerivApi();

  if (isAssetsLoading) {
    return <Skeleton className="w-full sm:w-[280px] h-10" />;
  }

  return (
    <Select value={selectedAsset} onValueChange={onAssetChange}>
      <SelectTrigger className="w-full sm:w-[280px]">
        <SelectValue placeholder="Selecione um ativo" />
      </SelectTrigger>
      <SelectContent>
        {assetGroups.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
