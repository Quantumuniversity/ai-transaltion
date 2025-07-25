import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME || 'iquim-aichatbot';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { courseName, fileName } = req.query;
    
    // Try different case variations for the VTT folder
    const possiblePaths = [
      `${courseName}/vtt/${fileName}`,
      `${courseName}/Vtt/${fileName}`,
      `${courseName}/VTT/${fileName}`,
      `${courseName}/Subtitles/${fileName}`,
      `${courseName}/subs/${fileName}`
    ];
    
    let vttObject = null;
    let usedPath = '';
    
    // Try each possible path until we find the file
    for (const path of possiblePaths) {
      try {
        console.log(`🔍 Trying VTT path: ${path}`);
        vttObject = await s3.getObject({
          Bucket: bucketName,
          Key: path
        }).promise();
        usedPath = path;
        console.log(`✅ Found VTT file at: ${usedPath}`);
        break;
      } catch (pathError) {
        // Continue to next path if this one doesn't exist
        continue;
      }
    }
    
    if (!vttObject) {
      console.error(`❌ VTT file not found in any of these paths:`, possiblePaths);
      return res.status(404).json({ error: 'VTT file not found' });
    }
    
    console.log(`📡 VTT Proxy Request: ${usedPath}`);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'text/vtt');
    
    res.send(vttObject.Body);
  } catch (error) {
    console.error('❌ Error proxying VTT file:', error);
    res.status(404).json({ error: 'VTT file not found' });
  }
} 