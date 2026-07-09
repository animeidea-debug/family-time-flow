# Contributing to FamilyTimeFlow

This project uses the [infra-template](https://github.com/animeidea-debug/infra-template) for NAS deployment.

## How to contribute

1. Improve a component in **your project** (fix nginx config, improve deploy script, etc.)
2. Extract the **generic parts** (remove project-specific values)
3. Update the corresponding file(s) in the infra-template repository
4. Submit a Pull Request with:
   - What you changed
   - Which project validated the change
   - Why it's useful for other projects

## What NOT to include

- ❌ Project-specific IP addresses, domains, or passwords
- ❌ Business logic (that stays in your project)
- ❌ Large binary files

## Example

```
Project: FamilyTimeFlow improved deploy script → PR to infra-template
  → All projects using this template benefit