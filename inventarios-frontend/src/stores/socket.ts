import { defineStore } from 'pinia'
import { io, Socket } from 'socket.io-client'
import { ref, watch } from 'vue'
import { useAuthStore } from './auth'

export const useSocketStore = defineStore('socket', () => {
    const authStore = useAuthStore()
    const socket = ref<Socket | null>(null)
    const connected = ref(false)

    // Intentar obtener la URL base del API
    const getBaseUrl = () => {
        const apiUrl = import.meta.env.VITE_API_URL || ''
        if (apiUrl) {
            return apiUrl.replace(/\/api$/, '')
        }
        // Fallback dinámico al host actual
        if (typeof window !== 'undefined') {
            return `${window.location.protocol}//${window.location.hostname}:3000`
        }
        return 'http://localhost:3000'
    }

    const url = getBaseUrl()
    const path = '/ws'
    const connectedCountRooms = new Set<number>()

    const connect = () => {
        if (socket.value?.connected) return

        const token = localStorage.getItem('auth_token')
        if (!token) {
            console.warn('Cannot connect to WebSocket: No auth token found')
            return
        }

        console.log(`Connecting to WebSocket at ${url} (path: ${path})...`)
        socket.value = io(url, {
            path,
            auth: { token },
            transports: ['websocket', 'polling']
        })

        socket.value.on('connect', () => {
            connected.value = true
            console.log('✅ Successfully connected to WebSocket:', socket.value?.id)

            // Re-unirse a salas si había alguna activa
            connectedCountRooms.forEach(id => {
                console.log(`Re-joining count room: ${id}`)
                socket.value?.emit('join_count', id)
            })
        })

        socket.value.on('disconnect', (reason) => {
            connected.value = false
            console.log('🔴 Disconnected from WebSocket:', reason)
        })

        socket.value.on('connect_error', (error) => {
            console.error('❌ WebSocket connection error:', error.message)
            connected.value = false
        })
    }

    const disconnect = () => {
        if (socket.value) {
            console.log('Disconnecting WebSocket manually')
            socket.value.disconnect()
            socket.value = null
            connected.value = false
        }
    }

    // Auto-connect/disconnect based on auth status
    watch(
        () => authStore.isAuthenticated,
        (isAuth) => {
            if (isAuth) {
                connect()
            } else {
                disconnect()
            }
        },
        { immediate: true }
    )

    const joinCount = (countId: number) => {
        connectedCountRooms.add(countId)
        if (socket.value?.connected) {
            console.log(`Joining count room: ${countId}`)
            socket.value.emit('join_count', countId)
        }
    }

    const leaveCount = (countId: number) => {
        connectedCountRooms.delete(countId)
        if (socket.value?.connected) {
            console.log(`Leaving count room: ${countId}`)
            socket.value.emit('leave_count', countId)
        }
    }

    const on = (event: string, callback: (...args: any[]) => void) => {
        if (!socket.value) connect()
        console.log(`Registering listener for: ${event}`)
        socket.value?.on(event, callback)

        // Return cleanup function
        return () => {
            console.log(`Unregistering listener for: ${event}`)
            socket.value?.off(event, callback)
        }
    }

    const emit = (event: string, data: any) => {
        if (socket.value?.connected) {
            socket.value.emit(event, data)
        } else {
            console.warn(`Cannot emit "${event}": socket not connected`)
        }
    }

    return {
        socket,
        connected,
        connect,
        disconnect,
        joinCount,
        leaveCount,
        on,
        emit
    }
})
