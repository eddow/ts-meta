import { events } from '../src'
function tick(ms: number = 0) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

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
