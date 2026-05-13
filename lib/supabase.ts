import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_KEY!

export const supabase = createClient(url, anonKey)
export const supabaseAdmin = createClient(url, serviceKey)

export type DesignPhase = 'concept_service'|'conceptual_design'|'draft_1'|'draft_2'|'draft_3'|'final_polish'|'archived'
export type HandOwnership = 'designer'|'upworker'|'client'
export type ReferralStatus = 'none'|'pending'|'complete'

export interface Project {
  id: string; client_name: string; client_email: string|null; client_phone: string|null
  current_phase: DesignPhase; current_hand: HandOwnership; ticker_start_date: string
  ticker_duration_days: number; engineering_required: boolean; engineering_status: string
  referral_status: ReferralStatus; referral_builder: string|null; momentum_streak: number
  notes: string|null; countdown_ticker: number|null; wait_ticker: number|null
  is_burning: boolean; is_frozen: boolean
}

export interface ProjectPhase {
  id: string; project_id: string; phase_name: DesignPhase; tasks: Record<string,boolean>
  review_scheduled: boolean; review_held: boolean; handoff_pending: boolean; draft_delivered: boolean
}

export interface Activity {
  id: string; project_id: string; event_type: string; description: string; created_at: string
}

export const PHASE_LABELS: Record<DesignPhase, string> = {
  concept_service: 'Concept', conceptual_design: 'Conceptual', draft_1: 'Draft 1',
  draft_2: 'Draft 2', draft_3: 'Draft 3', final_polish: 'Final', archived: 'Archived',
}

export const PHASES: DesignPhase[] = [
  'concept_service','conceptual_design','draft_1','draft_2','draft_3','final_polish','archived'
]
