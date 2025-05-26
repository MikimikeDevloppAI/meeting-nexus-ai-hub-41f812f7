
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
      // Perform the update and return the updated row
      const { data: updatedData, error: updateError } = await supabase
        .from("meetings")
        .update({ [field]: value })
        .eq('id', meetingId)
        .select()
        .single();

      if (updateError) {
        console.error(`[UPDATE] Error updating ${field}:`, updateError);
        throw new Error(`Failed to update ${field}: ${updateError.message}`);
      }

      if (!updatedData) {
        console.error(`[UPDATE] No data returned after update for meeting ${meetingId}`);
        throw new Error(`Update failed - no data returned`);
      }

      console.log(`[UPDATE] Successfully updated ${field} for meeting:`, updatedData);
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
