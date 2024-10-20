class Semaphore<T = any> {
	public resolve: (value: T | PromiseLike<T>) => void
	public reject: (reason?: any) => void
	private promise: Promise<T>

	private createPromise() {
		let resolve: (value: T | PromiseLike<T>) => void
		let reject: (reason?: any) => void
		const promise = new Promise<T>((_resolve, _reject) => {
			resolve = _resolve
			reject = _reject
		})
		return { resolve: resolve!, reject: reject!, promise }
	}
	constructor() {
		const { resolve, reject, promise } = this.createPromise()
		this.resolve = resolve
		this.reject = reject
		this.promise = promise.then((x) => (this.reinitPromise(), x))
	}
	reinitPromise() {
		const { resolve, reject, promise } = this.createPromise()
		this.resolve = resolve
		this.reject = reject
		this.promise = promise.then((x) => (this.reinitPromise(), x))
	}
	then<R>(callback: (x: T) => R): Promise<R> {
		return this.promise.then(callback)
	}
}

const garbageCollected = Symbol('garbageCollected')

class Events<T extends NonNullable<object>> {
	private readonly eventCallbacks: Record<string | symbol, Set<(...args: any[]) => void>> = {}
	private readonly eventPromises: Record<
		string | symbol,
		{ semaphore: Semaphore<any>; refs: number }
	> = {}
	private readonly target: WeakRef<T>
	public objectCollected = new Semaphore<typeof garbageCollected>()

	constructor(target: T) {
		this.target = new WeakRef(target)
	}
	private removeCallbacks(event: string | symbol, cb: (...args: any[]) => void) {
		const callbacks = this.eventCallbacks[event]
		if (!callbacks) return
		callbacks.delete(cb)
		if (!callbacks.size) delete this.eventCallbacks[event]
		if (!Object.keys(this.eventCallbacks).length && !Object.keys(this.eventPromises).length)
			eventHolders.delete(this.assertAlive())
	}
	private assertAlive() {
		const target = this.target.deref()
		if (!target) throw new Error('Target is dead')
		return target
	}
	private async *withPromise<T extends any[]>(
		event: string | symbol,
		callback: (semaphore: Semaphore<T>) => AsyncIterator<T>
	) {
		const promised = (this.eventPromises[event] ??= {
			semaphore: new Semaphore(),
			refs: 0
		})
		promised.refs++
		try {
			const iterator = callback(promised.semaphore)
			for await (const value of { [Symbol.asyncIterator]: () => iterator }) yield value
			return iterator.return?.()
		} finally {
			promised.refs--
			if (!promised.refs) delete this.eventPromises[event]
			if (!Object.keys(this.eventCallbacks).length && !Object.keys(this.eventPromises).length)
				eventHolders.delete(this.assertAlive())
		}
	}

	on(event: string | symbol, callback: (...args: any[]) => void) {
		this.assertAlive()
		const callbacks = (this.eventCallbacks[event] ??= new Set())
		callbacks.add(callback)
		return () => this.removeCallbacks(event, callback)
	}
	emit(event: string | symbol, ...args: any[]) {
		const target = this.assertAlive(),
			callbacks = this.eventCallbacks[event]
		if (!callbacks) return
		for (const callback of callbacks) callback.apply(target, args)
	}

	once<Params extends any[] = any[]>(
		event: string | symbol,
		callback: (...args: Params) => void
	): () => void
	once<Params extends any[] = any[]>(event: string | symbol): Promise<Params>
	once<Params extends any[] = any[]>(event: string | symbol, callback?: (...args: Params) => void) {
		if (callback) {
			const target = this.assertAlive(),
				once = (...args: Params) => {
					callback.apply(target, args)
					this.off(event, once)
				}
			return this.on(event, once)
		}
		return (async () => {
			return await this.withPromise<Params>(event, async function* (semaphore) {
				return await semaphore
			})
		})()
	}
	off(event: string | symbol, callback: (...args: any[]) => void) {
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
		eventHolders.set(target, (holder = new Events(target)))
		eventFinalizationRegistry.register(target, holder)
	}
	return holder
}
