import React, { useEffect, useRef, useState, useCallback } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { Video } from '../types';
import { FileText, X, Maximize2, Minimize2, AlertCircle } from 'lucide-react';

interface VideoPlayerProps {
  video: Video;
  onClose: () => void;
  onSubtitleToggle?: (enabled: boolean) => void;
}

// Language names mapping
const LANGUAGE_NAMES: { [key: string]: string } = {
  'en': 'English',
  'es': 'Español',
  'fr': 'Français',
  'ar': 'العربية',
  'zh': '中文',
  'de': 'Deutsch',
  'it': 'Italiano',
  'pt': 'Português',
  'ru': 'Русский',
  'ja': '日本語',
  'ko': '한국어'
};

// Video player component with subtitle support
export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, onClose, onSubtitleToggle }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [subtitleEnabled, setSubtitleEnabled] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [subtitleError, setSubtitleError] = useState<string | null>(null);

  // Cleanup function to properly dispose of the video player
  const cleanupPlayer = useCallback(() => {
    if (playerRef.current) {
      try {
        console.log('Disposing video player');
        playerRef.current.dispose();
        playerRef.current = null;
        setIsPlayerReady(false);
      } catch (err) {
        console.error('Error disposing player:', err);
      }
    }
  }, []);

  // Function to add subtitle tracks after video is loaded
  const addSubtitleTracks = useCallback((player: any) => {
    try {
      console.log('Adding subtitle tracks...');
      
      // Create tracks array for all available languages (VTT and SRT)
      const tracks: Array<{
        src: string;
        kind: string;
        srclang: string;
        label: string;
        default: boolean;
      }> = [];
      
      // Add VTT tracks
      Object.entries(video.vttUrls || {}).forEach(([langCode, url]) => {
        tracks.push({
          src: url,
          kind: 'subtitles',
          srclang: langCode,
          label: `${LANGUAGE_NAMES[langCode] || langCode} (VTT)`,
          default: langCode === 'en' && tracks.length === 0 // Default to English if first track
        });
      });
      
      // Add SRT tracks (converted to VTT format by server)
      Object.entries(video.srtUrls || {}).forEach(([langCode, url]) => {
        tracks.push({
          src: url,
          kind: 'subtitles',
          srclang: langCode,
          label: `${LANGUAGE_NAMES[langCode] || langCode} (SRT)`,
          default: langCode === 'en' && tracks.length === 0 // Default to English if first track
        });
      });

      // Add tracks one by one with error handling
      tracks.forEach((track, index) => {
        try {
          const textTrack = player.addRemoteTextTrack(track, false);
          console.log(`Added subtitle track: ${track.label}`);
          
          // Handle track loading errors
          textTrack.addEventListener('error', (e: any) => {
            console.warn(`Subtitle track failed to load: ${track.label}`, e);
            setSubtitleError(`Subtitle track "${track.label}" failed to load. Video will continue without subtitles.`);
          });
          
        } catch (trackError) {
          console.warn(`Failed to add subtitle track: ${track.label}`, trackError);
          setSubtitleError(`Failed to add subtitle track "${track.label}". Video will continue without subtitles.`);
        }
      });

      console.log('Player tracks after adding:', player.textTracks());
      
    } catch (error) {
      console.warn('Error adding subtitle tracks:', error);
      setSubtitleError('Failed to load subtitle tracks. Video will continue without subtitles.');
    }
  }, [video]);

  // Initialize video player
  const initializePlayer = useCallback(() => {
    // Clean up any existing player first
    cleanupPlayer();

    // Wait for the next tick to ensure DOM is ready
    setTimeout(() => {
      if (videoRef.current && !playerRef.current && document.contains(videoRef.current)) {
        try {
          console.log('VideoPlayer: Initializing with video:', video);
          
          // Create player WITHOUT tracks first to ensure video loads
          const player = videojs(videoRef.current, {
            controls: true,
            fluid: true,
            responsive: true,
            playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
            sources: [{
              src: video.videoUrl,
              type: 'video/mp4'
            }]
          });

          playerRef.current = player;

          // Debug subtitle tracks
          console.log('Video VTT URLs:', video.vttUrls);
          console.log('Video SRT URLs (converted to VTT):', video.srtUrls);
          console.log('Available languages:', video.availableLanguages);
          
          // Backward compatibility: if vttUrls doesn't exist, check for old vttUrl
          if (!video.vttUrls && (video as any).vttUrl) {
            console.log('Backward compatibility: using old vttUrl structure');
            video.vttUrls = { 'en': (video as any).vttUrl };
            video.availableLanguages = ['en'];
          }

          // Handle player events
          player.on('loadeddata', () => {
            console.log('Video loaded successfully');
            setIsLoading(false);
            setError(null);
            setIsPlayerReady(true);
            
            // Now try to add subtitle tracks AFTER video is loaded
            addSubtitleTracks(player);
          });

          player.on('error', (e: any) => {
            console.error('Video player error:', e);
            setError('Failed to load video. Please check the URL and try again.');
            setIsLoading(false);
          });

          player.on('loadstart', () => {
            console.log('Video loading started');
            setIsLoading(true);
            setError(null);
          });

          player.on('ready', () => {
            console.log('Video player ready');
            setIsPlayerReady(true);
          });

          // Add a timeout to handle cases where video doesn't load
          const loadTimeout = setTimeout(() => {
            console.warn('Video loading timeout');
            setError('Video took too long to load. Please check your connection and try again.');
            setIsLoading(false);
          }, 30000); // 30 second timeout

          // Clear timeout when video loads successfully
          player.on('loadeddata', () => {
            clearTimeout(loadTimeout);
          });

          player.on('error', () => {
            clearTimeout(loadTimeout);
          });

        } catch (err) {
          console.error('Error initializing video player:', err);
          setError('Failed to initialize video player');
          setIsLoading(false);
        }
      }
    }, 100); // Small delay to ensure DOM is ready
  }, [video, cleanupPlayer, addSubtitleTracks]);

  useEffect(() => {
    // Initialize player when component mounts or video changes
    initializePlayer();

    // Handle fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      cleanupPlayer();
    };
  }, [video, initializePlayer, cleanupPlayer]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const toggleSubtitles = () => {
    if (playerRef.current) {
      const tracks = playerRef.current.textTracks();
      console.log('Available tracks for toggle:', tracks);
      if (tracks.length > 0) {
        const track = tracks[0];
        const newMode = track.mode === 'showing' ? 'hidden' : 'showing';
        track.mode = newMode;
        console.log('Subtitle mode changed to:', newMode);
        setSubtitleEnabled(newMode === 'showing');
        onSubtitleToggle?.(newMode === 'showing');
      } else {
        console.warn('No subtitle tracks available');
      }
    }
  };

  const changeSubtitleLanguage = (langCode: string) => {
    if (playerRef.current) {
      const tracks = playerRef.current.textTracks();
      
      // Hide all tracks first
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = 'hidden';
      }
      
      // Find and show the selected language track
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].language === langCode) {
          tracks[i].mode = subtitleEnabled ? 'showing' : 'hidden';
          setSelectedLanguage(langCode);
          console.log('Subtitle language changed to:', langCode);
          break;
        }
      }
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const retryVideo = () => {
    setError(null);
    setSubtitleError(null);
    setIsLoading(true);
    initializePlayer();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-4xl mx-auto bg-black rounded-lg overflow-hidden shadow-2xl" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center">
          <h2 className="text-white text-lg font-semibold bg-black bg-opacity-50 px-3 py-1 rounded">
            {video.name}
          </h2>
          
          <div className="flex items-center space-x-2">
            {/* Subtitle Controls */}
            {(Object.keys(video.vttUrls || {}).length > 0 || Object.keys(video.srtUrls || {}).length > 0) && (
              <div className="flex items-center space-x-2">
                {/* Language Selector */}
                {Object.keys({ ...video.vttUrls, ...video.srtUrls }).length > 1 && (
                  <select
                    value={selectedLanguage}
                    onChange={(e) => changeSubtitleLanguage(e.target.value)}
                    className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm border border-white/20"
                  >
                    {Object.entries({ ...video.vttUrls, ...video.srtUrls }).map(([langCode, url]) => (
                      <option key={langCode} value={langCode}>
                        {LANGUAGE_NAMES[langCode] || langCode}
                      </option>
                    ))}
                  </select>
                )}
                
                {/* Subtitle Toggle */}
                <button
                  onClick={toggleSubtitles}
                  className={`p-2 rounded transition-all ${
                    subtitleEnabled 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-black bg-opacity-50 text-white hover:bg-opacity-70'
                  }`}
                  title="Toggle Subtitles"
                >
                  CC
                </button>
              </div>
            )}
            
            {/* Transcript Toggle */}
            {video.transcript && (
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="bg-black bg-opacity-50 text-white p-2 rounded hover:bg-opacity-70 transition-all"
                title="Toggle Transcript"
              >
                <FileText className="w-4 h-4" />
              </button>
            )}
            
            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="bg-black bg-opacity-50 text-white p-2 rounded hover:bg-opacity-70 transition-all"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="bg-black bg-opacity-50 text-white p-2 rounded hover:bg-opacity-70 transition-all"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Container */}
        <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-white">Loading video...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-white mb-4">{error}</p>
                <button
                  onClick={retryVideo}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          
          {/* Subtitle Error Warning */}
          {subtitleError && !error && (
            <div className="absolute top-4 right-4 bg-yellow-600 bg-opacity-90 text-white px-3 py-2 rounded text-sm max-w-xs">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{subtitleError}</span>
              </div>
            </div>
          )}
          
          <video
            ref={videoRef}
            className="video-js vjs-big-play-centered"
            data-setup="{}"
            preload="auto"
            playsInline
          />
        </div>

        {/* Transcript Panel */}
        {showTranscript && video.transcript && (
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-90 text-white p-4 max-h-48 overflow-y-auto">
            <h3 className="text-sm font-semibold mb-2">Transcript</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {video.transcript}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}; 