import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useEffect, useState } from 'react';
import {
  HABIT_CATEGORIES,
  HABIT_COLORS,
  HABIT_ICONS,
  MONDAY_FIRST_DAYS,
  WEEKDAY_LABELS,
} from '../../lib/constants';
import type { Habit, HabitFormInput, HabitFrequency, HabitStatus } from '../../types/database';
import { HabitIcon } from '../ui/HabitIcon';

interface HabitFormModalProps {
  open: boolean;
  initialHabit?: Habit | null;
  defaultStartDate: string;
  onClose: () => void;
  onSubmit: (input: HabitFormInput) => Promise<void>;
}

export function HabitFormModal({
  open,
  initialHabit,
  defaultStartDate,
  onClose,
  onSubmit,
}: HabitFormModalProps) {
  const isEditing = Boolean(initialHabit);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('droplets');
  const [category, setCategory] = useState<string>('Health');
  const [color, setColor] = useState<string>('#12C5DF');
  const [targetValue, setTargetValue] = useState<string>('1');
  const [targetUnit, setTargetUnit] = useState('times');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [scheduledDays, setScheduledDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [status, setStatus] = useState<HabitStatus>('active');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialHabit) {
      setName(initialHabit.name);
      setDescription(initialHabit.description || '');
      setIcon(initialHabit.icon);
      setCategory(initialHabit.category);
      setColor(initialHabit.color);
      setTargetValue(String(initialHabit.target_value));
      setTargetUnit(initialHabit.target_unit);
      setFrequency(initialHabit.frequency);
      setScheduledDays(
        initialHabit.scheduled_days?.length ? initialHabit.scheduled_days : [1, 3, 5]
      );
      setStartDate(initialHabit.start_date);
      setStatus(initialHabit.status);
    } else {
      setName('');
      setDescription('');
      setIcon('droplets');
      setCategory('Health');
      setColor('#12C5DF');
      setTargetValue('1');
      setTargetUnit('times');
      setFrequency('daily');
      setScheduledDays([0, 1, 2, 3, 4, 5, 6]);
      setStartDate(defaultStartDate);
      setStatus('active');
    }
    setValidationError(null);
  }, [open, initialHabit, defaultStartDate]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, submitting, onClose]);

  const toggleDay = (dayIdx: number) => {
    setScheduledDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('Please enter a habit name.');
      return;
    }
    const parsedTarget = Number(targetValue);
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      setValidationError('Daily target must be greater than zero.');
      return;
    }
    if (!targetUnit.trim()) {
      setValidationError('Please specify a unit (e.g., liters, km, pages, minutes).');
      return;
    }
    if (frequency === 'custom' && scheduledDays.length === 0) {
      setValidationError('Select at least one weekday for a custom schedule.');
      return;
    }
    if (!startDate) {
      setValidationError('Please pick a start date.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        icon,
        category,
        color,
        target_value: parsedTarget,
        target_unit: targetUnit.trim(),
        frequency,
        scheduled_days: frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : scheduledDays,
        start_date: startDate,
        end_date: initialHabit?.end_date ?? null,
        status,
      });
      onClose();
    } catch {
      // Error toast is handled by hook
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="habit-modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !submitting && onClose()}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="neu-card relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl"
          >
            {/* Mobile drag affordance */}
            <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-[var(--text-muted)]/40 sm:hidden" />

            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-6 py-4">
              <h2
                id="habit-modal-title"
                className="font-display text-xl font-semibold text-[var(--text-primary)]"
              >
                {isEditing ? 'Edit Habit' : 'New Habit'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                aria-label="Close modal"
                className="neu-button flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex-1 space-y-5 overflow-y-auto px-6 py-5"
            >
              {validationError && (
                <div className="neu-inset rounded-2xl px-4 py-3 text-xs font-medium text-[#F43F5E]">
                  {validationError}
                </div>
              )}

              {/* Name */}
              <div>
                <label
                  htmlFor="habit-name"
                  className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
                >
                  Habit Name
                </label>
                <input
                  id="habit-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Drink 2L water"
                  maxLength={80}
                  className="neu-inset w-full rounded-2xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#12C5DF]/60"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="habit-description"
                  className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
                >
                  Description (optional)
                </label>
                <input
                  id="habit-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short cue or motivation"
                  maxLength={140}
                  className="neu-inset w-full rounded-2xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#12C5DF]/60"
                />
              </div>

              {/* Target & Category */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="habit-target-val"
                    className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    Daily Target
                  </label>
                  <input
                    id="habit-target-val"
                    type="number"
                    min="0.1"
                    step="any"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="neu-inset w-full rounded-2xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#12C5DF]/60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="habit-target-unit"
                    className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    Unit
                  </label>
                  <input
                    id="habit-target-unit"
                    type="text"
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                    placeholder="liters, km, pages"
                    className="neu-inset w-full rounded-2xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#12C5DF]/60"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label
                    htmlFor="habit-category"
                    className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    Category
                  </label>
                  <select
                    id="habit-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="neu-inset w-full rounded-2xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#12C5DF]/60"
                  >
                    {HABIT_CATEGORIES.map((cat) => (
                      <option
                        key={cat}
                        value={cat}
                        className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      >
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Icon Picker */}
              <div>
                <span className="mb-2 block text-xs font-semibold text-[var(--text-secondary)]">
                  Icon
                </span>
                <div className="grid grid-cols-6 gap-2">
                  {HABIT_ICONS.map((item) => {
                    const active = icon === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setIcon(item.id)}
                        aria-label={item.label}
                        title={item.label}
                        className={`flex h-11 items-center justify-center rounded-2xl transition-all ${
                          active
                            ? 'bg-[#12C5DF] text-[#0D1117] shadow-[0_4px_14px_rgba(18,197,223,0.35)]'
                            : 'neu-inset text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <HabitIcon name={item.id} size={18} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Swatches */}
              <div>
                <span className="mb-2 block text-xs font-semibold text-[var(--text-secondary)]">
                  Accent Color
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  {HABIT_COLORS.map((c) => {
                    const selected = color === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setColor(c.value)}
                        aria-label={c.name}
                        title={c.name}
                        className={`h-9 w-9 rounded-full transition-transform ${
                          selected
                            ? 'scale-110 ring-2 ring-[var(--text-primary)] ring-offset-2 ring-offset-[var(--bg-canvas)]'
                            : ''
                        }`}
                        style={{ backgroundColor: c.value }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Frequency */}
              <div>
                <span className="mb-2 block text-xs font-semibold text-[var(--text-secondary)]">
                  Frequency
                </span>
                <div className="neu-inset grid grid-cols-2 gap-1.5 rounded-2xl p-1.5">
                  <button
                    type="button"
                    onClick={() => setFrequency('daily')}
                    className={`min-h-[40px] rounded-xl text-xs font-semibold transition-all ${
                      frequency === 'daily'
                        ? 'bg-[#12C5DF] text-[#0D1117] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Every Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrequency('custom')}
                    className={`min-h-[40px] rounded-xl text-xs font-semibold transition-all ${
                      frequency === 'custom'
                        ? 'bg-[#12C5DF] text-[#0D1117] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Selected Weekdays
                  </button>
                </div>

                {frequency === 'custom' && (
                  <div className="mt-3 grid grid-cols-7 gap-1.5">
                    {MONDAY_FIRST_DAYS.map((dayIdx) => {
                      const day = WEEKDAY_LABELS[dayIdx];
                      const active = scheduledDays.includes(dayIdx);
                      return (
                        <button
                          key={dayIdx}
                          type="button"
                          onClick={() => toggleDay(dayIdx)}
                          aria-pressed={active}
                          aria-label={day.full}
                          className={`min-h-[42px] rounded-xl text-xs font-semibold transition-all ${
                            active
                              ? 'bg-[#A64BEA] text-white shadow-[0_4px_12px_rgba(166,75,234,0.35)]'
                              : 'neu-inset text-[var(--text-muted)]'
                          }`}
                        >
                          {day.medium}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Start Date & Status (if editing) */}
              <div className={`grid gap-3 ${isEditing ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label
                    htmlFor="habit-start-date"
                    className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    Start Date
                  </label>
                  <input
                    id="habit-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="neu-inset w-full rounded-2xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#12C5DF]/60"
                  />
                </div>

                {isEditing && (
                  <div>
                    <label
                      htmlFor="habit-status"
                      className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
                    >
                      Status
                    </label>
                    <select
                      id="habit-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as HabitStatus)}
                      className="neu-inset w-full rounded-2xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#12C5DF]/60"
                    >
                      <option
                        value="active"
                        className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      >
                        Active
                      </option>
                      <option
                        value="paused"
                        className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      >
                        Paused
                      </option>
                      <option
                        value="archived"
                        className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      >
                        Archived
                      </option>
                    </select>
                  </div>
                )}
              </div>

              {/* Submit footer */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="neu-button min-h-[46px] rounded-2xl px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[46px] rounded-2xl bg-[#12C5DF] px-6 py-2.5 text-sm font-semibold text-[#0D1117] shadow-[0_6px_20px_rgba(18,197,223,0.35)] transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  {submitting
                    ? 'Saving...'
                    : isEditing
                      ? 'Save Changes'
                      : 'Create Habit'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
