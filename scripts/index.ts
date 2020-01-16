import * as fs from "fs";
import * as t from "io-ts";

import * as A from "fp-ts/lib/Array";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as NEA from "fp-ts/lib/NonEmptyArray";
import { pipe } from "fp-ts/lib/pipeable";

import { Groups, Heroes } from "./models";

// make fs.readfile a taskeither
const readFile: (
  a: string | number | Buffer
) => TE.TaskEither<NodeJS.ErrnoException, Buffer> = TE.taskify(fs.readFile);

// Error Handling: print "undefined"
const jsToString = (value: t.mixed) =>
  value === undefined ? "undefined" : JSON.stringify(value);

// Error Handling: pretty print of a single validation Errors
function formatError(error: t.ValidationError): O.Option<string> {
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

// Error Handling: Print all validation errors with the fileneame
function decodeErrors(
  filePath: string,
  errors: t.Errors
): NEA.NonEmptyArray<Error> {
  const missingKeysMessage: string = pipe(
    errors.map(e => formatError(e)),
    // swap from Array<Option<string>> to Option<Array<string>> for easier handling
    A.array.sequence(O.option),
    O.fold(
      () => "no errors",
      err => [`Problem in file ${filePath}`, err].join("\n")
    )
  );
  return [new Error(`${missingKeysMessage}`)];
}

// File Handler: decode a file after is read by fs.readfile
function parseJsonFile(
  buffer: Buffer
): TE.TaskEither<NEA.NonEmptyArray<Error>, unknown> {
  const stringToBeParsed = buffer.toString("utf8");
  return TE.fromEither(
    E.parseJSON(stringToBeParsed, e => NEA.of(E.toError(e)))
  );
}

// validate the file with io-ts codec
function validateShapeAndContent(
  fileData: unknown,
  filePath: string,
  codec: t.Type<any>
) {
  return pipe(
    TE.fromEither(codec.decode(fileData)),
    TE.mapLeft(e => decodeErrors(filePath, e))
  );
}

function parseFile<A>(
  filePath: string,
  codec: t.Type<any>
): TE.TaskEither<NEA.NonEmptyArray<Error>, A> {
  return pipe(
    readFile(filePath),
    TE.mapLeft(e => NEA.of(e)), // widen the type of errors from Error to NonEmptyArray<Error>
    TE.chain(parseJsonFile),
    TE.chain(fileData => validateShapeAndContent(fileData, filePath, codec))
  );
}

const filesMap = [
  { file: "files/dccomics/users.json", codec: Heroes },
  { file: "files/dccomics/groups.json", codec: Groups },
  { file: "files/marvel/groups.json", codec: Groups },
  { file: "files/marvel/users.json", codec: Heroes }
];

// This enables us to accumulate the errors and not exit on first error
// based on https://dev.to/gcanti/getting-started-with-fp-ts-either-vs-validation-5eja
const applicativeValidation = TE.getTaskValidation(NEA.getSemigroup<Error>());

// this sequence is needed accumulate errors AND to swap from Array<TaskEither<E,A>> to TaskEither<E[], A[]>
const validateAllFiles = A.array.sequence(applicativeValidation)(
  filesMap.map(x => parseFile(x.file, x.codec))
);

// The main program.
// The taskeither is executed only when main is invoked
function main() {
  validateAllFiles().then(result => {
    pipe(
      result,
      E.fold(
        errors => {
          console.log("Some error occurred :(");
          errors.forEach(e => {
            console.log(e.message);
            console.log("--");
          });
          process.exit(1);
        },
        () => {
          console.log("Succesfully validated files");
        }
      )
    );
  });
}

main();
