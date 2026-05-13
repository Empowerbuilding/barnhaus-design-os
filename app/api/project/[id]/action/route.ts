import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { action, phase_name, field, value } = body
  const now = new Date().toISOString()

  // Generic checkbox toggle with auto-flip logic
  if (action === 'check') {
    // Update the phase row
    await supabaseAdmin.from('project_phases').upsert(
      { project_id: params.id, phase_name, [field]: value, updated_at: now },
      { onConflict: 'project_id,phase_name' }
    )
    await supabaseAdmin.from('project_activity').insert({
      project_id: params.id, event_type: 'TASK_CHECK',
      description: `${field} → ${value}`
    })

    let handUpdate: Record<string, unknown> | null = null

    // Auto-flip hand logic
    if (field === 'handoff_pending' && value === true) {
      // Hand to Upworker: flip to upworker, ticker resets to 5d
      handUpdate = { current_hand: 'upworker', ticker_start_date: now, ticker_duration_days: 5, updated_at: now }
      await supabaseAdmin.from('project_activity').insert({
        project_id: params.id, event_type: 'AUTO_FLIP', description: 'Auto-flipped to Upworker (5d ticker)'
      })
    } else if (field === 'draft_delivered' && value === true) {
      // Draft Delivered: flip to client, ticker resets (count-up from now)
      handUpdate = { current_hand: 'client', ticker_start_date: now, updated_at: now }
      await supabaseAdmin.from('project_activity').insert({
        project_id: params.id, event_type: 'AUTO_FLIP', description: 'Auto-flipped to Client (draft delivered)'
      })
    } else if (field === 'review_held' && value === true) {
      // Review Held: flip to designer, ticker resets to 2d (polish window)
      handUpdate = { current_hand: 'designer', ticker_start_date: now, ticker_duration_days: 2, updated_at: now }
      await supabaseAdmin.from('project_activity').insert({
        project_id: params.id, event_type: 'AUTO_FLIP', description: 'Auto-flipped to Designer (2d polish ticker)'
      })
    } else if (field === 'review_scheduled' && value === true) {
      // Thaw: if frozen (client hand), keep client hand but note scheduled (card turns purple via UI)
      await supabaseAdmin.from('project_activity').insert({
        project_id: params.id, event_type: 'THAW', description: 'Review scheduled — card thawed (purple)'
      })
    }

    if (handUpdate) {
      await supabaseAdmin.from('projects').update(handUpdate).eq('id', params.id)
    }

    return NextResponse.json({ ok: true, auto_flip: !!handUpdate })
  }

  // Legacy actions
  if (action === 'deliver') {
    await supabaseAdmin.from('projects').update({ current_hand: 'client', ticker_start_date: now, updated_at: now }).eq('id', params.id)
    await supabaseAdmin.from('project_phases').upsert({ project_id: params.id, phase_name, draft_delivered: true, updated_at: now }, { onConflict: 'project_id,phase_name' })
    await supabaseAdmin.from('project_activity').insert({ project_id: params.id, event_type: 'DELIVERY', description: 'Draft delivered — flipped to Client' })
    return NextResponse.json({ ok: true })
  }

  if (action === 'review_held') {
    await supabaseAdmin.from('projects').update({ current_hand: 'designer', ticker_start_date: now, ticker_duration_days: 2, updated_at: now }).eq('id', params.id)
    await supabaseAdmin.from('project_phases').upsert({ project_id: params.id, phase_name, review_held: true, updated_at: now }, { onConflict: 'project_id,phase_name' })
    await supabaseAdmin.from('project_activity').insert({ project_id: params.id, event_type: 'REVIEW_HELD', description: 'Review held — flipped to Designer (2d ticker)' })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
