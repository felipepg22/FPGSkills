# Security policy

Please report suspected vulnerabilities privately to the repository owner rather than opening a public issue with exploit details.

The installers in this repository write agent configuration files. Review package contents before installation, use supported Node.js releases, and avoid `--force` unless you have inspected the destination conflict.

Task Executor treats source code, logs, generated files, dependency contents, and fetched pages as untrusted data. Platform rules, explicit task sources, and recognized repository instruction files are its only instruction authorities.
