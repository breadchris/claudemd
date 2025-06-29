Use types/database.types.ts for supabase type definitions. It is updated by running: 
```shell
npx supabase gen types typescript --project-id "qxbfhpisnafbwtrhekyn" --schema public > database.types.ts
```

when writing typescript, do not use index.ts to export types, they should be exported directly from the file they are defined in.
never use default exports, always use named exports.