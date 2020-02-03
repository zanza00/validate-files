import * as t from "io-ts";

import { Lens } from "monocle-ts";
import { pipe } from "fp-ts/lib/pipeable";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";

import { Heroes, SemVer } from "./models";
import { readFile, formatError } from "./helpers";

type Scope = "dccomics" | "marvel";

const heroes = {
  "wonder-woman": ["dccomics"],
  superman: ["dccomics"],
  "green-lantern": ["dccomics"],
  "spider-man ": ["marvel"],
  thor: ["marvel"],
  wolverine: ["marvel"],
  "capitan-marvel": ["dccomics", "marvel"]
} as const;

const AvailHeroes = t.keyof(heroes);

export type AvailHeroes = t.TypeOf<typeof AvailHeroes>;

type ArgError = {
  type: "ArgError";
  message: string;
  args: object;
};

type FileReadError = {
  type: "FileReadError";
  file: string;
  message: string;
  stack: any;
};

type FileWriteError = {
  type: "FileWriteError";
  file: string;
  message: string;
  stack: any;
};

type DecodingError = {
  type: "DecodingError";
  message: string;
};

type ErrorAdt = ArgError | FileReadError | FileWriteError | DecodingError;

export const CliArgs = t.type({
  module: AvailHeroes,
  version: SemVer
});
export type CliArgs = t.TypeOf<typeof CliArgs>;

function parseJsonFile(
  buffer: Buffer,
  file: string
): TE.TaskEither<ErrorAdt, unknown> {
  const stringToBeParsed = buffer.toString("utf8");
  return TE.fromEither(
    E.parseJSON(stringToBeParsed, e => ({
      type: "FileReadError",
      file,
      stack: e,
      message: "Error while parsing file :("
    }))
  );
}

const args = {
  module: process.argv[2],
  version: process.argv[3]
};
console.log(args);

function readAndValidateArgs(): E.Either<ErrorAdt, CliArgs> {
  return pipe(
    CliArgs.decode(args),
    E.mapLeft(
      errs =>
        ({
          type: "ArgError",
          message: errs.map(e => formatError(e)).join("\n"),
          args
        } as ErrorAdt)
    )
  );
}

function changeVersion(
  scope: Scope,
  module: AvailHeroes,
  newVersion: SemVer
): TE.TaskEither<ErrorAdt, Heroes> {
  const version = Lens.fromPath<Heroes>()([module, "version"]);
  const file = `files/${scope}/users.json`;
  return pipe(
    readFile(file),
    TE.mapLeft(
      err =>
        ({
          type: "FileReadError",
          file,
          message: "Error while reading file",
          stack: err
        } as ErrorAdt)
    ),
    TE.chain(buf => parseJsonFile(buf, file)),
    TE.chain(fileData =>
      pipe(
        TE.fromEither(Heroes.decode(fileData)),
        TE.mapLeft(
          e =>
            ({
              type: "DecodingError",
              message: "Error while decoding modules.json"
            } as ErrorAdt)
        )
      )
    ),
    TE.map(
      version.modify(() => {
        return SemVer.encode(newVersion);
      })
    )
  );
}

function main() {
  const boh = pipe(
    TE.fromEither(readAndValidateArgs()),
    TE.chain(args =>
      changeVersion(heroes[args.module][0], args.module, args.version)
    )
  );

  boh().then(asd => {
    console.log("asd");
    console.log(asd);
  });
}

main();
