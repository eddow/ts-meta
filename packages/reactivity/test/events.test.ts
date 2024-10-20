import { events } from '../src'

// TODO global.gc when --expose-gc is enabled: find a way to enable it then test
// TODO once + promise-led events
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
		fct = events(target),
		fn = jest.fn()
	fct.on('event', fn)
	fct.emit('event', 5)
	expect(fn).toHaveBeenCalledWith(5)
})
