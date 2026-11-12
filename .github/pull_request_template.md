## What this PR does

- Tool: `<slug>`  Stage: spec | engine+tests | ui+content | seo | fix | rules

## Checklist

- [ ] Gate 1 spec approved (link)
- [ ] No numbers outside `src/tools-core/rules`; each rule has source, sourceUrl, effectiveFrom, verifiedOn
- [ ] Golden, property, snapshot and decode tests pass
- [ ] Default result + explain + tables + FAQ visible with JS disabled
- [ ] Byline, updated date, rules-effective date, Sources
- [ ] Quote pre-fill tested on preview; Link-to-tool works
- [ ] JSON-LD valid (Rich Results Test screenshot)
- [ ] Lighthouse mobile: perf >= 95, a11y >= 95, SEO 100; axe: no serious issues
- [ ] API output equals UI output for golden inputs
- [ ] CHANGELOG.md entry (rules changes only)

## Manual cross-check

| Input | Our result | Official reference | Match |
|-------|------------|--------------------|-------|
|       |            |                    |       |
