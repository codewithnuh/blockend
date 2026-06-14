const types = [
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "style",
  "test"
];

const scopes = [
  "apps",
  "cli",
  "web",
  "packages",
  "core",
  "detector",
  "transformer",
  "blocks",
  "rate-limiter",
  "repo",
  "deps",
  "config"
];

module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", types],
    "scope-enum": [2, "always", scopes],
    "scope-empty": [0],
    "subject-empty": [2, "never"],
    "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]]
  },
  prompt: {
    questions: {
      type: {
        enum: {
          build: { description: "Build system or external dependency changes" },
          chore: { description: "Maintenance changes that do not affect behavior" },
          ci: { description: "Continuous integration changes" },
          docs: { description: "Documentation only changes" },
          feat: { description: "A new feature" },
          fix: { description: "A bug fix" },
          perf: { description: "A performance improvement" },
          refactor: { description: "Code changes that neither fix bugs nor add features" },
          revert: { description: "Revert a previous commit" },
          style: { description: "Formatting or style-only changes" },
          test: { description: "Adding or updating tests" }
        }
      },
      scope: {
        enum: Object.fromEntries(
          scopes.map((scope) => [scope, { description: `${scope} changes` }])
        )
      }
    }
  }
};
