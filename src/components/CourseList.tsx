import React, { useState } from 'react';
import { Course, Video } from '../types';
import { Play, FileText, Subtitles, ChevronDown, ChevronRight, LogOut, Clock, Calendar } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';



interface CourseListProps {
  courses: Course[];
  onLogout: () => void;
}

// Course list component to display all courses and videos
export const CourseList: React.FC<CourseListProps> = ({ courses, onLogout }) => {
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [subtitleEnabled, setSubtitleEnabled] = useState(false);

  const toggleCourse = (courseName: string) => {
    const newExpanded = new Set(expandedCourses);
    if (newExpanded.has(courseName)) {
      newExpanded.delete(courseName);
    } else {
      newExpanded.add(courseName);
    }
    setExpandedCourses(newExpanded);
  };

  const openVideo = (video: Video) => {
    console.log('Opening video:', video);
    setSelectedVideo(video);
  };

  const closeVideo = () => {
    setSelectedVideo(null);
  };

  // Group videos by course for better organization
  const organizedCourses = courses.map(course => ({
    ...course,
    videos: course.videos.sort((a, b) => a.name.localeCompare(b.name))
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Quantum University AI Translation Project
              </h1>
              <p className="text-gray-600 mt-1">
                {courses.length} courses • {courses.reduce((total, course) => total + course.videos.length, 0)} videos available
              </p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Course List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8">
          {organizedCourses.map((course) => (
            <div
              key={course.name}
              className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]"
            >
              {/* Course Header */}
              <div
                className="px-8 py-6 cursor-pointer hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 transition-all duration-300"
                onClick={() => toggleCourse(course.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                      {expandedCourses.has(course.name) ? (
                        <ChevronDown className="w-6 h-6 text-white" />
                      ) : (
                        <ChevronRight className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {course.name}
                      </h2>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-semibold px-3 py-1 rounded-full">
                          {course.videos.length} videos
                        </span>
                        <span className="text-gray-500 text-sm flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Click to expand
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Course Videos */}
              {expandedCourses.has(course.name) && (
                <div className="border-t border-white/20 bg-gradient-to-r from-blue-50/30 to-purple-50/30">
                  <div className="p-8">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {course.videos.map((video, index) => (
                        <div
                          key={`${course.name}-${video.name}-${index}`}
                          className="bg-white/60 backdrop-blur-sm rounded-xl hover:bg-white/80 transition-all duration-300 border border-white/30 hover:shadow-lg overflow-hidden group"
                        >
                          {/* Video Thumbnail/Preview */}
                          <div className="relative h-32 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                              <Play className="w-8 h-8 text-white" />
                            </div>
                            <div className="absolute top-2 right-2">
                              <span className="bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                                {index + 1}
                              </span>
                            </div>
                          </div>

                          {/* Video Info */}
                          <div className="p-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                              {video.name}
                            </h3>
                            
                            {/* Video Features */}
                            <div className="flex flex-wrap gap-2 mb-4">
                              {/* VTT Subtitles */}
                              {Object.keys(video.vttUrls || {}).length > 0 && (
                                <div className="flex items-center space-x-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                  <Subtitles className="w-3 h-3" />
                                  <span>
                                    {Object.keys(video.vttUrls).length === 1 
                                      ? 'VTT' 
                                      : `${Object.keys(video.vttUrls).length} VTT`
                                    }
                                  </span>
                                </div>
                              )}
                              {/* SRT Subtitles */}
                              {Object.keys(video.srtUrls || {}).length > 0 && (
                                <div className="flex items-center space-x-1 text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                                  <Subtitles className="w-3 h-3" />
                                  <span>
                                    {Object.keys(video.srtUrls).length === 1 
                                      ? 'SRT' 
                                      : `${Object.keys(video.srtUrls).length} SRT`
                                    }
                                  </span>
                                </div>
                              )}
                              {video.transcript && (
                                <div className="flex items-center space-x-1 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                  <FileText className="w-3 h-3" />
                                  <span>Transcript</span>
                                </div>
                              )}
                            </div>

                            {/* Watch Button */}
                            <button
                              onClick={() => openVideo(video)}
                              className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-105"
                            >
                              <Play className="w-4 h-4" />
                              <span>Watch Now</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {courses.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Play className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No courses found
            </h3>
            <p className="text-gray-600">
              There are no courses available in your S3 bucket.
            </p>
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {selectedVideo && (
        <VideoPlayer
          key={`${selectedVideo.name}-${selectedVideo.videoUrl}`}
          video={selectedVideo}
          onClose={closeVideo}
          onSubtitleToggle={setSubtitleEnabled}
        />
      )}
    </div>
  );
}; 