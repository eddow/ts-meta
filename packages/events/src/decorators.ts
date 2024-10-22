import { devTools, metadata, PromiseSequence, TargetIsDeadError } from '@ts-meta/utilities'
import { Constructor, ReflectionKey } from '~/types'
import { DetailedFunctions, EventCB, EventDecorator, EventDetailList } from './types'
import { events } from './events'

export function decorators<EventDetails extends EventDetailList>() {
	function listener(eventList?: DetailedFunctions<EventDetails>): ClassDecorator
	function listener(Class: Constructor): Constructor | void

	function listener(
		eventList: DetailedFunctions<EventDetails> | Constructor = {}
	): ClassDecorator | Constructor | void {
		function decorateClass<Base extends Constructor>(target: Base) {
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
		return typeof eventList === 'function'
			? decorateClass(eventList)
			: (decorateClass as ClassDecorator)
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
	/*
	function emit(event?: ReflectionKey): MethodDecorator
	function emit<Event extends keyof EventDetails = keyof EventDetails>(
		target: any,
		propertyKey: Event,
		descriptor: TypedPropertyDescriptor<(details: EventDetails[Event]) => void>
	): void
*/

	function emit<Event extends keyof EventDetails = keyof EventDetails>(
		event: Event
	): EventDecorator<any, EventDetails[Event]>
	function emit<Event extends keyof EventDetails = keyof EventDetails>(): EventDecorator<
		Event,
		EventDetails[Event]
	>
	function emit<Event extends keyof EventDetails = keyof EventDetails>(
		target: any,
		propertyKey: Event,
		descriptor:
			| TypedPropertyDescriptor<EventCB<EventDetails[Event]>>
			| TypedPropertyDescriptor<EventCB<void>>
	): void

	/**
	 * Make this function emit an event whose details is the return value of the function or the first argument
	 *  if no value is returned
	 * @param event Event name
	 */
	function emit(
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
	return { listener, on, emit }
}
const { on, emit, listener } = decorators()
export { on, emit, listener }
