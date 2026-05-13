import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { action, phase_name } = body
  const now = new Date().toISOString()

  if (action === 'deliver') {
    await supabaseAdmin.from('projects').update({ current_hand: 'client', ticker_start_date: now, updated_at: now }).eq('id', params.id)
    await supabaseAdmin.from('project_phases').upsert({ project_id: params.id, phase_name, draft_delivered: true, updated_at: now }, { onConflict: 'project_id,phase_name' })
    await supabaseAdmin.from('project_activity').insert({ project_id: params.id, event_type: 'DELIVERY', description: 'Draft delivered — flipped to Client Hand' })
    return NextResponse.json({ ok: true, hand: 'client' })
  }

  if (action === 'review_held') {
    await supabaseAdmin.from('projects').update({ current_hand: 'designer', ticker_start_date: now, updated_at: now }).eq('id', params.id)
    await supabaseAdmin.from('project_phases').upsert({ project_id: params.id, phase_name, review_held: true, updated_at: now }, { onConflict: 'project_id,phase_name' })
    await supabaseAdmin.from('project_activity').insert({ project_id: params.id, event_type: 'REVIEW_HELD', description: 'Review held — flipped to Designer Hand, ticker reset' })
    return NextResponse.json({ ok: true, hand: 'designer' })
  }

  if (action === 'check') {
    const { field, value } = body
    await supabaseAdmin.from('project_phases').upsert({ project_id: params.id, phase_name, [field]: value, updated_at: now }, { onConflict: 'project_id,phase_name' })
    await supabaseAdmin.from('project_activity').insert({ project_id: params.id, event_type: 'TASK_CHECK', description: `${field} = ${value}` })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
