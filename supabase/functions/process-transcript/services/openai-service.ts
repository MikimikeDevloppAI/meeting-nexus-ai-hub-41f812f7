
export async function callOpenAI(prompt: string, openAIKey: string, temperature: number = 0.3) {
  console.log('🔄 Making OpenAI API call...')
  console.log('📏 Prompt length:', prompt.length, 'characters')
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: 16384,
      }),
    });

    console.log('📡 OpenAI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error response:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const result = data.choices[0]?.message?.content;
    
    console.log('✅ OpenAI API call successful');
    console.log('📏 Response length:', result?.length || 0, 'characters');
    
    return result;
  } catch (error) {
    console.error('❌ OpenAI API call failed:', error);
    throw error;
  }
}
