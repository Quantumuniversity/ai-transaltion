import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME || 'iquim-aichatbot';

// Convert SRT to VTT format
function convertSrtToVtt(srtContent) {
  console.log('🔄 Converting SRT to VTT...');
  console.log('Original SRT content (first 200 chars):', srtContent.substring(0, 200));
  
  // Normalize line endings and split into subtitle blocks
  const normalizedContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalizedContent.trim().split('\n\n');
  
  let vttContent = 'WEBVTT\n\n';
  
  console.log(`📝 Found ${blocks.length} subtitle blocks`);
  
  blocks.forEach((block, index) => {
    const lines = block.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length >= 3) {
      // Skip subtitle number (first line)
      const timeLine = lines[1];
      const textLines = lines.slice(2);
      
      // Convert SRT time format to VTT format
      // SRT: 00:00:01,000 --> 00:00:04,000
      // VTT: 00:00:01.000 --> 00:00:04.000
      const vttTimeLine = timeLine.replace(/,/g, '.');
      
      // Clean up text lines (remove HTML tags if any)
      const cleanTextLines = textLines.map(line => 
        line.replace(/<[^>]*>/g, '').trim()
      ).filter(line => line !== '');
      
      if (cleanTextLines.length > 0) {
        vttContent += `${vttTimeLine}\n${cleanTextLines.join('\n')}\n\n`;
        
        if (index < 3) { // Log first 3 blocks for debugging
          console.log(`📝 Block ${index + 1}:`);
          console.log(`   Time: ${vttTimeLine}`);
          console.log(`   Text: ${cleanTextLines.join(' ')}`);
        }
      }
    }
  });
  
  console.log('✅ VTT conversion complete');
  console.log('Converted VTT content (first 200 chars):', vttContent.substring(0, 200));
  
  return vttContent;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { courseName, fileName } = req.query;
    
    // Try different case variations for the SRT folder
    const possiblePaths = [
      `${courseName}/srt/${fileName}`,
      `${courseName}/Srt/${fileName}`,
      `${courseName}/SRT/${fileName}`,
      `${courseName}/Subtitles/${fileName}`,
      `${courseName}/subs/${fileName}`
    ];
    
    let srtObject = null;
    let usedPath = '';
    
    // Try each possible path until we find the file
    for (const path of possiblePaths) {
      try {
        console.log(`🔍 Trying SRT path: ${path}`);
        srtObject = await s3.getObject({
          Bucket: bucketName,
          Key: path
        }).promise();
        usedPath = path;
        console.log(`✅ Found SRT file at: ${usedPath}`);
        break;
      } catch (pathError) {
        // Continue to next path if this one doesn't exist
        continue;
      }
    }
    
    if (!srtObject) {
      console.error(`❌ SRT file not found in any of these paths:`, possiblePaths);
      return res.status(404).json({ error: 'SRT file not found' });
    }
    
    console.log(`📡 SRT Proxy Request: ${usedPath}`);
    
    // Convert SRT content to VTT format
    const srtContent = srtObject.Body.toString();
    console.log(`📄 SRT file size: ${srtContent.length} characters`);
    
    const vttContent = convertSrtToVtt(srtContent);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'text/vtt');
    
    console.log(`📤 Sending VTT content (${vttContent.length} characters)`);
    res.send(vttContent);
  } catch (error) {
    console.error('❌ Error proxying SRT file:', error);
    res.status(404).json({ error: 'SRT file not found' });
  }
} 