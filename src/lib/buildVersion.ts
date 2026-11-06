export type BuildVersion = { version: string; commit: string };

/**
 * Read the output of `git describe --tags --long --match "v*"`.
 * A tagged commit gives the bare tag ("1.2.0"); later commits add how many
 * came after it ("1.1.1+27").
 */
export const parseGitDescribe = (output: string): BuildVersion | undefined => {
  const match = /^v(.+)-(\d+)-g([0-9a-f]+)$/.exec(output.trim());
  if (!match) return undefined;
  const [, tag, distance, commit] = match;
  return { version: distance === "0" ? tag : `${tag}+${distance}`, commit };
};
