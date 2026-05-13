import { createClient } from '@supabase/supabase-js'

// Public values hardcoded — anon key is safe to expose client-side
const SUPABASE_URL = 'https://nvsczfrljlovksrdyaix.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52c2N6ZnJsamxvdmtzcmR5YWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2Mzg0NzMsImV4cCI6MjA5NDIxNDQ3M30.755-ZtOXLpg4lnZAGuFhcd4ORUZSmvq7gKjXsx0rDaM'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52c2N6ZnJsamxvdmtzcmR5YWl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODYzODQ3MywiZXhwIjoyMDk0MjE0NDczfQ.Rl8IVENc0WSpMm3d7JQzwpPV_ILp2_b6ohn1aWX-cuc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

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
