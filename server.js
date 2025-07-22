const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://ai-transaltion.vercel.app', 'https://*.vercel.app'],
  credentials: true
}));
app.use(express.json());

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_PUBLIC_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

// Create S3 instance
const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME || 'iquim-aichatbot';

// SUPER FAST CACHING SYSTEM
let coursesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
let isInitializing = false;
let initializationPromise = null;

// URL Cache for individual videos
const urlCache = new Map();

// Load pre-generated URLs
async function loadPreGeneratedUrls() {
  try {
    const filePath = path.join(__dirname, 'pre-generated-urls.json');
    const data = await fs.readFile(filePath, 'utf8');
    const parsedData = JSON.parse(data);
    
    console.log(`✅ Loaded pre-generated URLs from ${filePath}`);
    console.log(`📊 Found ${parsedData.courses.length} courses with ${parsedData.courses.reduce((total, course) => total + course.videos.length, 0)} videos`);
    console.log(`🕒 Generated at: ${parsedData.generatedAt}`);
    
    return parsedData.courses;
  } catch (error) {
    console.log('⚠️  No pre-generated URLs found, falling back to live generation');
    return null;
  }
}

// Helper function to extract language code from filename
function extractLanguageCode(fileName) {
  const parts = fileName.split('.');
  console.log(`   🔤 Extracting language from: ${fileName}, parts:`, parts);
  
  if (parts.length >= 2) {
    const potentialLangCode = parts[parts.length - 2]; // Second to last part
    console.log(`   🔤 Potential lang code: ${potentialLangCode}`);
    
    // Check if it's a valid language code (2-3 characters)
    if (potentialLangCode.length >= 2 && potentialLangCode.length <= 3) {
      console.log(`   🔤 Using language code: ${potentialLangCode}`);
      return potentialLangCode;
    }
  }
  console.log(`   🔤 Defaulting to: en`);
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

// Helper function to generate signed URL with caching
async function generateSignedUrl(objectKey, expirationInSeconds = 3600) {
  const cacheKey = `${objectKey}-${expirationInSeconds}`;
  
  // Check URL cache first
  if (urlCache.has(cacheKey)) {
    return urlCache.get(cacheKey);
  }

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
        // Cache the URL
        urlCache.set(cacheKey, url);
        resolve(url);
      }
    });
  });
}

// Check if cache is valid
function isCacheValid() {
  return coursesCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION);
}

// Initialize courses data (runs once on startup)
async function initializeCoursesData() {
  if (isInitializing) {
    return initializationPromise;
  }

  if (isCacheValid()) {
    return coursesCache;
  }

  isInitializing = true;
  initializationPromise = loadAllCoursesData();
  
  try {
    const result = await initializationPromise;
    return result;
  } finally {
    isInitializing = false;
  }
}

// Load all courses data with maximum optimization
async function loadAllCoursesData() {
  console.log('🚀 Initializing courses data...');
  const startTime = Date.now();

  try {
    // Try to load pre-generated URLs first
    const preGeneratedCourses = await loadPreGeneratedUrls();
    
    if (preGeneratedCourses) {
      const endTime = Date.now();
      console.log(`⚡ INSTANT LOAD! Loaded ${preGeneratedCourses.length} courses in ${endTime - startTime}ms`);
      
      // Cache the results
      coursesCache = preGeneratedCourses;
      cacheTimestamp = Date.now();
      
      return preGeneratedCourses;
    }

    // Fallback to live generation if no pre-generated file
    console.log('🔄 No pre-generated URLs found, generating live...');
    
    const params = {
      Bucket: bucketName,
      Delimiter: '/',
    };

    const data = await s3.listObjectsV2(params).promise();
    const courses = [];

    if (data.CommonPrefixes) {
      console.log(`📁 Found ${data.CommonPrefixes.length} course folders`);
      
      // Process ALL courses in parallel with progress tracking
      const coursePromises = data.CommonPrefixes.map(async (prefix, index) => {
        if (prefix.Prefix) {
          const courseName = prefix.Prefix.replace('/', '');
          console.log(`⚡ Processing course ${index + 1}/${data.CommonPrefixes.length}: ${courseName}`);
          const course = await getCourseDetailsOptimized(courseName);
          return course;
        }
        return null;
      });

      const courseResults = await Promise.all(coursePromises);
      courses.push(...courseResults.filter(course => course !== null));
    }

    const endTime = Date.now();
    console.log(`✅ Successfully loaded ${courses.length} courses in ${endTime - startTime}ms`);
    
    // Cache the results
    coursesCache = courses;
    cacheTimestamp = Date.now();
    
    return courses;
  } catch (error) {
    console.error('❌ Error loading courses:', error);
    throw error;
  }
}

