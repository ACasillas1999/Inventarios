import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { authService } from '../services/api'

export interface User {
  id: number
  email: string
  name: string
  role_id: number
  role_name: string
  permissions?: string[]
  status: string
  branches?: Array<{
    id: number
    code: string
    name: string
    status: string
  }>
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const isAuthenticated = ref(false)

  // Getters
  const userName = computed(() => user.value?.name || '')
  const userEmail = computed(() => user.value?.email || '')
  const userRole = computed(() => user.value?.role_name || '')
  const isAdmin = computed(() => user.value?.role_id === 1 || user.value?.permissions?.includes('all'))

  const hasPermission = computed(() => (permission: string) => {
    if (!user.value) return false
    return user.value.permissions?.includes('all') || user.value.permissions?.includes(permission)
  })

  // Actions
  function initializeAuth() {
    // Cargar desde localStorage al iniciar la app
    const savedToken = localStorage.getItem('auth_token')
    const savedUser = localStorage.getItem('user')

    if (savedToken && savedUser) {
      try {
        token.value = savedToken
        user.value = JSON.parse(savedUser)
        isAuthenticated.value = true
      } catch (error) {
        console.error('Error loading auth from localStorage:', error)
        logout()
      }
    }
  }

  async function login(email: string, password: string) {
    const response = await authService.login({ email, password })

    token.value = response.token
    user.value = response.user
    isAuthenticated.value = true

    // Guardar en localStorage
    localStorage.setItem('auth_token', response.token)
    localStorage.setItem('user', JSON.stringify(response.user))

    return response
  }

  function logout() {
    token.value = null
    user.value = null
    isAuthenticated.value = false

    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')

    authService.logout()
  }

  async function checkAuth() {
    if (!token.value) {
      return false
    }

    try {
      const profile = await authService.getProfile()
      user.value = profile
      isAuthenticated.value = true
      return true
    } catch (error) {
      logout()
      return false
    }
  }

  return {
    // State
    user,
    token,
    isAuthenticated,
    // Getters
    userName,
    userEmail,
    userRole,
    isAdmin,
    hasPermission,
    // Actions
    initializeAuth,
    login,
    logout,
    checkAuth
  }
})
