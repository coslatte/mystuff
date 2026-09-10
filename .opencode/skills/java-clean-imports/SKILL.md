---
name: java-clean-imports
description: Enforce clean Java imports in the backend. Use when writing or reviewing Java code, adding dependencies, or refactoring services. Triggers on: import, java.util, fully qualified, FQN, inline import, clean code, code style.
---

# Java Clean Imports

Backend Java code MUST use explicit import statements instead of inline fully-qualified names. Inline usage like `java.util.UUID.randomUUID()` is not clean and makes code harder to read and maintain.

## Rules

1. **No inline fully-qualified names**: Never write `java.util.UUID`, `java.time.Instant`, `java.util.List`, `java.nio.*`, etc. directly in method bodies or field declarations. Always add an `import` at the top of the file.
   - Bad: `java.util.UUID.randomUUID().toString()`
   - Good: `import java.util.UUID;` + `UUID.randomUUID().toString()`

2. **Applies to all packages**: This includes `java.*`, `javax.*`, `org.*`, `com.*` — any fully-qualified reference that could be an import must be an import. The only exception is when disambiguating two classes with the same simple name (e.g., `java.util.Date` vs `java.sql.Date`), which should be resolved by renaming or explicit disambiguation with a comment.

3. **Import organization**: Group imports with a blank line separator, following the project convention (see `backend/src/main/java/com/cosmiclatte/dev/cosmiclatteweb/common/config/GlobalExceptionHandler.java`):
   ```
   import com.cosmiclatte.dev.cosmiclatteweb...
   import lombok...
   import org.springframework...

   import java.time...
   import java.util...
   ```
   Keep `java.*` imports last, separated by a blank line.

4. **No wildcard imports**: Use explicit single-class imports (`import java.util.List;`) not `import java.util.*;`.

5. **Remove unused imports**: Do not leave unused imports after refactoring.

## Workflow for Agents

- Before committing Java changes, search for inline FQN patterns: `grep -r "java\." --include="*.java" backend/src` and ensure every match is an `import` line.
- When fixing, add the missing import and replace the FQN with the simple class name.
- Verify with `./mvnw compile` or `mvn compile` that the file still compiles.

## Examples

- Bad:
  ```java
  public String newId() {
      return java.util.UUID.randomUUID().toString();
  }
  ```
- Good:
  ```java
  import java.util.UUID;

  public String newId() {
      return UUID.randomUUID().toString();
  }
  ```

## Reference

- Fixed example: `backend/src/main/java/com/cosmiclatte/dev/cosmiclatteweb/service/RatingService.java` — replaced `java.util.UUID` inline with `import java.util.UUID;`.
