
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
    
    // First, verify the meeting exists
    const { data: existingMeeting, error: checkError } = await supabase
      .from("meetings")
      .select("id, title")
      .eq('id', meetingId)
      .single();

    if (checkError) {
      console.error(`[UPDATE] Error checking if meeting exists:`, checkError);
      throw new Error(`Failed to verify meeting exists: ${checkError.message}`);
    }

    if (!existingMeeting) {
      console.error(`[UPDATE] Meeting ${meetingId} does not exist in database`);
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    console.log(`[UPDATE] Meeting exists:`, existingMeeting);

    // Now perform the update
    const { data, error } = await supabase
      .from("meetings")
      .update({ [field]: value })
      .eq('id', meetingId)
      .select();

    if (error) {
      console.error(`[UPDATE] Error updating ${field}:`, error);
      throw new Error(`Failed to update ${field}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.error(`[UPDATE] Update returned no data for meeting ${meetingId}`);
      throw new Error(`Update failed - no rows affected`);
    }

    console.log(`[UPDATE] Successfully updated ${field} for meeting:`, data[0]);
    return data[0];
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
