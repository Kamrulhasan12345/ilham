import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserRound } from 'lucide-react';

/** Initials for Latin names; a person icon for Arabic ones, whose first
    letters (often alif) read as nothing on their own. */
export function UserAvatar({ name, className }: { name: string; className?: string }) {
  const latin = /^[A-Za-z]/.test(name.trim());
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <Avatar className={className}>
      <AvatarFallback>{latin ? initials : <UserRound className="size-1/2" />}</AvatarFallback>
    </Avatar>
  );
}
