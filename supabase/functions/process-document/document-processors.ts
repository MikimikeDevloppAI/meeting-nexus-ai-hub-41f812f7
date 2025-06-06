
// Document processing utilities for different file types using ConvertAPI

export interface DocumentProcessor {
  canProcess(contentType: string): boolean;
  extractText(fileData: Blob, apiKey?: string): Promise<string>;
}

export class PDFProcessor implements DocumentProcessor {
  canProcess(contentType: string): boolean {
    return contentType === 'application/pdf';
  }

  async extractText(fileData: Blob, apiKey: string): Promise<string> {
    console.log(`🔄 Processing PDF (${fileData.size} bytes) with ConvertAPI...`);

    const formData = new FormData();
    formData.append('File', fileData, 'document.pdf');

    console.log('📤 Uploading PDF to ConvertAPI...');

    const uploadController = new AbortController();
    const uploadTimeout = setTimeout(() => uploadController.abort(), 45000);

    try {
      const extractResponse = await fetch('https://v2.convertapi.com/convert/pdf/to/txt', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
        signal: uploadController.signal
      });

      clearTimeout(uploadTimeout);

      if (!extractResponse.ok) {
        const errorText = await extractResponse.text();
        console.error('❌ ConvertAPI PDF error:', errorText);
        throw new Error(`PDF extraction failed: ${extractResponse.status} - ${errorText}`);
      }

      const extractData = await extractResponse.json();
      console.log('📋 ConvertAPI response data:', JSON.stringify(extractData, null, 2));
      
      if (!extractData.Files || extractData.Files.length === 0) {
        console.error('❌ No files in ConvertAPI response:', extractData);
        throw new Error('PDF text extraction failed - no result files');
      }

      const resultFile = extractData.Files[0];
      if (!resultFile.Url) {
        console.error('❌ No URL in result file:', resultFile);
        throw new Error('PDF text extraction failed - no download URL in result');
      }

      // Download the converted text file
      const textFileUrl = resultFile.Url;
      console.log(`📥 Downloading extracted text from: ${textFileUrl}`);
      
      const downloadController = new AbortController();
      const downloadTimeout = setTimeout(() => downloadController.abort(), 30000);
      
      try {
        const textResponse = await fetch(textFileUrl, {
          signal: downloadController.signal
        });
        
        clearTimeout(downloadTimeout);
        
        if (!textResponse.ok) {
          throw new Error(`Failed to download extracted text: ${textResponse.status} ${textResponse.statusText}`);
        }

        const extractedText = await textResponse.text();
        
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('PDF contains no extractable text');
        }

        console.log(`✅ PDF text extracted successfully (${extractedText.length} chars)`);
        return extractedText;

      } catch (downloadError) {
        clearTimeout(downloadTimeout);
        if (downloadError.name === 'AbortError') {
          throw new Error('Text download timed out');
        }
        throw downloadError;
      }

    } catch (extractError) {
      clearTimeout(uploadTimeout);
      if (extractError.name === 'AbortError') {
        throw new Error('PDF text extraction timed out');
      }
      throw extractError;
    }
  }
}

export class TextProcessor implements DocumentProcessor {
  canProcess(contentType: string): boolean {
    return contentType === 'text/plain';
  }

  async extractText(fileData: Blob): Promise<string> {
    console.log('📄 Processing text file...');
    const text = await fileData.text();
    
    if (!text || text.trim().length === 0) {
      throw new Error('Text file is empty');
    }
    
    console.log(`✅ Text extracted successfully (${text.length} chars)`);
    return text;
  }
}

