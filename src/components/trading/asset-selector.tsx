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
import { getAvailableAssets, type AssetGroup } from "@/services/deriv-api-service";
import { useEffect, useState } from "react";
import { Skeleton } from "../ui/skeleton";

interface AssetSelectorProps {
  selectedAsset: string;
  onAssetChange: (value: string) => void;
}

export function AssetSelector({ selectedAsset, onAssetChange }: AssetSelectorProps) {
  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAssets() {
      setLoading(true);
      const data = await getAvailableAssets();
      setAssetGroups(data);
      setLoading(false);
    }
    fetchAssets();
  }, []);

  if (loading) {
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
