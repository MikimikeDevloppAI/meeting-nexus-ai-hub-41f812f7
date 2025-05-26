
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
      // First, verify the meeting exists and get current state
      const { data: existingMeeting, error: checkError } = await supabase
        .from("meetings")
        .select("*")
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

      // Prepare the update object
      const updateData = { [field]: value };
      console.log(`[UPDATE] Update data:`, updateData);

      // Perform the update without requiring select to return data
      const { error: updateError } = await supabase
        .from("meetings")
        .update(updateData)
        .eq('id', meetingId);

      if (updateError) {
        console.error(`[UPDATE] Error updating ${field}:`, updateError);
        throw new Error(`Failed to update ${field}: ${updateError.message}`);
      }

      // Fetch the updated meeting to confirm the update worked
      const { data: updatedMeeting, error: fetchError } = await supabase
        .from("meetings")
        .select("*")
        .eq('id', meetingId)
        .single();

      if (fetchError) {
        console.error(`[UPDATE] Error fetching updated meeting:`, fetchError);
        throw new Error(`Update may have failed - cannot fetch updated meeting: ${fetchError.message}`);
      }

      if (!updatedMeeting) {
        console.error(`[UPDATE] No meeting found after update for ID ${meetingId}`);
        throw new Error(`Update failed - meeting not found after update`);
      }

      console.log(`[UPDATE] Successfully updated ${field} for meeting:`, updatedMeeting);
      return updatedMeeting;

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
