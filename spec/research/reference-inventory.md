# Reference inventory

| Reference                      | URL (public)                  | License posture         | Studied (concepts)                              | Not copied                    | Runtime?      |
| ------------------------------ | ----------------------------- | ----------------------- | ----------------------------------------------- | ----------------------------- | ------------- |
| Notion (product)               | https://www.notion.so         | Proprietary             | UX patterns: blocks, slash, DB views, backlinks | UI, assets, APIs              | No            |
| Notion API docs                | https://developers.notion.com | Proprietary API terms   | High-level data shapes inspiration only         | Schemas/code                  | No            |
| AppFlowy                       | https://appflowy.io / GitHub  | AGPL (project)          | Folder/doc/database separation, sync ideas      | Source, packages              | No            |
| AppFlowy-Collab                | GitHub docs                   | AGPL                    | CRDT + row model concepts                       | Code                          | No            |
| AFFiNE                         | https://affine.pro            | Mixed / verify per file | Block graph, multi-surface ideas                | BlockSuite bundles default No | Study-only    |
| BlockSuite                     | AFFiNE ecosystem              | Verify                  | Block store, collaboration                      | Default No                    | Study-only    |
| Yjs                            | https://yjs.dev               | MIT                     | CRDT rooms, awareness                           | —                             | **Yes**       |
| Lexical                        | https://lexical.dev           | MIT                     | Editor, rich text                               | —                             | **Yes**       |
| Figma / “Notion-like” patterns | Various blogs                 | N/A                     | Slash menus, palettes                           | —                             | No            |
| mail-ai (sister)               | Local / repo                  | MIT (assumed)           | hofOS harness, JWT, export scripts              | Copy only patterns            | N/A           |
| hof-os sister-ui-contract      | `hof-os/infra`                | Internal                | Singleton deps, proxy routes                    | —                             | Contract file |

**Dependency policy**: Default **MIT/Apache/BSD**. Any package not clearly permissive → reject.

**PagesAI stance**: Implement from these specs; use **Yjs + Lexical + Drizzle + Fastify** as permitted runtime stack.
