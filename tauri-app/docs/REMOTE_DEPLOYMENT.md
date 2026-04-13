# ClawCode 远程部署功能

## 概述

ClawCode 现在支持通过 SSH 远程部署到远程服务器，包括完整的 LLM 环境检测、推理引擎安装和配置同步功能。

## 功能特性

### 1. SSH 远程连接

- ✅ 支持 SSH 密钥认证和密码认证
- ✅ 自动路径扩展（支持 `~` 符号）
- ✅ 连接测试和验证
- ✅ 连接配置保存和管理

### 2. 远程命令执行

- ✅ 实时命令输出显示
- ✅ 支持 stdout 和 stderr 分离
- ✅ 退出状态码返回
- ✅ 命令超时处理

### 3. 文件传输

- ✅ SFTP 文件上传
- ✅ SFTP 文件下载
- ✅ 远程目录创建
- ✅ 文件权限设置

### 4. LLM 环境检测

自动检测远程主机上的 LLM 环境：

- **Ollama**: 检测安装状态和版本
- **vLLM**: 检测 Python 包安装状态
- **llama.cpp**: 检测可执行文件
- **Python**: 检测 Python 版本
- **CUDA/GPU**: 检测 GPU 信息

### 5. 推理引擎自动安装

- **Ollama**: 通过官方安装脚本自动安装
- **vLLM**: 通过 pip 自动安装
- **系统依赖**: 自动检测并提示缺失的依赖

### 6. 完整部署流程

部署过程包括以下步骤：

1. **SSH 连接建立**: 使用配置的认证方式连接到远程主机
2. **环境检测**: 检测远程主机的 LLM 环境
3. **推理引擎安装**: 根据需要安装 Ollama 或 vLLM
4. **创建安装目录**: 在远程主机上创建安装目录
5. **上传二进制文件**: 上传 ClawCode 可执行文件
6. **上传配置文件**: 上传并同步配置文件
7. **创建系统服务**: 创建 systemd 服务文件
8. **启动服务**: 启动并启用 ClawCode 服务
9. **验证部署**: 验证服务是否正常运行

### 7. 实时进度显示

- ✅ 部署步骤实时显示
- ✅ 命令输出实时流式传输
- ✅ 错误状态高亮显示
- ✅ 时间戳记录

### 8. Agent I/O 可见性

- ✅ Agent 输入输出监控
- ✅ 工具调用和结果记录
- ✅ 错误信息捕获
- ✅ 元数据显示

### 9. 配置同步

- ✅ 推送本地配置到远程主机
- ✅ 从远程主机拉取配置
- ✅ 配置合并功能
- ✅ 冲突解决机制

## 使用方法

### 1. 配置 SSH 连接

在设置面板中配置远程连接：

```typescript
interface RemoteComputer {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'ssh-key';
  password?: string;
  sshKeyPath?: string;
  sshKeyPassphrase?: string;
  enabled: boolean;
  autoConnect: boolean;
  healthCheckInterval: number;
}
```

### 2. 执行远程部署

调用部署命令：

```typescript
import { invoke } from '@tauri-apps/api/tauri';

const result = await invoke('deploy_cli_server', {
  host: '192.168.1.100',
  port: 22,
  username: 'user',
  authMethod: 'ssh-key',
  keyPath: '~/.ssh/id_rsa',
  installPath: '/opt/clawcode',
  version: '0.1.0',
  configJson: JSON.stringify(config),
  preferredLlm: 'ollama',
});
```

### 3. 监听部署进度

监听部署进度事件：

```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen('deployment-progress', (event) => {
  console.log('Deployment progress:', event.payload);
});
```

### 4. 检测远程 LLM 环境

```typescript
const llmEnv = await invoke('detect_remote_llm', {
  host: '192.168.1.100',
  port: 22,
  username: 'user',
  authMethod: 'ssh-key',
  keyPath: '~/.ssh/id_rsa',
});

console.log('Ollama installed:', llmEnv.ollama_installed);
console.log('vLLM installed:', llmEnv.vllm_installed);
console.log('GPU info:', llmEnv.gpu_info);
```

### 5. 同步配置

推送配置到远程：

```typescript
await invoke('sync_config_to_remote', {
  host: '192.168.1.100',
  port: 22,
  username: 'user',
  authMethod: 'ssh-key',
  keyPath: '~/.ssh/id_rsa',
  remotePath: '/opt/clawcode/config.json',
});
```

