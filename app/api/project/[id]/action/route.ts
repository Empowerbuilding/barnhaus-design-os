import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PHASE_DURATION } from '@/lib/card-utils'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { action, phase_name, field, value } = body
  const now = new Date().toISOString()

  if (action === 'check') {
    // Upsert the checkbox
    await supabaseAdmin.from('project_phases').upsert(
      { project_id: params.id, phase_name, [field]: value, updated_at: now },
      { onConflict: 'project_id,phase_name' }
    )
    await supabaseAdmin.from('project_activity').insert({
      project_id: params.id, event_type: 'TASK_CHECK',
      description: `${field} → ${value}`
    })

    let handUpdate: Record<string, unknown> | null = null

    if (field === 'review_held' && value === true) {
      // Meeting held: ticker starts NOW at phase duration. Hand → designer.
      const duration = PHASE_DURATION[phase_name] ?? 14
      handUpdate = {
        current_hand: 'designer',
        ticker_start_date: now,
        ticker_duration_days: duration,
        updated_at: now,
      }
      await supabaseAdmin.from('project_activity').insert({
        project_id: params.id, event_type: 'AUTO_FLIP',
        description: `Review held → Designer hand, ${duration}d ticker starts`
      })
    } else if (field === 'handoff_pending' && value === true) {
      // Handed to upworker — ticker does NOT reset (client promise stays)
      handUpdate = { current_hand: 'upworker', updated_at: now }
      await supabaseAdmin.from('project_activity').insert({
        project_id: params.id, event_type: 'AUTO_FLIP',
        description: 'Handoff to Upworker — ticker unchanged'
      })
    } else if (field === 'polishing' && value === true) {
      // Upworker done, back to designer — ticker does NOT reset
      handUpdate = { current_hand: 'designer', updated_at: now }
      await supabaseAdmin.from('project_activity').insert({
        project_id: params.id, event_type: 'AUTO_FLIP',
        description: 'Polishing — back to Designer, ticker unchanged'
      })
    } else if (field === 'draft_delivered' && value === true) {
      // Delivered to client — flip to client, start wait ticker
      handUpdate = { current_hand: 'client', ticker_start_date: now, updated_at: now }
      await supabaseAdmin.from('project_activity').insert({
        project_id: params.id, event_type: 'AUTO_FLIP',
        description: 'Draft delivered → Client hand'
      })
    } else if (field === 'review_scheduled' && value === true) {
      // Scheduled: card turns purple, no hand change
      await supabaseAdmin.from('project_activity').insert({
        project_id: params.id, event_type: 'SCHEDULED',
        description: 'Review scheduled — card thawed (purple)'
      })
    }

    if (handUpdate) {
      await supabaseAdmin.from('projects').update(handUpdate).eq('id', params.id)
    }

    return NextResponse.json({ ok: true, auto_flip: !!handUpdate, new_hand: handUpdate?.current_hand ?? null })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
