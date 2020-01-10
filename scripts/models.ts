import * as t from "io-ts";

const Hero = t.type({
  key: t.string,
  name: t.string,
  heroName: t.string,
  year: t.number,
  origin: t.string
});
type Hero = t.TypeOf<typeof Hero>;

export const Heroes = t.record(t.string, Hero);
type Heroes = t.TypeOf<typeof Heroes>;

const Group = t.type({
  zone: t.string,
  heroes: t.array(t.string),
  tags: t.union([t.array(t.string), t.undefined])
});
type Group = t.TypeOf<typeof Group>;

export const Groups = t.record(t.string, Group);
type Groups = t.TypeOf<typeof Groups>;
