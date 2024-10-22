import { TargetIsDeadError } from '@ts-meta/utilities'
import { decorators, events } from '../src'

function tick(ms: number = 0) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

const gc = global.gc

const { on, emits, listener } = decorators()

describe('functions', () => {
	it('emits', () => {
		const target = {},
			evt = events(target),
			fn = jest.fn()
		evt.on('event', fn)
		evt.emit('event', 5)
		expect(fn).toHaveBeenCalledWith(5)
	})
	it('several', () => {
		const target = {},
			evt = events(target),
			fns = { event1: jest.fn(), event2: jest.fn() }
		evt.on(fns)
		evt.emit('event1')
		expect(fns.event1).toHaveBeenCalledTimes(1)
		expect(fns.event2).toHaveBeenCalledTimes(0)
		evt.emit('event2')
		expect(fns.event1).toHaveBeenCalledTimes(1)
		expect(fns.event2).toHaveBeenCalledTimes(1)
	})
	it('emits several', () => {
		const target = {},
			evt = events(target),
			fns = [jest.fn(), jest.fn()]
		evt.on('event', fns[0])
		evt.on('event', fns[1])
		evt.emit('event', 6)
		expect(fns[0]).toHaveBeenCalled()
		expect(fns[1]).toHaveBeenCalled()
	})
	it('no sur-emits', () => {
		const target = {},
			evt = events(target),
			fns = [jest.fn(), jest.fn(), jest.fn()]
		evt.on('eventX', fns[0])
		evt.on('event', fns[1])
		evt.on('event', fns[2])
		evt.emit('event', 6)
		expect(fns[0]).not.toHaveBeenCalled()
		expect(fns[1]).toHaveBeenCalled()
		expect(fns[2]).toHaveBeenCalled()
	})
	it('off', () => {
		const target = {},
			evt = events(target),
			fn = jest.fn()
		evt.on('event', fn)
		evt.off('event', fn)
		evt.emit('event', 5)
		expect(fn).not.toHaveBeenCalled()
	})
	it('unsubscribe', () => {
		const target = {},
			evt = events(target),
			fn = jest.fn()
		evt.on('event', fn)()
		evt.emit('event', 5)
		expect(fn).not.toHaveBeenCalled()
	})
	it('once', async () => {
		const target = {},
			evt = events(target),
			fn = jest.fn()
		evt.once('event', fn)
		evt.emit('event', 5)
		expect(fn).toHaveBeenCalledTimes(1)
		evt.emit('event', 5)
		expect(fn).toHaveBeenCalledTimes(1)
	})
	it('promise', async () => {
		const target = {},
			evt = events(target)
		let ctr = 0
		;(async () => {
			for await (const detail of evt.on('event')) ctr += detail
		})()
		expect(ctr).toBe(0)
		evt.emit('event', 5)
		await tick()
		expect(ctr).toBe(5)
		evt.emit('event', 2)
		await tick()
		expect(ctr).toBe(7)
	})
	it('promise once ', async () => {
		const target = {},
			evt = events(target)
		let ctr = 0
		;(async () => {
			ctr = await evt.once('event')
		})()
		expect(ctr).toBe(0)
		evt.emit('event', 5)
		await tick()
		expect(ctr).toBe(5)
		evt.emit('event', 2)
		await tick()
		expect(ctr).toBe(5)
	})
})
describe('decorators', () => {
	it('on', () => {
		@listener()
		class Test {
			ctr = 0
			@on('event1')
			anEvent(detail: number) {
				this.ctr += detail
			}
			@on()
			event2(detail: number) {
				this.ctr += detail
			}
			@on event3(detail: number) {
				this.ctr += detail
			}
		}
		const test = new Test()
		events(test).emit('event1', 1)
		events(test).emit('event2', 2)
		events(test).emit('event3', 3)
		expect(test.ctr).toBe(6)
	})
	it('emits', () => {
		function adder(this: Test, detail: number) {
			this.ctr += detail
		}
		@listener({
			event1: adder,
			event2: adder,
			event3: adder
		})
		class Test {
			ctr = 0
			@emits('event1') emitter(n: number) {}
			@emits() event2(n: number) {}
			@emits event3(n: number) {}
		}
		const test = new Test()
		test.emitter(1)
		test.event2(2)
		test.event3(3)
		expect(test.ctr).toBe(6)
	})
	it('on legacy', () => {
		@listener()
		class Test {
			lastCall = 'none'
			@on('event')
			event() {
				this.lastCall = 'Test.event'
			}
		}
		class Sub extends Test {
			event() {
				this.lastCall = 'Sub.event'
			}
		}
		const test = new Sub()
		events(test).emit('event')
		expect(test.lastCall).toBe('Test.event')
	})
	it('listener', () => {
		@listener({
			event(this: Test) {
				this.ctr++
			}
		})
		class Test {
			ctr = 0
		}
		const test = new Test()
		events(test).emit('event')
		expect(test.ctr).toBe(1)
	})
})

