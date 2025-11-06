/**
 * Produces a simplified view of a mapped type so editors display expanded properties.
 * Useful when we compose multiple utility types and want the final result to show
 * concrete keys instead of nested intersections.
 */
export type Prettify<TObject> = {
  [Key in keyof TObject]: TObject[Key];
} & {};
