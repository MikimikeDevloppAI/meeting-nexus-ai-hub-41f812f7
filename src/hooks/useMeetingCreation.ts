
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
      
      console.log('Creating meeting with title:', title);
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
        console.error('Meeting creation error:', meetingError);
        throw meetingError;
      }
      
      if (!meetingData) {
        throw new Error("Échec de la création de la réunion");
      }

      meetingId = meetingData.id;
      console.log('Meeting created with ID:', meetingId);
      
      // Verify meeting exists in database
      const { data: verifyMeeting, error: verifyError } = await supabase
        .from("meetings")
        .select("id, title")
        .eq('id', meetingId)
        .single();

      if (verifyError || !verifyMeeting) {
        console.error('Meeting verification failed:', verifyError);
        throw new Error("Meeting creation verification failed");
      }

      console.log('Meeting verified in database:', verifyMeeting);
      
      updateStepStatus('create', 'completed');
      setProgress(20);

      let audioFileUrl: string | null = null;
      let transcript: string | null = null;
      let summary: string | null = null;

      // Step 2: Upload audio if provided
      if (audioBlob || audioFile) {
        updateStepStatus('upload', 'processing');
        setProgress(25);

        const fileToUpload = audioFile || new File([audioBlob!], "recording.webm", { 
          type: audioBlob?.type || "audio/webm" 
        });
        
        const fileName = `meetings/${Date.now()}-${fileToUpload.name}`;
        console.log('Uploading audio file:', fileName);

        try {
          const { data, error } = await supabase.storage
            .from("meeting-audio")
            .upload(fileName, fileToUpload);

          if (error) {
            console.error('Storage upload error:', error);
            throw error;
          }
          
          const { data: publicUrlData } = supabase.storage
            .from("meeting-audio")
            .getPublicUrl(fileName);
          
          audioFileUrl = publicUrlData.publicUrl;
          console.log('Audio uploaded to:', audioFileUrl);
          
          updateStepStatus('upload', 'completed');
          setProgress(35);

          // Step 3: Transcribe audio
          updateStepStatus('transcribe', 'processing');
          setProgress(40);
          
          const uploadUrl = await uploadAudioToAssemblyAI(audioFileUrl);
          const participantCount = Math.max(selectedParticipantIds.length, 2);
          const transcriptId = await requestTranscription(uploadUrl, participantCount);
          
          const result = await pollForTranscription(transcriptId);
          
          updateStepStatus('transcribe', 'completed');
          setProgress(60);
          
          if (result.text) {
            console.log(`Original transcript length: ${result.text.length} characters`);
            transcript = result.text;
            
            // Step 4: Process transcript with OpenAI
            updateStepStatus('process', 'processing');
            setProgress(70);
            
            const selectedParticipants = participants.filter(p => 
              selectedParticipantIds.includes(p.id)
            );

            try {
              console.log('Sending transcript to OpenAI for processing...');
              const { data: functionResult, error: functionError } = await supabase.functions.invoke('process-transcript', {
                body: {
                  transcript: result.text,
                  participants: selectedParticipants,
                  meetingId
                }
              });

              if (functionError) {
                console.error('OpenAI processing error:', functionError);
                throw functionError;
              }

              if (functionResult?.processedTranscript) {
                transcript = functionResult.processedTranscript;
                console.log(`Processed transcript length: ${transcript.length} characters`);
                
                updateStepStatus('process', 'completed');
                setProgress(80);

                if (functionResult.summary) {
                  summary = functionResult.summary;
                  console.log(`Summary length: ${summary.length} characters`);
                  updateStepStatus('summary', 'completed');
                } else {
                  updateStepStatus('summary', 'error');
                }
                setProgress(85);
              } else {
                console.warn('No processed transcript returned, using original');
                updateStepStatus('process', 'error');
                updateStepStatus('summary', 'error');
              }
            } catch (openaiError) {
              console.error('OpenAI processing failed:', openaiError);
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
          console.error("Transcription failed:", transcriptionError);
          updateStepStatus('upload', 'error');
          updateStepStatus('transcribe', 'error');
          updateStepStatus('process', 'error');
          updateStepStatus('summary', 'error');
          toast({
            title: "Erreur de transcription",
            description: "La transcription a échoué, mais la réunion sera créée sans transcription.",
            variant: "destructive",
          });
        }
      }

      // Step 5: Update meeting with results - ALWAYS UPDATE SOMETHING
      updateStepStatus('save', 'processing');
      setProgress(90);

      console.log('About to update meeting with:', {
        meetingId,
        audioFileUrl,
        transcriptLength: transcript?.length || 0,
        summaryLength: summary?.length || 0
      });

      // Always include at least one field to update
      const updateData: any = { title }; // Always update title to ensure query has something to update
      
      if (audioFileUrl) {
        updateData.audio_url = audioFileUrl;
        console.log('Adding audio_url to update:', audioFileUrl);
      }
      
      if (transcript) {
        updateData.transcript = transcript;
        console.log('Adding transcript to update, length:', transcript.length);
      }
      
      if (summary) {
        updateData.summary = summary;
        console.log('Adding summary to update, length:', summary.length);
      }

      console.log('Final update data keys:', Object.keys(updateData));
      console.log('Updating meeting ID:', meetingId);

      const { data: updateResult, error: updateError } = await supabase
        .from("meetings")
        .update(updateData)
        .eq('id', meetingId)
        .select('id, title, audio_url, transcript, summary');

      if (updateError) {
        console.error('Meeting update error:', updateError);
        throw updateError;
      }

      if (!updateResult || updateResult.length === 0) {
        console.error('Update returned no results - meeting may not exist');
        throw new Error('Failed to update meeting - no rows affected');
      }

      console.log('Meeting update successful:', {
        id: updateResult[0].id,
        title: updateResult[0].title,
        hasAudio: !!updateResult[0].audio_url,
        hasTranscript: !!updateResult[0].transcript,
        hasSummary: !!updateResult[0].summary
      });

      // Step 6: Add participants
      if (selectedParticipantIds.length > 0) {
        console.log('Adding participants:', selectedParticipantIds);
        const participantsToAdd = selectedParticipantIds.map(participantId => ({
          meeting_id: meetingId,
          participant_id: participantId,
        }));

        const { error: participantsError } = await supabase
          .from("meeting_participants")
          .insert(participantsToAdd);

        if (participantsError) {
          console.error('Participants insertion error:', participantsError);
          throw participantsError;
        }
      }

      updateStepStatus('save', 'completed');
      setProgress(100);

      console.log('Meeting creation completed successfully');

      let successMessage = "Votre réunion a été créée avec succès";
      if (transcript && summary) {
        successMessage += " avec transcription et résumé";
      } else if (transcript) {
        successMessage += " avec transcription";
      }

      toast({
        title: "Réunion créée",
        description: successMessage,
      });

      // Navigate after a small delay
      setTimeout(() => {
        navigate(`/meetings/${meetingId}`);
      }, 500);

    } catch (error: any) {
      console.error("Erreur lors de la création de la réunion:", error);
      
      // If we created a meeting but failed later, still try to navigate to it
      if (meetingId) {
        console.log('Meeting was created but processing failed, navigating to meeting:', meetingId);
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
