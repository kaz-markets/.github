/**
 * dependency-cruiser rules for every KAZ repository.
 *
 * These encode invariants that live as prose in AGENTS.md, as structure a check
 * can hold regardless of who is editing:
 *
 *   - the front end is out of bounds (AGENTS.md, "Front end is out of bounds"),
 *   - the base is the product and a brand is applied on top, so a service never
 *     imports a front end (AGENTS.md, "The base app is the product").
 *
 * Synced from kaz-markets/.github. Do not edit a copy: change this file and run
 * scripts/sync.mjs. Read by the arch.yml workflow, which passes the absolute
 * path so a workspace below the repository root still finds it.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "A cycle means two modules own each other. Extract the shared piece into a third module.",
      from: {},
      to: { circular: true },
    },
    {
      name: "service-not-into-front-end",
      severity: "error",
      comment:
        "AGENTS.md: app/, admin/, mobile/, site/ and bet105-concept/ are the front end, off limits to the platform. A service or shared package must not import a front end.",
      from: { path: "^(server|packages|shared)/" },
      to: { path: "^(app|admin|mobile|site|bet105-concept)/" },
    },
    {
      name: "front-end-not-into-service",
      severity: "error",
      comment:
        "AGENTS.md: the base is the product and the front end talks to it over its API. Import the contract package, never the service internals.",
      from: { path: "^(app|admin|mobile|site|bet105-concept)/" },
      to: { path: "^(server|shared)/" },
    },
    {
      name: "not-to-unresolvable",
      severity: "warn",
      comment:
        "An import that does not resolve to a file on disk. Usually a stale path or a missing alias.",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment: "A module that nothing imports and that imports nothing is usually dead.",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$",
          "\\.d\\.ts$",
          "(^|/)tsconfig\\.json$",
          "(^|/)(babel|webpack|vitest|vite|playwright|next)\\.config\\.(js|cjs|mjs|ts|json)$",
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "(node_modules|dist|build|\\.next|coverage|\\.expo|vendor)" },
    exclude: { path: "(node_modules|dist|build|\\.next|coverage|\\.expo|vendor)" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
  },
};
