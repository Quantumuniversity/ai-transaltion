const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_PUBLIC_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME || 'iquim-aichatbot';
const fs = require('fs').promises;

// Helper function to extract language code from filename
function extractLanguageCode(fileName) {
  const parts = fileName.split('.');
  if (parts.length >= 2) {
    const potentialLangCode = parts[parts.length - 2]; // Second to last part
    // Check if it's a valid language code (2-3 characters)
    if (potentialLangCode.length >= 2 && potentialLangCode.length <= 3) {
      return potentialLangCode;
    }
  }
  return 'en'; // Default to English if no language code found
}

// Helper function to check if folder is a subtitle folder (case-insensitive)
function isSubtitleFolder(folderName) {
  const subtitleFolders = ['vtt', 'srt', 'subtitles', 'subs'];
  return subtitleFolders.some(folder => 
    folderName.toLowerCase() === folder.toLowerCase()
  );
}

// Helper function to get subtitle type from folder name
function getSubtitleType(folderName) {
  const lowerFolder = folderName.toLowerCase();
  
  if (lowerFolder === 'vtt') return 'vtt';
  if (lowerFolder === 'srt') return 'srt';
  if (lowerFolder === 'subtitles' || lowerFolder === 'subs') {
    // For generic subtitle folders, check file extension
    return 'auto'; // Will be determined by file extension
  }
  
  return null;
}

// Generate signed URL
function generateSignedUrl(objectKey, expirationInSeconds = 86400) { // 24 hours
  const params = {
    Bucket: bucketName,
    Key: objectKey,
    Expires: expirationInSeconds,
  };

  return new Promise((resolve, reject) => {
    s3.getSignedUrl('getObject', params, (err, url) => {
      if (err) {
        reject(err);
      } else {
        resolve(url);
      }
    });
  });
}

// Main function to generate all URLs
async function generateAllUrls() {
  console.log('🚀 Starting URL generation for all videos...');
  const startTime = Date.now();

  try {
    // Get all course folders
    const params = {
      Bucket: bucketName,
      Delimiter: '/',
    };

    const data = await s3.listObjectsV2(params).promise();
    const courses = [];

    if (data.CommonPrefixes) {
      console.log(`📁 Found ${data.CommonPrefixes.length} course folders`);

      // Process each course
      for (let i = 0; i < data.CommonPrefixes.length; i++) {
        const prefix = data.CommonPrefixes[i];
        if (prefix.Prefix) {
          const courseName = prefix.Prefix.replace('/', '');
          console.log(`⚡ Processing course ${i + 1}/${data.CommonPrefixes.length}: ${courseName}`);
          
          const course = await processCourse(courseName);
          if (course) {
            courses.push(course);
          }
        }
      }
    }

    // Save to file
    const outputData = {
      generatedAt: new Date().toISOString(),
      bucketName: bucketName,
      courses: courses
    };

    await fs.writeFile('pre-generated-urls.json', JSON.stringify(outputData, null, 2));
    
    const endTime = Date.now();
    const totalVideos = courses.reduce((total, course) => total + course.videos.length, 0);
    
    console.log(`✅ SUCCESS! Generated URLs for ${courses.length} courses and ${totalVideos} videos`);
    console.log(`⏱️  Total time: ${endTime - startTime}ms`);
    console.log(`💾 Saved to: pre-generated-urls.json`);
    console.log(`🚀 Your app will now load INSTANTLY!`);

  } catch (error) {
    console.error('❌ Error generating URLs:', error);
  }
}

