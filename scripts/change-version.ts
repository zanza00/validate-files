import * as t from "io-ts";

import { Lens } from "monocle-ts";
import { pipe } from "fp-ts/lib/pipeable";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as C from "fp-ts/lib/Console";
import { array } from "fp-ts/lib/Array";

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
};

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

const fileReadError = (err: NodeJS.ErrnoException, file: string): ErrorAdt => ({
  type: "FileReadError",
  file,
  message: "Error while reading file",
  stack: err
});
const decodingError = (err: t.Errors): ErrorAdt => ({
  type: "DecodingError",
  message: err.map(e => formatError(e)).join("\n")
});
const argsError = (errs: t.Errors, args: object): ErrorAdt => ({
  type: "ArgError",
  message: errs.map(e => formatError(e)).join("\n"),
  args
});
const fileWriteError = (
  err: Error,
  file: string,
  message: string
): ErrorAdt => ({
  type: "FileWriteError",
  file,
  message,
  stack: err
});

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

function readAndValidateArgs(args: object): E.Either<ErrorAdt, CliArgs> {
  return pipe(
    CliArgs.decode(args),
    E.mapLeft(e => argsError(e, args))
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
    TE.mapLeft(e => fileReadError(e, file)),
    TE.chain(buf => parseJsonFile(buf, file)),
    TE.chain(fileData =>
      pipe(TE.fromEither(Heroes.decode(fileData)), TE.mapLeft(decodingError))
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
    TE.mapLeft(e =>
      fileWriteError(e, file, "Error while converting back to json")
    ),
    TE.chain(str =>
      pipe(
        writeFile(file, str),
        TE.bimap(
          e => fileWriteError(e, file, "Error while writing the file"),
          () => file
        )
      )
    )
  );
}

type MetaData = {
  scope: string[];
  hero: AvailHeroes;
  version: string;
  file: string[];
};

function program(args: object): TE.TaskEither<ErrorAdt, MetaData> {
  return pipe(
    TE.fromEither(readAndValidateArgs(args)),
    TE.chainFirst(() => TE.rightIO(C.log("Arguments are valid :)"))),
    TE.map(args => ({ ...args, scope: heroes[args.hero] })),
    TE.chain(args =>
      pipe(
        args.scope.map(scope =>
          pipe(
            changeVersion(scope as Scope, args.hero, args.version),
            TE.map(result => ({ result, scope }))
          )
        ),
        array.sequence(TE.taskEither),
        TE.map(list => ({ list, args }))
      )
    ),
    TE.chainFirst(() =>
      TE.rightIO(C.log("Succesfully modified value, attempting to write"))
    ),
    TE.chain(nv =>
      pipe(
        nv.list.map(({ result, scope }) => saveFile(result, scope as Scope)),
        array.sequence(TE.taskEither),
        TE.map(file => ({ file, ...nv.args }))
      )
    )
  );
}
function errorToString(err: ErrorAdt): string {
  switch (err.type) {
    case "ArgError":
      return `This args are not valid
${JSON.stringify(err.args)}
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
  const args = {
    hero: process.argv[2],
    version: process.argv[3]
  };

  program(args)()
    .then(
      E.fold(
        e => {
          throw errorToString(e);
        },
        ok => {
          console.log(
            `Succesfully modified ${ok.scope}/${ok.hero} with the new version ${ok.version}`
          );
        }
      )
    )
    .catch(e => {
      console.log(e);
      process.exit(1);
    });
}

main();
