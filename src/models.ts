/**
 * StreamInd SDK Models
 *
 * Core data structures for Signal/Directive communication
 */

/**
 * SDK Configuration
 */
export interface Config {
  /** Device unique ID */
  deviceId: string;

  /** Device type */
  deviceType: string;

  /** WebSocket endpoint URL */
  endpoint: string;

  /** Tenant ID */
  tenantId: string;

  /** Product ID */
  productId: string;

  /** Product authentication key */
  productKey: string;

  /** Enable directive receiving (default: true) */
  enableDirectiveReceiving?: boolean;

  /** Connection timeout in milliseconds (default: 10000) */
  connectionTimeoutMs?: number;

  /** Heartbeat interval in milliseconds (default: 5000) */
  heartbeatIntervalMs?: number;

  /** Maximum message size in bytes (default: 10MB) */
  maxMessageSize?: number;

  /** Maximum reconnection attempts (-1 = infinite, default: -1) */
  maxReconnectAttempts?: number;

  /** Base reconnection interval in milliseconds (default: 1000) */
  baseReconnectIntervalMs?: number;

  /** Maximum reconnection interval in milliseconds (default: 60000) */
  maxReconnectIntervalMs?: number;

  /** Backoff factor for exponential backoff (default: 2.0) */
  backoffFactor?: number;

  /** Jitter factor for randomization (default: 0.1) */
  jitterFactor?: number;
}

/**
 * Get WebSocket URL with query parameters
 */
export function getWebSocketUrl(config: Config, traceId: string = ''): string {
  let url = config.endpoint;
  url += `?tenantId=${config.tenantId}`;
  url += `&productId=${config.productId}`;
  url += `&productKey=${config.productKey}`;
  if (traceId) {
    url += `&traceId=${traceId}`;
  }
  return url;
}

/**
 * Get configuration with defaults
 */
export function getConfigWithDefaults(config: Config): Required<Config> {
  return {
    deviceId: config.deviceId,
    deviceType: config.deviceType,
    endpoint: config.endpoint,
    tenantId: config.tenantId,
    productId: config.productId,
    productKey: config.productKey,
    enableDirectiveReceiving: config.enableDirectiveReceiving ?? true,
    connectionTimeoutMs: config.connectionTimeoutMs ?? 10000,
    heartbeatIntervalMs: config.heartbeatIntervalMs ?? 5000,
    maxMessageSize: config.maxMessageSize ?? 10 * 1024 * 1024,
    maxReconnectAttempts: config.maxReconnectAttempts ?? -1,
    baseReconnectIntervalMs: config.baseReconnectIntervalMs ?? 1000,
    maxReconnectIntervalMs: config.maxReconnectIntervalMs ?? 60000,
    backoffFactor: config.backoffFactor ?? 2.0,
    jitterFactor: config.jitterFactor ?? 0.1
  };
}

/**
 * Payload - Key-value data container
 */
export class Payload {
  private data: Record<string, any> = {};

  /**
   * Set string value
   */
  setString(key: string, value: string): void {
    this.data[key] = value;
  }

  /**
   * Get string value
   */
  getString(key: string, defaultValue: string = ''): string {
    const value = this.data[key];
    return typeof value === 'string' ? value : defaultValue;
  }

  /**
   * Set number value
   */
  setNumber(key: string, value: number): void {
    this.data[key] = value;
  }

  /**
   * Get number value
   */
  getNumber(key: string, defaultValue: number = 0): number {
    const value = this.data[key];
    if (typeof value === 'number') return value;
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Set boolean value
   */
  setBool(key: string, value: boolean): void {
    this.data[key] = value;
  }

  /**
   * Get boolean value
   */
  getBool(key: string, defaultValue: boolean = false): boolean {
    const value = this.data[key];
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return defaultValue;
  }

  /**
   * Set object value
   */
  setObject(key: string, value: any): void {
    this.data[key] = value;
  }

  /**
   * Get object value
   */
  getObject(key: string, defaultValue: any = null): any {
    return this.data[key] ?? defaultValue;
  }

  /**
   * Get all data
   */
  getData(): Record<string, any> {
    return { ...this.data };
  }

  /**
   * Set all data
   */
  setData(data: Record<string, any>): void {
    this.data = { ...data };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.data = {};
  }

  /**
   * Convert to JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.data);
  }

  /**
   * Create from JSON string
   */
  static fromJSON(jsonStr: string): Payload {
    const payload = new Payload();
    try {
      payload.data = JSON.parse(jsonStr);
    } catch (e) {
      // Invalid JSON, keep empty
    }
    return payload;
  }
}

/**
 * Signal Source Information
 */
export interface SignalSource {
  receptorId: string;
  receptorTopic: string;
  generatedTime: string;
}

/**
 * Signal counter for generating unique UUIDs
 */
let signalCounter = 0;

/**
 * Signal - Uplink message from terminal to platform
 */
export class Signal {
  public uuid: string;
  public type: string;
  public timestamp: string;
  public source: SignalSource;
  private payload: Payload;

