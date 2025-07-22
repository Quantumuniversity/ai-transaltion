import { AWSConfig } from '../types';

// AWS Configuration for direct S3 access
export const awsConfig: AWSConfig = {
  region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID || 'YOUR_ACTUAL_ACCESS_KEY_HERE',
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY || 'YOUR_ACTUAL_SECRET_KEY_HERE',
  bucketName: process.env.REACT_APP_S3_BUCKET_NAME || 'quim-aichatbot',
  cloudFrontDomain: undefined, // No CloudFront, using direct S3
};

// ⚠️ IMPORTANT: Replace the placeholder credentials above with your actual AWS credentials
// 
// To get your AWS credentials:
// 1. Go to AWS Console → IAM → Users → Your User → Security credentials
// 2. Create Access Key
// 3. Copy the Access Key ID and Secret Access Key
// 4. Replace 'YOUR_ACTUAL_ACCESS_KEY_HERE' and 'YOUR_ACTUAL_SECRET_KEY_HERE' above
//
// Example:
// accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
// secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', 