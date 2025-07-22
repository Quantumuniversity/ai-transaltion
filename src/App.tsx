import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { CourseList } from './components/CourseList';
import { S3Service } from './services/s3Service';
import { awsConfig } from './config/aws';
import { Course } from './types';

// Main App component
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already authenticated on app load
  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      loadCourses();
    }
  }, []);

  // Load courses from S3 when authenticated
  const loadCourses = async () => {
    setIsLoading(true);
    setError(null);
    setLoadingProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 100);

      // Create S3 service instance
      const s3Service = new S3Service(awsConfig);
      
      // Fetch courses from S3
      const fetchedCourses = await s3Service.getCourses();
      setCourses(fetchedCourses);
      
      // Complete progress
      setLoadingProgress(100);
      clearInterval(progressInterval);
      
      console.log('Successfully loaded courses:', fetchedCourses);
    } catch (err) {
      console.error('Error loading courses:', err);
      setError('Failed to load courses. Please check your AWS credentials and try again.');
    } finally {
      setIsLoading(false);
      // Reset progress after a short delay
      setTimeout(() => setLoadingProgress(0), 500);
    }
  };

  // Handle successful authentication
  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    loadCourses();
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
    setCourses([]);
    setError(null);
  };

  // Show authentication screen if not authenticated
  if (!isAuthenticated) {
    return <Auth onAuthenticated={handleAuthenticated} />;
  }

  // Show loading state while fetching courses
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          {/* Loading Animation */}
          <div className="relative mb-8">
            <div className="w-24 h-24 mx-auto relative">
              {/* Outer ring */}
              <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
              {/* Progress ring */}
              <div 
                className="absolute inset-0 border-4 border-blue-500 rounded-full transition-all duration-300 ease-out"
                style={{
                  clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%)`,
                  background: `conic-gradient(from 0deg, #3b82f6 ${loadingProgress * 3.6}deg, transparent ${loadingProgress * 3.6}deg)`
                }}
              ></div>
              {/* Center icon */}
              <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Loading Text */}
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Loading AI Translation Courses
          </h2>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          
          {/* Status Messages */}
          <div className="space-y-2 text-sm text-gray-600">
            {loadingProgress < 30 && (
              <p>🔄 Connecting to S3...</p>
            )}
            {loadingProgress >= 30 && loadingProgress < 60 && (
              <p>📁 Fetching course data...</p>
            )}
            {loadingProgress >= 60 && loadingProgress < 90 && (
              <p>⚡ Generating video URLs...</p>
            )}
            {loadingProgress >= 90 && (
              <p>✅ Almost ready...</p>
            )}
          </div>

          {/* Performance Tip */}
          <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-700">
              💡 <strong>Pro tip:</strong> Subsequent loads will be instant thanks to our super-fast caching system!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if loading failed
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Error Loading AI Translation Courses
            </h2>
            <p className="text-gray-600 mb-6">
              {error}
            </p>
            <div className="space-y-3">
              <button
                onClick={loadCourses}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Try Again
              </button>
              <button
                onClick={handleLogout}
                className="w-full bg-gradient-to-r from-gray-500 to-gray-600 text-white py-3 px-4 rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show course list when everything is loaded
  return (
    <CourseList
      courses={courses}
      onLogout={handleLogout}
    />
  );
}

export default App; 