
-- Add raw_transcript column to store the original AssemblyAI transcript
ALTER TABLE public.meetings 
ADD COLUMN raw_transcript text;

-- Add comment to explain the purpose
COMMENT ON COLUMN public.meetings.raw_transcript IS 'Original transcript from AssemblyAI before OpenAI processing';
