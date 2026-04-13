# High Availability and Resource Optimization System Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TieredLM Enhanced System                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │ HealthMonitor   │  │ ContextManager   │  │ PerformanceMode         │ │
│  │ - CircuitBreaker│  │ - TokenMonitor    │  │ - DualModelProcessor    │ │
│  │ - FailoverMgr   │  │ - Compressor      │  │ - QualityScorer        │ │
│  │ - RecoveryWatch  │  │ - TokenBucket     │  │ - InterleavedWorkflow  │ │
│  └────────┬────────┘  └────────┬─────────┘  └────────────┬─────────────┘ │
│           │                    │                          │               │
│           └────────────────────┼──────────────────────────┘               │
│                                ▼                                          │
│                    ┌───────────────────────┐                               │
│                    │   ConfigManager      │                               │
│                    │   + MetricsExporter  │                               │
│                    └───────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Module 1: Cloud Model Fault Handling & Auto-Failover System

### 1.1 HealthMonitor Configuration

```rust
#[derive(Debug, Clone)]
pub struct HealthMonitorConfig {
    pub enabled: bool,                              // 功能开关
    pub connection_timeout_ms: u32,                 // 连接超时阈值 (默认: 5000ms)
    pub consecutive_error_threshold: u32,          // 连续错误次数阈值 (默认: 3)
    pub token_usage_warning_percent: f32,          // Token用量预警百分比 (默认: 80%)
    pub token_usage_limit_percent: f32,            // Token用量超限百分比 (默认: 95%)
    pub failover_timeout_ms: u32,                  // 故障切换超时 (要求: ≤100ms)
    pub health_check_interval_secs: u32,           // 健康检查间隔 (默认: 30s)
    pub recovery_stable_duration_secs: u32,        // 稳定恢复时间 (默认: 120s)
}

impl Default for HealthMonitorConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            connection_timeout_ms: 5000,
            consecutive_error_threshold: 3,
            token_usage_warning_percent: 80.0,
            token_usage_limit_percent: 95.0,
            failover_timeout_ms: 100,
            health_check_interval_secs: 30,
            recovery_stable_duration_secs: 120,
        }
    }
}
```

### 1.2 CircuitBreaker State Machine

```
        ┌──────────┐
        │  CLOSED   │ (Normal operation)
        └─────┬─────┘
              │ failure_count >= threshold
              ▼
        ┌──────────┐
   ┌───▶│  OPEN    │ (Failing over to local)
   │    └─────┬─────┘
   │          │ health_check passes for stable_duration
   │          ▼
   │    ┌──────────┐
   │    │ HALF-OPEN│ (Testing recovery)
   │    └─────┬─────┘
   │          │ success
   │          ▼
   └──────────┴──────────┐
        (back to CLOSED) │
                         │
                    failure
                         ▼
                   ┌──────────┐
                   │  OPEN    │
                   └──────────┘
```

### 1.3 FailoverManager Responsibilities

- Monitor cloud model health via `HealthMonitor`
- Execute failover within 100ms when triggered
- Fallback to local model during outage
- Monitor cloud recovery every 30 seconds
- Auto-switch back after 120s stable operation
- Provide metrics for Prometheus integration

## Module 2: Context Token Intelligent Management System

### 2.1 TokenMonitor Configuration

```rust
#[derive(Debug, Clone)]
pub struct ContextManagerConfig {
    pub enabled: bool,                              // 功能开关
    pub sampling_interval_ms: u32,                   // 采样间隔 (要求: 50ms)
    pub performance_threshold_tps: f32,             // 性能阈值 (Token/秒)
    pub max_token_limit: u32,                       // 最大Token限制
    pub intervention_latency_ms: u32,               // 干预延迟要求 (要求: ≤50ms)
    pub compression_rate_min_percent: f32,           // 最小压缩率 (要求: ≥30%)
}

impl Default for ContextManagerConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            sampling_interval_ms: 50,
            performance_threshold_tps: 100.0,
            max_token_limit: 200000,
            intervention_latency_ms: 50,
            compression_rate_min_percent: 30.0,
        }
    }
}
```

### 2.2 TokenMonitor Responsibilities

- Sample context token usage every 50ms
- Track two threshold metrics:
  - Performance: Dynamic TPS based on historical efficiency
  - Absolute: Max token limit per model specification
- Trigger intervention when either threshold exceeded
- Response latency must be ≤50ms

