# beheart CLI IDE / AI Coding Workbench Plan

Research date: 2026-05-03

Repo baseline: `heart` already has a local interactive workbench contract, CLI/MCP commands, graph and context packs, docs/spec memory, domain packs, benchmark artifacts, model/provider registry, AI gateway, chat runtime, allowlisted agent tools, portal chat contracts, and portal workbench/model settings. This plan extends those surfaces into a terminal-first coding workbench. It does not implement code.

Research inputs reviewed:

- Cursor product/docs: [Cursor docs](https://docs.cursor.com/), [Cursor features](https://www.cursor.com/features), [Cursor Tab](https://docs.cursor.com/tab/overview), [Inline Edit](https://docs.cursor.com/cmdk), [Rules](https://docs.cursor.com/context/rules), [CLI usage](https://docs.cursor.com/en/cli/using), [CLI permissions](https://docs.cursor.com/cli/reference/permissions)
- VS Code/Copilot: [inline suggestions and next edit suggestions](https://code.visualstudio.com/docs/copilot/ai-powered-suggestions), [VS Code extension API](https://code.visualstudio.com/api)
- Zed: [edit prediction](https://zed.dev/docs/ai/edit-prediction), [inline assistant](https://zed.dev/docs/ai/inline-assistant), [completions](https://zed.dev/docs/completions)
- Continue: [chat quick start](https://docs.continue.dev/ide-extensions/chat/quick-start), [edit quick start](https://docs.continue.dev/ide-extensions/edit/quick-start), [autocomplete quick start](https://docs.continue.dev/ide-extensions/autocomplete/quick-start), [agent quick start](https://docs.continue.dev/ide-extensions/agent/quick-start), [autocomplete model role](https://docs.continue.dev/customize/model-roles/autocomplete)
- Editor/runtime foundations: [Neovim LSP](https://neovim.io/doc/user/lsp/), [Language Server Protocol](https://microsoft.github.io/language-server-protocol/), [Tree-sitter](https://tree-sitter.github.io/tree-sitter/), [Monaco Editor](https://microsoft.github.io/monaco-editor/), [CodeMirror](https://codemirror.net/)

Patterns extracted, not copied:

- Cursor: fast Tab/ghost-text loop, inline command prompt, command/reference syntax, rules/memory, CLI agent, MCP, permissions, model choice, codebase understanding, review checkpoints.
- VS Code/Copilot: ghost text, next edit suggestions, model selection, disable/enable settings, extension contribution points, command palette, workbench extensibility.
- Zed: automatic edit prediction distinct from explicit inline assistant, multiple prediction navigation, manual trigger and disable controls, provider selection, LSP completions.
- Continue: chat sidebar, selected code to chat, `@` context, inline edit diffs, autocomplete accept/reject/partial accept, agent/plan/chat modes, permission prompts.
- Neovim/LSP/Tree-sitter: terminal-native keyboard ergonomics, language-server reuse, JSON-RPC protocol boundary, incremental parse/syntax foundation.
- Monaco/CodeMirror: later web/desktop editor options, rich browser editor components, extension surface, accessibility, line numbers, linting, search, completion.

## Implementation Status

Current MVP status after implementation pass:

| Story | Status | Notes |
|---|---|---|
| IDE-1 | Done | `heart ide`, terminal capability detection, TTY shell, status layout, help, non-TTY safety, JSON status. |
| IDE-2 | Done | File search/open, text viewer, repo-root path containment, binary/large file guardrails. |
| IDE-3 | Done | Command palette registry and `heart ide palette`. |
| IDE-4 | Done | Default/vim/emacs/vscode-like keymaps, `.heart/keymap.yaml`, conflict detection. |
| IDE-5 | Done | External editor fallback through `heart ide open --editor <cmd> <file>`. |
| IDE-AI-1 | Partial | Existing chat runtime is reachable from interactive `/chat`; richer split AI pane/model switcher remains future UI work. |
| IDE-AI-2 | Partial | Existing context attachment functions are mapped, including `attachDocsSpec`; IDE toggle UI remains future work. |
| IDE-AI-3 | Partial | Patch proposal contract and diff preview exist; direct AI-to-patch generation is not wired to model calls yet. |
| IDE-AI-4 | Done | Confirmed patch apply and rollback id support exist for MVP patch flow. |
| IDE-AI-5 | Partial | Manual suggestion package and accept/reject functions exist with provider injection; ghost-text UI remains deferred. |
| IDE-AI-6 | Partial | Next-line/block request functions exist; terminal rendering remains deferred. |
| IDE-DEV-1 | Done | Package script discovery via `packages/dev-runner`. |
| IDE-DEV-2 | Done | `heart ide run test|lint|typecheck|<script>` with safety classification. |
| IDE-DEV-3 | Partial | Dev server start/stop functions exist; persistent CLI management UI remains future work. |
| IDE-DEV-4 | Done | `packages/dev-runner` parses TypeScript/eslint-style diagnostics and navigation targets, `packages/lsp-adapter` normalizes LSP `publishDiagnostics`, `heart ide diagnostics` exposes grouped JSON/human output, `heart ide diagnostics-nav` exposes numbered jump targets, `heart ide lsp-probe` performs timeout-bounded initialize/capability negotiation, and `heart ide lsp-diagnostics` uses a reusable in-process LSP session manager for didOpen/didChange diagnostics against allowlisted presets. Cross-command daemon persistence remains future work. |
| IDE-DEV-5 | Done | Git status, diff, staged diff, review summary, read-only stage picker, selectable TTY/scripted stage-picker choices, confirm-gated stage/unstage, commit draft, and PR draft are available. |
| IDE-MEM-1 | Partial | `heart ide context` builds context packs and `heart ide memory attachments` suggests selectable context artifacts; richer interactive pane toggles remain future work. |
| IDE-MEM-2 | Partial | `heart ide graph` shows repo memory overview and `heart ide memory graph --select graph:overview` selects graph artifacts; richer graph drill-down pane remains future work. |
| IDE-MEM-3 | Partial | `heart ide docs` shows docs/spec summary/search and `heart ide memory docs --select docs:1` selects relevant docs; richer docs/spec sync pane remains future work. |
| IDE-MEM-4 | Partial | `heart ide policy` surfaces policy reports and `heart ide memory policy --select policy:1` selects warning artifacts; blocking integration into edit/apply flow remains future work. |
| IDE-MEM-5 | Partial | `heart ide domain` wraps domain pack actions and `heart ide memory domain --select domain:<pack>` selects pack artifacts; richer domain artifact preview remains future work. |
| IDE-SEC-1 | Partial | Redaction/sensitive-text checks exist in suggestion/dev/patch paths; central model-request redaction audit remains future work. |
| IDE-SEC-2 | Done | Patch writes require explicit confirmation after preview. |
| IDE-SEC-3 | Done | Task runner blocks destructive commands and requires confirmation for risky scripts. |
| IDE-QA-1 | Done | CLI IDE smoke tests added. |
| IDE-QA-2 | Done | Keymap tests added. |
| IDE-QA-3 | Done | Patch safety tests added. |
| IDE-QA-4 | Done | README, CLI spec, architecture, and this plan updated for the MVP command surface. |

## 1. Product Vision

beheart IDE Workbench should become a terminal-first AI coding environment for developers who want to write, edit, run, test, review, and ship code without leaving terminal flow. It should feel like `heart` becomes the focused command center for daily AI-assisted engineering, not a generic chat screen and not a clone of VS Code.

Positioning:

- Terminal-first AI coding environment.
- Clean, focused, fast.
- Not a VS Code clone. It should not recreate every panel, extension, and debugger path before proving value.
- Not a generic chatbot. Chat is one input lane into repo-aware actions.
- Grounded in durable beheart project memory: repo graph, context packs, docs/spec sync, domain packs, policies, benchmark evidence, MCP tools, generated artifacts, and decisions.
- Designed for flow, speed, reduced context switching, and lower token waste.

Product promise:

- A developer opens `heart ide`.
- beheart shows what it knows, what is stale, what changed, what policy risks exist, and which context can help.
- The developer can edit with AI assistance, ask repo-aware questions, preview patches, run checks, and draft commit/PR output.
- Every AI action can show its context source, token budget, model, policy warnings, and rollback path.

Core belief:

- CLI-first coding workflows may become a major AI-native development lane.
- beheart should explore this lane because it already owns local-first repo memory, MCP, graph, docs, benchmarks, and provider-neutral agent runtime.
- The winning wedge is not "better editor chrome"; it is "AI coding inside an editor that already knows why the repo exists and how changes should be governed."

## 2. Practicality Assessment

Score: 1 = low, 5 = high. For risk/complexity rows, high means harder or riskier.

| Dimension | Score | Assessment |
|---|---:|---|
| Developer value | 5 | Daily coding loop is where beheart memory becomes useful, not just visible. |
| Product differentiation | 5 | Durable repo memory, docs/spec sync, policy warnings, domain packs, MCP, and ROI evidence create a stronger wedge than generic chat. |
| Implementation complexity | 5 | Full terminal editor, LSP, inline predictions, diff safety, process management, and model latency are hard. |
| Performance risk | 4 | Inline suggestions need sub-second perceived latency and low token cost; graph/context attachment can become heavy. |
| Adoption ease | 4 | `heart ide` is low-friction for terminal users; harder for users committed to VS Code/Cursor unless paired with external editor fallback. |
| Enterprise readiness | 4 | Strong story if permissions, audit, provider exposure, local-only mode, and command allowlists ship early. |
| AI usefulness | 5 | Repo memory directly improves task planning, reuse detection, policy warning, docs linkage, and benchmark-aware implementation. |
| CLI UX risk | 4 | Terminal editing can become cramped or confusing if too many panes/modes ship too early. |
| Security risk | 5 | AI edits, shell commands, repo context, secrets, and model payloads are sensitive. |
| MVP speed | 4 | Fast if MVP is workbench shell + external editor + patch preview + chat/context, not full custom IDE. |

Should beheart build this?

Yes, as a phased product bet. Build the CLI Workbench MVP first, then add richer editor behavior only where it proves daily value. Do not attempt a full custom editor in phase 1.

Why now?

- Current product already has the right substrate: CLI, MCP, graph, context packs, docs, domain packs, benchmarks, AI provider registry, chat runtime, and safe tool contracts.
- AI coding workflows are moving toward terminal agents and low-friction context attachment.
- beheart needs a daily workflow surface so durable memory becomes behavior, not only reports/artifacts.

Fastest MVP:

- `heart ide` launches an interactive workbench.
- Show repo/model/scan/docs/git status.
- File search and file viewer.
- External editor fallback using `$EDITOR`.
- AI chat pane backed by current chat runtime.
- Context pack/docs/graph/domain pack attachments.
- Patch proposal, diff preview, confirm apply, rollback.
- Run npm scripts/tests/lint/typecheck.
- Command palette and keymap config.

Defer:

- Full custom multi-cursor editor.
- Full debugger.
- Full LSP for all languages.
- Always-on next-edit prediction.
- Extension marketplace.
- Remote containers.
- Background autonomous agents that edit without approval.

Different from Cursor/VS Code/Claude Code:

- beheart owns source-backed memory before generation: graph, docs/specs, decisions, policies, context packs, domain packs, benchmark evidence.
- beheart can expose why a suggestion was made and which repo evidence shaped it.
- beheart can make policy/risk/reuse warnings first-class, not hidden in prompt text.
- beheart can measure ROI with benchmark scenarios and compare baseline vs assisted runs.

Useful even if user already uses VS Code:

- `heart ide` can be the memory and agent console while VS Code remains the rich editor through external editor fallback.
- It can generate context packs, patch proposals, docs/spec updates, benchmark runs, and commit/PR summaries grounded in beheart memory.
- It can connect to existing IDEs later through VS Code/Neovim extensions and MCP.

## 3. Target User Experience

### Flow A: First Run

Command:

```bash
heart ide
```

Initial screen:

```text
+-- BeHeart IDE -----------------------------------------------------------+
| repo be-ai-heart      branch main        model openai/gpt-5.1           |
| scan synced 12m ago   docs 26 synced     graph 1,248 nodes / 2,901 edges|
| budget 8k active      mcp ready          dirty files 7                  |
+-------------------------------------------------------------------------+
| Status                                                                  |
| - Current branch: main                                                   |
| - Changed files: docs/03-technical-architecture.md, packages/cli/...     |
| - Selected model: OpenAI / gpt-5.1                                       |
| - Provider keys: OpenAI configured, Anthropic missing                    |
| - Scan: usable, generated-noise excluded                                 |
| - Docs/specs: synced, 2 stale docs                                       |
| - Suggested next: open changed file, build context pack, run tests       |
+-------------------------------------------------------------------------+
| Ctrl+P files  Ctrl+K AI  Ctrl+R run  Ctrl+Shift+D diff  /help           |
+-------------------------------------------------------------------------+
```

User can immediately:

- Open file picker.
- Open recent or changed file.
- Ask AI.
- Build/attach context pack.
- Search docs/specs.
- Show repo graph.
- Run tests.
- Review diff.

First-run missing state:

- If no config, show `heart init`.
- If no scan, show `heart scan`.
- If no model key, show `heart models add-key --provider ... --api-key-stdin`.
- If non-TTY, print compact help and exit.
- If terminal too narrow, open single-pane mode.

### Flow B: Daily Coding

User path:

1. `heart ide`
2. `Ctrl+P` to open file.
3. Edit code in terminal editor or external `$EDITOR`.
4. Receive inline suggestions when enabled.
5. Accept next word, line, or block.
6. Select code and use `Ctrl+K` for inline edit.
7. Ask AI to explain/refactor/test.
8. Preview AI patch as diff.
9. Apply patch after confirmation.
10. Run tests/lint/typecheck.
11. Inspect diagnostics.
12. Generate commit-ready summary.

Required states:

- Editing clean file.
- Editing dirty buffer.
- Suggestion pending.
- Patch preview pending.
- Tests running.
- Tests failed with diagnostics.
- Git dirty state changed outside workbench.
- AI patch blocked by policy or secret risk.
- Rollback available.

### Flow C: Repo-Aware AI Task

User:

```text
Implement account balance adjustment safely.
```

beheart should:

1. Detect task intent: account/balance/domain/backend/financial risk.
2. Load relevant context pack or offer to build one.
3. Search graph for balance/account/payment/ledger services.
4. Search docs/specs for business rules and accepted requirements.
5. Find reuse candidates: existing ledger adjustment, audit trail, transaction validation, tests.
6. Show policy warnings: money movement, audit logging, data integrity, docs required.
7. Propose plan with files likely touched, tests, docs, risks.
8. Ask confirmation before edits.
9. Generate patch proposal.
10. Show diff before write.
11. Apply only approved hunks/files.
12. Run tests/lint/typecheck.
13. Suggest docs/spec updates if behavior changed.
14. Produce commit summary and PR summary.

Example agent output:

```text
Plan ready. Source-backed.

Context:
- graph: account service, ledger adjustment, audit event writer
- docs: balance-adjustment business rules, auth/audit requirements
- policy: money movement requires audit event + tests

Risks:
- missing idempotency requirement in docs
- no existing negative-balance test found

Next:
1. Edit packages/account-ledger
2. Add service test
3. Update docs/specs/account-balance.md

Apply patch? y/N
```

### Flow D: Domain Pack Build

User:

```text
Build tolling sales demo kit.
```

beheart should:

1. Load `tolling-management` pack.
2. Ask or infer overlay: core, regional, agency, customer.
3. Show warnings: demo-safe only, no real plates/payment data/PII.
4. Generate artifacts under `.heart/packs/tolling-management/generated/...`.
5. Show files changed and manifest.
6. Preview website copy, demo data, proposal starter, ROI story.
7. Offer run command for website/preview.
8. Offer sync reviewed artifacts back to source-backed location.

Expected output:

```text
Tolling demo kit generated.

Artifacts:
- executive-one-pager.md
- demo-script.md
- ui-prototype-spec.md
- proposal-starter.md
- roi-story.md
- source-claims.md

Warnings:
- generated demo content; verify toll rates and legal claims with customer sources
- no real PII or plate data included

Next:
- open artifact
- preview website
- sync reviewed artifacts
```

## 4. UI Layout

Terminal layout should adapt to width and height. Default should be dense, quiet, and keyboard-first.

Wide layout:

```text
+ repo | branch | model | scan | docs | graph | budget | git ----------+
| Files/Search        | Code editor/viewer                 | AI/Context   |
| src/                |  1 import ...                      | Chat         |
| packages/           |  2 export function ...             | Context      |
| docs/               |  3                                  | Docs/specs   |
| changed files       |                                     | Warnings     |
| symbols             |                                     | Tool calls   |
+---------------------+-------------------------------------+--------------+
| Terminal | Tests | Diagnostics | Git | Diff | MCP | Benchmarks        |
+------------------------------------------------------------------------+
```

Compact layout:

```text
+ repo | branch | model | scan | budget -------------------------------+
| Code / Chat / Files / Run tabs                                          |
+------------------------------------------------------------------------+
| Command line: Ctrl+P files  Ctrl+K AI  Ctrl+J terminal  /help           |
+------------------------------------------------------------------------+
```

Top status bar:

- Repo.
- Branch.
- Model/provider.
- Scan/cache status.
- Docs/spec status.
- Graph node/edge count.
- Context budget.
- Git dirty count.
- AI suggestion state.

Left pane:

- File tree.
- Fuzzy file search.
- Symbol search.
- Changed files.
- Recent files.

Center pane:

- Code editor or file viewer.
- Inline ghost text.
- Diff gutter.
- Diagnostics markers.
- Selection overlay.
- External editor status when `$EDITOR` owns editing.

Right pane:

- AI chat.
- Active context attachments.
- Docs/spec citations.
- Graph/reuse candidates.
- Policy warnings.
- Tool calls.

Bottom pane:

- Terminal process.
- Run/test/lint/typecheck output.
- Diagnostics.
- Git status.
- Diff preview.
- MCP tool output.
- Benchmark run output.

Modes:

- Focus Mode: code only, minimal status.
- Agent Mode: chat + context + patch preview.
- Review Mode: changed files + diagnostics + diff.
- Run Mode: terminal logs + tasks.
- Context Mode: graph/docs/context pack/domain pack.

Accessibility and ergonomics:

- Works in 80-column terminal with single-pane tabs.
- No color-only status.
- Searchable command palette.
- Discoverable keybindings.
- Copyable command output.
- Non-TTY exits cleanly.

## 5. Core Features

### Editor Core

Phase 1 editor core should be intentionally modest:

- Open/edit/save files.
- Syntax highlighting for common extensions.
- Line numbers.
- Search in file.
- File tree.
- Fuzzy file search.
- Symbol search using existing graph/LSP later.
- Diagnostics panel from tasks/LSP later.
- Git diff gutter from `git diff`.
- Undo/redo inside terminal buffer where supported.
- External editor fallback via `$EDITOR` or configured command.

Implementation stance:

- MVP can use file viewer + external editor for reliable editing.
- Add custom text buffer after patch/diff and command flows prove value.
- Do not block MVP on full terminal editor parity.

### AI Coding Features

Must include over phases:

- Inline ghost text.
- Next-line suggestion.
- Next-block suggestion.
- Next-edit prediction.
- Accept word.
- Accept line.
- Accept block.
- Reject suggestion.
- Manual suggestion trigger.
- Prompt inline edit.
- Explain selection.
- Refactor selection.
- Generate tests.
- Fix diagnostic.
- Apply patch.
- Show diff before write.
- Rollback AI change.

MVP AI features:

- Chat about current file/selection.
- Generate patch proposal from prompt + context pack.
- Preview patch before write.
- Apply selected hunks/files.
- Rollback last AI patch.
- Generate tests and run detected test script.
- Manual-only inline suggestion spike behind config flag.

### beheart-Aware Features

Must include:

- Attach context pack.
- Attach docs/specs.
- Attach repo graph.
- Attach domain pack.
- Attach benchmark scenario.
- Show policy warning.
- Show reuse candidate.
- Show missing context warning.
- Update docs/spec after accepted implementation.
- Run benchmark scenario.
- Generate implementation plan.

beheart-specific user value:

- "Why this file?" answer from graph/docs/policy evidence.
- "What should I reuse?" answer from context compiler and graph.
- "What docs/specs changed?" answer from doc sync and citation state.
- "What tests matter?" answer from graph `TESTED_BY`, package scripts, and prior benchmark scenarios.
- "What ROI evidence supports this?" answer from benchmark summary.

### Dev Workflow Features

Must include:

- Run project.
- Run test.
- Run lint.
- Run typecheck.
- Run dev server.
- View logs.
- Kill process.
- Manage env status without exposing secrets.
- Show package scripts.
- Git status.
- Stage selected files.
- Commit summary draft.
- PR summary draft.

Dev-runner rules:

- Detect `package.json` scripts first.
- Support explicit user-configured tasks in `.heart/tasks.yaml` later.
- Confirm install/build/deploy/destructive commands.
- Do not run arbitrary shell through AI without confirmation.
- Capture stdout/stderr with redaction and size limits.

## 6. Fast Key / Keymap System

Principles:

- Fast.
- Memorable.
- Vim/Emacs-friendly.
- VS Code/Cursor familiar presets.
- User-customizable.
- Stored in repo or user config.
- Discoverable in command palette.
- Conflict-aware.

Default keymap:

| Key | Action |
|---|---|
| `Ctrl+P` | File search |
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+K` | AI command / inline edit |
| `Ctrl+L` | Ask AI about current file/selection |
| `Tab` | Accept suggestion |
| `Alt+Right` | Accept next word |
| `Alt+Down` | Accept next line |
| `Ctrl+Enter` | Apply AI patch after preview |
| `Ctrl+J` | Toggle terminal |
| `Ctrl+B` | Toggle file tree |
| `Ctrl+G` | Toggle graph/context panel |
| `Ctrl+D` | Toggle docs/spec panel |
| `Ctrl+R` | Run task |
| `Ctrl+T` | Run tests |
| `Ctrl+E` | Show diagnostics |
| `Ctrl+Shift+D` | Diff review |
| `Esc` | Cancel suggestion/tool/popup |
| `q` | Close current panel in review/context modes |
| `/exit` | Exit session |

Supported presets:

- `default`
- `vim`
- `emacs`
- `vscode-like`
- `cursor-like`
- `custom`

Config file:

```yaml
# .heart/keymap.yaml
schema_version: 1
profile: default
extends: default
bindings:
  - action: workbench.file.search
    key: Ctrl+P
    when: global
    description: Open file search
    source: user
  - action: ai.suggestion.accept.word
    key: Alt+Right
    when: editor.suggestion.visible
    description: Accept next suggestion word
    source: user
conflicts:
  strategy: warn
```

Schema:

| Field | Type | Purpose |
|---|---|---|
| `schema_version` | integer | Keymap contract version |
| `profile` | string | Active named profile |
| `extends` | string | Base preset |
| `bindings[].action` | string | Stable action id |
| `bindings[].key` | string | Terminal key chord |
| `bindings[].when` | string | Context expression |
| `bindings[].description` | string | Help text |
| `bindings[].source` | string | `default`, `preset`, `user`, `workspace` |
| `conflicts.strategy` | string | `warn`, `error`, `last_wins` |

Conflict handling:

- Detect exact key + context conflicts.
- Warn on terminal-incompatible chords.
- Preserve user override source.
- Show replacement command.
- Never silently drop user bindings.

## 7. Command Palette

Command palette goals:

- One place to discover workbench actions.
- Same action ids used by keymap, slash commands, menus, and tests.
- Search by action label, command id, alias, file/symbol/task.

Required commands:

| Command | Action id | Notes |
|---|---|---|
| Open file | `workbench.file.open` | Fuzzy file picker |
| Search symbol | `workbench.symbol.search` | Graph/LSP backed |
| Ask AI | `ai.chat.ask` | Uses active context |
| Explain file | `ai.explain.file` | Current file context |
| Refactor selection | `ai.edit.refactorSelection` | Diff preview required |
| Generate tests | `ai.edit.generateTests` | Propose patch |
| Fix diagnostics | `ai.edit.fixDiagnostics` | Requires diagnostics context |
| Build context pack | `beheart.contextPack.build` | Existing compiler |
| Show graph | `beheart.graph.show` | Context mode |
| Search docs | `beheart.docs.search` | Existing docs search |
| Run tests | `dev.run.tests` | Dev-runner task |
| Run dev server | `dev.run.server` | Managed process |
| Show diff | `git.diff.show` | Git/diff engine |
| Apply patch | `patch.apply` | Confirmation required |
| Revert AI change | `patch.rollbackAi` | Last accepted AI patch |
| Build domain pack artifact | `beheart.domainPack.buildArtifact` | Allowlisted |
| Build tolling demo kit | `beheart.domainPack.buildTollingDemoKit` | Shortcut |
| Update docs/spec | `beheart.docs.updateSpecProposal` | Proposal first |
| Commit summary | `git.summary.commitDraft` | AI-assisted draft |
| PR summary | `git.summary.prDraft` | AI-assisted draft |

Palette result types:

- Action.
- File.
- Symbol.
- Recent command.
- Package script.
- Context pack.
- Domain pack artifact.
- Benchmark scenario.

## 8. AI Suggestion Architecture

Inline autocomplete must be fast and cheap. It should not use the same context budget as chat.

Required components:

1. Edit context collector
   - Current file prefix/suffix.
   - Cursor position.
   - Selection.
   - Nearby imports/symbols.
   - Current diagnostics.
   - Recent accepted edits.

2. Nearby code context
   - Same file window.
   - Local scope.
   - Related imports.
   - Current function/class.

3. Repo memory context
   - Lightweight symbol summaries.
   - Reuse candidates only when task/local context indicates need.
   - No full context pack by default for autocomplete.

4. Recent file history
   - Open files.
   - Recently edited files.
   - Recent accept/reject history.

5. Diagnostics context
   - LSP errors.
   - Typecheck/lint output.
   - Failing tests near current file.

6. Model request planner
   - Choose autocomplete model.
   - Use FIM format when provider/model supports it.
   - Fall back to prefix/suffix prompt template only if needed.
   - Cap max output tokens.

7. Suggestion debounce
   - Debounce keystrokes.
   - Cancel stale requests.
   - Trigger on meaningful pauses and manual request.

8. Suggestion cache
   - Cache by file hash + cursor + prefix/suffix signature.
   - Invalidate on buffer edits, model change, context setting change.

9. Cancellation
   - AbortController for provider requests.
   - Drop stale responses by request id.

10. Latency budget
   - Target p50 under 300 ms for cache/local model.
   - Target p95 under 1200 ms for remote autocomplete.
   - Hide suggestions that arrive after user moves beyond context.

11. Accept/reject telemetry
   - Local only by default.
   - Track accept word/line/block, reject, manual trigger, latency, model, estimated tokens.
   - Redact content unless user opts into detailed telemetry.

12. Privacy controls
   - Disable automatic suggestions.
   - Manual-only mode.
   - Local-only model mode.
   - No docs/spec context in autocomplete unless enabled.
   - Secret/path redaction before request.

Suggestion request flow:

```text
buffer change
  -> debounce
  -> collect prefix/suffix + local scope
  -> classify intent as completion/edit/fix
  -> attach small repo hints when useful
  -> choose autocomplete provider/model
  -> send cancellable request
  -> parse suggestion
  -> validate non-overlap and max size
  -> render ghost text or next-edit marker
  -> accept/reject telemetry
```

Default:

- Automatic suggestions off in MVP unless explicitly enabled.
- Manual suggestion trigger available.
- Smaller/faster model preferred.
- Chat/planning model not used for inline autocomplete unless user opts in.

## 9. Model Strategy

Use existing beheart provider/model registry and AI gateway as the base. Do not create a separate model config system.

Existing baseline:

- `packages/model-registry` owns provider metadata, fallback manifests, credential resolution, dynamic model discovery.
- `packages/ai-gateway` owns normalized chat/streaming requests and provider error mapping.
- `packages/chat-runtime` owns context attachments and BeHeart system prompting.
- `packages/agent-tools` owns allowlisted tools and confirmation policy.
- CLI model keys are local and permissioned; portal model keys require encrypted storage or env fallback.

Modes:

| Mode | Purpose | Preferred model class |
|---|---|---|
| Autocomplete model | Inline ghost text, next line, small completions | Fast FIM/code completion model, local optional |
| Chat model | Conversational coding help | General chat/tool model |
| Planning model | Source-backed implementation plans | Strong reasoning model |
| Patch model | Generate file edits/diffs | Strong code edit/apply model |
| Review model | Diff review, policy explanation | Strong reasoning + code model |
| Local model fallback | Privacy/offline/manual completion | Ollama/LM Studio OpenAI-compatible local model |

User settings:

```yaml
# .heart/ide.yaml
schema_version: 1
models:
  default: openai/gpt-5.1
  autocomplete: ollama/qwen2.5-coder
  chat: openai/gpt-5.1
  planning: anthropic/claude-sonnet
  patch: openai/gpt-5.1
  review: anthropic/claude-sonnet
  local_fallback: lmstudio/local-model
budgets:
  autocomplete_max_output_tokens: 96
  chat_max_input_tokens: 12000
  patch_max_input_tokens: 16000
privacy:
  automatic_suggestions: false
  send_repo_context: true
  send_docs_context: true
  local_only: false
```

Controls:

- Default provider/model.
- Autocomplete provider/model.
- Chat provider/model.
- Max token budget by mode.
- Auto-suggestion on/off.
- Manual suggestion only.
- Send repo context on/off.
- Send docs/spec context on/off.
- Local-only mode.
- Provider exposure warning.
- Model context visibility.

Model selection rules:

- Autocomplete should use small/fast models and prefix/suffix FIM where possible.
- Chat/planning can attach context packs, docs/specs, and graph summaries.
- Patch generation must request structured patch proposals, not raw unbounded prose.
- Review mode should include diff, policies, tests, and docs/spec context.
- Local-only mode blocks external provider calls.

## 10. Architecture Options

### Option A: CLI Workbench MVP

Terminal UI built inside current Node/TypeScript CLI.

Pros:

- Fastest beheart-native path.
- Reuses current `packages/cli`, `chat-runtime`, `model-registry`, `ai-gateway`, `mcp-server`, `context-compiler`, graph/docs/domain packs.
- Local-first and script-friendly.
- Easy to dogfood in this repo.
- Strong control over safety, context, and command grammar.

Cons:

- Terminal editor complexity is high.
- Inline rendering and keybindings vary by terminal.
- LSP integration adds process/protocol complexity.
- Harder to match mature IDE polish.

Best for:

- Fast MVP.
- Memory-aware coding shell.
- Agent/diff/run loop.
- External editor fallback.

### Option B: Neovim Integration

beheart runs as plugin/agent inside Neovim.

Pros:

- Terminal-native editing is already solved for power users.
- LSP, Tree-sitter, diagnostics, buffers, keymaps, splits, quickfix already exist.
- Lower custom editor burden.
- Strong developer adoption among CLI-first users.

Cons:

- Smaller addressable audience than generic terminal CLI.
- Less controlled UX.
- Lua/plugin maintenance surface.
- Harder to make beheart first-run experience consistent.
- Neovim users have strong preferences and existing plugin stacks.

Best for:

- Power-user adoption.
- Phase 4 extension/plugin.
- Validation of terminal coding workflows.

### Option C: Desktop/Web IDE Later

Portal or desktop app with Monaco/CodeMirror.

Pros:

- Rich editor features easier with Monaco/CodeMirror.
- Better visual polish for demos and team review.
- Reuses portal chat/model/context surfaces.
- Browser editor can expose graph/docs/benchmark visual context well.

Cons:

- Not terminal-first.
- Hosted portal cannot safely read/edit local files without a local runner.
- Desktop app adds packaging/signing/update complexity.
- Could distract from CLI/MCP/product-memory wedge.

Best for:

- Later portal IDE preview.
- Team review and demo.
- Visual context review, not initial daily coding.

Recommendation:

| Phase | Direction | Outcome |
|---|---|---|
| Phase 1 | CLI workbench + external editor fallback | Prove daily memory-aware agent loop |
| Phase 2 | LSP + inline suggestions | Add diagnostics, completions, fix diagnostic |
| Phase 3 | Richer terminal editor | Add custom buffer editing where value is proven |
| Phase 4 | VS Code/Neovim extensions | Meet users in existing editors |
| Phase 5 | Portal IDE preview | Visual review and team workflows with local runner |

## 11. Package Architecture

Prefer existing packages where they already own responsibility. Add new packages only when responsibility becomes reusable across CLI, MCP, portal/local runner, or future extensions.

### Proposed Packages/Modules

| Package/module | Status | Responsibilities | Inputs | Outputs | Dependencies | Tests |
|---|---|---|---|---|---|---|
| `packages/cli` | Exists | CLI command routing, `heart ide` entry, non-TTY behavior, help, JSON contracts | argv, cwd, env, config | exit codes, human/JSON output | core, workbench modules, chat-runtime | CLI smoke, help, non-TTY |
| `packages/cli-workbench` | New or internal submodule first | Workbench session state, layout orchestration, panes, mode switching, command palette bridge | terminal capabilities, repo state, commands | rendered UI model, events | cli, keymap, editor-core | layout snapshots, mode transitions |
| `packages/editor-core` | New | Text buffer model, file open/save, edits, selections, cursor, undo/redo, syntax token hooks | file path, content, edit ops | EditorBuffer, saved files, diagnostics refs | diff-engine, optional tree-sitter | buffer edits, file save conflict |
| `packages/ai-suggestions` | New | Inline suggestions, next-line/block, next-edit request planner, debounce/cache/telemetry | EditorBuffer, context, model config | SuggestionResult | ai-gateway, model-registry, context-compiler | mock model, cache, cancellation |
| `packages/keymap` | New | Keymap schema, presets, conflict detection, action resolution | `.heart/keymap.yaml`, terminal keys | resolved actions, warnings | none or shared-schema | schema, conflicts |
| `packages/dev-runner` | New | Discover package scripts, run/stop processes, capture logs, redact output | package files, selected task | ToolRun, RunTask, logs | core, policy/security helpers | process, allowlist, redaction |
| `packages/git-workflow` | New | Git status/diff/stage, commit/PR draft data, dirty-state protection | repo root, file set | GitStatus, DiffSummary | diff-engine | dirty state, stage selected |
| `packages/lsp-adapter` | New phase 2 | JSON-RPC LSP client, diagnostics, completions, symbols, code actions | workspace root, language server config | Diagnostic, symbol results, code actions | editor-core | mocked server protocol |
| `packages/code-actions` | New phase 2 | Fix diagnostic, generate tests, refactor selection action contracts | selection, diagnostics, context | PatchProposal | ai-suggestions, diff-engine, context-compiler | structured patch fixtures |
| `packages/diff-engine` | New | Unified diff parse/render/apply, hunk selection, rollback snapshots | PatchProposal, file content | PatchPreview, applied patch | editor-core | apply/reject/rollback |
| `packages/model-registry` | Exists | Provider/model metadata, fallback lists, credential resolution | env, credentials | provider/model records | none | existing + autocomplete roles |
| `packages/ai-gateway` | Exists | Provider-neutral requests, streaming, errors, usage/cost | provider request | normalized response/events | model-registry | existing + FIM/autocomplete adapters |
| `packages/chat-runtime` | Exists | BeHeart system prompt, sessions, context attachments, citations | messages, attachments | chat response/session | ai-gateway, portal-chat-contracts | prompt/context tests |
| `packages/agent-tools` | Exists | Allowlisted tool ids, safety levels, tool execution envelope | tool request | prepared/denied/confirmation result | none | safety tests |
| `packages/context-compiler` | Exists | Context pack ranking, token budget, reuse/policy/docs evidence | task, graph, docs, policy | context pack | graph, document-ingest, entity-linker | golden packs |
| `packages/mcp-server` | Exists | MCP tools for project memory/domain packs/benchmarks | tool calls | compact JSON responses | context-compiler, graph, core | MCP contract tests |
| `packages/portal-chat-contracts` | Exists | Shared session/message/attachment/artifact contracts | chat state | schema objects | none | schema tests |

Dependency rules:

- `packages/*` must not depend on `apps/*`.
- Workbench UI state should depend on package contracts, not portal components.
- MCP transport should not own graph/context logic.
- File/process/git effects should sit behind narrow adapters.
- AI patch apply must go through diff-engine and confirmation policy.

## 12. Function Inventory

| Function | Package/File | Exists? | Purpose | Inputs | Outputs | Tests |
|---|---|---|---|---|---|---|
| `startIdeWorkbench` | `packages/cli-workbench/src/index.ts` or `packages/cli/src/ide.js` | No | Launch `heart ide` session | cwd, env, io, flags | exit code, session events | CLI smoke, non-TTY |
| `detectTerminalCapabilities` | `packages/cli-workbench/src/terminal.ts` | Partial via `detectInteractiveTerminal` | Detect TTY, color, size, key support | stdin/stdout/env | capabilities | terminal fixture tests |
| `renderWorkbenchLayout` | `packages/cli-workbench/src/layout.ts` | Partial via `renderWelcomePanel` | Render panes/status/modes | WorkbenchSession, dimensions | frame/string/virtual tree | snapshot tests |
| `openFile` | `packages/editor-core/src/files.ts` | No | Load file into buffer | repo root, path | EditorBuffer | open missing/large/binary |
| `saveFile` | `packages/editor-core/src/files.ts` | No | Save buffer safely | EditorBuffer, expected hash | save result | conflict/save tests |
| `editBuffer` | `packages/editor-core/src/buffer.ts` | No | Apply text edit op | buffer, edit op | updated buffer | edit/undo tests |
| `searchFiles` | `packages/cli-workbench/src/search.ts` | No | Fuzzy file search | query, repo index | file results | ranking tests |
| `searchSymbols` | `packages/graph/src/index.js` | Yes | Symbol lookup | graph, query | matches | existing graph tests |
| `collectEditContext` | `packages/ai-suggestions/src/context.ts` | No | Gather prefix/suffix/local scope | buffer, cursor, diagnostics | SuggestionRequest context | fixture tests |
| `requestInlineSuggestion` | `packages/ai-suggestions/src/index.ts` | No | Generic inline suggestion | SuggestionRequest | SuggestionResult | mock gateway |
| `requestNextLineSuggestion` | `packages/ai-suggestions/src/index.ts` | No | Next line completion | SuggestionRequest | SuggestionResult | mock gateway |
| `acceptSuggestionWord` | `packages/ai-suggestions/src/accept.ts` | No | Apply next word | SuggestionResult, buffer | edit op | accept tests |
| `acceptSuggestionLine` | `packages/ai-suggestions/src/accept.ts` | No | Apply next line | SuggestionResult, buffer | edit op | accept tests |
| `acceptSuggestionBlock` | `packages/ai-suggestions/src/accept.ts` | No | Apply full suggestion | SuggestionResult, buffer | edit op | accept tests |
| `rejectSuggestion` | `packages/ai-suggestions/src/telemetry.ts` | No | Cancel/hide and log reject | suggestion id | telemetry event | telemetry tests |
| `requestInlineEdit` | `packages/code-actions/src/inline-edit.ts` | No | Prompt edit of selection | selection, prompt, context | PatchProposal | patch fixture |
| `generatePatch` | `packages/code-actions/src/patch.ts` | No | Create structured patch | prompt, attachments | PatchProposal | mock model |
| `previewPatch` | `packages/diff-engine/src/preview.ts` | No | Render hunk preview | PatchProposal, files | PatchPreview | diff snapshot |
| `applyPatchWithConfirmation` | `packages/diff-engine/src/apply.ts` | No | Confirm/apply selected patch | PatchPreview, confirmation | ToolRun/apply result | safety tests |
| `rollbackAiPatch` | `packages/diff-engine/src/rollback.ts` | No | Restore prior AI-applied state | rollback id | rollback result | rollback test |
| `runProjectTask` | `packages/dev-runner/src/index.ts` | No | Run configured task | RunTask | ToolRun | process test |
| `runTests` | `packages/dev-runner/src/tasks.ts` | No | Run test script | repo root, selector | ToolRun | mock npm script |
| `runLint` | `packages/dev-runner/src/tasks.ts` | No | Run lint script | repo root | ToolRun | missing script |
| `runTypecheck` | `packages/dev-runner/src/tasks.ts` | No | Run typecheck script | repo root | ToolRun | missing script |
| `startDevServer` | `packages/dev-runner/src/processes.ts` | No | Start long process | RunTask | process handle | start/kill test |
| `stopDevServer` | `packages/dev-runner/src/processes.ts` | No | Stop managed process | process id | stop result | signal test |
| `loadKeymap` | `packages/keymap/src/index.ts` | No | Load presets/user config | repo root, profile | KeymapProfile | schema tests |
| `saveKeymap` | `packages/keymap/src/index.ts` | No | Persist user overrides | profile | write result | write tests |
| `resolveKeybinding` | `packages/keymap/src/resolve.ts` | No | Map key/context to action | key event, context | command id | conflict tests |
| `detectKeybindingConflicts` | `packages/keymap/src/conflicts.ts` | No | Find conflicts | bindings | warnings/errors | conflict tests |
| `openCommandPalette` | `packages/cli-workbench/src/palette.ts` | No | Show/search actions | query, registry | selected command | palette tests |
| `executeWorkbenchCommand` | `packages/cli-workbench/src/commands.ts` | No | Dispatch command id | command, session | result | command tests |
| `attachContextPack` | `packages/chat-runtime/src/index.js` | Yes | Attach context pack | pack | ContextAttachment | existing + add tests |
| `attachRepoGraph` | `packages/chat-runtime/src/index.js` | Yes | Attach graph summary | graph | ContextAttachment | existing + add tests |
| `attachDocsSpec` | `packages/chat-runtime/src/index.js` | Partial as `attachDocs` | Attach docs/specs | docs | ContextAttachment | add alias test |
| `attachDomainPack` | `packages/chat-runtime/src/index.js` | Yes | Attach domain pack | pack | ContextAttachment | existing + add tests |
| `showPolicyWarnings` | `packages/policy-engine/src/index.js` plus workbench renderer | Partial | Surface warnings in UI | policy report | warning panel | policy UI snapshots |
| `generateCommitSummary` | `packages/git-workflow/src/summary.ts` | No | Draft commit message | diff, context, test result | summary text | snapshot tests |
| `generatePrSummary` | `packages/git-workflow/src/summary.ts` | No | Draft PR body | diff, context, benchmark/tests | PR draft | snapshot tests |

## 13. Data Contracts

### WorkbenchSession

```ts
type WorkbenchSession = {
  schema_version: 1;
  session_id: string;
  repo_root: string;
  safe_repo_path: string;
  repo_name: string;
  branch: string;
  started_at: string;
  mode: "focus" | "agent" | "review" | "run" | "context";
  terminal: TerminalCapabilities;
  model: WorkbenchModelSelection;
  context_attachments: ContextAttachment[];
  buffers: EditorBuffer[];
  active_buffer_id?: string;
  diagnostics: Diagnostic[];
  running_tools: ToolRun[];
  git: GitStatus;
  keymap_profile: string;
  privacy: WorkbenchPrivacySettings;
};
```

### EditorBuffer

```ts
type EditorBuffer = {
  schema_version: 1;
  buffer_id: string;
  path: string;
  language: string;
  content: string;
  saved_hash: string;
  current_hash: string;
  dirty: boolean;
  readonly: boolean;
  cursor: CursorPosition;
  selection?: SelectionRange;
  version: number;
  diagnostics: Diagnostic[];
};
```

### CursorPosition

```ts
type CursorPosition = {
  line: number;
  column: number;
};
```

### SelectionRange

```ts
type SelectionRange = {
  start: CursorPosition;
  end: CursorPosition;
  direction?: "forward" | "backward";
  text_hash?: string;
};
```

### SuggestionRequest

```ts
type SuggestionRequest = {
  schema_version: 1;
  request_id: string;
  mode: "inline" | "next_line" | "next_block" | "next_edit";
  buffer: {
    path: string;
    language: string;
    version: number;
    prefix: string;
    suffix: string;
    nearby_symbols: string[];
  };
  cursor: CursorPosition;
  diagnostics: Diagnostic[];
  repo_hints: ContextAttachment[];
  recent_edits: AiEditTelemetry[];
  model: WorkbenchModelSelection;
  privacy: WorkbenchPrivacySettings;
  max_output_tokens: number;
};
```

### SuggestionResult

```ts
type SuggestionResult = {
  schema_version: 1;
  suggestion_id: string;
  request_id: string;
  status: "ready" | "empty" | "cancelled" | "error";
  kind: "insert" | "replace" | "jump" | "multi_file";
  text: string;
  range?: SelectionRange;
  target_path?: string;
  confidence: number;
  model_id: string;
  latency_ms: number;
  estimated_tokens: number;
  reason?: string;
};
```

### PatchProposal

```ts
type PatchProposal = {
  schema_version: 1;
  proposal_id: string;
  title: string;
  summary: string;
  source: "ai" | "user" | "tool";
  prompt: string;
  model: WorkbenchModelSelection;
  context_attachments: ContextAttachment[];
  files: PatchFileChange[];
  policy_warnings: PolicyWarning[];
  risks: string[];
  tests_to_run: RunTask[];
  created_at: string;
};
```

### PatchPreview

```ts
type PatchPreview = {
  schema_version: 1;
  preview_id: string;
  proposal_id: string;
  status: "pending" | "approved" | "applied" | "rejected" | "conflict";
  hunks: PatchHunkPreview[];
  files_added: string[];
  files_modified: string[];
  files_deleted: string[];
  conflict_warnings: string[];
  secret_warnings: string[];
  rollback_id?: string;
};
```

### WorkbenchCommand

```ts
type WorkbenchCommand = {
  schema_version: 1;
  command_id: string;
  label: string;
  aliases: string[];
  category: "file" | "ai" | "beheart" | "dev" | "git" | "view" | "settings";
  safety_level: "read_only" | "confirmation_required" | "denied";
  handler: string;
  when?: string;
};
```

### KeyBinding

```ts
type KeyBinding = {
  schema_version: 1;
  action: string;
  key: string;
  when: string;
  description: string;
  source: "default" | "preset" | "workspace" | "user";
};
```

### KeymapProfile

```ts
type KeymapProfile = {
  schema_version: 1;
  profile: string;
  extends?: string;
  bindings: KeyBinding[];
  conflicts: KeybindingConflict[];
};
```

### ToolRun

```ts
type ToolRun = {
  schema_version: 1;
  run_id: string;
  tool_id: string;
  label: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "needs_confirmation";
  command_preview?: string;
  started_at?: string;
  completed_at?: string;
  exit_code?: number;
  stdout_preview?: string;
  stderr_preview?: string;
  redactions: RedactionFinding[];
};
```

### Diagnostic

```ts
type Diagnostic = {
  schema_version: 1;
  source: "lsp" | "lint" | "typecheck" | "test" | "policy";
  severity: "error" | "warning" | "info" | "hint";
  path: string;
  range?: SelectionRange;
  code?: string;
  message: string;
  related?: Diagnostic[];
};
```

### RunTask

```ts
type RunTask = {
  schema_version: 1;
  task_id: string;
  label: string;
  kind: "test" | "lint" | "typecheck" | "dev_server" | "custom";
  command: string[];
  cwd: string;
  safety_level: "read_only" | "confirmation_required" | "denied";
  env_policy: "inherit_redacted" | "explicit";
};
```

### ContextAttachment

Use existing `packages/portal-chat-contracts` shape and add workbench-specific metadata only if needed.

```ts
type ContextAttachment = {
  schema_version: 1;
  attachment_id: string;
  type: "repo" | "context_pack" | "repo_graph" | "docs" | "domain_pack" | "benchmark" | "sales_demo_kit";
  label: string;
  summary: string;
  source_ref: string;
  citations: Citation[];
  token_estimate: number;
  data: Record<string, unknown>;
};
```

### AiEditTelemetry

```ts
type AiEditTelemetry = {
  schema_version: 1;
  event_id: string;
  event_type: "suggestion_requested" | "suggestion_accepted" | "suggestion_rejected" | "patch_previewed" | "patch_applied" | "patch_rolled_back";
  session_id: string;
  suggestion_id?: string;
  proposal_id?: string;
  model_id?: string;
  latency_ms?: number;
  accepted_granularity?: "word" | "line" | "block" | "hunk" | "file";
  content_recording: "none" | "redacted" | "full_opt_in";
  created_at: string;
};
```

## 14. Security and Safety

Threat model:

| Threat | Impact | Control |
|---|---|---|
| AI writes unsafe code | Security bugs, financial/data harm | Source-backed plan, policy warnings, tests, review mode |
| Prompt injection from repo/docs | Tool misuse, wrong edits | Treat repo/docs as untrusted context, isolate instructions, cite sources |
| Secret leakage into model request | Credential exposure | Secret redaction, `.env` deny by default, visibility panel |
| Accidental file overwrite | User work loss | Dirty-state check, expected hash, diff preview, rollback |
| Destructive shell commands | Data loss | Allowlist tasks, confirmation, deny risky commands by default |
| Malicious package install | Supply-chain risk | Confirm package manager installs, show package diff, policy warning |
| Private repo context leakage | Confidentiality breach | Local-only mode, provider exposure warnings, context controls |
| Unreviewed edits | Bad code committed | Diff before write, hunk approval, audit trail |
| Key leakage | Provider/account compromise | Local 0600 credentials, portal encryption/env fallback, masking |
| Command injection | Arbitrary execution | Structured argv, no shell interpolation, allowlist |
| Path traversal | File access outside repo | Normalize paths, repo-root containment checks |
| Model output injection | Misleading instructions | Structured patch parser, no direct execution from prose |

Required controls:

- Redact secrets from prompts, logs, patches, telemetry, benchmark artifacts, portal sync.
- Show diff before AI writes.
- Confirm risky actions.
- Allowlist project commands.
- Block arbitrary destructive shell by default.
- Respect git dirty state.
- Never overwrite user changes silently.
- Local-only mode.
- Model context visibility.
- Audit AI actions.
- Rollback support.
- Bound request sizes and output sizes.
- Deny binary/large/generated file edits unless explicit.
- Use structured argv for process execution.
- Keep AI tool permissions separate from human commands.

Security acceptance:

- `heart ide` can show exactly what context will be sent to provider.
- `heart ide --local-only` prevents external model calls.
- Patch apply fails if file hash changed after preview.
- AI cannot run shell commands without explicit confirmed workbench action.
- Secret-like content in changed files triggers warning before model request and patch apply.

## 15. MVP Scope

Fastest MVP:

- `heart ide`.
- Polished terminal welcome/status.
- File search.
- File viewer and external editor fallback.
- AI chat pane using current chat runtime.
- Model selector using current registry.
- Context pack attachment.
- Docs/spec search.
- Graph summary/context panel.
- Domain pack attachment and tolling demo action.
- Patch proposal + diff preview.
- Apply patch with confirmation.
- Rollback last AI patch.
- Run test/lint/typecheck/package scripts.
- Keymap config.
- Command palette.
- Git status and commit summary draft.
- Non-TTY safety.

MVP non-goals:

- Full custom editor parity.
- Full multi-cursor.
- Full debugger.
- Full LSP for all languages.
- Always-on edit prediction.
- Real-time collaboration.
- Voice.
- Image/video generation.
- Autonomous long-running background agent.
- Marketplace extensions.
- Remote dev containers.

MVP success criteria:

- A developer can use `heart ide` for one repo-aware task from plan to patch preview to test run to commit summary.
- The task uses beheart context pack/docs/graph/policy evidence.
- No file writes happen without diff/confirmation.
- Non-TTY and CI are safe.
- Security controls are visible and testable.

## 16. Implementation Stories

### Epic 1: IDE Workbench Foundation

#### IDE-1: Terminal Capability and Layout Shell

- User story: As a terminal-first developer, I want `heart ide` to open a stable workspace shell so I can see repo state before coding.
- Acceptance criteria: `heart ide --help` works; interactive TTY opens layout; non-TTY prints help and exits; narrow terminal falls back to single pane; status includes repo, branch, model, scan, docs, graph, budget, dirty files.
- Files likely touched: `packages/cli/src/index.js`, `packages/cli/src/interactive.js`, new `packages/cli-workbench/src/*`, `docs/04-mcp-cli-spec.md`.
- Functions/APIs: `startIdeWorkbench`, `detectTerminalCapabilities`, `renderWorkbenchLayout`.
- UI states: loading, ready, narrow, missing config, missing scan, error.
- Tests: CLI smoke, non-TTY, terminal width snapshots.
- Security notes: Redact local path; never show secrets/env values.
- Priority: P0.
- Definition of done: Command is documented, smoke-tested, and exits correctly in TTY/non-TTY.

#### IDE-2: File Tree/Search/Open

- User story: As a developer, I want to find and open repo files quickly so I can navigate without leaving the workbench.
- Acceptance criteria: `Ctrl+P` opens fuzzy search; ignores generated/vendor paths; changed/recent files appear; binary/large files open as metadata only.
- Files likely touched: new `packages/editor-core`, new `packages/cli-workbench/src/search.ts`, `packages/core/src/config.js`.
- Functions/APIs: `searchFiles`, `openFile`.
- UI states: empty query, matches, no matches, large file, binary file.
- Tests: search ranking fixture, ignore paths, open file edge cases.
- Security notes: Enforce repo-root containment; do not read ignored secret files by default.
- Priority: P0.
- Definition of done: File search opens safe text files and respects config ignores.

#### IDE-3: Command Palette

- User story: As a developer, I want one searchable command palette so I can discover workbench actions.
- Acceptance criteria: `Ctrl+Shift+P` opens palette; commands can execute; disabled commands show reason; command ids are stable.
- Files likely touched: `packages/cli-workbench/src/palette.ts`, `packages/keymap`, `docs/04-mcp-cli-spec.md`.
- Functions/APIs: `openCommandPalette`, `executeWorkbenchCommand`.
- UI states: searching, selected, disabled, confirmation required, no results.
- Tests: palette registry, command dispatch, disabled reason.
- Security notes: Palette must surface safety level before risky execution.
- Priority: P0.
- Definition of done: Palette can run file, AI, beheart, dev, git, and view commands by id.

#### IDE-4: Keymap System

- User story: As a developer, I want customizable keybindings so the workbench fits my terminal workflow.
- Acceptance criteria: Default keymap loads; `.heart/keymap.yaml` overrides; conflicts detected; presets selectable.
- Files likely touched: new `packages/keymap`, `.heart/keymap.yaml` docs, `docs/04-mcp-cli-spec.md`.
- Functions/APIs: `loadKeymap`, `saveKeymap`, `resolveKeybinding`, `detectKeybindingConflicts`.
- UI states: default profile, custom profile, conflict warning, unsupported key.
- Tests: schema, conflict, resolution precedence.
- Security notes: Keymap actions cannot bypass command safety.
- Priority: P0.
- Definition of done: Keymap supports defaults, overrides, and conflict reporting.

#### IDE-5: External Editor Fallback

- User story: As a developer, I want to use my existing editor from `heart ide` so MVP editing is reliable before custom editor parity.
- Acceptance criteria: Opens `$EDITOR` or configured editor; detects file hash before/after; refreshes buffer; handles editor exit code.
- Files likely touched: `packages/editor-core`, `packages/cli-workbench/src/external-editor.ts`, docs guide.
- Functions/APIs: `openFile`, `saveFile`, `editBuffer`.
- UI states: editor launching, editor running, file changed, no change, failed exit.
- Tests: mock editor command, hash conflict.
- Security notes: Editor command must be configured by user, not model-generated; no shell interpolation.
- Priority: P0.
- Definition of done: User can open/edit/save through external editor with dirty-state protection.

### Epic 2: AI Coding

#### IDE-AI-1: Chat Pane With Model Selector

- User story: As a developer, I want AI chat beside code using my selected provider/model.
- Acceptance criteria: Chat pane sends prompt; streams or displays response; shows provider/model, usage, cost when available; missing key gives next command.
- Files likely touched: `packages/cli-workbench`, `packages/chat-runtime`, `packages/ai-gateway`, `packages/model-registry`.
- Functions/APIs: existing `sendChatMessage`, `streamChatResponse`, workbench chat renderer.
- UI states: ready, streaming, missing key, provider error, cancelled.
- Tests: mock provider, missing key, JSON-free interactive output.
- Security notes: Show provider exposure note and active context before send.
- Priority: P0.
- Definition of done: One-shot repo-aware chat works in `heart ide` without raw secrets in output.

#### IDE-AI-2: Context Attachment

- User story: As a developer, I want to attach context packs, docs, graph, domain packs, and benchmarks to AI prompts.
- Acceptance criteria: Context panel shows active attachments, token estimate, citations, warnings; user can toggle sources.
- Files likely touched: `packages/chat-runtime`, `packages/context-compiler`, `packages/cli-workbench`.
- Functions/APIs: `attachContextPack`, `attachRepoGraph`, `attachDocsSpec`, `attachDomainPack`.
- UI states: no context, attached, stale, too large, local-only.
- Tests: attachment schema, token estimate, stale warning.
- Security notes: Context visibility before send; docs/spec redaction.
- Priority: P0.
- Definition of done: AI prompt can include selected beheart context with visible citations.

#### IDE-AI-3: Patch Proposal and Diff Preview

- User story: As a developer, I want AI-generated edits as previewable diffs before any file write.
- Acceptance criteria: AI returns structured patch; preview displays files/hunks; apply disabled until confirmation; conflicts detected.
- Files likely touched: new `packages/diff-engine`, new `packages/code-actions`, `packages/cli-workbench`.
- Functions/APIs: `generatePatch`, `previewPatch`, `applyPatchWithConfirmation`.
- UI states: generating, preview, conflict, approved, rejected.
- Tests: diff parse/render/apply, conflict, malformed patch.
- Security notes: Secret detection, path containment, no write without confirmation.
- Priority: P0.
- Definition of done: No AI file writes occur outside patch preview/apply path.

#### IDE-AI-4: Apply/Revert AI Edits

- User story: As a developer, I want to roll back AI edits if tests fail or I reject the result.
- Acceptance criteria: Workbench records rollback snapshot; rollback restores previous content; rollback fails safely if user changed file after apply.
- Files likely touched: `packages/diff-engine`, `packages/editor-core`, `packages/git-workflow`.
- Functions/APIs: `rollbackAiPatch`.
- UI states: rollback available, rollback conflict, rollback complete.
- Tests: rollback exact, rollback dirty conflict.
- Security notes: Preserve user edits after AI apply; never delete unrelated changes.
- Priority: P0.
- Definition of done: Last AI patch can be reverted safely.

#### IDE-AI-5: Inline Suggestion MVP

- User story: As a developer, I want manual inline suggestions so I can speed up coding without enabling noisy automation.
- Acceptance criteria: Manual trigger collects edit context; ghost text displays; accept word/line/block; reject hides; no automatic calls by default.
- Files likely touched: new `packages/ai-suggestions`, `packages/editor-core`, `packages/cli-workbench`.
- Functions/APIs: `collectEditContext`, `requestInlineSuggestion`, `acceptSuggestionWord`, `acceptSuggestionLine`, `acceptSuggestionBlock`, `rejectSuggestion`.
- UI states: idle, loading, visible, accepted, rejected, cancelled.
- Tests: mock suggestion, accept granularity, cancellation.
- Security notes: Redact secrets; no docs context unless enabled.
- Priority: P1.
- Definition of done: Manual suggestion works on simple buffer with mocked provider.

#### IDE-AI-6: Next-Line/Block Suggestion

- User story: As a developer, I want next-line or next-block predictions when the code intent is obvious.
- Acceptance criteria: Suggestion engine can request line/block; output size bounded; accept line/block works; latency displayed in debug panel.
- Files likely touched: `packages/ai-suggestions`, `packages/editor-core`.
- Functions/APIs: `requestNextLineSuggestion`, `acceptSuggestionLine`, `acceptSuggestionBlock`.
- UI states: line suggestion, block suggestion, stale response.
- Tests: max token bound, stale request cancellation.
- Security notes: Same autocomplete privacy controls.
- Priority: P1.
- Definition of done: Next-line/block suggestions work with mock model and do not block editor input.

### Epic 3: Dev Workflow

#### IDE-DEV-1: Package Script Discovery

- User story: As a developer, I want beheart to show available project scripts so I can run the right checks quickly.
- Acceptance criteria: Detects npm workspaces/scripts; marks test/lint/typecheck/dev; shows missing scripts gracefully.
- Files likely touched: new `packages/dev-runner`, `packages/cli-workbench`.
- Functions/APIs: `runProjectTask` discovery helpers.
- UI states: scripts found, none found, workspace selection.
- Tests: package fixture, monorepo fixture.
- Security notes: Read package scripts only; do not run until selected/confirmed.
- Priority: P0.
- Definition of done: Workbench lists project scripts with safe labels.

#### IDE-DEV-2: Run/Test/Lint/Typecheck Tasks

- User story: As a developer, I want to run tests/lint/typecheck from the workbench.
- Acceptance criteria: Tasks run with structured argv; output streams to Run pane; exit code shown; diagnostics extracted where possible.
- Files likely touched: `packages/dev-runner`, `packages/cli-workbench`.
- Functions/APIs: `runProjectTask`, `runTests`, `runLint`, `runTypecheck`.
- UI states: running, passed, failed, cancelled.
- Tests: mock command, exit code, output redaction.
- Security notes: Redact env-like values; command allowlist.
- Priority: P0.
- Definition of done: Test/lint/typecheck scripts run and report status.

#### IDE-DEV-3: Dev Server Management

- User story: As a developer, I want to start and stop dev servers from the workbench.
- Acceptance criteria: Start script runs as managed process; logs visible; stop kills process; port hints shown.
- Files likely touched: `packages/dev-runner`, `packages/cli-workbench`.
- Functions/APIs: `startDevServer`, `stopDevServer`.
- UI states: stopped, starting, running, failed, stopping.
- Tests: child process lifecycle fixture.
- Security notes: User-selected script only; never AI-invented shell.
- Priority: P1.
- Definition of done: Managed dev server starts/stops without orphaning process.

#### IDE-DEV-4: Diagnostics Panel

- User story: As a developer, I want a diagnostics panel that combines test/lint/typecheck and later LSP issues.
- Acceptance criteria: Parses common diagnostic formats; jumps to file/line; AI can use diagnostics context after confirmation.
- Files likely touched: `packages/dev-runner`, `packages/lsp-adapter`, `packages/cli-workbench`.
- Functions/APIs: diagnostics parser, `showPolicyWarnings`.
- UI states: none, warnings, errors, stale diagnostics.
- Tests: fixture outputs for tsc/eslint/node test.
- Security notes: Redact paths if synced/exported; local pane can show relative paths.
- Priority: P1.
- Definition of done: Diagnostics from tasks appear and can be navigated; reusable in-process allowlisted LSP sessions can initialize, send didOpen/didChange-compatible notifications, collect diagnostics with a timeout, and exit cleanly.

#### IDE-DEV-5: Git Status and Commit Summary

- User story: As a developer, I want git status and commit/PR drafts grounded in actual diffs.
- Acceptance criteria: Shows changed files; selected staging supported; commit summary draft generated; PR summary draft generated; no auto-commit.
- Files likely touched: new `packages/git-workflow`, `packages/diff-engine`, `packages/cli-workbench`.
- Functions/APIs: `generateCommitSummary`, `generatePrSummary`.
- UI states: clean, dirty, staged, conflicts, draft ready.
- Tests: git fixture or temp repo, summary snapshot.
- Security notes: Confirm staging; never commit/push without explicit command.
- Priority: P1.
- Definition of done: Workbench can draft summary from diff and context; stage-picker choices can be selected in TTY or scripted mode and still require confirmation before changing the git index.

### Epic 4: beheart Memory Integration

#### IDE-MEM-1: Context Pack Panel

- User story: As a developer, I want to see and attach task-specific context packs.
- Acceptance criteria: Build pack from prompt; show files/symbols/docs/reuse/policies/risks; attach to chat/patch.
- Files likely touched: `packages/context-compiler`, `packages/cli-workbench`.
- Functions/APIs: existing `compileContextPack`, `attachContextPack`.
- UI states: no pack, building, ready, stale, too large.
- Tests: context pack fixture, token budget.
- Security notes: Show missing context and policy warnings before edit.
- Priority: P0.
- Definition of done: Context pack panel can build and attach a pack; memory attachments expose stable selectable artifact ids and next actions.

#### IDE-MEM-2: Repo Graph Panel

- User story: As a developer, I want graph-aware navigation and reasoning in the workbench.
- Acceptance criteria: Shows graph summary; searches symbols; explains dependencies/impact; attaches graph evidence.
- Files likely touched: `packages/graph`, `packages/cli-workbench`, `packages/chat-runtime`.
- Functions/APIs: `searchSymbols`, existing dependency/impact functions, `attachRepoGraph`.
- UI states: graph missing, graph stale, ready, low confidence.
- Tests: graph fixture, missing target.
- Security notes: Relative paths; avoid raw dumps.
- Priority: P0.
- Definition of done: Graph panel can answer symbol/dependency/impact questions and expose selectable graph artifacts.

#### IDE-MEM-3: Docs/Spec Panel

- User story: As a developer, I want docs/spec requirements available during coding.
- Acceptance criteria: Search docs; show citations; attach selected docs; stale/missing docs warning; docs update proposal after behavior change.
- Files likely touched: `packages/document-ingest`, `packages/document-sync`, `packages/chat-runtime`, `packages/cli-workbench`.
- Functions/APIs: `attachDocsSpec`, docs search, docs update proposal command.
- UI states: no docs, search results, attached, stale, update proposal.
- Tests: docs search fixture, citation rendering.
- Security notes: Redact sensitive docs; respect ignored/restricted docs.
- Priority: P0.
- Definition of done: Docs/spec context can be searched and attached with citations; docs memory artifacts can be selected by stable id.

#### IDE-MEM-4: Policy Warning Panel

- User story: As a developer, I want policy warnings before AI edits so I avoid architecture/security drift.
- Acceptance criteria: Shows relevant policy warnings from context pack/policy engine; blocks high-risk actions until confirmation; warnings included in patch prompt.
- Files likely touched: `packages/policy-engine`, `packages/agent-tools`, `packages/cli-workbench`.
- Functions/APIs: `showPolicyWarnings`.
- UI states: no warnings, warning, blocked, confirmation required.
- Tests: policy fixture, blocked action.
- Security notes: Security warnings must not be suppressible by model output.
- Priority: P0.
- Definition of done: Policy warnings are visible before apply/run where relevant and can be selected as memory artifacts.

#### IDE-MEM-5: Domain Pack Actions

- User story: As a developer or seller, I want domain pack actions available inside the workbench.
- Acceptance criteria: Lists packs; builds tolling demo kit; shows layer/conflict/warning state; opens generated artifacts.
- Files likely touched: `packages/core/src/domain-packs.js`, `packages/mcp-server/src/tools.js`, `packages/cli-workbench`.
- Functions/APIs: `attachDomainPack`, domain pack build/list/validate functions.
- UI states: pack list, selected pack, build options, generated, conflicts.
- Tests: domain pack fixture, demo-safe validation.
- Security notes: No real PII/plate/payment data; generated labels/citations required.
- Priority: P1.
- Definition of done: Tolling sales demo kit can be generated from workbench with warnings; domain pack memory artifacts can be selected for follow-up actions.

### Epic 5: Safety and QA

#### IDE-SEC-1: Secret Redaction

- User story: As a security-conscious user, I want secrets redacted before they enter model prompts/logs.
- Acceptance criteria: Detects secret-like keys/values in context, logs, patches, telemetry; displays redaction findings; blocks `.env` reads by default.
- Files likely touched: `packages/editor-core`, `packages/ai-suggestions`, `packages/dev-runner`, `packages/diff-engine`, shared redaction helper.
- Functions/APIs: redaction utilities integrated into model/tool paths.
- UI states: redacted, blocked secret file, override confirmation.
- Tests: secret fixtures, no raw secret in snapshots.
- Security notes: Mandatory for all model and sync paths.
- Priority: P0.
- Definition of done: Test proves secret-like content is not sent in model request.

#### IDE-SEC-2: Write Confirmation

- User story: As a developer, I want every AI write to require a visible diff and confirmation.
- Acceptance criteria: AI patch apply requires preview; file hash checked; direct write action denied; audit event stored locally.
- Files likely touched: `packages/diff-engine`, `packages/agent-tools`, `packages/cli-workbench`.
- Functions/APIs: `applyPatchWithConfirmation`, patch audit.
- UI states: confirmation required, approved, denied, conflict.
- Tests: attempt direct write denied, hash mismatch.
- Security notes: Prevent prompt-injection-driven writes.
- Priority: P0.
- Definition of done: No AI write path bypasses confirmation in tests.

#### IDE-SEC-3: Command Allowlist

- User story: As a developer, I want AI/tool commands constrained to safe project tasks.
- Acceptance criteria: Package scripts shown but not auto-run by AI; destructive shell denied; confirmation required for dev server/install/build where configured.
- Files likely touched: `packages/dev-runner`, `packages/agent-tools`, `packages/cli-workbench`.
- Functions/APIs: `runProjectTask`, tool safety policy.
- UI states: read-only, confirmation required, denied.
- Tests: deny `rm -rf`, deny shell interpolation, allow npm test.
- Security notes: Prefer structured argv and allowlists.
- Priority: P0.
- Definition of done: Command safety tests pass.

#### IDE-QA-1: CLI Smoke Tests

- User story: As a maintainer, I want smoke tests proving `heart ide` does not break core CLI behavior.
- Acceptance criteria: `heart ide --help`, `heart --help`, non-TTY, `heart mcp serve` no decoration, `heart chat --json` unaffected.
- Files likely touched: `tests/cli-contracts.test.js`, new `tests/cli-ide.test.js`.
- Functions/APIs: CLI entry points.
- UI states: help, non-TTY, direct commands.
- Tests: Node test suite.
- Security notes: Confirm no secrets in help/output.
- Priority: P0.
- Definition of done: CI test suite covers command compatibility.

#### IDE-QA-2: Keymap Tests

- User story: As a maintainer, I want deterministic keymap behavior.
- Acceptance criteria: Defaults load; user overrides apply; conflicts reported; unsupported keys warned.
- Files likely touched: `tests/keymap.test.js`, `packages/keymap`.
- Functions/APIs: `loadKeymap`, `resolveKeybinding`, `detectKeybindingConflicts`.
- UI states: conflict warning.
- Tests: fixture-based.
- Security notes: Keymap cannot bind denied action without command safety.
- Priority: P1.
- Definition of done: Keymap conflict suite passes.

#### IDE-QA-3: Patch Safety Tests

- User story: As a maintainer, I want patch apply/rollback tested against high-risk edge cases.
- Acceptance criteria: Apply valid patch; reject path traversal; reject hash mismatch; rollback last AI patch; preserve unrelated user changes.
- Files likely touched: `tests/diff-engine.test.js`, `packages/diff-engine`.
- Functions/APIs: `previewPatch`, `applyPatchWithConfirmation`, `rollbackAiPatch`.
- UI states: conflict, rollback.
- Tests: temp repo/files.
- Security notes: Mandatory before patch apply ships.
- Priority: P0.
- Definition of done: Patch safety tests pass.

#### IDE-QA-4: Docs Update

- User story: As future agents, we need docs aligned with new behavior before implementation merges.
- Acceptance criteria: README, CLI spec, architecture, user guide, keymap guide, AI safety guide updated when feature lands.
- Files likely touched: `README.md`, `docs/04-mcp-cli-spec.md`, `docs/03-technical-architecture.md`, new user docs.
- Functions/APIs: docs only.
- UI states: n/a.
- Tests: docs link check/manual review.
- Security notes: Safety guide must document local-only, provider exposure, redaction, confirmations.
- Priority: P0 for release.
- Definition of done: Docs explain install, first run, keymap, patch safety, model privacy.

## 17. Validation Plan

Required validation:

- `heart ide --help` prints command help.
- `heart ide` in non-TTY prints compact help and exits.
- Existing `heart` interactive behavior remains compatible or aliases to `heart ide` intentionally.
- `heart mcp serve` prints no workbench decoration.
- Keymap conflict detection catches duplicate `Ctrl+P` in same context.
- File open/save test covers normal save, binary rejection, and hash conflict.
- Patch preview appears before write.
- Patch apply requires confirmation.
- Rollback restores prior file state.
- No secret leakage test: `.env`, API keys, tokens redacted from model request, logs, telemetry.
- Command allowlist test denies destructive shell and allows configured test script.
- Run task test captures exit code/stdout/stderr and redacts output.
- Context pack attachment test includes citations and token estimate.
- AI suggestion mock test covers cancellation and accept word/line/block.
- Terminal narrow-width layout test renders single-pane without clipped required status.
- Docs update check confirms README/spec/architecture/user guide changes when implementation ships.

Suggested test layers:

| Layer | Examples |
|---|---|
| Unit | keymap, buffer edits, diff apply, redaction, command classification |
| Contract | WorkbenchSession, PatchProposal, SuggestionRequest, KeymapProfile |
| CLI smoke | help, non-TTY, TTY mocked, command palette |
| Integration | context pack attach, patch preview/apply, run tests, git status |
| Security | secret redaction, path traversal, command allowlist, dirty state |
| UX snapshots | layout at 80x24, 120x40, missing scan, provider error |

Release gate:

- P0 stories pass tests.
- Safety tests pass.
- Docs updated.
- Known limitations documented.
- Full custom editor remains behind explicit flag until reliable.

## 18. Docs Updates

Plan docs:

- `docs/specs/beheart-cli-ide-workbench-plan.md`: this plan.
- `README.md`: add `heart ide` daily workflow once implemented.
- `docs/04-mcp-cli-spec.md`: command contract, non-TTY behavior, key command examples.
- `docs/03-technical-architecture.md`: new packages/modules and safety boundaries.
- `docs/11-implementation-blueprint-v2.md`: milestone placement after context compiler/agent chat vertical slice.
- User guide for `heart ide`: first run, navigation, file search, chat, context, patch review, run tasks.
- Keymap customization guide: `.heart/keymap.yaml`, presets, conflicts.
- AI safety guide: provider exposure, local-only mode, redaction, write confirmation, command allowlists, rollback.

Docs principles:

- Keep CLI examples copyable.
- Separate implemented behavior from planned behavior.
- Label deferred editor features clearly.
- Keep architecture docs aligned with package ownership.
- Avoid ROI claims unless benchmark-backed.

## 19. Final Recommendation

Should beheart build a CLI IDE?

Yes. Build a CLI AI coding workbench as a phased bet, starting with the memory-aware agent/run/diff loop. The product should not try to beat mature editors on editor mechanics first. It should beat generic AI IDE workflows by making repo memory, docs/spec intent, policies, reuse, and benchmark evidence native to coding flow.

MVP:

- `heart ide`.
- Terminal workbench shell.
- File search/viewer and external editor fallback.
- AI chat with model selector.
- Context pack/docs/graph/domain pack attachments.
- Patch proposal, diff preview, confirmation apply, rollback.
- Run tests/lint/typecheck/dev scripts.
- Command palette and keymap config.
- Git status and commit/PR draft.
- Visible safety controls.

Build first:

1. Workbench shell and status.
2. File search/open + external editor.
3. Chat/context attachments.
4. Patch preview/apply/rollback.
5. Dev-runner tests/lint/typecheck.
6. Keymap/command palette.

Defer:

- Full custom terminal editor.
- Always-on autocomplete.
- Next-edit prediction.
- LSP breadth.
- Debugger.
- Marketplace/extensions.
- Remote containers.

Biggest technical risk:

- Reliable terminal editor + inline suggestions under low latency. Mitigation: external editor fallback first, manual suggestions first, small autocomplete context, strong cancellation/cache.

Biggest UX risk:

- Too many panes/modes in a terminal causing cognitive overload. Mitigation: start with simple modes, command palette, compact status, and clear next actions.

How this can beat generic AI IDE workflows:

- It knows the repo before the prompt.
- It cites docs/specs/graph/policies in the coding loop.
- It shows reuse candidates and missing context before edits.
- It previews and audits AI writes.
- It runs benchmark scenarios and links AI work to measurable savings.

How beheart memory creates a moat:

- Durable graph memory persists across tools and sessions.
- Context packs turn repo understanding into compact, reusable AI inputs.
- Docs/spec sync connects product intent to implementation.
- Policy warnings make governance part of the workflow.
- Domain packs create reusable business/domain acceleration.
- Benchmark evidence makes ROI measurable instead of anecdotal.
