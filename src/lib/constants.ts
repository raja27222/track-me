export const MILESTONE_DAYS = [7, 14, 30, 60, 100] as const;

export const PRESET_AVATARS = [
  {
    id: 'minimal-cyan',
    label: 'Studio Portrait',
    url: '/src/assets/images/avatar_minimal_cyan_1795263585240.jpg',
  },
  {
    id: 'abstract-wave',
    label: 'Obsidian Wave',
    url: '/src/assets/images/avatar_abstract_wave_1795263584878.jpg',
  },
  {
    id: 'abstract-prism',
    label: 'Cyan Prism',
    url: '/src/assets/images/avatar_abstract_prism_1795263584807.jpg',
  },
] as const;

export const HABIT_CATEGORIES = [
  'Health',
  'Fitness',
  'Worship',
  'Learning',
  'Mindfulness',
  'Productivity',
  'Finance',
  'Sleep',
  'Creativity',
] as const;

export const HABIT_COLORS = [
  { name: 'Electric Cyan', value: '#12C5DF' },
  { name: 'Violet Pulse', value: '#A64BEA' },
  { name: 'Emerald Mint', value: '#10B981' },
  { name: 'Amber Solar', value: '#F59E0B' },
  { name: 'Coral Rose', value: '#F43F5E' },
  { name: 'Sky Cobalt', value: '#3B82F6' },
] as const;

export const HABIT_ICONS = [
  { id: 'droplets', label: 'Hydration' },
  { id: 'footprints', label: 'Running' },
  { id: 'book-open', label: 'Reading' },
  { id: 'code-2', label: 'Coding' },
  { id: 'heart-handshake', label: 'Worship' },
  { id: 'dumbbell', label: 'Workout' },
  { id: 'brain', label: 'Mindfulness' },
  { id: 'moon', label: 'Sleep' },
  { id: 'salad', label: 'Nutrition' },
  { id: 'heart-pulse', label: 'Cardio' },
  { id: 'pen-tool', label: 'Writing' },
  { id: 'sun', label: 'Morning' },
] as const;

export const WEEKDAY_LABELS = [
  { index: 0, short: 'S', medium: 'Sun', full: 'Sunday' },
  { index: 1, short: 'M', medium: 'Mon', full: 'Monday' },
  { index: 2, short: 'T', medium: 'Tue', full: 'Tuesday' },
  { index: 3, short: 'W', medium: 'Wed', full: 'Wednesday' },
  { index: 4, short: 'T', medium: 'Thu', full: 'Thursday' },
  { index: 5, short: 'F', medium: 'Fri', full: 'Friday' },
  { index: 6, short: 'S', medium: 'Sat', full: 'Saturday' },
] as const;

export const MONDAY_FIRST_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;

export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

export const EXAMPLE_HABIT_TEMPLATES = [
  {
    name: 'Drink 2L water',
    description: 'Stay hydrated consistently throughout the day',
    icon: 'droplets',
    category: 'Health',
    color: '#12C5DF',
    target_value: 2,
    target_unit: 'liters',
    frequency: 'daily' as const,
    scheduled_days: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    name: 'Daily Worship & Prayer',
    description: 'Dedicated time for prayer, scripture, and spiritual reflection',
    icon: 'heart-handshake',
    category: 'Worship',
    color: '#A64BEA',
    target_value: 15,
    target_unit: 'minutes',
    frequency: 'daily' as const,
    scheduled_days: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    name: 'Run 5km',
    description: 'Outdoor endurance run or tempo session',
    icon: 'footprints',
    category: 'Fitness',
    color: '#F59E0B',
    target_value: 5,
    target_unit: 'km',
    frequency: 'custom' as const,
    scheduled_days: [1, 3, 5, 6],
  },
  {
    name: 'Read 20 pages',
    description: 'Focused reading before bed without screens',
    icon: 'book-open',
    category: 'Learning',
    color: '#10B981',
    target_value: 20,
    target_unit: 'pages',
    frequency: 'daily' as const,
    scheduled_days: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    name: 'Study Python for 1 hour',
    description: 'Deep work practice on algorithms and projects',
    icon: 'code-2',
    category: 'Learning',
    color: '#3B82F6',
    target_value: 60,
    target_unit: 'minutes',
    frequency: 'custom' as const,
    scheduled_days: [1, 2, 3, 4, 5],
  },
];
