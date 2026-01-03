/**
 * StreamInd SDK for Node.js
 *
 * High-performance WebSocket SDK for real-time bidirectional communication
 *
 * @author StreamInd
 * @version 1.0.0
 * @license SEE LICENSE IN LICENSE
 */

// Export main SDK class
export { SDK } from './sdk';

// Export models
export {
  Config,
  Payload,
  Signal,
  Directive,
  Statistics,
  SignalSource,
  getWebSocketUrl,
  getConfigWithDefaults
} from './models';

// Export errors
export {
  ErrorCode,
  StreamIndError,
  getErrorMessage
} from './errors';

// Export transport types
export type {
  ConnectionCallback,
  DirectiveCallback,
  AudioDataCallback,
  ErrorCallback,
  CloseCallback
} from './transport';
