# Permissions (v1 baseline)

## Roles per space

- `owner`, `editor`, `viewer` in `space_members` (v1: single implicit owner from first creator; multi-user deferred).

## Checks

- `viewer`: read pages/blocks/search.
- `editor`: + mutations except destructive space settings.
- `owner`: + member management (deferred).

## Agent scopes mapping

| Scope   | Permission                                       |
| ------- | ------------------------------------------------ |
| read    | viewer                                           |
| write   | editor                                           |
| propose | editor but staging policy may block direct apply |
| admin   | owner                                            |

## Implementation

- `authorize(actor, spaceId, action)` in `@pagesai/commands` returns boolean or throws `FORBIDDEN`.
