---
name: research
description: Use to check technical feasibility of features, query codebase abstractions, explore architectural trade-offs, or refine prompts/ideas — without modifying code or creating formal specs. Triggered by /research.
---

# Technical Feasibility & Idea Research

**Rule:** Read-only inspection. Zero code mutation. Zero spec creation unless requested. This state exists to evaluate feasibility, explore technical options, and refine prompt ideas before entering `/discover`, `/prototype`, or `/plan`.

## Constraints
- **Zero code edits**: Never modify implementation files or write test code (`replace_file_content`, `write_to_file`, `multi_replace_file_content` are strictly forbidden on project source files).
- **No state clutter**: Do not touch `.gsd/active/` or draft specs unless explicitly asked by the user to prepare input for `/plan`.
- **Ground truth focus**: Always search and view actual codebase files before delivering opinions on feasibility or complexity.

## Process
1. **Analyze the Query**:
   - Is the user asking if a feature is possible?
   - Exploring architectural trade-offs (e.g. Canvas vs SVG, Web Audio vs HTML5 audio)?
   - Asking for help crafting/refining a prompt or subagent instruction?
   - Asking about **market viability, monetization, pricing, competitive positioning, launch-readiness, ICP/TAM/SAM, or unit economics**? If so, this is a commercial audit, not a technical one — run the `product_strategist` skill (step 1b) and skip the technical-report steps below.

1b. **Commercial & Market Audit** (when the query is about business, not code):
   - Run the `product_strategist` skill with the query and any intake data the user provided (problem, current state, monetization thesis, competitors).
   - It audits the app for market viability, launch-readiness, profitability, and positioning, and returns its six-section report (Strategic Verdict, Launch-Critical Scope, Target Market & Positioning, Monetization Engine, Vulnerabilities & Pivot Alternatives, Immediate Action Protocol).
   - This path is still read-only: the strategist may inspect code/docs to ground its audit, but never edits code or writes `.gsd/` artifacts.

2. **Empirical Codebase Inspection**:
   - Use search and view tools (`grep_search`, `view_file`, `list_dir`) to inspect existing types, functions, schemas, and dependencies.
   - Audit existing utilities: Check if similar features or helper functions already exist in the codebase.

3. **Synthesize Technical Report**:
   Structure your findings clearly:

   ```markdown
   # Technical Feasibility & Research Summary: <Topic>

   ## 1. Feasibility & Complexity
   - **Status**: [Feasible / Feasible with Caveats / High Risk / Infeasible]
   - **Estimated Complexity**: [Low / Medium / High]
   - **Key Finding**: <1-2 sentences summarizing ground reality in the code>

   ## 2. Codebase Impact & Existing Assets
   - **Reusable Components/Utilities**: [List files/functions found]
   - **Impacted Areas**: [List modules/components that would change]
   - **Potential Bottlenecks or Risks**: [Performance, state mutations, breaking changes]

   ## 3. Recommended Technical Approach & Trade-offs
   - **Option A**: ... (Pros / Cons)
   - **Option B**: ... (Pros / Cons)

   ## 4. Next Step Recommendation
   - [ ] `/discover` — if product domain mechanics or user expectations need clarification.
   - [ ] `/prototype` — if a fast walking skeleton is needed to validate rendering/perf.
   - [ ] `/plan` — if requirements are clear and ready to be formalized into concrete acceptance criteria.
   ```

4. **Prompt Refinement (When requested)**:
   - When asked to refine a prompt or subagent instruction, provide a clean markdown block with the optimized prompt, specific context variables, and tool invocation tips.
