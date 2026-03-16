import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import mime from 'mime-types';
import multer from 'multer';
import OpenAI from 'openai';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';
import { AssemblyAI } from 'assemblyai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUTPUT_DIR = path.join(ROOT, 'output');
const META_PATH = path.join(OUTPUT_DIR, 'latest.json');

const PORT = Number(process.env.PORT || 8787);
const DEVICE = process.env.DEVICE || 'BlackHole 2ch';
const MIC = process.env.MIC || 'MacBook Air Microphone';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';
const OPENAI_SUMMARY_MODEL = process.env.OPENAI_SUMMARY_MODEL || 'gpt-4o';

// OpenRouter configuration (fallback)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_TRANSCRIBE_MODEL = process.env.OPENROUTER_TRANSCRIBE_MODEL || 'openai/whisper-large-v3-turbo';
const OPENROUTER_SUMMARY_MODEL = process.env.OPENROUTER_SUMMARY_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';

// AssemblyAI configuration (for speaker diarization)
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || '';

// Diarization service configuration (local Pyannote - optional)
const DIARIZATION_URL = process.env.DIARIZATION_URL || 'http://localhost:5000';

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Clear metadata and output files on server startup to reset file status
if (fs.existsSync(META_PATH)) {
  fs.unlinkSync(META_PATH);
}

// Clear all files in output directory on startup
const outputFiles = fs.readdirSync(OUTPUT_DIR);
for (const file of outputFiles) {
  const filePath = path.join(OUTPUT_DIR, file);
  if (fs.statSync(filePath).isFile()) {
    fs.unlinkSync(filePath);
  }
}

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(PUBLIC_DIR));


// Configure multer for file uploads
const upload = multer({
  dest: OUTPUT_DIR,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/wave'];
    const allowedExtensions = ['.mp3', '.m4a', '.wav'];
    const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    
    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only MP3, M4A, and WAV audio files are allowed'));
    }
  }
});

// Initialize OpenAI client (primary)
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// Initialize OpenRouter client (fallback)
const openrouter = OPENROUTER_API_KEY ? new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://ibm-recap.onrender.com',
    'X-Title': 'IBM Recap'
  }
}) : null;

// Initialize AssemblyAI client (for speaker diarization)
const assemblyai = ASSEMBLYAI_API_KEY ? new AssemblyAI({ apiKey: ASSEMBLYAI_API_KEY }) : null;

// Log configuration status on startup
console.log('🔧 Service Configuration:');
console.log(`  OpenAI: ${openai ? '✅ Configured' : '❌ Not configured'}`);
console.log(`  OpenRouter: ${openrouter ? '✅ Configured' : '❌ Not configured'}`);
console.log(`  AssemblyAI: ${assemblyai ? '✅ Configured' : '❌ Not configured'}`);

const jobs = new Map();

function createJob(type) {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    type,
    status: 'running',
    percent: 1,
    message: 'Starting...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    result: null,
    error: null,
  };
  jobs.set(id, job);
  return job;
}

function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
}

let recordingProcess = null;
let recordingState = {
  isRecording: false,
  isStopping: false,
  startedAt: null,
  audioPath: null,
};

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function readMeta() {
  if (!fs.existsSync(META_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeMeta(metaPatch) {
  const current = readMeta();
  const next = { ...current, ...metaPatch, updatedAt: new Date().toISOString() };
  fs.writeFileSync(META_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function runProcess(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += String(d)));
    p.stderr.on('data', (d) => (stderr += String(d)));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      const details = [stderr?.trim(), stdout?.trim()].filter(Boolean).join('\n');
      return reject(new Error(`${command} exited with code ${code}${details ? `\n${details}` : ''}`));
    });
  });
}

