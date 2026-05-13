import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const [proj, phases, activity] = await Promise.all([
    supabaseAdmin.from('v_pipeline_status').select('*').eq('id', params.id).single(),
    supabaseAdmin.from('project_phases').select('*').eq('project_id', params.id),
    supabaseAdmin.from('project_activity').select('*').eq('project_id', params.id).order('created_at', { ascending: false }).limit(5),
  ])
  return NextResponse.json({ project: proj.data, phases: phases.data, activity: activity.data })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const now = new Date().toISOString()
  const update: Record<string, unknown> = { updated_at: now }
  if (body.current_hand) { update.current_hand = body.current_hand; update.ticker_start_date = now }
  if (body.current_phase) update.current_phase = body.current_phase
  if (body.notes !== undefined) update.notes = body.notes

  const { data, error } = await supabaseAdmin.from('projects').update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('project_activity').insert({
    project_id: params.id, event_type: 'UPDATE',
    description: `Updated: ${Object.keys(body).join(', ')}`,
  })
  return NextResponse.json(data)
}
