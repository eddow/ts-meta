import { reactive, watch } from '../src'

describe('watch', () => {
	it('watches', () => {
		const test = reactive([1, 2])
		test.push(3)
	})
})
