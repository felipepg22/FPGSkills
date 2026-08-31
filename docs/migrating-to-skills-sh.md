# Migrate to skills.sh

The `@fpgskills/fpg-agents-md-writer`,
`@fpgskills/implementation-spec-writer`, and
`@fpgskills/performance-testing` installers were published at version `0.1.0`.
They are frozen: existing versions remain available, but fixes are released only
through newer tagged versions of this repository for skills.sh.

Do not let the legacy installer and skills.sh manage the same skill. The legacy
installer records ownership in `.fpgskills/manifest.json`; project skills.sh
installations use `skills-lock.json`.

From the project where the old local installation was created, remove each
installed skill and name the targets originally selected:

```sh
npx @fpgskills/fpg-agents-md-writer@0.1.0 uninstall --scope local --target codex
npx @fpgskills/implementation-spec-writer@0.1.0 uninstall --scope local --target codex
npx @fpgskills/performance-testing@0.1.0 uninstall --scope local --target codex
```

Replace `codex` with each legacy target that was installed. For a legacy global installation, replace `--scope local` with `--scope global`.
If the installer reports locally modified managed files, preserve or reconcile
those changes before retrying; do not delete the manifest or managed directories
by hand.

Review the replacement source and then install the selected skills:

```sh
npx skills add felipepg22/FPGSkills#v0.2.0 --list
npx skills add felipepg22/FPGSkills#v0.2.0 \
  --skill fpg-agents-md-writer implementation-spec-writer performance-testing \
  --agent codex
```

Replace `codex` with the appropriate skills.sh agent identifier. Project scope is the default. Commit `skills-lock.json`; add `--global` only to
replace a global installation. Add `--copy` when symlinks are not supported.
Verify the installation before removing any preserved backup of local changes.
