const { useEffect, useState } = React;

function App() {
  // Skip consent/onboarding for now - go straight to main app
  const [currentPage, setCurrentPage] = useState('main');
  
  // Active tab state
  const [activeTab, setActiveTab] = useState('home');
  
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  // User state (placeholder for w3 auth)
  const [user, setUser] = useState({
    name: 'Asad Mahmood',
    email: 'asad.mahmood1@ibm.com',
    avatar: null
  });
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // File history state (localStorage)
  const [fileHistory, setFileHistory] = useState(() => {
    const saved = localStorage.getItem('fileHistory');
    return saved ? JSON.parse(saved) : [
      {
        id: '1',
        filename: 'Q1_Planning_Sync_0314.m4a',
        uploadedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        duration: '54 min',
        category: 'Product Strategy',
        status: 'audio',
        hasTranscript: false,
        hasSummary: false
      },
      {
        id: '2',
        filename: 'Client_Retention_Review.wav',
        uploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        duration: '42 min',
        category: 'Client Meeting',
        status: 'transcript',
        hasTranscript: true,
        hasSummary: false,
        speakerDiarization: true
      },
      {
        id: '3',
        filename: 'Weekly_Operations_Checkin.mp3',
        uploadedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        duration: '28 min',
        category: 'Internal',
        status: 'summary',
        hasTranscript: true,
        hasSummary: true,
        actionItems: 8
      }
    ];
  });
  
  // Main app state (from original)
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [files, setFiles] = useState({ audio: null, transcript: null, summary: null });
  const [transcribeJob, setTranscribeJob] = useState(null);
  const [summarizeJob, setSummarizeJob] = useState(null);
  
  // Transcription options
  const [transcriptType, setTranscriptType] = useState('standard');
  const [transcriptOptions, setTranscriptOptions] = useState({
    timestamps: true,
    speakerDiarization: false,
    pauses: false,
    redactWords: null
  });
  
  // Summarization options
  const [summaryType, setSummaryType] = useState('standard');
  const [structuredSections, setStructuredSections] = useState({
    attendees: true,
    purpose: true,
    actionItems: true,
    risks: true,
    questions: true
  });

  // Apply dark mode
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);
  
  // Save file history to localStorage
  useEffect(() => {
    localStorage.setItem('fileHistory', JSON.stringify(fileHistory));
  }, [fileHistory]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };
  
  const refresh = async () => {
    const r = await fetch(`/api/status?t=${Date.now()}`);
    const j = await r.json();
    const isRec = !!j.recording?.isRecording;
    const isStopping = !!j.recording?.isStopping;
    setRecording(isRec);
    setStopping(isStopping);
    
    const normalizedFiles = {
      audio: j.files?.audio || null,
      transcript: j.files?.transcript || null,
      summary: j.files?.summary || null
    };
    setFiles(normalizedFiles);
  };
  
  useEffect(() => {
    if (currentPage === 'main') {
      refresh();
    }
  }, [currentPage]);

  // Filter files based on search
  const filteredFiles = fileHistory.filter(file =>
    file.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Tab navigation
  const tabs = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'upload', label: 'Upload', icon: '📤' },
    { id: 'record', label: 'Record', icon: '🎙️', disabled: true },
    { id: 'transcribe', label: 'Transcribe', icon: '📝' },
    { id: 'summarize', label: 'Summarize', icon: '📊' },
    { id: 'analytics', label: 'Analytics', icon: '📈', disabled: true }
  ];

  // Ref for scrolling to home dashboard
  const homeDashboardRef = React.useRef(null);
  const tabNavigationRef = React.useRef(null);
  
  const scrollToHomeDashboard = () => {
    setActiveTab('home');
    setTimeout(() => {
      homeDashboardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };
  
  const scrollToTab = (tabName) => {
    setActiveTab(tabName);
    setTimeout(() => {
      tabNavigationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo-container">
            <div className="logo-text">
              <span className="logo-ibm">IBM</span>
              <span className="logo-recap">Recap</span>
            </div>
          </div>
        </div>
        
        <div className="header-right">
          <button className="theme-toggle-btn" onClick={toggleDarkMode}>
            {darkMode ? '☀️' : '🌙'} {darkMode ? 'Dark' : 'Light'} mode
          </button>
          <div className="user-menu">
            <button className="user-button">
              <span className="user-indicator"></span>
              {user.name} ▼
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section-wrapper">
        <div className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">From meeting chaos to structured documentation in minutes.</h1>
            <p className="hero-description">
              Transform your Microsoft Teams meetings into actionable insights. IBM Recap automatically transcribes,
              summarizes, and organizes your conversations—giving you more time to focus on what matters.
            </p>
            
            {/* Hero Action Buttons */}
            <div className="hero-actions">
              <button className="hero-btn hero-btn-primary" onClick={scrollToHomeDashboard}>
                View Home Dashboard
              </button>
              <button className="hero-btn hero-btn-secondary" onClick={() => scrollToTab('upload')}>
                Jump to upload flow
              </button>
              <button className="hero-btn hero-btn-tertiary" onClick={() => scrollToTab('analytics')}>
                Preview analytics
              </button>
            </div>
            
            {/* Hero Stats */}
            <div className="hero-stats">
              <div className="hero-stat-card">
                <div className="hero-stat-label">Average turnaround</div>
                <div className="hero-stat-value">4.2 min</div>
                <div className="hero-stat-desc">Audio → transcript → summary</div>
              </div>
              <div className="hero-stat-card">
                <div className="hero-stat-label">Transcript accuracy</div>
                <div className="hero-stat-value">95%</div>
                <div className="hero-stat-desc">With timestamps and speaker ID</div>
              </div>
              <div className="hero-stat-card">
                <div className="hero-stat-label">Searchable records</div>
                <div className="hero-stat-value">1,248</div>
                <div className="hero-stat-desc">Across Teams and uploads</div>
              </div>
            </div>
          </div>
          <div className="hero-video">
            <video
              controls
              className="demo-video"
              preload="metadata"
            >
              <source src="https://ibm.box.com/shared/static/ed5ha1bvn3jfbcxfjz3d19gg26nksvri.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </section>

      {/* Tab Navigation */}
      <nav className="tab-navigation" ref={tabNavigationRef}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main className="main-content-area">
        {activeTab === 'home' && <HomeTab
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filteredFiles={filteredFiles}
          setActiveTab={setActiveTab}
          homeDashboardRef={homeDashboardRef}
        />}
        
        {activeTab === 'upload' && <UploadTab 
          files={files}
          busy={busy}
          setBusy={setBusy}
          refresh={refresh}
        />}
        
        {activeTab === 'transcribe' && <TranscribeTab
          files={files}
          busy={busy}
          transcribeJob={transcribeJob}
          setTranscribeJob={setTranscribeJob}
          transcriptType={transcriptType}
          setTranscriptType={setTranscriptType}
          transcriptOptions={transcriptOptions}
          setTranscriptOptions={setTranscriptOptions}
          setBusy={setBusy}
          refresh={refresh}
          setActiveTab={setActiveTab}
        />}
        
        {activeTab === 'summarize' && <SummarizeTab
          files={files}
          busy={busy}
          summarizeJob={summarizeJob}
          setSummarizeJob={setSummarizeJob}
          summaryType={summaryType}
          setSummaryType={setSummaryType}
          structuredSections={structuredSections}
          setStructuredSections={setStructuredSections}
          setBusy={setBusy}
          refresh={refresh}
          setActiveTab={setActiveTab}
        />}
        
        {activeTab === 'record' && <ComingSoonTab 
          title="Record"
          description="Teams calendar integration and direct meeting recording coming soon"
        />}
        
        {activeTab === 'analytics' && <ComingSoonTab 
          title="Analytics"
          description="Meeting insights, time tracking, and action item analytics coming soon"
        />}
      </main>
    </div>
  );
}

// Home Tab Component
function HomeTab({ searchQuery, setSearchQuery, filteredFiles, setActiveTab, homeDashboardRef }) {
  return (
    <div className="home-tab">
      <div className="home-header" ref={homeDashboardRef}>
        <h1 className="home-title">Recap Center</h1>
        <p className="home-subtitle">A high-level control center that surfaces the next action, recent files, and workflow readiness.</p>
        <div className="status-badge">● Ready for processing</div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Uploaded files</div>
          <div className="stat-value">18</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending transcripts</div>
          <div className="stat-value">4</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Summaries generated</div>
          <div className="stat-value">42</div>
          <div className="stat-badge">Structured default</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Teams meetings this week</div>
          <div className="stat-value">27</div>
          <div className="stat-badge">Calendar synced</div>
        </div>
      </div>

      {/* Recommended Next Step */}
      <div className="recommended-card">
        <div className="recommended-content">
          <div className="recommended-icon">🎯</div>
          <div className="recommended-text">
            <div className="recommended-title">Recommended next step</div>
            <div className="recommended-action">
              Transcribe <span className="filename">Q1_Planning_Sync_0314.m4a</span> to unlock summary generation.
            </div>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setActiveTab('transcribe')}>
          Open tab
        </button>
      </div>

      {/* Search Bar */}
      <div className="search-section">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search recent uploads, transcripts, and summaries"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <button className="filters-button">Filters</button>
      </div>

      {/* Recent Files */}
      <div className="files-section">
        <h2 className="section-title">Recent files</h2>
        <div className="files-list">
          {filteredFiles.map(file => (
            <div key={file.id} className="file-card">
              <div className="file-icon">
                {file.status === 'audio' && '🎧'}
                {file.status === 'transcript' && '📝'}
                {file.status === 'summary' && '📊'}
              </div>
              <div className="file-info">
                <div className="file-name">{file.filename}</div>
                <div className="file-meta">
                  Uploaded {getTimeAgo(file.uploadedAt)} • {file.duration} • {file.category}
                  {file.speakerDiarization && ' • Speaker ID enabled'}
                  {file.actionItems && ` • ${file.actionItems} action items`}
                </div>
              </div>
              <div className="file-status">
                {file.status === 'audio' && <span className="badge badge-warning">Audio only</span>}
                {file.status === 'transcript' && <span className="badge badge-success">Transcript ✓</span>}
                {file.status === 'summary' && <span className="badge badge-success">Summary ✓</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Upload Tab Component
function UploadTab({ files, busy, setBusy, refresh }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!busy) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target.classList.contains('upload-drop-zone')) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (busy) return;
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      await uploadFile(droppedFiles[0]);
    }
  };

  const uploadFile = async (file) => {
    if (!file) return;
    
    const validTypes = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/wave'];
    const validExtensions = ['.mp3', '.m4a', '.wav'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      alert('Invalid file type. Please upload MP3, M4A, or WAV files.');
      return;
    }
    
    const formData = new FormData();
    formData.append('audio', file);
    
    try {
      setBusy(true);
      const r = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData,
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'Upload failed');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      await refresh();
    } catch (e) {
      alert(`Upload error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    await uploadFile(file);
    event.target.value = '';
  };

  return (
    <div className="upload-tab">
      <h1 className="tab-title">Upload audio file</h1>
      <p className="tab-subtitle">Upload meeting recordings in MP3, M4A, or WAV format</p>

      <div
        className={`upload-drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="upload-icon">📁</div>
        <h3>Drag and drop your audio file here</h3>
        <p>or</p>
        <label className="upload-button">
          <input
            type="file"
            accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/wave"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            disabled={busy}
          />
          <span className="btn-primary">Browse files</span>
        </label>
        <p className="upload-hint">Supported formats: MP3, M4A, WAV (max 100MB)</p>
      </div>

      {files.audio && <AudioPlayer audioFile={files.audio} originalFilename={files.originalFilename} />}
    </div>
  );
}

// Audio Player Component
function AudioPlayer({ audioFile, originalFilename }) {
  const audioRef = React.useRef(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = React.useState(false);
  const [showMoreOptions, setShowMoreOptions] = React.useState(false);
  const [playbackRate, setPlaybackRate] = React.useState(1);

  // Extract server filename from path and construct audio URL
  const serverFilename = audioFile.split('/').pop();
  const audioUrl = `/api/audio/${serverFilename}`;
  // Use original filename for display, fallback to server filename
  const displayFilename = originalFilename || serverFilename;
  
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      console.log('Audio duration loaded:', audio.duration);
      setDuration(audio.duration);
    };
    const handleEnded = () => setIsPlaying(false);
    const handleError = (e) => {
      console.error('Audio loading error:', e);
      console.error('Audio src:', audio.src);
      console.error('Audio error code:', audio.error?.code);
      console.error('Audio error message:', audio.error?.message);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // Log the audio URL for debugging
    console.log('Audio player initialized with URL:', audioUrl);
    console.log('Display filename:', displayFilename);
    console.log('Server filename:', serverFilename);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl, displayFilename, serverFilename]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * duration;
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    audioRef.current.volume = newVolume;
  };

  const handlePlaybackRateChange = (rate) => {
    setPlaybackRate(rate);
    audioRef.current.playbackRate = rate;
    setShowMoreOptions(false);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = displayFilename;
    link.click();
    setShowMoreOptions(false);
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="audio-player-container">
      <div className="audio-player-header">
        <h3 className="audio-player-title">Native audio preview</h3>
        <span className="audio-player-status">Ready to review</span>
      </div>
      <p className="audio-player-subtitle">Play the uploaded file to confirm sound quality before transcription.</p>

      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="audio-player-controls">
        <button className="audio-play-button" onClick={togglePlay}>
          {isPlaying ? '⏸' : '▶'}
        </button>

        <span className="audio-time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="audio-progress-container" onClick={handleSeek}>
          <div className="audio-progress-bar">
            <div className="audio-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="audio-volume-control">
          <button
            className="audio-volume-button"
            onClick={() => setShowVolumeSlider(!showVolumeSlider)}
          >
            {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
          {showVolumeSlider && (
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="audio-volume-slider"
            />
          )}
        </div>

        <div className="audio-more-options">
          <button
            className="audio-more-button"
            onClick={() => setShowMoreOptions(!showMoreOptions)}
          >
            ⋮
          </button>
          {showMoreOptions && (
            <div className="audio-options-menu">
              <div className="audio-options-section">
                <div className="audio-options-label">Playback speed</div>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                  <button
                    key={rate}
                    className={`audio-option-item ${playbackRate === rate ? 'active' : ''}`}
                    onClick={() => handlePlaybackRateChange(rate)}
                  >
                    {rate}x {playbackRate === rate && '✓'}
                  </button>
                ))}
              </div>
              <button className="audio-option-item" onClick={handleDownload}>
                ⬇ Download
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="audio-player-info">
        Previewing: <strong>{displayFilename}</strong> • {formatTime(duration)} • Uploaded successfully
      </div>
    </div>
  );
}

// Transcribe Tab Component
function TranscribeTab({ files, busy, transcribeJob, setTranscribeJob, transcriptType, setTranscriptType, transcriptOptions, setTranscriptOptions, setBusy, refresh, setActiveTab }) {
  const [showOptions, setShowOptions] = useState(false);

  const handleTranscribe = () => {
    setShowOptions(true);
  };

  const executeTranscription = async () => {
    setShowOptions(false);
    
    const options = {};
    if (transcriptType === 'custom') {
      options.timestamps = transcriptOptions.timestamps;
      options.speakerDiarization = transcriptOptions.speakerDiarization;
      options.pauses = transcriptOptions.pauses;
      if (transcriptOptions.redactWords && transcriptOptions.redactWords.trim()) {
        options.redactWords = transcriptOptions.redactWords.split(',').map(w => w.trim()).filter(w => w);
      }
    } else {
      options.timestamps = true;
    }
    
    try {
      setBusy(true);
      const r = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptOptions: options }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'Request failed');
      
      setTranscribeJob({ status: 'running', percent: 1, message: 'Starting...' });
      await pollJob(j.jobId, setTranscribeJob);
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const pollJob = async (jobId, setter) => {
    let done = false;
    while (!done) {
      const r = await fetch(`/api/jobs/${jobId}`);
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'Job polling failed');
      setter(j.job);
      if (j.job.status === 'done' || j.job.status === 'error') done = true;
      if (!done) await new Promise((resolve) => setTimeout(resolve, 600));
    }
    await refresh();
  };

  const getAudioDuration = () => {
    if (!files.audio) return '';
    // Mock duration for now - in real app would get from metadata
    return '54 min';
  };

  return (
    <div className="transcribe-tab">
      <div className="transcribe-header">
        <div>
          <h1 className="tab-title">Transcribe audio</h1>
          <p className="tab-subtitle">A dedicated transcript generation tab with visible file context, customizable options, and progress feedback.</p>
        </div>
        {files.transcript && (
          <span className="transcript-ready-badge">Transcript ready state</span>
        )}
      </div>

      {!files.audio && (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <h3>No audio file uploaded</h3>
          <p>Please upload an audio file first to generate a transcript</p>
        </div>
      )}

      {files.audio && (
        <>
          {/* File Context Card */}
          <div className="transcribe-file-card">
            <div className="file-card-icon">🎧</div>
            <div className="file-card-info">
              <div className="file-card-name">{files.originalFilename || files.audio.split('/').pop()}</div>
              <div className="file-card-meta">
                Uploaded today • {getAudioDuration()} • Audio file validated
              </div>
            </div>
            {files.audio && (
              <span className="file-card-badge">Audio ✓</span>
            )}
          </div>

          {/* Transcript Type Options */}
          <div className="transcript-options-grid">
            <label className={`transcript-option-card ${transcriptType === 'standard' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="transcriptType"
                value="standard"
                checked={transcriptType === 'standard'}
                onChange={(e) => setTranscriptType(e.target.value)}
              />
              <div className="option-card-content">
                <div className="option-card-header">
                  <span className="option-card-icon">📝</span>
                  <span className="option-card-title">Standard transcript</span>
                </div>
                <p className="option-card-description">
                  A line-by-line transcript with timestamps.
                </p>
              </div>
            </label>

            <label className={`transcript-option-card ${transcriptType === 'custom' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="transcriptType"
                value="custom"
                checked={transcriptType === 'custom'}
                onChange={(e) => setTranscriptType(e.target.value)}
              />
              <div className="option-card-content">
                <div className="option-card-header">
                  <span className="option-card-icon">⚙️</span>
                  <span className="option-card-title">Custom transcript</span>
                  <span className="info-badge">ⓘ</span>
                </div>
                <p className="option-card-description">
                  Customize timestamps, speaker diarization, pauses, and redactions.
                </p>
              </div>
            </label>
          </div>

          {/* Custom Options Checkboxes */}
          <div className="transcript-features">
            <label className="feature-checkbox">
              <input
                type="checkbox"
                checked={transcriptOptions.timestamps}
                onChange={(e) => setTranscriptOptions({...transcriptOptions, timestamps: e.target.checked})}
                disabled={transcriptType === 'standard'}
              />
              <div className="feature-content">
                <div className="feature-title">Timestamps</div>
                <div className="feature-description">Included for searchability and playback reference.</div>
              </div>
            </label>

            <label className="feature-checkbox">
              <input
                type="checkbox"
                checked={transcriptOptions.speakerDiarization}
                onChange={(e) => setTranscriptOptions({...transcriptOptions, speakerDiarization: e.target.checked})}
                disabled={transcriptType === 'standard'}
              />
              <div className="feature-content">
                <div className="feature-title">Speaker diarization</div>
                <div className="feature-description">AI speaker identification enabled.</div>
              </div>
            </label>

            <label className="feature-checkbox">
              <input
                type="checkbox"
                checked={transcriptOptions.pauses}
                onChange={(e) => setTranscriptOptions({...transcriptOptions, pauses: e.target.checked})}
                disabled={transcriptType === 'standard'}
              />
              <div className="feature-content">
                <div className="feature-title">Pause markers</div>
                <div className="feature-description">Useful for natural conversation pacing.</div>
              </div>
            </label>

            <div className="feature-checkbox feature-with-input">
              <input
                type="checkbox"
                checked={transcriptOptions.redactWords !== null && transcriptOptions.redactWords !== undefined}
                onChange={(e) => {
                  if (e.target.checked) {
                    setTranscriptOptions({...transcriptOptions, redactWords: ''});
                  } else {
                    setTranscriptOptions({...transcriptOptions, redactWords: null});
                  }
                }}
                disabled={transcriptType === 'standard'}
              />
              <div className="feature-content">
                <div className="feature-title">Redacted terms</div>
                <div className="feature-description">
                  Enter words or phrases to redact (comma-separated)
                </div>
                {(transcriptOptions.redactWords !== null && transcriptOptions.redactWords !== undefined) && (
                  <input
                    type="text"
                    className="redact-input"
                    placeholder="e.g., confidential, password, unreleased"
                    value={transcriptOptions.redactWords || ''}
                    onChange={(e) => setTranscriptOptions({...transcriptOptions, redactWords: e.target.value})}
                    disabled={transcriptType === 'standard'}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Progress Section */}
          {transcribeJob && (
            <div className="transcription-progress-section">
              <div className="progress-section-header">
                <span className="progress-section-title">Transcription progress</span>
                <span className="progress-section-percent">{transcribeJob.percent || 0}%</span>
              </div>
              <div className="progress-section-bar">
                <div className="progress-section-fill" style={{ width: `${transcribeJob.percent || 0}%` }} />
              </div>
              <p className="progress-section-message">
                {transcribeJob.status === 'done' && transcribeJob.percent === 100
                  ? 'Transcription complete. Download the PDF or continue to the summary tab.'
                  : transcribeJob.message || 'Processing your audio file...'}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="transcribe-actions">
            {files.transcript ? (
              <>
                <button
                  className="btn-primary-large"
                  onClick={() => window.open('/api/download/transcript', '_blank')}
                >
                  Download transcript PDF
                </button>
                <button
                  className="btn-secondary-large"
                  onClick={() => setActiveTab('summarize')}
                >
                  Continue to summarize
                </button>
              </>
            ) : (
              <button
                className="btn-primary-large"
                onClick={executeTranscription}
                disabled={busy || !files.audio}
              >
                {busy ? 'Transcribing...' : 'Start transcription'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Summarize Tab Component  
function SummarizeTab({ files, busy, summarizeJob, setSummarizeJob, summaryType, setSummaryType, structuredSections, setStructuredSections, setBusy, refresh, setActiveTab }) {
  
  const executeSummarization = async () => {
    let customPrompt = '';
    if (summaryType === 'standard') {
      customPrompt = `Please provide a brief, concise bulleted list of all key points and actions discussed in the meeting. Do not include any section headers or categories. Just provide a simple bulleted list.`;
    } else if (summaryType === 'structured') {
      const sections = [];
      if (structuredSections.attendees) sections.push('- **List of attendees** (extract all person names mentioned anywhere in the transcript)');
      if (structuredSections.purpose) sections.push('- **Main purpose of the meeting**');
      if (structuredSections.actionItems) sections.push('- **Action items** with owners and deadlines');
      if (structuredSections.risks) sections.push('- **Risks and blockers** identified');
      if (structuredSections.questions) sections.push('- **Open questions** that need resolution');
      
      customPrompt = `Please provide a structured summary with the following sections. Use **bold** formatting for section titles:\n${sections.join('\n')}\n\nIMPORTANT INSTRUCTIONS FOR ATTENDEES SECTION:\n- Carefully read through the entire transcript and extract ALL person names mentioned\n- Include first names, last names, or full names (e.g., "John", "Sarah", "Dr. Smith", "Michael Chen")\n- Do NOT include generic speaker labels like "Speaker A", "Speaker B", "Speaker C"\n- List each unique person name as a bullet point\n- If truly no person names are found anywhere in the transcript, only then write "No names mentioned"`;
    }
    
    try {
      setBusy(true);
      const r = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: customPrompt || undefined }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'Request failed');
      
      setSummarizeJob({ status: 'running', percent: 1, message: 'Starting...' });
      await pollJob(j.jobId, setSummarizeJob);
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const pollJob = async (jobId, setter) => {
    let done = false;
    while (!done) {
      const r = await fetch(`/api/jobs/${jobId}`);
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'Job polling failed');
      setter(j.job);
      if (j.job.status === 'done' || j.job.status === 'error') done = true;
      if (!done) await new Promise((resolve) => setTimeout(resolve, 600));
    }
    await refresh();
  };

  return (
    <div className="summarize-tab">
      <div className="summarize-header">
        <div>
          <h1 className="tab-title">Summarize transcript</h1>
          <p className="tab-subtitle">A summary generation view with standard and structured modes plus selectable summary sections.</p>
        </div>
        {files.transcript && (
          <span className="transcript-ready-badge">Transcript ✓</span>
        )}
      </div>

      {!files.transcript && (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>No transcript available</h3>
          <p>Please transcribe an audio file first to generate a summary</p>
        </div>
      )}

      {files.transcript && (
        <>
          {/* File Context Card */}
          <div className="transcribe-file-card">
            <div className="file-card-icon">📝</div>
            <div className="file-card-info">
              <div className="file-card-name">{files.transcript.split('/').pop()}</div>
              <div className="file-card-meta">
                Transcript available • Generated with timestamps and speaker IDs
              </div>
            </div>
            <span className="file-card-badge" style={{background: 'rgba(36, 161, 72, 0.1)', color: 'var(--ibm-green)'}}>Ready for summary</span>
          </div>

          {/* Summary Type Options */}
          <div className="transcript-options-grid">
            <label className={`transcript-option-card ${summaryType === 'standard' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="summaryType"
                value="standard"
                checked={summaryType === 'standard'}
                onChange={(e) => setSummaryType(e.target.value)}
              />
              <div className="option-card-content">
                <div className="option-card-header">
                  <span className="option-card-icon">📋</span>
                  <span className="option-card-title">Standard summary</span>
                </div>
                <p className="option-card-description">
                  A concise bulleted recap with key points and actions.
                </p>
              </div>
            </label>

            <label className={`transcript-option-card ${summaryType === 'structured' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="summaryType"
                value="structured"
                checked={summaryType === 'structured'}
                onChange={(e) => setSummaryType(e.target.value)}
              />
              <div className="option-card-content">
                <div className="option-card-header">
                  <span className="option-card-icon">📊</span>
                  <span className="option-card-title">Structured summary</span>
                  <span className="info-badge">ⓘ</span>
                </div>
                <p className="option-card-description">
                  Build a custom format based on sections selected below.
                </p>
              </div>
            </label>
          </div>

          {/* Structured Sections Checkboxes */}
          <div className="transcript-features">
            <label className="feature-checkbox">
              <input
                type="checkbox"
                checked={structuredSections.attendees}
                onChange={(e) => setStructuredSections({...structuredSections, attendees: e.target.checked})}
                disabled={summaryType === 'standard'}
              />
              <div className="feature-content">
                <div className="feature-title">Attendees</div>
                <div className="feature-description">Who was present and how often they contributed.</div>
              </div>
            </label>

            <label className="feature-checkbox">
              <input
                type="checkbox"
                checked={structuredSections.purpose}
                onChange={(e) => setStructuredSections({...structuredSections, purpose: e.target.checked})}
                disabled={summaryType === 'standard'}
              />
              <div className="feature-content">
                <div className="feature-title">Main purpose</div>
                <div className="feature-description">The core objective of the meeting.</div>
              </div>
            </label>

            <label className="feature-checkbox">
              <input
                type="checkbox"
                checked={structuredSections.actionItems}
                onChange={(e) => setStructuredSections({...structuredSections, actionItems: e.target.checked})}
                disabled={summaryType === 'standard'}
              />
              <div className="feature-content">
                <div className="feature-title">Action items</div>
                <div className="feature-description">Tasks, owners, and due dates.</div>
              </div>
            </label>

            <label className="feature-checkbox">
              <input
                type="checkbox"
                checked={structuredSections.risks}
                onChange={(e) => setStructuredSections({...structuredSections, risks: e.target.checked})}
                disabled={summaryType === 'standard'}
              />
              <div className="feature-content">
                <div className="feature-title">Risks & blockers</div>
                <div className="feature-description">Known concerns that need follow-up.</div>
              </div>
            </label>

            <label className="feature-checkbox">
              <input
                type="checkbox"
                checked={structuredSections.questions}
                onChange={(e) => setStructuredSections({...structuredSections, questions: e.target.checked})}
                disabled={summaryType === 'standard'}
              />
              <div className="feature-content">
                <div className="feature-title">Open questions</div>
                <div className="feature-description">Unresolved points requiring clarification.</div>
              </div>
            </label>
          </div>

          {/* Progress Section */}
          {summarizeJob && (
            <div className="transcription-progress-section">
              <div className="progress-section-header">
                <span className="progress-section-title">Summary progress</span>
                <span className="progress-section-percent">{summarizeJob.percent || 0}%</span>
              </div>
              <div className="progress-section-bar">
                <div className="progress-section-fill" style={{ width: `${summarizeJob.percent || 0}%` }} />
              </div>
              <p className="progress-section-message">
                {summarizeJob.status === 'done' && summarizeJob.percent === 100
                  ? `Summary generated successfully with ${summarizeJob.result?.actionItemsCount || 0} action items and ${summarizeJob.result?.openQuestionsCount || 0} open questions.`
                  : summarizeJob.message || 'Generating your summary...'}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="transcribe-actions">
            {files.summary ? (
              <>
                <button
                  className="btn-primary-large"
                  onClick={() => window.open('/api/download/summary', '_blank')}
                >
                  Download summary PDF
                </button>
                <button
                  className="btn-secondary-large"
                  onClick={() => setActiveTab('analytics')}
                >
                  Continue to Analytics
                </button>
              </>
            ) : (
              <button
                className="btn-primary-large"
                onClick={executeSummarization}
                disabled={busy || !files.transcript}
              >
                {busy ? 'Generating summary...' : 'Start summarization'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Coming Soon Tab Component
function ComingSoonTab({ title, description }) {
  return (
    <div className="coming-soon-tab">
      <div className="coming-soon-icon">🚀</div>
      <h1 className="coming-soon-title">{title}</h1>
      <p className="coming-soon-description">{description}</p>
      <div className="coming-soon-badge">Coming Soon</div>
    </div>
  );
}

// Helper function
function getTimeAgo(isoString) {
  const now = new Date();
  const past = new Date(isoString);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

// Made with Bob
