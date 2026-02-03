import { cn } from '@/lib/utils';

interface UserAvatarProps {
  nombre: string;
  apellido?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

// Colores para las iniciales basados en el nombre
const avatarColors = [
  'bg-blue-500 text-white',
  'bg-green-500 text-white',
  'bg-purple-500 text-white',
  'bg-orange-500 text-white',
  'bg-cyan-500 text-white',
];

function getColorFromName(name: string): string {
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
}

function getInitials(nombre: string, apellido?: string): string {
  const first = nombre.charAt(0).toUpperCase();
  const last = apellido ? apellido.charAt(0).toUpperCase() : '';
  return first + last;
}

export function UserAvatar({
  nombre,
  apellido,
  src,
  size = 'md',
  className,
}: UserAvatarProps) {
  const initials = getInitials(nombre, apellido);
  const colorClass = getColorFromName(nombre + (apellido || ''));

  if (src) {
    return (
      <img
        src={src}
        alt={`${nombre} ${apellido || ''}`}
        className={cn(
          'rounded-full object-cover',
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white shadow-md',
        colorClass || 'bg-gradient-to-br from-[#A78BFA] to-[#7C3AED]',
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
