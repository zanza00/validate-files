import * as t from "io-ts";
import semver from "semver";

const isSemver = (u: unknown): u is string => {
  if (typeof u !== "string") return false;
  const check = semver.valid(u);
  if (check === null) return false;
  return true;
};

export const SemVer = new t.Type<string, string, unknown>(
  "SemVer",
  isSemver,
  (u, c) => (isSemver(u) ? t.success(u) : t.failure(u, c)),
  t.identity
);
export type SemVer = t.TypeOf<typeof SemVer>;

const Hero = t.type({
  key: t.string,
  name: t.string,
  heroName: t.string,
  year: t.number,
  origin: t.string,
  version: SemVer
});
type Hero = t.TypeOf<typeof Hero>;

export const Heroes = t.record(t.string, Hero);
export type Heroes = t.TypeOf<typeof Heroes>;

const Group = t.type({
  zone: t.string,
  heroes: t.array(t.string),
  tags: t.union([t.array(t.string), t.undefined])
});
type Group = t.TypeOf<typeof Group>;

export const Groups = t.record(t.string, Group);
type Groups = t.TypeOf<typeof Groups>;
