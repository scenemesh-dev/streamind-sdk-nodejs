/**
 * StreamInd SDK Main Class
 *
 * Multi-terminal management, high-performance async operations
 */

import { Config, Signal, Directive, Statistics } from './models';
import { ErrorCode } from './errors';
import { WebSocketTransport, ConnectionCallback, DirectiveCallback, AudioDataCallback, ErrorCallback, CloseCallback } from './transport';

/**
 * Terminal instance
 */
interface Terminal {
  config: Config;
  transport: WebSocketTransport;
}

/**
 * Global callback types (with terminal_id parameter)
 */
type GlobalConnectionCallback = (terminalId: string, connected: boolean, errorMessage: string) => void;
type GlobalDirectiveCallback = (terminalId: string, directive: Directive) => void;
type GlobalErrorCallback = (terminalId: string, errorCode: ErrorCode, message: string) => void;
type GlobalCloseCallback = (terminalId: string, code: number, reason: string) => void;

/**
 * StreamInd SDK
 *
 * High-performance WebSocket SDK with multi-terminal support
 */
export class SDK {
  private static readonly VERSION = '1.0.0';
  private terminals: Map<string, Terminal> = new Map();
  private lastError: string = '';

  // Global callbacks
  private globalConnectionCallback: GlobalConnectionCallback | null = null;
  private globalDirectiveCallback: GlobalDirectiveCallback | null = null;
  private globalErrorCallback: GlobalErrorCallback | null = null;
  private globalCloseCallback: GlobalCloseCallback | null = null;

  /**
   * Get SDK version
   */
  static getVersion(): string {
    return SDK.VERSION;
  }

  /**
   * Register a terminal
   */
  registerTerminal(terminalId: string, config: Config): ErrorCode {
    if (this.terminals.has(terminalId)) {
      this.lastError = `Terminal ${terminalId} already registered`;
      return ErrorCode.ALREADY_INITIALIZED;
    }

    const transport = new WebSocketTransport(config);

    // Apply global callbacks if set
    if (this.globalConnectionCallback) {
      transport.setConnectionCallback((connected, errorMessage) => {
        this.globalConnectionCallback!(terminalId, connected, errorMessage);
      });
    }

    if (this.globalDirectiveCallback) {
      transport.setDirectiveCallback((directive) => {
        this.globalDirectiveCallback!(terminalId, directive);
      });
    }

    if (this.globalErrorCallback) {
      transport.setErrorCallback((errorCode, message) => {
        this.globalErrorCallback!(terminalId, errorCode, message);
      });
    }

    if (this.globalCloseCallback) {
      transport.setCloseCallback((code, reason) => {
        this.globalCloseCallback!(terminalId, code, reason);
      });
    }

    this.terminals.set(terminalId, { config, transport });
    return ErrorCode.OK;
  }

  /**
   * Unregister a terminal
   */
  async unregisterTerminal(terminalId: string): Promise<ErrorCode> {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      this.lastError = `Terminal ${terminalId} not found`;
      return ErrorCode.TERMINAL_NOT_FOUND;
    }

    // Disconnect if connected
    if (terminal.transport.isConnected()) {
      await terminal.transport.disconnect();
    }

