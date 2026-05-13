import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [viewRes, phasesRes] = await Promise.all([
    supabaseAdmin
      .from('v_pipeline_status')
      .select('*')
      .order('is_burning', { ascending: false })
      .order('client_name', { ascending: true }),
    supabaseAdmin
      .from('project_phases')
      .select('project_id, phase_name, review_scheduled, review_held, handoff_pending, draft_delivered')
  ])

  if (viewRes.error) return NextResponse.json({ error: viewRes.error.message }, { status: 500 })

  const phases = phasesRes.data || []
  const projects = (viewRes.data || []).map((p: Record<string,unknown>) => {
    const phase = phases.find((ph) => ph.project_id === p.id && ph.phase_name === p.current_phase)
    return { ...p, phase_data: phase || null }
  })

  return NextResponse.json(projects)
}