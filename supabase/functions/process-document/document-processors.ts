
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
      
      let extractedText = '';
      
      // Check if we have FileData (base64) or Url
      if (resultFile.FileData) {
        console.log('📥 Extracting text from base64 FileData...');
        try {
          // Decode base64 data
          const base64Data = resultFile.FileData;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const decoder = new TextDecoder('utf-8');
          extractedText = decoder.decode(bytes);
          console.log(`✅ Text extracted from base64 (${extractedText.length} chars)`);
        } catch (decodeError) {
          console.error('❌ Failed to decode base64 FileData:', decodeError);
          throw new Error('Failed to decode extracted text from base64');
        }
      } else if (resultFile.Url) {
        console.log(`📥 Downloading extracted text from URL: ${resultFile.Url}`);
        
        const downloadController = new AbortController();
        const downloadTimeout = setTimeout(() => downloadController.abort(), 30000);
        
        try {
          const textResponse = await fetch(resultFile.Url, {
            signal: downloadController.signal
          });
          
          clearTimeout(downloadTimeout);
          
          if (!textResponse.ok) {
            throw new Error(`Failed to download extracted text: ${textResponse.status} ${textResponse.statusText}`);
          }

          extractedText = await textResponse.text();
          console.log(`✅ Text downloaded from URL (${extractedText.length} chars)`);

        } catch (downloadError) {
          clearTimeout(downloadTimeout);
          if (downloadError.name === 'AbortError') {
            throw new Error('Text download timed out');
          }
          throw downloadError;
        }
      } else {
        console.error('❌ No FileData or URL in result file:', resultFile);
        throw new Error('PDF text extraction failed - no FileData or download URL in result');
      }

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('PDF contains no extractable text');
      }

      console.log(`✅ PDF text extracted successfully (${extractedText.length} chars)`);
      return extractedText;

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
      
      let extractedText = '';
      
      // Check if we have FileData (base64) or Url
      if (resultFile.FileData) {
        console.log('📥 Extracting text from base64 FileData...');
        try {
          // Decode base64 data
          const base64Data = resultFile.FileData;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const decoder = new TextDecoder('utf-8');
          extractedText = decoder.decode(bytes);
          console.log(`✅ Text extracted from base64 (${extractedText.length} chars)`);
        } catch (decodeError) {
          console.error('❌ Failed to decode base64 FileData:', decodeError);
          throw new Error('Failed to decode extracted text from base64');
        }
      } else if (resultFile.Url) {
        console.log(`📥 Downloading extracted text from URL: ${resultFile.Url}`);
        
        const downloadController = new AbortController();
        const downloadTimeout = setTimeout(() => downloadController.abort(), 30000);
        
        try {
          const textResponse = await fetch(resultFile.Url, {
            signal: downloadController.signal
          });
          
          clearTimeout(downloadTimeout);
          
          if (!textResponse.ok) {
            throw new Error(`Failed to download extracted text: ${textResponse.status} ${textResponse.statusText}`);
          }

          extractedText = await textResponse.text();
          console.log(`✅ Text downloaded from URL (${extractedText.length} chars)`);

        } catch (downloadError) {
          clearTimeout(downloadTimeout);
          if (downloadError.name === 'AbortError') {
            throw new Error('Text download timed out');
          }
          throw downloadError;
        }
      } else {
        console.error('❌ No FileData or URL in result file:', resultFile);
        throw new Error('Word text extraction failed - no FileData or download URL in result');
      }

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('Word document contains no extractable text');
      }

      console.log(`✅ Word text extracted successfully (${extractedText.length} chars)`);
      return extractedText;

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
    console.log('📋 Using two-step conversion: PowerPoint -> PDF -> Text');

    const formData = new FormData();
    formData.append('File', fileData, 'presentation.pptx');

    // STEP 1: Convert PowerPoint to PDF
    console.log('📤 Step 1: Converting PowerPoint to PDF...');

    const pdfController = new AbortController();
    const pdfTimeout = setTimeout(() => pdfController.abort(), 60000);

    try {
      const pdfResponse = await fetch('https://v2.convertapi.com/convert/pptx/to/pdf', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
        signal: pdfController.signal
      });

      clearTimeout(pdfTimeout);

      if (!pdfResponse.ok) {
        const errorText = await pdfResponse.text();
        console.error('❌ ConvertAPI PowerPoint to PDF error:', errorText);
        throw new Error(`PowerPoint to PDF conversion failed: ${pdfResponse.status} - ${errorText}`);
      }

      const pdfData = await pdfResponse.json();
      console.log('📋 PDF conversion response:', JSON.stringify(pdfData, null, 2));
      
      if (!pdfData.Files || pdfData.Files.length === 0) {
        console.error('❌ No PDF files in ConvertAPI response:', pdfData);
        throw new Error('PowerPoint to PDF conversion failed - no result files');
      }

      const pdfFile = pdfData.Files[0];
      
      // Download the PDF file
      let pdfBlob: Blob;
      
      if (pdfFile.FileData) {
        console.log('📥 Getting PDF from base64 FileData...');
        const base64Data = pdfFile.FileData;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        pdfBlob = new Blob([bytes], { type: 'application/pdf' });
      } else if (pdfFile.Url) {
        console.log(`📥 Downloading PDF from URL: ${pdfFile.Url}`);
        
        const downloadController = new AbortController();
        const downloadTimeout = setTimeout(() => downloadController.abort(), 30000);
        
        try {
          const pdfFileResponse = await fetch(pdfFile.Url, {
            signal: downloadController.signal
          });
          
          clearTimeout(downloadTimeout);
          
          if (!pdfFileResponse.ok) {
            throw new Error(`Failed to download PDF: ${pdfFileResponse.status} ${pdfFileResponse.statusText}`);
          }

          pdfBlob = await pdfFileResponse.blob();
          console.log(`✅ PDF downloaded (${pdfBlob.size} bytes)`);

        } catch (downloadError) {
          clearTimeout(downloadTimeout);
          if (downloadError.name === 'AbortError') {
            throw new Error('PDF download timed out');
          }
          throw downloadError;
        }
      } else {
        console.error('❌ No FileData or URL in PDF result file:', pdfFile);
        throw new Error('PowerPoint to PDF conversion failed - no FileData or download URL in result');
      }

      // STEP 2: Convert PDF to Text using PDF processor
      console.log('📤 Step 2: Converting PDF to text...');
      const pdfProcessor = new PDFProcessor();
      const extractedText = await pdfProcessor.extractText(pdfBlob, apiKey);

      console.log(`✅ PowerPoint text extracted successfully (${extractedText.length} chars)`);
      return extractedText;

    } catch (extractError) {
      clearTimeout(pdfTimeout);
      if (extractError.name === 'AbortError') {
        throw new Error('PowerPoint text extraction timed out');
      }
      throw extractError;
    }
  }
}

