---
cssclasses:
  - table-wide
---
Needs **Settings → Editor → Readable line length** on. Regular text should stay at the readable width unless the class widens the whole note.

| Column 1 | Column 2 | Column 3 | Column 4 | Column 5 | Column 6 |
| --- | --- | --- | --- | --- | --- |
| Lorem ipsum dolor | sit amet consectetur | adipiscing elit sed | do eiusmod tempor | incididunt ut labore | et dolore magna |

![[hive-light.png]]

<iframe src="https://example.com" height="200"></iframe>

![[Books.base]]

```base
filters:
  and:
    - file.inFolder("Books")
views:
  - type: table
    name: Code block
    order:
      - file.name
      - author
      - year
      - rating
```

> [!note] Inside a callout
> | Should | stay |
> | --- | --- |
> | at the | callout width |
