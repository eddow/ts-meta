import { PromiseSequence } from './utils'

const garbageCollected = Symbol('garbageCollected')

class Events<T extends NonNullable<object>> {
	private registered: boolean = false
	private readonly eventCallbacks: Record<string | symbol, Set<(details: any) => void>> = {}
	private readonly eventPromises: Record<
		string | symbol,
		{ sequence: PromiseSequence<any>; refs: number }
	> = {}
	private readonly target: WeakRef<T>
	public objectCollected = new PromiseSequence<typeof garbageCollected>()

	constructor(target: T) {
		this.target = new WeakRef(target)
	}
	private removeCallbacks(event: string | symbol, cb: (details: any) => void) {
		const callbacks = this.eventCallbacks[event]
		if (!callbacks) return
		callbacks.delete(cb)
		if (!callbacks.size) delete this.eventCallbacks[event]
		this.unregister()
	}
	public register() {
		if (!this.registered) {
			eventHolders.set(this.target.deref()!, this)
			this.registered = true
		}
	}
	public unregister() {
		if (
			this.registered &&
			Object.keys(this.eventCallbacks).length + Object.keys(this.eventPromises).length === 0
		) {
			eventHolders.delete(this.assertAlive())
			this.registered = false
		}
	}
	private assertAlive() {
		const target = this.target.deref()
		if (!target) throw new Error('Target is dead')
		return target
	}
	private withPromise<T, R extends AsyncIterator<T> | Promise<T>>(
		event: string | symbol,
		callback: (sequence: PromiseSequence<T>) => R
	) {
		const promised = (this.eventPromises[event] ??= {
			sequence: new PromiseSequence(),
			refs: 0
		})
		let allocated = true
		promised.refs++
		const deallocate = () => {
			if (!allocated) return
			allocated = false
			promised.refs--
			if (!promised.refs) {
				delete this.eventPromises[event]
				this.unregister()
			}
		}
		try {
			const rv = callback(promised.sequence)
			if (rv instanceof Promise) return rv.finally(deallocate)
			return (async function* () {
				try {
					const iterator = <AsyncIterator<T>>callback(promised.sequence)
					for await (const value of { [Symbol.asyncIterator]: () => iterator }) yield value
					return iterator.return?.()
				} finally {
					deallocate()
				}
			})()
		} catch (e) {
			deallocate()
			throw e
		}
	}

	on<Details>(event: string | symbol, callback: (details: Details) => void): () => void
	on<Details>(event: string | symbol): AsyncGenerator<Details>

	on<Details>(event: string | symbol, callback?: (details: Details) => void) {
		this.register()
		if (callback) {
			this.assertAlive()
			const callbacks = (this.eventCallbacks[event] ??= new Set())
			callbacks.add(callback)
			return () => this.removeCallbacks(event, callback)
		}
		const { objectCollected } = this
		return this.withPromise<Details, AsyncGenerator<Details>>(event, async function* (sequence) {
			do {
				const next = await Promise.any([sequence, objectCollected])
				if (next === garbageCollected) break
				yield next
			} while (true)
		})
	}

	once<Details>(event: string | symbol, callback: (details: Details) => void): () => void
	once<Details>(event: string | symbol): Promise<Details>
	once<Details>(event: string | symbol, callback?: (details: Details) => void) {
		this.register()
		if (callback) {
			const target = this.assertAlive(),
				once = (details: Details) => {
					callback.call(target, details)
					this.off(event, once)
				}
			return this.on(event, once)
		}
		return (async () => {
			return await this.withPromise<Details, Promise<Details>>(event, async function (sequence) {
				return await sequence
			})
		})()
	}
	emit(event: string | symbol, details: any) {
		const target = this.assertAlive(),
			callbacks = this.eventCallbacks[event],
			promise = this.eventPromises[event]
		if (callbacks) for (const callback of callbacks) callback.call(target, details)
		if (promise) promise.sequence.resolve(details)
	}
	off(event: string | symbol, callback: (details: any) => void) {
		this.assertAlive()
		const callbacks = this.eventCallbacks[event]
		if (!callbacks) return
		this.removeCallbacks(event, callback)
	}

	clear() {
		this.objectCollected.resolve(garbageCollected)
		eventHolders.delete(this.assertAlive())
	}
}
const eventHolders = new WeakMap<object, Events<object>>(),
	eventFinalizationRegistry = new FinalizationRegistry((events: Events<object>) => {
		events.objectCollected.resolve(garbageCollected)
	})

export function events<T extends object>(target: T) {
	let holder = eventHolders.get(target)
	if (!holder) {
		holder = new Events(target)
		eventFinalizationRegistry.register(target, holder)
	}
	return holder
}
