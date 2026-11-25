import { Bus } from "lucide-react";

/** A bus line number in its operator's colors. */
export default function LineChip({ line, color, textColor }: { line: string; color: string | null; textColor: string | null }) {
  return (
    <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-bold"
      style={{ backgroundColor: color ?? "#F5A300", color: textColor ?? "#000000" }}>
      <Bus className="h-4 w-4" aria-hidden />{line}
    </span>
  );
}
