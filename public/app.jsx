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
    name: 'Jordan Lee',
    email: 'jordan.lee@ibm.com',
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
    redactWords: ''
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

      {/* Tab Navigation */}
      <nav className="tab-navigation">
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
function HomeTab({ searchQuery, setSearchQuery, filteredFiles, setActiveTab }) {
  return (
    <div className="home-tab">
      <div className="home-header">
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

      {files.audio && (
        <div className="upload-success">
          <div className="success-icon">✓</div>
          <div className="success-text">
            <div className="success-title">File uploaded successfully</div>
            <div className="success-filename">{files.audio.split('/').pop()}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Transcribe Tab Component
function TranscribeTab({ files, busy, transcribeJob, setTranscribeJob, transcriptType, setTranscriptType, transcriptOptions, setTranscriptOptions, setBusy, refresh }) {
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
      if (transcriptOptions.redactWords.trim()) {
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

  return (
    <div className="transcribe-tab">
      <h1 className="tab-title">Transcribe transcript</h1>
      <p className="tab-subtitle">A summary generation view with standard and structured modes plus selectable summary sections.</p>

      {files.audio && (
        <div className="file-ready-card">
          <div className="file-icon">🎧</div>
          <div className="file-info">
            <div className="file-name">{files.audio.split('/').pop()}</div>
            <div className="file-status-text">Audio file ready • Click transcribe to generate transcript</div>
          </div>
          {files.transcript && <span className="badge badge-success">Transcript ✓</span>}
        </div>
      )}

      {!files.audio && (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <h3>No audio file uploaded</h3>
          <p>Please upload an audio file first to generate a transcript</p>
        </div>
      )}

      {files.audio && !transcribeJob && (
        <button 
          className="btn-primary btn-large"
          onClick={handleTranscribe}
          disabled={busy || !files.audio}
        >
          📝 Transcribe Audio
        </button>
      )}

      {transcribeJob && (
        <div className="progress-card">
          <div className="progress-header">
            <span className="progress-label">Transcription</span>
            <span className="progress-percent">{transcribeJob.percent || 0}%</span>
          </div>
          <div className="progress-message">
            {transcribeJob.status === 'done' && transcribeJob.percent === 100
              ? "Transcription complete. Please click 'Transcript PDF' to download and view the meeting transcript."
              : transcribeJob.message}
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${transcribeJob.percent || 0}%` }} />
          </div>
        </div>
      )}

      {files.transcript && (
        <div className="download-section">
          <button 
            className="btn-secondary"
            onClick={() => window.open('/api/download/transcript', '_blank')}
          >
            📄 Download Transcript PDF
          </button>
        </div>
      )}

      {/* Transcription Options Modal */}
      {showOptions && (
        <div className="modal-overlay" onClick={() => setShowOptions(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Transcription Options</h2>
              <button className="modal-close" onClick={() => setShowOptions(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <p className="modal-description">Choose how you want your meeting to be transcribed:</p>
              
              <div className="option-cards">
                <label className="option-card">
                  <input
                    type="radio"
                    name="transcriptType"
                    value="standard"
                    checked={transcriptType === 'standard'}
                    onChange={(e) => setTranscriptType(e.target.value)}
                  />
                  <div className="option-content">
                    <div className="option-title">📝 Standard Transcript</div>
                    <div className="option-description">
                      A standard out-of-the-box text transcript of the meeting, line by line, with timestamps.
                    </div>
                  </div>
                </label>

                <label className="option-card">
                  <input
                    type="radio"
                    name="transcriptType"
                    value="custom"
                    checked={transcriptType === 'custom'}
                    onChange={(e) => setTranscriptType(e.target.value)}
                  />
                  <div className="option-content">
                    <div className="option-title">⚙️ Custom Transcript</div>
                    <div className="option-description">
                      Customize your transcript with specific options you select below.
                    </div>
                  </div>
                </label>
              </div>

              {transcriptType === 'custom' && (
                <div className="custom-options">
                  <h3>Select Options to Include:</h3>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={transcriptOptions.timestamps}
                        onChange={(e) => setTranscriptOptions({...transcriptOptions, timestamps: e.target.checked})}
                      />
                      <span>⏱️ Timestamps</span>
                    </label>
                    
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={transcriptOptions.speakerDiarization}
                        onChange={(e) => setTranscriptOptions({...transcriptOptions, speakerDiarization: e.target.checked})}
                      />
                      <span>👥 Speaker Diarization</span>
                    </label>
                    
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={transcriptOptions.pauses}
                        onChange={(e) => setTranscriptOptions({...transcriptOptions, pauses: e.target.checked})}
                      />
                      <span>⏸️ Pauses</span>
                    </label>
                  </div>
                  
                  <div className="input-group">
                    <label htmlFor="redactWords">
                      <span>🔒 Redact Words/Phrases (comma-separated):</span>
                    </label>
                    <input
                      id="redactWords"
                      type="text"
                      className="text-input"
                      placeholder="e.g., confidential, password, secret"
                      value={transcriptOptions.redactWords}
                      onChange={(e) => setTranscriptOptions({...transcriptOptions, redactWords: e.target.value})}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowOptions(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={executeTranscription}>
                Generate Transcript
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Summarize Tab Component  
function SummarizeTab({ files, busy, summarizeJob, setSummarizeJob, summaryType, setSummaryType, structuredSections, setStructuredSections, setBusy, refresh }) {
  const [showOptions, setShowOptions] = useState(false);

  const handleSummarize = () => {
    setShowOptions(true);
  };

  const executeSummarization = async () => {
    setShowOptions(false);
    
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
      <h1 className="tab-title">Summarize transcript</h1>
      <p className="tab-subtitle">A summary generation view with standard and structured modes plus selectable summary sections.</p>

      {files.transcript && (
        <div className="file-ready-card">
          <div className="file-icon">📝</div>
          <div className="file-info">
            <div className="file-name">{files.transcript.split('/').pop()}</div>
            <div className="file-status-text">Transcript available • Generated with timestamps and speaker IDs</div>
          </div>
          <span className="badge badge-success">Ready for summary</span>
        </div>
      )}

      {!files.transcript && (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>No transcript available</h3>
          <p>Please transcribe an audio file first to generate a summary</p>
        </div>
      )}

      {files.transcript && !summarizeJob && (
        <button 
          className="btn-primary btn-large"
          onClick={handleSummarize}
          disabled={busy || !files.transcript}
        >
          📊 Summarize Transcript
        </button>
      )}

      {summarizeJob && (
        <div className="progress-card">
          <div className="progress-header">
            <span className="progress-label">Summarization</span>
            <span className="progress-percent">{summarizeJob.percent || 0}%</span>
          </div>
          <div className="progress-message">
            {summarizeJob.status === 'done' && summarizeJob.percent === 100
              ? "Summarization complete. Please click 'Summary PDF' to download and view the meeting summary."
              : summarizeJob.message}
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${summarizeJob.percent || 0}%` }} />
          </div>
        </div>
      )}

      {files.summary && (
        <div className="download-section">
          <button 
            className="btn-secondary"
            onClick={() => window.open('/api/download/summary', '_blank')}
          >
            📋 Download Summary PDF
          </button>
        </div>
      )}

      {/* Summarization Options Modal */}
      {showOptions && (
        <div className="modal-overlay" onClick={() => setShowOptions(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Summarization Options</h2>
              <button className="modal-close" onClick={() => setShowOptions(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <p className="modal-description">Choose how you want your meeting to be summarized:</p>
              
              <div className="option-cards">
                <label className="option-card">
                  <input
                    type="radio"
                    name="summaryType"
                    value="standard"
                    checked={summaryType === 'standard'}
                    onChange={(e) => setSummaryType(e.target.value)}
                  />
                  <div className="option-content">
                    <div className="option-title">📝 Standard Summary</div>
                    <div className="option-description">
                      A brief, out of the box bulleted list of all key points and actions discussed in the meeting.
                    </div>
                  </div>
                </label>

                <label className="option-card">
                  <input
                    type="radio"
                    name="summaryType"
                    value="structured"
                    checked={summaryType === 'structured'}
                    onChange={(e) => setSummaryType(e.target.value)}
                  />
                  <div className="option-content">
                    <div className="option-title">📋 Structured Summary</div>
                    <div className="option-description">
                      Get a customized summary with specific sections you select below.
                    </div>
                  </div>
                </label>
              </div>

              {summaryType === 'structured' && (
                <div className="custom-options">
                  <h3>Select Sections to Include:</h3>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={structuredSections.attendees}
                        onChange={(e) => setStructuredSections({...structuredSections, attendees: e.target.checked})}
                      />
                      <span>👥 Attendees</span>
                    </label>
                    
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={structuredSections.purpose}
                        onChange={(e) => setStructuredSections({...structuredSections, purpose: e.target.checked})}
                      />
                      <span>🎯 Main Purpose</span>
                    </label>
                    
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={structuredSections.actionItems}
                        onChange={(e) => setStructuredSections({...structuredSections, actionItems: e.target.checked})}
                      />
                      <span>✅ Action Items</span>
                    </label>
                    
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={structuredSections.risks}
                        onChange={(e) => setStructuredSections({...structuredSections, risks: e.target.checked})}
                      />
                      <span>⚠️ Risks & Blockers</span>
                    </label>
                    
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={structuredSections.questions}
                        onChange={(e) => setStructuredSections({...structuredSections, questions: e.target.checked})}
                      />
                      <span>❓ Open Questions</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowOptions(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={executeSummarization}>
                Generate Summary
              </button>
            </div>
          </div>
        </div>
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
