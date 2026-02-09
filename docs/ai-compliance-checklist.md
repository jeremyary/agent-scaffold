# Red Hat AI Compliance Checklist for Developers

Quick-reference checklist for using AI code assistants (Claude Code, Cursor, WCA, etc.) in compliance with Red Hat's internal policies. For the machine-enforceable rules, see `.claude/rules/ai-compliance.md`.

---

## Pre-Work Checklist

Before starting a coding session with an AI assistant:

- [ ] Confirm you are using an [approved AI tool](https://source.redhat.com/departments/it/ai-tools) for your use case
- [ ] Ensure no confidential/proprietary data will be shared in prompts
- [ ] Have synthetic or anonymized data ready for any examples you'll provide

## During Development

While working with AI-generated code:

- [ ] Include the AI marking comment at the top of each new code file:
  - JS/TS: `// This project was developed with assistance from AI tools.`
  - Python: `# This project was developed with assistance from AI tools.`
- [ ] Review all AI-generated code for correctness before saving
- [ ] Check AI-generated code for security issues (input validation, auth logic, injection vectors, secrets handling)
- [ ] Verify any suggested dependencies use [Red Hat-approved licenses](https://docs.fedoraproject.org/en-US/legal/allowed-licenses/)
- [ ] Do not paste internal hostnames, IPs, credentials, or customer data into prompts

## At Commit Time

When committing AI-assisted code:

- [ ] Include an AI assistance trailer in the commit message:
  - `Assisted-by: Claude Code` (human-driven, AI-assisted)
  - `Generated-by: Claude Code` (substantially AI-generated)
- [ ] Ensure no secrets, credentials, or `.env` files are staged
- [ ] Run the project's test suite and linter before committing

## At PR/Review Time

When submitting code for review:

- [ ] Note AI assistance in the PR description when substantial code was AI-generated
- [ ] Ensure all tests pass and coverage targets are met
- [ ] Confirm a human has reviewed every line of AI-generated code
- [ ] Run security scanning tools (SAST, dependency audit) if available

## Upstream Contributions

Before contributing AI-generated code to an open-source project:

- [ ] Check if the upstream project has a policy on AI-generated code
- [ ] If the project **prohibits** AI code — do not submit AI-generated contributions
- [ ] If the policy is **unclear** — disclose AI assistance in your commit message or PR description
- [ ] If the project is Red Hat-led — follow project-specific guidance; default to disclosure

---

## Common Scenarios

### "I want to use AI to write a new feature"
1. Use an approved AI tool
2. Do not share proprietary data in prompts
3. Review and test all generated code
4. Mark the source files and commits appropriately
5. Include a note in the PR description

### "I want to contribute AI-generated code upstream"
1. Check the upstream project's contribution guidelines for an AI policy
2. If prohibited, rewrite the code yourself or do not contribute it
3. If permitted or unclear, disclose AI assistance
4. Ensure the code does not reproduce copyrighted implementations

### "AI suggested a dependency I haven't seen before"
1. Check the license against the [Fedora Allowed Licenses](https://docs.fedoraproject.org/en-US/legal/allowed-licenses/) list
2. Review the package for maintenance status and security history
3. If the license is not on the approved list, do not add the dependency — check with Legal

### "AI generated code that looks like it came from somewhere specific"
1. Do not use code that appears to be a verbatim copy of a copyrighted implementation
2. Search for the code pattern online to check for matches
3. If it matches a GPL/AGPL or other copyleft-licensed project, do not use it in a project with an incompatible license
4. When in doubt, rewrite the logic in your own words or check with Legal

### "I'm not sure if data is too sensitive to share"
If you're unsure, do not share it. Specifically, never share:
- Customer names, emails, or account identifiers
- Internal service URLs, hostnames, or IP addresses
- API keys, tokens, passwords, or certificates
- Architecture diagrams or internal network topology
- Non-public product plans or roadmaps

Use synthetic data or abstract the problem to its technical pattern.

---

## FAQ

**Q: Do I need to mark every single commit that Claude Code touches?**
A: Yes. If an AI tool assisted with the code in a commit, include the `Assisted-by:` trailer. The `prepare-commit-msg` hook in `.claude/hooks/` can automate this for Claude Code commits.

**Q: What if I only used AI for a small suggestion or autocomplete?**
A: Use `Assisted-by:` for minor assistance. Use `Generated-by:` when the AI produced the majority of the code in the commit.

**Q: Can I use AI to write tests?**
A: Yes, with the same obligations: review the tests for correctness, mark the files and commits, and ensure you understand what the tests verify.

**Q: Does this apply to documentation and comments too?**
A: Yes. AI-generated documentation and comments should be reviewed for accuracy and marked appropriately.

**Q: What if the AI generates code with a security vulnerability?**
A: You are accountable. The developer who commits code is responsible for its security regardless of how it was generated. Use security scanning tools and manual review.

**Q: Are there approved AI tools I should use?**
A: See the [Approved AI tools and use cases](https://source.redhat.com/departments/it/ai-tools) page on The Source for the current list.

---

## Source Policy Documents

These Red Hat internal documents are the authoritative source for AI compliance policy:

- Policy on the Use of AI Technology
- Guidelines on Use of AI Generated Content
- Code assistants: Guidelines for responsible use of AI code assistants
- Approved AI tools and use cases
- AI Code Assist Training materials
- Fedora Allowed Licenses (for dependency license checks)

The PDF copies are available in the project's `docs/` directory.