export class WordProcessor implements DocumentProcessor {
  canProcess(contentType: string): boolean {
    return contentType === 'application/msword' || 
           contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  async extractText(fileData: Blob, apiKey: string): Promise<string> {
    console.log(`🔄 Processing Word document (${fileData.size} bytes) with ConvertAPI...`);

    const formData = new FormData();
    formData.append('File', fileData, 'document.docx');

    console.log('📤 Uploading Word document to ConvertAPI...');

    const uploadController = new AbortController();
    const uploadTimeout = setTimeout(() => uploadController.abort(), 45000);

    try {
      const extractResponse = await fetch('https://v2.convertapi.com/convert/docx/to/txt', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
        signal: uploadController.signal
      });

      clearTimeout(uploadTimeout);

      if (!extractResponse.ok) {
        const errorText = await extractResponse.text();
        console.error('❌ ConvertAPI Word error:', errorText);
        throw new Error(`Word extraction failed: ${extractResponse.status} - ${errorText}`);
      }

      const extractData = await extractResponse.json();
      console.log('📋 ConvertAPI response data:', JSON.stringify(extractData, null, 2));
      
      if (!extractData.Files || extractData.Files.length === 0) {
        console.error('❌ No files in ConvertAPI response:', extractData);
        throw new Error('Word text extraction failed - no result files');
      }

      const resultFile = extractData.Files[0];
      if (!resultFile.Url) {
        console.error('❌ No URL in result file:', resultFile);
        throw new Error('Word text extraction failed - no download URL in result');
      }

      // Download the converted text file
      const textFileUrl = resultFile.Url;
      console.log(`📥 Downloading extracted text from: ${textFileUrl}`);
      
      const downloadController = new AbortController();
      const downloadTimeout = setTimeout(() => downloadController.abort(), 30000);
      
      try {
        const textResponse = await fetch(textFileUrl, {
          signal: downloadController.signal
        });
        
        clearTimeout(downloadTimeout);
        
        if (!textResponse.ok) {
          throw new Error(`Failed to download extracted text: ${textResponse.status} ${textResponse.statusText}`);
        }

        const extractedText = await textResponse.text();
        
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('Word document contains no extractable text');
        }

        console.log(`✅ Word text extracted successfully (${extractedText.length} chars)`);
        return extractedText;

      } catch (downloadError) {
        clearTimeout(downloadTimeout);
        if (downloadError.name === 'AbortError') {
          throw new Error('Text download timed out');
        }
        throw downloadError;
      }

    } catch (extractError) {
      clearTimeout(uploadTimeout);
      if (extractError.name === 'AbortError') {
        throw new Error('Word text extraction timed out');
      }
      throw extractError;
    }
  }
}

export class PowerPointProcessor implements DocumentProcessor {
  canProcess(contentType: string): boolean {
    return contentType === 'application/vnd.ms-powerpoint' || 
           contentType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }

  async extractText(fileData: Blob, apiKey: string): Promise<string> {
    console.log(`🔄 Processing PowerPoint (${fileData.size} bytes) with ConvertAPI...`);

    const formData = new FormData();
    formData.append('File', fileData, 'presentation.pptx');

    console.log('📤 Uploading PowerPoint to ConvertAPI...');

    const uploadController = new AbortController();
    const uploadTimeout = setTimeout(() => uploadController.abort(), 45000);

    try {
      const extractResponse = await fetch('https://v2.convertapi.com/convert/pptx/to/txt', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
        signal: uploadController.signal
      });

      clearTimeout(uploadTimeout);

      if (!extractResponse.ok) {
        const errorText = await extractResponse.text();
        console.error('❌ ConvertAPI PowerPoint error:', errorText);
        throw new Error(`PowerPoint extraction failed: ${extractResponse.status} - ${errorText}`);
      }

      const extractData = await extractResponse.json();
      console.log('📋 ConvertAPI response data:', JSON.stringify(extractData, null, 2));
      
      if (!extractData.Files || extractData.Files.length === 0) {
        console.error('❌ No files in ConvertAPI response:', extractData);
        throw new Error('PowerPoint text extraction failed - no result files');
      }

      const resultFile = extractData.Files[0];
      if (!resultFile.Url) {
        console.error('❌ No URL in result file:', resultFile);
        throw new Error('PowerPoint text extraction failed - no download URL in result');
      }

      // Download the converted text file
      const textFileUrl = resultFile.Url;
      console.log(`📥 Downloading extracted text from: ${textFileUrl}`);
      
      const downloadController = new AbortController();
      const downloadTimeout = setTimeout(() => downloadController.abort(), 30000);
      
      try {
        const textResponse = await fetch(textFileUrl, {
          signal: downloadController.signal
        });
        
        clearTimeout(downloadTimeout);
        
        if (!textResponse.ok) {
          throw new Error(`Failed to download extracted text: ${textResponse.status} ${textResponse.statusText}`);
        }

        const extractedText = await textResponse.text();
        
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('PowerPoint contains no extractable text');
        }

        console.log(`✅ PowerPoint text extracted successfully (${extractedText.length} chars)`);
        return extractedText;

      } catch (downloadError) {
        clearTimeout(downloadTimeout);
        if (downloadError.name === 'AbortError') {
          throw new Error('Text download timed out');
        }
        throw downloadError;
      }

    } catch (extractError) {
      clearTimeout(uploadTimeout);
      if (extractError.name === 'AbortError') {
        throw new Error('PowerPoint text extraction timed out');
      }
      throw extractError;
    }
  }
}

export class DocumentProcessorFactory {
  private processors: DocumentProcessor[] = [
    new PDFProcessor(),
    new TextProcessor(),
    new WordProcessor(),
    new PowerPointProcessor()
  ];

  getProcessor(contentType: string): DocumentProcessor | null {
    return this.processors.find(processor => processor.canProcess(contentType)) || null;
  }

  getSupportedTypes(): string[] {
    return [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
  }
}
