// Must match docs/asset-paths.md exactly.

/** Built-in prefixes where the Publish Origin serves files that Publish pages need. */
export const PUBLISH_ASSET_PATHS: readonly string[] = [
  "/etc.clientlibs",
  "/content/dam",
  "/libs",
  "/content/experience-fragments",
  "/adobe/dynamicmedia/deliver",
];

/** Reserved EDS Path prefixes. A Route Rule that overlaps one is Shadowing. */
export const RESERVED_EDS_PREFIXES: readonly string[] = [
  "/",
  "/scripts",
  "/styles",
  "/blocks",
  "/icons",
  "/fonts",
  "/fragments",
];
