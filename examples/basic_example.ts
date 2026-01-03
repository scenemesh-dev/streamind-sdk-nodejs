/**
 * StreamInd SDK - Basic Example
 *
 * Demonstrates:
 * - Single terminal connection
 * - Sending signals
 * - Receiving directives
 * - Error handling
 */

import { SDK, Signal, Directive, ErrorCode, Config } from '../src';

async function main() {
  // 1. Create configuration
  const config: Config = {
    deviceId: 'my-device-001',
    deviceType: 'sensor',
    endpoint: 'wss://platform.example.com/signals',
    tenantId: 'tenant-123',
    productId: 'product-456',
    productKey: 'your-secret-key',
    enableDirectiveReceiving: true,
    connectionTimeoutMs: 10000,
    heartbeatIntervalMs: 5000
  };

  // 2. Create SDK instance
  const sdk = new SDK();

  // 3. Register terminal
  const result = sdk.registerTerminal('terminal-1', config);
  if (result !== ErrorCode.OK) {
    console.error('Failed to register terminal:', sdk.getLastError());
    return;
  }

  // 4. Set directive callback
  sdk.setDirectiveCallback('terminal-1', (directive: Directive) => {
    console.log(`Received directive: ${directive.name}`);

    // Extract parameters with type safety
    const speed = directive.getIntParameter('speed', 100);
    const direction = directive.getStringParameter('direction', 'forward');
    const enabled = directive.getBoolParameter('enabled', true);

    console.log(`  speed: ${speed}`);
    console.log(`  direction: ${direction}`);
    console.log(`  enabled: ${enabled}`);

    // Handle different directive types
    if (directive.name === 'motor.move') {
      console.log(`Moving motor: ${direction} at speed ${speed}`);
    } else if (directive.name === 'led.blink') {
      const times = directive.getIntParameter('times', 3);
      console.log(`Blinking LED ${times} times`);
    }
  });

  // 5. Set connection callback
  sdk.setConnectionCallback('terminal-1', (connected: boolean, errorMessage: string) => {
    if (connected) {
      console.log('✓ Connected to platform');
    } else {
      console.log(`✗ Connection lost: ${errorMessage}`);
    }
  });

  // 6. Set error callback
  sdk.setErrorCallback('terminal-1', (errorCode: ErrorCode, message: string) => {
    console.error(`Error [${ErrorCode[errorCode]}]: ${message}`);
  });

  // 7. Connect to platform
  const connectResult = await sdk.connect('terminal-1');
  if (connectResult !== ErrorCode.OK) {
    console.error('Connection failed:', sdk.getLastError());
    return;
  }

  console.log('Connected successfully!');

  // 8. Send signals
  await sendSensorData(sdk);

  // 9. Keep running
  console.log('Press Ctrl+C to exit...');
  await new Promise(() => {});  // Keep alive
}

/**
 * Send sensor data signals
 */
async function sendSensorData(sdk: SDK) {
  // Send temperature signal
  const tempSignal = new Signal('sensor.temperature');
  tempSignal.getPayload().setNumber('celsius', 25.5);
  tempSignal.getPayload().setNumber('humidity', 60);
  tempSignal.getPayload().setString('location', 'living_room');
  tempSignal.getPayload().setBool('is_critical', false);

  const sendResult = await sdk.sendSignal('terminal-1', tempSignal);
  if (sendResult === ErrorCode.OK) {
    console.log('Temperature signal sent successfully');
  } else {
    console.error('Failed to send signal:', sdk.getLastError());
  }

  // Use convenience methods
  await sdk.sendText('terminal-1', 'message', 'Hello from Node.js SDK!', { priority: 'high' });
  console.log('Text signal sent');

  await sdk.sendJSON('terminal-1', 'sensor.data', {
    temperature: 25.5,
    humidity: 60,
    location: 'living_room'
  });
  console.log('JSON signal sent');

  // Print statistics
  const stats = sdk.getTerminalStatistics('terminal-1');
  if (stats) {
    console.log('\nStatistics:');
    console.log(`  Signals sent: ${stats.signalsSent}`);
    console.log(`  Directives received: ${stats.directivesReceived}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log(`  Uptime: ${stats.uptimeSeconds.toFixed(1)}s`);
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
