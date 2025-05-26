
import { supabase } from "@/integrations/supabase/client";

export class MeetingService {
  static async createMeeting(title: string, userId: string): Promise<string> {
    console.log('[CREATE] Creating meeting with title:', title);
    
    const { data: meetingData, error: meetingError } = await supabase
      .from("meetings")
      .insert([{
        title,
        created_by: userId,
        audio_url: null,
        transcript: null,
        summary: null
      }])
      .select()
      .single();

    if (meetingError) {
      console.error('[CREATE] Meeting creation error:', meetingError);
      throw meetingError;
    }
    
    if (!meetingData) {
      throw new Error("Échec de la création de la réunion");
    }

    console.log('[CREATE] Meeting created with ID:', meetingData.id);
    return meetingData.id;
  }

  static async updateMeetingField(meetingId: string, field: string, value: any) {
    console.log(`[UPDATE] Attempting to update meeting ${meetingId} field ${field}:`, value);
    
    try {
      // Simple update without requiring single() to avoid "no rows" error
      const { error: updateError } = await supabase
        .from("meetings")
        .update({ [field]: value })
        .eq('id', meetingId);

      if (updateError) {
        console.error(`[UPDATE] Error updating ${field}:`, updateError);
        throw new Error(`Failed to update ${field}: ${updateError.message}`);
      }

      console.log(`[UPDATE] Successfully updated ${field} for meeting ${meetingId}`);
      
      // Verify the update worked by fetching the meeting
      const { data: verifiedData, error: verifyError } = await supabase
        .from("meetings")
        .select(field)
        .eq('id', meetingId)
        .single();

      if (verifyError) {
        console.warn(`[UPDATE] Could not verify update: ${verifyError.message}`);
        // Don't throw error here, the update might have worked
      } else {
        console.log(`[UPDATE] Verified update - ${field}:`, verifiedData[field]);
      }

      return { success: true };

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
