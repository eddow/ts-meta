import { decorators, events } from '../src'

type TSTestEventsDetails = {
	click: { x: number; y: number; button?: 'L' | 'M' | 'R' }
	message: string
	beep: void
}
const evt = events<TSTestEventsDetails>({})
/**
 * The purpose of this function is not to be called but to be validated (by VSCode or any other type-script entity)
 */
function DoNotCallMe() {
	evt.emit('click', { x: 5, y: 6 })
	evt.emit('click', { x: 5, y: 6, button: 'L' })
	evt.emit('beep')
	evt.on('click', ({ x, y }) => {})
	evt.on('click', ({ x, y, button }) => {})

	evt.on('message', (msg) => {
		console.log(msg.toLowerCase())
	})

	// @ts-expect-error: Should have `y`
	evt.emit('click', { x: 5 })
	// @ts-expect-error: Messages have a string detail
	evt.emit('message', { x: 5, y: 6 })
	// @ts-expect-error: Button is 'L'|'M'|'R'
	evt.emit('click', { x: 5, y: 6, button: 'X' })
	// @ts-expect-error: No `d` in details of "click"
	evt.on('click', ({ d }) => {})
	const { on, emit, listener } = decorators<TSTestEventsDetails>()

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
		@emit('message')
		emitMessage2(msg: TSTestEventsDetails['message']) {}
	}

	class TW2 {
		@on() click({ x, y, button }: TSTestEventsDetails['click']) {}
		@on() beep() {}
	}

	class TW3 {
		@on() click({ x, y, button }: TSTestEventsDetails['click']) {}
		@on() beep() {}
	}

	// Errors
	@listener({
		// @ts-expect-error: No `d` in details of "click"
		click: ({ x, d, button }) => {}
	})
	class TE1 {
		// @ts-expect-error: Click doesn't have a string as detail
		@on('click')
		onClick(msg: TSTestEventsDetails['message']) {}
		// @ts-expect-error: 'beep' has no details
		@on
		beep(times: number) {}

		// @ts-expect-error: Details is just a string
		@emit('message')
		emitMessage({ x, y, button }: TSTestEventsDetails['click']) {}
	}
}
it('TypeScript validation', () => {
	/* We just check that the code "compiles" */
})
