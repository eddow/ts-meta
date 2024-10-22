import { PromiseSequence, TargetIsDeadError } from '@ts-meta/utilities'
import { ReflectionKey } from '~/types'
import { DetailedFunctions, EventCB, EventDetailList, EventParams } from './types'

// TODO: remove need for @listener, change it to `@on` sub-case ?

const garbageCollected = Symbol('garbageCollected')

class Events<EventDetails extends EventDetailList = EventDetailList> {
	private registered: boolean = false
	private readonly eventCallbacks = {} as Record<
		keyof EventDetails,
		Set<EventCB<EventDetails[keyof EventDetails]>>
	>
	private readonly eventPromises: Record<
		ReflectionKey,
		{ sequence: PromiseSequence<any>; refs: number }
	> = {}
	private readonly target: WeakRef<any>
	public objectCollected = new PromiseSequence<typeof garbageCollected>()

	constructor(target: NonNullable<object>) {
		this.target = new WeakRef(target)
	}

	private removeCallbacks<Event extends keyof EventDetails>(
		event: Event,
		cb: EventCB<EventDetails[Event]>
	) {
		const callbacks = this.eventCallbacks[event]
		if (!callbacks) return
		callbacks.delete(cb as EventCB<EventDetails[keyof EventDetails]>)
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
			const target = this.target.deref()
			if (target) eventHolders.delete(target)
			this.registered = false
		}
	}
	private assertAlive() {
		const target = this.target.deref()
		if (!target) throw new TargetIsDeadError()
		return target
	}
	private withPromise<Event, Details, Returns extends AsyncIterator<Details> | Promise<Details>>(
		event: Event,
		callback: (sequence: PromiseSequence<Details>) => Returns
	): Returns {
		const promised = (this.eventPromises[event as ReflectionKey] ??= {
			sequence: new PromiseSequence(),
			refs: 0
		})
		let allocated = true
		promised.refs++
		// Deallocation occurs at many moments, depending on Promise/AsyncIterator usage or direct exception
		const deallocate = () => {
			if (!allocated) return
			allocated = false
			promised.refs--
			if (!promised.refs) {
				delete this.eventPromises[event as ReflectionKey]
				this.unregister()
			}
		}
		try {
			const rv = callback(promised.sequence)
			if (rv instanceof Promise) return rv.finally(deallocate) as Returns
			return (async function* () {
				try {
					const iterator = <AsyncIterator<Details>>callback(promised.sequence)
					for await (const value of { [Symbol.asyncIterator]: () => iterator }) yield value
					return iterator.return?.()
				} finally {
					deallocate()
				}
			})() as any //sorry...
		} catch (e) {
			deallocate()
			throw e
		}
	}

	on<Event extends keyof EventDetails>(
		event: Event,
		callback: EventCB<EventDetails[Event]>
	): () => void
	on<Event extends keyof EventDetails>(event: Event): AsyncGenerator<EventDetails[Event]>
	on<Event extends keyof EventDetails>(
		events: DetailedFunctions<EventDetails>
	): Record<keyof Event, () => void>

	on<Event extends keyof EventDetails>(
		event: Event | DetailedFunctions<EventDetails>,
		callback?: EventCB<EventDetails[Event]>
	): (() => void) | AsyncGenerator<EventDetails[Event]> | Record<keyof Event, () => void> {
		this.assertAlive()
		if (typeof event === 'object') {
			const rv = {} as Record<keyof Event, () => void>
			for (const [key, value] of Object.entries(event)) rv[key as keyof Event] = this.on(key, value)
			return rv
		}
		this.register()
		if (callback) {
			const callbacks = (this.eventCallbacks[event] ??= new Set())
			callbacks.add(callback as EventCB<EventDetails[keyof EventDetails]>)
			return () => this.removeCallbacks(event, callback)
		}
		const { objectCollected } = this
		return this.withPromise<Event, EventDetails[Event], AsyncGenerator<EventDetails[Event]>>(
			event,
			async function* (sequence) {
				do {
					const next = await Promise.any([sequence, objectCollected])
					if (next === garbageCollected) break
					yield next
				} while (true)
			}
		)
	}

	once<Event extends keyof EventDetails>(
		event: Event,
		callback: EventCB<EventDetails[Event]>
	): () => void
	once<Event extends keyof EventDetails>(event: Event): Promise<EventDetails[Event]>
	once<Event extends keyof EventDetails>(event: Event, callback?: EventCB<EventDetails[Event]>) {
		this.register()
		if (callback) {
			const target = this.assertAlive(),
				once = ((detail: EventDetails[Event]) => {
					callback.call(target, detail)
					this.off(event, once)
				}) as EventCB<EventDetails[Event]>
			return this.on(event, once)
		}
		return (async () => {
			return await this.withPromise<Event, EventDetails[Event], Promise<EventDetails[Event]>>(
				event,
				async function (sequence) {
					return await sequence
				}
			)
		})()
	}
	emit<Event extends keyof EventDetails>(
		event: Event,
		...details: EventParams<EventDetails[Event]>
	) {
		const target = this.assertAlive(),
			callbacks = this.eventCallbacks[event as ReflectionKey],
			promise = this.eventPromises[event as ReflectionKey]
		if (callbacks) for (const callback of callbacks) callback.call(target, details[0])
		if (promise) promise.sequence.resolve(details[0])
	}
	off<Event extends keyof EventDetails>(event: Event, callback: EventCB<EventDetails[Event]>) {
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

export function events<EventDetails extends EventDetailList = EventDetailList>(
	target: NonNullable<object>
) {
	let holder = eventHolders.get(target) as Events<EventDetails>
	if (!holder) {
		holder = new Events<EventDetails>(target)
		eventFinalizationRegistry.register(target, holder)
	}
	return holder
}
