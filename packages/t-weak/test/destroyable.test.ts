import { TargetIsDeadError } from '@ts-meta/utilities'
import { Destroyable } from '../src'

function tick(ms: number = 0) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

const gc = global.gc

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

type Resource = {
	name: string
	used: boolean
}

class ResourceUsage extends Destroyable {
	constructor(public readonly resource: Resource) {
		super(() => {
			resource.used = false
		})
		resource.used = true
	}
	get name() {
		return this.resource.name
	}
}

it('destroys', async () => {
	const resource = { name: 'resource', used: false }
	function testUsage(resourceUsage: ResourceUsage) {
		expect(resourceUsage.name).toBe('resource')
		expect(resource.used).toBe(true)
		expect(resourceUsage.destroyed).toBe(false)
	}
	testUsage(new ResourceUsage(resource))
	await collectGarbages()
	expect(resource.used).toBe(false)
})
