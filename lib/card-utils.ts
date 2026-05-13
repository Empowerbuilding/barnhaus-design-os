import type { Project } from './supabase'

export type OnUpdate = () => Promise<void>

export type CardState =
  | 'burn'
  | 'freeze'
  | 'scheduled'
  | 'designer'
  | 'upworker'
  | 'client'
  | 'client-cooling'  // 4-10d wait — haze building

export interface PhaseData {
  review_scheduled: boolean
  review_held: boolean
  handoff_pending: boolean
  draft_delivered: boolean
}

export const TASK_LABELS: Record<keyof PhaseData, string> = {
  review_scheduled: 'Review Scheduled',
  review_held:      'Review Held',
  handoff_pending:  'Handoff to Upworker',
  draft_delivered:  'Draft Delivered',
}

// Which task to surface on ribbon (first unchecked in priority order)
export const RIBBON_TASK_PRIORITY: (keyof PhaseData)[] = [
  'handoff_pending',
  'draft_delivered',
  'review_scheduled',
  'review_held',
]

export const PHASE_WEIGHT: Record<string, number> = {
  pre_design: 0.5,
  concept: 1,
  draft_1: 2,
  draft_2: 2.5,
  draft_3: 2,
  final_polish: 1,
  engineering: 1.5,
}

export function getCardState(p: Project, phaseData: PhaseData | null | undefined): CardState {
  const hand = p.current_hand
  const phase = phaseData

  // Scheduled overrides everything — meeting locked, ticker paused
  if (phase?.review_scheduled && !phase?.review_held) return 'scheduled'

  // Burn — designer/upworker past deadline
  if (p.is_burning) return 'burn'

  // Freeze — client held 10+ days
  if (p.is_frozen) return 'freeze'

  // Client-cooling — 4-10 day haze
  if (hand === 'client' && p.wait_ticker !== null && p.wait_ticker > 3) return 'client-cooling'

  if (hand === 'designer') return 'designer'
  if (hand === 'upworker') return 'upworker'
  return 'client'
}

export function getCardClass(state: CardState): string {
  switch (state) {
    case 'burn':           return 'card card-burn'
    case 'freeze':         return 'card card-freeze'
    case 'scheduled':      return 'card card-scheduled'
    case 'designer':       return 'card card-designer'
    case 'upworker':       return 'card card-upworker'
    case 'client-cooling': return 'card card-client-cooling'
    case 'client':         return 'card card-client'
    default:               return 'card'
  }
}

export function getTicker(p: Project, state: CardState): { value: number | null; color: string } {
  switch (state) {
    case 'burn':
      return { value: p.countdown_ticker, color: '#ef4444' }
    case 'freeze':
    case 'client-cooling':
      return { value: p.wait_ticker, color: state === 'freeze' ? '#93c5fd' : '#60a5fa' }
    case 'scheduled':
      return { value: p.countdown_ticker, color: '#a855f7' }
    case 'designer':
      return { value: p.countdown_ticker, color: '#22c55e' }
    case 'upworker':
      return { value: p.countdown_ticker, color: '#f59e0b' }
    case 'client':
      return { value: p.wait_ticker, color: '#38bdf8' }
    default:
      return { value: null, color: '#6b7280' }
  }
}

// Get the single most relevant task to surface on a ribbon card
export function getRibbonTask(phaseData: PhaseData | null | undefined): keyof PhaseData | null {
  if (!phaseData) return null
  for (const key of RIBBON_TASK_PRIORITY) {
    if (!phaseData[key]) return key
  }
  return null // all done
}
