const { useEffect, useState } = React;

function App() {
  const [currentPage, setCurrentPage] = useState('consent'); // consent, onboarding, main
  const [consentGiven, setConsentGiven] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage or system preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  
  // Main app state
  const [status, setStatus] = useState('Loading...');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [files, setFiles] = useState({ audio: null, transcript: null, summary: null });
  const [log, setLog] = useState('Ready.');
  const [models, setModels] = useState({ transcription: {}, summarization: {} });
  const [transcribeJob, setTranscribeJob] = useState(null);
  const [summarizeJob, setSummarizeJob] = useState(null);
  
  // Transcription options dialog state
  const [showTranscriptOptionsDialog, setShowTranscriptOptionsDialog] = useState(false);
  const [transcriptType, setTranscriptType] = useState('standard'); // 'standard' or 'custom'
  const [transcriptOptions, setTranscriptOptions] = useState({
    timestamps: true,
    speakerDiarization: false,
    pauses: false,
    redactWords: ''
  });
  
  // Summarization options dialog state
  const [showSummaryOptionsDialog, setShowSummaryOptionsDialog] = useState(false);
  const [summaryType, setSummaryType] = useState('standard'); // 'standard' or 'structured'
  const [structuredSections, setStructuredSections] = useState({
    attendees: true,
    purpose: true,
    actionItems: true,
    risks: true,
    questions: true
  });

  const refresh = async () => {
    // Add cache-busting parameter to prevent browser caching
    const r = await fetch(`/api/status?t=${Date.now()}`);
    const j = await r.json();
    const isRec = !!j.recording?.isRecording;
    const isStopping = !!j.recording?.isStopping;
    setRecording(isRec);
    setStopping(isStopping);
    
    // Normalize files object - ensure null values for missing files
    const normalizedFiles = {
      audio: j.files?.audio || null,
      transcript: j.files?.transcript || null,
      summary: j.files?.summary || null
    };
    setFiles(normalizedFiles);
    
    setModels(j.models || { transcription: {}, summarization: {} });
    setStatus(isStopping ? 'Stopping recording...' : isRec ? 'Recording in progress' : 'Idle');
  };

  // Apply dark mode class to body
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);
  
  // Toggle dark mode function
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };
  
  useEffect(() => {
    if (currentPage === 'main') {
      refresh();
    }
  }, [currentPage]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only on main page and when not in an input field
      if (currentPage !== 'main' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Ctrl+U or Cmd+U: Upload
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        if (!busy && !recording) {
          document.getElementById('audio-upload').click();
        }
      }
      
      // Ctrl+T or Cmd+T: Transcribe
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        if (!busy && files.audio && !recording && !stopping && (!transcribeJob || transcribeJob.status !== 'running')) {
          handleTranscribe();
        }
      }
      
      // Ctrl+S or Cmd+S: Summarize
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!busy && files.transcript && !recording && !stopping && (!summarizeJob || summarizeJob.status !== 'running')) {
          handleSummarize();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, busy, recording, stopping, files, transcribeJob, summarizeJob]);

  const call = async (url, method = 'POST', body) => {
    try {
      setBusy(true);
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'Request failed');
      setLog(JSON.stringify(j, null, 2));
      return j;
    } catch (e) {
      setLog(`Error: ${e.message}`);
      throw e;
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

  const uploadFile = async (file) => {
    if (!file) return;
    
    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/wave'];
    const validExtensions = ['.mp3', '.m4a', '.wav'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      setLog(`Invalid file type. Please upload MP3, M4A, or WAV files.`);
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
      setLog(`File uploaded: ${file.name}`);
      
      // Small delay to ensure metadata is written
      await new Promise(resolve => setTimeout(resolve, 100));
      await refresh();
    } catch (e) {
      setLog(`Upload error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    await uploadFile(file);
    // Clear the file input so the same file can be uploaded again
    event.target.value = '';
  };
  
  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!busy && !recording) {
      setIsDragging(true);
    }
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if leaving the main drop zone
    if (e.target.classList.contains('drop-zone')) {
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
    
    if (busy || recording) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const handleTranscribe = async () => {
    // Show transcription options dialog
    setShowTranscriptOptionsDialog(true);
  };

  const executeTranscription = async () => {
    // Close dialog immediately
    setShowTranscriptOptionsDialog(false);
    
    // Build transcript options based on user selection
    const options = {};
    if (transcriptType === 'custom') {
      options.timestamps = transcriptOptions.timestamps;
      options.speakerDiarization = transcriptOptions.speakerDiarization;
      options.pauses = transcriptOptions.pauses;
      if (transcriptOptions.redactWords.trim()) {
        options.redactWords = transcriptOptions.redactWords.split(',').map(w => w.trim()).filter(w => w);
      }
    } else {
      // Standard transcript always includes timestamps
      options.timestamps = true;
    }
    
    const j = await call('/api/transcribe', 'POST', { transcriptOptions: options });
    setTranscribeJob({ status: 'running', percent: 1, message: 'Starting...' });
    await pollJob(j.jobId, setTranscribeJob);
  };

  const handleSummarize = async () => {
    // Show summarization options dialog
    setShowSummaryOptionsDialog(true);
  };

  const handleClearSession = async () => {
    try {
      setBusy(true);
      const r = await fetch('/api/clear-session', { method: 'POST' });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'Failed to clear session');
      
      // Reset all UI state
      setFiles({ audio: null, transcript: null, summary: null });
      setTranscribeJob(null);
      setSummarizeJob(null);
      setLog('Session cleared. Ready for new meeting.');
      
      // Refresh to get updated status from server
      await refresh();
    } catch (e) {
      setLog(`Clear session error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const executeSummarization = async () => {
    // Close dialog immediately
    setShowSummaryOptionsDialog(false);
    
    // Build custom prompt based on user selection
    let customPrompt = '';
    if (summaryType === 'standard') {
      // Standard: brief bulleted list only, no sections
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
    
    const j = await call('/api/summarize', 'POST', {
      customPrompt: customPrompt || undefined
    });
    setSummarizeJob({ status: 'running', percent: 1, message: 'Starting...' });
    await pollJob(j.jobId, setSummarizeJob);
  };

  const getStatusClass = () => {
    if (stopping) return 'status';
    if (recording) return 'status recording';
    return 'status idle';
  };

  // Consent Page
  if (currentPage === 'consent') {
    return (
      <div className="container">
        <div className="header">
          <h1>
            <span className="ibm-logo">IBM</span>
            <span className="app-name">Recap</span>
          </h1>
        </div>
        <div className="consent-page">
          <div className="consent-card">
            <h2>Recording Consent & AI Analysis Agreement</h2>
            <div className="consent-content">
              <p>Before using IBM Recap, please confirm the following:</p>
              
              <div className="consent-section">
                <h3>Recording Consent</h3>
                <ul>
                  <li>You have obtained consent from all meeting participants to record the session</li>
                  <li>All parties are aware that the meeting will be recorded</li>
                  <li>Recording complies with your organization's policies and local laws</li>
                </ul>
              </div>

              <div className="consent-section">
                <h3>AI Analysis Agreement</h3>
                <ul>
                  <li>Meeting audio will be transcribed using AI services</li>
                  <li>Transcripts will be analyzed to generate meeting summaries</li>
                  <li>Data may be processed by third-party AI providers (OpenAI, IBM Watson)</li>
                  <li>You are responsible for ensuring sensitive information is handled appropriately</li>
                </ul>
              </div>

              <div className="consent-section">
                <h3>Data Privacy</h3>
                <ul>
                  <li>All recordings and transcripts are stored locally on your device</li>
                  <li>Audio data is sent to AI services only for transcription/summarization</li>
                  <li>You are responsible for managing and securing generated files</li>
                </ul>
              </div>

              <div className="consent-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                  />
                  <span>I confirm that I have obtained consent from all participants and agree to the terms above</span>
                </label>
              </div>

              <div style={{ marginTop: '24px' }}>
                <button
                  className="primary"
                  disabled={!consentGiven}
                  onClick={() => setCurrentPage('onboarding')}
                >
                  Continue to Setup
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Onboarding Page
  if (currentPage === 'onboarding') {
    return (
      <div className="container">
        <div className="header">
          <h1>
            <span className="ibm-logo">IBM</span>
            <span className="app-name">Recap</span>
          </h1>
        </div>
        <div className="onboarding-page">
          <div className="onboarding-card">
            <h2>Setup Instructions</h2>
            <div className="onboarding-content">
              <p className="intro">Before using IBM Recap, please complete the following prerequisites:</p>

              <div className="setup-step">
                <div className="step-content">
                  <h3>1) Install Required Software</h3>
                  <ul>
                    <li><strong>FFmpeg:</strong> Audio processing tool</li>
                    <li><strong>BlackHole 2ch:</strong> Virtual audio loopback device</li>
                  </ul>
                  <code>brew install ffmpeg blackhole-2ch</code>
                </div>
              </div>

              <div className="setup-step">
                <div className="step-content">
                  <h3>2) Configure Audio Routing</h3>
                  <ol>
                    <li>Open <strong>Audio MIDI Setup</strong> (Applications → Utilities)</li>
                    <li>Click the <strong>+</strong> button and select <strong>"Create Multi-Output Device"</strong></li>
                    <li>Check both:
                      <ul>
                        <li>Your speakers/headphones (to hear audio)</li>
                        <li><strong>BlackHole 2ch</strong> (to capture audio)</li>
                      </ul>
                    </li>
                    <li>Set your Teams/conferencing app to use this Multi-Output Device</li>
                  </ol>
                </div>
              </div>

              <div className="completion-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={onboardingComplete}
                    onChange={(e) => setOnboardingComplete(e.target.checked)}
                  />
                  <span>I have completed all prerequisites and I'm ready to use IBM Recap</span>
                </label>
              </div>

              <div className="button-group" style={{ marginTop: '24px' }}>
                <button 
                  className="secondary"
                  onClick={() => setCurrentPage('consent')}
                >
                  ← Back
                </button>
                <button 
                  className="primary"
                  disabled={!onboardingComplete}
                  onClick={() => setCurrentPage('main')}
                >
                  Start Using IBM Recap →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main App Page
  return (
    <div className="container">
      <div className="header">
        <h1>
          <span className="ibm-logo">IBM</span>
          <span className="app-name">Recap</span>
        </h1>
        <div className="header-spacer"></div>
        <button
          className="theme-toggle"
          onClick={toggleDarkMode}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <div className="main-content">
        {/* Model Status Bar */}
        <div className="model-status-bar">
          <div className="status-section">
            <div className="status-label">Status:</div>
            <div className={getStatusClass()}>
              {status}
            </div>
          </div>
          
          <div className="status-section">
            <div className="status-label">Transcription:</div>
            <div className="status-value">
              {models.transcription?.active || 'Loading...'}
              {models.transcription?.fallback && (
                <span className="fallback-indicator" title={`Fallback: ${models.transcription.fallback}`}>
                  ⚡
                </span>
              )}
            </div>
          </div>
          
          <div className="status-section">
            <div className="status-label">Summarization:</div>
            <div className="status-value">
              {models.summarization?.active || 'Loading...'}
              {models.summarization?.fallback && (
                <span className="fallback-indicator" title={`Fallback: ${models.summarization.fallback}`}>
                  ⚡
                </span>
              )}
            </div>
          </div>
          
          <div className="status-section">
            <div className="status-label">Files:</div>
            <div className="status-value">
              <span className={files.audio ? 'file-ready' : 'file-missing'}>Audio {files.audio ? '✓' : '✗'}</span>
              <span className={files.transcript ? 'file-ready' : 'file-missing'}>Transcript {files.transcript ? '✓' : '✗'}</span>
              <span className={files.summary ? 'file-ready' : 'file-missing'}>Summary {files.summary ? '✓' : '✗'}</span>
            </div>
            <button
              className="refresh-button"
              onClick={handleClearSession}
              disabled={busy}
              title="Refresh file status"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Main Panel */}
        <div className="main-panel">
          <div className="panel-header">
            <h2>Meeting Recording & Analysis</h2>
            <p className="panel-subtitle">Record/Upload, Transcribe and Summarize your meetings</p>
          </div>

          <div className="panel-content">
            {/* Recording Controls */}
            <div className="card">
              <h3>Audio Input</h3>
              <div className="button-group">
                <div
                  className={`upload-drop-zone ${isDragging ? 'dragging' : ''}`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {isDragging && (
                    <div className="drop-overlay-button">
                      <div className="drop-message-button">
                        📁 Drop here
                      </div>
                    </div>
                  )}
                  <button
                    className="secondary"
                    onClick={() => document.getElementById('audio-upload').click()}
                    disabled={busy || recording}
                  >
                    📁 Upload Audio
                  </button>
                </div>
                <input
                  id="audio-upload"
                  type="file"
                  accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/wave"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  className="primary"
                  disabled={busy || recording || stopping}
                  onClick={() => call('/api/record/start')}
                >
                  ● Start Recording
                </button>
                <button
                  className="danger"
                  disabled={busy || !recording || stopping}
                  onClick={() => call('/api/record/stop')}
                >
                  ■ Stop Recording
                </button>
              </div>
            </div>

            {/* Processing Controls */}
            <div className="card">
              <h3>AI Processing</h3>
              <div className="button-group">
                <button
                  className="primary"
                  disabled={busy || !files.audio || recording || stopping || (transcribeJob && transcribeJob.status === 'running')}
                  onClick={handleTranscribe}
                >
                  📝 Transcribe Audio
                </button>
                <button
                  className="primary"
                  disabled={busy || !files.transcript || recording || stopping || (summarizeJob && summarizeJob.status === 'running')}
                  onClick={handleSummarize}
                >
                  📊 Summarize Transcript
                </button>
              </div>

              {/* Progress Indicators */}
              {(transcribeJob || summarizeJob) && (
                <div className="progress-section">
                  {transcribeJob && (
                    <div className="progress-item">
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
                  {summarizeJob && (
                    <div className="progress-item">
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
                </div>
              )}
            </div>

            {/* Download Section */}
            <div className="card">
              <h3>Download Files</h3>
              <div className="download-grid">
                <button
                  className="secondary"
                  disabled={!files.audio}
                  onClick={() => window.open('/api/download/audio', '_blank')}
                >
                  🎵 Audio File
                </button>
                <button 
                  className="secondary" 
                  disabled={!files.transcript} 
                  onClick={() => window.open('/api/download/transcript', '_blank')}
                >
                  📄 Transcript PDF
                </button>
                <button 
                  className="secondary" 
                  disabled={!files.summary} 
                  onClick={() => window.open('/api/download/summary', '_blank')}
                >
                  📋 Summary PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Transcription Options Dialog */}
        {showTranscriptOptionsDialog && (
          <div className="modal-overlay" onClick={() => setShowTranscriptOptionsDialog(false)}>
            <div className="modal-content summary-options-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Transcription Options</h2>
                <button className="modal-close" onClick={() => setShowTranscriptOptionsDialog(false)}>×</button>
              </div>
              
              <div className="modal-body">
                <p className="modal-description">Choose how you want your meeting to be transcribed:</p>
                
                <div className="summary-type-options">
                  <label className="summary-type-option">
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

                  <label className="summary-type-option">
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
                  <div className="structured-sections">
                    <h3>Select Options to Include:</h3>
                    <div className="section-checkboxes">
                      <label className="section-checkbox">
                        <input
                          type="checkbox"
                          checked={transcriptOptions.timestamps}
                          onChange={(e) => setTranscriptOptions({...transcriptOptions, timestamps: e.target.checked})}
                        />
                        <span>⏱️ Timestamps</span>
                      </label>
                      
                      <label className="section-checkbox">
                        <input
                          type="checkbox"
                          checked={transcriptOptions.speakerDiarization}
                          onChange={(e) => setTranscriptOptions({...transcriptOptions, speakerDiarization: e.target.checked})}
                        />
                        <span>👥 Speaker Diarization</span>
                      </label>
                      
                      <label className="section-checkbox">
                        <input
                          type="checkbox"
                          checked={transcriptOptions.pauses}
                          onChange={(e) => setTranscriptOptions({...transcriptOptions, pauses: e.target.checked})}
                        />
                        <span>⏸️ Pauses</span>
                      </label>
                    </div>
                    
                    <div className="redact-words-section">
                      <label htmlFor="redactWords">
                        <span>🔒 Redact Words/Phrases (comma-separated):</span>
                      </label>
                      <input
                        id="redactWords"
                        type="text"
                        className="redact-input"
                        placeholder="e.g., confidential, password, secret"
                        value={transcriptOptions.redactWords}
                        onChange={(e) => setTranscriptOptions({...transcriptOptions, redactWords: e.target.value})}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="secondary" onClick={() => setShowTranscriptOptionsDialog(false)}>
                  Cancel
                </button>
                <button className="primary" onClick={executeTranscription}>
                  Generate Transcript
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summarization Options Dialog */}
        {showSummaryOptionsDialog && (
          <div className="modal-overlay" onClick={() => setShowSummaryOptionsDialog(false)}>
            <div className="modal-content summary-options-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Summarization Options</h2>
                <button className="modal-close" onClick={() => setShowSummaryOptionsDialog(false)}>×</button>
              </div>
              
              <div className="modal-body">
                <p className="modal-description">Choose how you want your meeting to be summarized:</p>
                
                <div className="summary-type-options">
                  <label className="summary-type-option">
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

                  <label className="summary-type-option">
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
                  <div className="structured-sections">
                    <h3>Select Sections to Include:</h3>
                    <div className="section-checkboxes">
                      <label className="section-checkbox">
                        <input
                          type="checkbox"
                          checked={structuredSections.attendees}
                          onChange={(e) => setStructuredSections({...structuredSections, attendees: e.target.checked})}
                        />
                        <span>👥 Attendees</span>
                      </label>
                      
                      <label className="section-checkbox">
                        <input
                          type="checkbox"
                          checked={structuredSections.purpose}
                          onChange={(e) => setStructuredSections({...structuredSections, purpose: e.target.checked})}
                        />
                        <span>🎯 Main Purpose</span>
                      </label>
                      
                      <label className="section-checkbox">
                        <input
                          type="checkbox"
                          checked={structuredSections.actionItems}
                          onChange={(e) => setStructuredSections({...structuredSections, actionItems: e.target.checked})}
                        />
                        <span>✅ Action Items</span>
                      </label>
                      
                      <label className="section-checkbox">
                        <input
                          type="checkbox"
                          checked={structuredSections.risks}
                          onChange={(e) => setStructuredSections({...structuredSections, risks: e.target.checked})}
                        />
                        <span>⚠️ Risks & Blockers</span>
                      </label>
                      
                      <label className="section-checkbox">
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
                <button className="secondary" onClick={() => setShowSummaryOptionsDialog(false)}>
                  Cancel
                </button>
                <button className="primary" onClick={executeSummarization}>
                  Generate Summary
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

// Made with Bob
