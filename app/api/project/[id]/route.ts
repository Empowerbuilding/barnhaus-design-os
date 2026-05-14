import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const [proj, phases, activity] = await Promise.all([
    supabaseAdmin.from('v_pipeline_status').select('*').eq('id', params.id).single(),
    supabaseAdmin.from('project_phases').select('*').eq('project_id', params.id),
    supabaseAdmin.from('project_activity').select('*').eq('project_id', params.id)
      .order('created_at', { ascending: false }).limit(5),
  ])

  // Auto-seed phase row for current phase if missing — ensures checklist always works
  if (proj.data) {
    const currentPhase = proj.data.current_phase
    const hasCurrentPhaseRow = (phases.data || []).some((ph: {phase_name: string}) => ph.phase_name === currentPhase)
    if (!hasCurrentPhaseRow && currentPhase !== 'archived') {
      await supabaseAdmin.from('project_phases').upsert({
        project_id: params.id, phase_name: currentPhase,
        review_scheduled: false, review_held: false,
        handoff_pending: false, draft_delivered: false, tasks: {}
      }, { onConflict: 'project_id,phase_name' })
      const { data: refreshed } = await supabaseAdmin.from('project_phases').select('*').eq('project_id', params.id)
      return NextResponse.json({ project: proj.data, phases: refreshed, activity: activity.data })
    }
  }

  return NextResponse.json({ project: proj.data, phases: phases.data, activity: activity.data })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const now = new Date().toISOString()
  const update: Record<string, unknown> = { updated_at: now }

  // Hand flip — do NOT reset ticker (ticker is tied to meeting date, not hand)
  if (body.current_hand) update.current_hand = body.current_hand

  if (body.current_phase) update.current_phase = body.current_phase
  if (body.notes !== undefined) update.notes = body.notes
  if (body.ribbon_date !== undefined) update.ribbon_date = body.ribbon_date
  if (body.last_client_email_date !== undefined) update.last_client_email_date = body.last_client_email_date

  // Manual ticker override
  if (body.ticker_start_date) update.ticker_start_date = body.ticker_start_date
  if (body.ticker_duration_days) update.ticker_duration_days = body.ticker_duration_days

  const { data, error } = await supabaseAdmin.from('projects').update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('project_activity').insert({
    project_id: params.id, event_type: 'UPDATE',
    description: `Updated: ${Object.keys(body).join(', ')}`,
  })
  return NextResponse.json(data)
}
