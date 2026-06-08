import Image from "next/image";
import { cn } from "@/lib/utils";

interface HerbImageProps {
  name: string;
  imageUrl?: string | null;
  className?: string;
  priority?: boolean;
}

// Generate a deterministic gradient based on herb name
function getHerbGradient(name: string): string {
  const gradients = [
    "from-emerald-500 to-teal-600",
    "from-teal-500 to-cyan-600",
    "from-green-500 to-emerald-600",
    "from-cyan-500 to-blue-600",
    "from-lime-500 to-green-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
    "from-violet-500 to-purple-600",
  ];

  const hash = name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

// Generate initials from herb name
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

export function HerbImage({
  name,
  imageUrl,
  className,
  priority,
}: HerbImageProps) {
  const gradient = getHerbGradient(name);
  const initials = getInitials(name);

  if (imageUrl) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover"
          priority={priority}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br text-white font-bold shadow-inner",
        gradient,
        className
      )}
    >
      <span className="text-lg opacity-90">{initials}</span>
    </div>
  );
}
