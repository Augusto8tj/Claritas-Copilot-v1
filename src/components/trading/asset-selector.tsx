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

const assets = [
  { 
    label: "Índices Sintéticos", 
    options: [
      { value: "1HZ100V", label: "Volatility 100 (1s) Index" },
      { value: "JUMP100", label: "Jump 100 Index" },
      { value: "RB_RANGEBREAK100", label: "Range Break 100 Index" },
    ]
  },
  { 
    label: "Forex", 
    options: [
      { value: "EURUSD", label: "EUR/USD" },
      { value: "GBPUSD", label: "GBP/USD" },
      { value: "USDJPY", label: "USD/JPY" },
    ]
  },
   { 
    label: "Ações e Índices", 
    options: [
      { value: "PETR4", label: "Petrobras (PETR4)" },
      { value: "NVIDIA", label: "NVIDIA (NVDA)" },
      { value: "US_30", label: "Wall Street 30" },
    ]
  },
  {
    label: "Criptomoedas",
    options: [
        { value: "BTCUSD", label: "Bitcoin (BTC/USD)" },
        { value: "ETHUSD", label: "Ethereum (ETH/USD)" },
    ]
  },
  {
    label: "Matérias-primas",
    options: [
        { value: "XAUUSD", label: "Ouro (XAU/USD)" },
        { value: "WTI_OIL", label: "Petróleo (US Oil)" },
    ]
  }
];

interface AssetSelectorProps {
  selectedAsset: string;
  onAssetChange: (value: string) => void;
}

export function AssetSelector({ selectedAsset, onAssetChange }: AssetSelectorProps) {
  return (
    <Select value={selectedAsset} onValueChange={onAssetChange}>
      <SelectTrigger className="w-full sm:w-[280px]">
        <SelectValue placeholder="Selecione um ativo" />
      </SelectTrigger>
      <SelectContent>
        {assets.map((group) => (
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
