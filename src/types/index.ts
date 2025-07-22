// Types for our video learning platform

export interface Course {
  name: string;
  path: string;
  videos: Video[];
}

export interface Video {
  name: string;
  videoUrl: string;
  vttUrls: {
    [languageCode: string]: string; // 'en', 'es', 'fr', 'ar', etc.
  };
  srtUrls: {
    [languageCode: string]: string; // 'en', 'es', 'fr', 'ar', etc.
  };
  txtUrls: {
    [languageCode: string]: string;
  };
  transcript?: string;
  availableLanguages: string[]; // List of available language codes
}

export interface S3Object {
  Key: string;
  LastModified: Date;
  Size: number;
  ETag: string;
}

// AWS Configuration
export interface AWSConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  cloudFrontDomain?: string;
} 