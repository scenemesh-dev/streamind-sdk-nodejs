/**
 * StreamInd SDK WebSocket Transport
 *
 * WebSocket connection management, heartbeat, and auto-reconnection
 */

import WebSocket from 'ws';
import { Config, Signal, Directive, Statistics, getWebSocketUrl, getConfigWithDefaults } from './models';
import { ErrorCode, StreamIndError } from './errors';

/**
 * Callback types
 */
export type ConnectionCallback = (connected: boolean, errorMessage: string) => void;
export type DirectiveCallback = (directive: Directive) => void;
export type AudioDataCallback = (data: Buffer) => void;
export type ErrorCallback = (errorCode: ErrorCode, message: string) => void;
export type CloseCallback = (code: number, reason: string) => void;

/**
 * WebSocket Transport Layer
 */
export class WebSocketTransport {
  private config: Required<Config>;
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private lastActivity: number = 0;
  private shouldReconnect: boolean = true;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectTime: number = 0;

  // Callbacks
  private onConnected: ConnectionCallback | null = null;
  private onDirective: DirectiveCallback | null = null;
  private onAudioData: AudioDataCallback | null = null;
  private onError: ErrorCallback | null = null;
  private onClose: CloseCallback | null = null;

  // Statistics
  private stats = {
    signalsSent: 0,
    audioSent: 0,
    directivesReceived: 0,
    audioReceived: 0,
    errors: 0
  };

  constructor(config: Config) {
    this.config = getConfigWithDefaults(config);
  }

  /**
   * Set connection callback
   */
  setConnectionCallback(callback: ConnectionCallback): void {
    this.onConnected = callback;
  }

  /**
   * Set directive callback
   */
  setDirectiveCallback(callback: DirectiveCallback): void {
    this.onDirective = callback;
  }

  /**
   * Set audio data callback
   */
  setAudioDataCallback(callback: AudioDataCallback): void {
    this.onAudioData = callback;
  }

  /**
   * Set error callback
   */
  setErrorCallback(callback: ErrorCallback): void {
    this.onError = callback;
  }

  /**
   * Set close callback
   */
  setCloseCallback(callback: CloseCallback): void {
    this.onClose = callback;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(traceId: string = ''): Promise<void> {
    if (this.connected) {
      throw new StreamIndError(ErrorCode.ALREADY_CONNECTED);
    }

    this.shouldReconnect = true;
    const url = getWebSocketUrl(this.config, traceId);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.stats.errors++;
        if (this.onError) {
          this.onError(ErrorCode.CONNECTION_TIMEOUT, 'Connection timeout');
        }
        if (this.onConnected) {
          this.onConnected(false, 'Connection timeout');
        }
        reject(new StreamIndError(ErrorCode.CONNECTION_TIMEOUT));
      }, this.config.connectionTimeoutMs);