    this.terminals.delete(terminalId);
    return ErrorCode.OK;
  }

  /**
   * Get all registered terminal IDs
   */
  getAllTerminals(): string[] {
    return Array.from(this.terminals.keys());
  }

  /**
   * Get all connected terminal IDs
   */
  getConnectedTerminals(): string[] {
    const connected: string[] = [];
    for (const [terminalId, terminal] of this.terminals) {
      if (terminal.transport.isConnected()) {
        connected.push(terminalId);
      }
    }
    return connected;
  }

  /**
   * Connect a terminal to platform
   */
  async connect(terminalId: string, traceId: string = ''): Promise<ErrorCode> {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      this.lastError = `Terminal ${terminalId} not found`;
      return ErrorCode.TERMINAL_NOT_FOUND;
    }

    try {
      await terminal.transport.connect(traceId);
      return ErrorCode.OK;
    } catch (error: any) {
      this.lastError = error.message;
      return error.code || ErrorCode.CONNECTION_FAILED;
    }
  }

  /**
   * Connect all registered terminals concurrently
   */
  async connectAll(): Promise<Record<string, ErrorCode>> {
    const results: Record<string, ErrorCode> = {};
    const promises: Promise<void>[] = [];

    for (const terminalId of this.terminals.keys()) {
      promises.push(
        this.connect(terminalId).then((code) => {
          results[terminalId] = code;
        })
      );
    }

    await Promise.all(promises);
    return results;
  }

  /**
   * Disconnect a terminal
   */
  async disconnect(terminalId: string): Promise<ErrorCode> {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      this.lastError = `Terminal ${terminalId} not found`;
      return ErrorCode.TERMINAL_NOT_FOUND;
    }

    try {
      await terminal.transport.disconnect();
      return ErrorCode.OK;
    } catch (error: any) {
      this.lastError = error.message;
      return ErrorCode.INTERNAL_ERROR;
    }
  }

  /**
   * Disconnect all connected terminals concurrently
   */
  async disconnectAll(): Promise<Record<string, ErrorCode>> {
    const results: Record<string, ErrorCode> = {};
    const promises: Promise<void>[] = [];

    for (const terminalId of this.terminals.keys()) {
      promises.push(
        this.disconnect(terminalId).then((code) => {
          results[terminalId] = code;
        })
      );
    }

    await Promise.all(promises);
    return results;
  }

  /**
   * Check if a terminal is connected
   */
  isConnected(terminalId: string): boolean {
    const terminal = this.terminals.get(terminalId);
    return terminal ? terminal.transport.isConnected() : false;
  }

  /**
   * Send signal through a terminal
   */
  async sendSignal(terminalId: string, signal: Signal): Promise<ErrorCode> {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      this.lastError = `Terminal ${terminalId} not found`;
      return ErrorCode.TERMINAL_NOT_FOUND;
    }

    try {
      await terminal.transport.sendSignal(signal);
      return ErrorCode.OK;
    } catch (error: any) {
      this.lastError = error.message;
      return error.code || ErrorCode.SEND_FAILED;
    }
  }

  /**
   * Send multiple signals concurrently (batch)
   */
  async sendSignalsBatch(terminalId: string, signals: Signal[]): Promise<Record<number, ErrorCode>> {
    const results: Record<number, ErrorCode> = {};
    const promises: Promise<void>[] = [];

    for (let i = 0; i < signals.length; i++) {
      const index = i;
      promises.push(
        this.sendSignal(terminalId, signals[i]).then((code) => {
          results[index] = code;
        })
      );
    }

    await Promise.all(promises);
    return results;
  }

  /**
   * Send typed binary data through a terminal
   *
   * Currently verified data types: "opus" (audio)
   *
   * @param terminalId Terminal identifier
   * @param data Binary data buffer
   * @param dataType Data type identifier (currently only "opus" is verified by platform)
   * @returns ErrorCode.OK on success, error code otherwise
   */
  async sendBinaryData(terminalId: string, data: Buffer, dataType: string): Promise<ErrorCode> {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      this.lastError = `Terminal ${terminalId} not found`;
      return ErrorCode.TERMINAL_NOT_FOUND;
    }

    try {
      await terminal.transport.sendBinaryData(data, dataType);
      return ErrorCode.OK;
    } catch (error: any) {
      this.lastError = error.message;
      return error.code || ErrorCode.SEND_FAILED;
    }
  }

  /**
   * Convenience method: Send audio data through a terminal
   *
   * @param terminalId Terminal identifier
   * @param data Audio data buffer
   * @param audioFormat Audio format (default: "opus" - currently the only verified format)
   * @returns ErrorCode.OK on success, error code otherwise
   */
  async sendAudioData(terminalId: string, data: Buffer, audioFormat: string = 'opus'): Promise<ErrorCode> {
    return this.sendBinaryData(terminalId, data, audioFormat);
  }

  /**
   * Convenience method: Send text signal
   */
  async sendText(terminalId: string, signalType: string, text: string, ...extra: Record<string, any>[]): Promise<ErrorCode> {
    const signal = new Signal(signalType);
    signal.getPayload().setString('text', text);

    // Add extra fields
    for (const obj of extra) {
      for (const [key, value] of Object.entries(obj)) {
        signal.getPayload().setObject(key, value);
      }
    }

    return this.sendSignal(terminalId, signal);
  }

  /**
   * Convenience method: Send JSON signal
   */
  async sendJSON(terminalId: string, signalType: string, data: Record<string, any>): Promise<ErrorCode> {
    const signal = new Signal(signalType);
    signal.getPayload().setData(data);
    return this.sendSignal(terminalId, signal);
  }

  /**
   * Set connection callback for a terminal
   */
  setConnectionCallback(terminalId: string, callback: ConnectionCallback): ErrorCode {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      this.lastError = `Terminal ${terminalId} not found`;
      return ErrorCode.TERMINAL_NOT_FOUND;
    }

    terminal.transport.setConnectionCallback(callback);
    return ErrorCode.OK;
  }

  /**
   * Set directive callback for a terminal
   */
  setDirectiveCallback(terminalId: string, callback: DirectiveCallback): ErrorCode {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      this.lastError = `Terminal ${terminalId} not found`;
      return ErrorCode.TERMINAL_NOT_FOUND;
    }

    terminal.transport.setDirectiveCallback(callback);
    return ErrorCode.OK;
  }

  /**
   * Set audio data callback for a terminal
   */
  setAudioDataCallback(terminalId: string, callback: AudioDataCallback): ErrorCode {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      this.lastError = `Terminal ${terminalId} not found`;
      return ErrorCode.TERMINAL_NOT_FOUND;
    }

    terminal.transport.setAudioDataCallback(callback);
    return ErrorCode.OK;
  }

  /**
   * Set error callback for a terminal
   */
  setErrorCallback(terminalId: string, callback: ErrorCallback): ErrorCode {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      this.lastError = `Terminal ${terminalId} not found`;
      return ErrorCode.TERMINAL_NOT_FOUND;
    }

    terminal.transport.setErrorCallback(callback);
    return ErrorCode.OK;
  }

  /**
   * Set close callback for a terminal
   */
  setCloseCallback(terminalId: string, callback: CloseCallback): ErrorCode {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      this.lastError = `Terminal ${terminalId} not found`;
      return ErrorCode.TERMINAL_NOT_FOUND;
    }

    terminal.transport.setCloseCallback(callback);
    return ErrorCode.OK;
  }

  /**
   * Set global connection callback (applies to all terminals)
   */
  setGlobalConnectionCallback(callback: GlobalConnectionCallback): void {
    this.globalConnectionCallback = callback;

    // Apply to existing terminals
    for (const [terminalId, terminal] of this.terminals) {
      terminal.transport.setConnectionCallback((connected, errorMessage) => {
        callback(terminalId, connected, errorMessage);
      });
    }
  }

  /**
   * Set global directive callback (applies to all terminals)
   */
  setGlobalDirectiveCallback(callback: GlobalDirectiveCallback): void {
    this.globalDirectiveCallback = callback;

    // Apply to existing terminals
    for (const [terminalId, terminal] of this.terminals) {
      terminal.transport.setDirectiveCallback((directive) => {
        callback(terminalId, directive);
      });
    }
  }

  /**
   * Set global error callback (applies to all terminals)
   */
  setGlobalErrorCallback(callback: GlobalErrorCallback): void {
    this.globalErrorCallback = callback;

    // Apply to existing terminals
    for (const [terminalId, terminal] of this.terminals) {
      terminal.transport.setErrorCallback((errorCode, message) => {
        callback(terminalId, errorCode, message);
      });
    }
  }

  /**
   * Set global close callback (applies to all terminals)
   */
  setGlobalCloseCallback(callback: GlobalCloseCallback): void {
    this.globalCloseCallback = callback;

    // Apply to existing terminals
    for (const [terminalId, terminal] of this.terminals) {
      terminal.transport.setCloseCallback((code, reason) => {
        callback(terminalId, code, reason);
      });
    }
  }

  /**
   * Get statistics for a terminal
   */
  getTerminalStatistics(terminalId: string): Statistics | null {
    const terminal = this.terminals.get(terminalId);
    return terminal ? terminal.transport.getStatistics() : null;
  }

  /**
   * Get statistics for all terminals
   */
  getAllStatistics(): Record<string, Statistics> {
    const stats: Record<string, Statistics> = {};
    for (const [terminalId, terminal] of this.terminals) {
      stats[terminalId] = terminal.transport.getStatistics();
    }
    return stats;
  }

  /**
   * Get last error message
   */
  getLastError(): string {
    return this.lastError;
  }

  /**
   * Clear error message
   */
  clearError(): void {
    this.lastError = '';
  }
}
