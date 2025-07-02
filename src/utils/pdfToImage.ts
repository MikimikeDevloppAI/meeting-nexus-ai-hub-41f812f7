import * as pdfjsLib from 'pdfjs-dist';

// Disable worker entirely to avoid loading issues
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = null;
(pdfjsLib as any).disableWorker = true;

interface PdfToImageOptions {
  scale?: number;
  quality?: number;
}

export const convertPdfToImage = async (
  pdfUrl: string, 
  options: PdfToImageOptions = {}
): Promise<string> => {
  const { scale = 1.5, quality = 0.8 } = options;
  
  try {
    console.log('🔄 Starting PDF to image conversion locally');
    console.log('📄 PDF URL:', pdfUrl);
    console.log('⚙️ Options:', { scale, quality });

    // Load the PDF document without worker
    console.log('📥 Loading PDF document without worker...');
    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      verbosity: 0,
      isEvalSupported: false,
      useWorkerFetch: false,
    });
    
    const pdf = await loadingTask.promise;
    console.log('✅ PDF loaded successfully, pages:', pdf.numPages);

    // Get the first page
    console.log('📖 Getting first page...');
    const page = await pdf.getPage(1);
    console.log('✅ Page retrieved successfully');

    // Get page viewport
    const viewport = page.getViewport({ scale });
    console.log('📐 Viewport dimensions:', viewport.width, 'x', viewport.height);

    // Create canvas element
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      console.error('❌ Could not get canvas context');
      throw new Error('Could not get canvas context');
    }
    
    console.log('🎨 Canvas context created successfully');

    // Set canvas dimensions
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    console.log('📏 Canvas dimensions set:', canvas.width, 'x', canvas.height);

    // Render the page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    
    console.log('🖼️ Starting page render...');
    await page.render(renderContext).promise;
    console.log('✅ Page rendered successfully to canvas');

    // Convert canvas to image data URL
    console.log('🔄 Converting canvas to image data URL...');
    const imageDataUrl = canvas.toDataURL('image/png', quality);
    console.log('✅ Canvas converted to image, data URL length:', imageDataUrl.length);
    
    console.log('🎉 PDF conversion completed successfully!');
    return imageDataUrl;
    
  } catch (error) {
    console.error('❌ Error converting PDF to image:');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    throw error;
  }
};

// Cache for converted images to avoid re-processing
const imageCache = new Map<string, string>();

export const convertPdfToImageCached = async (
  pdfUrl: string, 
  options: PdfToImageOptions = {}
): Promise<string> => {
  // Create cache key based on URL and options
  const cacheKey = `${pdfUrl}_${JSON.stringify(options)}`;
  
  // Check if we have this image cached
  if (imageCache.has(cacheKey)) {
    console.log('💾 Using cached PDF image');
    return imageCache.get(cacheKey)!;
  }
  
  // Convert and cache the result
  const imageDataUrl = await convertPdfToImage(pdfUrl, options);
  imageCache.set(cacheKey, imageDataUrl);
  
  return imageDataUrl;
};