// Helper function to call diarization service
async function getDiarization(audioPath) {
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('audio', fs.createReadStream(audioPath));
    
    const response = await fetch(`${DIARIZATION_URL}/diarize`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Diarization service returned ${response.status}`);
    }
    
    const result = await response.json();
    if (!result.ok) {
      throw new Error(result.error || 'Diarization failed');
    }
    
    return result.segments;
  } catch (error) {
    console.error('Diarization service error:', error);
    return null; // Return null to fall back to heuristic method
  }
}

// Helper function to align Whisper segments with Pyannote speaker labels
function alignSegmentsWithSpeakers(whisperSegments, diarizationSegments) {
  if (!diarizationSegments || diarizationSegments.length === 0) {
    return whisperSegments; // Return original if no diarization data
  }
  
  // Create a map of speaker labels (normalize to Speaker 1, Speaker 2, etc.)
  const speakerMap = new Map();
  let speakerCount = 0;
  
  return whisperSegments.map(seg => {
    const segStart = seg.start || 0;
    const segEnd = seg.end || segStart;
    const segMid = (segStart + segEnd) / 2;
    
    // Find the diarization segment that overlaps with this Whisper segment
    const diarSeg = diarizationSegments.find(d =>
      segMid >= d.start && segMid <= d.end
    );
    
    if (diarSeg) {
      // Normalize speaker labels
      if (!speakerMap.has(diarSeg.speaker)) {
        speakerCount++;
        speakerMap.set(diarSeg.speaker, speakerCount);
      }
      
      return {
        ...seg,
        speaker: speakerMap.get(diarSeg.speaker)
      };
    }
    
    return seg; // No speaker found for this segment
  });
}

// Helper function to transcribe with AssemblyAI (includes native speaker diarization)
async function transcribeWithAssemblyAI(audioPath, transcriptOptions, updateProgress) {
  if (!assemblyai) {
    throw new Error('AssemblyAI API key not configured');
  }

  try {
    updateProgress(10, 'Uploading audio to AssemblyAI...');
    
    // Upload the audio file
    const uploadUrl = await assemblyai.files.upload(audioPath);
    
    updateProgress(20, 'Starting transcription with speaker diarization...');
    
    // Configure transcription parameters
    const config = {
      audio_url: uploadUrl,
      speech_models: ['universal-2'], // Required: array of speech models
      speaker_labels: transcriptOptions.speakerDiarization || false,
    };
    
    // Start transcription
    const transcript = await assemblyai.transcripts.transcribe(config);
    
    if (transcript.status === 'error') {
      throw new Error(transcript.error || 'Transcription failed');
    }
    
    updateProgress(90, 'Processing transcript...');
    
    // Format the transcript
    const lines = [];
    let lastSpeaker = null;
    
    if (transcript.utterances && transcript.utterances.length > 0) {
      // Use utterances (speaker-aware segments)
      for (const utterance of transcript.utterances) {
        let line = '';
        
        // Add timestamp if requested
        if (transcriptOptions.timestamps) {
          const startMs = utterance.start;
          const start = Math.floor(startMs / 1000);
          const hh = Math.floor(start / 3600);
          const mm = Math.floor((start % 3600) / 60);
          const ss = start % 60;
          const ts = `[${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}]`;
          line += `${ts} `;
        }
        
        // Add speaker label
        if (transcriptOptions.speakerDiarization && utterance.speaker) {
          line += `Speaker ${utterance.speaker}: `;
        }
        
        // Add text with redaction
        let text = utterance.text || '';
        if (transcriptOptions.redactWords && transcriptOptions.redactWords.length > 0) {
          for (const word of transcriptOptions.redactWords) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            text = text.replace(regex, '[REDACTED]');
          }
        }
        line += text;
        
        if (line.trim()) {
          lines.push(line);
        }
      }
    } else if (transcript.words && transcript.words.length > 0) {
      // Fallback to words if no utterances
      let currentLine = '';
      let currentStart = null;
      
      for (let i = 0; i < transcript.words.length; i++) {
        const word = transcript.words[i];
        
        if (currentStart === null) {
          currentStart = word.start;
          
          if (transcriptOptions.timestamps) {
            const start = Math.floor(word.start / 1000);
            const hh = Math.floor(start / 3600);
            const mm = Math.floor((start % 3600) / 60);
            const ss = start % 60;
            const ts = `[${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}]`;
            currentLine += `${ts} `;
          }
        }
        
        let wordText = word.text || '';
        if (transcriptOptions.redactWords && transcriptOptions.redactWords.length > 0) {
          for (const redactWord of transcriptOptions.redactWords) {
            const regex = new RegExp(`\\b${redactWord}\\b`, 'gi');
            wordText = wordText.replace(regex, '[REDACTED]');
          }
        }
        
        currentLine += wordText + ' ';
        
        // Create new line every ~10 seconds or at sentence end
        const nextWord = transcript.words[i + 1];
        if (!nextWord || (nextWord.start - currentStart > 10000) || /[.!?]$/.test(wordText)) {
          if (currentLine.trim()) {
            lines.push(currentLine.trim());
          }
          currentLine = '';
          currentStart = null;
        }
      }
      
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
    } else {
      // Fallback to plain text
      let text = transcript.text || '';
      if (transcriptOptions.redactWords && transcriptOptions.redactWords.length > 0) {
        for (const word of transcriptOptions.redactWords) {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          text = text.replace(regex, '[REDACTED]');
        }
      }
      lines.push(text);
    }
    
    return {
      lines,
      model: 'AssemblyAI'
    };
  } catch (error) {
    console.error('AssemblyAI transcription error:', error);
    throw error;
  }
}

app.get('/api/status', (_req, res) => {
  const meta = readMeta();
  
  // Determine active models
  const transcriptionModel = {
    primary: OPENAI_API_KEY ? 'OpenAI Whisper' : null,
    fallback: OPENROUTER_API_KEY ? 'OpenRouter Whisper' : null,
    active: OPENAI_API_KEY ? 'OpenAI Whisper' : OPENROUTER_API_KEY ? 'OpenRouter Whisper' : 'Not Configured'
  };
  
  const summarizationModel = {
    primary: OPENAI_API_KEY ? 'GPT-4o' : null,
    fallback: OPENROUTER_API_KEY ? 'Llama 3.1 8B (Free)' : null,
    active: OPENAI_API_KEY ? 'GPT-4o' : OPENROUTER_API_KEY ? 'Llama 3.1 8B (Free)' : 'Not Configured'
  };
  
  // Only return file paths if the files actually exist
  const audioExists = meta.audioPath && fs.existsSync(meta.audioPath);
  const transcriptExists = meta.transcriptPath && fs.existsSync(meta.transcriptPath);
  const summaryExists = meta.summaryPath && fs.existsSync(meta.summaryPath);
  
  // Clean up metadata if files don't exist
  if (!audioExists || !transcriptExists || !summaryExists) {
    const cleanedMeta = {
      audioPath: audioExists ? meta.audioPath : null,
      originalFilename: audioExists ? meta.originalFilename : null,
      transcriptPath: transcriptExists ? meta.transcriptPath : null,
      summaryPath: summaryExists ? meta.summaryPath : null
    };
    
    // Only update metadata if something changed
    if (cleanedMeta.audioPath !== meta.audioPath ||
        cleanedMeta.originalFilename !== meta.originalFilename ||
        cleanedMeta.transcriptPath !== meta.transcriptPath ||
        cleanedMeta.summaryPath !== meta.summaryPath) {
      writeMeta(cleanedMeta);
    }
  }
  
  res.json({
    ok: true,
    recording: recordingState,
    files: {
      audio: audioExists ? meta.audioPath : null,
      originalFilename: audioExists ? meta.originalFilename : null,
      transcript: transcriptExists ? meta.transcriptPath : null,
      summary: summaryExists ? meta.summaryPath : null,
    },
    config: {
      DEVICE,
      MIC,
    },
    models: {
      transcription: transcriptionModel,
      summarization: summarizationModel,
    },
  });
});

// Clear session endpoint - deletes metadata and files to reset the UI
app.post('/api/clear-session', (_req, res) => {
  try {
    // Delete the metadata file to reset file status
    if (fs.existsSync(META_PATH)) {
      fs.unlinkSync(META_PATH);
    }
    
    // Delete all files in output directory
    const outputFiles = fs.readdirSync(OUTPUT_DIR);
    for (const file of outputFiles) {
      const filePath = path.join(OUTPUT_DIR, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    }
    
    res.json({ ok: true, message: 'Session cleared successfully' });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.get('/api/devices', async (_req, res) => {
  try {
    const ff = await runProcess('ffmpeg', ['-f', 'avfoundation', '-list_devices', 'true', '-i', '']);
    res.json({ ok: true, output: `${ff.stdout}\n${ff.stderr}`.trim() });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });
  return res.json({ ok: true, job });
});

// Upload audio file endpoint
app.post('/api/upload-audio', upload.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file uploaded' });
    }

    const ts = stamp();
    const originalFilename = req.file.originalname;
    // Preserve original file extension
    const originalExtension = path.extname(originalFilename).toLowerCase();
    const finalPath = path.join(OUTPUT_DIR, `teams-call-${ts}${originalExtension}`);
    
    // Rename uploaded file to proper name with original extension
    fs.renameSync(req.file.path, finalPath);
    
    // Update metadata with the uploaded file and original filename
    writeMeta({
      audioPath: finalPath,
      originalFilename: originalFilename,
      transcriptPath: null,
      summaryPath: null
    });
    
    return res.json({
      ok: true,
      message: 'File uploaded successfully',
      audioPath: finalPath,
      originalFilename: originalFilename
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post('/api/record/start', (_req, res) => {
  if (recordingState.isRecording || recordingProcess) {
    return res.status(400).json({ ok: false, error: 'Recording already in progress.' });
  }

  const ts = stamp();
  const audioPath = path.join(OUTPUT_DIR, `teams-call-${ts}.mp3`);

  const args = [
    '-f', 'avfoundation', '-i', `:${DEVICE}`,
    '-f', 'avfoundation', '-i', `:${MIC}`,
    '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=2',
    '-c:a', 'libmp3lame', '-b:a', '192k',
    audioPath,
  ];

  const p = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  recordingProcess = p;
  recordingState = { isRecording: true, isStopping: false, startedAt: new Date().toISOString(), audioPath };

  let errBuffer = '';
  p.stderr.on('data', (d) => {
    errBuffer += String(d);
    if (errBuffer.length > 10000) errBuffer = errBuffer.slice(-10000);
  });

  p.on('close', (_code) => {
    recordingState.isRecording = false;
    recordingState.isStopping = false;
    recordingProcess = null;

    // Persist audio if file exists, even when ffmpeg exits with a nonstandard code.
    if (fs.existsSync(audioPath)) {
      writeMeta({ audioPath, transcriptPath: null, summaryPath: null });
    }
  });

  return res.json({ ok: true, message: 'Recording started.', audioPath });
});

app.post('/api/record/stop', (_req, res) => {
  if (!recordingState.isRecording || !recordingProcess) {
    return res.status(400).json({ ok: false, error: 'No active recording.' });
  }

  if (recordingState.isStopping) {
    return res.status(202).json({ ok: true, message: 'Recording is already stopping...' });
  }

  try {
    recordingState.isStopping = true;
    const current = recordingProcess;
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      recordingState.isStopping = false;
      return res.status(504).json({ ok: false, error: 'Timed out waiting for ffmpeg to stop. Please try again.' });
    }, 10000);

    current.once('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      return res.json({ ok: true, message: 'Recording stopped.', audioPath: recordingState.audioPath });
    });

    current.kill('SIGINT');
  } catch (err) {
    recordingState.isStopping = false;
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post('/api/transcribe', async (req, res) => {
  try {
    const meta = readMeta();
    const audioPath = req.body?.audioPath || meta.audioPath;
    const transcriptOptions = req.body?.transcriptOptions || { timestamps: true };
    
    if (!audioPath || !fs.existsSync(audioPath)) {
      return res.status(400).json({ ok: false, error: 'Audio file not found. Record a call first.' });
    }

    const transcriptPath = audioPath.replace(/\.(m4a|mp3)$/i, '.transcript.txt');
    const job = createJob('transcribe');

    (async () => {
      try {
        let lines = ['# Transcript', ''];
        let usedModel = 'unknown';
        let diarizationSegments = null;
        
        // Helper function to redact words
        const redactText = (text) => {
          if (!transcriptOptions.redactWords || transcriptOptions.redactWords.length === 0) {
            return text;
          }
          let redacted = text;
          for (const word of transcriptOptions.redactWords) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            redacted = redacted.replace(regex, '[REDACTED]');
          }
          return redacted;
        };
        
        // Track if AssemblyAI succeeded
        let assemblyAISucceeded = false;
        
        // Use AssemblyAI if speaker diarization is requested and AssemblyAI is configured
        if (transcriptOptions.speakerDiarization && assemblyai) {
          console.log('🎤 Speaker diarization requested - using AssemblyAI');
          try {
            const result = await transcribeWithAssemblyAI(
              audioPath,
              transcriptOptions,
              (percent, message) => updateJob(job.id, { percent, message })
            );
            lines.push(...result.lines);
            usedModel = result.model;
            assemblyAISucceeded = true;
            console.log('✅ AssemblyAI transcription completed successfully');
          } catch (assemblyError) {
            console.error('❌ AssemblyAI transcription failed:', assemblyError);
            updateJob(job.id, { percent: 10, message: 'AssemblyAI unavailable, using Whisper without speaker diarization...' });
            // Will fall through to Whisper transcription below
          }
        } else if (transcriptOptions.speakerDiarization && !assemblyai) {
          console.log('⚠️  Speaker diarization requested but AssemblyAI not configured');
          // Add note that speaker diarization is unavailable
          lines.push('**Note:** Speaker diarization is currently unavailable. Please configure AssemblyAI API key for speaker identification.');
          lines.push('');
          updateJob(job.id, { percent: 10, message: 'Speaker diarization unavailable, proceeding with standard transcription...' });
        }
        
        // Only proceed with Whisper if AssemblyAI didn't succeed
        if (!assemblyAISucceeded && openai) {
          try {
            updateJob(job.id, { percent: 15, message: 'Transcribing with OpenAI Whisper...' });

            const whisperParams = {
              file: fs.createReadStream(audioPath),
              model: OPENAI_TRANSCRIBE_MODEL,
              response_format: 'verbose_json',
            };

            const transcription = await openai.audio.transcriptions.create(whisperParams);

            updateJob(job.id, { percent: 85, message: 'Formatting transcript...' });
            const segments = transcription.segments || [];
            
            if (segments.length) {
              let lastEndTime = 0;
              
              for (let i = 0; i < segments.length; i++) {
                const seg = segments[i];
                const start = Math.floor(seg.start || 0);
                const end = Math.floor(seg.end || 0);
                const gap = start - lastEndTime;
                
                let line = '';
                
                // Add timestamp if requested
                if (transcriptOptions.timestamps) {
                  const hh = Math.floor(start / 3600);
                  const mm = Math.floor((start % 3600) / 60);
                  const ss = start % 60;
                  const ts = `[${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}]`;
                  line += `${ts} `;
                }
                
                // Add text with redaction
                let text = seg.text?.trim() || '';
                text = redactText(text);
                line += text;
                
                // Add pause indicator if requested and there's a significant pause
                if (transcriptOptions.pauses && gap > 2 && i > 0) {
                  line += ` [pause: ${gap}s]`;
                }
                
                if (line.trim()) lines.push(line);
                lastEndTime = end;
              }
            } else {
              let text = (transcription.text || '').trim();
              text = redactText(text);
              lines.push(text);
            }
            usedModel = 'OpenAI Whisper';
          } catch (whisperError) {
            console.error('OpenAI Whisper failed:', whisperError);
            console.error('Error details:', {
              message: whisperError.message,
              status: whisperError.status,
              type: whisperError.type,
              code: whisperError.code
            });
            updateJob(job.id, { percent: 10, message: `Whisper failed: ${whisperError.message}. Trying OpenRouter fallback...` });
            
            // Fallback to OpenRouter
            if (openrouter) {
              updateJob(job.id, { percent: 30, message: 'Transcribing with OpenRouter Whisper...' });
              
              const transcription = await openrouter.audio.transcriptions.create({
                file: fs.createReadStream(audioPath),
                model: OPENROUTER_TRANSCRIBE_MODEL,
                response_format: 'verbose_json',
              });

              updateJob(job.id, { percent: 70, message: 'Aligning speakers with transcript...' });
              let segments = transcription.segments || [];
              
              if (diarizationSegments && segments.length) {
                segments = alignSegmentsWithSpeakers(segments, diarizationSegments);
              }
              
              updateJob(job.id, { percent: 85, message: 'Formatting transcript...' });
              
              if (segments.length) {
                let lastSpeaker = null;
                let lastEndTime = 0;
                
                for (let i = 0; i < segments.length; i++) {
                  const seg = segments[i];
                  const start = Math.floor(seg.start || 0);
                  const end = Math.floor(seg.end || 0);
                  const gap = start - lastEndTime;
                  
                  let line = '';
                  
                  if (transcriptOptions.timestamps) {
                    const hh = Math.floor(start / 3600);
                    const mm = Math.floor((start % 3600) / 60);
                    const ss = start % 60;
                    const ts = `[${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}]`;
                    line += `${ts} `;
                  }
                  
                  if (transcriptOptions.speakerDiarization) {
                    const currentSpeaker = seg.speaker;
                    
                    if (currentSpeaker && currentSpeaker !== lastSpeaker) {
                      line += `Speaker ${currentSpeaker}: `;
                      lastSpeaker = currentSpeaker;
                    } else if (!currentSpeaker && !diarizationSegments) {
                      if (i === 0 || gap > 2) {
                        const speakerNum = (i === 0 || gap > 2) ? ((lastSpeaker === 1) ? 2 : 1) : lastSpeaker;
                        line += `Speaker ${speakerNum}: `;
                        lastSpeaker = speakerNum;
                      }
                    }
                  }
                  
                  let text = seg.text?.trim() || '';
                  text = redactText(text);
                  line += text;
                  
                  if (transcriptOptions.pauses && gap > 2 && i > 0) {
                    line += ` [pause: ${gap}s]`;
                  }
                  
                  if (line.trim()) lines.push(line);
                  lastEndTime = end;
                }
              } else {
                let text = (transcription.text || '').trim();
                text = redactText(text);
                lines.push(text);
              }
              usedModel = 'OpenRouter Whisper (Fallback)';
            } else {
              throw new Error('Both OpenAI Whisper and OpenRouter are unavailable. Please configure API keys.');
            }
          }
        } else if (!assemblyAISucceeded && openrouter) {
          // If OpenAI is not configured and AssemblyAI didn't succeed, use OpenRouter directly
          updateJob(job.id, { percent: 10, message: 'Transcribing with OpenRouter Whisper...' });
          
          const transcription = await openrouter.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: OPENROUTER_TRANSCRIBE_MODEL,
            response_format: 'verbose_json',
          });

          updateJob(job.id, { percent: 85, message: 'Formatting transcript...' });
          const segments = transcription.segments || [];
          
          if (segments.length) {
            let lastEndTime = 0;
            
            for (let i = 0; i < segments.length; i++) {
              const seg = segments[i];
              const start = Math.floor(seg.start || 0);
              const end = Math.floor(seg.end || 0);
              const gap = start - lastEndTime;
              
              let line = '';
              
              if (transcriptOptions.timestamps) {
                const hh = Math.floor(start / 3600);
                const mm = Math.floor((start % 3600) / 60);
                const ss = start % 60;
                const ts = `[${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}]`;
                line += `${ts} `;
              }
              
              let text = seg.text?.trim() || '';
              text = redactText(text);
              line += text;
              
              if (transcriptOptions.pauses && gap > 2 && i > 0) {
                line += ` [pause: ${gap}s]`;
              }
              
              if (line.trim()) lines.push(line);
              lastEndTime = end;
            }
          } else {
            let text = (transcription.text || '').trim();
            text = redactText(text);
            lines.push(text);
          }
          usedModel = 'OpenRouter Whisper';
        } else if (!assemblyAISucceeded) {
          throw new Error('No transcription service configured. Please set OPENAI_API_KEY, OPENROUTER_API_KEY, or ASSEMBLYAI_API_KEY.');
        }

        // Generate PDF version of transcript
        const transcriptPdfPath = transcriptPath.replace(/\.txt$/i, '.pdf');
        const pdfDoc = new PDFDocument();
        const pdfStream = fs.createWriteStream(transcriptPdfPath);
        pdfDoc.pipe(pdfStream);
        
        // Add IBM branding header
        pdfDoc.fontSize(24).font('Helvetica-Bold').text('IBM Recap', { align: 'center' });
        pdfDoc.moveDown();
        pdfDoc.fontSize(16).font('Helvetica').text('Meeting Transcript', { align: 'center' });
        pdfDoc.moveDown();
        pdfDoc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        pdfDoc.moveDown(2);
        
        // Add transcript content
        pdfDoc.fontSize(11);
        let lastSpeaker = null;
        
        for (const line of lines) {
          if (line.startsWith('#')) {
            // Header lines
            pdfDoc.fontSize(14).font('Helvetica-Bold').text(line.replace(/^#\s*/, ''), { continued: false });
            pdfDoc.moveDown(0.5);
            pdfDoc.fontSize(11).font('Helvetica');
          } else if (line.trim()) {
            // Check if line contains a speaker label
            const speakerMatch = line.match(/^(\[[\d:]+\]\s*)?(Speaker [A-Z]:)\s*(.*)$/);
            
            if (speakerMatch) {
              const timestamp = speakerMatch[1] || '';
              const speaker = speakerMatch[2];
              const text = speakerMatch[3];
              
              // Add spacing between different speakers
              if (lastSpeaker && lastSpeaker !== speaker) {
                pdfDoc.moveDown(1);
              }
              
              // Write timestamp in regular font if present
              if (timestamp) {
                pdfDoc.font('Helvetica').text(timestamp, { continued: true });
              }
              
              // Write speaker label in bold
              pdfDoc.font('Helvetica-Bold').text(speaker + ' ', { continued: true });
              
              // Write the rest of the text in regular font
              pdfDoc.font('Helvetica').text(text, { continued: false });
              
              lastSpeaker = speaker;
            } else {
              // Regular line without speaker label
              pdfDoc.font('Helvetica').text(line, { continued: false });
              lastSpeaker = null;
            }
          }
        }
        
        pdfDoc.end();
        await new Promise((resolve) => pdfStream.on('finish', resolve));
        fs.writeFileSync(transcriptPath, `${lines.join('\n')}\n`, 'utf8');
        writeMeta({ audioPath, transcriptPath });

        updateJob(job.id, {
          status: 'done',
          percent: 100,
          message: 'Transcription complete.',
          result: { transcriptPath },
        });
      } catch (err) {
        console.error('Transcription error:', err);
        console.error('Error stack:', err.stack);
        updateJob(job.id, {
          status: 'error',
          percent: 100,
          message: 'Transcription failed.',
          error: String(err.message || err),
        });
      }
    })();

    return res.json({ ok: true, jobId: job.id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post('/api/summarize', async (req, res) => {
  try {
    const customPrompt = req.body?.customPrompt;

    const meta = readMeta();
    const transcriptPath = req.body?.transcriptPath || meta.transcriptPath;
    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      return res.status(400).json({ ok: false, error: 'Transcript file not found. Transcribe first.' });
    }

    const summaryPath = transcriptPath.replace(/\.transcript\.txt$/i, '.summary.md');
    const transcript = fs.readFileSync(transcriptPath, 'utf8');
    const job = createJob('summarize');

    (async () => {
      try {
        updateJob(job.id, { percent: 10, message: 'Preparing summarization...' });
        
        // Use custom prompt if provided, otherwise use default
        const systemPrompt = customPrompt || `You are a concise meeting analyst. Return ONLY markdown (no preface) with exactly these sections:
## Meeting purpose
## Key discussion points
## Decisions made
## Action items
## Risks / blockers
## Open questions

Rules:
- Keep executive-level and concise
- 5-10 bullets max in Key discussion points
- Action item format: Owner — Task — Due date/ETA (TBD if unknown)
- Do not invent facts
- If no evidence for a section, write: - None captured.`;

        let summary = '';
        let usedModel = 'unknown';

        // Try OpenAI GPT-4o first (primary)
        if (openai) {
          try {
            updateJob(job.id, { percent: 35, message: 'Generating summary with GPT-4o...' });
            const response = await openai.chat.completions.create({
              model: OPENAI_SUMMARY_MODEL,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `TRANSCRIPT:\n${transcript}` },
              ],
              temperature: 0.3,
              max_tokens: 2000,
            });

            summary = (response.choices[0]?.message?.content || '').trim();
            usedModel = 'GPT-4o';
          } catch (gptError) {
            console.error('GPT-4o failed, falling back to OpenRouter:', gptError);
            updateJob(job.id, { percent: 35, message: 'GPT-4o failed, trying OpenRouter fallback...' });
            
            // Fallback to OpenRouter
            if (openrouter) {
              updateJob(job.id, { percent: 50, message: 'Generating summary with Llama 3.1 8B...' });
              
              const response = await openrouter.chat.completions.create({
                model: OPENROUTER_SUMMARY_MODEL,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: `TRANSCRIPT:\n${transcript}` },
                ],
                temperature: 0.3,
                max_tokens: 2000,
              });

              summary = (response.choices[0]?.message?.content || '').trim();
              usedModel = 'Llama 3.1 8B (OpenRouter Fallback)';
            } else {
              throw new Error('Both GPT-4o and OpenRouter are unavailable. Please configure API keys.');
            }
          }
        } else if (openrouter) {
          // If OpenAI is not configured, use OpenRouter directly
          updateJob(job.id, { percent: 35, message: 'Generating summary with Llama 3.1 8B...' });
          
          const response = await openrouter.chat.completions.create({
            model: OPENROUTER_SUMMARY_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `TRANSCRIPT:\n${transcript}` },
            ],
            temperature: 0.3,
            max_tokens: 2000,
          });

          summary = (response.choices[0]?.message?.content || '').trim();
          usedModel = 'Llama 3.1 8B (OpenRouter)';
        } else {
          throw new Error('No summarization service configured. Please set OPENAI_API_KEY or OPENROUTER_API_KEY.');
        }

        updateJob(job.id, { percent: 85, message: 'Writing summary file...' });
        fs.writeFileSync(summaryPath, `${summary}\n`, 'utf8');
        
        // Count action items and open questions from the summary
        const actionItemsCount = (summary.match(/## Action items[\s\S]*?(?=##|$)/i)?.[0]?.match(/^[\s]*-/gm) || []).length;
        const openQuestionsCount = (summary.match(/## Open questions[\s\S]*?(?=##|$)/i)?.[0]?.match(/^[\s]*-/gm) || []).length;
        
        // Generate PDF version of summary
        const summaryPdfPath = summaryPath.replace(/\.md$/i, '.pdf');
        const summaryPdfDoc = new PDFDocument();
        const summaryPdfStream = fs.createWriteStream(summaryPdfPath);
        summaryPdfDoc.pipe(summaryPdfStream);
        
        // Add IBM branding header
        summaryPdfDoc.fontSize(24).font('Helvetica-Bold').text('IBM Recap', { align: 'center' });
        summaryPdfDoc.moveDown();
        summaryPdfDoc.fontSize(16).font('Helvetica').text('Meeting Summary', { align: 'center' });
        summaryPdfDoc.moveDown();
        summaryPdfDoc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        summaryPdfDoc.moveDown(2);
        
        // Parse and format markdown content
        const summaryLines = summary.split('\n');
        summaryPdfDoc.fontSize(11).font('Helvetica');
        
        for (const line of summaryLines) {
          if (line.startsWith('## ')) {
            summaryPdfDoc.moveDown(0.5);
            summaryPdfDoc.fontSize(14).font('Helvetica-Bold').text(line.replace(/^##\s*/, ''));
            summaryPdfDoc.moveDown(0.3);
            summaryPdfDoc.fontSize(11).font('Helvetica');
          } else if (line.startsWith('# ')) {
            summaryPdfDoc.moveDown(0.5);
            summaryPdfDoc.fontSize(16).font('Helvetica-Bold').text(line.replace(/^#\s*/, ''));
            summaryPdfDoc.moveDown(0.3);
            summaryPdfDoc.fontSize(11).font('Helvetica');
          } else if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
            // This is a bold section header (e.g., **List of attendees**)
            const headerText = line.trim().slice(2, -2); // Remove ** from both ends
            summaryPdfDoc.moveDown(0.5);
            summaryPdfDoc.fontSize(12).font('Helvetica-Bold').text(headerText);
            summaryPdfDoc.moveDown(0.2);
            summaryPdfDoc.fontSize(11).font('Helvetica');
          } else if (line.trim().startsWith('- ')) {
            // Handle bullet points - preserve bold formatting
            let bulletText = line.trim().substring(2); // Remove "- "
            
            // Check if the bullet contains bold text (e.g., **Action items**)
            const boldPattern = /\*\*([^*]+)\*\*/g;
            const parts = [];
            let lastIndex = 0;
            let match;
            
            while ((match = boldPattern.exec(bulletText)) !== null) {
              // Add text before the bold part
              if (match.index > lastIndex) {
                parts.push({ text: bulletText.substring(lastIndex, match.index), bold: false });
              }
              // Add the bold part
              parts.push({ text: match[1], bold: true });
              lastIndex = match.index + match[0].length;
            }
            
            // Add any remaining text after the last bold part
            if (lastIndex < bulletText.length) {
              parts.push({ text: bulletText.substring(lastIndex), bold: false });
            }
            
            // If no bold parts found, treat as regular text
            if (parts.length === 0) {
              summaryPdfDoc.text(`  • ${bulletText}`, { indent: 20 });
            } else {
              // Render with mixed formatting
              summaryPdfDoc.text('  • ', { continued: true, indent: 20 });
              parts.forEach((part, index) => {
                summaryPdfDoc.font(part.bold ? 'Helvetica-Bold' : 'Helvetica')
                  .text(part.text, { continued: index < parts.length - 1 });
              });
              summaryPdfDoc.font('Helvetica'); // Reset to regular font
            }
          } else if (line.trim()) {
            // Regular paragraph text - remove any ** markers
            let paragraphText = line.replace(/\*\*/g, ''); // Remove all ** markers
            summaryPdfDoc.text(paragraphText);
          } else {
            summaryPdfDoc.moveDown(0.3);
          }
        }
        
        summaryPdfDoc.end();
        await new Promise((resolve) => summaryPdfStream.on('finish', resolve));
        writeMeta({ summaryPath });

        updateJob(job.id, {
          status: 'done',
          percent: 100,
          message: 'Summary complete.',
          result: {
            summaryPath,
            actionItemsCount,
            openQuestionsCount
          },
        });
      } catch (err) {
        updateJob(job.id, {
          status: 'error',
          percent: 100,
          message: 'Summarization failed.',
          error: String(err.message || err),
        });
      }
    })();

    return res.json({ ok: true, jobId: job.id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.get('/api/download/:type', (req, res) => {
  const type = req.params.type;
  const meta = readMeta();
  let filePath = null;
  
  if (type === 'audio') {
    filePath = meta.audioPath;
  } else if (type === 'transcript') {
    // Serve PDF version of transcript
    filePath = meta.transcriptPath;
    if (filePath) {
      const pdfPath = filePath.replace(/\.txt$/i, '.pdf');
      if (fs.existsSync(pdfPath)) {
        filePath = pdfPath;
      }
    }
  } else if (type === 'summary') {
    // Serve PDF version of summary
    filePath = meta.summaryPath;
    if (filePath) {
      const pdfPath = filePath.replace(/\.md$/i, '.pdf');
      if (fs.existsSync(pdfPath)) {
        filePath = pdfPath;
      }
    }
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ ok: false, error: `No ${type} file available.` });
  }

  const fileName = path.basename(filePath);
  const contentType = mime.lookup(filePath) || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  fs.createReadStream(filePath).pipe(res);
});

// Serve audio files from output directory
app.get('/api/audio/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(OUTPUT_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: 'Audio file not found' });
    }
    
    const contentType = mime.lookup(filePath) || 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`TeamsCallSummarizer running at http://localhost:${PORT}`);
});
