# Implementation Spec Writer

Creates or updates one self-contained Markdown implementation specification from a conversation, documents, source files, and selectively inspected repository evidence.

Invoke the installed skill explicitly as `$implementation-spec-writer`. It writes the specification only; task publication and code implementation remain separate workflows.

## Install

```bash
npx @fpgskills/implementation-spec-writer
```

The guided installer supports Codex, OpenCode, Cursor, Claude Code, Antigravity, and a generic Markdown target. Run `npx @fpgskills/implementation-spec-writer --help` for non-interactive options.

## Validate locally

```bash
npm test --workspace @fpgskills/implementation-spec-writer
npm run validate --workspace @fpgskills/implementation-spec-writer
```