// Ultra-optimized course details loading
async function getCourseDetailsOptimized(courseName) {
  try {
    const params = {
      Bucket: bucketName,
      Prefix: `${courseName}/`,
    };

    const data = await s3.listObjectsV2(params).promise();
    const videos = [];

    if (data.Contents) {
      // Debug: Show all folders found
      const folders = new Set();
      data.Contents.forEach(obj => {
        if (obj.Key) {
          const pathParts = obj.Key.split('/');
          if (pathParts.length >= 2) {
            folders.add(pathParts[1]);
          }
        }
      });
      console.log(`📁 Folders found in ${courseName}:`, Array.from(folders));
      
      // Group files by video name
      const videoFiles = new Map();

      for (const obj of data.Contents) {
        if (obj.Key) {
          const pathParts = obj.Key.split('/');
          if (pathParts.length >= 3) {
            const folder = pathParts[1];
            const fileName = pathParts[2];
            
            console.log(`🔍 Processing file: ${obj.Key}`);
            console.log(`   Folder: ${folder}, FileName: ${fileName}`);
            
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

            console.log(`   BaseName: ${baseName}`);

            if (!videoFiles.has(baseName)) {
              videoFiles.set(baseName, { video: null, vtt: {}, srt: {}, txt: {} });
            }

            const fileInfo = videoFiles.get(baseName);
            
            if (folder.toLowerCase() === 'video') {
              fileInfo.video = obj.Key;
              console.log(`   ✅ Added as video`);
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
                console.log(`   ✅ Added as VTT (${langCode})`);
              } else if (actualType === 'srt') {
                fileInfo.srt[langCode] = obj.Key;
                console.log(`   ✅ Added as SRT (${langCode})`);
              }
            } else if (folder.toLowerCase() === 'txt') {
              // Extract language code from filename
              const langCode = extractLanguageCode(fileName);
              fileInfo.txt[langCode] = obj.Key;
              console.log(`   ✅ Added as TXT (${langCode})`);
            } else {
              console.log(`   ❌ Unknown folder: ${folder}`);
            }
          }
        }
      }

      // Generate ALL URLs in parallel (this is the key optimization)
      const urlPromises = [];
      const videoData = [];

      for (const [baseName, files] of videoFiles.entries()) {
        if (files.video) {
          const video = {
            name: baseName,
            videoUrl: null, // Will be filled by promise
            vttUrls: {},
            srtUrls: {},
            txtUrls: {},
            availableLanguages: [],
            transcript: ''
          };

          // Queue URL generation promises
          const videoUrlPromise = generateSignedUrl(files.video).then(url => video.videoUrl = url);
          
                // Generate URLs for all VTT files
          const vttUrlPromises = Object.entries(files.vtt).map(([langCode, filePath]) => {
            return Promise.resolve().then(() => {
              const fileName = filePath.split('/').pop();
              video.vttUrls[langCode] = `http://localhost:3001/api/vtt/${courseName}/${fileName}`;
              video.availableLanguages.push(langCode);
            });
          });
          
          // Generate URLs for all SRT files
          const srtUrlPromises = Object.entries(files.srt).map(([langCode, filePath]) => {
            return Promise.resolve().then(() => {
              const fileName = filePath.split('/').pop();
              video.srtUrls[langCode] = `http://localhost:3001/api/srt/${courseName}/${fileName}`;
              video.availableLanguages.push(langCode);
            });
          });
          
          // Generate URLs for all TXT files
          const txtUrlPromises = Object.entries(files.txt).map(([langCode, filePath]) => {
            return generateSignedUrl(filePath).then(url => {
              video.txtUrls[langCode] = url;
            });
          });

      // Debug logging
      console.log(`📹 Video: ${baseName}`);
      console.log(`   VTT files:`, Object.keys(files.vtt));
      console.log(`   SRT files:`, Object.keys(files.srt));
      console.log(`   TXT files:`, Object.keys(files.txt));
      console.log(`   Has VTT: ${Object.keys(files.vtt).length > 0}`);
      console.log(`   Has SRT: ${Object.keys(files.srt).length > 0}`);
      console.log(`   Has TXT: ${Object.keys(files.txt).length > 0}`);

          urlPromises.push(videoUrlPromise, ...vttUrlPromises, ...srtUrlPromises, ...txtUrlPromises);
          videoData.push(video);

          // Load transcript in background (don't block URL generation)
          if (files.txt['en']) { // Load English transcript by default
            s3.getObject({
              Bucket: bucketName,
              Key: files.txt['en'],
            }).promise().then(transcriptData => {
              video.transcript = transcriptData.Body.toString();
            }).catch(error => {
              console.error(`Error loading transcript for ${files.txt['en']}:`, error);
            });
          }
        }
      }

      // Wait for all URLs to be generated
      await Promise.all(urlPromises);
      videos.push(...videoData);
    }

    return {
      name: courseName,
      path: `${courseName}/`,
      videos: videos,
    };
  } catch (error) {
    console.error(`Error fetching course details for ${courseName}:`, error);
    return null;
  }
}

