import { createCheckPackageWithWorkspaces } from "check-package-dependencies";

await createCheckPackageWithWorkspaces({
  isLibrary: (pkg) => pkg.name === "pm-utils",
})
  .checkRecommended({})
  .run();
