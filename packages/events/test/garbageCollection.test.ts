import { TargetIsDeadError } from '@ts-meta/utilities'
import { decorators, events } from '../src'

function tick(ms: number = 0) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

const gc = global.gc

const { on, listener } = decorators()

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
