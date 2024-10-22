export * from './metadata'
export * from './defer'
export * from './promiseSequence'

/**
 * Occurs when dealing with a descriptor object (event, ...) that refers to an object that has been garbage collected
 */
export class TargetIsDeadError extends Error {
	constructor() {
		super('Target is dead')
		this.name = 'TargetIsDeadError'
	}
}

/**
 * Override default behaviors here
 */
export const devTools = {
	warn(...args: any[]) {
		console.warn(...args)
	}
}

export class ContextStack<T> {
	private readonly stack: T[] = []
	get current() {
		return this.stack[0]
	}
	get isEmpty() {
		return this.stack.length === 0
	}
	enter(value: any) {
		this.stack.unshift(value)
	}
	leave() {
		return this.stack.shift()
	}
	with<R>(context: T, fn: (context: T) => R): R {
		this.enter(context)
		try {
			return fn(context)
		} finally {
			this.leave()
		}
	}
}

export function mapDefault<K, V>(
	map: Map<K, V> | (K extends WeakKey ? WeakMap<K, V> : never),
	key: K,
	defaultValue: () => V
): V {
	if (!map.has(key)) map.set(key, defaultValue())
	return map.get(key)!
}
