# AssemblyAI Speaker Diarization Setup

## Simple 3-Step Setup (No Python Required!)

AssemblyAI provides cloud-based speaker diarization - no local setup, no Python dependencies, just an API key.

### Step 1: Get AssemblyAI API Key (2 minutes)

1. Go to https://www.assemblyai.com/
2. Click "Start building for free"
3. Sign up for a free account
4. Go to your dashboard
5. Copy your API key

**Free Tier Includes:**
- 5 hours of transcription per month
- Full speaker diarization support
- No credit card required

### Step 2: Add API Key to .env (30 seconds)

```bash
# Add to your .env file
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
```

### Step 3: Test It! (1 minute)

1. Start the server: `npm start`
2. Open http://localhost:8787
3. Upload an audio file with multiple speakers
4. Click "Transcript Options"
5. Select "Custom Transcript"
6. Enable "Speaker Diarization"
7. Click "Generate Transcript"

**That's it!** AssemblyAI will automatically:
- Transcribe the audio
- Identify different speakers
- Label them as Speaker A, Speaker B, etc.
- Return accurate speaker-labeled transcript

## How It Works

When speaker diarization is enabled:

1. **AssemblyAI First** (if configured)
   - Uploads audio to AssemblyAI
   - Gets transcription with native speaker labels
   - Returns formatted transcript

2. **Fallback to Pyannote** (if AssemblyAI fails or not configured)
   - Uses local Pyannote service
   - Requires Python setup

3. **Heuristic Fallback** (if both unavailable)
   - Uses pause-based detection
   - Less accurate but always works

## Example Output

```
[00:00:05] Speaker A: Hello everyone, welcome to today's meeting.
[00:00:12] Speaker B: Thanks for having me. I'd like to discuss the project timeline.
[00:00:20] Speaker A: Great, let's start with the current status.
[00:00:28] Speaker C: I can provide an update on the development progress.
```

## Advantages Over Local Setup

| Feature | AssemblyAI | Local Pyannote |
|---------|------------|----------------|
| Setup Time | 2 minutes | 30+ minutes |
| Dependencies | None | Python, PyTorch, etc. |
| Python Version | N/A | Requires 3.11 or older |
| Works on Any System | ✅ Yes | ❌ Depends on Python |
| Accuracy | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Speed | Fast (cloud) | Slower (local CPU) |
| Cost | Free tier available | Free (but uses resources) |

## Pricing

**Free Tier:**
- 5 hours/month transcription
- Full speaker diarization
- No credit card required

**Pay-as-you-go:**
- $0.00025 per second (~$0.90/hour)
- $0.00003 per second for speaker diarization (~$0.11/hour)
- Total: ~$1.01 per hour of audio

**For most users:** Free tier is plenty for meeting transcription.

## Troubleshooting

### "AssemblyAI API key not configured"

**Solution:** Add `ASSEMBLYAI_API_KEY` to your `.env` file

### "AssemblyAI transcription failed"

**Possible causes:**
1. Invalid API key
2. Network connection issue
3. Audio file format not supported
4. Free tier limit exceeded

**Solution:**
1. Verify API key is correct
2. Check internet connection
3. Try with MP3 or WAV file
4. Check your AssemblyAI dashboard for usage

### Falls back to Pyannote

**This is normal!** The app automatically falls back to local Pyannote if:
- AssemblyAI is not configured
- AssemblyAI request fails
- You prefer local processing

## API Key Security

**Best Practices:**
1. ✅ Store in `.env` file (not committed to git)
2. ✅ Use environment variables in production
3. ✅ Rotate keys periodically
4. ❌ Never commit API keys to git
5. ❌ Never share API keys publicly

## Comparison: AssemblyAI vs Pyannote

### Use AssemblyAI When:
- ✅ You want quick setup (2 minutes)
- ✅ You don't want to deal with Python
- ✅ You have internet connection
- ✅ You're okay with cloud processing
- ✅ You want consistent performance

### Use Pyannote When:
- ✅ You need offline processing
- ✅ You have privacy/security requirements
- ✅ You want to avoid API costs
- ✅ You have Python 3.11 or older
- ✅ You're comfortable with technical setup

## Next Steps

1. **Get API key** from https://www.assemblyai.com/
2. **Add to `.env`**: `ASSEMBLYAI_API_KEY=your_key_here`
3. **Restart server**: `npm start`
4. **Test with audio** that has multiple speakers
5. **Enjoy accurate speaker diarization!**

## Support

- **AssemblyAI Docs:** https://www.assemblyai.com/docs
- **API Reference:** https://www.assemblyai.com/docs/api-reference
- **Support:** support@assemblyai.com

## Summary

AssemblyAI is the **easiest way** to add speaker diarization:
- ✅ 2-minute setup
- ✅ No Python required
- ✅ No dependencies
- ✅ Works on any system
- ✅ Free tier available
- ✅ Highly accurate

Just add your API key and you're done!