      try {
        this.ws = new WebSocket(url, {
          perMessageDeflate: false,  // Disable compression for lower latency
          maxPayload: this.config.maxMessageSize
        });

        this.ws.on('open', () => {
          clearTimeout(timeout);

          // Enable TCP_NODELAY for real-time performance
          if (this.ws && (this.ws as any)._socket) {
            try {
              (this.ws as any)._socket.setNoDelay(true);
            } catch (e) {
              console.warn('Failed to set TCP_NODELAY:', e);
            }
          }

          this.connected = true;
          this.reconnectAttempts = 0;
          this.lastActivity = Date.now();
          this.connectTime = Date.now();

          console.log('Connected to platform');
          if (this.onConnected) {
            this.onConnected(true, '');
          }

          // Start heartbeat
          this.startHeartbeat();

          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.lastActivity = Date.now();

          if (Buffer.isBuffer(data)) {
            // Binary data (audio)
            this.stats.audioReceived++;
            if (this.onAudioData) {
              this.onAudioData(data);
            }
          } else {
            // Text message (directive or other)
            this.handleTextMessage(data.toString());
          }
        });

        this.ws.on('error', (error: Error) => {
          clearTimeout(timeout);
          this.stats.errors++;
          console.error('WebSocket error:', error);
          if (this.onError) {
            this.onError(ErrorCode.CONNECTION_FAILED, error.message);
          }
          if (!this.connected && this.onConnected) {
            this.onConnected(false, error.message);
          }
          reject(new StreamIndError(ErrorCode.CONNECTION_FAILED, error.message));
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          const reasonStr = reason.toString();
          console.warn(`Connection closed: ${code} - ${reasonStr}`);
          if (this.onClose) {
            this.onClose(code, reasonStr || 'Abnormal closure');
          }
          this.handleDisconnect();
        });

      } catch (error: any) {
        clearTimeout(timeout);
        this.stats.errors++;
        if (this.onError) {
          this.onError(ErrorCode.CONNECTION_FAILED, error.message);
        }
        if (this.onConnected) {
          this.onConnected(false, error.message);
        }
        reject(new StreamIndError(ErrorCode.CONNECTION_FAILED, error.message));
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  async disconnect(): Promise<void> {
    console.log('Disconnecting...');
    this.shouldReconnect = false;

    // Stop timers
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close(1000, 'Normal disconnection');
      this.ws = null;
    }

    this.connected = false;
    console.log('Disconnected');

    if (this.onClose) {
      this.onClose(1000, 'Normal disconnection');
    }
    if (this.onConnected) {
      this.onConnected(false, 'User disconnected');
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Send signal to platform
   */
  async sendSignal(signal: Signal): Promise<void> {
    if (!this.connected) {
      throw new StreamIndError(ErrorCode.NOT_CONNECTED);
    }

    // Auto-fill source fields
    if (!signal.source.receptorId) {
      signal.source.receptorId = this.config.deviceId;
    }
    if (!signal.source.receptorTopic) {
      signal.source.receptorTopic = this.config.deviceType;
    }
    if (!signal.source.generatedTime) {
      signal.source.generatedTime = signal.timestamp;
    }

    const jsonStr = signal.toJSON();

    // Check message size
    if (Buffer.byteLength(jsonStr, 'utf8') > this.config.maxMessageSize) {
      throw new StreamIndError(ErrorCode.SIGNAL_TOO_LARGE);
    }

    try {
      await this.sendMessage(jsonStr);
      this.lastActivity = Date.now();
      this.stats.signalsSent++;
    } catch (error: any) {
      console.error('Failed to send signal:', error);
      this.stats.errors++;
      if (this.onError) {
        this.onError(ErrorCode.SEND_FAILED, error.message);
      }
      throw new StreamIndError(ErrorCode.SEND_FAILED, error.message);
    }
  }

  /**
   * Send typed binary data to platform with 14-byte application-layer protocol
   *
   * **Currently supported data types** (verified by platform):
   * - "opus" - Audio data in OPUS format
   *
   * Protocol format (14-byte header):
   * - Byte 0:      0x82 (protocol identifier)
   * - Byte 1-2:    Data length (big-endian, 2 bytes)
   * - Byte 3-9:    Data type (7-byte ASCII, uppercase, zero-padded)
   * - Byte 10-13:  Mask key (4 random bytes for application-layer XOR masking)
   * - Byte 14+:    XOR-masked actual data
   *
   * Note: WebSocket library will add standard WebSocket framing/masking automatically.
   *       This 14-byte header is the application-layer protocol, NOT WebSocket framing.
   */
  async sendBinaryData(data: Buffer, dataType: string): Promise<void> {
    if (!this.connected) {
      throw new StreamIndError(ErrorCode.NOT_CONNECTED);
    }

    try {
      // Build application-layer protocol data (same as hardware SDK)
      const protocolData: number[] = [];

      // Byte 0: 0x82 (application layer protocol identifier)
      protocolData.push(0x82);

      // Byte 1-2: Data length (big-endian, 2 bytes)
      const dataLen = data.length;
      if (dataLen > 65535) {
        throw new StreamIndError(ErrorCode.SIGNAL_TOO_LARGE, 'Binary data exceeds 65535 bytes');
      }

      protocolData.push((dataLen >> 8) & 0xFF);  // High byte
      protocolData.push(dataLen & 0xFF);         // Low byte

      // Byte 3-9: Data type (7-byte ASCII, uppercase, padded with 0x00)
      const dataTypeStr = dataType.toUpperCase().substring(0, 7);  // e.g., "opus" -> "OPUS", max 7 chars
      const dataTypeBytes = Buffer.alloc(7);
      dataTypeBytes.write(dataTypeStr, 0, 'ascii');
      for (let i = 0; i < 7; i++) {
        protocolData.push(dataTypeBytes[i]);
      }

      // Byte 10-13: Mask key (4 random bytes) - application layer masking
      const maskKey = Buffer.allocUnsafe(4);
      for (let i = 0; i < 4; i++) {
        maskKey[i] = Math.floor(Math.random() * 256);
        protocolData.push(maskKey[i]);
      }

      // Byte 14+: XOR-masked actual data (application layer masking)
      // This is part of the application protocol, NOT WebSocket masking
      for (let i = 0; i < data.length; i++) {
        protocolData.push(data[i] ^ maskKey[i % 4]);
      }

      // Send through WebSocket (library will add WebSocket framing/masking automatically)
      await this.sendBinary(Buffer.from(protocolData));

      this.lastActivity = Date.now();
      this.stats.audioSent++;  // Keep using audioSent for backward compatibility

    } catch (error: any) {
      console.error('Failed to send binary data:', error);
      this.stats.errors++;
      if (this.onError) {
        this.onError(ErrorCode.SEND_FAILED, error.message);
      }
      throw new StreamIndError(ErrorCode.SEND_FAILED, error.message);
    }
  }

  /**
   * Convenience method: Send audio data to platform
   *
   * @param data Audio data buffer
   * @param audioFormat Audio format (default: "opus" - currently the only verified format)
   */
  async sendAudioData(data: Buffer, audioFormat: string = 'opus'): Promise<void> {
    await this.sendBinaryData(data, audioFormat);
  }

  /**
   * Get statistics
   */
  getStatistics(): Statistics {
    const uptime = this.connected && this.connectTime > 0
      ? (Date.now() - this.connectTime) / 1000
      : 0;

    return {
      signalsSent: this.stats.signalsSent,
      audioSent: this.stats.audioSent,
      directivesReceived: this.stats.directivesReceived,
      audioReceived: this.stats.audioReceived,
      errors: this.stats.errors,
      connected: this.connected,
      uptimeSeconds: uptime,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.stats = {
      signalsSent: 0,
      audioSent: 0,
      directivesReceived: 0,
      audioReceived: 0,
      errors: 0
    };
  }

  /**
   * Send text message
   */
  private async sendMessage(message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      this.ws.send(message, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Send binary message
   */
  private async sendBinary(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      this.ws.send(data, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Handle text message
   */
  private handleTextMessage(message: string): void {
    try {
      const data = JSON.parse(message);

      // Check if it's a directive
      if (data.name && data.id) {
        const directive = Directive.fromJSON(message);
        this.stats.directivesReceived++;
        if (this.onDirective && this.config.enableDirectiveReceiving) {
          this.onDirective(directive);
        }
      } else {
        console.debug('Received message:', data);
      }

    } catch (error) {
      console.warn('Invalid JSON message:', message);
      this.stats.errors++;
      if (this.onError) {
        this.onError(ErrorCode.INTERNAL_ERROR, 'Invalid JSON message');
      }
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }

    const sendHeartbeat = () => {
      if (!this.connected) {
        return;
      }

      // Only send heartbeat if no recent activity
      const now = Date.now();
      if (now - this.lastActivity >= this.config.heartbeatIntervalMs) {
        const heartbeat = JSON.stringify({ type: 'ping' });
        this.sendMessage(heartbeat).catch((error) => {
          console.error('Heartbeat failed:', error);
          this.handleDisconnect();
        });
      }

      this.heartbeatTimer = setTimeout(sendHeartbeat, this.config.heartbeatIntervalMs);
    };

    this.heartbeatTimer = setTimeout(sendHeartbeat, this.config.heartbeatIntervalMs);
  }

  /**
   * Handle disconnection and trigger reconnect
   */
  private handleDisconnect(): void {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.ws = null;

    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    console.warn('Disconnected from platform');
    if (this.onConnected) {
      this.onConnected(false, 'Connection lost');
    }

    // Trigger auto-reconnect
    if (this.shouldReconnect) {
      this.startReconnect();
    }
  }

  /**
   * Start reconnection loop
   */
  private startReconnect(): void {
    // Check max attempts
    if (this.config.maxReconnectAttempts > 0 &&
        this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    // Calculate backoff delay
    const delay = this.calculateBackoffDelay();
    console.log(`Reconnecting in ${(delay / 1000).toFixed(2)} seconds (attempt ${this.reconnectAttempts + 1})...`);

    this.reconnectTimer = setTimeout(async () => {
      if (!this.shouldReconnect || this.connected) {
        return;
      }

      this.reconnectAttempts++;
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnect failed:', error);
        this.startReconnect();  // Try again
      }
    }, delay);
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoffDelay(): number {
    const base = this.config.baseReconnectIntervalMs;
    const maxDelay = this.config.maxReconnectIntervalMs;
    const factor = this.config.backoffFactor;
    const jitter = this.config.jitterFactor;

    // Exponential backoff
    let delay = base * Math.pow(factor, this.reconnectAttempts);
    delay = Math.min(delay, maxDelay);

    // Add jitter
    const jitterAmount = delay * jitter * (Math.random() * 2 - 1);
    delay += jitterAmount;

    return Math.max(0, delay);
  }
}
