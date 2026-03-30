const { useEffect, useState } = React;

function MainApp() {
  // Get auth context
  const { user, logout, token } = useAuth();
  
  // Active tab state
  const [activeTab, setActiveTab] = useState('home');
  
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [homeDateFilter, setHomeDateFilter] = useState('all');
  
  const [accountFiles, setAccountFiles] = useState([]);
  const [accountMeetings, setAccountMeetings] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [accountProfile, setAccountProfile] = useState(null);
  const [storageUsage, setStorageUsage] = useState(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [selectedMeetingContext, setSelectedMeetingContext] = useState(null);
  
  // Main app state (from original)
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [files, setFiles] = useState({ meetingId: null, audio: null, transcript: null, summary: null });
  const [transcribeJob, setTranscribeJob] = useState(null);
  const [summarizeJob, setSummarizeJob] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
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

  useEffect(() => {
    if (!accountProfile) return;

    setTranscriptType(accountProfile.defaultTranscriptType || 'standard');
    setTranscriptOptions((current) => ({
      ...current,
      speakerDiarization: Boolean(accountProfile.defaultSpeakerDiarization)
    }));
    setSummaryType(accountProfile.defaultSummaryType || 'standard');
  }, [
    accountProfile?.defaultTranscriptType,
    accountProfile?.defaultSpeakerDiarization,
    accountProfile?.defaultSummaryType
  ]);

  // Apply dark mode
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);
  
  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu && !event.target.closest('.user-menu')) {
        setShowUserMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };
  
  const refresh = async () => {
    if (token) {
      setHistoryLoading(true);
      setAccountLoading(true);
    }

    try {
      const requests = [
        fetch(`/api/status?t=${Date.now()}`)
      ];

      if (token) {
        requests.push(fetch('/api/meetings', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }));
        requests.push(fetch('/api/files', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }));
        requests.push(fetch('/api/auth/account', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }));
      }

      const responses = await Promise.all(requests);
      const statusResponse = responses[0];
      const statusJson = await statusResponse.json();

      const isRec = !!statusJson.recording?.isRecording;
      const isStopping = !!statusJson.recording?.isStopping;
      setRecording(isRec);
      setStopping(isStopping);

      const normalizedFiles = {
        meetingId: statusJson.files?.meetingId || null,
        audio: statusJson.files?.audio || null,
        originalFilename: statusJson.files?.originalFilename || null,
        transcript: statusJson.files?.transcript || null,
        summary: statusJson.files?.summary || null
      };
      setFiles(normalizedFiles);

      if (token && responses[1]) {
        const meetingsResponse = responses[1];
        const meetingsJson = await meetingsResponse.json();
        if (meetingsResponse.ok && meetingsJson.ok) {
          setAccountMeetings(meetingsJson.meetings || []);
        } else {
          console.error('Failed to load account meetings:', meetingsJson.error);
          setAccountMeetings([]);
        }
      }

      if (token && responses[2]) {
        const filesResponse = responses[2];
        const filesJson = await filesResponse.json();
        if (filesResponse.ok && filesJson.ok) {
          setAccountFiles(filesJson.files || []);
        } else {
          console.error('Failed to load account file history:', filesJson.error);
          setAccountFiles([]);
        }
      }

      if (token && responses[3]) {
        const accountResponse = responses[3];
        const accountJson = await accountResponse.json();
        if (accountResponse.ok) {
          setAccountProfile(accountJson.user || null);
          setStorageUsage(accountJson.storage || null);
        } else {
          console.error('Failed to load account profile:', accountJson.error);
          setAccountProfile(null);
          setStorageUsage(null);
        }
      }
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setHistoryLoading(false);
      setAccountLoading(false);
    }
  };
  
  useEffect(() => {
    refresh();
  }, [token]);

  const historyEntries = buildHistoryEntries(accountFiles);
  const meetingEntries = buildMeetingEntries(accountMeetings);
  const activeMeetingContext = meetingEntries.find((meeting) => meeting.id === files.meetingId) || selectedMeetingContext || null;

  // Filter files based on search
  const filteredMeetings = meetingEntries.filter(file => {
    const query = searchQuery.toLowerCase().trim();
    const searchableFields = [
      file.filename,
      file.displayDate,
      file.statusLabel,
      file.fileTypeLabel,
      ...(file.relatedOutputs || []),
      ...(file.infoChips || [])
    ].filter(Boolean).join(' ').toLowerCase();

    const matchesSearch = !query || searchableFields.includes(query);
    return matchesSearch && matchesDateFilter(file.uploadedAt, homeDateFilter);
  });

  // Tab navigation
  const tabs = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'meetings', label: 'Meetings', icon: '📅' },
    { id: 'upload', label: 'Upload', icon: '📤' },
    { id: 'transcribe', label: 'Transcribe', icon: '📝' },
    { id: 'summarize', label: 'Summarize', icon: '📊' },
    { id: 'analytics', label: 'Ask Recap', icon: '💬', disabled: true }
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
            <button className="user-button" onClick={() => setShowUserMenu(!showUserMenu)}>
              <span className="user-indicator"></span>
              {user.full_name || user.email} ▼
            </button>
            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-dropdown-header">
                  <div className="user-dropdown-name">{user.full_name}</div>
                  <div className="user-dropdown-email">{user.email}</div>
                </div>
                <div className="user-dropdown-divider"></div>
                <button className="user-dropdown-item" onClick={() => { setActiveTab('account'); setShowUserMenu(false); }}>
                  <span>👤</span> Account settings
                </button>
                <button className="user-dropdown-item" onClick={logout}>
                  <span>🚪</span> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {activeTab !== 'account' && (
        <>
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
                    Preview Ask Recap
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
                  <source src="https://mlivtijnumtedtqplnnj.supabase.co/storage/v1/object/public/videos/IBM%20Recap%20demo.mp4" type="video/mp4" />
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
        </>
      )}

      {/* Main Content Area */}
      <main className="main-content-area">
        {activeTab === 'home' && <HomeTab
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          homeDateFilter={homeDateFilter}
          setHomeDateFilter={setHomeDateFilter}
          filteredMeetings={filteredMeetings}
          meetingEntries={meetingEntries}
          historyEntries={historyEntries}
          historyLoading={historyLoading}
          setActiveTab={setActiveTab}
          refresh={refresh}
          homeDashboardRef={homeDashboardRef}
        />}
        
        {activeTab === 'upload' && <UploadTab
          files={files}
          busy={busy}
          setBusy={setBusy}
          refresh={refresh}
          setActiveTab={setActiveTab}
          meetingEntries={meetingEntries}
          selectedMeetingContext={selectedMeetingContext}
          onSelectMeetingContext={setSelectedMeetingContext}
          clearSelectedMeetingContext={() => setSelectedMeetingContext(null)}
        />}

        {activeTab === 'meetings' && <MeetingsTab
          meetingEntries={meetingEntries}
          historyLoading={historyLoading}
          setActiveTab={setActiveTab}
          onSelectMeetingContext={setSelectedMeetingContext}
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
          historyEntries={historyEntries}
          historyLoading={historyLoading}
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
          historyEntries={historyEntries}
          historyLoading={historyLoading}
          setBusy={setBusy}
          refresh={refresh}
          setActiveTab={setActiveTab}
          activeMeetingContext={activeMeetingContext}
        />}
        
        {activeTab === 'account' && <AccountTab
          accountProfile={accountProfile}
          storageUsage={storageUsage}
          accountLoading={accountLoading}
          onBack={() => setActiveTab('home')}
          refresh={refresh}
        />}
        
        {activeTab === 'analytics' && <AnalyticsTab />}
      </main>
    </div>
  );
}

