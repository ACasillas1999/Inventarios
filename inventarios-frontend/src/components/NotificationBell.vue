<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { IconBell } from '@tabler/icons-vue'
import { notificationsService, type AppNotification } from '@/services/api'
import { useSocketStore } from '@/stores/socket'

const router = useRouter()
const socketStore = useSocketStore()

const notifications = ref<AppNotification[]>([])
const unreadCount = ref(0)
const open = ref(false)
const loading = ref(false)
const rootRef = ref<HTMLDivElement | null>(null)

let socketCleanup: (() => void) | null = null

const load = async () => {
  try {
    loading.value = true
    const resp = await notificationsService.list()
    notifications.value = resp.notifications
    unreadCount.value = resp.unread_count
  } catch (err) {
    console.error('Error loading notifications', err)
  } finally {
    loading.value = false
  }
}

const toggle = () => {
  open.value = !open.value
  if (open.value) load()
}

const close = () => {
  open.value = false
}

const handleOutsideClick = (event: MouseEvent) => {
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    close()
  }
}

const relativeTime = (value: string) => {
  const diffMs = Date.now() - new Date(value).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Ahora'
  if (diffMin < 60) return `Hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `Hace ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  return `Hace ${diffD} d`
}

const handleItemClick = async (notification: AppNotification) => {
  close()
  if (!notification.is_read) {
    notification.is_read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    try {
      await notificationsService.markRead(notification.id)
    } catch (err) {
      console.error('Error marking notification read', err)
    }
  }
  router.push(notification.link)
}

const markAllRead = async () => {
  try {
    await notificationsService.markAllRead()
    notifications.value = notifications.value.map((n) => ({ ...n, is_read: true }))
    unreadCount.value = 0
  } catch (err) {
    console.error('Error marking all notifications read', err)
  }
}

onMounted(() => {
  load()
  document.addEventListener('click', handleOutsideClick)
  socketCleanup = socketStore.on('notification', (payload: any) => {
    const notification = payload?.data as AppNotification
    if (!notification) return
    notifications.value = [notification, ...notifications.value].slice(0, 30)
    unreadCount.value += 1
  })
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
  socketCleanup?.()
})
</script>

<template>
  <div ref="rootRef" class="notif-bell">
    <button class="bell-btn" type="button" aria-label="Notificaciones" @click.stop="toggle">
      <IconBell :size="20" :stroke-width="1.8" />
      <span v-if="unreadCount > 0" class="bell-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>

    <div v-if="open" class="bell-dropdown" @click.stop>
      <div class="bell-dropdown-head">
        <strong>Notificaciones</strong>
        <button v-if="unreadCount > 0" type="button" class="bell-mark-all" @click="markAllRead">
          Marcar todas como leídas
        </button>
      </div>
      <div class="bell-list">
        <p v-if="loading" class="bell-empty">Cargando...</p>
        <p v-else-if="notifications.length === 0" class="bell-empty">Sin notificaciones</p>
        <button
          v-for="n in notifications"
          :key="n.id"
          type="button"
          class="bell-item"
          :class="{ 'bell-item--unread': !n.is_read }"
          @click="handleItemClick(n)"
        >
          <span class="bell-item-title">{{ n.title }}</span>
          <span v-if="n.body" class="bell-item-body">{{ n.body }}</span>
          <span class="bell-item-time">{{ relativeTime(n.created_at) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notif-bell {
  position: relative;
}

.bell-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  cursor: pointer;
}

.bell-btn:hover {
  background: var(--panel-muted);
}

.bell-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 0.25rem;
  border-radius: 999px;
  background: var(--danger);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1.1rem;
  text-align: center;
}

.bell-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: min(340px, 90vw);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.2);
  z-index: 1100;
  overflow: hidden;
}

.bell-dropdown-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.7rem 0.9rem;
  border-bottom: 1px solid var(--line);
  background: var(--panel-muted);
}

.bell-mark-all {
  border: none;
  background: transparent;
  color: var(--accent-strong);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.bell-mark-all:hover {
  text-decoration: underline;
}

.bell-list {
  max-height: 360px;
  overflow-y: auto;
}

.bell-empty {
  padding: 1.2rem;
  text-align: center;
  color: var(--muted);
  font-size: 0.85rem;
}

.bell-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  width: 100%;
  text-align: left;
  padding: 0.65rem 0.9rem;
  border: none;
  border-bottom: 1px solid var(--line);
  background: transparent;
  cursor: pointer;
}

.bell-item:last-child {
  border-bottom: none;
}

.bell-item:hover {
  background: var(--panel-muted);
}

.bell-item--unread {
  background: var(--accent-soft);
}

.bell-item--unread:hover {
  background: var(--accent-soft);
  filter: brightness(0.98);
}

.bell-item-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--ink);
}

.bell-item-body {
  font-size: 0.8rem;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bell-item-time {
  font-size: 0.7rem;
  color: var(--muted);
}
</style>
