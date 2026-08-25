export interface WorkspaceRangeEdit {
    packageName: string;
    depType: string;
    range: string;
    to: string;
}
/**
 * Keep the user's range style when it still expresses the same intent: a caret
 * or tilde range moved to the target line stays a caret or tilde range. Any
 * other shape (`*`, `0.83 - 0.86`, `>=1`) has no target-line equivalent, so the
 * exact version is the only faithful rewrite.
 */
export declare const nextSelector: (range: string, to: string) => string;
/**
 * Rewrite one declared range in a workspace `package.json`, as a targeted edit
 * on the raw text: reserializing would reformat a file the tool does not own.
 * Returns `undefined` when the declaration is not there any more, which is the
 * caller's signal that the lockfile it read from is stale.
 */
export declare const applyWorkspaceRangeEdit: (content: string, edit: WorkspaceRangeEdit) => string | undefined;
//# sourceMappingURL=workspaceManifest.d.ts.map