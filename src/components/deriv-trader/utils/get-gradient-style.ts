// /src/components/deriv-trader/utils/get-gradient-style.ts

export function getGradientStyle({
  entryPrice,
  currentPrice,
  direction,
  maxExpectedMove = 0.005, // 0.5%
}: {
  entryPrice: number;
  currentPrice: number;
  direction: "rise" | "fall";
  maxExpectedMove?: number;
}) {
  const diffPercent = (currentPrice - entryPrice) / entryPrice;

  // Se for 'rise', o lucro é positivo quando diffPercent > 0.
  // Se for 'fall', o lucro é positivo quando diffPercent < 0 (ou seja, -diffPercent > 0).
  const signedDiff =
    direction === "rise" ? diffPercent : -diffPercent;

  // Normaliza a diferença para o intervalo [-1, 1] com base no movimento esperado
  const normalized = Math.max(
    -1,
    Math.min(1, signedDiff / maxExpectedMove)
  );

  // Mapeia o valor normalizado para um matiz (hue) no espectro de cores HSL
  // 0 = vermelho (perda máxima), 60 = amarelo (neutro), 120 = verde (ganho máximo)
  const hue = 120 * ((normalized + 1) / 2);

  return {
    background: `linear-gradient(135deg,
      hsl(${hue}, 85%, 48%),
      hsl(${hue}, 85%, 38%)
    )`,
    color: "#fff", // Garante que o texto seja legível
    boxShadow: `0 0 ${6 + Math.abs(normalized) * 12}px hsl(${hue}, 90%, 55%)`,
  };
}
