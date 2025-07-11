import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IOLData {
  surgeryType: string;
  measurementDate: string;
  rightEye: {
    AL: string;
    CCT: string;
    AD: string;
    ACD: string;
    LT: string;
    K1: string;
    K2: string;
    K: string;
    AST: string;
    WTW: string;
  };
  leftEye: {
    AL: string;
    CCT: string;
    AD: string;
    ACD: string;
    LT: string;
    K1: string;
    K2: string;
    K: string;
    AST: string;
    WTW: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting IOL automation...');
    const { iolData }: { iolData: IOLData } = await req.json();
    
    console.log('Received IOL data:', JSON.stringify(iolData, null, 2));

    // Pour le moment, nous simulons l'automatisation et retournons un message
    // En attendant une solution plus adaptée à l'environnement Edge Functions
    
    // Générer des données patient fictives
    const patientName = `Patient_${Date.now().toString().slice(-6)}`;
    const patientId = `ID_${Date.now().toString().slice(-8)}`;
    const birthDate = '01/01/1970';

    console.log('Generated patient data:', { patientName, patientId, birthDate });

    // Créer une image simple en base64 pour simuler un screenshot
    const simpleImageBase64 = "data:image/svg+xml;base64," + btoa(`
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8f9fa"/>
        <text x="400" y="50" text-anchor="middle" font-family="Arial" font-size="24" fill="#333">ESCRS IOL Calculator - Simulation</text>
        <text x="50" y="100" font-family="Arial" font-size="16" fill="#666">Patient: ${patientName}</text>
        <text x="50" y="130" font-family="Arial" font-size="16" fill="#666">ID: ${patientId}</text>
        <text x="50" y="160" font-family="Arial" font-size="16" fill="#666">Surgeon: Tabibian</text>
        <text x="50" y="200" font-family="Arial" font-size="16" fill="#333">Données OD (Œil Droit):</text>
        <text x="50" y="230" font-family="Arial" font-size="14" fill="#666">AL: ${iolData.rightEye?.AL || 'N/A'} mm</text>
        <text x="50" y="250" font-family="Arial" font-size="14" fill="#666">CCT: ${iolData.rightEye?.CCT || 'N/A'} μm</text>
        <text x="50" y="270" font-family="Arial" font-size="14" fill="#666">ACD: ${iolData.rightEye?.ACD || 'N/A'} mm</text>
        <text x="50" y="290" font-family="Arial" font-size="14" fill="#666">K1: ${iolData.rightEye?.K1 || 'N/A'}</text>
        <text x="50" y="310" font-family="Arial" font-size="14" fill="#666">K2: ${iolData.rightEye?.K2 || 'N/A'}</text>
        <text x="50" y="340" font-family="Arial" font-size="16" fill="#333">Résultats IOL calculés (simulation):</text>
        <text x="50" y="370" font-family="Arial" font-size="14" fill="#4CAF50">✓ Calcul effectué avec succès</text>
        <text x="50" y="390" font-family="Arial" font-size="14" fill="#4CAF50">✓ Données envoyées vers ESCRS</text>
        <text x="50" y="450" font-family="Arial" font-size="12" fill="#999">Note: Ceci est une simulation. L'automatisation réelle nécessite un environnement avec navigateur.</text>
      </svg>
    `);

    console.log('Automation simulation completed successfully');

    return new Response(JSON.stringify({
      success: true,
      screenshot: simpleImageBase64,
      message: 'Simulation de l\'automatisation IOL - Les données ont été formatées pour ESCRS',
      patientData: {
        name: patientName,
        id: patientId,
        birthDate: birthDate
      },
      note: 'Il s\'agit d\'une simulation. L\'automatisation réelle nécessite un environnement avec accès navigateur.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in IOL automation:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Failed to complete IOL automation simulation'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});