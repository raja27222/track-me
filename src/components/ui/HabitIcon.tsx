import {
  BookOpen,
  Brain,
  Code2,
  Droplets,
  Dumbbell,
  Footprints,
  HeartHandshake,
  HeartPulse,
  Moon,
  Music,
  PenTool,
  Salad,
  Sparkles,
  Sun,
} from 'lucide-react';

interface HabitIconProps {
  name: string;
  className?: string;
  size?: number;
}

export function HabitIcon({ name, className = '', size = 20 }: HabitIconProps) {
  switch (name) {
    case 'droplets':
      return <Droplets size={size} className={className} />;
    case 'footprints':
      return <Footprints size={size} className={className} />;
    case 'book-open':
      return <BookOpen size={size} className={className} />;
    case 'code-2':
      return <Code2 size={size} className={className} />;
    case 'heart-handshake':
      return <HeartHandshake size={size} className={className} />;
    case 'dumbbell':
      return <Dumbbell size={size} className={className} />;
    case 'brain':
      return <Brain size={size} className={className} />;
    case 'moon':
      return <Moon size={size} className={className} />;
    case 'salad':
      return <Salad size={size} className={className} />;
    case 'heart-pulse':
      return <HeartPulse size={size} className={className} />;
    case 'pen-tool':
      return <PenTool size={size} className={className} />;
    case 'music':
      return <Music size={size} className={className} />;
    case 'sun':
      return <Sun size={size} className={className} />;
    default:
      return <Sparkles size={size} className={className} />;
  }
}
