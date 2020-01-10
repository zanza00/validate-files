import * as fs from "fs";
import * as t from "io-ts";

import * as A from "fp-ts/lib/Array";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/pipeable";

import { Groups, Heroes } from "./models";

const readFile = TE.taskify(fs.readFile);

const jsToString = (value: t.mixed) =>
  value === undefined ? "undefined" : JSON.stringify(value);

function formatError(error: t.ValidationError) {
  const path = error.context
    .map(c => c.key)
    .filter(key => key.length > 0)
    .join(".");

  const errorContext = A.last(error.context as Array<t.ContextEntry>);

  return pipe(
    errorContext,
    O.map(errorContext => {
      const expectedType = errorContext.type.name;
      return (
        `Expecting ${expectedType}` +
        (path === "" ? "" : ` at ${path}`) +
        ` but instead got: ${jsToString(error.value)}.`
      );
    })
  );
}
function decodeErrors(file: string, e: t.Errors): Error {
  const missingKeysMessage = pipe(
    e.map(a => formatError(a)),
    A.array.sequence(O.option),
    O.fold(
      () => "no errors",
      err => [`Problem in file ${file}`, err].join("\n")
    )
  );
  return new Error(`${missingKeysMessage}`);
}

function parseFile<C extends t.TypeC<any>>({
  file,
  codec
}: {
  file: string;
  codec: C;
}): TE.TaskEither<Error, t.TypeOf<C>> {
  return pipe(
    readFile(file),
    TE.chain(buffer => {
      const stringToBeParsed = buffer.toString("utf8");
      return TE.fromEither(E.parseJSON(stringToBeParsed, E.toError));
    }),
    TE.chain(fileData => {
      return pipe(
        TE.fromEither(codec.decode(fileData)),
        TE.mapLeft(e => decodeErrors(file, e))
      );
    })
  );
}

const filesMap = [
  { file: "files/dccomics/users.json", codec: Heroes },
  { file: "files/dccomics/groups.json", codec: Groups },
  { file: "files/marvel/groups.json", codec: Groups },
  { file: "files/marvel/users.json", codec: Heroes }
];

const validateAllFiles = A.array.sequence(TE.taskEither)(
  filesMap.map(x => {
    const codec = (x.codec as unknown) as t.TypeC<any>;
    return parseFile({ file: x.file, codec });
  })
);

function main() {
  validateAllFiles().then(result => {
    pipe(
      result,
      E.fold(
        e => {
          console.log("Some error occurred :(");
          console.log(e.message);
          process.exit(1);
        },
        ok => {
          console.log("Succesfully validated files");
        }
      )
    );
  });
}

main();
