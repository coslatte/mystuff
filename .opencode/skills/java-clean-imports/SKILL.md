---
name: java-clean-imports
description: Enforce clean Java imports in the backend. Use when writing or reviewing Java code, adding dependencies, or refactoring services. Triggers on: import, java.util, fully qualified, FQN, inline import, clean code, code style.
---

# Java clean imports

Backend Java code must reference classes by their simple name. A fully
qualified name in a method body hides what is being used and makes the file
harder to scan.

## Rules

Never write `java.util.UUID.randomUUID()` or `java.time.Instant.now()` inline.
Add the import and use the short name. This applies to `java.*`, `javax.*`,
`org.*` and `com.*` alike.

The one exception is two classes with the same simple name, such as
`java.util.Date` versus `java.sql.Date`. Qualify those inline and say why in a
comment.

Group imports with a blank line between third-party and JDK imports, keeping
`java.*` last. `src/backend/src/main/java/com/cosmiclatte/dev/cosmiclatteweb/common/config/GlobalExceptionHandler.java`
shows the convention:

```
import com.cosmiclatte.dev.cosmiclatteweb...
import lombok...
import org.springframework...

import java.time...
import java.util...
```

Import every class individually. `import java.util.*;` and
`import jakarta.persistence.*;` are both rejected; the three JPA entities under
`model/` spell out their annotations for the same reason.

Delete imports left behind by a refactor.

## Workflow for agents

Before committing, search for inline FQNs:
`rg "\b(java|javax|jakarta|org|com)\.[a-z]" src/backend/src --glob '*.java'` and turn
every hit that is not an import line into one.

Verify with `./mvnw compile`.