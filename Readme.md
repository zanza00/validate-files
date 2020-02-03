# Validate Files

validate and modify some files the io-ts way.

This is my exploration on how to do the thing.

## How To Validate

```sh
npm it
```

This command checks that the files inside `/files` are valid. The commited one are valid, feel free to try to experiment with them

## How to change version

```sh
npm run vers <hero> <new version>
```

The corresponding file in `./files` is modified based on value provided.

the arguments are positionals and are validated. Same for the files inside the folder.

One thing that I still need to do is to change `capitan-marvel` in both files.

### Examples

```sh
 npm run vers wonder-woman 3.0.1
```

```sh
 npm run vers wonderWoman 3.0.1
```

```sh
 npm run vers wonder-woman
```

```sh
 npm run vers wonder-woman 3.0.1
```
