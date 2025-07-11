import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { launch } from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

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

    // Launch browser
    const browser = await launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log('Navigating to ESCRS IOL Calculator...');
    await page.goto('https://iolcalculator.escrs.org/', { waitUntil: 'networkidle2' });

    // Fill surgeon name
    console.log('Filling surgeon field...');
    await page.waitForSelector('input[name="surgeon"]', { timeout: 10000 });
    await page.type('input[name="surgeon"]', 'Tabibian');

    // Select gender
    console.log('Selecting gender...');
    await page.select('select[name="gender"]', 'Female');

    // Generate patient data
    const patientName = `Patient_${Date.now().toString().slice(-6)}`;
    const patientId = `ID_${Date.now().toString().slice(-8)}`;
    const birthDate = '01/01/1970';

    await page.type('input[name="patient_name"]', patientName);
    await page.type('input[name="patient_id"]', patientId);
    await page.type('input[name="birth_date"]', birthDate);

    // Fill Right Eye data
    console.log('Filling right eye data...');
    if (iolData.rightEye.AL) await page.type('input[name="right_al"]', iolData.rightEye.AL);
    if (iolData.rightEye.CCT) await page.type('input[name="right_cct"]', iolData.rightEye.CCT);
    if (iolData.rightEye.AD) await page.type('input[name="right_ad"]', iolData.rightEye.AD);
    if (iolData.rightEye.ACD) await page.type('input[name="right_acd"]', iolData.rightEye.ACD);
    if (iolData.rightEye.LT) await page.type('input[name="right_lt"]', iolData.rightEye.LT);
    if (iolData.rightEye.K1) await page.type('input[name="right_k1"]', iolData.rightEye.K1);
    if (iolData.rightEye.K2) await page.type('input[name="right_k2"]', iolData.rightEye.K2);
    if (iolData.rightEye.AST) await page.type('input[name="right_ast"]', iolData.rightEye.AST);
    if (iolData.rightEye.WTW) await page.type('input[name="right_wtw"]', iolData.rightEye.WTW);

    // Fill Left Eye data
    console.log('Filling left eye data...');
    if (iolData.leftEye.AL) await page.type('input[name="left_al"]', iolData.leftEye.AL);
    if (iolData.leftEye.CCT) await page.type('input[name="left_cct"]', iolData.leftEye.CCT);
    if (iolData.leftEye.AD) await page.type('input[name="left_ad"]', iolData.leftEye.AD);
    if (iolData.leftEye.ACD) await page.type('input[name="left_acd"]', iolData.leftEye.ACD);
    if (iolData.leftEye.LT) await page.type('input[name="left_lt"]', iolData.leftEye.LT);
    if (iolData.leftEye.K1) await page.type('input[name="left_k1"]', iolData.leftEye.K1);
    if (iolData.leftEye.K2) await page.type('input[name="left_k2"]', iolData.leftEye.K2);
    if (iolData.leftEye.AST) await page.type('input[name="left_ast"]', iolData.leftEye.AST);
    if (iolData.leftEye.WTW) await page.type('input[name="left_wtw"]', iolData.leftEye.WTW);

    // Click calculate button
    console.log('Clicking calculate button...');
    await page.click('button[type="submit"]');
    
    // Wait for results
    await page.waitForTimeout(3000);

    // Take screenshot
    console.log('Taking screenshot...');
    const screenshot = await page.screenshot({ 
      type: 'png',
      fullPage: true,
      encoding: 'base64'
    });

    await browser.close();

    console.log('Automation completed successfully');

    return new Response(JSON.stringify({
      success: true,
      screenshot: `data:image/png;base64,${screenshot}`,
      message: 'IOL calculation completed successfully',
      patientData: {
        name: patientName,
        id: patientId,
        birthDate: birthDate
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in IOL automation:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Failed to complete IOL automation'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});