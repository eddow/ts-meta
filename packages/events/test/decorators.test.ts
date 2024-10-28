import { decorators, events } from '../src'

const { on, emit, listener } = decorators()

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
		@emit('event1') emitter(n: number) {}
		@emit() event2(n: number) {}
		@emit event3(n: number) {}
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
