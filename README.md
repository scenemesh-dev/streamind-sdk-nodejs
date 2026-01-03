# StreamInd SDK for Node.js

StreamInd Node.js SDK - 基于TypeScript的高性能异步SDK，用于连接StreamInd平台。

## 安装

1. 访问 [Releases](https://github.com/scenemesh-dev/streamind-sdk-nodejs/releases)
2. 下载 `streamind-sdk-1.0.0.tgz`
3. 安装：
   ```bash
   npm install streamind-sdk-1.0.0.tgz
   ```

## 快速开始

```typescript
import { SDK, Config, Signal } from '@streamind/sdk';

async function main() {
  // 1. 创建配置
  const config = new Config(
    'device-001',                        // deviceId
    'sensor',                            // deviceType
    'wss://your-platform.com/signals',  // endpoint
    'your-tenant-id',                    // tenantId
    'your-product-id',                   // productId
    'your-secret-key'                    // productKey
  );

  // 2. 创建SDK并注册终端
  const sdk = new SDK();
  sdk.registerTerminal('terminal-1', config);

  // 3. 设置回调
  sdk.setDirectiveCallback('terminal-1', (directive) => {
    console.log('收到指令:', directive.name);
  });

  // 4. 连接
  await sdk.connect('terminal-1');

  // 5. 发送信号
  const signal = new Signal('sensor.data');
  signal.getPayload().setNumber('value', 25.5);
  await sdk.sendSignal('terminal-1', signal);
}

main();
```

## 发送音频数据

```typescript
import * as fs from 'fs';

// 读取OPUS音频文件
const audioData = fs.readFileSync('audio.opus');

// 发送音频
await sdk.sendAudioData('terminal-1', audioData);
```

## 多终端管理

```typescript
// 注册多个终端
sdk.registerTerminal('terminal-1', config1);
sdk.registerTerminal('terminal-2', config2);

// 批量连接
const results = await sdk.connectAll();

// 批量发送
await sdk.sendSignal('terminal-1', signal1);
await sdk.sendSignal('terminal-2', signal2);
```

## API参考

### SDK类

| 方法 | 说明 |
|-----|------|
| `registerTerminal(terminalId, config)` | 注册终端 |
| `connect(terminalId)` | 连接终端 |
| `sendSignal(terminalId, signal)` | 发送信号 |
| `sendAudioData(terminalId, data)` | 发送音频（OPUS格式） |
| `setDirectiveCallback(terminalId, callback)` | 设置指令回调 |
| `setConnectionCallback(terminalId, callback)` | 设置连接状态回调 |
| `disconnect(terminalId)` | 断开连接 |

### Config配置

| 参数 | 类型 | 说明 |
|-----|------|------|
| `deviceId` | string | 设备ID |
| `deviceType` | string | 设备类型 |
| `endpoint` | string | WebSocket端点 |
| `tenantId` | string | 租户ID |
| `productId` | string | 产品ID |
| `productKey` | string | 产品密钥 |

### Config可选配置

```typescript
const config = new Config(...);
config.heartbeatIntervalMs = 30000;      // 心跳间隔（默认30秒）
config.connectionTimeoutMs = 10000;      // 连接超时（默认10秒）
config.maxReconnectAttempts = 10;        // 最大重连次数（默认10次）
```

## 要求

- Node.js 14+
- TypeScript 4.5+（如果使用TypeScript）

## 许可证

Proprietary License
