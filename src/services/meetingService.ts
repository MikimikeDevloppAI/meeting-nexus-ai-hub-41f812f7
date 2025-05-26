
import { supabase } from "@/integrations/supabase/client";

export class MeetingService {
  static async createMeeting(title: string, userId: string): Promise<string> {
    console.log('[CREATE] Creating meeting with title:', title, 'for user:', userId);
    
    const { data: meetingData, error: meetingError } = await supabase
      .from("meetings")
      .insert([{
        title,
        created_by: userId,
        audio_url: null,
        transcript: null,
        summary: null
      }])
      .select('id')
      .single();

    if (meetingError) {
      console.error('[CREATE] Meeting creation error:', meetingError);
      throw meetingError;
    }
    
    if (!meetingData || !meetingData.id) {
      console.error('[CREATE] No meeting data returned:', meetingData);
      throw new Error("Échec de la création de la réunion - pas d'ID retourné");
    }

    const meetingId = meetingData.id;
    console.log('[CREATE] Meeting created successfully with ID:', meetingId);
    
    // Verify the meeting exists by fetching it
    const { data: verifyData, error: verifyError } = await supabase
      .from("meetings")
      .select('id, title, created_by')
      .eq('id', meetingId)
      .single();

    if (verifyError || !verifyData) {
      console.error('[CREATE] Failed to verify meeting creation:', verifyError);
      throw new Error("La réunion a été créée mais ne peut pas être vérifiée");
    }

    console.log('[CREATE] Meeting verified:', verifyData);
    return meetingId;
  }

  static async updateMeetingField(meetingId: string, field: string, value: any) {
    console.log(`[UPDATE] Attempting to update meeting ${meetingId} field ${field}:`, value);
    
    // First verify the meeting exists
    const { data: existingMeeting, error: fetchError } = await supabase
      .from("meetings")
      .select('id')
      .eq('id', meetingId)
      .single();

    if (fetchError || !existingMeeting) {
      console.error(`[UPDATE] Meeting ${meetingId} not found:`, fetchError);
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    console.log(`[UPDATE] Meeting ${meetingId} exists, proceeding with update`);
    
    try {
      const { data: updatedData, error: updateError } = await supabase
        .from("meetings")
        .update({ [field]: value })
        .eq('id', meetingId)
        .select('id, ' + field)
        .single();

      if (updateError) {
        console.error(`[UPDATE] Error updating ${field}:`, updateError);
        throw new Error(`Failed to update ${field}: ${updateError.message}`);
      }

      if (!updatedData) {
        console.error(`[UPDATE] No data returned after update for meeting ${meetingId}`);
        throw new Error(`Update failed - no data returned for meeting ${meetingId}`);
      }

      console.log(`[UPDATE] Successfully updated ${field} for meeting ${meetingId}:`, updatedData);
      return updatedData;

    } catch (error) {
      console.error(`[UPDATE] Unexpected error updating meeting ${meetingId}:`, error);
      throw error;
    }
  }

  static async addParticipants(meetingId: string, participantIds: string[]) {
    if (participantIds.length === 0) return;

    console.log('[PARTICIPANTS] Adding participants:', participantIds);
    
    const participantsToAdd = participantIds.map(participantId => ({
      meeting_id: meetingId,
      participant_id: participantId,
    }));

    const { error: participantsError } = await supabase
      .from("meeting_participants")
      .insert(participantsToAdd);

    if (participantsError) {
      console.error('[PARTICIPANTS] Participants insertion error:', participantsError);
      throw participantsError;
    }
    
    console.log('[PARTICIPANTS] Participants added successfully');
  }
}
