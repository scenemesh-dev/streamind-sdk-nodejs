/**
 * StreamInd SDK - Multi-Terminal Example
 *
 * Demonstrates:
 * - Managing multiple terminals (SaaS scenario)
 * - Concurrent connections
 * - Global callbacks
 * - Batch operations
 */

import { SDK, Signal, Directive, ErrorCode, Config } from '../src';

async function main() {
  const sdk = new SDK();

  // Register multiple tenant terminals
  const tenantIds = ['tenant-001', 'tenant-002', 'tenant-003'];

  for (const tenantId of tenantIds) {
    const config: Config = {
      deviceId: `${tenantId}-device`,
      deviceType: 'saas-tenant',
      endpoint: 'wss://platform.example.com/signals',
      tenantId: tenantId,
      productId: `product-${tenantId}`,
      productKey: `key-${tenantId}`
    };

    const result = sdk.registerTerminal(tenantId, config);
    if (result !== ErrorCode.OK) {
      console.error(`Failed to register ${tenantId}:`, sdk.getLastError());
      return;
    }
  }

  console.log(`Registered ${tenantIds.length} terminals`);

  // Set global callbacks (apply to all terminals)
  sdk.setGlobalConnectionCallback((terminalId: string, connected: boolean, errorMessage: string) => {
    if (connected) {
      console.log(`✓ Terminal ${terminalId} connected`);
    } else {
      console.log(`✗ Terminal ${terminalId} disconnected: ${errorMessage}`);
    }
  });

  sdk.setGlobalDirectiveCallback((terminalId: string, directive: Directive) => {
    console.log(`Terminal ${terminalId} received directive: ${directive.name}`);

    // Handle tenant-specific logic
    if (directive.name === 'user.login') {
      const username = directive.getStringParameter('username', '');
      console.log(`  User ${username} logged in to ${terminalId}`);
    } else if (directive.name === 'data.update') {
      const recordId = directive.getStringParameter('record_id', '');
      console.log(`  Update record ${recordId} for ${terminalId}`);
    }
  });

  sdk.setGlobalErrorCallback((terminalId: string, errorCode: ErrorCode, message: string) => {
    console.error(`Terminal ${terminalId} error [${ErrorCode[errorCode]}]: ${message}`);
  });

  // Connect all terminals concurrently (high performance!)
  console.log('\nConnecting all terminals...');
  const connectResults = await sdk.connectAll();

  for (const [terminalId, result] of Object.entries(connectResults)) {
    if (result === ErrorCode.OK) {
      console.log(`✓ ${terminalId} connected`);
    } else {
      console.error(`✗ ${terminalId} failed to connect`);
    }
  }

  // Check connected terminals
  const connected = sdk.getConnectedTerminals();
  console.log(`\n${connected.length} terminals are online`);

  // Send signals to different terminals concurrently
  console.log('\nSending signals concurrently...');
  await Promise.all([
    sdk.sendJSON('tenant-001', 'user.login', { username: 'alice', timestamp: Date.now() }),
    sdk.sendJSON('tenant-002', 'data.update', { record_id: '12345', action: 'modify' }),
    sdk.sendJSON('tenant-003', 'alert.warning', { level: 'high', message: 'Resource usage high' })
  ]);

  console.log('All signals sent successfully');

  // Batch send multiple signals to one terminal
  console.log('\nBatch sending signals to tenant-001...');
  const signals: Signal[] = [];
  for (let i = 0; i < 10; i++) {
    const signal = new Signal(`test.batch_${i}`);
    signal.getPayload().setNumber('index', i);
    signal.getPayload().setString('message', `Batch signal ${i}`);
    signals.push(signal);
  }

  const batchResults = await sdk.sendSignalsBatch('tenant-001', signals);
  const successCount = Object.values(batchResults).filter(r => r === ErrorCode.OK).length;
  console.log(`Batch send: ${successCount}/${signals.length} succeeded`);

  // Print statistics for all terminals
  console.log('\n=== Terminal Statistics ===');
  const allStats = sdk.getAllStatistics();
  for (const [terminalId, stats] of Object.entries(allStats)) {
    const status = stats.connected ? '🟢 Online' : '🔴 Offline';
    console.log(`${status} ${terminalId}:`);
    console.log(`  Signals sent: ${stats.signalsSent}`);
    console.log(`  Directives received: ${stats.directivesReceived}`);
    console.log(`  Uptime: ${stats.uptimeSeconds.toFixed(1)}s`);
    console.log(`  Errors: ${stats.errors}`);
  }

  // Keep running
  console.log('\nPress Ctrl+C to exit...');
  await new Promise(() => {});  // Keep alive
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down all terminals...');
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
