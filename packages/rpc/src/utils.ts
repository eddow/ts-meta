interface ObjectAllocator {
	weakRef: WeakRef<any>
	id: number
}

export class numberPool {
	private next = 1
	private readonly pool = new Set<number>()
	private readonly objects: ObjectAllocator[] = []
	allocate(): number {
		if (!this.pool.size) return this.next++
		const n = [...this.pool][0]
		this.pool.delete(n)
		return n
	}
	free(n: number) {
		this.pool.add(n)
		while (this.pool.has(this.next - 1)) this.pool.delete(--this.next)
	}
	allocateForObject(obj: NonNullable<object>): number {
		const n = this.allocate()
		this.objects.push({ weakRef: new WeakRef(obj), id: n })
		return n
	}
	checkObjects() {
		for (let i = 0; i < this.objects.length; i++) {
			const { weakRef, id } = this.objects[i]
			if (weakRef.deref() === undefined) {
				this.free(id)
				this.objects.splice(i, 1)
				i--
			}
		}
	}
}
