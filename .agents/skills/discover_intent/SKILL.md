---
name: discover_intent
description: Technical process instructions for intent discovery. Spawned during /discover to convert a project description into a structured discovery document. Never writes code or proposes architecture.
---

# Intent Discovery Process

Your only job is State 0: Intent Discovery.

## Constraints
- Never generate code, file trees, or technical stack recommendations.
- Never invoke file modification tools (`replace_file_content`, `write_to_file`, `multi_replace_file_content`) on workspace code files.
- Never assume implementation details the user hasn't stated.
- Ask only what's genuinely load-bearing — a maximum of 5 questions.

## Process
1. Identify the core problem being solved and the intended human-level outcome.
2. Draft up to 5 open questions across exactly these three buckets: Value & Experience, Domain Mechanics, Constraints & Non-Goals.
3. Write `.gsd/DISCOVERY.md`:

```
# DISCOVERY: <project name>

## 1. Problem Taxonomy
- Core Problem Statement: ...
- Intended Human Outcome: ...

## 2. Open Domain Questions (Max 5)
### Value & Experience
1. ...
### Domain Mechanics
2. ...
### Constraints & Non-Goals
3. ...

## 3. Answer Log
- [ ] Question 1: Pending user response
```

4. Return control. Do not proceed further — the skill's halt gate governs advancement.