// API Routes

// Get all courses - SUPER FAST with pre-generated URLs
app.get('/api/courses', async (req, res) => {
  try {
    console.log('📡 API Request: /api/courses');
    
    // Check cache first
    if (isCacheValid()) {
      console.log('⚡ Returning cached data (instant response)');
      return res.json(coursesCache);
    }

    // Initialize if needed
    const courses = await initializeCoursesData();
    res.json(courses);
  } catch (error) {
    console.error('❌ Error in /api/courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses from S3' });
  }
});

// Proxy VTT files to avoid CORS issues
app.get('/api/vtt/:courseName/:fileName', async (req, res) => {
  try {
    const { courseName, fileName } = req.params;
    
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
});

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

// Proxy SRT files and convert to VTT format
app.get('/api/srt/:courseName/:fileName', async (req, res) => {
  try {
    const { courseName, fileName } = req.params;
    
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
});

// Handle OPTIONS requests for CORS preflight
app.options('/api/vtt/:courseName/:fileName', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).send();
});

app.options('/api/srt/:courseName/:fileName', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).send();
});

// Lazy load course details (for individual course requests)
app.get('/api/courses/:courseName', async (req, res) => {
  try {
    const { courseName } = req.params;
    console.log(`📡 API Request: /api/courses/${courseName}`);
    
    const course = await getCourseDetailsOptimized(courseName);
    if (course) {
      res.json(course);
    } else {
      res.status(404).json({ error: 'Course not found' });
    }
  } catch (error) {
    console.error('❌ Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// Generate signed URL for a specific object (with caching)
app.post('/api/signurl', async (req, res) => {
  try {
    const { objectKey } = req.body;
    
    if (!objectKey) {
      return res.status(400).json({ error: 'Object key is required' });
    }

    const url = await generateSignedUrl(objectKey.replaceAll('+', ' '), 3600);
    res.json({ url });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
});

// Clear cache endpoint
app.post('/api/clear-cache', (req, res) => {
  coursesCache = null;
  cacheTimestamp = null;
  urlCache.clear();
  console.log('🗑️ Cache cleared');
  res.json({ message: 'Cache cleared successfully' });
});

// Health check endpoint with cache status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'S3 API Server is running',
    bucket: bucketName,
    region: process.env.AWS_REGION || 'us-east-1',
    cacheStatus: isCacheValid() ? 'Valid' : 'Invalid/Empty',
    urlCacheSize: urlCache.size,
    isInitializing: isInitializing,
    hasPreGeneratedUrls: coursesCache !== null
  });
});

// Start server with initialization
app.listen(PORT, async () => {
  console.log(`🚀 S3 API Server running on port ${PORT}`);
  console.log(`📁 S3 Bucket: ${bucketName}`);
  console.log(`🌍 CORS enabled for: http://localhost:3000`);
  console.log(`⚡ Super-fast caching enabled (${CACHE_DURATION / 1000}s duration)`);
  console.log(`🔄 Initializing courses data in background...`);
  
  // Initialize data in background
  initializeCoursesData().then(() => {
    console.log('✅ Initialization complete! Server ready for super-fast responses.');
  }).catch(error => {
    console.error('❌ Initialization failed:', error);
  });
});

module.exports = app; 