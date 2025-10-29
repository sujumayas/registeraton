/**
 * Netlify Function: Process Excel file with AI
 * Accepts Excel/CSV upload, analyzes columns with Claude AI
 * Returns column mappings for pre-registration
 */

const Anthropic = require('@anthropic-ai/sdk');
const XLSX = require('xlsx');
const multipart = require('parse-multipart-data');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Process Excel file with AI to identify columns
 * @param {Buffer} fileBuffer - Excel file buffer
 * @returns {Object} - Analysis result with column mappings and data
 */
async function processExcelWithAI(fileBuffer) {
  try {
    // Parse Excel file from buffer
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      throw new Error('Excel file is empty');
    }

    // Get column names
    const columns = Object.keys(jsonData[0]);

    // Take first 5 rows as sample
    const sampleData = jsonData.slice(0, 5);

    // Ask AI to identify columns and best identifier
    const prompt = `You are analyzing an Excel file for event participant pre-registration.

Here are the columns: ${columns.join(', ')}

Here are the first 5 rows of sample data:
${JSON.stringify(sampleData, null, 2)}

Please analyze this data and respond with ONLY a JSON object (no markdown, no explanation) with this exact structure:
{
  "identifier_type": "dni" | "email" | "name",
  "identifier_column": "exact_column_name",
  "mappings": {
    "full_name": "exact_column_name_or_null",
    "email": "exact_column_name_or_null",
    "dni": "exact_column_name_or_null",
    "area": "exact_column_name_or_null"
  }
}

Priority for identifier: DNI (cedula, documento, identification) > email > name
Use the exact column names from the data.`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const aiResponse = message.content[0].text.trim();
    const analysis = JSON.parse(aiResponse);

    return {
      analysis,
      data: jsonData
    };
  } catch (error) {
    console.error('Error processing Excel with AI:', error);
    throw error;
  }
}

/**
 * Netlify Function Handler
 */
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Anthropic API key not configured' })
    };
  }

  try {
    // Parse multipart form data
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];

    if (!contentType || !contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' })
      };
    }

    // Extract boundary from content-type
    const boundary = contentType.split('boundary=')[1];

    if (!boundary) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid multipart boundary' })
      };
    }

    // Parse body (convert base64 if needed)
    const bodyBuffer = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body);

    // Parse multipart data
    const parts = multipart.parse(bodyBuffer, boundary);

    // Find file part
    const filePart = parts.find(part => part.name === 'file' || part.filename);

    if (!filePart || !filePart.data) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No file uploaded' })
      };
    }

    // Validate file type
    const filename = filePart.filename || '';
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const isValidFile = validExtensions.some(ext => filename.toLowerCase().endsWith(ext));

    if (!isValidFile) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid file type. Only Excel and CSV files are allowed.' })
      };
    }

    // Process Excel file with AI
    const result = await processExcelWithAI(filePart.data);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Configure CORS appropriately
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Function error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process Excel file',
        details: error.message
      })
    };
  }
};
