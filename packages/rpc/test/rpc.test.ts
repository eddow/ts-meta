import { sided, Side } from '../src'
import { PropertiesOf } from '../src/utils'

//#region Interface toward fake websocket

const client = new Side<'client'>('client'),
	server = new Side<'server'>('server')

//#endregion
//#region common

class UserInterface {
	readonly id: number = 0
	name: string = ''

	@sided('Client')
	update(change: Partial<PropertiesOf<UserInterface>>) {
		return client.define<void>()
	}
}

class UserListInterface {
	connected: boolean = false
	@sided('Server')
	create(name: string) {
		return server.define<UserInterface>()
	}
}

//#endregion
//#region server

class UserServer extends server.implement(UserInterface) {}

class UserListServer extends server.implement(UserListInterface) {
	userIdSpace = 0

	create(name: string) {
		return this.createInstance(UserServer, { id: this.userIdSpace++, name })
	}
}

const uls = new UserListServer()
let us = uls.create('test')
let up = us.update({ name: 'test2' })

//#endregion
//#region client

//const ClientUserList = transferable.client(UserListInterface)

//#endregion
const rpcGlobals = {
	users: UserListInterface
}
