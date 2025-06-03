
// Document processing utilities for different file types

export interface DocumentProcessor {
  canProcess(contentType: string): boolean;
  extractText(fileData: Blob, apiKey?: string): Promise<string>;
}

export class PDFProcessor implements DocumentProcessor {
  canProcess(contentType: string): boolean {
    return contentType === 'application/pdf';
  }

  async extractText(fileData: Blob, apiKey: string): Promise<string> {
    console.log(`🔄 Processing PDF (${fileData.size} bytes)...`);

    const formData = new FormData();
    formData.append('file', fileData, 'document.pdf');

    console.log('📤 Uploading PDF to PDF.co...');

    const uploadController = new AbortController();
    const uploadTimeout = setTimeout(() => uploadController.abort(), 30000);

    try {
      const uploadResponse = await fetch('https://api.pdf.co/v1/file/upload', {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
        body: formData,
        signal: uploadController.signal
      });

      clearTimeout(uploadTimeout);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`PDF upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      const uploadData = await uploadResponse.json();
      
      if (uploadData.error || !uploadData.url) {
        throw new Error(`PDF upload failed: ${uploadData.message || 'No URL returned'}`);
      }

      console.log('📤 PDF uploaded, extracting text...');

      const extractController = new AbortController();
      const extractTimeout = setTimeout(() => extractController.abort(), 60000);

      try {
        const extractResponse = await fetch('https://api.pdf.co/v1/pdf/convert/to/text', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: uploadData.url,
            async: false,
            pages: "",
            password: "",
            inline: true
          }),
          signal: extractController.signal
        });

        clearTimeout(extractTimeout);

        if (!extractResponse.ok) {
          const errorText = await extractResponse.text();
          throw new Error(`PDF text extraction failed: ${extractResponse.status} - ${errorText}`);
        }

        const extractData = await extractResponse.json();

        if (extractData.error || !extractData.body) {
          throw new Error('PDF text extraction failed - may be image-based or corrupted');
        }

        const extractedText = extractData.body.trim();
        
        if (extractedText.length === 0) {
          throw new Error('PDF contains no extractable text');
        }

        console.log(`✅ PDF text extracted successfully (${extractedText.length} chars)`);
        return extractedText;

      } catch (extractError) {
        clearTimeout(extractTimeout);
        if (extractError.name === 'AbortError') {
          throw new Error('PDF text extraction timed out');
        }
        throw extractError;
      }

    } catch (uploadError) {
      clearTimeout(uploadTimeout);
      if (uploadError.name === 'AbortError') {
        throw new Error('PDF upload timed out');
      }
      throw uploadError;
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
    console.log(`🔄 Processing Word document (${fileData.size} bytes)...`);

    const formData = new FormData();
    formData.append('file', fileData, 'document.docx');

    const uploadResponse = await fetch('https://api.pdf.co/v1/file/upload', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(`Word document upload failed: ${uploadResponse.status}`);
    }

    const uploadData = await uploadResponse.json();
    
    if (uploadData.error || !uploadData.url) {
      throw new Error('Word document upload failed');
    }

    const extractResponse = await fetch('https://api.pdf.co/v1/doc/convert/to/text', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: uploadData.url,
        async: false
      })
    });

    if (!extractResponse.ok) {
      throw new Error(`Word text extraction failed: ${extractResponse.status}`);
    }

    const extractData = await extractResponse.json();

    if (extractData.error || !extractData.body) {
      throw new Error('Word text extraction failed');
    }

    const extractedText = extractData.body.trim();
    
    if (extractedText.length === 0) {
      throw new Error('Word document contains no extractable text');
    }

    console.log(`✅ Word text extracted successfully (${extractedText.length} chars)`);
    return extractedText;
  }
}

export class PowerPointProcessor implements DocumentProcessor {
  canProcess(contentType: string): boolean {
    return contentType === 'application/vnd.ms-powerpoint' || 
           contentType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }

  async extractText(fileData: Blob, apiKey: string): Promise<string> {
    console.log(`🔄 Processing PowerPoint (${fileData.size} bytes)...`);

    const formData = new FormData();
    formData.append('file', fileData, 'presentation.pptx');

    const uploadResponse = await fetch('https://api.pdf.co/v1/file/upload', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(`PowerPoint upload failed: ${uploadResponse.status}`);
    }

    const uploadData = await uploadResponse.json();
    
    if (uploadData.error || !uploadData.url) {
      throw new Error('PowerPoint upload failed');
    }

    const extractResponse = await fetch('https://api.pdf.co/v1/ppt/convert/to/text', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: uploadData.url,
        async: false
      })
    });

    if (!extractResponse.ok) {
      throw new Error(`PowerPoint text extraction failed: ${extractResponse.status}`);
    }

    const extractData = await extractResponse.json();

    if (extractData.error || !extractData.body) {
      throw new Error('PowerPoint text extraction failed');
    }

    const extractedText = extractData.body.trim();
    
    if (extractedText.length === 0) {
      throw new Error('PowerPoint contains no extractable text');
    }

    console.log(`✅ PowerPoint text extracted successfully (${extractedText.length} chars)`);
    return extractedText;
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
