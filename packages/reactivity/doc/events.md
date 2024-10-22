# Event management

Centralized event management: objects who are concerned by these events do not even have to be aware of this happening.

## Why ?

There are already so many. This one implements:

- Full type checking (even for events declaration & parameters)
- It's a layer over, not under. There is nothing to implement, the functionality is just added dynamically
- Memory-leak proof

## How ?

```
import { events } from `@ts-meta/reactivity`
```
