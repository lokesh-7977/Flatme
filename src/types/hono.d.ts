// This export makes the file a module, which causes `declare module "hono"`
// to be treated as an augmentation of the existing module rather than a
// replacement that would wipe out Hono's own exports.
export {};

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    requestId: string;
  }
}