### 2.3 ContextCompressor Algorithm

```rust
pub trait ContextCompressor {
    fn compress(&self, context: &Context) -> CompressedContext;
    fn decompress(&self, compressed: &CompressedContext) -> Context;
}

pub struct SemanticContextCompressor {
    min_compression_ratio: f32,  // 0.3 (30% compression)
}

impl SemanticContextCompressor {
    pub fn compress(&self, context: &Context) -> CompressedContext {
        // 1. Analyze semantic importance of each message
        // 2. Preserve: system prompt, recent conversation, tool definitions
        // 3. Prune: redundant examples, old context, verbose explanations
        // 4. Ensure ≥30% compression ratio
    }
}
```

## Module 3: Extreme Performance Mode Optimization

### 3.1 DualModelProcessor Workflow

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   User      │      │ Local Model │      │  Cloud Model│
│   Request   │─────▶│  (Fast)     │─────▶│  (Review)   │
│             │      │  Response   │      │  + Score    │
└─────────────┘      └─────────────┘      └─────────────┘
                          │                    │
                          │    0-100 score     │
                          │    + suggestions   │
                          ▼                    │
                    ┌─────────────┐            │
                    │   Quality   │◀───────────┘
                    │   Gate     │
                    │ (≥70 pass) │
                    └─────────────┘
                          │
                    ┌─────┴─────┐
                    │           │
                    ▼           ▼
              (Pass)         (Fail)
              Return      Re-generate
```

### 3.2 QualityScorer Interface

```rust
#[derive(Debug, Clone)]
pub struct QualityScore {
    pub score: u8,           // 0-100
    pub suggestions: Vec<String>,
    pub accuracy_issues: Vec<String>,
    pub completeness_issues: Vec<String>,
}

pub trait QualityScorer {
    fn score(&self, local_response: &str, original_request: &str) -> QualityScore;
}

impl QualityScorer for CloudModelScorer {
    fn score(&self, local_response: &str, original_request: &str) -> QualityScore {
        // Cloud model provides:
        // - Accuracy score (0-100)
        // - Improvement suggestions
        // - Specific issues identified
    }
}
```

## Module 4: Configuration Management

### 4.1 Global Config Structure

```json
{
  "assistant": {
    "localModelType": "Ollama",
    "localModelUrl": "http://localhost:11434",
    "localModelName": "qwen3.5:27b"
  },
  "highAvailability": {
    "enabled": true,
    "connectionTimeoutMs": 5000,
    "consecutiveErrorThreshold": 3,
    "tokenUsageWarningPercent": 80.0,
    "tokenUsageLimitPercent": 95.0,
    "failoverTimeoutMs": 100,
    "healthCheckIntervalSecs": 30,
    "recoveryStableDurationSecs": 120
  },
  "contextManager": {
    "enabled": true,
    "samplingIntervalMs": 50,
    "performanceThresholdTps": 100.0,
    "maxTokenLimit": 200000,
    "interventionLatencyMs": 50,
    "compressionRateMinPercent": 30.0
  },
  "performanceMode": {
    "enabled": false,
    "dualModelEnabled": false,
    "qualityThreshold": 70,
    "localModelTimeoutMs": 5000
  }
}
```

## Module 5: Monitoring & Observability

### 5.1 Prometheus Metrics

```rust
pub enum TieredLmMetrics {
    // Health metrics
    CloudModelHealthy,
    CloudModelUnhealthy,
    FailoverTriggered,
    RecoveryCompleted,

    // Context metrics
    ContextTokensUsed,
    ContextCompressionRatio,
    ContextOverflowDetected,

    // Performance metrics
    LocalModelLatency,
    CloudModelLatency,
    QualityScore,

    // Circuit breaker
    CircuitBreakerState,  // 0=closed, 1=half-open, 2=open
}
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. Add `HealthMonitor` module with `CircuitBreaker`
2. Add `FailoverManager` for automatic switching
3. Add configuration parsing for all new config sections

### Phase 2: Context Management
4. Add `ContextManager` with `TokenMonitor`
5. Add `ContextCompressor` with semantic analysis
6. Implement background monitoring task

### Phase 3: Performance Mode
7. Add `DualModelProcessor`
8. Add `QualityScorer` interface
9. Implement interleaved workflow

### Phase 4: Observability
10. Add Prometheus metrics exporter
11. Add structured logging
12. Add health check endpoints