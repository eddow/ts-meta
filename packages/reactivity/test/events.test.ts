import { events } from '../src'

function tick(ms: number = 0) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

// TODO global.gc when --expose-gc is enabled: find a way to enable it then test
it('emits', () => {
	const target = {},
		fct = events(target),
		fn = jest.fn()
	fct.on('event', fn)
	fct.emit('event', 5)
	expect(fn).toHaveBeenCalledWith(5)
})
it('emits several', () => {
	const target = {},
		fct = events(target),
		fns = [jest.fn(), jest.fn()]
	fct.on('event', fns[0])
	fct.on('event', fns[1])
	fct.emit('event', 6)
	expect(fns[0]).toHaveBeenCalled()
	expect(fns[1]).toHaveBeenCalled()
})
it('no sur-emits', () => {
	const target = {},
		fct = events(target),
		fns = [jest.fn(), jest.fn(), jest.fn()]
	fct.on('eventX', fns[0])
	fct.on('event', fns[1])
	fct.on('event', fns[2])
	fct.emit('event', 6)
	expect(fns[0]).not.toHaveBeenCalled()
	expect(fns[1]).toHaveBeenCalled()
	expect(fns[2]).toHaveBeenCalled()
})
it('off', () => {
	const target = {},
		fct = events(target),
		fn = jest.fn()
	fct.on('event', fn)
	fct.off('event', fn)
	fct.emit('event', 5)
	expect(fn).not.toHaveBeenCalled()
})
it('unsubscribe', () => {
	const target = {},
		fct = events(target),
		fn = jest.fn()
	fct.on('event', fn)()
	fct.emit('event', 5)
	expect(fn).not.toHaveBeenCalled()
})
it('once', async () => {
	const target = {},
		fct = events(target),
		fn = jest.fn()
	fct.once('event', fn)
	fct.emit('event', 5)
	expect(fn).toHaveBeenCalledTimes(1)
	fct.emit('event', 5)
	expect(fn).toHaveBeenCalledTimes(1)
})
it('promise', async () => {
	const target = {},
		fct = events(target)
	let ctr = 0
	;(async () => {
		for await (const evt of fct.on<number>('event')) ctr += evt
	})()
	expect(ctr).toBe(0)
	fct.emit('event', 5)
	await tick()
	expect(ctr).toBe(5)
	fct.emit('event', 2)
	await tick()
	expect(ctr).toBe(7)
})
it('promise once ', async () => {
	const target = {},
		fct = events(target)
	let ctr = 0
	;(async () => {
		ctr = await fct.once<number>('event')
	})()
	expect(ctr).toBe(0)
	fct.emit('event', 5)
	await tick()
	expect(ctr).toBe(5)
	fct.emit('event', 2)
	await tick()
	expect(ctr).toBe(5)
})