describe('Garbage collection', () => {
	async function collectGarbages() {
		await tick()
		gc!()
		await tick()
	}
	beforeAll(() => {
		if (!gc)
			throw new Error(
				'Garbage collector not available. Use `node --expose-gc node_modules/.bin/jest`'
			)
	})
	it('functional', async () => {
		const evt = events({}),
			fn = jest.fn()
		await collectGarbages()
		expect(() => evt.on('event', fn)).toThrow(TargetIsDeadError)
	})
	it('decorated listener', async () => {
		@listener({
			event(this: Test) {
				this.ctr++
			}
		})
		class Test {
			ctr = 0
		}
		const evt = (() => events(new Test()))()
		await collectGarbages()
		expect(() => evt.emit('event')).toThrow(TargetIsDeadError)
	})
	it('decorated on', async () => {
		@listener()
		class Test {
			ctr = 0
			@on event() {
				this.ctr++
			}
		}
		const evt = (() => events(new Test()))()
		await collectGarbages()
		expect(() => evt.emit('event')).toThrow(TargetIsDeadError)
	})
})

/**
 * Not to call, this is just to test TypeScript validation
 */
function TypeScriptCheck() {
	type TSTestEventsDetails = {
		click: { x: number; y: number; button?: 'L' | 'M' | 'R' }
		message: string
		beep: void
	}
	const evt = events<TSTestEventsDetails>({})

	evt.emit('click', { x: 5, y: 6 })
	evt.emit('click', { x: 5, y: 6, button: 'L' })
	evt.emit('beep')
	evt.on('click', ({ x, y }) => {})
	evt.on('click', ({ x, y, button }) => {})

	evt.on('message', (msg) => {
		console.log(msg.toLowerCase())
	})

	// @ts-expect-error
	evt.emit('click', { x: 5 })
	// @ts-expect-error
	evt.emit('message', { x: 5, y: 6 })
	// @ts-expect-error
	evt.emit('click', { x: 5, y: 6, button: 'X' })
	// @ts-expect-error
	evt.on('click', ({ d }) => {})
	const { on, emits, listener } = decorators<TSTestEventsDetails>()

	// Should be valid
	@listener({
		click({ x, button }) {},
		message(msg) {
			console.log(msg.toLowerCase())
		}
	})
	class TW1 {
		@on('click')
		onClick({ x, button }: TSTestEventsDetails['click']) {}
		@on click({ x, y, button }: TSTestEventsDetails['click']) {}
		@on('beep') onBeep() {}
		@on protected beep() {}
		// We can ignore the detail
		@on message() {}
	}

	class TW2 {
		@on() click({ x, y, button }: TSTestEventsDetails['click']) {}
		@on() beep() {}
	}

	// Errors
	@listener({
		// @ts-expect-error
		click: ({ x, d, button }) => {
			console.log(x, d, button)
		}
	})
	class TE1 {
		// @ts-expect-error
		@on('click')
		onClick(msg: TSTestEventsDetails['message']) {}
		// @ts-expect-error
		@on
		beep(times: number) {}
	}
}
