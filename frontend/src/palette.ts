export const PALETTE = [
  "#FF6B6B", // coral
  "#FFB100", // gold
  "#4D96FF", // blue
  "#6BCB77", // green
  "#C77DFF", // purple
  "#FF9F1C", // orange
  "#06D6A0", // teal
  "#F15BB5", // pink
];

export function colorForIndex(i: number): string {
  return PALETTE[i % PALETTE.length];
}
