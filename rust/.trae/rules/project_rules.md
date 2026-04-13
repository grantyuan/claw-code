# Project Rules

## Mandatory Rule: Non-Invasive Code Modification

### Core Principle
**All new functionality MUST be implemented in separate, standalone crates/modules. Original codebase modifications MUST be minimal and clearly marked.**

### Rationale
This rule ensures:
- Clean separation between upstream (original) code and custom extensions
- Simplified upstream merge/rebase operations without conflicts
- Clear audit trail for all custom changes
- Maintainability and future upgrades

### Requirements

#### 1. New Features → Separate Crates
- Create a new crate under `crates/` for new functionality
- Example: `crates/tiered-lm/` for multi-model routing features
- The new crate should have its own `Cargo.toml` and `src/`

#### 2. Modifications to Original Code → Marked with Identifiers
All changes to existing files (especially upstream files) MUST use clear markers:

```rust
// BEGIN {FEATURE_NAME}_EXTENSION
// Description of what was added
// ... code ...
// END {FEATURE_NAME}_EXTENSION
```

Example:
```rust
// BEGIN TIERED_LM_EXTENSION - Multimodal image support (non-breaking addition)
ImageUrl {
    url: String,
},
// END TIERED_LM_EXTENSION
```

#### 3. Prohibition
- Do NOT modify existing enum variants or struct fields (these break backward compatibility)
- Do NOT delete existing code (only comment out with extension markers if absolutely necessary)
- Do NOT refactor or "clean up" existing code that is not directly related to your feature

#### 4. If Modification is Absolutely Necessary
When a core modification is unavoidable:
1. First, explore if there's a way to implement the feature without modifying core code
2. If modification is required, use the marking system above
3. Document the modification in the crate's README or in this file
4. Ensure the modification is backward compatible

### Exception Handling
If you believe a core modification is necessary, you MUST:
1. Explain why the feature cannot be implemented without modification
2. Get explicit approval before proceeding
3. Ensure the modification is the minimum required change

### Enforcement
All AI assistants and code modification tools MUST:
1. Check this file before making any changes
2. Use the marking system for any original code modifications
3. Prefer creating new crates over modifying existing ones
4. Document any deviations from this rule

---

## Feature Crates

| Crate | Purpose | Location |
|-------|---------|----------|
| `tiered-lm` | Ollama/VLLM support + tiered model routing | `crates/tiered-lm/` |

## Original Code Modifications Log

| File | Change | Marker | Reason |
|------|--------|--------|--------|
| `types.rs` | Added `ImageUrl` variant to `InputContentBlock` | `TIERED_LM_EXTENSION` | Non-breaking enum addition for multimodal support |
