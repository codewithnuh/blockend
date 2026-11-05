export type { WorkspaceContext, WorkspaceManager, WorkspacePackage } from "./types.js";
export {
  detectWorkspace,
  findWorkspaceRoot,
  listWorkspacePackages,
  parsePnpmWorkspacePackages,
  readWorkspacePatterns
} from "./detect.js";
export {
  formatWorkspaceGuidance,
  resolveProjectTarget,
  targetErrorMessage,
  type ProjectTarget
} from "./target.js";
