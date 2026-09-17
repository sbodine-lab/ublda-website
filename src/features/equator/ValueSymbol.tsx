import { BookOpenCheck, DoorOpen, Ear, Handshake, UsersRound } from "lucide-react";

const symbols = {
  inclusion: DoorOpen,
  shared: UsersRound,
  learning: BookOpenCheck,
  listening: Ear,
  community: Handshake,
};

/** Familiar symbols communicate the value rather than adding abstract motion. */
export function ValueSymbol({ name }: { name: string }) {
  const Icon = symbols[name as keyof typeof symbols];
  if (!Icon) return null;
  return (
    <div className={`eq-glyph eq-value-symbol eq-value-symbol--${name}`} aria-hidden="true">
      <Icon strokeWidth={1.35} />
    </div>
  );
}
