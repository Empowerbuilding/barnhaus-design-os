import type { Project } from './supabase'

export type OnUpdate = () => Promise<void>

export type CardState =
  | 'pre_kickoff'
  | 'freeze'
  | 'scheduled'
  | 'designer'
  | 'upworker'
  | 'client-fresh'
  | 'client'
  | 'client-cooling'

export interface PhaseData {
  review_scheduled: boolean
  review_held:      boolean
  handoff_pending:  boolean
  polishing:        boolean
  draft_delivered:  boolean
}

// ── Per-phase checklist definitions ─────────────────────────────
// Each entry: { field, label } in the order they should appear
export type ChecklistField = keyof PhaseData

export interface ChecklistItem {
  field: ChecklistField
  label: string
}

export const PHASE_CHECKLIST: Record<string, ChecklistItem[]> = {
  concept_service: [
    { field: 'review_scheduled', label: 'Kickoff Scheduled' },
    { field: 'review_held',      label: 'Kickoff Completed' },
    { field: 'draft_delivered',  label: 'Screenshots Delivered' },
  ],
  conceptual_design: [
    { field: 'review_scheduled', label: 'Kickoff Scheduled' },
    { field: 'review_held',      label: 'Kickoff Completed' },
    { field: 'draft_delivered',  label: 'Screenshots Delivered' },
  ],
  draft_1: [
    { field: 'review_scheduled', label: 'Feedback Received' },
    { field: 'review_held',      label: 'Design Approved' },
    { field: 'draft_delivered',  label: 'Draft 1 Delivered' },
  ],
  draft_2: [
    { field: 'review_scheduled', label: 'Review Scheduled' },
    { field: 'review_held',      label: 'Review Held' },
    { field: 'handoff_pending',  label: 'Handoff to Upworker' },
    { field: 'polishing',        label: 'Polishing' },
    { field: 'draft_delivered',  label: 'Draft Delivered' },
  ],
  draft_3: [
    { field: 'review_scheduled', label: 'Review Scheduled' },
    { field: 'review_held',      label: 'Review Held' },
    { field: 'handoff_pending',  label: 'Handoff to Upworker' },
    { field: 'polishing',        label: 'Polishing' },
    { field: 'draft_delivered',  label: 'Draft Delivered' },
  ],
  final_polish: [
    { field: 'review_scheduled', label: 'Review Scheduled' },
    { field: 'review_held',      label: 'Review Held' },
    { field: 'polishing',        label: 'Polishing' },
    { field: 'draft_delivered',  label: 'Final Delivered' },
  ],
}

// Fallback for unknown phases
export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { field: 'review_scheduled', label: 'Review Scheduled' },
  { field: 'review_held',      label: 'Review Held' },
  { field: 'handoff_pending',  label: 'Handoff to Upworker' },
  { field: 'polishing',        label: 'Polishing' },
  { field: 'draft_delivered',  label: 'Draft Delivered' },
]

export function getChecklist(phase: string): ChecklistItem[] {
  return PHASE_CHECKLIST[phase] ?? DEFAULT_CHECKLIST
}

// First unchecked item — for ribbon display
export function getRibbonTask(phaseData: PhaseData | null | undefined, phase: string): ChecklistField | null {
  if (!phaseData) return null
  const items = getChecklist(phase)
  for (const { field } of items) {
    if (!phaseData[field]) return field
  }
  return null
}

// Phase-aware label for a given field — use this in ribbon instead of TASK_LABELS
export function getRibbonTaskLabel(field: ChecklistField, phase: string): string {
  const items = getChecklist(phase)
  return items.find(i => i.field === field)?.label ?? TASK_LABELS[field]
}

// Legacy flat label map (used by ribbon card for display)
export const TASK_LABELS: Record<ChecklistField, string> = {
  review_scheduled: 'Review Scheduled',
  review_held:      'Review Held',
  handoff_pending:  'Handoff to Upworker',
  polishing:        'Polishing',
  draft_delivered:  'Draft Delivered',
}

export const PHASE_WEIGHT: Record<string, number> = {
  pre_design: 0.5,
  concept_service: 1,
  conceptual_design: 1,
  draft_1: 2,
  draft_2: 2.5,
  draft_3: 2,
  final_polish: 1,
  engineering: 1.5,
}

// Phase durations in days
export const PHASE_DURATION: Record<string, number> = {
  concept_service:   14,
  conceptual_design:  7,
  draft_1:            7,
  draft_2:           14,
  draft_3:           14,
  final_polish:      14,
}

// ── Card state — based on hand only; burn is a separate overlay ──
export function getCardState(p: Project, phaseData: PhaseData | null | undefined): CardState {
  const hand = p.current_hand

  // Scheduled: meeting booked, not yet held → purple, ticker paused
  if (phaseData?.review_scheduled && !phaseData?.review_held) return 'scheduled'

  // Pre-kickoff: concept/conceptual phases before kickoff is held → sales owns it, no hand
  if ((p.current_phase === 'concept_service' || p.current_phase === 'conceptual_design') && !phaseData?.review_held) return 'pre_kickoff'

  // Freeze — client held 10+ days
  if (p.is_frozen) return 'freeze'

  // Client-cooling — 4-10 day haze
  // client-fresh: client hand but zero boxes checked on current phase — work hasn't started
  if (hand === 'client' && phaseData && !phaseData.review_scheduled && !phaseData.review_held && !phaseData.draft_delivered) return 'client-fresh'
  if (hand === 'client' && p.wait_ticker !== null && p.wait_ticker > 3) return 'client-cooling'

  if (hand === 'designer') return 'designer'
  if (hand === 'upworker') return 'upworker'
  return 'client'
}

export function getCardClass(state: CardState): string {
  switch (state) {
    case 'pre_kickoff':    return 'card card-pre-kickoff'
    case 'freeze':         return 'card card-freeze'
    case 'scheduled':      return 'card card-scheduled'
    case 'designer':       return 'card card-designer'
    case 'upworker':       return 'card card-upworker'
    case 'client-cooling': return 'card card-client-cooling'
    case 'client-fresh':   return 'card card-client-fresh'
    case 'client':         return 'card card-client'
    default:               return 'card'
  }
}

export function getTicker(p: Project, state: CardState): { value: number | null; color: string } {
  switch (state) {
    case 'pre_kickoff':
      return { value: null, color: '#6b7280' }
    case 'freeze':
    case 'client-cooling':
      return { value: p.wait_ticker, color: state === 'freeze' ? '#93c5fd' : '#60a5fa' }
    case 'scheduled':
      return { value: p.countdown_ticker, color: '#a855f7' }
    case 'designer':
      return { value: p.countdown_ticker, color: p.is_burning ? '#ef4444' : '#22c55e' }
    case 'upworker':
      return { value: p.countdown_ticker, color: p.is_burning ? '#ef4444' : '#f59e0b' }
    case 'client-fresh':
      return { value: p.wait_ticker, color: '#3b82f6' }
    case 'client-fresh':
      return { value: p.wait_ticker, color: '#3b82f6' }
    case 'client':
      return { value: p.wait_ticker, color: '#38bdf8' }
    default:
      return { value: null, color: '#6b7280' }
  }
}