// Home Tab Component
function HomeTab({ searchQuery, setSearchQuery, homeDateFilter, setHomeDateFilter, filteredMeetings, meetingEntries, historyEntries, historyLoading, setActiveTab, refresh, homeDashboardRef }) {
  const uploadedCount = meetingEntries.length;
  const pendingTranscriptCount = meetingEntries.filter((file) => file.processingStatus !== 'completed' && !file.hasTranscript).length;
  const summaryCount = meetingEntries.filter((file) => file.hasSummary).length;
  const recommendedFile = meetingEntries.find((file) => !file.hasTranscript) || meetingEntries.find((file) => file.hasTranscript && !file.hasSummary) || meetingEntries[0] || null;
  const [selectedMeetingId, setSelectedMeetingId] = React.useState(null);
  const [retryBusy, setRetryBusy] = React.useState(false);

  const selectedMeeting = meetingEntries.find((meeting) => meeting.id === selectedMeetingId) || null;
  const selectedMeetingArtifacts = historyEntries.filter((entry) => entry.meetingId === selectedMeetingId);
  const canRestoreTranscription = selectedMeetingArtifacts.some((entry) => entry.file_type === 'audio');
  const canRestoreSummary = selectedMeetingArtifacts.some((entry) => entry.file_type === 'transcript');

  const handleRetry = async (meeting, stage) => {
    try {
      setRetryBusy(true);
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch(`/api/meetings/${meeting.id}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ stage })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to prepare retry');
      }

      await refresh();
      setActiveTab(stage === 'summarize' ? 'summarize' : 'transcribe');
    } catch (error) {
      alert(error.message || 'Failed to prepare retry');
    } finally {
      setRetryBusy(false);
    }
  };

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
          <div className="stat-value">{uploadedCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending transcripts</div>
          <div className="stat-value">{pendingTranscriptCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Summaries generated</div>
          <div className="stat-value">{summaryCount}</div>
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
              {recommendedFile
                ? (recommendedFile.hasTranscript
                  ? <>Generate a summary for <span className="filename">{recommendedFile.filename}</span>.</>
                  : <>Transcribe <span className="filename">{recommendedFile.filename}</span> to unlock summary generation.</>)
                : 'Upload your first meeting recording to start building searchable history.'}
            </div>
          </div>
        </div>
        <button
          className="btn-primary"
          onClick={() => setActiveTab(recommendedFile?.hasTranscript ? 'summarize' : 'transcribe')}
        >
          Open tab
        </button>
      </div>

      {/* Search Bar */}
      <div className="search-section">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by filename, file type, output, or date"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <select
          className="filters-select"
          value={homeDateFilter}
          onChange={(e) => setHomeDateFilter(e.target.value)}
        >
          <option value="all">All dates</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="year">This year</option>
        </select>
      </div>

      {/* Recent Files */}
        <div className="files-section">
        <h2 className="section-title">Recent meetings</h2>
        <div className="files-list">
          {historyLoading ? (
            <div className="file-card">
              <div className="file-info">
                <div className="file-name">Loading your account history...</div>
                <div className="file-meta">Fetching uploads, transcripts, and summaries for your account.</div>
              </div>
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="file-card">
              <div className="file-info">
                <div className="file-name">No matching meetings found</div>
                <div className="file-meta">Try a different keyword or upload your first meeting recording.</div>
              </div>
            </div>
          ) : filteredMeetings.map(file => (
            <div
              key={file.id}
              className="file-card clickable"
              role="button"
              tabIndex={0}
              onClick={() => setSelectedMeetingId(file.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedMeetingId(file.id);
                }
              }}
            >
              <div className="file-icon">
                {file.status === 'audio' && '🎧'}
                {file.status === 'transcript' && '📝'}
                {file.status === 'summary' && '📊'}
              </div>
              <div className="file-info">
                <div className="file-name">{file.filename}</div>
                <div className="file-meta">
                  Uploaded {getTimeAgo(file.uploadedAt)} ({file.displayDate}) • {file.fileTypeLabel}
                  {file.infoChips.length > 0 && ` • ${file.infoChips.join(' • ')}`}
                  {file.relatedOutputs.length > 0 && ` • Related outputs: ${file.relatedOutputs.join(', ')}`}
                </div>
                {file.statusNote && (
                  <div className={`file-card-status-note ${file.statusTone}`}>
                    {file.statusNote}
                  </div>
                )}
              </div>
              <div className="file-status">
                <span className={`badge ${file.statusBadgeClass}`}>{file.statusLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedMeeting && (
        <div className="meeting-detail-panel">
          <div className="meeting-detail-header">
            <div>
              <div className="meeting-detail-eyebrow">Meeting detail</div>
              <h2 className="meeting-detail-title">{selectedMeeting.filename}</h2>
              <p className="meeting-detail-copy">
                Uploaded {getTimeAgo(selectedMeeting.uploadedAt)} ({selectedMeeting.displayDate}) • {selectedMeeting.fileTypeLabel}
              </p>
            </div>
            <button className="meeting-detail-close" onClick={() => setSelectedMeetingId(null)}>
              Close
            </button>
          </div>

          <div className="meeting-detail-grid">
            <div className="meeting-detail-card">
              <div className="meeting-detail-label">Processing status</div>
              <div className="meeting-detail-value">{selectedMeeting.statusLabel}</div>
            </div>
            <div className="meeting-detail-card">
              <div className="meeting-detail-label">Outputs</div>
              <div className="meeting-detail-value">
                {selectedMeeting.relatedOutputs.length > 0 ? selectedMeeting.relatedOutputs.join(', ') : 'No outputs yet'}
              </div>
            </div>
          </div>

          {(selectedMeeting.organizerName || selectedMeeting.attendeeSummary || selectedMeeting.notes || selectedMeeting.externalMeetingUrl) && (
            <div className="meeting-detail-section">
              <div className="meeting-detail-section-title">Saved meeting context</div>
              <div className="meeting-detail-artifacts">
                {selectedMeeting.organizerName && (
                  <div className="meeting-detail-artifact">
                    <div className="meeting-detail-artifact-name">Organizer</div>
                    <div className="meeting-detail-artifact-meta">{selectedMeeting.organizerName}</div>
                  </div>
                )}
                {selectedMeeting.attendeeSummary && (
                  <div className="meeting-detail-artifact">
                    <div className="meeting-detail-artifact-name">Attendees</div>
                    <div className="meeting-detail-artifact-meta">{selectedMeeting.attendeeSummary}</div>
                  </div>
                )}
                {selectedMeeting.notes && (
                  <div className="meeting-detail-artifact">
                    <div className="meeting-detail-artifact-name">Notes</div>
                    <div className="meeting-detail-artifact-meta">{selectedMeeting.notes}</div>
                  </div>
                )}
                {selectedMeeting.externalMeetingUrl && (
                  <div className="meeting-detail-artifact">
                    <div className="meeting-detail-artifact-name">Meeting link</div>
                    <div className="meeting-detail-artifact-meta">{selectedMeeting.externalMeetingUrl}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedMeeting.processingError && (
            <div className="meeting-detail-error">
              <div className="meeting-detail-label">Last processing error</div>
              <div className="meeting-detail-error-copy">{selectedMeeting.processingError}</div>
            </div>
          )}

          <div className="meeting-detail-section">
            <div className="meeting-detail-section-title">Artifacts</div>
            <div className="meeting-detail-artifacts">
              {selectedMeetingArtifacts.length === 0 ? (
                <div className="meeting-detail-artifact-empty">No stored artifacts are linked to this meeting yet.</div>
              ) : selectedMeetingArtifacts.map((artifact) => (
                <div key={artifact.id} className="meeting-detail-artifact">
                  <div className="meeting-detail-artifact-name">{artifact.displayFilename}</div>
                  <div className="meeting-detail-artifact-meta">
                    {artifact.fileTypeLabel} • {artifact.statusLabel}
                    {artifact.infoChips.length > 0 && ` • ${artifact.infoChips.join(' • ')}`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="meeting-detail-section">
            <div className="meeting-detail-section-title">Recovery actions</div>
            <div className="meeting-detail-actions">
              <button
                className="btn-secondary-large"
                disabled={retryBusy || !canRestoreSummary}
                onClick={() => handleRetry(selectedMeeting, 'summarize')}
              >
                {retryBusy ? 'Preparing...' : 'Restore for summary retry'}
              </button>
              <button
                className="btn-primary-large"
                disabled={retryBusy || !canRestoreTranscription}
                onClick={() => handleRetry(selectedMeeting, 'transcribe')}
              >
                {retryBusy ? 'Preparing...' : 'Restore for transcription retry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Upload Tab Component
function UploadTab({ files, busy, setBusy, refresh, setActiveTab, meetingEntries, selectedMeetingContext, onSelectMeetingContext, clearSelectedMeetingContext }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState(null);
  const availableManualMeetings = (meetingEntries || []).filter((meeting) => meeting.sourceType === 'manual' && !meeting.archivedAt);

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
    
    const validTypes = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/wave', 'video/mp4'];
    const validExtensions = ['.mp3', '.m4a', '.wav', '.mp4'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      alert('Invalid file type. Please upload MP3, M4A, WAV, or MP4 files.');
      return;
    }
    
    const formData = new FormData();
    formData.append('audio', file);
    if (selectedMeetingContext?.id) {
      formData.append('meetingId', selectedMeetingContext.id);
    }
    
    try {
      setBusy(true);
      setUploadState({
        status: 'uploading',
        percent: 0,
        message: 'Uploading file...'
      });

      const result = await uploadWithProgress(formData, setUploadState);
      if (!result.ok) throw new Error(result.error || 'Upload failed');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      await refresh();
      setUploadState({
        status: 'done',
        percent: 100,
        message: result.message || 'Upload complete.'
      });
    } catch (e) {
      setUploadState({
        status: 'error',
        percent: 100,
        message: e.message
      });
      alert(`Upload error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const uploadWithProgress = (formData, setProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload-audio');

      const authToken = localStorage.getItem('auth_token');
      if (authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(Math.round((event.loaded / event.total) * 100), 99);
          setProgress({
            status: 'uploading',
            percent,
            message: `Uploading file... ${percent}%`
          });
        }
      };

      xhr.onload = () => {
        let responseData = null;
        try {
          responseData = JSON.parse(xhr.responseText);
        } catch (parseError) {
          reject(new Error('Upload failed with an unexpected response.'));
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          setProgress({
            status: 'processing',
            percent: 100,
            message: 'Upload complete. Processing media...'
          });
          resolve(responseData);
        } else {
          reject(new Error(responseData.error || 'Upload failed'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    await uploadFile(file);
    event.target.value = '';
  };
  const displayedAudio = files.audio
    ? {
        audioFile: files.audio,
        originalFilename: files.originalFilename
      }
    : null;

  return (
    <div className="upload-tab">
      <h1 className="tab-title">Upload audio file</h1>
      <p className="tab-subtitle">Upload meeting recordings in MP3, M4A, WAV, or MP4 format. MP4 videos are converted to MP3 automatically.</p>

      {!selectedMeetingContext && availableManualMeetings.length > 0 && (
        <div className="upload-meeting-selector">
          <div className="upload-meeting-selector-copy">
            <div className="upload-meeting-selector-label">Attach this upload to an existing meeting workspace</div>
            <div className="upload-meeting-selector-subtitle">
              If you forgot to start in Meetings, pick a saved manual workspace here so the upload, transcript, and summary stay connected.
            </div>
          </div>
          <select
            className="filters-select upload-meeting-selector-input"
            value={selectedMeetingContext?.id || ''}
            onChange={(event) => {
              const meeting = availableManualMeetings.find((entry) => entry.id === event.target.value);
              if (!meeting) return;
              onSelectMeetingContext({
                id: meeting.id,
                title: meeting.filename,
                start: meeting.meetingStartAt || meeting.uploadedAt,
                end: meeting.meetingStartAt || meeting.uploadedAt,
                organizer: meeting.organizerName || 'Organizer not set'
              });
            }}
          >
            <option value="">Choose a meeting workspace</option>
            {availableManualMeetings.map((meeting) => (
              <option key={meeting.id} value={meeting.id}>
                {meeting.filename} • {formatDateWithFallback(meeting.meetingStartAt || meeting.uploadedAt)}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedMeetingContext && (
        <div className="upload-meeting-context">
          <div className="upload-meeting-context-copy">
            <div className="upload-meeting-context-label">Selected meeting context</div>
            <div className="upload-meeting-context-title">{selectedMeetingContext.title}</div>
            <div className="upload-meeting-context-meta">
              {selectedMeetingContext.organizer} • {formatDateWithFallback(selectedMeetingContext.start)}
            </div>
          </div>
          <button className="account-back-button" onClick={clearSelectedMeetingContext}>
            Clear
          </button>
        </div>
      )}

      <div className="upload-tab-content">
        {/* Left Column - Upload and Player */}
        <div className="upload-left-column">
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
                accept=".mp3,.m4a,.wav,.mp4,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/wave,video/mp4"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                disabled={busy}
              />
              <span className="btn-primary">Browse files</span>
            </label>
            <p className="upload-hint">Supported formats: MP3, M4A, WAV, MP4 (max 500MB upload before conversion, MP4 converts to MP3)</p>
          </div>

          {uploadState && (
            <div className="transcription-progress-section">
              <div className="progress-section-header">
                <span className="progress-section-title">Upload status</span>
                <span className="progress-section-percent">{uploadState.percent || 0}%</span>
              </div>
              <div className="progress-section-bar">
                <div className="progress-section-fill" style={{ width: `${uploadState.percent || 0}%` }} />
              </div>
              <p className="progress-section-message">{uploadState.message}</p>
            </div>
          )}

          {displayedAudio && (
            <>
              <AudioPlayer audioFile={displayedAudio.audioFile} originalFilename={displayedAudio.originalFilename} />
              <UploadActions
                setActiveTab={setActiveTab}
                audioFile={displayedAudio.audioFile}
                originalFilename={displayedAudio.originalFilename}
                showContinueAction={!!files.audio}
              />
            </>
          )}
        </div>

        <UploadWorkflowPanel
          files={files}
          uploadState={uploadState}
          selectedMeetingContext={selectedMeetingContext}
        />
      </div>
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

  const isRemoteAudio = /^https?:\/\//i.test(audioFile);
  const serverFilename = isRemoteAudio ? null : audioFile.split('/').pop();
  const audioUrl = isRemoteAudio ? audioFile : `/api/audio/${serverFilename}`;
  const displayFilename = originalFilename || serverFilename || 'audio.mp3';
  
  React.useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

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
        Previewing: <strong>{displayFilename}</strong> • {formatTime(duration)} • Ready to play
      </div>
    </div>
  );
}

// Upload Actions Component (Download and Continue buttons)
function UploadActions({ setActiveTab, audioFile, originalFilename, showContinueAction = true }) {
  const isRemoteAudio = /^https?:\/\//i.test(audioFile);
  const serverFilename = isRemoteAudio ? null : audioFile.split('/').pop();
  const audioUrl = isRemoteAudio ? audioFile : `/api/audio/${serverFilename}`;
  const downloadFilename = originalFilename || serverFilename || 'audio.mp3';

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = downloadFilename;
    link.click();
  };

  const handleContinueToTranscription = () => {
    setActiveTab('transcribe');
    // Scroll to transcribe tab
    setTimeout(() => {
      const transcribeTab = document.querySelector('[data-tab="transcribe"]');
      if (transcribeTab) {
        transcribeTab.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="upload-actions">
      <button className="btn-secondary-large" onClick={handleDownload}>
        ⬇ Download Audio
      </button>
      {showContinueAction && (
        <button className="btn-primary-large" onClick={handleContinueToTranscription}>
          Continue to Transcription →
        </button>
      )}
    </div>
  );
}

function UploadWorkflowPanel({ files, uploadState, selectedMeetingContext }) {
  const displayFilename = files.originalFilename || files.audio?.split('/').pop() || 'No file selected';
  const lowerFilename = displayFilename.toLowerCase();
  const fileExtension = displayFilename.includes('.') ? displayFilename.split('.').pop().toUpperCase() : 'Unknown';
  const uploadStatusLabel = uploadState?.status === 'error'
    ? 'Needs attention'
    : uploadState?.status === 'done'
      ? 'Ready for transcription'
      : uploadState?.status === 'processing'
        ? 'Converting and preparing'
        : uploadState?.status === 'uploading'
          ? 'Uploading now'
          : files.audio
            ? 'Available temporarily'
            : 'Waiting for upload';
  const uploadStatusTone = uploadState?.status === 'error'
    ? 'warning'
    : uploadState?.status === 'done' || files.audio
      ? 'success'
      : 'neutral';
  const sourceType = lowerFilename.endsWith('.mp4') ? 'Teams video upload' : 'Audio upload';
  const stepStates = {
    uploaded: uploadState?.status === 'uploading' || uploadState?.status === 'processing' || uploadState?.status === 'done' || !!files.audio,
    converted: lowerFilename.endsWith('.mp4')
      ? (uploadState?.status === 'processing' || uploadState?.status === 'done' || !!files.audio)
      : !!files.audio,
    ready: !!files.audio
  };

  return (
    <div className="upload-right-column">
      <section className="upload-workflow-panel">
        <div className="upload-workflow-header">
          <div>
            <div className="upload-workflow-eyebrow">Workflow status</div>
            <h2 className="upload-workflow-title">Current file journey</h2>
          </div>
          <span className={`upload-workflow-badge ${uploadStatusTone}`}>{uploadStatusLabel}</span>
        </div>

        {selectedMeetingContext && (
          <div className="upload-workflow-callout">
            Working from Teams meeting: <strong>{selectedMeetingContext.title}</strong>
          </div>
        )}

        <div className="upload-workflow-steps">
          <div className={`upload-workflow-step ${stepStates.uploaded ? 'complete' : ''}`}>
            <div className="upload-workflow-step-icon">{stepStates.uploaded ? '✓' : '1'}</div>
            <div>
              <div className="upload-workflow-step-title">Upload intake</div>
              <div className="upload-workflow-step-copy">
                {uploadState?.status === 'uploading'
                  ? uploadState.message
                  : 'Bring in a meeting recording from your device.'}
              </div>
            </div>
          </div>

          <div className={`upload-workflow-step ${stepStates.converted ? 'complete' : ''}`}>
            <div className="upload-workflow-step-icon">{stepStates.converted ? '✓' : '2'}</div>
            <div>
              <div className="upload-workflow-step-title">Media preparation</div>
              <div className="upload-workflow-step-copy">
                {lowerFilename.endsWith('.mp4')
                  ? 'MP4 recordings are converted to MP3 immediately after upload.'
                  : 'Audio uploads are validated and prepared for transcription.'}
              </div>
            </div>
          </div>

          <div className={`upload-workflow-step ${stepStates.ready ? 'complete' : ''}`}>
            <div className="upload-workflow-step-icon">{stepStates.ready ? '✓' : '3'}</div>
            <div>
              <div className="upload-workflow-step-title">Ready for next step</div>
              <div className="upload-workflow-step-copy">
                {files.audio
                  ? 'Preview the audio, then continue to transcription while the temporary file is available.'
                  : 'Your uploaded file will appear here as soon as it is ready.'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="upload-workflow-panel">
        <div className="upload-workflow-header">
          <div>
            <div className="upload-workflow-eyebrow">File details</div>
            <h2 className="upload-workflow-title">Working artifact</h2>
          </div>
        </div>

        <div className="upload-detail-grid">
          <div className="upload-detail-card">
            <div className="upload-detail-label">Filename</div>
            <div className="upload-detail-value break">{displayFilename}</div>
          </div>
          <div className="upload-detail-card">
            <div className="upload-detail-label">Source type</div>
            <div className="upload-detail-value">{sourceType}</div>
          </div>
          <div className="upload-detail-card">
            <div className="upload-detail-label">Detected format</div>
            <div className="upload-detail-value">{fileExtension}</div>
          </div>
          <div className="upload-detail-card">
            <div className="upload-detail-label">Retention</div>
            <div className="upload-detail-value">Temporary until transcript and summary are complete</div>
          </div>
        </div>
      </section>

      <section className="upload-workflow-panel">
        <div className="upload-workflow-header">
          <div>
            <div className="upload-workflow-eyebrow">Next steps</div>
            <h2 className="upload-workflow-title">Keep the workflow moving</h2>
          </div>
        </div>

        <div className="upload-next-steps">
          <div className="upload-next-step-copy">
            {files.audio
              ? 'Next: continue to transcription from the main workspace area once you have reviewed the audio.'
              : 'Once your upload is complete, review the audio in the player and continue to transcription from the main workspace area.'}
          </div>
          <div className="upload-next-step-note">
            {files.audio
              ? 'Download the audio from the player while it is still available if you want to keep a copy.'
              : 'MP4 uploads are converted automatically, and temporary audio is cleaned up after transcript and summary generation.'}
          </div>
        </div>
      </section>
    </div>
  );
}

// Recent Transcripts Panel Component
function RecentTranscriptsPanel({ historyEntries, historyLoading }) {
  const handleTranscriptOpen = async (entry) => {
    try {
      await openHistoryEntryInNewWindow(entry, 'Transcript is no longer available.');
    } catch (error) {
      alert(error.message || 'Transcript is no longer available.');
    }
  };

  return (
    <HistoryPanel
      title="Recent transcripts"
      placeholder="Search recent transcripts"
      historyEntries={historyEntries.filter((entry) => entry.file_type === 'transcript')}
      historyLoading={historyLoading}
      emptyMessage="No transcripts generated yet."
      onEntryClick={handleTranscriptOpen}
    />
  );
}

// Recent Summaries Panel Component
function RecentSummariesPanel({ historyEntries, historyLoading }) {
  const handleSummaryOpen = async (entry) => {
    try {
      await openHistoryEntryInNewWindow(entry, 'Summary is no longer available.');
    } catch (error) {
      alert(error.message || 'Summary is no longer available.');
    }
  };

  return (
    <HistoryPanel
      title="Recent summaries"
      placeholder="Search recent summaries"
      historyEntries={historyEntries.filter((entry) => entry.file_type === 'summary')}
      historyLoading={historyLoading}
      emptyMessage="No summaries generated yet."
      onEntryClick={handleSummaryOpen}
    />
  );
}

function HistoryPanel({ title, placeholder, historyEntries, historyLoading, emptyMessage, onEntryClick }) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [dateFilter, setDateFilter] = React.useState('all');
  const filteredEntries = historyEntries.filter((entry) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      entry.displayFilename.toLowerCase().includes(query) ||
      entry.displayDate.toLowerCase().includes(query) ||
      entry.fileTypeLabel.toLowerCase().includes(query) ||
      entry.statusLabel.toLowerCase().includes(query) ||
      entry.infoChips.join(' ').toLowerCase().includes(query) ||
      entry.relatedOutputs.join(' ').toLowerCase().includes(query)
    );
    return matchesSearch && matchesDateFilter(entry.createdAt, dateFilter);
  });

  return (
    <div className="recent-uploads-panel">
      <div className="recent-uploads-header">
        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="history-filter-select"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        >
          <option value="all">All dates</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="year">This year</option>
        </select>
        <div className="recent-uploads-badge">{title}</div>
      </div>

      <div className="recent-uploads-list">
        {historyLoading ? (
          <div className="recent-upload-card">
            <div className="recent-upload-info">
              <div className="recent-upload-filename">Loading account history...</div>
              <div className="recent-upload-meta">Fetching files for your IBM Recap account.</div>
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="recent-upload-card">
            <div className="recent-upload-info">
              <div className="recent-upload-filename">{emptyMessage}</div>
              <div className="recent-upload-meta">Your future uploads and generated outputs will appear here.</div>
            </div>
          </div>
        ) : filteredEntries.map((entry) => (
          <div
            key={entry.id}
            className={`recent-upload-card ${entry.status}`}
            role="button"
            tabIndex={0}
            onClick={() => onEntryClick?.(entry)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onEntryClick?.(entry);
              }
            }}
          >
            <div className="recent-upload-icon">{entry.icon}</div>
            <div className="recent-upload-info">
              <div className="recent-upload-filename">{entry.displayFilename}</div>
              <div className="recent-upload-meta">
                {entry.fileTypeLabel} • {entry.displayDate} • {entry.statusLabel}
                {entry.infoChips.length > 0 && ` • ${entry.infoChips.join(' • ')}`}
                {entry.relatedOutputs.length > 0 && ` • Related outputs: ${entry.relatedOutputs.join(', ')}`}
              </div>
            </div>
            <div className="recent-upload-status">
              <span className={`status-badge ${entry.status === 'audio' ? 'status-audio' : 'status-success'}`}>
                {entry.statusLabel}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Transcribe Tab Component
function TranscribeTab({ files, busy, transcribeJob, setTranscribeJob, transcriptType, setTranscriptType, transcriptOptions, setTranscriptOptions, historyEntries, historyLoading, setBusy, refresh, setActiveTab }) {
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
      const headers = { 'Content-Type': 'application/json' };
      const authToken = localStorage.getItem('auth_token');
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const r = await fetch('/api/transcribe', {
        method: 'POST',
        headers: headers,
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

      <div className="transcribe-tab-content">
        <div className="transcribe-left-column">
          {!files.audio ? (
            <div className="empty-state">
              <div className="empty-icon">📁</div>
              <h3>No audio file uploaded</h3>
              <p>Please upload an audio file first to generate a transcript</p>
            </div>
          ) : (
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
        
        <div className="transcribe-right-column">
          <RecentTranscriptsPanel historyEntries={historyEntries} historyLoading={historyLoading} />
        </div>
      </div>
    </div>
  );
}

// Summarize Tab Component  
function SummarizeTab({ files, busy, summarizeJob, setSummarizeJob, summaryType, setSummaryType, structuredSections, setStructuredSections, historyEntries, historyLoading, setBusy, refresh, setActiveTab, activeMeetingContext }) {
  
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
      const headers = { 'Content-Type': 'application/json' };
      const authToken = localStorage.getItem('auth_token');
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const r = await fetch('/api/summarize', {
        method: 'POST',
        headers: headers,
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

      <div className="summarize-tab-content">
        <div className="summarize-left-column">
          {!files.transcript ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <h3>No transcript available</h3>
              <p>Please transcribe an audio file first to generate a summary</p>
            </div>
          ) : (
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

          {activeMeetingContext && (
            <div className="summary-context-panel">
              <div className="summary-context-header">
                <div>
                  <div className="upload-workflow-eyebrow">Saved meeting context</div>
                  <h3 className="upload-workflow-title">This context will inform the summary</h3>
                </div>
              </div>

              <div className="summary-context-grid">
                <div className="summary-context-card">
                  <div className="summary-context-label">Meeting</div>
                  <div className="summary-context-value">{activeMeetingContext.filename}</div>
                </div>
                {activeMeetingContext.meetingStartAt && (
                  <div className="summary-context-card">
                    <div className="summary-context-label">Meeting date</div>
                    <div className="summary-context-value">{formatDateWithFallback(activeMeetingContext.meetingStartAt)}</div>
                  </div>
                )}
                {activeMeetingContext.organizerName && (
                  <div className="summary-context-card">
                    <div className="summary-context-label">Organizer</div>
                    <div className="summary-context-value">{activeMeetingContext.organizerName}</div>
                  </div>
                )}
                {activeMeetingContext.attendeeSummary && (
                  <div className="summary-context-card">
                    <div className="summary-context-label">Attendees</div>
                    <div className="summary-context-value">{activeMeetingContext.attendeeSummary}</div>
                  </div>
                )}
              </div>

              {(activeMeetingContext.notes || activeMeetingContext.externalMeetingUrl) && (
                <div className="summary-context-notes">
                  {activeMeetingContext.notes && (
                    <div className="summary-context-note-block">
                      <div className="summary-context-label">Notes</div>
                      <div className="summary-context-copy">{activeMeetingContext.notes}</div>
                    </div>
                  )}
                  {activeMeetingContext.externalMeetingUrl && (
                    <div className="summary-context-note-block">
                      <div className="summary-context-label">Meeting link</div>
                      <div className="summary-context-copy">{activeMeetingContext.externalMeetingUrl}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
                  disabled
                >
                  Continue to Ask Recap
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
        
        <div className="summarize-right-column">
          <RecentSummariesPanel historyEntries={historyEntries} historyLoading={historyLoading} />
        </div>
      </div>
    </div>
  );
}

// Meetings Tab Component
function MeetingsTab({ meetingEntries, historyLoading, setActiveTab, onSelectMeetingContext, refresh }) {
  const [meetingSearchQuery, setMeetingSearchQuery] = React.useState('');
  const [meetingDateFilter, setMeetingDateFilter] = React.useState('all');
  const [meetingStatusFilter, setMeetingStatusFilter] = React.useState('all');
  const [showArchivedMeetings, setShowArchivedMeetings] = React.useState(false);
  const [editingMeetingId, setEditingMeetingId] = React.useState(null);
  const [savingMeeting, setSavingMeeting] = React.useState(false);
  const [archiveBusyId, setArchiveBusyId] = React.useState(null);
  const [meetingMessage, setMeetingMessage] = React.useState('');
  const [meetingError, setMeetingError] = React.useState('');
  const [meetingForm, setMeetingForm] = React.useState({
    title: '',
    meetingStartAt: '',
    organizerName: '',
    attendeeSummary: '',
    externalMeetingUrl: '',
    notes: ''
  });

  const resetMeetingForm = React.useCallback(() => {
    setEditingMeetingId(null);
    setMeetingForm({
      title: '',
      meetingStartAt: '',
      organizerName: '',
      attendeeSummary: '',
      externalMeetingUrl: '',
      notes: ''
    });
  }, []);

  const allMeetings = meetingEntries || [];
  const filteredManualMeetings = allMeetings.filter((meeting) => {
    if (meeting.sourceType !== 'manual') return false;
    if (!showArchivedMeetings && meeting.archivedAt) return false;

    const query = meetingSearchQuery.toLowerCase().trim();
    const searchText = [
      meeting.filename,
      meeting.organizerName,
      meeting.attendeeSummary,
      meeting.notes,
      meeting.displayDate,
      meeting.statusLabel,
      meeting.statusNote
    ].filter(Boolean).join(' ').toLowerCase();

    const matchesSearch = !query || searchText.includes(query);
    const matchesDate = matchesDateFilter(meeting.meetingStartAt || meeting.uploadedAt, meetingDateFilter);
    const matchesStatus = doesMeetingMatchStatusFilter(meeting, meetingStatusFilter);
    return matchesSearch && matchesDate && matchesStatus;
  });
  const visibleMeetings = showArchivedMeetings ? allMeetings : allMeetings.filter((meeting) => !meeting.archivedAt);
  const recentMeetings = visibleMeetings.slice(0, 8);

  const handleMeetingFieldChange = (field, value) => {
    setMeetingForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleEditMeeting = (meeting) => {
    setEditingMeetingId(meeting.id);
    setMeetingMessage('');
    setMeetingError('');
    setMeetingForm({
      title: meeting.filename || '',
      meetingStartAt: meeting.meetingStartAt ? toDateTimeLocalValue(meeting.meetingStartAt) : '',
      organizerName: meeting.organizerName || '',
      attendeeSummary: meeting.attendeeSummary || '',
      externalMeetingUrl: meeting.externalMeetingUrl || '',
      notes: meeting.notes || ''
    });
  };

  const handleUseMeeting = (meeting) => {
    onSelectMeetingContext({
      id: meeting.id,
      title: meeting.filename,
      start: meeting.meetingStartAt || meeting.uploadedAt,
      end: meeting.meetingStartAt || meeting.uploadedAt,
      organizer: meeting.organizerName || 'Organizer not set'
    });
    setActiveTab('upload');
  };

  const handleArchiveToggle = async (meeting, action) => {
    try {
      setArchiveBusyId(meeting.id);
      setMeetingMessage('');
      setMeetingError('');
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error('Authentication is required to manage meeting workspaces.');
      }

      const response = await fetch(`/api/meetings/${meeting.id}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || `Failed to ${action} meeting workspace.`);
      }

      await refresh();
      setMeetingMessage(action === 'archive' ? 'Meeting workspace archived.' : 'Meeting workspace restored.');
    } catch (error) {
      setMeetingError(error.message || 'Failed to update meeting workspace.');
    } finally {
      setArchiveBusyId(null);
    }
  };

  const handleSaveMeeting = async (event) => {
    event.preventDefault();
    setSavingMeeting(true);
    setMeetingMessage('');
    setMeetingError('');

    const authToken = localStorage.getItem('auth_token');
    if (!authToken) {
      setMeetingError('Authentication is required to save meeting workspaces.');
      setSavingMeeting(false);
      return;
    }

    try {
      const response = await fetch(editingMeetingId ? `/api/meetings/${editingMeetingId}` : '/api/meetings', {
        method: editingMeetingId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(meetingForm)
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to save meeting workspace.');
      }

      await refresh();
      setMeetingMessage(editingMeetingId ? 'Meeting workspace updated.' : 'Meeting workspace created.');
      resetMeetingForm();
    } catch (error) {
      setMeetingError(error.message || 'Failed to save meeting workspace.');
    } finally {
      setSavingMeeting(false);
    }
  };

  return (
    <div className="record-tab meetings-tab">
      <div className="record-header">
        <div className="record-header-top">
          <div>
            <h1 className="tab-title">Meetings</h1>
            <p className="tab-subtitle">
              Use this as a manual meeting workspace. Capture the meeting context first, then pass that meeting into
              Upload, Transcribe, and Summarize when you have the recording or transcript ready.
            </p>
          </div>
          <button className="btn-teams-secondary" onClick={() => setActiveTab('upload')}>
            Open Upload flow
          </button>
        </div>
      </div>

      <div className="record-tab-content">
        <div className="record-left-column">
          <section className="account-panel meetings-compose-panel">
            <div className="meetings-section-header">
              <div>
                <h2 className="account-section-title">Create meeting workspace</h2>
                <p className="tab-subtitle">Capture the context now, then attach a recording or transcript later.</p>
              </div>
              {editingMeetingId && (
                <button className="account-back-button" onClick={resetMeetingForm}>
                  Cancel edit
                </button>
              )}
            </div>

            {meetingMessage && <div className="alert alert-success">{meetingMessage}</div>}
            {meetingError && <div className="alert alert-error">{meetingError}</div>}

            <form className="account-form meetings-form" onSubmit={handleSaveMeeting}>
              <div className="meetings-form-grid">
                <div className="form-group">
                  <label htmlFor="meetingTitle">Meeting title</label>
                  <input
                    id="meetingTitle"
                    type="text"
                    value={meetingForm.title}
                    onChange={(e) => handleMeetingFieldChange('title', e.target.value)}
                    placeholder="Client discovery with Acme"
                    disabled={savingMeeting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="meetingStartAt">Meeting date and time</label>
                  <input
                    id="meetingStartAt"
                    type="datetime-local"
                    value={meetingForm.meetingStartAt}
                    onChange={(e) => handleMeetingFieldChange('meetingStartAt', e.target.value)}
                    disabled={savingMeeting}
                  />
                </div>
              </div>

              <div className="meetings-form-grid">
                <div className="form-group">
                  <label htmlFor="organizerName">Organizer</label>
                  <input
                    id="organizerName"
                    type="text"
                    value={meetingForm.organizerName}
                    onChange={(e) => handleMeetingFieldChange('organizerName', e.target.value)}
                    placeholder="Meeting owner or host"
                    disabled={savingMeeting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="attendeeSummary">Attendees</label>
                  <input
                    id="attendeeSummary"
                    type="text"
                    value={meetingForm.attendeeSummary}
                    onChange={(e) => handleMeetingFieldChange('attendeeSummary', e.target.value)}
                    placeholder="Names or team list"
                    disabled={savingMeeting}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="externalMeetingUrl">Meeting link</label>
                <input
                  id="externalMeetingUrl"
                  type="url"
                  value={meetingForm.externalMeetingUrl}
                  onChange={(e) => handleMeetingFieldChange('externalMeetingUrl', e.target.value)}
                  placeholder="Optional Teams or meeting URL"
                  disabled={savingMeeting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="meetingNotes">Notes</label>
                <textarea
                  id="meetingNotes"
                  rows="4"
                  value={meetingForm.notes}
                  onChange={(e) => handleMeetingFieldChange('notes', e.target.value)}
                  placeholder="Capture meeting purpose, account context, or anything you want preserved before the recording arrives."
                  disabled={savingMeeting}
                />
              </div>

              <div className="meetings-form-actions">
                <button className="btn-primary-large" type="submit" disabled={savingMeeting}>
                  {savingMeeting ? 'Saving...' : editingMeetingId ? 'Update workspace' : 'Create workspace'}
                </button>
                <button className="btn-secondary-large" type="button" onClick={resetMeetingForm} disabled={savingMeeting}>
                  Reset form
                </button>
              </div>
            </form>
          </section>

          <section className="meetings-history-section">
            <div className="meetings-section-header">
              <div>
                <h2 className="section-title">Manual meeting workspaces</h2>
                <div className="tab-subtitle">Search, filter, archive, and reuse your saved meeting context from here.</div>
              </div>
              <span className="recent-uploads-badge">{filteredManualMeetings.length} shown</span>
            </div>

            <div className="meetings-filter-bar">
              <div className="search-container meetings-search-container">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search by title, organizer, attendees, notes, or date"
                  value={meetingSearchQuery}
                  onChange={(e) => setMeetingSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="history-filter-select"
                value={meetingDateFilter}
                onChange={(e) => setMeetingDateFilter(e.target.value)}
              >
                <option value="all">All dates</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="year">This year</option>
              </select>

              <select
                className="history-filter-select"
                value={meetingStatusFilter}
                onChange={(e) => setMeetingStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="workspace_ready">Workspace ready</option>
                <option value="in_progress">In progress</option>
                <option value="transcript_ready">Transcript ready</option>
                <option value="completed">Summary ready</option>
                <option value="failed">Failed</option>
              </select>

              <label className="meetings-archive-toggle">
                <input
                  type="checkbox"
                  checked={showArchivedMeetings}
                  onChange={(e) => setShowArchivedMeetings(e.target.checked)}
                />
                Show archived
              </label>
            </div>

            <div className="files-list">
              {historyLoading ? (
                <div className="file-card">
                  <div className="file-info">
                    <div className="file-name">Loading manual meeting workspaces...</div>
                    <div className="file-meta">Pulling your saved meeting context into the workspace.</div>
                  </div>
                </div>
              ) : filteredManualMeetings.length === 0 ? (
                <div className="file-card">
                  <div className="file-info">
                    <div className="file-name">No manual workspaces match these filters</div>
                    <div className="file-meta">Adjust the search or create a new workspace above to start from meeting context before you have a file.</div>
                  </div>
                </div>
              ) : filteredManualMeetings.map((meeting) => (
                <div key={meeting.id} className={`file-card ${meeting.archivedAt ? 'archived-meeting-card' : ''}`}>
                  <div className="file-icon">{meeting.icon}</div>
                  <div className="file-info">
                    <div className="file-name">{meeting.filename}</div>
                    <div className="file-meta">
                      {meeting.meetingStartAt ? formatDateWithFallback(meeting.meetingStartAt) : 'Date not set'}
                      {meeting.organizerName ? ` • ${meeting.organizerName}` : ''}
                      {meeting.attendeeSummary ? ` • ${meeting.attendeeSummary}` : ''}
                    </div>
                    {(meeting.infoChips.length > 0 || meeting.relatedOutputs.length > 0) && (
                      <div className="meeting-card-secondary-meta">
                        {meeting.infoChips.join(' • ')}
                        {meeting.infoChips.length > 0 && meeting.relatedOutputs.length > 0 ? ' • ' : ''}
                        {meeting.relatedOutputs.length > 0 ? `Outputs: ${meeting.relatedOutputs.join(', ')}` : ''}
                      </div>
                    )}
                    {meeting.notes && (
                      <div className="meeting-card-notes">
                        {truncateText(meeting.notes, 180)}
                      </div>
                    )}
                    {meeting.externalMeetingUrl && (
                      <div className="meeting-card-link-row">
                        <a href={meeting.externalMeetingUrl} target="_blank" rel="noreferrer" className="meeting-card-link">
                          Open meeting link
                        </a>
                      </div>
                    )}
                    {meeting.statusNote && (
                      <div className={`file-card-status-note ${meeting.statusTone}`}>
                        {meeting.statusNote}
                      </div>
                    )}
                  </div>
                  <div className="meeting-card-actions">
                    <button className="btn-secondary-large" onClick={() => handleEditMeeting(meeting)}>
                      Edit
                    </button>
                    {!meeting.archivedAt && (
                      <button className="btn-primary-large" onClick={() => handleUseMeeting(meeting)}>
                        Use in Upload
                      </button>
                    )}
                    <button
                      className="account-back-button"
                      disabled={archiveBusyId === meeting.id}
                      onClick={() => handleArchiveToggle(meeting, meeting.archivedAt ? 'restore' : 'archive')}
                    >
                      {archiveBusyId === meeting.id ? 'Saving...' : meeting.archivedAt ? 'Restore' : 'Archive'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="meetings-history-section">
            <div className="meetings-section-header">
              <h2 className="section-title">All meeting records</h2>
              <button className="account-back-button" onClick={() => setActiveTab('home')}>
                Open Home history
              </button>
            </div>

            <div className="files-list">
              {historyLoading ? (
                <div className="file-card">
                  <div className="file-info">
                    <div className="file-name">Loading meeting records...</div>
                    <div className="file-meta">Fetching meeting history for your workspace.</div>
                  </div>
                </div>
              ) : recentMeetings.length === 0 ? (
                <div className="file-card">
                  <div className="file-info">
                    <div className="file-name">No meetings have been processed yet</div>
                    <div className="file-meta">Upload your first Teams recording to start building a meeting-centered history.</div>
                  </div>
                </div>
              ) : recentMeetings.map((meeting) => (
                <div key={meeting.id} className="file-card">
                  <div className="file-icon">
                    {meeting.status === 'audio' && '🎧'}
                    {meeting.status === 'transcript' && '📝'}
                    {meeting.status === 'summary' && '📊'}
                  </div>
                  <div className="file-info">
                    <div className="file-name">{meeting.filename}</div>
                    <div className="file-meta">
                      {meeting.fileTypeLabel} • {meeting.displayDate}
                      {meeting.relatedOutputs.length > 0 && ` • Related outputs: ${meeting.relatedOutputs.join(', ')}`}
                    </div>
                    {meeting.statusNote && (
                      <div className={`file-card-status-note ${meeting.statusTone}`}>
                        {meeting.statusNote}
                      </div>
                    )}
                  </div>
                  <div className="file-status">
                    <span className={`badge ${meeting.statusBadgeClass}`}>{meeting.statusLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="record-right-column">
          <aside className="intent-panel">
            <h2 className="intent-title">Meetings workflow</h2>

            <div className="intent-item">
              <div className="intent-number">1</div>
              <div className="intent-content">
                <div className="intent-heading">Create a meeting workspace</div>
                <div className="intent-description">
                  Start with title, organizer, date, and notes so the meeting exists in IBM Recap even before the recording arrives.
                </div>
              </div>
            </div>

            <div className="intent-item">
              <div className="intent-number">2</div>
              <div className="intent-content">
                <div className="intent-heading">Pass that meeting into Upload</div>
                <div className="intent-description">
                  Use the workspace in Upload when you have the recording, whether it comes from Teams, OneDrive, SharePoint, or a local file.
                </div>
              </div>
            </div>

            <div className="intent-item">
              <div className="intent-number">3</div>
              <div className="intent-content">
                <div className="intent-heading">Continue through transcript and summary</div>
                <div className="intent-description">
                  Once Upload is done, the existing Transcribe and Summarize tabs continue the workflow with your saved defaults and meeting-linked history.
                </div>
              </div>
            </div>

            <div className="intent-item">
              <div className="intent-number">4</div>
              <div className="intent-content">
                <div className="intent-heading">Add Microsoft connection later if it becomes available</div>
                <div className="intent-description">
                  This manual workspace keeps the product useful today while preserving a clean upgrade path for Teams calendar sync later.
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function AccountTab({ accountProfile, storageUsage, accountLoading, onBack, refresh }) {
  const { user, updateAccount } = useAuth();
  const [fullName, setFullName] = React.useState(user?.full_name || '');
  const [defaultTranscriptType, setDefaultTranscriptType] = React.useState('standard');
  const [defaultSpeakerDiarization, setDefaultSpeakerDiarization] = React.useState(false);
  const [defaultSummaryType, setDefaultSummaryType] = React.useState('standard');
  const [preferredExportFormat, setPreferredExportFormat] = React.useState('pdf');
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setFullName(accountProfile?.fullName || user?.full_name || '');
    setDefaultTranscriptType(accountProfile?.defaultTranscriptType || 'standard');
    setDefaultSpeakerDiarization(Boolean(accountProfile?.defaultSpeakerDiarization));
    setDefaultSummaryType(accountProfile?.defaultSummaryType || 'standard');
    setPreferredExportFormat(accountProfile?.preferredExportFormat || 'pdf');
  }, [
    accountProfile?.fullName,
    accountProfile?.defaultTranscriptType,
    accountProfile?.defaultSpeakerDiarization,
    accountProfile?.defaultSummaryType,
    accountProfile?.preferredExportFormat,
    user?.full_name
  ]);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      await updateAccount({
        fullName,
        defaultTranscriptType,
        defaultSpeakerDiarization,
        defaultSummaryType,
        preferredExportFormat
      });
      await refresh();
      setMessage('Account preferences saved successfully.');
    } catch (saveError) {
      setError(saveError.message || 'Failed to save account preferences');
    } finally {
      setSaving(false);
    }
  };

  const usage = storageUsage || {
    totalBytes: 0,
    totalFiles: 0,
    audioCount: 0,
    transcriptCount: 0,
    summaryCount: 0,
    audioBytes: 0,
    transcriptBytes: 0,
    summaryBytes: 0,
    latestActivityAt: null,
    storageLimitBytes: 50 * 1024 * 1024,
    remainingBytes: 50 * 1024 * 1024
  };
  const storagePercent = usage.storageLimitBytes > 0
    ? Math.min((usage.totalBytes / usage.storageLimitBytes) * 100, 100)
    : 0;

  return (
    <div className="account-page">
      <div className="account-page-topbar">
        <button className="account-back-button" onClick={onBack}>
          ← Back to workspace
        </button>
      </div>

      <div className="account-tab">
      <div className="account-header">
        <h1 className="tab-title">Account settings</h1>
        <p className="tab-subtitle">Manage your profile details and monitor storage usage for your IBM Recap workspace.</p>
      </div>

      <div className="account-grid">
        <section className="account-panel">
          <h2 className="account-section-title">Profile</h2>
          {message && <div className="alert alert-success">{message}</div>}
          {error && <div className="alert alert-error">{error}</div>}

          <form className="account-form" onSubmit={handleSave}>
            <div className="form-group">
              <label htmlFor="accountFullName">Full name</label>
              <input
                id="accountFullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your preferred display name"
                disabled={saving || accountLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="accountEmail">Email</label>
              <input
                id="accountEmail"
                type="email"
                value={accountProfile?.email || user?.email || ''}
                readOnly
                disabled
              />
              <small>Sign-in email is managed through your IBM Recap account.</small>
            </div>

            <div className="account-meta-grid">
              <div className="account-meta-card">
                <div className="account-meta-label">Member since</div>
                <div className="account-meta-value">{formatDateWithFallback(accountProfile?.createdAt)}</div>
              </div>
              <div className="account-meta-card">
                <div className="account-meta-label">Last sign-in</div>
                <div className="account-meta-value">{formatDateWithFallback(accountProfile?.lastLogin)}</div>
              </div>
            </div>

            <button className="btn-primary-large" type="submit" disabled={saving || accountLoading}>
              {saving ? 'Saving...' : 'Save profile & preferences'}
            </button>
          </form>
        </section>

        <section className="account-panel">
          <h2 className="account-section-title">Workspace defaults</h2>
          <div className="account-preferences-stack">
            <div className="account-preference-card">
              <div className="account-preference-copy">
                <div className="account-preference-title">Default transcription mode</div>
                <div className="account-preference-description">Choose whether the transcription screen should open in standard or customized mode by default.</div>
              </div>
              <div className="account-segmented-control" role="radiogroup" aria-label="Default transcription mode">
                <button
                  type="button"
                  className={`account-segmented-option ${defaultTranscriptType === 'standard' ? 'selected' : ''}`}
                  onClick={() => setDefaultTranscriptType('standard')}
                  disabled={saving || accountLoading}
                >
                  Standard
                </button>
                <button
                  type="button"
                  className={`account-segmented-option ${defaultTranscriptType === 'custom' ? 'selected' : ''}`}
                  onClick={() => setDefaultTranscriptType('custom')}
                  disabled={saving || accountLoading}
                >
                  Customized
                </button>
              </div>
            </div>

            <label className="account-toggle-row">
              <div className="account-preference-copy">
                <div className="account-preference-title">Enable speaker diarization by default</div>
                <div className="account-preference-description">Pre-select speaker separation whenever a user opens the transcription workflow.</div>
              </div>
              <input
                type="checkbox"
                checked={defaultSpeakerDiarization}
                onChange={(e) => setDefaultSpeakerDiarization(e.target.checked)}
                disabled={saving || accountLoading}
              />
            </label>

            <div className="account-preference-card">
              <div className="account-preference-copy">
                <div className="account-preference-title">Default summary style</div>
                <div className="account-preference-description">Set the summary experience the app should open with after a transcript is ready.</div>
              </div>
              <div className="account-segmented-control" role="radiogroup" aria-label="Default summary style">
                <button
                  type="button"
                  className={`account-segmented-option ${defaultSummaryType === 'standard' ? 'selected' : ''}`}
                  onClick={() => setDefaultSummaryType('standard')}
                  disabled={saving || accountLoading}
                >
                  Standard
                </button>
                <button
                  type="button"
                  className={`account-segmented-option ${defaultSummaryType === 'structured' ? 'selected' : ''}`}
                  onClick={() => setDefaultSummaryType('structured')}
                  disabled={saving || accountLoading}
                >
                  Structured
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="preferredExportFormat">Preferred export format</label>
              <select
                id="preferredExportFormat"
                className="account-select"
                value={preferredExportFormat}
                onChange={(e) => setPreferredExportFormat(e.target.value)}
                disabled={saving || accountLoading}
              >
                <option value="pdf">PDF</option>
                <option value="markdown">Markdown</option>
                <option value="text">Plain text</option>
              </select>
              <small>This preference is stored now and will be used as export choices become configurable across the app.</small>
            </div>
          </div>
        </section>

        <section className="account-panel">
          <h2 className="account-section-title">Storage usage</h2>
          <div className="account-storage-summary">
            <div className="account-storage-total">
              {formatBytes(usage.totalBytes)} / {formatBytes(usage.storageLimitBytes)}
            </div>
            <div className="account-storage-label">{usage.totalFiles} total files stored</div>
            <div className="account-storage-subtitle">
              {formatBytes(usage.remainingBytes)} remaining
              {usage.latestActivityAt ? ` • Latest activity ${getTimeAgo(usage.latestActivityAt)}` : ' • No stored activity yet'}
            </div>
            <div className="account-storage-progress">
              <div className="account-storage-progress-fill" style={{ width: `${storagePercent}%` }} />
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Audio files</div>
              <div className="stat-value">{usage.audioCount}</div>
              <div className="stat-badge">{formatBytes(usage.audioBytes)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Transcripts</div>
              <div className="stat-value">{usage.transcriptCount}</div>
              <div className="stat-badge">{formatBytes(usage.transcriptBytes)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Summaries</div>
              <div className="stat-value">{usage.summaryCount}</div>
              <div className="stat-badge">{formatBytes(usage.summaryBytes)}</div>
            </div>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}

// Ask Recap Tab Component
function AnalyticsTab() {
  return (
    <div className="coming-soon-tab">
      <div className="coming-soon-content">
        <span className="coming-soon-badge">Coming soon</span>
      </div>
    </div>
  );
}

// Helper function
function getTimeAgo(isoString) {
  if (!isoString) return 'just now';
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

function matchesDateFilter(isoString, filter) {
  if (!isoString || filter === 'all') return true;

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;

  if (filter === '7d') {
    return diffMs <= 7 * 24 * 60 * 60 * 1000;
  }

  if (filter === '30d') {
    return diffMs <= 30 * 24 * 60 * 60 * 1000;
  }

  if (filter === 'year') {
    return date.getFullYear() === now.getFullYear();
  }

  return true;
}

async function openHistoryEntryInNewWindow(entry, unavailableMessage) {
  const previewWindow = window.open('', '_blank');
  if (!previewWindow) {
    throw new Error('Your browser blocked the new window. Please allow pop-ups for IBM Recap.');
  }

  previewWindow.document.write('<title>Opening file...</title><p style="font-family:sans-serif;padding:24px;">Opening file...</p>');

  try {
    const pdfBlob = await fetchHistoryPdfBlob(entry.id);
    const pdfObjectUrl = URL.createObjectURL(pdfBlob);
    previewWindow.location.href = pdfObjectUrl;
  } catch (error) {
    previewWindow.close();
    throw new Error(error.message || unavailableMessage);
  }
}

async function fetchHistoryPdfBlob(fileId) {
  const authToken = localStorage.getItem('auth_token');
  const headers = authToken
    ? { Authorization: `Bearer ${authToken}` }
    : {};

  const response = await fetch(`/api/files/${fileId}/pdf`, { headers });
  if (!response.ok) {
    let errorMessage = 'Failed to open the PDF preview.';
    try {
      const errorData = await response.json();
      errorMessage = errorData?.error || errorMessage;
    } catch (error) {
      // Fall back to generic message when the response is not JSON.
    }
    throw new Error(errorMessage);
  }

  return response.blob();
}

function buildHistoryEntries(accountFiles) {
  return (accountFiles || []).map((file) => {
    const displayFilename = normalizeDisplayFilename(file.original_filename, file.file_type);
    const createdAt = file.created_at || file.updated_at || new Date().toISOString();
    const hasTranscript = file.file_type === 'transcript' || file.has_transcript;
    const hasSummary = file.file_type === 'summary' || file.has_summary;
    const processingStatus = file.processing_status || null;
    const relatedOutputs = [
      hasTranscript ? 'Transcript' : null,
      hasSummary ? 'Summary' : null
    ].filter(Boolean);
    const infoChips = [
      processingStatus ? formatProcessingStatus(processingStatus) : null,
      file.speaker_diarization ? 'Speaker diarization' : null,
      file.action_items_count ? `${file.action_items_count} action items` : null,
      file.mime_type ? simplifyMimeType(file.mime_type) : null
    ].filter(Boolean);

    return {
      ...file,
      id: file.id,
      meetingId: file.meeting_id || null,
      processingStatus,
      uploadedAt: createdAt,
      createdAt,
      displayDate: formatDate(createdAt),
      displayFilename,
      fileTypeLabel: formatFileTypeLabel(file.file_type),
      status: deriveStatus(file),
      statusLabel: deriveStatusLabel(file),
      icon: deriveIcon(file.file_type),
      hasTranscript,
      hasSummary,
      infoChips,
      relatedOutputs
    };
  });
}

function buildMeetingEntries(accountMeetings) {
  return (accountMeetings || []).map((meeting) => {
    const uploadedAt = meeting.meeting_start_at || meeting.uploaded_at || meeting.created_at || new Date().toISOString();
    const processingStatus = meeting.processing_status || 'uploaded';
    const hasTranscript = !!meeting.hasTranscript;
    const hasSummary = !!meeting.hasSummary;
    const relatedOutputs = [
      hasTranscript ? 'Transcript' : null,
      hasSummary ? 'Summary' : null
    ].filter(Boolean);
    const infoChips = [
      formatProcessingStatus(processingStatus),
      meeting.speakerDiarization ? 'Speaker diarization' : null,
      meeting.actionItemsCount ? `${meeting.actionItemsCount} action items` : null,
      meeting.artifactCount ? `${meeting.artifactCount} artifacts` : null
    ].filter(Boolean);

    return {
      id: meeting.id,
      filename: meeting.title || normalizeDisplayFilename(meeting.original_filename, 'audio'),
      uploadedAt,
      meetingStartAt: meeting.meeting_start_at || null,
      displayDate: formatDate(uploadedAt),
      fileTypeLabel: meeting.source_type === 'teams'
        ? 'Teams meeting'
        : meeting.source_type === 'manual'
          ? 'Manual meeting workspace'
          : 'Uploaded meeting',
      sourceType: meeting.source_type || 'upload',
      archivedAt: meeting.archived_at || null,
      organizerName: meeting.organizer_name || null,
      attendeeSummary: meeting.attendee_summary || null,
      externalMeetingUrl: meeting.external_meeting_url || null,
      notes: meeting.notes || null,
      processingStatus,
      processingError: meeting.processing_error || null,
      status: deriveStatus({ processing_status: processingStatus, has_summary: hasSummary, has_transcript: hasTranscript }),
      statusLabel: deriveStatusLabel({ processing_status: processingStatus, has_summary: hasSummary, has_transcript: hasTranscript }),
      statusTone: deriveProcessingTone(processingStatus),
      statusBadgeClass: deriveStatusBadgeClass(processingStatus),
      statusNote: deriveProcessingNote(meeting),
      icon: deriveMeetingIcon(meeting),
      hasTranscript,
      hasSummary,
      relatedOutputs,
      infoChips
    };
  }).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

function normalizeDisplayFilename(filename, fileType) {
  if (!filename) return 'Untitled file';
  if (fileType === 'transcript') {
    return filename.replace(/\.transcript\.txt$/i, '');
  }
  if (fileType === 'summary') {
    return filename.replace(/\.summary\.md$/i, '');
  }
  return filename;
}

function formatFileTypeLabel(fileType) {
  if (fileType === 'audio') return 'Uploaded audio';
  if (fileType === 'transcript') return 'Transcript document';
  if (fileType === 'summary') return 'Summary document';
  return 'File';
}

function deriveStatus(file) {
  const processingStatus = file.processing_status || file.processingStatus;
  if (processingStatus === 'completed') return 'summary';
  if (processingStatus === 'transcript_ready' || processingStatus === 'summarizing') return 'transcript';
  if (processingStatus === 'failed') return 'audio';
  if (file.file_type === 'summary' || file.has_summary) return 'summary';
  if (file.file_type === 'transcript' || file.has_transcript) return 'transcript';
  return 'audio';
}

function deriveStatusLabel(file) {
  const processingStatus = file.processing_status || file.processingStatus;
  if ((file.source_type === 'manual' || file.sourceType === 'manual') && !file.has_summary && !file.hasSummary && !file.has_transcript && !file.hasTranscript) {
    return 'Workspace ready';
  }
  if (processingStatus) {
    return formatProcessingStatus(processingStatus);
  }
  const status = deriveStatus(file);
  if (status === 'summary') return 'Summary ready';
  if (status === 'transcript') return 'Transcript ready';
  return 'Audio only';
}

function formatProcessingStatus(status) {
  const labels = {
    uploaded: 'Uploaded',
    converting: 'Converting',
    ready_for_transcription: 'Ready for transcription',
    transcribing: 'Transcribing',
    transcript_ready: 'Transcript ready',
    summarizing: 'Summarizing',
    completed: 'Summary ready',
    failed: 'Failed'
  };

  return labels[status] || status.replace(/_/g, ' ');
}

function deriveProcessingTone(status) {
  if (status === 'failed') return 'error';
  if (status === 'completed' || status === 'transcript_ready') return 'success';
  return 'pending';
}

function deriveStatusBadgeClass(status) {
  if (status === 'failed') return 'badge-danger';
  if (status === 'completed' || status === 'transcript_ready') return 'badge-success';
  if (status === 'summarizing' || status === 'transcribing' || status === 'converting') return 'badge-progress';
  return 'badge-warning';
}

function deriveProcessingNote(meeting) {
  if (meeting.archived_at || meeting.archivedAt) {
    return 'Archived workspace. Restore it when you want to reuse this meeting context.';
  }
  const status = meeting.processing_status || 'uploaded';
  const sourceType = meeting.source_type || meeting.sourceType;
  const hasTranscript = Boolean(meeting.hasTranscript || meeting.has_transcript);
  const hasSummary = Boolean(meeting.hasSummary || meeting.has_summary);
  const artifactCount = Number(meeting.artifactCount || 0);
  if (sourceType === 'manual' && !hasTranscript && !hasSummary && artifactCount === 0) {
    return 'Workspace created. Add a recording or transcript when you are ready to continue.';
  }
  if (status === 'failed') {
    return meeting.processing_error
      ? `Needs attention: ${meeting.processing_error}`
      : 'Needs attention before this meeting can move forward.';
  }

  if (status === 'uploaded' || status === 'ready_for_transcription') {
    return 'Ready for transcription when you want to continue the workflow.';
  }

  if (status === 'converting' || status === 'transcribing' || status === 'summarizing') {
    return 'Processing is in progress for this meeting.';
  }

  if (status === 'transcript_ready') {
    return 'Transcript is ready. You can continue into summary generation.';
  }

  return null;
}

function doesMeetingMatchStatusFilter(meeting, filter) {
  if (filter === 'all') return true;
  if (filter === 'workspace_ready') {
    return meeting.sourceType === 'manual' && !meeting.archivedAt && !meeting.hasTranscript && !meeting.hasSummary && meeting.processingStatus === 'uploaded';
  }
  if (filter === 'in_progress') {
    if (meeting.sourceType === 'manual' && !meeting.hasTranscript && !meeting.hasSummary && meeting.processingStatus === 'uploaded') {
      return false;
    }
    return ['converting', 'transcribing', 'summarizing', 'uploaded', 'ready_for_transcription'].includes(meeting.processingStatus);
  }
  if (filter === 'transcript_ready') {
    return meeting.processingStatus === 'transcript_ready';
  }
  if (filter === 'completed') {
    return meeting.processingStatus === 'completed';
  }
  if (filter === 'failed') {
    return meeting.processingStatus === 'failed';
  }
  return true;
}

function truncateText(value, maxLength = 160) {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function deriveMeetingIcon(meeting) {
  if (meeting.source_type === 'manual' && !meeting.hasTranscript && !meeting.hasSummary) return '📅';
  return deriveIcon(deriveStatus({ processing_status: meeting.processing_status, has_summary: meeting.hasSummary, has_transcript: meeting.hasTranscript }));
}

function toDateTimeLocalValue(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

function deriveIcon(fileType) {
  if (fileType === 'summary') return '📊';
  if (fileType === 'transcript') return '📝';
  return '🎧';
}

function simplifyMimeType(mimeType) {
  if (!mimeType) return null;
  const [, subtype] = mimeType.split('/');
  return subtype ? subtype.toUpperCase() : mimeType.toUpperCase();
}

function formatDate(isoString) {
  if (!isoString) return 'Unknown date';
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatDateWithFallback(isoString) {
  return isoString ? formatDate(isoString) : 'Not available';
}

function formatBytes(bytes) {
  const numericBytes = Number(bytes || 0);
  if (numericBytes < 1024) return `${numericBytes} B`;
  if (numericBytes < 1024 * 1024) return `${(numericBytes / 1024).toFixed(1)} KB`;
  if (numericBytes < 1024 * 1024 * 1024) return `${(numericBytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(numericBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// App wrapper component - handles authentication routing
function App() {
  const { user, loading, isAuthenticated } = useAuth();
  
  // Show loading state while checking authentication
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--ibm-gray-100)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div>Loading IBM Recap...</div>
        </div>
      </div>
    );
  }
  
  // Show auth page if not authenticated
  if (!isAuthenticated) {
    return <AuthPage />;
  }
  
  // Show main app if authenticated
  return <MainApp />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);

// Made with Bob
