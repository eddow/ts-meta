# Event management

Centralized event management: objects who are concerned by these events do not even have to be aware of this happening.

Each event has one (type) argument.

## Why ?

There are already so many. This one implements:

- Full type checking (even for events declaration & parameters)
- It's a layer over, not under. There is nothing to implement, the functionality is just added dynamically
- Memory-leak proof

## How ?

### Using central event operator

```ts
import { events } from `@ts-meta/reactivity`

events(myObject).emit('message', "Hi!")
events(yourObject).on('click', ({x, y})=> { ... })
```

Note that here, if they were not made aware of events, `myObject` and `yourObject` had no indication something happened, though all the events could be emitted/caught.

#### Type checking

```ts
import { events } from `@ts-meta/reactivity`

// Describe the "detail" parameter type of each events
type Events = {
	message: string
	click: {x: number, y: number}
}

events<Events>(myObject).emit('message', "Hi!")
events<Events>(yourObject).on('click', ({x, y})=> { ... })
```

Here, the types is checked (`x` is known to be a number in the `'click'` event)

`events` can be called without type parameter (no type-check will occur)

### Using decorators

```ts
import { on, emits, listener } from `@ts-meta/reactivity`

@listener(
	message(this: MyClass, msg) { console.log(this.lastMessage + msg.toLowerCase()) }
)
class MyClass {
	lastMessage: string
	@on protected click({x, y}) { ... }
	@emit message(msg)
}
```

#### Type checking

```ts
import { decorators } from `@ts-meta/reactivity`

// Describe the "detail" parameter type of each events
type Events = {
	message: string
	click: {x: number, y: number}
}
const { on, emits, listener } = decorators<Events>()

@listener(
	message(this: MyClass, msg) { console.log(this.lastMessage + msg.toLowerCase()) }
)
class MyClass {
	lastMessage: string
	@on protected click({x, y}: Events['click']) { ... }
	@emit message(msg)
}
```

Note: the `decorators` function makes no computation and is just there for typing purpose.

Here, the `: Events['click']` is compulsory (`: {x: number, y: number}` works too) as it is too tough for typescript to infer it. Though, the types are checked and `@on click` cannot take a string.

The `@listener` is compulsory even with an empty argument when using `@on` (not for `@emit`)

Both `@on` and `@emit` can be used in 3 ways (shown here with `@on` but valid on both)

```ts
@on click(...) { console.log('click event') }
@on() click(...) { console.log('click event') }
@on('click') onClick(...) { console.log('click event') }
```

#### Difference with simple methods

Inheritance doesn't change the behavior as the method is referred to directly.

```ts
@listener
class MyParent {
	counter = 0
	@on increment() {
		this.counter++
	}
}

class MyChild extends MyParent {
	increment() {
		this.counter += 3
	}
}

const parentObject = new MyParent()
// counter: 0
parentObject.increment()
// counter: 1
events(parentObject).emit('increment')
// counter: 2

const childObject = new MyChild()
// counter: 0
childObject.increment()
// counter: 3
events(childObject).emit('increment')
// counter: 4
```
