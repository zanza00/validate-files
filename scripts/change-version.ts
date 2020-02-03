import * as t from "io-ts";

import { Lens } from "monocle-ts";
import { pipe } from "fp-ts/lib/pipeable";
import * as TE from "fp-ts/lib/TaskEither";
import * as T from "fp-ts/lib/Task";
import * as E from "fp-ts/lib/Either";

import { Heroes, SemVer } from "./models";
import {
  readFile,
  formatError,
  prettyStringifyJson,
  writeFile
} from "./helpers";

type Scope = "dccomics" | "marvel";

const heroes = {
  "wonder-woman": ["dccomics"],
  superman: ["dccomics"],
  "green-lantern": ["dccomics"],
  "spider-man ": ["marvel"],
  thor: ["marvel"],
  wolverine: ["marvel"],
  "capitan-marvel": ["dccomics", "marvel"] // <== this is in both files
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
  hero: AvailHeroes,
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
  hero: process.argv[2],
  version: process.argv[3]
};

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
  hero: AvailHeroes,
  newVersion: SemVer
): TE.TaskEither<ErrorAdt, Heroes> {
  const version = Lens.fromPath<Heroes>()([hero, "version"]);
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
          err =>
            ({
              type: "DecodingError",
              message: err.map(e => formatError(e)).join("\n")
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

function saveFile(
  heroes: Heroes,
  scope: Scope
): TE.TaskEither<ErrorAdt, string> {
  const file = `files/${scope}/users.json`;
  return pipe(
    TE.fromEither(prettyStringifyJson(heroes)),
    TE.mapLeft(
      err =>
        ({
          type: "FileWriteError",
          file,
          message: "Error while converting back to json",
          stack: err
        } as ErrorAdt)
    ),
    TE.chain(str =>
      pipe(
        writeFile(file, str),
        TE.bimap(
          err =>
            ({
              type: "FileWriteError",
              file,
              message: "Error while writing the file",
              stack: err
            } as ErrorAdt),
          () => file
        )
      )
    )
  );
}

type MetaData = {
  scope: Scope;
  hero: AvailHeroes;
  version: string;
  file: string;
};
const program: TE.TaskEither<ErrorAdt, MetaData> = pipe(
  TE.fromEither(readAndValidateArgs()),
  TE.map(args => {
    console.log("Arguments are valid :)");
    return { ...args, scope: heroes[args.hero][0] };
  }),
  TE.chain(args =>
    pipe(
      changeVersion(args.scope, args.hero, args.version),
      TE.map(result => ({ result, args }))
    )
  ),
  TE.map(nv => {
    console.log("Succesfully modified value, attempting to write");
    return nv;
  }),
  TE.chain(nv =>
    pipe(
      saveFile(nv.result, nv.args.scope),
      TE.map(file => ({ file, ...nv.args }))
    )
  )
);

function errorToString(err: ErrorAdt): string {
  switch (err.type) {
    case "ArgError":
      return `I cannot recognize this args
${err.args}
because: 
${err.message}`;

    case "FileReadError":
      return `There was an error while reading the file: ${err.file}
Here are more info: 
${err.message}
${JSON.stringify(err.stack)}`;

    case "FileWriteError":
      return `There was an error while writing the file: ${err.file}
Here are more info: 
${err.message}
${JSON.stringify(err.stack)}`;

    case "DecodingError":
      return `Error while decoding file
${err.message}`;
  }
}

function main() {
  const boh = pipe(
    program,
    TE.fold(
      e => {
        return T.of(errorToString(e));
      },
      ok => {
        return T.of(
          `Succesfully modified ${ok.scope}/${ok.hero} with the new version ${ok.version}`
        );
      }
    )
  );

  boh().then(finalMessage => {
    console.log(finalMessage);
  });
}

main();
