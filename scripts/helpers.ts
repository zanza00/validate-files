import * as fs from "fs";

import { pipe } from "fp-ts/lib/pipeable";
import * as t from "io-ts";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as A from "fp-ts/lib/Array";
import * as O from "fp-ts/lib/Option";

// make fs.readfile a taskeither
export const readFile: (
  a: string
) => TE.TaskEither<NodeJS.ErrnoException, Buffer> = TE.taskify(fs.readFile);

export const writeFile = TE.taskify(fs.writeFile);

export function prettyStringifyJson(obj: object): E.Either<Error, string> {
  return E.tryCatch(() => JSON.stringify(obj, undefined, 2), E.toError);
}

// Error Handling: print "undefined"
const jsToString = (value: unknown) =>
  value === undefined ? "undefined" : JSON.stringify(value);

// Error Handling: pretty print of a single validation Errors
export function formatError(error: t.ValidationError): string {
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
    }),
    O.getOrElse(() => "")
  );
}
