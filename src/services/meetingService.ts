
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
    return meetingId;
  }

  static async updateMeetingField(meetingId: string, field: string, value: any) {
    console.log(`[UPDATE] Updating meeting ${meetingId} field ${field}:`, value);
    
    try {
      const { error: updateError } = await supabase
        .from("meetings")
        .update({ [field]: value })
        .eq('id', meetingId);

      if (updateError) {
        console.error(`[UPDATE] Error updating ${field}:`, updateError);
        throw new Error(`Failed to update ${field}: ${updateError.message}`);
      }

      console.log(`[UPDATE] Successfully updated ${field} for meeting ${meetingId}`);
      return { success: true };

    } catch (error) {
      console.error(`[UPDATE] Unexpected error updating meeting ${meetingId}:`, error);
      throw error;
    }
  }

  static async batchUpdateMeeting(meetingId: string, updates: Record<string, any>) {
    console.log(`[BATCH_UPDATE] Updating meeting ${meetingId} with:`, updates);
    
    try {
      const { error: updateError } = await supabase
        .from("meetings")
        .update(updates)
        .eq('id', meetingId);

      if (updateError) {
        console.error(`[BATCH_UPDATE] Error updating meeting:`, updateError);
        throw new Error(`Failed to update meeting: ${updateError.message}`);
      }

      console.log(`[BATCH_UPDATE] Successfully updated meeting ${meetingId}`);
      return { success: true };

    } catch (error) {
      console.error(`[BATCH_UPDATE] Unexpected error updating meeting ${meetingId}:`, error);
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
