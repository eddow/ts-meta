import { devTools, metadata, PromiseSequence, TargetIsDeadError } from '@ts-meta/utilities'
import { Constructor, ReflectionKey } from '~/types'

// TODO: remove need for @listener, change it to `@on` sub-case

const garbageCollected = Symbol('garbageCollected')

type EventParams<Details = any> = Details extends void ? [] : [Details]
type EventCB<Details = any> = Details extends void
	? () => void
	: ((details: Details) => void) | (() => void)
export type EventDetailList<Details = any> = Record<ReflectionKey, Details>

type DetailedFunctions<T> = Partial<{
	[K in keyof T]: (details: T[K]) => void
}>
type EventPropertyDescriptor<Details> =
	| TypedPropertyDescriptor<EventCB<Details>>
	| TypedPropertyDescriptor<EventCB<void>>

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

//#region Decorators

type EventDecorator<Event, Details> = (
	target: Object,
	propertyKey: Event,
	descriptor: EventPropertyDescriptor<Details>
) => void

export function decorators<EventDetails extends EventDetailList = EventDetailList>() {
	function listener(eventList: DetailedFunctions<EventDetails> = {}) {
		return function <Base extends Constructor>(target: Base) {
			const allEvents: DetailedFunctions<EventDetails> = {
				...eventList,
				...metadata('event:list', target.prototype, {})
			}
			if (!Object.keys(allEvents).length)
				devTools.warn(`${target.name} is declared as a listener but has no events registered.
		Specify events with the \`@on\` decorator and/or as \`@listener({...})\` parameters`)
			else {
				return class extends target {
					constructor(...args: any[]) {
						super(...args)
						events<EventDetails>(this).on(allEvents)
					}
				}
			}
		}
	}

	function on<Event extends keyof EventDetails = keyof EventDetails>(
		event: Event
	): EventDecorator<any, EventDetails[Event]>
	function on<Event extends keyof EventDetails = keyof EventDetails>(): EventDecorator<
		Event,
		EventDetails[Event]
	>
	function on<Event extends keyof EventDetails = keyof EventDetails>(
		target: any,
		propertyKey: Event,
		descriptor:
			| TypedPropertyDescriptor<EventCB<EventDetails[Event]>>
			| TypedPropertyDescriptor<EventCB<void>>
	): void
	/**
	 * Decorate a function for it to be called when an event is emitted on the object
	 * Note: it calls the given method, even if it was overridden in a sub-class
	 * @param event Event name
	 */
	function on(
		event?: ReflectionKey | any,
		propertyKey?: ReflectionKey,
		descriptor?: PropertyDescriptor
	) {
		const eName = descriptor ? propertyKey : event
		function decorateMethod(
			target: any,
			propertyKey: ReflectionKey,
			descriptor: PropertyDescriptor
		) {
			//events(target).on(event, (details: Details) => descriptor.value.call(target, details))
			metadata('event:list', target, {} as Record<PropertyKey, (detail: any) => void>)[
				// If called with an event name, use it. Take propertyKey if no event given or if used directly (!!descriptor)
				eName || propertyKey
			] = descriptor.value
		}
		return descriptor ? decorateMethod(event, propertyKey!, descriptor) : decorateMethod
	}

	function emits(event?: ReflectionKey): MethodDecorator
	function emits<Event extends keyof EventDetails = keyof EventDetails>(
		target: any,
		propertyKey: Event,
		descriptor: TypedPropertyDescriptor<(details: EventDetails[Event]) => void>
	): void

	/*
	on<>(
		event: Event,
		callback: EventCB<EventDetails[Event]>
	): () => void
*/
	/**
	 * Make this function emit an event whose details is the return value of the function or the first argument
	 *  if no value is returned
	 * @param event Event name
	 */
	function emits(
		event?: ReflectionKey | any,
		propertyKey?: ReflectionKey,
		descriptor?: PropertyDescriptor
	) {
		const eName = descriptor ? propertyKey : event

		function decorateMethod(
			target: any,
			propertyKey: ReflectionKey,
			descriptor: PropertyDescriptor
		) {
			if (typeof descriptor.value !== 'function') {
				throw new Error(
					`@emits can only be specified on methods, not on ${typeof descriptor.value}`
				)
			}
			const original = descriptor.value
			descriptor.value = function (...args: any[]) {
				const result = original.apply(this, args)
				events(this).emit(eName || propertyKey, result ?? args[0])
				return result
			}
		}
		return descriptor ? decorateMethod(event, propertyKey!, descriptor) : decorateMethod
	}
	return { listener, on, emits }
}
//#endregion
