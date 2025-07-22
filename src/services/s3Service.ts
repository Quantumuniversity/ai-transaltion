import { Course, AWSConfig } from '../types';

// AWS S3 Service Class using server-side API endpoints
export class S3Service {
  private apiEndpoint: string;

  constructor(config: AWSConfig) {
    console.log('S3Service initialized with API endpoint approach');
    
    // Use environment variable for API endpoint or default to local server
    this.apiEndpoint = process.env.REACT_APP_API_ENDPOINT || 'http://localhost:3001/api';
  }

  // Get all courses from S3 bucket via API
  async getCourses(): Promise<Course[]> {
    try {
      console.log('Fetching courses from S3 via API...');
      
      const response = await fetch(`${this.apiEndpoint}/courses`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const courses: Course[] = await response.json();
      console.log(`Found ${courses.length} courses`);
      return courses;
    } catch (error) {
      console.error('Error fetching courses:', error);
      throw new Error('Failed to fetch courses from S3');
    }
  }

  // Get signed URL for objects via API
  private async getSignedUrl(key: string): Promise<string> {
    try {
      const response = await fetch(`${this.apiEndpoint}/signurl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ objectKey: key }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get signed URL for ${key}`);
      }

      const { url } = await response.json();
      return url;
    } catch (error) {
      console.error(`Error getting signed URL for ${key}:`, error);
      throw error;
    }
  }

  // Get transcript content from TXT file via API
  private async getTranscript(key: string): Promise<string> {
    // For transcripts, we'll get the content directly from the courses API
    // since it's already included in the course data
    return '';
  }
} 