  constructor(type: string) {
    this.uuid = `sig_${Date.now()}_${++signalCounter}`;
    this.type = type;
    this.timestamp = new Date().toISOString();
    this.source = {
      receptorId: '',
      receptorTopic: '',
      generatedTime: this.timestamp
    };
    this.payload = new Payload();
  }

  /**
   * Get payload object
   */
  getPayload(): Payload {
    return this.payload;
  }

  /**
   * Set payload object
   */
  setPayload(payload: Payload): void {
    this.payload = payload;
  }

  /**
   * Convert to JSON string
   */
  toJSON(): string {
    return JSON.stringify({
      uuid: this.uuid,
      type: this.type,
      timestamp: this.timestamp,
      source: this.source,
      payload: this.payload.getData()
    });
  }

  /**
   * Create from JSON string
   */
  static fromJSON(jsonStr: string): Signal {
    const data = JSON.parse(jsonStr);
    const signal = new Signal(data.type || '');
    signal.uuid = data.uuid || signal.uuid;
    signal.timestamp = data.timestamp || signal.timestamp;
    signal.source = data.source || signal.source;
    if (data.payload) {
      signal.payload.setData(data.payload);
    }
    return signal;
  }
}

/**
 * Directive - Downlink command from platform to terminal
 */
export class Directive {
  public id: string;
  public name: string;
  public timestamp: string;
  private parameters: Record<string, any>;

  constructor(id: string = '', name: string = '', parameters: Record<string, any> = {}) {
    this.id = id;
    this.name = name;
    this.timestamp = new Date().toISOString();
    this.parameters = parameters;
  }

  /**
   * Get all parameters
   */
  getParameters(): Record<string, any> {
    return { ...this.parameters };
  }

  /**
   * Get string parameter
   */
  getStringParameter(key: string, defaultValue: string = ''): string {
    const value = this.parameters[key];
    return typeof value === 'string' ? value : defaultValue;
  }

  /**
   * Get integer parameter
   */
  getIntParameter(key: string, defaultValue: number = 0): number {
    const value = this.parameters[key];
    if (typeof value === 'number') return Math.floor(value);
    const num = parseInt(String(value), 10);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Get number parameter
   */
  getNumberParameter(key: string, defaultValue: number = 0): number {
    const value = this.parameters[key];
    if (typeof value === 'number') return value;
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Get boolean parameter
   */
  getBoolParameter(key: string, defaultValue: boolean = false): boolean {
    const value = this.parameters[key];
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return defaultValue;
  }

  /**
   * Get object parameter
   */
  getObjectParameter(key: string, defaultValue: any = null): any {
    return this.parameters[key] ?? defaultValue;
  }

  /**
   * Convert to JSON string
   */
  toJSON(): string {
    return JSON.stringify({
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      parameters: this.parameters
    });
  }

  /**
   * Create from JSON string
   */
  static fromJSON(jsonStr: string): Directive {
    const data = JSON.parse(jsonStr);
    let params = data.parameters || {};

    // Handle both object and string formats
    if (typeof params === 'string') {
      try {
        params = JSON.parse(params);
      } catch (e) {
        params = {};
      }
    }

    return new Directive(
      data.id || '',
      data.name || '',
      params
    );
  }
}

/**
 * Connection statistics
 */
export interface Statistics {
  signalsSent: number;
  audioSent: number;
  directivesReceived: number;
  audioReceived: number;
  errors: number;
  connected: boolean;
  uptimeSeconds: number;
  reconnectAttempts: number;
}
