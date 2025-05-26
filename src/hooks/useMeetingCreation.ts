
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { uploadAudioToAssemblyAI, requestTranscription, pollForTranscription } from "@/lib/assemblyai";

interface Participant {
  id: string;
  name: string;
  email: string;
}

interface ProcessingStep {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export const useMeetingCreation = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { id: 'create', title: 'Création de la réunion', status: 'pending' },
    { id: 'upload', title: 'Téléchargement de l\'audio', status: 'pending' },
    { id: 'transcribe', title: 'Transcription en cours', status: 'pending' },
    { id: 'process', title: 'Nettoyage du transcript', status: 'pending' },
    { id: 'summary', title: 'Génération du résumé', status: 'pending' },
    { id: 'save', title: 'Finalisation', status: 'pending' }
  ]);
  const [progress, setProgress] = useState(0);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const updateStepStatus = (stepId: string, status: ProcessingStep['status']) => {
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const updateMeetingField = async (meetingId: string, field: string, value: any) => {
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
  };

  const createMeeting = async (
    title: string,
    audioBlob: Blob | null,
    audioFile: File | null,
    participants: Participant[],
    selectedParticipantIds: string[]
  ) => {
    if (!title) {
      toast({
        title: "Information manquante",
        description: "Veuillez saisir un titre de réunion",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Erreur d'authentification",
        description: "Vous devez être connecté pour créer une réunion",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setProgress(0);
    setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));

    let meetingId: string | null = null;

    try {
      // Step 1: Create meeting
      updateStepStatus('create', 'processing');
      setProgress(10);
      
      console.log('[CREATE] Creating meeting with title:', title);
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .insert([{
          title,
          created_by: user.id,
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

      meetingId = meetingData.id;
      console.log('[CREATE] Meeting created with ID:', meetingId);
      
      updateStepStatus('create', 'completed');
      setProgress(20);

      // Step 2: Upload and save audio if provided
      if (audioBlob || audioFile) {
        updateStepStatus('upload', 'processing');
        setProgress(25);

        const fileToUpload = audioFile || new File([audioBlob!], "recording.webm", { 
          type: audioBlob?.type || "audio/webm" 
        });
        
        const fileName = `meetings/${Date.now()}-${fileToUpload.name}`;
        console.log('[UPLOAD] Uploading audio file:', fileName);

        const { data, error } = await supabase.storage
          .from("meeting-audio")
          .upload(fileName, fileToUpload);

        if (error) {
          console.error('[UPLOAD] Storage upload error:', error);
          throw error;
        }
        
        const { data: publicUrlData } = supabase.storage
          .from("meeting-audio")
          .getPublicUrl(fileName);
        
        const audioFileUrl = publicUrlData.publicUrl;
        console.log('[UPLOAD] Audio uploaded to:', audioFileUrl);
        
        // Save audio URL immediately
        console.log('[UPLOAD] Saving audio URL to database...');
        await updateMeetingField(meetingId, 'audio_url', audioFileUrl);
        console.log('[UPLOAD] Audio URL saved successfully');
        
        updateStepStatus('upload', 'completed');
        setProgress(35);

        // Step 3: Transcribe audio
        updateStepStatus('transcribe', 'processing');
        setProgress(40);
        
        try {
          console.log('[TRANSCRIBE] Starting transcription process...');
          const uploadUrl = await uploadAudioToAssemblyAI(audioFileUrl);
          const participantCount = Math.max(selectedParticipantIds.length, 2);
          const transcriptId = await requestTranscription(uploadUrl, participantCount);
          
          const result = await pollForTranscription(transcriptId);
          
          updateStepStatus('transcribe', 'completed');
          setProgress(60);
          
          if (result.text) {
            console.log('[TRANSCRIBE] Transcript received, length:', result.text.length);
            
            // Save original transcript immediately
            console.log('[TRANSCRIBE] Saving transcript to database...');
            await updateMeetingField(meetingId, 'transcript', result.text);
            console.log('[TRANSCRIBE] Transcript saved successfully');
            
            // Step 4: Process transcript with OpenAI
            updateStepStatus('process', 'processing');
            setProgress(70);
            
            const selectedParticipants = participants.filter(p => 
              selectedParticipantIds.includes(p.id)
            );

            try {
              console.log('[PROCESS] Sending transcript to OpenAI for processing...');
              const { data: functionResult, error: functionError } = await supabase.functions.invoke('process-transcript', {
                body: {
                  transcript: result.text,
                  participants: selectedParticipants,
                  meetingId
                }
              });

              if (functionError) {
                console.error('[PROCESS] OpenAI processing error:', functionError);
                throw functionError;
              }

              if (functionResult?.processedTranscript) {
                const processedTranscript = functionResult.processedTranscript;
                console.log('[PROCESS] Processed transcript received, length:', processedTranscript.length);
                
                // Update with processed transcript
                console.log('[PROCESS] Saving processed transcript to database...');
                await updateMeetingField(meetingId, 'transcript', processedTranscript);
                console.log('[PROCESS] Processed transcript saved successfully');
                
                updateStepStatus('process', 'completed');
                setProgress(80);

                if (functionResult.summary) {
                  const summary = functionResult.summary;
                  console.log('[SUMMARY] Summary received, length:', summary.length);
                  
                  // Save summary immediately
                  console.log('[SUMMARY] Saving summary to database...');
                  await updateMeetingField(meetingId, 'summary', summary);
                  console.log('[SUMMARY] Summary saved successfully');
                  
                  updateStepStatus('summary', 'completed');
                } else {
                  console.warn('[SUMMARY] No summary returned from OpenAI');
                  updateStepStatus('summary', 'error');
                }
                setProgress(85);
              } else {
                console.warn('[PROCESS] No processed transcript returned, keeping original');
                updateStepStatus('process', 'error');
                updateStepStatus('summary', 'error');
              }
            } catch (openaiError) {
              console.error('[PROCESS] OpenAI processing failed:', openaiError);
              updateStepStatus('process', 'error');
              updateStepStatus('summary', 'error');
              toast({
                title: "Erreur de traitement",
                description: "Le traitement OpenAI a échoué, transcript original conservé",
                variant: "destructive",
              });
            }
          }
        } catch (transcriptionError) {
          console.error("[TRANSCRIBE] Transcription failed:", transcriptionError);
          updateStepStatus('transcribe', 'error');
          updateStepStatus('process', 'error');
          updateStepStatus('summary', 'error');
          toast({
            title: "Erreur de transcription",
            description: "La transcription a échoué, mais la réunion a été créée avec l'audio.",
            variant: "destructive",
          });
        }
      }

      // Step 5: Add participants
      updateStepStatus('save', 'processing');
      setProgress(90);

      if (selectedParticipantIds.length > 0) {
        console.log('[PARTICIPANTS] Adding participants:', selectedParticipantIds);
        const participantsToAdd = selectedParticipantIds.map(participantId => ({
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

      updateStepStatus('save', 'completed');
      setProgress(100);

      console.log('[COMPLETE] Meeting creation completed successfully');

      toast({
        title: "Réunion créée",
        description: "Votre réunion a été créée avec succès",
      });

      // Navigate after a small delay
      setTimeout(() => {
        navigate(`/meetings/${meetingId}`);
      }, 500);

    } catch (error: any) {
      console.error("[ERROR] Erreur lors de la création de la réunion:", error);
      
      // If we created a meeting but failed later, still try to navigate to it
      if (meetingId) {
        console.log('[ERROR] Meeting was created but processing failed, navigating to meeting:', meetingId);
        toast({
          title: "Réunion créée partiellement",
          description: "La réunion a été créée mais certains traitements ont échoué",
          variant: "destructive",
        });
        setTimeout(() => {
          navigate(`/meetings/${meetingId}`);
        }, 1000);
      } else {
        toast({
          title: "Erreur de création de la réunion",
          description: error.message || "Veuillez réessayer",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    processingSteps,
    progress,
    createMeeting
  };
};
