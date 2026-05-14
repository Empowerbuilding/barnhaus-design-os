import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [viewRes, phasesRes, extrasRes] = await Promise.all([
    supabaseAdmin
      .from('v_pipeline_status')
      .select('*')
      .order('is_burning', { ascending: false })
      .order('client_name', { ascending: true }),
    supabaseAdmin
      .from('project_phases')
      .select('project_id, phase_name, review_scheduled, review_held, handoff_pending, polishing, draft_delivered'),
    supabaseAdmin
      .from('projects')
      .select('id, ribbon_date, last_client_email_date')
  ])

  if (viewRes.error) return NextResponse.json({ error: viewRes.error.message }, { status: 500 })

  const phases = phasesRes.data || []
  const extras = extrasRes.data || []
  const projects = (viewRes.data || []).map((p: Record<string,unknown>) => {
    const phase = phases.find((ph) => ph.project_id === p.id && ph.phase_name === p.current_phase)
    const extra = extras.find((e) => e.id === p.id)
    return { ...p, phase_data: phase || null, ribbon_date: extra?.ribbon_date ?? null, last_client_email_date: extra?.last_client_email_date ?? null }
  })

  return NextResponse.json(projects)
}