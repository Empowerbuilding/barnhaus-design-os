import type { Project } from './supabase'

export type OnUpdate = () => Promise<void>

export type CardState = 'burn' | 'freeze' | 'scheduled' | 'designer' | 'upworker' | 'client'

export interface PhaseData {
  review_scheduled: boolean
  review_held: boolean
  handoff_pending: boolean
  draft_delivered: boolean
}

export function getCardState(p: Project, phase?: PhaseData | null): CardState {
  // Scheduled overrides everything (review booked but not yet held)
  if (phase?.review_scheduled && !phase?.review_held) return 'scheduled'
  // Burn: designer or upworker, ticker <= 0
  if (p.is_burning) return 'burn'
  // Freeze: client hand, wait > 10
  if (p.is_frozen) return 'freeze'
  // Normal hand states
  if (p.current_hand === 'designer') return 'designer'
  if (p.current_hand === 'upworker') return 'upworker'
  return 'client'
}

export function getCardClass(state: CardState): string {
  switch (state) {
    case 'burn': return 'card card-burn'
    case 'freeze': return 'card card-freeze'
    case 'scheduled': return 'card card-scheduled'
    case 'designer': return 'card card-designer'
    case 'upworker': return 'card card-upworker'
    case 'client': return 'card card-client'
  }
}

export function getTicker(p: Project, state: CardState): { value: number | null; color: string } {
  if (state === 'burn' || state === 'designer' || state === 'upworker' || state === 'scheduled') {
    const v = p.countdown_ticker
    if (v === null) return { value: null, color: '#6b7280' }
    if (v < 0) return { value: v, color: '#ef4444' }
    if (v <= 3) return { value: v, color: '#f59e0b' }
    return { value: v, color: '#22c55e' }
  }
  if (state === 'freeze' || state === 'client') {
    const v = p.wait_ticker
    return { value: v, color: '#38bdf8' }
  }
  return { value: null, color: '#6b7280' }
}

export const TASK_LABELS: Record<string, string> = {
  review_scheduled: 'Review Scheduled',
  review_held: 'Review Held',
  handoff_pending: 'Hand to Upworker',
  draft_delivered: 'Draft Delivered',
}

// Task weight for ribbon load bar (0-1)
export const PHASE_WEIGHT: Record<string, number> = {
  concept_service: 0.5,
  conceptual_design: 0.6,
  draft_1: 1.0,
  draft_2: 0.9,
  draft_3: 0.7,
  final_polish: 0.4,
  archived: 0,
}
