/**
 * StreamInd SDK - Audio Streaming Example
 *
 * Demonstrates:
 * - Sending audio data (OPUS format)
 * - Receiving audio responses
 * - Audio-related directives
 * - Binary protocol (14-byte header + masked data)
 */

import { SDK, Signal, Directive, ErrorCode, Config } from '../src';
import * as fs from 'fs';

async function main() {
  const sdk = new SDK();

  // Create configuration
  const config: Config = {
    deviceId: 'audio-device-001',
    deviceType: 'voice-assistant',
    endpoint: 'wss://platform.example.com/signals',
    tenantId: 'tenant-123',
    productId: 'product-456',
    productKey: 'your-secret-key'
  };

  // Register terminal
  sdk.registerTerminal('terminal-1', config);

  // Set audio data callback (receive audio from platform)
  sdk.setAudioDataCallback('terminal-1', (audioData: Buffer) => {
    console.log(`Received audio data: ${audioData.length} bytes`);

    // In a real application, you would:
    // 1. Decode the audio (OPUS -> PCM)
    // 2. Play the audio through speakers
    // 3. Or save to file
    saveAudioToFile(audioData, 'received_audio.opus');
  });

  // Set directive callback for audio-related commands
  sdk.setDirectiveCallback('terminal-1', (directive: Directive) => {
    console.log(`Received directive: ${directive.name}`);

    // Platform sends this directive before sending audio stream
    if (directive.name === 'audio.opus_data_start') {
      console.log('Platform will start sending audio...');
      console.log('Preparing audio playback...');

      // Get audio metadata
      const sampleRate = directive.getIntParameter('sample_rate', 16000);
      const channels = directive.getIntParameter('channels', 1);
      const duration = directive.getNumberParameter('duration', 0);

      console.log(`  Sample rate: ${sampleRate} Hz`);
      console.log(`  Channels: ${channels}`);
      console.log(`  Duration: ${duration}s`);

      // Initialize audio playback system
      // ...
    } else if (directive.name === 'audio.opus_data_end') {
      console.log('Audio stream ended');
    }
  });

  // Set connection callback
  sdk.setConnectionCallback('terminal-1', (connected: boolean, errorMessage: string) => {
    if (connected) {
      console.log('✓ Connected to platform');
    } else {
      console.log(`✗ Disconnected: ${errorMessage}`);
    }
  });

  // Connect to platform
  const result = await sdk.connect('terminal-1');
  if (result !== ErrorCode.OK) {
    console.error('Connection failed:', sdk.getLastError());
    return;
  }

  console.log('Connected successfully!');

  // Send audio data example
  await sendAudioData(sdk);

  // Print statistics
  const stats = sdk.getTerminalStatistics('terminal-1');
  if (stats) {
    console.log('\n=== Statistics ===');
    console.log(`Signals sent: ${stats.signalsSent}`);
    console.log(`Audio chunks sent: ${stats.audioSent}`);
    console.log(`Directives received: ${stats.directivesReceived}`);
    console.log(`Audio chunks received: ${stats.audioReceived}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(`Uptime: ${stats.uptimeSeconds.toFixed(1)}s`);
  }

  // Keep running
  console.log('\nPress Ctrl+C to exit...');
  await new Promise(() => {});  // Keep alive
}

/**
 * Send audio data to platform
 */
async function sendAudioData(sdk: SDK) {
  console.log('\nSending audio data...');

  // Method 1: Send from file
  if (fs.existsSync('sample.opus')) {
    const audioData = fs.readFileSync('sample.opus');
    console.log(`Sending ${audioData.length} bytes of OPUS audio...`);

    const result = await sdk.sendAudioData('terminal-1', audioData, 'opus');
    if (result === ErrorCode.OK) {
      console.log('✓ Audio data sent successfully');
    } else {
      console.error('✗ Failed to send audio:', sdk.getLastError());
    }
  } else {
    // Method 2: Send simulated audio chunks
    console.log('Sending simulated audio chunks...');

    for (let i = 0; i < 5; i++) {
      // Simulate 20ms audio chunk (160 bytes for 16kHz mono PCM)
      const audioChunk = Buffer.alloc(160, i);

      const result = await sdk.sendAudioData('terminal-1', audioChunk, 'opus');
      if (result === ErrorCode.OK) {
        console.log(`  Chunk ${i + 1}/5 sent`);
      } else {
        console.error(`  Chunk ${i + 1}/5 failed:`, sdk.getLastError());
        break;
      }

      // Wait 20ms between chunks (simulate real-time streaming)
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    console.log('Audio streaming completed');
  }
}

/**
 * Save received audio to file
 */
function saveAudioToFile(audioData: Buffer, filename: string) {
  try {
    fs.appendFileSync(filename, audioData);
    console.log(`  Saved to ${filename}`);
  } catch (error: any) {
    console.error(`Failed to save audio: ${error.message}`);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