export class ExcelProcessor implements DocumentProcessor {
  canProcess(contentType: string): boolean {
    return contentType === 'application/vnd.ms-excel' || 
           contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  async extractText(fileData: Blob, apiKey: string): Promise<string> {
    console.log(`🔄 Processing Excel (${fileData.size} bytes) with ConvertAPI...`);

    const formData = new FormData();
    formData.append('File', fileData, 'spreadsheet.xlsx');

    console.log('📤 Uploading Excel to ConvertAPI for CSV conversion...');

    const uploadController = new AbortController();
    const uploadTimeout = setTimeout(() => uploadController.abort(), 45000);

    try {
      const extractResponse = await fetch('https://v2.convertapi.com/convert/xlsx/to/csv', {
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
        console.error('❌ ConvertAPI Excel error:', errorText);
        throw new Error(`Excel extraction failed: ${extractResponse.status} - ${errorText}`);
      }

      const extractData = await extractResponse.json();
      console.log('📋 ConvertAPI response data:', JSON.stringify(extractData, null, 2));
      
      if (!extractData.Files || extractData.Files.length === 0) {
        console.error('❌ No files in ConvertAPI response:', extractData);
        throw new Error('Excel text extraction failed - no result files');
      }

      const resultFile = extractData.Files[0];
      
      let extractedText = '';
      
      // Check if we have FileData (base64) or Url
      if (resultFile.FileData) {
        console.log('📥 Extracting CSV from base64 FileData...');
        try {
          // Decode base64 data
          const base64Data = resultFile.FileData;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const decoder = new TextDecoder('utf-8');
          extractedText = decoder.decode(bytes);
          console.log(`✅ CSV extracted from base64 (${extractedText.length} chars)`);
        } catch (decodeError) {
          console.error('❌ Failed to decode base64 FileData:', decodeError);
          throw new Error('Failed to decode extracted CSV from base64');
        }
      } else if (resultFile.Url) {
        console.log(`📥 Downloading extracted CSV from URL: ${resultFile.Url}`);
        
        const downloadController = new AbortController();
        const downloadTimeout = setTimeout(() => downloadController.abort(), 30000);
        
        try {
          const textResponse = await fetch(resultFile.Url, {
            signal: downloadController.signal
          });
          
          clearTimeout(downloadTimeout);
          
          if (!textResponse.ok) {
            throw new Error(`Failed to download extracted CSV: ${textResponse.status} ${textResponse.statusText}`);
          }

          extractedText = await textResponse.text();
          console.log(`✅ CSV downloaded from URL (${extractedText.length} chars)`);

        } catch (downloadError) {
          clearTimeout(downloadTimeout);
          if (downloadError.name === 'AbortError') {
            throw new Error('CSV download timed out');
          }
          throw downloadError;
        }
      } else {
        console.error('❌ No FileData or URL in result file:', resultFile);
        throw new Error('Excel text extraction failed - no FileData or download URL in result');
      }

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('Excel file contains no extractable data');
      }

      // Format CSV data into a more readable structure
      const formattedText = this.formatCsvData(extractedText);
      console.log(`✅ Excel data formatted successfully (${formattedText.length} chars)`);
      return formattedText;

    } catch (extractError) {
      clearTimeout(uploadTimeout);
      if (extractError.name === 'AbortError') {
        throw new Error('Excel text extraction timed out');
      }
      throw extractError;
    }
  }

  private formatCsvData(csvText: string): string {
    const lines = csvText.split('\n');
    let formattedText = 'DONNÉES EXCEL EXTRAITES:\n\n';
    
    // Detect if first row might be headers
    const firstRow = lines[0];
    const hasHeaders = firstRow && firstRow.split(',').some(cell => 
      isNaN(Number(cell.replace(/[",]/g, '')))
    );
    
    if (hasHeaders) {
      formattedText += 'COLONNES:\n';
      const headers = firstRow.split(',').map(h => h.replace(/[",]/g, '').trim());
      formattedText += headers.join(' | ') + '\n\n';
      
      formattedText += 'DONNÉES:\n';
      lines.slice(1, Math.min(51, lines.length)).forEach((line, index) => {
        if (line.trim()) {
          const cells = line.split(',').map(c => c.replace(/[",]/g, '').trim());
          formattedText += `Ligne ${index + 1}: ${cells.join(' | ')}\n`;
        }
      });
    } else {
      formattedText += 'CONTENU TABULAIRE:\n';
      lines.slice(0, Math.min(50, lines.length)).forEach((line, index) => {
        if (line.trim()) {
          const cells = line.split(',').map(c => c.replace(/[",]/g, '').trim());
          formattedText += `${cells.join(' | ')}\n`;
        }
      });
    }
    
    if (lines.length > 50) {
      formattedText += `\n... (${lines.length - 50} lignes supplémentaires)`;
    }
    
    return formattedText;
  }
}

export class DocumentProcessorFactory {
  private processors: DocumentProcessor[] = [
    new PDFProcessor(),
    new TextProcessor(),
    new WordProcessor(),
    new PowerPointProcessor(),
    new ExcelProcessor()
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
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
  }
}