拉取远程配置：

```typescript
const remoteConfig = await invoke('pull_config_from_remote', {
  host: '192.168.1.100',
  port: 22,
  username: 'user',
  authMethod: 'ssh-key',
  keyPath: '~/.ssh/id_rsa',
  remotePath: '/opt/clawcode/config.json',
});
```

## API 参考

### SSH 命令

#### `test_ssh_connection`
测试 SSH 连接是否成功。

**参数**:
- `host`: 主机地址
- `port`: SSH 端口
- `username`: 用户名
- `authMethod`: 认证方式 ('password' | 'ssh-key')
- `password`: 密码（可选）
- `keyPath`: SSH 密钥路径（可选）
- `passphrase`: 密钥密码（可选）

**返回**: `boolean`

#### `deploy_cli_server`
部署 ClawCode 到远程服务器。

**参数**:
- `host`: 主机地址
- `port`: SSH 端口
- `username`: 用户名
- `authMethod`: 认证方式
- `installPath`: 安装路径
- `version`: 版本号
- `password`: 密码（可选）
- `keyPath`: SSH 密钥路径（可选）
- `passphrase`: 密钥密码（可选）
- `configJson`: 配置 JSON（可选）
- `preferredLlm`: 首选 LLM 引擎（可选）

**返回**: `DeploymentResult`

#### `detect_remote_llm`
检测远程主机的 LLM 环境。

**参数**: 同 `test_ssh_connection`

**返回**: `LlmEnvironment`

### 配置同步命令

#### `sync_config_to_remote`
同步本地配置到远程主机。

**参数**:
- SSH 连接参数
- `remotePath`: 远程配置路径（可选）

**返回**: `void`

#### `pull_config_from_remote`
从远程主机拉取配置。

**参数**: 同 `sync_config_to_remote`

**返回**: `Value` (JSON)

#### `merge_configs`
合并本地和远程配置。

**参数**:
- `localConfig`: 本地配置
- `remoteConfig`: 远程配置

**返回**: `Value` (JSON)

## 事件

### `deployment-progress`
部署进度事件。

**Payload**:
```typescript
{
  step: number;
  name: string;
  status: 'Pending' | 'InProgress' | 'Completed' | 'Failed';
  message: string;
  timestamp: number;
}
```

### `agent-io`
Agent 输入输出事件。

**Payload**:
```typescript
{
  agentId: string;
  type: 'input' | 'output' | 'error' | 'tool_call' | 'tool_result';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
```

## 安全考虑

1. **密码加密**: 密码在存储时会被加密
2. **路径验证**: 安装路径会进行安全验证，防止路径遍历攻击
3. **SSH 密钥**: 推荐使用 SSH 密钥认证而非密码
4. **权限控制**: 远程服务以非 root 用户运行

## 故障排除

### 连接失败

1. 检查网络连接和防火墙设置
2. 验证 SSH 服务是否运行
3. 确认认证凭据是否正确
4. 检查 SSH 密钥权限（应为 600）

### 部署失败

1. 检查远程主机的磁盘空间
2. 确认用户有足够的权限
3. 查看部署日志中的错误信息
4. 验证 systemd 服务状态

### LLM 安装失败

1. 检查网络连接（需要下载安装包）
2. 确认系统依赖是否安装
3. 对于 vLLM，确认 Python 和 pip 版本
4. 检查 GPU 驱动是否正确安装

## 开发指南

### 添加新的 LLM 引擎支持

1. 在 `deployment.rs` 中的 `LlmEnvironment` 结构体添加字段
2. 在 `detect_llm_environment` 方法中添加检测逻辑
3. 创建新的安装方法（如 `install_xxx`）
4. 更新前端 UI 以支持新引擎

### 自定义部署流程

1. 修改 `RemoteDeployment` 结构体
2. 在 `deploy_clawcode` 方法中添加新步骤
3. 更新进度事件以反映新步骤
4. 在前端添加相应的 UI 组件

## 未来改进

- [ ] 支持更多推理引擎（llama.cpp, text-generation-webui）
- [ ] 实现部署回滚功能
- [ ] 添加部署历史记录
- [ ] 支持批量部署到多台主机
- [ ] 实现配置差异比较和选择性同步
- [ ] 添加远程主机资源监控
- [ ] 支持容器化部署（Docker）