// Process a single course
async function processCourse(courseName) {
  try {
    const params = {
      Bucket: bucketName,
      Prefix: `${courseName}/`,
    };

    const data = await s3.listObjectsV2(params).promise();
    const videos = [];

    if (data.Contents) {
      // Group files by video name
      const videoFiles = new Map();

      for (const obj of data.Contents) {
        if (obj.Key) {
          const pathParts = obj.Key.split('/');
          if (pathParts.length >= 3) {
            const folder = pathParts[1];
            const fileName = pathParts[2];
            
            // Extract base name (remove language suffix and extension)
            let baseName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
            
            // Handle language suffixes (e.g., COMM 200 1.es.vtt -> COMM 200 1)
            if (baseName.includes('.')) {
              const lastDotIndex = baseName.lastIndexOf('.');
              const potentialLangCode = baseName.substring(lastDotIndex + 1);
              // Check if it's a valid language code (2-3 characters)
              if (potentialLangCode.length >= 2 && potentialLangCode.length <= 3) {
                baseName = baseName.substring(0, lastDotIndex);
              }
            }

            if (!videoFiles.has(baseName)) {
              videoFiles.set(baseName, { video: null, vtt: {}, srt: {}, txt: {} });
            }

            const fileInfo = videoFiles.get(baseName);
            
            if (folder.toLowerCase() === 'video') {
              fileInfo.video = obj.Key;
            } else if (isSubtitleFolder(folder)) {
              // Handle subtitle files (VTT, SRT, etc.)
              const subtitleType = getSubtitleType(folder);
              const langCode = extractLanguageCode(fileName);
              
              // Determine actual subtitle type from file extension if auto
              let actualType = subtitleType;
              if (subtitleType === 'auto') {
                const fileExtension = fileName.split('.').pop().toLowerCase();
                if (fileExtension === 'vtt') actualType = 'vtt';
                else if (fileExtension === 'srt') actualType = 'srt';
                else {
                  console.log(`   ⚠️ Unknown subtitle format: ${fileExtension}`);
                  continue;
                }
              }
              
              if (actualType === 'vtt') {
                fileInfo.vtt[langCode] = obj.Key;
              } else if (actualType === 'srt') {
                fileInfo.srt[langCode] = obj.Key;
              }
            } else if (folder.toLowerCase() === 'txt') {
              // Extract language code from filename
              const langCode = extractLanguageCode(fileName);
              fileInfo.txt[langCode] = obj.Key;
            }
          }
        }
      }

      // Generate URLs for all videos in parallel
      const videoPromises = Array.from(videoFiles.entries()).map(async ([baseName, files]) => {
        if (files.video) {
          const video = {
            name: baseName,
            videoUrl: await generateSignedUrl(files.video),
            vttUrls: {},
            srtUrls: {},
            txtUrls: {},
            availableLanguages: [],
            transcript: ''
          };

          // Get the base URL for API endpoints
          const isProduction = process.env.NODE_ENV === 'production';
          const baseUrl = isProduction 
            ? process.env.VERCEL_URL 
              ? `https://${process.env.VERCEL_URL}` 
              : 'https://ai-transaltion.vercel.app'
            : 'http://localhost:3001';
          
          // Generate URLs for all VTT files
          for (const [langCode, filePath] of Object.entries(files.vtt)) {
            const fileName = filePath.split('/').pop();
            video.vttUrls[langCode] = `${baseUrl}/api/vtt/${courseName}/${fileName}`;
            video.availableLanguages.push(langCode);
          }
          
          // Generate URLs for all SRT files
          for (const [langCode, filePath] of Object.entries(files.srt)) {
            const fileName = filePath.split('/').pop();
            video.srtUrls[langCode] = `${baseUrl}/api/srt/${courseName}/${fileName}`;
            video.availableLanguages.push(langCode);
          }
          
          // Generate URLs for all TXT files
          for (const [langCode, filePath] of Object.entries(files.txt)) {
            video.txtUrls[langCode] = await generateSignedUrl(filePath);
          }

          // Load transcript if available (default to English)
          if (files.txt['en']) {
            try {
              const transcriptData = await s3.getObject({
                Bucket: bucketName,
                Key: files.txt['en'],
              }).promise();
              video.transcript = transcriptData.Body.toString();
            } catch (error) {
              console.error(`Error loading transcript for ${files.txt['en']}:`, error);
            }
          }

          return video;
        }
        return null;
      });

      const videoResults = await Promise.all(videoPromises);
      videos.push(...videoResults.filter(video => video !== null));
    }

    return {
      name: courseName,
      path: `${courseName}/`,
      videos: videos,
    };
  } catch (error) {
    console.error(`Error processing course ${courseName}:`, error);
    return null;
  }
}

// Run the script
generateAllUrls(); 