/**
 * StreamInd SDK Error Codes
 */
export enum ErrorCode {
  OK = 0,
  NOT_INITIALIZED = 1,
  ALREADY_INITIALIZED = 2,
  INVALID_CONFIG = 3,
  NOT_CONNECTED = 4,
  ALREADY_CONNECTED = 5,
  CONNECTION_FAILED = 6,
  CONNECTION_TIMEOUT = 7,
  INVALID_SIGNAL = 8,
  SIGNAL_TOO_LARGE = 9,
  SEND_FAILED = 10,
  INVALID_PARAMETER = 11,
  TERMINAL_NOT_FOUND = 12,
  INTERNAL_ERROR = 99
}

/**
 * StreamInd SDK Error
 */
export class StreamIndError extends Error {
  public readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string) {
    super(message || ErrorCode[code]);
    this.name = 'StreamIndError';
    this.code = code;
    Object.setPrototypeOf(this, StreamIndError.prototype);
  }
}

/**
 * Get error message by error code
 */
export function getErrorMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    [ErrorCode.OK]: 'Success',
    [ErrorCode.NOT_INITIALIZED]: 'SDK not initialized',
    [ErrorCode.ALREADY_INITIALIZED]: 'SDK already initialized',
    [ErrorCode.INVALID_CONFIG]: 'Invalid configuration',
    [ErrorCode.NOT_CONNECTED]: 'Not connected to platform',
    [ErrorCode.ALREADY_CONNECTED]: 'Already connected to platform',
    [ErrorCode.CONNECTION_FAILED]: 'Connection failed',
    [ErrorCode.CONNECTION_TIMEOUT]: 'Connection timeout',
    [ErrorCode.INVALID_SIGNAL]: 'Invalid signal',
    [ErrorCode.SIGNAL_TOO_LARGE]: 'Signal exceeds maximum size',
    [ErrorCode.SEND_FAILED]: 'Send failed',
    [ErrorCode.INVALID_PARAMETER]: 'Invalid parameter',
    [ErrorCode.TERMINAL_NOT_FOUND]: 'Terminal not found',
    [ErrorCode.INTERNAL_ERROR]: 'Internal error'
  };
  return messages[code] || 'Unknown error';
}
