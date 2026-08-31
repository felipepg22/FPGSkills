# Release skills

This is the maintainer procedure for the unified `v0.2.0` release. Replace the
version everywhere for later releases. Publishing a tag, seeding the skills.sh
catalog, and changing npm deprecation metadata are separate external actions and
require explicit maintainer confirmation.

## Release gates

Before merging, require the pinned skills CLI copy-install smoke tests on Linux,
macOS, and Windows. Require symlink tests on Linux and macOS; Windows symlink
coverage may remain informational because host permissions vary. The latest CLI
job is informational until deliberately adopted. A Node.js 22.20.0-or-newer CI
smoke test must pass before documenting `bunx` as an alternative runner.

Configure the repository before the first release:

- Protect `main` with the payload, pinned-copy, pinned-symlink, and bunx checks
  from `.github/workflows/skills-compatibility.yml`.
- Create the `skills-sh-release` GitHub environment, require a maintainer review,
  and restrict it to the protected `main` branch. The catalog workflow references
  this environment and must not run without its approval gate.

A transient latest-CLI or audit-service failure does not block release. A
confirmed portability failure or high-severity finding does.

## Create the tag

After the release commit is merged to `main` and blocking CI passes, use a clean
checkout. Confirm the working tree is clean and that local `main` matches
`origin/main`, then create an annotated tag:

```sh
git fetch origin --tags
git switch main
git pull --ff-only origin main
git status --short
git tag -a v0.2.0 -m "Release v0.2.0"
git show --no-patch --decorate v0.2.0
git push origin v0.2.0
```

Do not move or replace a published tag. If a defect is found, fix it and publish
a patch tag such as `v0.2.1`. Delay npm deprecation, or update its message to the
fixed tag, until the replacement release is verified.

## Verify and seed the catalog

Run the manually dispatched, protected release workflow only after the tag is
public. Supply `v0.2.0` as `tag` and the output of
`git rev-parse 'v0.2.0^{commit}'` as `expected_release_sha`. Its ephemeral Ubuntu
runner verifies that the annotated tag resolves to that exact commit and that
the commit remains in `main`, then creates a temporary project and runs:

```sh
npx --yes skills@1.5.23 add felipepg22/FPGSkills#v0.2.0 \
  --skill '*' \
  --agent universal \
  --copy \
  -y
```

This reviewed installation copies but does not invoke the skills. Telemetry must
be enabled: do not set `DISABLE_TELEMETRY` or `DO_NOT_TRACK`. The public source,
skill identity/files, and install timestamp are sent to skills.sh and seed its
catalog. The runner and temporary installation are destroyed after the job.

Poll for up to 15 minutes for all three catalog pages. If they do not appear,
fail visibly and allow a manual rerun; do not deprecate the npm installers yet.
Audit generation may finish later. skills.sh normalizes catalog identity to the
repository and does not retain the installed tag, so its audits are advisory,
repository/catalog signals—not evidence that `v0.2.0` itself passed. Pinned CI
is the release-specific evidence.

If repeated approved workflow runs install successfully but do not seed the
catalog, run the same pinned command once from an empty temporary project on a
maintainer machine with telemetry enabled. Do not disguise the hosted workflow
as a non-CI process. Remove the temporary project after verifying the catalog
pages.

## Deprecate the legacy npm installers

Only after tagged remote installation and all three catalog pages are verified,
run these commands manually with maintainer npm credentials:

```sh
npm deprecate @fpgskills/fpg-agents-md-writer@0.1.0 "Frozen installer. Choose your agent; example: npx skills add felipepg22/FPGSkills#v0.2.0 --skill fpg-agents-md-writer --agent codex"
npm deprecate @fpgskills/implementation-spec-writer@0.1.0 "Frozen installer. Choose your agent; example: npx skills add felipepg22/FPGSkills#v0.2.0 --skill implementation-spec-writer --agent codex"
npm deprecate @fpgskills/performance-testing@0.1.0 "Frozen installer. Choose your agent; example: npx skills add felipepg22/FPGSkills#v0.2.0 --skill performance-testing --agent codex"
```

Never unpublish these versions. Task Executor is separate and must not be
deprecated as part of this release.

## Release order

1. Merge the isolated migration to `main`.
2. Pass required Linux, macOS, and Windows checks.
3. Create and push the annotated tag from a clean checkout.
4. Verify installation from the public tag.
5. Run the approved catalog-seeding workflow and verify all catalog pages.
6. Review advisory audits when available.
7. Deprecate the three frozen npm installers manually.
