import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { app } from 'electron';
import { TranscriptionConfig, TranscriptionResult, TranscriptionProgress } from '@clipforge/shared';
import { FFmpegService } from './ffmpegService';

export class TranscriptionService {
  private ffmpegService: FFmpegService;

  constructor() {
    this.ffmpegService = new FFmpegService();
  }

  /**
   * Extract audio from video file using FFmpeg
   */
  async extractAudioFromVideo(videoPath: string, outputPath: string): Promise<string> {
    try {
      // Extract audio as MP3 for better API efficiency
      await this.ffmpegService.extractAudio(videoPath, outputPath, 'mp3');
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to extract audio from video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   */
  async transcribeAudio(
    audioPath: string,
    config: TranscriptionConfig,
    onProgress?: (progress: TranscriptionProgress) => void
  ): Promise<TranscriptionResult> {
    try {
      // Update progress
      onProgress?.({
        stage: 'transcribing',
        progress: 10,
        message: 'Uploading audio to OpenAI...'
      });

      // Read audio file
      const audioBuffer = await fs.readFile(audioPath);
      
      // Create form data for OpenAI API
      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      formData.append('file', audioBlob, 'audio.mp3');
      formData.append('model', config.model || 'whisper-1');
      formData.append('response_format', 'text');
      // Don't specify language parameter - let Whisper auto-detect

      onProgress?.({
        stage: 'transcribing',
        progress: 30,
        message: 'Processing with OpenAI Whisper...'
      });

      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      onProgress?.({
        stage: 'transcribing',
        progress: 80,
        message: 'Processing transcription...'
      });

      // Get transcription text
      const transcriptionText = await response.text();

      onProgress?.({
        stage: 'transcribing',
        progress: 100,
        message: 'Transcription complete'
      });

      return {
        text: transcriptionText.trim()
      };

    } catch (error) {
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format transcription as plain text
   */
  formatAsPlainText(transcription: TranscriptionResult): string {
    return transcription.text;
  }

  /**
   * Save transcription to text file
   */
  async saveTranscription(content: string, outputPath: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });

      // Write file with UTF-8 encoding
      await fs.writeFile(outputPath, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save transcription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate transcription file path based on video file path
   */
  generateTranscriptionPath(videoPath: string): string {
    const dir = dirname(videoPath);
    const baseName = basename(videoPath, extname(videoPath));
    return join(dir, `${baseName}.txt`);
  }

  /**
   * Clean up temporary audio file
   */
  async cleanupTempAudio(audioPath: string): Promise<void> {
    try {
      await fs.unlink(audioPath);
    } catch (error) {
      // Ignore cleanup errors - file might not exist
      console.warn('Failed to cleanup temporary audio file:', error);
    }
  }

  /**
   * Main transcription workflow
   */
  async transcribeVideo(
    videoPath: string,
    config: TranscriptionConfig,
    onProgress?: (progress: TranscriptionProgress) => void
  ): Promise<string> {
    const tempDir = join(app.getPath('temp'), 'clipforge-transcription');
    const audioPath = join(tempDir, `audio-${Date.now()}.mp3`);
    const transcriptionPath = this.generateTranscriptionPath(videoPath);

    try {
      // Ensure temp directory exists
      await fs.mkdir(tempDir, { recursive: true });

      onProgress?.({
        stage: 'extracting',
        progress: 0,
        message: 'Extracting audio from video...'
      });

      // Extract audio
      await this.extractAudioFromVideo(videoPath, audioPath);

      onProgress?.({
        stage: 'extracting',
        progress: 50,
        message: 'Audio extraction complete'
      });

      // Transcribe audio
      const result = await this.transcribeAudio(audioPath, config, onProgress);

      onProgress?.({
        stage: 'formatting',
        progress: 90,
        message: 'Saving transcription...'
      });

      // Format and save transcription
      const plainText = this.formatAsPlainText(result);
      await this.saveTranscription(plainText, transcriptionPath);

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Transcription saved successfully'
      });

      return transcriptionPath;

    } finally {
      // Clean up temporary audio file
      await this.cleanupTempAudio(audioPath);
    }
  }
}
