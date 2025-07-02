import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker using the local version
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

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
    console.log('Loading PDF from URL:', pdfUrl);
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    
    console.log('PDF loaded, pages:', pdf.numPages);
    
    // Get the first page
    const page = await pdf.getPage(1);
    
    // Get page viewport
    const viewport = page.getViewport({ scale });
    
    // Create canvas element
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Could not get canvas context');
    }
    
    // Set canvas dimensions
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Render the page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    
    console.log('Rendering PDF page to canvas...');
    await page.render(renderContext).promise;
    
    // Convert canvas to image data URL
    const imageDataUrl = canvas.toDataURL('image/png', quality);
    
    console.log('PDF successfully converted to image');
    return imageDataUrl;
    
  } catch (error) {
    console.error('Error converting PDF to image:', error);
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
    console.log('Using cached PDF image');
    return imageCache.get(cacheKey)!;
  }
  
  // Convert and cache the result
  const imageDataUrl = await convertPdfToImage(pdfUrl, options);
  imageCache.set(cacheKey, imageDataUrl);
  
  return imageDataUrl;
};